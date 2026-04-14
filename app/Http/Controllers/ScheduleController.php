<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\Journal;
use App\Models\User;
use App\Models\TeacherAssignment;
use App\Models\UserProfile;
use App\Http\Controllers\UserProfileController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use App\Services\AutoScheduleService;

class ScheduleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $user = auth()->user();
        $query = Schedule::with(['class', 'subject', 'teacher']);
        
        if ($user->role === 'teacher') {
            // Find teacher record
            $teacher = Teacher::where('auth_user_id', $user->id)->first();
            
            $query->where(function($q) use ($user, $teacher) {
                // 1. Schedules created by this teacher
                $q->where('teacher_id', $user->id);
                
                // 2. School Agenda (non-teaching) - Everyone should see this
                $q->orWhere('type', 'non-teaching');
                
                // 3. OR schedules matching their assignments
                if ($teacher) {
                    $assignments = $teacher->assignments;
                    foreach ($assignments as $assignment) {
                        $q->orWhere(function($subQ) use ($assignment) {
                            $subQ->where('subject_id', $assignment->subject_id)
                                 ->where('class_id', $assignment->class_id);
                        });
                    }
                }
            });
        }

        $schedules = $query->orderByRaw("FIELD(day, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')")
            ->orderBy('start_period')
            ->orderBy('start_time')
            ->get();
        
        // Match today's journal for each schedule to detect assignment status
        $todayDate = Carbon::now()->format('Y-m-d');
        $schedules->transform(function($s) use ($todayDate) {
            $journal = Journal::where('class_id', $s->class_id)
                ->where('subject_id', $s->subject_id)
                ->where('date', $todayDate)
                ->latest()
                ->first();
                
            $s->is_assignment = $journal ? (bool)$journal->is_assignment : false;
            $s->journal_id = $journal ? $journal->id : null;
            return $s;
        });

        return response()->json(['data' => $schedules]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'class_id' => 'nullable|exists:classes,id',
                'subject_id' => 'nullable|exists:subjects,id',
                'day' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
                'type' => 'nullable|string',
                'activity_name' => 'nullable|string',
                'start_period' => 'nullable|integer',
                'end_period' => 'nullable|integer',
                'start_time' => 'required|string',
                'end_time' => 'required|string',
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'is_recurring' => 'boolean',
                'teacher_id' => 'nullable|exists:users,id',
            ], [
                'day.in' => 'Hari harus berupa salah satu dari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu.',
                'end_time.after' => 'Jam selesai harus lebih akhir dari jam mulai.'
            ]);

            // Custom validation for end_time > start_time since 'after' rule can be tricky with just times
            if (strtotime($validated['start_time']) >= strtotime($validated['end_time'])) {
                throw ValidationException::withMessages([
                    'end_time' => ['Jam selesai harus lebih akhir dari jam mulai.']
                ]);
            }

            // Ensure H:i format and normalize dots to colons
            $validated['start_time'] = str_replace('.', ':', substr($validated['start_time'], 0, 5));
            $validated['end_time'] = str_replace('.', ':', substr($validated['end_time'], 0, 5));

            // [AUTO-DETECT TEACHER FROM ASSIGNMENT]
            if (($validated['type'] ?? null) === 'teaching' && !empty($validated['class_id']) && !empty($validated['subject_id'])) {
                $assignment = TeacherAssignment::where('class_id', $validated['class_id'])
                    ->where('subject_id', $validated['subject_id'])
                    ->with('teacher')
                    ->first();
                    
                if ($assignment && $assignment->teacher) {
                    $validated['teacher_id'] = $assignment->teacher->auth_user_id;
                }
            } else if (($validated['type'] ?? null) !== 'teaching') {
                // Ensure non-teaching schedules don't accidentally get these fields
                $validated['class_id'] = null;
                $validated['subject_id'] = null;
                $validated['teacher_id'] = null;
            }

            // [SECURITY/VALIDATION] For Teaching (KBM), teacher_id IS MANDATORY to prevent silent bypass
            if (($validated['type'] ?? null) === 'teaching' && empty($validated['teacher_id'])) {
                /** @var \App\Models\User $user */
                $user = auth()->user();
                if (!$user->isAdmin()) {
                    $validated['teacher_id'] = auth()->id();
                } else {
                    // If even Admin can't find the teacher in assignments
                    throw ValidationException::withMessages([
                        'subject_id' => ['Data Guru pengampu untuk Mata Pelajaran & Kelas ini belum diset di Master Data. Mohon setel terlebih dahulu agar jadwal ini bisa divalidasi bentroknya.']
                    ]);
                }
            }

            // [INFO] Non-KBM agenda (like breaks) are intentionally allowed to overlap with
            // teaching schedules. They serve as 'pause' periods, not blockers.

            // [VALIDASI BENTROK JADWAL GURU]
            if (!empty($validated['teacher_id'])) {
                $conflict = Schedule::where('teacher_id', $validated['teacher_id'])
                    ->where('day', $validated['day'])
                    ->where(function($query) use ($validated) {
                        $query->whereRaw("TIME(start_time) < TIME(?)", [$validated['end_time']])
                              ->whereRaw("TIME(end_time) > TIME(?)", [$validated['start_time']]);
                    })
                    ->first();

                if ($conflict) {
                     $teacher = User::find($validated['teacher_id']);
                     $teacherName = $teacher ? $teacher->name : 'Guru pengampu';
                     $conflictTime = substr($conflict->start_time, 0, 5) . '-' . substr($conflict->end_time, 0, 5);
                     throw ValidationException::withMessages([
                         'start_time' => ["Jadwal Bentrok: $teacherName sudah terjadwal di hari {$validated['day']} jam $conflictTime. Mohon periksa kembali."]
                     ]);
                }
            }

            // [VALIDASI BENTROK KELAS]
            if (!empty($validated['class_id'])) {
                $classConflict = Schedule::where('class_id', $validated['class_id'])
                    ->where('day', $validated['day'])
                    ->where(function($query) use ($validated) {
                        $query->whereRaw("TIME(start_time) < TIME(?)", [$validated['end_time']])
                              ->whereRaw("TIME(end_time) > TIME(?)", [$validated['start_time']]);
                    })
                    ->first();

                if ($classConflict) {
                    $conflictTime = substr($classConflict->start_time, 0, 5) . '-' . substr($classConflict->end_time, 0, 5);
                    $activity = $classConflict->type === 'teaching' ? ($classConflict->subject->name ?? 'Pelajaran lain') : $classConflict->activity_name;
                    throw ValidationException::withMessages([
                        'start_time' => ["Kelas Bentrok: Kelas ini sudah memiliki agenda '$activity' pada jam $conflictTime."]
                    ]);
                }
            }

            $schedule = Schedule::create($validated);

            // [CACHE INVALIDATION] Clear the cache for the Live Monitor to see changes instantly
            if (isset($validated['day'])) {
                Cache::forget("monitoring_schedules_{$validated['day']}");
            }

            return response()->json(['data' => $schedule], 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Schedule $schedule)
    {
        return $schedule->load(['class', 'subject', 'teacher']);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Schedule $schedule)
    {
        try {
            $validated = $request->validate([
                'class_id' => 'nullable|exists:classes,id',
                'subject_id' => 'nullable|exists:subjects,id',
                'day' => 'string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
                'type' => 'nullable|string',
                'activity_name' => 'nullable|string',
                'start_period' => 'nullable|integer',
                'end_period' => 'nullable|integer',
                'start_time' => 'sometimes|required|string',
                'end_time' => 'sometimes|required|string',
                'start_date' => 'nullable|date',
                'end_date' => 'nullable|date|after_or_equal:start_date',
                'is_recurring' => 'boolean',
                'teacher_id' => 'nullable|exists:users,id',
            ], [
                'day.in' => 'Hari harus berupa salah satu dari: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu.',
                'end_time.after' => 'Jam selesai harus lebih akhir dari jam mulai.'
            ]);

            if (isset($validated['start_time']) && isset($validated['end_time'])) {
                if (strtotime($validated['start_time']) >= strtotime($validated['end_time'])) {
                    throw ValidationException::withMessages([
                        'end_time' => ['Jam selesai harus lebih akhir dari jam mulai.']
                    ]);
                }
            }

            if (isset($validated['start_time'])) {
                $validated['start_time'] = str_replace('.', ':', substr($validated['start_time'], 0, 5));
            }
            if (isset($validated['end_time'])) {
                $validated['end_time'] = str_replace('.', ':', substr($validated['end_time'], 0, 5));
            }

            // [AUTO-DETECT TEACHER FROM ASSIGNMENT ON UPDATE]
            $classId = $validated['class_id'] ?? $schedule->class_id;
            $subjectId = $validated['subject_id'] ?? $schedule->subject_id;
            $type = $validated['type'] ?? $schedule->type;
            $teacherId = $validated['teacher_id'] ?? $schedule->teacher_id;
            
            if ($type === 'teaching' && !empty($classId) && !empty($subjectId)) {
                $assignment = TeacherAssignment::where('class_id', $classId)
                    ->where('subject_id', $subjectId)
                    ->with('teacher')
                    ->first();
                if ($assignment && $assignment->teacher) {
                    $teacherId = $assignment->teacher->auth_user_id;
                    $validated['teacher_id'] = $teacherId;
                }
            } else if ($type !== 'teaching') {
                // Reset academic fields for non-teaching
                $validated['class_id'] = null;
                $validated['subject_id'] = null;
                $validated['teacher_id'] = null;
                $teacherId = null;
            }

            // [INFO] Non-KBM agenda (like breaks) are intentionally allowed to overlap with
            // teaching schedules on update. They serve as 'pause' periods, not blockers.
            $day = $validated['day'] ?? $schedule->day;
            $start = $validated['start_time'] ?? substr($schedule->start_time, 0, 5);
            $end = $validated['end_time'] ?? substr($schedule->end_time, 0, 5);

            // [VALIDASI BENTROK JADWAL GURU UPDATE]
            if ($teacherId) {
                $conflict = Schedule::where('teacher_id', $teacherId)
                    ->where('day', $day)
                    ->where('id', '!=', $schedule->id) // Exclude current schedule when updating
                    ->where(function($query) use ($start, $end) {
                        $query->whereRaw("TIME(start_time) < TIME(?)", [$end])
                              ->whereRaw("TIME(end_time) > TIME(?)", [$start]);
                    })
                    ->first();

                if ($conflict) {
                     $teacher = User::find($teacherId);
                     $teacherName = $teacher ? $teacher->name : 'Guru pengampu';
                     $conflictTime = substr($conflict->start_time, 0, 5) . '-' . substr($conflict->end_time, 0, 5);
                     throw ValidationException::withMessages([
                         'start_time' => ["Jadwal Bentrok: $teacherName sudah terjadwal di hari $day jam $conflictTime."]
                     ]);
                }
            }

            // [VALIDASI BENTROK KELAS UPDATE]
            if (!empty($classId)) {
                $classConflict = Schedule::where('class_id', $classId)
                    ->where('day', $day)
                    ->where('id', '!=', $schedule->id)
                    ->where(function($query) use ($start, $end) {
                        $query->whereRaw("TIME(start_time) < TIME(?)", [$end])
                              ->whereRaw("TIME(end_time) > TIME(?)", [$start]);
                    })
                    ->first();

                if ($classConflict) {
                    $conflictTime = substr($classConflict->start_time, 0, 5) . '-' . substr($classConflict->end_time, 0, 5);
                    $activity = $classConflict->type === 'teaching' ? ($classConflict->subject->name ?? 'Pelajaran lain') : $classConflict->activity_name;
                    throw ValidationException::withMessages([
                        'start_time' => ["Kelas Bentrok: Kelas ini sudah memiliki agenda '$activity' pada jam $conflictTime."]
                    ]);
                }
            }

            $schedule->update($validated);

            // [CACHE INVALIDATION ON UPDATE]
            Cache::forget("monitoring_schedules_{$day}");

            return response()->json(['data' => $schedule]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Update failed', 'errors' => $e->errors()], 422);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Schedule $schedule)
    {
        $day = $schedule->day;
        $schedule->delete();
        
        // [CACHE INVALIDATION ON DELETE]
        Cache::forget("monitoring_schedules_{$day}");
        return response()->json(null, 204);
    }

    /**
     * Bulk synchronize schedules with a specific teaching hour template profile
     */
    public function syncWithTemplate(Request $request)
    {
        $request->validate([
            'profile_id' => 'required|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $profileId = $request->profile_id;
        $rangeStart = $request->start_date;
        $rangeEnd = $request->end_date;

        // Get the master admin ID (usually the first admin ever created)
        $adminUserId = User::whereIn('role', ['admin', 'adminer'])
            ->orderBy('id', 'asc')
            ->value('id') ?? 1;
        $adminProfile = UserProfile::where('user_id', $adminUserId)->first();

        if (!$adminProfile || !$adminProfile->teaching_time_slots) {
            return response()->json(['message' => 'Template waktu belum diatur oleh Admin.'], 404);
        }

        $allData = $adminProfile->teaching_time_slots;
        $profiles = $allData['profiles'] ?? [];
        $selectedProfile = collect($profiles)->firstWhere('id', $profileId);

        if (!$selectedProfile) {
            return response()->json(['message' => 'Profil template tidak ditemukan.'], 404);
        }

        $templateSlots = $selectedProfile['slots'] ?? [];

        // Build the query for schedules
        $query = Schedule::where('type', 'teaching'); // Only KBM as per user request
        
        if ($rangeStart && $rangeEnd) {
            $query->where(function($q) use ($rangeStart, $rangeEnd) {
                $q->whereBetween('start_date', [$rangeStart, $rangeEnd])
                  ->orWhereBetween('end_date', [$rangeStart, $rangeEnd])
                  ->orWhere(function($sub) use ($rangeStart, $rangeEnd) {
                      $sub->where('start_date', '<=', $rangeStart)
                          ->where('end_date', '>=', $rangeEnd);
                  });
            });
        }

        $schedules = $query->get();
        $updatedCount = 0;
        $skippedCount = 0;

        DB::beginTransaction();
        try {
            foreach ($schedules as $schedule) {
                $day = $schedule->day;
                $slots = $templateSlots[$day] ?? [];
                
                if (empty($slots)) {
                    $skippedCount++;
                    continue;
                }

                $startTime = null;
                $endTime = null;

                // Match Start Period
                if ($schedule->start_period) {
                    $match = collect($slots)->firstWhere('jam_ke', $schedule->start_period);
                    if ($match) $startTime = $match['mulai'];
                }

                // Match End Period
                if ($schedule->end_period) {
                    $match = collect($slots)->firstWhere('jam_ke', $schedule->end_period);
                    if ($match) $endTime = $match['selesai'];
                } else if ($schedule->start_period) {
                    // Fallback: if only start period is set, use the end time of that period
                    $match = collect($slots)->firstWhere('jam_ke', $schedule->start_period);
                    if ($match) $endTime = $match['selesai'];
                }

                if ($startTime && $endTime) {
                    $schedule->update([
                        'start_time' => str_replace('.', ':', substr($startTime, 0, 5)),
                        'end_time' => str_replace('.', ':', substr($endTime, 0, 5)),
                    ]);
                    $updatedCount++;
                } else {
                    $skippedCount++;
                }
            }

            DB::commit();
            
            // Clear cache
            Cache::flush(); 

            return response()->json([
                'message' => 'Sinkronisasi selesai.',
                'updated' => $updatedCount,
                'skipped' => $skippedCount,
                'total_processed' => $schedules->count()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Terjadi kesalahan saat sinkronisasi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Analyze synchronization between active template slots and teaching assignments
     */
    public function getSyncAnalysis()
    {
        /** @var User $user */
        $user = auth()->user();
        if (!$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat mengakses analisis sinkronisasi.');
        }

        // 1. Get Active Template Capacity
        $adminProfile = UserProfile::where('user_id', $user->id)->first();
        if (!$adminProfile || !$adminProfile->teaching_time_slots) {
            $adminProfile = UserProfile::whereNotNull('teaching_time_slots')->first();
        }

        if (!$adminProfile) {
            return response()->json(['message' => 'Template waktu belum diatur.'], 404);
        }

        $allData = $adminProfile->teaching_time_slots;
        $activeProfile = collect($allData['profiles'] ?? [])->firstWhere('is_active', true);
        
        if (!$activeProfile) {
            return response()->json(['message' => 'Tidak ada profil templat waktu yang aktif.'], 404);
        }

        $templateSlotsCount = 0;
        foreach ($activeProfile['slots'] ?? [] as $daySlots) {
            if (is_array($daySlots)) {
                $templateSlotsCount += count($daySlots);
            }
        }

        // 2. Get Assignments Burden per Class
        $classes = \App\Models\SchoolClass::orderBy('rombel', 'asc')->get();
        $analysis = [];

        foreach ($classes as $class) {
            $weeklyHours = TeacherAssignment::where('class_id', $class->id)
                ->with('subject')
                ->get()
                ->sum(fn($a) => ($a->subject->weekly_hours ?? 0));

            $diff = $templateSlotsCount - $weeklyHours;
            
            $analysis[] = [
                'class_id' => $class->id,
                'rombel' => $class->rombel,
                'capacity' => $templateSlotsCount,
                'burden' => intval($weeklyHours),
                'diff' => $diff,
                'status' => $diff === 0 ? 'balanced' : ($diff > 0 ? 'underload' : 'overload')
            ];
        }

        return response()->json([
            'profile_name' => $activeProfile['name'] ?? 'Biasa',
            'total_capacity' => (int)$templateSlotsCount,
            'data' => $analysis
        ]);
    }

    /**
     * Audit subject allocation per class
     */
    public function getAllocationAudit()
    {
        /** @var User $user */
        $user = auth()->user();
        if (!$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat mengakses audit alokasi.');
        }

        $classes = \App\Models\SchoolClass::orderBy('rombel', 'asc')->get();
        $audit = [];

        foreach ($classes as $class) {
            $assignments = TeacherAssignment::where('class_id', $class->id)
                ->with(['subject', 'teacher'])
                ->get();
            
            $classData = [];
            foreach ($assignments as $as) {
                // Ignore subjects with 0 weekly hours
                $target = $as->subject->weekly_hours ?? 0;
                if ($target <= 0) continue;

                // Sum periods in Schedule: (end - start + 1)
                $scheduled = Schedule::where('class_id', $class->id)
                    ->where('subject_id', $as->subject_id)
                    ->where('type', 'teaching')
                    ->get()
                    ->sum(fn($s) => ($s->end_period - $s->start_period + 1));
                
                $status = 'exact';
                if ($scheduled === 0) $status = 'undistributed';
                elseif ($scheduled < $target) $status = 'incomplete';
                elseif ($scheduled > $target) $status = 'overload';

                $classData[] = [
                    'subject' => $as->subject->name,
                    'teacher' => $as->teacher->name ?? '?',
                    'target' => (int)$target,
                    'scheduled' => (int)$scheduled,
                    'diff' => $scheduled - $target,
                    'status' => $status
                ];
            }

            $audit[] = [
                'class_id' => $class->id,
                'rombel' => $class->rombel,
                'subjects' => $classData
            ];
        }

        return response()->json($audit);
    }

    /**
     * Audit teacher workload across all classes
     */
    public function getTeacherWorkloadAudit()
    {
        /** @var User $user */
        $user = auth()->user();
        if (!$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat mengakses audit beban guru.');
        }

        // 1. Get capacity from active profile
        $capacity = 0;
        $activeProfileName = 'Biasa';
        $profileContent = \App\Models\UserProfile::whereNotNull('teaching_time_slots')->first();
        if ($profileContent) {
            $allData = is_string($profileContent->teaching_time_slots) 
                ? json_decode($profileContent->teaching_time_slots, true) 
                : $profileContent->teaching_time_slots;
            
            $activeProfile = collect($allData['profiles'] ?? [])->firstWhere('is_active', true);
            if ($activeProfile) {
                $activeProfileName = $activeProfile['name'] ?? 'Biasa';
                foreach ($activeProfile['slots'] ?? [] as $daySlots) {
                    if (is_array($daySlots)) $capacity += count($daySlots);
                }
            }
        }

        if ($capacity === 0) $capacity = 40; // Safe Fallback

        // 2. Fetch all teachers with their assignments
        $teachers = \App\Models\Teacher::whereHas('assignments')
            ->with(['assignments.subject', 'assignments.schoolClass'])
            ->get();

        $audit = [];
        foreach ($teachers as $teacher) {
            $totalHours = $teacher->total_weekly_hours;
            
            $details = $teacher->assignments->map(fn($as) => [
                'class' => $as->schoolClass->rombel ?? '?',
                'subject' => $as->subject->name ?? '?',
                'hours' => (int)($as->subject->weekly_hours ?? 0)
            ])->values();

            $saturation = ($totalHours / $capacity) * 100;
            
            $status = 'healthy';
            if ($saturation > 85) $status = 'critical';
            elseif ($saturation >= 75) $status = 'high';
            elseif ($saturation < 20) $status = 'underload';

            $audit[] = [
                'id' => $teacher->id,
                'name' => $teacher->name,
                'total_hours' => (int)$totalHours,
                'capacity' => $capacity,
                'saturation' => (float)round($saturation, 1),
                'status' => $status,
                'assignments' => $details
            ];
        }

        return response()->json([
            'profile_name' => $activeProfileName,
            'capacity' => $capacity,
            'teachers' => collect($audit)->sortByDesc('saturation')->values()
        ]);
    }

    /**
     * Automatically generate teaching schedules based on assignments and weekly hours
     */
    public function autoGenerate(Request $request)
    {
        /** @var User $user */
        $user = auth()->user();
        if (!$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat membuat jadwal otomatis.');
        }

        // Use the current admin ID as the primary search for the template
        $adminUserId = $user->id;

        $service = new AutoScheduleService($adminUserId);
        $result = $service->generate();

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
                'errors' => $result['errors'] ?? []
            ], 422);
        }

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json([
            'message' => 'Jadwal berhasil dibuat secara otomatis!',
            'count' => $result['count']
        ]);
    }
}
