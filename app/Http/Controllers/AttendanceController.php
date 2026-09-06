<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;

class AttendanceController extends Controller
{
    /**
     * Get attendance records with filters
     */
    public function index(Request $request)
    {
        $query = Attendance::with(['student', 'class', 'subject', 'teacher']);

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        if ($request->has('date_start') && $request->has('date_end')) {
            $query->whereBetween('date', [$request->date_start, $request->date_end]);
        } elseif ($request->filled('date')) {
            $query->whereDate('date', $request->date);
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->filled('user_id')) {
            $request->validate(['user_id' => 'integer|exists:users,id']);
            $query->where('user_id', $request->user_id);
        }

        // [SECURITY] Non-admin: hanya lihat absensi mapel yang diampu, kecuali wali kelas
        $user = auth()->user();
        if ($user && !$user->isAdmin()) {
            $isWaliKelas = false;
            if ($request->filled('class_id')) {
                $isWaliKelas = \App\Models\SchoolClass::where('id', $request->class_id)
                    ->where('user_id', $user->id)
                    ->exists();
            } elseif ($request->filled('student_id')) {
                $studentClassId = \App\Models\Student::where('id', $request->student_id)->value('class_id');
                $isWaliKelas = $studentClassId && \App\Models\SchoolClass::where('id', $studentClassId)
                    ->where('user_id', $user->id)
                    ->exists();
            }

            if (!$isWaliKelas) {
                $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
                if (!$teacher) {
                    return response()->json(['data' => []]);
                }

                $assignmentQuery = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id);
                if ($request->filled('class_id')) {
                    $assignmentQuery->where('class_id', $request->class_id);
                }

                $assignments = $assignmentQuery->get();
                $subjectIds = $assignments->pluck('subject_id')->unique()->toArray();
                $classIdsGuru = $assignments->pluck('class_id')->unique()->toArray();

                if (empty($subjectIds) && empty($classIdsGuru)) {
                    return response()->json(['data' => []]);
                }

                // [KEGIATAN] Guru non-wali hanya melihat mapel yang diampu,
                // ditambah absen kegiatan (subject_id NULL) pada kelas yang diampu.
                $query->where(function ($q) use ($subjectIds, $classIdsGuru, $request) {
                    $hasAny = false;
                    if (!empty($subjectIds)) {
                        $q->whereIn('subject_id', $subjectIds);
                        $hasAny = true;
                    }
                    if (!empty($classIdsGuru) && !$request->filled('subject_id')) {
                        $q->orWhere(function ($sq) use ($classIdsGuru) {
                            $sq->whereNull('subject_id')
                               ->whereIn('class_id', $classIdsGuru);
                        });
                        $hasAny = true;
                    }
                    if (!$hasAny) {
                        $q->whereRaw('1 = 0');
                    }
                });
            }
        }

        $attendances = $query->orderBy('date', 'desc')->get();

        // [FIX] Attach time from Schedule — batch load to avoid N+1 queries
        $dayMapping = [
            'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat',
            'Saturday' => 'Sabtu',
        ];

        // Load schedules once for all involved classes/subjects (batch, avoid N+1)
        $classIds = $attendances->pluck('class_id')->filter()->all();
        $subjectIds = $attendances->pluck('subject_id')->filter()->all();

        $scheduleMap = [];
        if (!empty($classIds) || !empty($subjectIds)) {
            $scheduleQuery = \App\Models\Schedule::query();
            if (!empty($classIds)) {
                $scheduleQuery->whereIn('class_id', $classIds);
            }
            $schedules = $scheduleQuery->get();

            foreach ($schedules as $schedule) {
                $scheduleMap[$schedule->class_id . '|' . $schedule->subject_id . '|' . $schedule->day] = $schedule;
            }

            foreach ($attendances as $attendance) {
                $dayName = $dayMapping[Carbon::parse($attendance->date)->format('l')] ?? null;
                if ($dayName) {
                    $key = $attendance->class_id . '|' . $attendance->subject_id . '|' . $dayName;
                    $schedule = $scheduleMap[$key] ?? null;
                    if ($schedule) {
                        $attendance->time = Carbon::parse($schedule->start_time)->format('H:i') . ' - ' . Carbon::parse($schedule->end_time)->format('H:i');
                    }
                }
            }
        }

