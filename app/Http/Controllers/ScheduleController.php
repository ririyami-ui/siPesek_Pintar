<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\Journal;
use App\Models\User;
use App\Models\TeacherAssignment;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

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

            // Ensure H:i format for start_time and end_time if they have seconds
            $validated['start_time'] = substr($validated['start_time'], 0, 5);
            $validated['end_time'] = substr($validated['end_time'], 0, 5);

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

            // [VALIDASI BENTROK JADWAL GURU]
            if (!empty($validated['teacher_id'])) {
                $isConflict = Schedule::where('teacher_id', $validated['teacher_id'])
                    ->where('day', $validated['day'])
                    ->where(function($query) use ($validated) {
                        $query->where('start_time', '<', $validated['end_time'] . ':00')
                              ->where('end_time', '>', $validated['start_time'] . ':00');
                    })
                    ->exists();

                if ($isConflict) {
                     $teacher = User::find($validated['teacher_id']);
                     $teacherName = $teacher ? $teacher->name : 'Guru pengampu';
                     throw ValidationException::withMessages([
                         'start_time' => ["Jadwal Bentrok: $teacherName sudah terjadwal mengajar di kelas lain pada jam yang bersinggungan di hari ini."]
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
                $validated['start_time'] = substr($validated['start_time'], 0, 5);
            }
            if (isset($validated['end_time'])) {
                $validated['end_time'] = substr($validated['end_time'], 0, 5);
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

            // [VALIDASI BENTROK JADWAL GURU UPDATE]
            $day = $validated['day'] ?? $schedule->day;
            $start = $validated['start_time'] ?? substr($schedule->start_time, 0, 5);
            $end = $validated['end_time'] ?? substr($schedule->end_time, 0, 5);

            if ($teacherId) {
                $isConflict = Schedule::where('teacher_id', $teacherId)
                    ->where('day', $day)
                    ->where('id', '!=', $schedule->id) // DO NOT check against itself!
                    ->where(function($query) use ($start, $end) {
                        $query->where('start_time', '<', $end . ':00')
                              ->where('end_time', '>', $start . ':00');
                    })
                    ->exists();

                if ($isConflict) {
                     $teacher = User::find($teacherId);
                     $teacherName = $teacher ? $teacher->name : 'Guru pengampu';
                     throw ValidationException::withMessages([
                         'start_time' => ["Jadwal Bentrok: $teacherName sudah terjadwal mengajar di kelas lain pada jam yang bersinggungan di hari ini."]
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
}
