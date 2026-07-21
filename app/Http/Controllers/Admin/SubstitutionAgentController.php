<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Schedule;
use App\Models\SubstitutionRecommendation;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SubstitutionAgentController extends Controller
{
    /**
     * List pending substitution recommendations.
     */
    public function index()
    {
        $recommendations = SubstitutionRecommendation::with([
            'schedule', 'class', 'subject',
            'originalTeacher:id,name,nip',
            'substituteTeacher:id,name,nip',
        ])
            ->whereIn('status', ['pending', 'approved'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $recommendations]);
    }

    /**
     * Run substitution detection (calls artisan command) and return new results.
     */
    public function detect()
    {
        try {
            $exitCode = \Artisan::call('substitution:detect');
            $output = trim(\Artisan::output());
        } catch (\Throwable $e) {
            $output = 'Error: ' . $e->getMessage();
        }

        // Return fresh data
        $recommendations = SubstitutionRecommendation::with([
            'schedule', 'class', 'subject',
            'originalTeacher:id,name,nip',
            'substituteTeacher:id,name,nip',
        ])
            ->whereIn('status', ['pending', 'approved'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $recommendations,
            'output' => $output,
        ]);
    }

    /**
     * Suggest available teachers for a pending substitution.
     */
    public function suggest(SubstitutionRecommendation $substitution)
    {
        if ($substitution->status !== 'pending') {
            return response()->json(['message' => 'Rekomendasi sudah diproses.'], 422);
        }

        $subjectId = $substitution->subject_id;
        $date = $substitution->date->toDateString();
        $dayName = Carbon::parse($date)->locale('id')->dayName;

        // Get teachers who teach this subject (via teacher_assignments)
        $teacherIds = TeacherAssignment::where('subject_id', $subjectId)
            ->pluck('teacher_id')
            ->unique();

        $teachers = User::whereIn('id', $teacherIds)
            ->where('role', 'teacher')
            ->where('status', 'active')
            ->get(['id', 'name', 'nip']);

        $available = [];

        foreach ($teachers as $teacher) {
            // Skip the original teacher
            if ($teacher->id === $substitution->original_teacher_id) {
                continue;
            }

            // Check if teacher has schedule at this time slot (bentrok)
            $hasConflict = Schedule::where('teacher_id', $teacher->id)
                ->where('day', $dayName)
                ->where(function ($q) use ($substitution) {
                    $q->whereBetween('start_time', [$substitution->start_time, $substitution->end_time])
                        ->orWhereBetween('end_time', [$substitution->start_time, $substitution->end_time])
                        ->orWhere(function ($q2) use ($substitution) {
                            $q2->where('start_time', '<=', $substitution->start_time)
                                ->where('end_time', '>=', $substitution->end_time);
                        });
                })
                ->where('type', '!=', 'non-teaching')
                ->exists();

            if ($hasConflict) {
                continue;
            }

            // Check if already assigned as substitute for same timeslot today
            $alreadySub = SubstitutionRecommendation::where('substitute_teacher_id', $teacher->id)
                ->where('date', $date)
                ->where('status', 'approved')
                ->where(function ($q) use ($substitution) {
                    $q->whereBetween('start_time', [$substitution->start_time, $substitution->end_time])
                        ->orWhereBetween('end_time', [$substitution->start_time, $substitution->end_time]);
                })
                ->exists();

            if ($alreadySub) {
                continue;
            }

            // Check teaching load for the day (optional soft limit: max 4 sessions)
            $todaySessions = Schedule::where('teacher_id', $teacher->id)
                ->where('day', $dayName)
                ->where('type', '!=', 'non-teaching')
                ->count();

            $available[] = [
                'id' => $teacher->id,
                'name' => $teacher->name,
                'nip' => $teacher->nip,
                'today_sessions' => $todaySessions,
                'score' => $this->calculateScore($teacher->id, $subjectId, $substitution->class_id),
            ];
        }

        // Sort by score descending
        usort($available, fn ($a, $b) => $b['score'] <=> $a['score']);

        return response()->json(['data' => $available]);
    }

    /**
     * Assign a substitute teacher (approve).
     */
    public function assign(Request $request, SubstitutionRecommendation $substitution)
    {
        if ($substitution->status !== 'pending') {
            return response()->json(['message' => 'Rekomendasi sudah diproses.'], 422);
        }

        $validated = $request->validate([
            'teacher_id' => 'required|exists:users,id',
        ]);

        $teacher = User::findOrFail($validated['teacher_id']);

        DB::transaction(function () use ($substitution, $teacher) {
            // Update schedule with substitute teacher
            $schedule = $substitution->schedule;
            if ($schedule) {
                $schedule->update(['teacher_id' => $teacher->id]);
            }

            // Mark recommendation as approved
            $substitution->update([
                'status' => 'approved',
                'substitute_teacher_id' => $teacher->id,
            ]);
        });

        // Send push notification to substitute teacher (best-effort)
        try {
            $notificationService = app(\App\Services\NotificationService::class);
            $notificationService->notifySubstitution($substitution->fresh());
        } catch (\Throwable $e) {
            Log::warning("Push notification skipped: {$e->getMessage()}");
        }

        Log::info("Substitution approved: schedule={$substitution->schedule_id}, original={$substitution->original_teacher_id}, substitute={$teacher->id}");

        return response()->json([
            'message' => "{$teacher->name} ditugaskan sebagai pengganti.",
            'data' => $substitution->fresh()->load([
                'schedule', 'class', 'subject',
                'originalTeacher:id,name,nip',
                'substituteTeacher:id,name,nip',
            ]),
        ]);
    }

    /**
     * Dismiss (ignore) a recommendation.
     */
    public function dismiss(SubstitutionRecommendation $substitution)
    {
        if ($substitution->status !== 'pending') {
            return response()->json(['message' => 'Rekomendasi sudah diproses.'], 422);
        }

        $substitution->update(['status' => 'dismissed']);

        return response()->json(['message' => 'Rekomendasi diabaikan.']);
    }

    /**
     * Calculate suitability score (higher = better match).
     */
    private function calculateScore(int $teacherId, int $subjectId, ?int $classId): int
    {
        $score = 50; // base

        // Same subject = +30
        $assignments = TeacherAssignment::where('teacher_id', $teacherId)
            ->pluck('subject_id');

        if ($assignments->contains($subjectId)) {
            $score += 30;
        }

        // Has taught this class before = +20
        if ($classId) {
            $hasTaught = Schedule::where('teacher_id', $teacherId)
                ->where('class_id', $classId)
                ->exists();
            if ($hasTaught) {
                $score += 20;
            }
        }

        return $score;
    }
}