        return response()->json(['data' => $attendances]);
    }

    /**
     * Download attendance as PDF table
     */
    public function downloadPdf(Request $request)
    {
        $classId = $request->input('class_id');
        $monthParam = $request->input('month');
        $yearParam = $request->input('year');

        if (!$classId || !$monthParam || !$yearParam) {
            return response()->json(['message' => 'class_id, month, and year are required'], 400);
        }

        $user = auth()->user();
        $profile = \App\Models\UserProfile::where('user_id', $user->id)->first() 
                   ?? \App\Models\UserProfile::first();
        
        $semester = $request->input('semester') ?? ($profile->active_semester ?? 'Ganjil');
        $academicYear = $profile->academic_year ?? date('Y') . '/' . (date('Y') + 1);

        // Calculate start and end date for the given month and year
        $startDate = Carbon::create($yearParam, $monthParam, 1)->startOfMonth()->format('Y-m-d');
        $endDate = Carbon::create($yearParam, $monthParam, 1)->endOfMonth()->format('Y-m-d');
        
        // fetch attendances for class in range
        $attendanceQuery = Attendance::with(['student'])
            ->where('class_id', $classId)
            ->whereBetween('date', [$startDate, $endDate]);

        // [SECURITY] Non-admin: hanya mapel yang diampu, kecuali wali kelas
        if ($user && !$user->isAdmin()) {
            $isWaliKelas = \App\Models\SchoolClass::where('id', $classId)
                ->where('user_id', $user->id)
                ->exists();

            if (!$isWaliKelas) {
                $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
                if (!$teacher) {
                    return response()->json(['message' => 'Data guru tidak ditemukan. Hubungi admin untuk verifikasi.'], 403);
                }

                $subjectIds = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id)
                    ->where('class_id', $classId)
                    ->pluck('subject_id')
                    ->unique()
                    ->toArray();

                if (empty($subjectIds)) {
                    return response()->json(['message' => 'Anda tidak mengampu mata pelajaran di kelas ini.'], 403);
                }

                $attendanceQuery->whereIn('subject_id', $subjectIds);
            }
        }

        $attendances = $attendanceQuery->orderBy('date')->get();

        // collect unique dates
        $dates = [];
        // Generate all dates for the selected month
        $allDatesInMonth = collect();
        $currentDate = Carbon::create($yearParam, $monthParam, 1)->startOfMonth();
        $endDateOfMonth = Carbon::create($yearParam, $monthParam, 1)->endOfMonth();
        while ($currentDate->lte($endDateOfMonth)) {
            $allDatesInMonth->push($currentDate->copy());
            $currentDate->addDay();
        }
        $dateObjs = $allDatesInMonth->sortBy(fn($date) => $date->timestamp);

        // group by student
        $students = [];
        $summaryMap = []; // student_id -> status -> count
        $attMap = []; // student_id -> date -> status_code
        foreach ($attendances as $a) {
            $sid = $a->student_id;
            $dateStr = Carbon::parse($a->date)->format('Y-m-d');
            $students[$sid] = $a->student; 
            $status = strtolower($a->status);
            $code = '';
            if ($status === 'hadir') $code = 'H';
            elseif ($status === 'sakit') $code = 'S';
            elseif ($status === 'izin' || $status === 'ijin') $code = 'I';
            elseif ($status === 'alpa' || $status === 'alpha') $code = 'A';
            
            $attMap[$sid][$dateStr] = $code;
            if ($code) {
                $summaryMap[$sid][$code] = ($summaryMap[$sid][$code] ?? 0) + 1;
            }
        }

        $class = \App\Models\SchoolClass::with('wali')->find($classId);
        if (!$class) {
            return response()->json(['message' => 'Class not found'], 404);
        }

        $pdf = Pdf::loadView('attendance.pdf', [
            'schoolName' => $profile->school_name ?? 'Sekolah Pintar',
            'academicYear' => $academicYear,
            'semester' => $semester,
            'class' => $class,
            'period' => Carbon::create($yearParam, $monthParam, 1)->translatedFormat('F Y'),
            'waliName' => $class->wali?->name ?? auth()->user()->name,
            'students' => collect($students)->sortBy('absen'),
            'dates' => $dateObjs,
            'attMap' => $attMap,
            'summaryMap' => $summaryMap
        ])->setPaper('a4', 'landscape');
        
        return $pdf->download("Rekap_Absensi_{$class->rombel}_" . Carbon::create($yearParam, $monthParam, 1)->translatedFormat('F Y') . ".pdf");
    }

    /**
     * Store bulk attendance records
     */
    public function storeBulk(Request $request)
    {
        // [NORMALIZATION] Ensure status is normalized before validation
        if ($request->has('attendances') && is_array($request->attendances)) {
            $attendances = $request->attendances;
            foreach ($attendances as &$item) {
                if (isset($item['status'])) {
                    $status = strtolower($item['status']);
                    if ($status === 'ijin') $status = 'izin';
                    if ($status === 'alpha') $status = 'alpa';
                    $item['status'] = $status;
                }
            }
            $request->merge(['attendances' => $attendances]);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'attendances' => 'required|array',
            'attendances.*.student_id' => 'required|exists:students,id',
            'attendances.*.status' => 'required|in:hadir,sakit,izin,alpa',
            'attendances.*.note' => 'nullable|string',
        ]);

        // [SECURITY] Ensure non-admin teachers can only submit attendance for classes they teach
        $user = auth()->user();
        if (!$user->isAdmin()) {
            $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
            if (!$teacher) {
                return response()->json([
                    'message' => 'Data guru tidak ditemukan. Hubungi admin untuk verifikasi.'
                ], 403);
            }

            // Check if teacher is assigned to this class
            $isAssigned = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id)
                ->where('class_id', $validated['class_id'])
                ->exists();

            if (!$isAssigned) {
                return response()->json([
                    'message' => 'Anda tidak memiliki akses untuk memasukkan absensi di kelas ini.'
                ], 403);
            }

            // If subject_id is provided, also verify the teacher teaches that subject in this class
            if (!empty($validated['subject_id'])) {
                $subjectAssigned = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id)
                    ->where('class_id', $validated['class_id'])
                    ->where('subject_id', $validated['subject_id'])
                    ->exists();

                if (!$subjectAssigned) {
                    return response()->json([
                        'message' => 'Anda tidak mengajar mata pelajaran ini di kelas yang dipilih.'
                    ], 403);
                }
            }
        }

        $date = \Carbon\Carbon::parse($validated['date'])->format('Y-m-d');
        
        // [FEATURE] Agenda Kegiatan vs Libur
        $holiday = \App\Models\Holiday::where(function($q) use ($date) {
            $q->where('date', $date)
              ->orWhere(function($sub) use ($date) {
                  $sub->where('start_date', '<=', $date)
                      ->where('end_date', '>=', $date);
              });
        })->first();

        // [KEGIATAN] Agenda kegiatan (mis. P5): absensi pagi dicatat TANPA mapel (subject_id = null)
        $isAgendaKegiatan = $holiday && !$holiday->is_holiday;

        if ($isAgendaKegiatan) {
            if (!empty($validated['subject_id'])) {
                return response()->json([
                    'message' => "Saat agenda kegiatan ({$holiday->name}), absensi dicatat tanpa mata pelajaran."
                ], 422);
            }

            // [BATAS JAM] Non-admin: input absen kegiatan HARI INI hanya dalam rentang jam agenda.
            // Repair mode / tanggal lampau → frontend kirim skip_time_check=true.
            if (!auth()->user()->isAdmin() && !$request->boolean('skip_time_check')) {
                $isToday = \Carbon\Carbon::parse($date)->isToday();
                if ($isToday && $holiday->start_time && $holiday->end_time) {
                    $now = now();
                    $start = \Carbon\Carbon::parse($holiday->start_time);
                    $end = \Carbon\Carbon::parse($holiday->end_time);
                    if ($now->lt($start) || $now->gt($end)) {
                        return response()->json([
                            'message' => "Absensi kegiatan hanya dapat diisi dalam rentang jam "
                                . $start->format('H:i') . " - " . $end->format('H:i') . "."
                        ], 422);
                    }
                }
            }
        } elseif ($holiday && !auth()->user()->isAdmin()) {
            // Libur: tetap blokir non-admin
            return response()->json([
                'message' => "Absensi tidak aktif: Hari ini adalah agenda sekolah ({$holiday->name})."
            ], 422);
        }

        DB::beginTransaction();
        try {
            $user = auth()->user();
            $records = [];
            
            foreach ($validated['attendances'] as $item) {
                // Get old value for auditing
                $existing = Attendance::where([
                    'student_id' => $item['student_id'],
                    'date'       => $validated['date'],
                    'subject_id' => $validated['subject_id'],
                    'class_id'   => $validated['class_id'],
                ])->first();

                $oldStatus = $existing ? $existing->status : null;

                $record = Attendance::updateOrCreate(
                    [
                        'student_id' => $item['student_id'],
                        'date'       => $validated['date'],
                        'subject_id' => $validated['subject_id'],
                        'class_id'   => $validated['class_id'], // [FIX] Ensure attendance is partitioned by class
                    ],
                    [
                        'status'   => $item['status'],
                        'note'     => $item['note'] ?? null,
                        'user_id'  => $user->id,
                    ]
                );

                // Audit logging
                if (!$existing) {
                    \App\Services\AuditService::log($record, 'create', null, $record->toArray());
                } elseif ($oldStatus != $item['status']) {
                    \App\Services\AuditService::log($record, 'update', ['status' => $oldStatus], ['status' => $item['status']]);
                }

                $records[] = $record;
            }

            DB::commit();

            // Send Push Notifications to Parents
            $subjectName = 'Pelajaran';
            if (!empty($validated['subject_id'])) {
                $subject = \App\Models\Subject::find($validated['subject_id']);
                if ($subject) {
                    $subjectName = $subject->name;
                }
            } elseif ($isAgendaKegiatan) {
                $subjectName = $holiday->name ?: 'Kegiatan';
            }

            $statusMap = ['hadir' => 'Hadir', 'sakit' => 'Sakit', 'izin' => 'Izin', 'alpa' => 'Alpa / Tanpa Keterangan'];
            foreach ($validated['attendances'] as $item) {
                $statusLabel = $statusMap[$item['status']] ?? $item['status'];
                $title = "Update Absensi: {$statusLabel}";
                $body = $isAgendaKegiatan
                    ? "Status kehadiran ananda pada kegiatan {$subjectName} telah tercatat sebagai {$statusLabel}."
                    : "Status kehadiran ananda pada mata pelajaran {$subjectName} telah tercatat sebagai {$statusLabel}.";
                \App\Services\PushNotificationService::sendToStudentParent($item['student_id'], $title, $body, '/siswa/kehadiran');
            }
            return response()->json(['message' => 'Attendance recorded successfully', 'data' => $records], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to record attendance'], 500);
        }
    }

    /**
     * Get attendance summary/statistics
     */
    public function summary(Request $request)
    {
        $validated = $request->validate([
            'class_id' => 'required|exists:classes,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date',
        ]);

        $query = Attendance::where('class_id', $validated['class_id'])
            ->whereBetween('date', [$validated['start_date'], $validated['end_date']]);

        $summary = $query->with('student')
            ->select('student_id', 'status', DB::raw('count(*) as count'))
            ->groupBy('student_id', 'status')
            ->get();

        return response()->json($summary);
    }

    /**
     * Get missing attendance schedules for past days
     */
    public function missing(Request $request)
    {
        $daysToLookBack = $request->query('days', 7);
        $user = auth()->user();
        $isAdmin = ($user->role === 'admin' || $user->role === 'adminer');
        
        $dayMapping = [
            'Sunday' => 'Minggu',
            'Monday' => 'Senin',
            'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday' => 'Kamis',
            'Friday' => 'Jumat',
            'Saturday' => 'Sabtu',
        ];

        $missing = [];
        $today = Carbon::today();

        for ($i = 1; $i <= $daysToLookBack; $i++) {
            $date = $today->copy()->subDays($i);
            $dayName = $dayMapping[$date->format('l')];
            
            // Skip weekends if not specified otherwise
            if ($dayName === 'Minggu' || $dayName === 'Sabtu') continue;

            $todayDateFormatted = $date->format('Y-m-d');

            // [FIX] Skip checking if this date was a Holiday or School Agenda
            $isHoliday = \App\Models\Holiday::where(function($query) use ($todayDateFormatted) {
                $query->where('date', $todayDateFormatted)
                      ->orWhere(function($q) use ($todayDateFormatted) {
                          $q->where('start_date', '<=', $todayDateFormatted)
                            ->where('end_date', '>=', $todayDateFormatted);
                      });
            })->exists();

            if ($isHoliday) continue;

            $schedules = \App\Models\Schedule::where('day', $dayName)
                ->where('type', 'teaching')
                ->where(function($q) use ($date) {
                    $todayDate = $date->format('Y-m-d');
                    // [UNIFIED LOGIC] Match if NO dates are set (assume always active for that day)
                    // OR if that date is within the set date range
                    $q->where(function($sub) {
                        $sub->whereNull('start_date')->whereNull('end_date');
                    })
                    ->orWhere(function($sub) use ($todayDate) {
                        $sub->where('start_date', '<=', $todayDate)
                            ->where(function($dateRange) use ($todayDate) {
                                $dateRange->where('end_date', '>=', $todayDate)
                                          ->orWhereNull('end_date');
                            });
                    });
                })
                ->with(['class', 'subject', 'teacher']);

            if (!$isAdmin) {
                $schedules = $schedules->where('teacher_id', $user->id);
            }

            $daySchedules = $schedules->get();
            
            if ($daySchedules->isEmpty()) {
                continue;
            }
            
            foreach ($daySchedules as $sch) {
                // Check if attendance exists for this date, class, and subject
                $exists = Attendance::where([
                    'date' => $date->format('Y-m-d'),
                    'class_id' => $sch->class_id,
                    'subject_id' => $sch->subject_id
                ])->exists();

                if (!$exists) {
                    $missing[] = [
                        'date' => $date->format('Y-m-d'),
                        'day' => $dayName,
                        'class_id' => $sch->class_id,
                        'rombel' => $sch->class->rombel ?? '-',
                        'subject_id' => $sch->subject_id,
                        'subject_name' => $sch->subject->name ?? '-',
                        'teacher_name' => $sch->teacher->name ?? '-',
                        'teacher_id' => $sch->teacher_id,
                        'time' => Carbon::parse($sch->start_time)->format('H:i') . ' - ' . Carbon::parse($sch->end_time)->format('H:i'),
                    ];
                }
            }
        }

        return response()->json(['data' => $missing]);
    }

    public function resetMissing(Request $request)
    {
        $user = $request->user();
        // [FIX] Use isAdmin() to recognize both 'admin' and 'adminer' roles consistently
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'password' => 'required|string'
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Password salah. Reset dibatalkan demi keamanan.'], 403);
        }

        try {
            // Set all active schedules' start_date to today so they don't look backwards
            \App\Models\Schedule::where('type', 'teaching')
                ->where(function($q) {
                    $q->whereNull('start_date')
                      ->orWhere('start_date', '<', \Carbon\Carbon::today()->format('Y-m-d'));
                })
                ->update(['start_date' => \Carbon\Carbon::today()->format('Y-m-d')]);

            return response()->json(['message' => 'Riwayat absensi terlewat berhasil dibersihkan dan siklus disetel ulang ke hari ini.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mereset: ' . $e->getMessage()], 500);
        }
    }
}
