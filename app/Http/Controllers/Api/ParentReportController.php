<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ParentReport;
use App\Models\Student;
use Illuminate\Http\Request;

class ParentReportController extends Controller
{
    /**
     * List parent reports for the logged-in parent/student.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $student = Student::where('auth_user_id', $user->id)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        $query = ParentReport::where('student_id', $student->id)->orderByDesc('period_start');
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $reports = $query->get()->map(fn($r) => $this->formatReport($r));

        return response()->json([
            'student' => ['id' => $student->id, 'name' => $student->name],
            'reports' => $reports,
        ]);
    }

    /**
     * Get single report detail (marks as read).
     */
    public function show(Request $request, int $id)
    {
        $user = auth()->user();
        $student = Student::where('auth_user_id', $user->id)->first();
        $report = ParentReport::where('id', $id)->where('student_id', $student?->id)->first();
        if (!$report) {
            return response()->json(['message' => 'Report not found'], 404);
        }
        if (!$report->read_at) {
            $report->update(['read_at' => now()]);
        }
        return response()->json(['report' => $this->formatReport($report, true)]);
    }

    /**
     * Admin: list all reports with filters.
     */
    public function adminIndex(Request $request)
    {
        $query = ParentReport::with('student.class')
            ->orderByDesc('period_start')
            ->orderBy('class_id');
        
        foreach (['type', 'student_id', 'class_id'] as $f) {
            if ($request->has($f)) $query->where($f, $request->$f);
        }
        
        $perPage = (int)$request->get('per_page', 20);
        $perPage = min($perPage, 1000);
        
        $data = $query->paginate($perPage)
            ->through(fn($r) => $this->formatReport($r, true));
        
        return response()->json($data);
    }

    /**
     * Admin: trigger regeneration for a specific student.
     */
    public function regenerate(Request $request, int $studentId)
    {
        $type = $request->get('type', 'weekly');
        \Artisan::call("reports:send-parent --type={$type} --student-id={$studentId} --force");
        return response()->json([
            'message' => 'Report regeneration started.',
            'output'  => trim(\Artisan::output()),
        ]);
    }

    private function formatReport(ParentReport $r, bool $full = false): array
    {
        $base = [
            'id'           => $r->id,
            'student_id'   => $r->student_id,
            'student'      => $r->relationLoaded('student')
                ? [
                    'id'    => $r->student?->id,
                    'name'  => $r->student?->name,
                    'class' => $r->student?->class
                        ? ['rombel' => $r->student->class->rombel]
                        : null,
                ]
                : null,
            'type'         => $r->type,
            'period_label' => $r->period_label,
            'period_start' => $r->period_start?->toDateString(),
            'period_end'   => $r->period_end?->toDateString(),
            'is_sent'      => $r->is_sent,
            'sent_at'      => $r->sent_at?->toIso8601String(),
            'read_at'      => $r->read_at?->toIso8601String(),
            'stats'        => $r->stats_snapshot,
        ];

        if ($full) {
            $base['sections'] = [
                'academic'       => $r->summary_academic,
                'attendance'     => $r->summary_attendance,
                'behavior'       => $r->summary_behavior,
                'activity'       => $r->summary_activity,
                'recommendation' => $r->summary_recommendation,
            ];
            $base['full_report'] = $r->full_report;
            $base['radar']       = $r->radar_snapshot;
        }

        return $base;
    }
}
