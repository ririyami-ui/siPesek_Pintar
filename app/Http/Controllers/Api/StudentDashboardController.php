<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\ClassAgreement;
use App\Models\Grade;
use App\Models\Holiday;
use App\Models\Infraction;
use App\Models\LibraryLoan;
use App\Models\Schedule;
use App\Models\Student;
use App\Models\StudentTask;
use App\Models\Subject;
use App\Models\TeachingProgram;
use App\Models\User;
use App\Models\UserProfile;
use App\Services\GradeCalculationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class StudentDashboardController extends Controller
{
    /**
     * Get the student record linked to the currently authenticated user.
     */
    private function getStudent(): ?Student
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        // Cache student data for 5 minutes per user session
        return Cache::remember("student_data_{$user->id}", 300, function () use ($user) {
            return Student::with(['class'])->where('auth_user_id', $user->id)->first();
        });
    }

    /**
     * Get the school name from the master admin's profile.
     */
    private function getSchoolName(): string
    {
        return Cache::remember('school_name', 3600, function () {
            $adminUserId = User::whereIn('role', ['admin', 'adminer'])
                ->orderBy('id', 'asc')
                ->value('id');

            if ($adminUserId) {
                $schoolName = UserProfile::where('user_id', $adminUserId)->value('school_name');
                if ($schoolName) return $schoolName;
            }

            return config('app.name', 'Si Pesek Pintar');
        });
    }

    /**
     * Get the planned material from the semester program (Promes) for a specific date and subject.
     */
    private function getPlannedMaterial($student, $subjectId, $date, $profile = null)
    {
        if (!$subjectId || !$student) return null;

        $dt = Carbon::parse($date);
        $day = $dt->day;
        $weekIndex = (int)floor(($day - 1) / 7);
        
        // Month map (Indonesian) for matching Promes months
        $monthMap = [
            'January' => 'Januari', 'February' => 'Februari', 'March' => 'Maret', 
            'April' => 'April', 'May' => 'Mei', 'June' => 'Juni', 
            'July' => 'Juli', 'August' => 'Agustus', 'September' => 'September', 
            'October' => 'Oktober', 'November' => 'November', 'December' => 'Desember'
        ];
        $monthName = $monthMap[$dt->englishMonth] ?? $dt->englishMonth;

        // Use pre-fetched profile or fetch and cache
        if (!$profile) {
            $profile = Cache::remember('admin_profile_context', 3600, function () {
                $adminUserId = User::whereIn('role', ['admin', 'adminer'])->orderBy('id', 'asc')->value('id');
                return UserProfile::where('user_id', $adminUserId)->first();
            });
        }
        
        $semester = $profile->active_semester ?? 'Ganjil';
        $academicYear = $profile->academic_year ?? '2025/2026';

        // Cache TeachingProgram queries for 1 hour to prevent N+1 overhead
        $program = Cache::remember("teaching_program_{$subjectId}_{$student->class->level}_{$semester}_{$academicYear}", 3600, function () use ($subjectId, $student, $semester, $academicYear) {
            return TeachingProgram::where('type', 'subject_program')
                ->where('subject_id', $subjectId)
                ->where('grade_level', $student->class->level ?? '-')
                ->where('semester', $semester)
                ->where('academic_year', $academicYear)
                ->first();
        });

        if (!$program || empty($program->promes) || empty($program->prota)) return null;

        $promes = $program->promes;
        $prota = $program->prota;

        $semesterMonths = ($semester === 'Ganjil')
            ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
            : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
        
        $monthIdx = array_search($monthName, $semesterMonths);
        if ($monthIdx === false) return null;

        $materials = [];
        foreach ($promes as $key => $jp) {
            $parts = explode('_', $key);
            if (count($parts) === 3 && (int)$parts[1] === $monthIdx && (int)$parts[2] === $weekIndex && (int)$jp > 0) {
                $protaId = (int)$parts[0];
                foreach ($prota as $row) {
                    if (isset($row['id']) && (int)$row['id'] === $protaId && !empty($row['materi'])) {
                        $materials[] = $row['materi'];
                    }
                }
            }
        }

        return count($materials) > 0 ? implode(', ', array_unique($materials)) : null;
    }

    /**
     * Get current/today's learning session with real-time status.
     * Shows what subject is being taught now & student's attendance status.
     */
    public function getRealtimeLearning(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $now = Carbon::now();
        $dayName = $this->getDayInIndonesian($now->dayOfWeek);
        $currentTime = $now->format('H:i');
        $today = $now->toDateString();

        // Check for holiday
        $holiday = Holiday::where(function($q) use ($today) {
                $q->whereDate('date', $today)
                  ->orWhere(function($sq) use ($today) {
                      $sq->whereDate('start_date', '<=', $today)
                         ->whereDate('end_date', '>=', $today);
                  });
            })
            ->where('is_holiday', true)
            ->first();

        // [HOTFIX] Full-day holiday override — skip all schedule processing
        if ($holiday && !$holiday->is_emergency) {
            $graduateProfile = $this->loadGraduateProfileFromBskap($student);

            return response()->json([
                'school_name'      => $this->getSchoolName(),
                'student'          => [
                    'id'        => $student->id,
                    'name'      => $student->name,
                    'class'     => $student->class->rombel ?? '-',
                    'absen'     => $student->absen ?? '-',
                    'nis'       => $student->nis ?? '-',
                    'nisn'      => $student->nisn ?? '-',
                    'photo_url' => $student->authUser?->photo_url ?? null,
                    'gender'    => $student->gender ?? 'L',
                    'class_id'  => $student->class_id,
                    'birth_place' => $student->birth_place ?? '-',
                    'birth_date'  => $student->birth_date ? \Carbon\Carbon::parse($student->birth_date)->format('d F Y') : '-',
                ],
                'holiday'          => [
                    'title'       => $holiday->title ?: $holiday->name,
                    'description' => $holiday->description
                ],
                'emergency_holiday' => null,
                'current_session'  => null,
                'upcoming_session' => null,
                'today_schedule'   => [],
                'daily_narrative'  => null,
                'graduate_profile' => $graduateProfile,
                'server_time'      => $now->toIso8601String(),
                'day'              => $dayName,
            ]);
        }

        // [KEGIATAN] Agenda kegiatan (is_holiday=false) — sesi mapel tidak berjalan,
        // absensi pagi kegiatan dicatat tanpa mapel (subject_id null).
        $kegiatan = Holiday::where(function($q) use ($today) {
                $q->whereDate('date', $today)
                  ->orWhere(function($sq) use ($today) {
                      $sq->whereDate('start_date', '<=', $today)
                         ->whereDate('end_date', '>=', $today);
                  });
            })
            ->where('is_holiday', false)
            ->first();

        if ($kegiatan) {
            $kegiatanAtt = Attendance::where('student_id', $student->id)
                ->whereDate('date', $today)
                ->whereNull('subject_id')
                ->first();

            $startTime = $kegiatan->start_time ? substr($kegiatan->start_time, 0, 5) : null;
            $endTime = $kegiatan->end_time ? substr($kegiatan->end_time, 0, 5) : null;

            $kegiatanStatus = 'upcoming';
            if ($startTime && $endTime) {
                $cur = $now->format('H:i');
                if ($cur > $endTime) $kegiatanStatus = 'completed';
                elseif ($cur >= $startTime && $cur <= $endTime) $kegiatanStatus = 'ongoing';
            }

            return response()->json([
                'school_name'      => $this->getSchoolName(),
                'student'          => [
                    'id'        => $student->id,
                    'name'      => $student->name,
                    'class'     => $student->class->rombel ?? '-',
                    'absen'     => $student->absen ?? '-',
                    'nis'       => $student->nis ?? '-',
                    'nisn'      => $student->nisn ?? '-',
                    'photo_url' => $student->authUser?->photo_url ?? null,
                    'gender'    => $student->gender ?? 'L',
                    'class_id'  => $student->class_id,
                    'birth_place' => $student->birth_place ?? '-',
                    'birth_date'  => $student->birth_date ? \Carbon\Carbon::parse($student->birth_date)->format('d F Y') : '-',
                ],
                'holiday'          => null,
                'kegiatan'         => [
                    'title'            => $kegiatan->title ?: $kegiatan->name,
                    'description'      => $kegiatan->description,
                    'start_time'       => $startTime,
                    'end_time'         => $endTime,
                    'attendance_status' => $kegiatanAtt?->status ?? null,
                ],
                'emergency_holiday' => null,
                'current_session'  => null,
                'upcoming_session' => null,
                'today_schedule'   => [[
                    'id'               => $kegiatan->id,
                    'subject_name'     => $kegiatan->name ?: $kegiatan->title,
                    'teacher_name'     => '-',
                    'start_time'       => $startTime,
                    'end_time'         => $endTime,
                    'type'             => 'kegiatan',
                    'status'           => $kegiatanStatus,
                    'is_blocked'       => false,
                    'block_reason'     => null,
                    'attendance_status' => $kegiatanAtt?->status ?? null,
                ]],
                'daily_narrative'  => null,
                'graduate_profile' => $this->loadGraduateProfileFromBskap($student),
                'server_time'      => $now->toIso8601String(),
                'day'              => $dayName,
            ]);
        }

        // Fetch all schedules for the student's class today
        $schedules = Schedule::with(['subject', 'teacher', 'class'])
            ->where('class_id', $student->class_id)
            ->where('type', 'teaching')
            ->where('day', $dayName)
            ->where(function($q) use ($today) {
                $q->where(function($sub) {
                    $sub->whereNull('start_date')->whereNull('end_date');
                })
                ->orWhere(function($sub) use ($today) {
                    $sub->where('start_date', '<=', $today)
                        ->where(function($dateRange) use ($today) {
                            $dateRange->where('end_date', '>=', $today)
                                      ->orWhereNull('end_date');
                        });
                });
            })
            ->orderBy('start_time')
            ->get();

        // Determine current active session
        $currentSession = null;
        $upcomingSession = null;

        foreach ($schedules as $schedule) {
            $startTime = Carbon::createFromFormat('H:i', substr($schedule->start_time, 0, 5));
            $endTime = Carbon::createFromFormat('H:i', substr($schedule->end_time, 0, 5));
            $compareTime = Carbon::createFromFormat('H:i', $currentTime);

            if ($compareTime >= $startTime && $compareTime <= $endTime) {
                $currentSession = $schedule;
                break;
            }

            if ($compareTime < $startTime && !$upcomingSession) {
                $upcomingSession = $schedule;
            }
        }

        // Get today's attendance for the student
        $todayAttendances = Attendance::where('student_id', $student->id)
            ->whereDate('date', $today)
            ->with('subject')
            ->get()
            ->keyBy('subject_id');

        // [FIX] Get teacher assignments to resolve actual teacher names instead of schedule creator (admin)
        $assignments = \App\Models\TeacherAssignment::with('teacher')
            ->where('class_id', $student->class_id)
            ->get()
            ->keyBy('subject_id');

        // Build today's full schedule with attendance status
        $scheduleWithStatus = $schedules->map(function ($schedule) use ($todayAttendances, $assignments, $now, $holiday) {
            $attendance = isset($schedule->subject_id)
                ? $todayAttendances->get($schedule->subject_id)
                : null;

            $startTime = Carbon::createFromFormat('H:i', substr($schedule->start_time, 0, 5));
            $endTime = Carbon::createFromFormat('H:i', substr($schedule->end_time, 0, 5));
            $currentTime = Carbon::createFromFormat('H:i', $now->format('H:i'));

            $status = 'upcoming';
            $isBlocked = false;
            $blockReason = null;

            if ($currentTime > $endTime) {
                $status = 'completed';
            } elseif ($currentTime >= $startTime && $currentTime <= $endTime) {
                $status = 'ongoing';
            }

            // Check if this session is blocked by emergency holiday
            if ($holiday && $holiday->is_emergency && $holiday->start_time && $holiday->end_time) {
                $blockStart = Carbon::createFromFormat('H:i', substr($holiday->start_time, 0, 5));
                $blockEnd = Carbon::createFromFormat('H:i', substr($holiday->end_time, 0, 5));

                // Check if schedule overlaps with emergency window
                // Overlap exists if: start < blockEnd AND end > blockStart
                if ($startTime < $blockEnd && $endTime > $blockStart) {
                    $isBlocked = true;
                    $status = 'blocked';
                    $blockReason = $holiday->title ?: 'Kegiatan Sekolah';
                }
            }

            // [FIX] Resolve actual teacher name
            $teacherName = '-';
            if (($schedule->type ?? 'teaching') === 'teaching' && isset($schedule->subject_id)) {
                $teacherName = $schedule->teacher?->name;
                if (!$teacherName) {
                    $assignment = $assignments->get($schedule->subject_id);
                    $teacherName = $assignment?->teacher?->name ?? '-';
                }
            } else {
                $teacherName = $schedule->teacher?->name ?? '-';
            }

            return [
                'id'             => $schedule->id,
                'subject_name'   => $schedule->subject?->name ?? $schedule->activity_name ?? 'Kegiatan',
                'teacher_name'   => $teacherName,
                'start_time'     => substr($schedule->start_time, 0, 5),
                'end_time'       => substr($schedule->end_time, 0, 5),
                'start_period'   => $schedule->start_period,
                'end_period'     => $schedule->end_period,
                'type'           => $schedule->type ?? 'teaching',
                'status'         => $status,
                'is_blocked'     => $isBlocked,
                'block_reason'   => $blockReason,
                'attendance_status' => $isBlocked ? null : ($attendance?->status ?? null),
                'attendance_note'   => $isBlocked ? null : ($attendance?->note ?? null),
            ];
        });

        // Pre-fetch profile for context (used in getPlannedMaterial)
        $profile = Cache::remember('admin_profile_context', 3600, function () {
            $adminUserId = User::whereIn('role', ['admin', 'adminer'])->orderBy('id', 'asc')->value('id');
            return UserProfile::where('user_id', $adminUserId)->first();
        });

        $todayAttendance = Attendance::where('student_id', $student->id)->whereDate('date', $today)->first();

        // Add student photo URL and gender for avatar
        $studentPhoto = null;
        $possibleExtensions = ['png', 'jpg', 'jpeg'];
        foreach ($possibleExtensions as $ext) {
            $filename = "student_photos/{$student->nisn}.{$ext}";
            if (file_exists(public_path($filename))) {
                $studentPhoto = asset($filename);
                break;
            }
        }

        $currentSessionData = $currentSession ? [
            'subject_id'    => $currentSession->subject_id,
            'subject_name'  => $currentSession->subject?->name ?? $currentSession->activity_name ?? 'Kegiatan',
            'planned_material' => $this->getPlannedMaterial($student, $currentSession->subject_id, $today, $profile),
        ] : null;

        $graduateProfile = $this->loadGraduateProfileFromBskap($student);

        // Narrative only if there are teaching sessions today
        $dailyNarrative = $schedules->isNotEmpty()
            ? $this->generateDailyNarrative($student, $todayAttendance, $currentSessionData)
            : null;

        return response()->json([
            'school_name'     => $this->getSchoolName(),
            'student'         => [
                'id'        => $student->id,
                'name'      => $student->name,
                'class'     => $student->class->rombel ?? '-',
                'absen'     => $student->absen ?? '-',
                'nis'       => $student->nis ?? '-',
                'nisn'      => $student->nisn ?? '-',
                'photo_url' => $student->authUser?->photo_url ?? null,
                'gender'    => $student->gender ?? 'L',
                'class_id'  => $student->class_id,
                'birth_place' => $student->birth_place ?? '-',
                'birth_date'  => $student->birth_date ? \Carbon\Carbon::parse($student->birth_date)->format('d F Y') : '-',
            ],
            'holiday'         => $holiday ? [
                'title' => $holiday->title ?: $holiday->name,
                'description' => $holiday->description
            ] : null,
            'emergency_holiday' => ($holiday && $holiday->is_emergency) ? [
                'title'       => $holiday->title ?: $holiday->name,
                'description' => $holiday->description,
                'start_time'  => $holiday->start_time ? substr($holiday->start_time, 0, 5) : null,
                'end_time'    => $holiday->end_time ? substr($holiday->end_time, 0, 5) : null,
            ] : null,
            'current_session' => $currentSession ? [
                'subject_id'    => $currentSession->subject_id,
                'subject_name'  => $currentSession->subject?->name ?? $currentSession->activity_name ?? 'Kegiatan',
                'teacher_name'  => (
                    (($currentSession->type ?? 'teaching') === 'teaching' && isset($currentSession->subject_id))
                        ? ($currentSession->teacher?->name ?? $assignments->get($currentSession->subject_id)?->teacher?->name ?? '-')
                        : ($currentSession->teacher?->name ?? '-')
                ),
                'start_time'    => substr($currentSession->start_time, 0, 5),
                'end_time'      => substr($currentSession->end_time, 0, 5),
                'status'        => 'ongoing',
                'attendance_status' => $todayAttendances->get($currentSession->subject_id)?->status ?? null,
                'planned_material' => $this->getPlannedMaterial($student, $currentSession->subject_id, $today, $profile),
            ] : null,
            'upcoming_session' => $upcomingSession ? [
                'subject_id'   => $upcomingSession->subject_id,
                'subject_name' => $upcomingSession->subject?->name ?? $upcomingSession->activity_name ?? 'Kegiatan',
                'start_time'   => substr($upcomingSession->start_time, 0, 5),
                'end_time'     => substr($upcomingSession->end_time, 0, 5),
                'planned_material' => $this->getPlannedMaterial($student, $upcomingSession->subject_id, $today, $profile),
            ] : null,
            'today_schedule'  => $scheduleWithStatus->map(function($s) use ($student, $today, $profile) {
                $s['planned_material'] = isset($s['subject_id']) ? $this->getPlannedMaterial($student, $s['subject_id'], $today, $profile) : null;
                return $s;
            }),
            'daily_narrative' => $dailyNarrative,
            'graduate_profile' => $graduateProfile,
            'server_time'     => $now->toIso8601String(),
            'day'             => $dayName,
        ]);
    }

    /**
     * Get weekly schedule for the student.
     */
    public function getWeeklySchedule()
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        // Fetch all schedules for weekly view
        $schedules = Schedule::with(['subject', 'teacher', 'class'])
            ->where('class_id', $student->class_id)
            ->where('type', 'teaching')
            ->where(function ($q) {
                $q->where('is_recurring', true)->orWhereNull('is_recurring');
            })
            ->orderBy('start_time')
            ->get();

        // Get teacher assignments to resolve actual teacher names
        $assignments = \App\Models\TeacherAssignment::with('teacher')
            ->where('class_id', $student->class_id)
            ->get()
            ->keyBy('subject_id');

        $formattedSchedules = $schedules->map(function ($schedule) use ($assignments) {
            // [FIX] Resolve actual teacher name: Prioritize Schedule table over Assignments
            $teacherName = '-';
            if (($schedule->type ?? 'teaching') === 'teaching' && isset($schedule->subject_id)) {
                $teacherName = $schedule->teacher?->name;
                
                if (!$teacherName) {
                    $assignment = $assignments->get($schedule->subject_id);
                    $teacherName = $assignment?->teacher?->name ?? '-';
                }
            } else {
                $teacherName = $schedule->teacher?->name ?? '-';
            }

            return [
                'id'           => $schedule->id,
                'subject_name' => $schedule->subject?->name ?? $schedule->activity_name ?? 'Kegiatan',
                'teacher_name' => $teacherName,
                'start_time'   => substr($schedule->start_time, 0, 5),
                'end_time'     => substr($schedule->end_time, 0, 5),
                'day'          => $schedule->day,
            ];
        });

        return response()->json([
            'student'  => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'schedule' => $formattedSchedules
        ]);
    }

    /**
     * Get attendance recap per subject for the student.
     */
    public function getAttendanceRecap(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $request->validate([
            'date_start' => 'nullable|date',
            'date_end' => 'nullable|date|after_or_equal:date_start',
        ]);

        $query = Attendance::where('student_id', $student->id)->with(['subject']);

        if ($request->has('date_start') && $request->has('date_end')) {
            $query->whereBetween('date', [$request->date_start, $request->date_end]);
        }

        $attendances = $query->orderBy('date', 'desc')->get();

        // [KEGIATAN] Peta tanggal → nama agenda kegiatan (holiday is_holiday=false),
        // utk memberi label absen tanpa mapel (subject_id null) mis. Kokurikuler/P5.
        $attDates = $attendances->pluck('date')
            ->map(fn($d) => $d ? \Carbon\Carbon::parse($d)->toDateString() : null)
            ->filter()
            ->unique()
            ->values();
        
        $agendaByDate = [];
        if ($attDates->isNotEmpty()) {
            $minDate = $attDates->min();
            $maxDate = $attDates->max();
            
            $agendaHolidays = \App\Models\Holiday::where(function($q) use ($minDate, $maxDate, $attDates) {
                $q->whereIn('date', $attDates->toArray())
                  ->orWhere(function($sub) use ($minDate, $maxDate) {
                      $sub->where('start_date', '<=', $maxDate)
                          ->where('end_date', '>=', $minDate);
                  });
            })->get();
            
            foreach ($attDates as $d) {
                $holiday = $agendaHolidays->first(function ($h) use ($d) {
                    if ($h->date) {
                        return \Carbon\Carbon::parse($h->date)->toDateString() === $d;
                    }
                    return $h->start_date && $h->end_date
                        && $d >= \Carbon\Carbon::parse($h->start_date)->toDateString()
                        && $d <= \Carbon\Carbon::parse($h->end_date)->toDateString();
                });
                if ($holiday) {
                    $agendaByDate[$d] = $holiday->name ?: $holiday->title ?: 'Kegiatan';
                }
            }
        }

        // Group by subject
        $bySubject = $attendances->groupBy('subject_id')->map(function ($records, $subjectId) use ($agendaByDate) {
            $subject = $records->first()->subject;
            $counts  = $records->countBy('status');

            $subjectName = $subject?->name ?? 'Tanpa Mapel';
            if (!$subject) {
                $names = $records->map(function ($r) use ($agendaByDate) {
                    $d = $r->date ? \Carbon\Carbon::parse($r->date)->toDateString() : null;
                    return $d && isset($agendaByDate[$d]) ? $agendaByDate[$d] : null;
                })->filter()->unique()->values();
                $subjectName = $names->count() === 1
                    ? 'Kegiatan: ' . $names->first()
                    : ($names->isNotEmpty() ? 'Kegiatan (Kokurikuler)' : 'Kegiatan');
            }

            return [
                'subject_id'   => $subjectId,
                'subject_name' => $subjectName,
                'hadir'        => $counts->get('hadir', 0),
                'sakit'        => $counts->get('sakit', 0),
                'izin'         => $counts->get('izin', 0),
                'alpa'         => $counts->get('alpa', 0),
                'total'        => $records->count(),
                'pct_hadir'    => $records->count() > 0
                    ? round(($counts->get('hadir', 0) / $records->count()) * 100, 1)
                    : 0,
            ];
        })->values();

        // Overall totals — basis harian: satu status per hari (prioritas terburuk menang)
        // alpa > izin > sakit > hadir, konsisten dengan logika daily narrative
        $overallByDay = $attendances->groupBy(function ($a) {
            return $a->date ? \Carbon\Carbon::parse($a->date)->toDateString() : 'no-date';
        })->map(function ($records) {
            $statuses = $records->pluck('status')->map(fn($s) => strtolower($s));
            if ($statuses->contains('alpa')) return 'alpa';
            if ($statuses->contains('izin')) return 'izin';
            if ($statuses->contains('sakit')) return 'sakit';
            if ($statuses->contains('hadir')) return 'hadir';
            return 'alpa';
        });

        $overallCounts = $overallByDay->countBy();
        $overall = [
            'hadir' => $overallCounts->get('hadir', 0),
            'sakit' => $overallCounts->get('sakit', 0),
            'izin'  => $overallCounts->get('izin', 0),
            'alpa'  => $overallCounts->get('alpa', 0),
            'total' => $overallByDay->count(),
        ];

        // Daily detail (last 30 days) — satu record per hari, ambil status terburuk
        $daily = $attendances->groupBy(function ($a) {
            return $a->date ? \Carbon\Carbon::parse($a->date)->toDateString() : null;
        })->map(function ($records) use ($agendaByDate, $student) {
            $dateStr = $records->first()->date ? \Carbon\Carbon::parse($records->first()->date)->toDateString() : null;
            $statuses = $records->pluck('status')->map(fn($s) => strtolower($s));
            $finalStatus = 'alpa';
            if ($statuses->contains('alpa')) $finalStatus = 'alpa';
            elseif ($statuses->contains('izin')) $finalStatus = 'izin';
            elseif ($statuses->contains('sakit')) $finalStatus = 'sakit';
            else $finalStatus = 'hadir';
            $note = $records->first()->note ?? null;
            $subjectName = $records->first()->subject?->name
                ?? ($dateStr && isset($agendaByDate[$dateStr]) ? $agendaByDate[$dateStr] : 'Kegiatan');
            return [
                'date'             => $dateStr,
                'subject_id'       =>null,
                'subject_name'     => $subjectName,
                'status'           => $finalStatus,
                'note'             => $note,
                'planned_material' => $this->getPlannedMaterial($student, null, $dateStr),
            ];
        })->values();

        return response()->json([
            'student'    => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'by_subject' => $bySubject,
            'overall'    => $overall,
            'daily'      => $daily,
        ]);
    }

    /**
     * Get grades per subject for the student.
     */
    public function getGrades(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $query = Grade::where('student_id', $student->id)->with('subject');

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $grades = $query->orderBy('date', 'desc')->get();

        // Gunakan service yang sudah disentralisasi (Unifikasi Single Source of Truth)
        $gradeService = new GradeCalculationService();
        $calculatedData = $gradeService->calculateStudentGrades(
            $student, 
            $grades, 
            $request->semester, 
            $request->academic_year
        );

        return response()->json([
            'student'            => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'by_subject'         => $calculatedData['by_subject'],
            'total_grades'       => $grades->count(),
            'weights'            => $calculatedData['weights'],
            'attendance_summary' => $calculatedData['attendance_summary'],
            'infraction_summary' => $calculatedData['infraction_summary'],
            'radar_data'         => $calculatedData['radar_data'],
            'warnings'           => $calculatedData['warnings'],
            'overall_nilai_akhir'=> $calculatedData['overall_nilai_akhir'],
        ]);
    }

    /**
     * Get student grade trend per month for the dashboard chart.
     */
    public function getGradesTrend(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $query = Grade::where('student_id', $student->id)
            ->where('date', '>=', Carbon::now()->subDays(30)->toDateString())
            ->with('subject');

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $grades = $query->orderBy('date', 'asc')->get();

        // Group by day (Y-m-d) then by subject
        $days = $grades->groupBy(fn($g) => $g->date ? Carbon::parse($g->date)->format('Y-m-d') : null)
            ->filter(fn($group) => $group->first()->date !== null)
            ->keys()
            ->values()
            ->toArray();

        // Per-subject series across days
        $series = $grades->groupBy('subject_id')->map(function ($records) use ($days) {
            $subjectName = $records->first()->subject->name ?? 'Mapel';
            $scoresByDay = $records->groupBy(fn($g) => Carbon::parse($g->date)->format('Y-m-d'))
                ->map(fn($group) => round($group->avg('score'), 2));

            return [
                'subject_name' => $subjectName,
                'scores' => collect($days)->map(fn($d) => $scoresByDay[$d] ?? null)->toArray(),
            ];
        })->values();

        // Overall average per day across all subjects
        $overall = collect($days)->map(function ($d) use ($grades) {
            $dayGrades = $grades->filter(fn($g) => Carbon::parse($g->date)->format('Y-m-d') === $d);
            return $dayGrades->count() > 0 ? round($dayGrades->avg('score'), 2) : null;
        })->toArray();

        return response()->json([
            'student' => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'days'    => $days,
            'series'  => $series,
            'overall' => $overall,
        ]);
    }

    /**
     * Get student's infraction (violation) records.
     */
    public function getInfractions(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $query = Infraction::where('student_id', $student->id);

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $infractions = $query->orderBy('date', 'desc')->get();

        $totalPoints = $infractions->sum('points');
        $penalty     = $totalPoints; // 1:1 deduction ratio (sync with GradeCalculationService)

        // Group by category with metadata
        $byCategory = $infractions->groupBy(function($item) {
            return $item->category ?: 'Umum';
        })->map(function ($records, $cat) {
            return [
                'category'     => $cat,
                'count'        => $records->count(),
                'total_points' => $records->sum('points'),
                'latest_date'  => $records->max('date') ? \Carbon\Carbon::parse($records->max('date'))->toDateString() : null,
            ];
        })->sortByDesc('latest_date')->values();

        $records = $infractions->map(fn($inf) => [
            'id'           => $inf->id,
            'date'         => $inf->date ? \Carbon\Carbon::parse($inf->date)->toDateString() : null,
            'category'     => $inf->category ?? 'Umum',
            'description'  => $inf->description,
            'points'       => $inf->points,
            'semester'     => $inf->semester,
            'academic_year' => $inf->academic_year,
        ])->values();

        return response()->json([
            'student'      => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'records'      => $records,
            'by_category'  => $byCategory,
            'total_points' => $totalPoints,
            'penalty'      => $penalty,  // nilai dikurangi sebesar ini
            'total_count'  => $infractions->count(),
        ]);
    }

    /**
     * Get incomplete/missing tasks (grades with low score or no score flagged).
     * Tasks are derived from Grade records where score is null or below a threshold,
     * or StudentTask records.
     */
    public function getMissingTasks(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        // Fetch ALL Grades for transparency (Single Source of Truth)
        $grades = Grade::where('student_id', $student->id)
            ->with('subject')
            ->orderBy('date', 'desc')
            ->get()
            ->map(function($g) use ($student) {
                $hasScore = $g->score !== null && $g->score > 0;
                return [
                    'id'              => $g->id,
                    'type'            => 'grade',
                    'subject_name'    => $g->subject?->name ?? '-',
                    'topic'           => $g->topic ?? 'Tidak ada keterangan',
                    'assessment_type' => $g->type ?? '-',
                    'date'            => $g->date ? \Carbon\Carbon::parse($g->date)->toDateString() : null,
                    'score'           => (float)$g->score,
                    'notes'           => $g->notes,
                    'status'          => $hasScore ? 'Selesai' : 'Belum Dinilai',
                    'planned_material' => $this->getPlannedMaterial($student, $g->subject_id, $g->date ? \Carbon\Carbon::parse($g->date)->toDateString() : null),
                ];
            });

        // Resolve subjects for mapping task materials
        $subjects = Subject::pluck('id', 'name');

        // StudentTask: class-level tasks (hide completed tasks)
        $studentTasks = StudentTask::where(function($q) use ($student) {
                $q->where('class_id', $student->class_id)
                  ->orWhereNull('class_id');
            })
            ->where('status', '!=', 'completed')
            ->orderBy('deadline', 'asc')
            ->get()
            ->map(function($t) use ($student, $subjects) {
                $subjectId = isset($t->subject_name) ? ($subjects[$t->subject_name] ?? null) : null;
                $dateStr = $t->deadline instanceof \Illuminate\Support\Carbon ? $t->deadline->toDateString() : \Carbon\Carbon::parse($t->deadline)->toDateString();
                $isDone = strtolower($t->status) === 'selesai' || strtolower($t->status) === 'complete' || strtolower($t->status) === 'completed';
                return [
                    'id'              => $t->id,
                    'type'            => 'task',
                    'subject_name'    => $t->subject_name ?? '-',
                    'topic'           => $t->title ?? $t->description ?? 'Tugas',
                    'assessment_type' => 'Tugas',
                    'date'            => $dateStr,
                    'score'           => null,
                    'notes'           => $t->description,
                    'status'          => $isDone ? 'Selesai' : 'Belum Selesai',
                    'planned_material' => $subjectId ? $this->getPlannedMaterial($student, $subjectId, $dateStr) : null,
                ];
            });

        $all = $grades->merge($studentTasks)->sortByDesc('date')->values();

        return response()->json([
            'student'       => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'missing_tasks' => $all,
            'total'         => $all->count(),
        ]);
    }

    /**
     * Map PHP dayOfWeek (0=Sunday) to Indonesian day names.
     */
    private function getDayInIndonesian(int $dayOfWeek): string
    {
        $days = [
            0 => 'Minggu',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ];
        return $days[$dayOfWeek] ?? 'Senin';
    }

    /**
     * Get the display name for a student's class.
     * SchoolClass uses 'rombel' as the class identifier (e.g. '7A', '8B').
     */
    private function getClassName(Student $student): string
    {
        $class = $student->class;
        if (!$class) return '-';
        return $class->rombel ?? $class->code ?? '-';
    }

    /**
     * Generate a descriptive narrative of the student's learning progress today.
     * Uses template variations to provide a 'Smart AI' feel without token costs.
     */
    private function generateDailyNarrative($student, $attendance, $current)
    {
        $name = explode(' ', $student->name)[0];
        $today = Carbon::today();
        
        // [AUDIT] Comprehensive Attendance Check for Today
        $todayAttendances = Attendance::where('student_id', $student->id)
            ->whereDate('date', $today)
            ->get();
            
        $hasAlpa = $todayAttendances->contains(fn($a) => in_array(strtolower($a->status), ['alpa', 'alpha']));
        $hasIzin = $todayAttendances->contains(fn($a) => in_array(strtolower($a->status), ['izin', 'ijin']));
        $hasSakit = $todayAttendances->contains(fn($a) => strtolower($a->status) === 'sakit');
        $allHadir = $todayAttendances->count() > 0 && $todayAttendances->every(fn($a) => strtolower($a->status) === 'hadir');
        
        // Increased variability range (up to 10 unique combinations per día)
        $seed = ($student->id + date('z')) % 10; 

        $openings = [
            0 => "Hari ini, pemantauan belajar **{$name}** sedang berlangsung dengan baik. ",
            1 => "Berikut adalah sekilas progres belajar **{$name}** untuk hari ini. ",
            2 => "Kami senang mengabarkan bahwa agenda belajar **{$name}** berjalan lancar hari ini. ",
            3 => "**{$name}** sedang mengikuti rangkaian kegiatan di sekolah dengan penuh antusias. ",
            4 => "Pantauan belajar **{$name}** menunjukkan aktivitas yang positif di sekolah. ",
            5 => "Semoga hari Ayah/Bunda menyenangkan! Berikut kabar terbaru dari **{$name}** di sekolah. ",
            6 => "Laporan harian **{$name}** hari ini telah tersedia. Mari kita lihat bersama progresnya. ",
            7 => "Kabar gembira! Agenda pendidikan **{$name}** terpantau berlangsung kondusif hari ini. ",
            8 => "Progres belajar **{$name}** hari ini menunjukkan semangat yang sangat baik. ",
            9 => "Halo Ayah/Bunda! Kami ingin berbagi ringkasan aktivitas **{$name}** selama di sekolah hari ini. ",
        ];

        $closings = [
            0 => "Secara keseluruhan, progres hari ini berjalan lancar. Terus berikan dukungan untuk Ananda!",
            1 => "Ananda menunjukkan partisipasi yang baik. Mari kita apresiasi upayanya hari ini.",
            2 => "Semoga pembelajaran hari ini menjadi bekal ilmu yang bermanfaat bagi {$name}.",
            3 => "Kami akan terus memantau dan memberikan yang terbaik untuk pendidikan {$name}.",
            4 => "Terima kasih atas kepercayaan Ayah/Bunda dalam mendampingi tumbuh kembang Ananda.",
            5 => "Mari terus bersinergis demi masa depan terbaik bagi Ananda. Selamat melanjutkan aktivitas!",
            6 => "Pendidikan adalah perjalanan panjang, mari kita nikmati setiap progres kecil **{$name}** hari ini.",
            7 => "Dukungan kecil dari rumah adalah semangat besar bagi **{$name}** di sekolah. Terima kasih!",
            8 => "Sampai jumpa di kabar progres esok hari. Semoga hari Anda menyenangkan!",
            9 => "Setiap hari adalah kesempatan baru bagi **{$name}** untuk tumbuh. Mari kita dampingi bersama.",
        ];

        $narrative = $openings[$seed];

        // Status for report-mode detection
        $isSchoolOver = !$current;

        // Part 1: Attendance Context (Improved with multi-subject awareness)
        if ($hasAlpa) {
            $narrative .= "Namun, kami mencatat Ananda **tidak hadir (Alpa)** pada sesi tertentu hari ini. Mohon perhatian Ayah/Bunda untuk mengonfirmasi hal ini. ";
        } elseif ($hasSakit || $hasIzin) {
            $type = $hasSakit ? 'sedang beristirahat (Sakit)' : 'berhalangan hadir (Izin)';
            $narrative .= "Ananda tercatat **{$type}** pada agenda belajar hari ini. Semoga Ananda sehat selalu. ";
        } elseif ($allHadir) {
            $narrative .= "Ananda telah **hadir tepat waktu** di seluruh jam pelajaran. ";
        } elseif ($todayAttendances->count() === 0) {
            $narrative .= "Sesi absensi untuk hari ini sedang dalam proses pembaruan oleh Bapak/Ibu guru. ";
        }

        // Part 2: Learning Progress (The Core)
        if ($current) {
            $subject = $current['subject_name'] ?? 'Mata Pelajaran';
            $topic = $current['planned_material'] ?? 'materi pilihan';
            $narrative .= "Saat ini, Ananda sedang mendalami topik **\"{$topic}\"** pada sesi **{$subject}**. ";
        } elseif ($isSchoolOver) {
            $statusFinish = $hasAlpa ? "sebagian besar agenda" : "seluruh rangkaian pembelajaran";
            $narrative .= "Agenda belajar hari ini telah **{$statusFinish}** selesai dilaksanakan. ";
        } else {
            $narrative .= "Sesi pembelajaran saat ini dialokasikan untuk kegiatan mandiri atau transisi mata pelajaran. ";
        }

        // Part 3: Achievement Check (Recent Grade Today)
        $todayGrade = Grade::where('student_id', $student->id)
            ->whereDate('date', $today)
            ->whereNotNull('score')
            ->first();
            
        if ($todayGrade) {
            $type = $todayGrade->type ?? 'Evaluasi';
            $scoreStr = $todayGrade->score >= 75 ? "hasil yang sangat memuaskan" : "proses yang perlu terus didukung";
            $narrative .= "Selain itu, {$name} baru saja menuntaskan {$type} dengan {$scoreStr}. ";
        }

        // Part 4: Infractions (Violations)
        $todayInfractions = Infraction::where('student_id', $student->id)
            ->whereDate('date', $today)
            ->get();
            
        if ($todayInfractions->count() > 0) {
            $totalPoints = $todayInfractions->sum('points');
            $categories = $todayInfractions->pluck('category')->unique()->implode(', ');
            $narrative .= "Hari ini tercatat ada **{$totalPoints} poin pelanggaran** terkait *{$categories}*. Harap Ayah/Bunda memberikan bimbingan khusus di rumah agar kejadian serupa tidak terulang. ";
        } elseif ($isSchoolOver && !$hasAlpa) {
            $narrative .= "Kami juga senang menginformasikan bahwa **tidak ada catatan pelanggaran** hari ini. ";
        }

        return $narrative . ($isSchoolOver ? "Semoga istirahat Ananda menyenangkan. " : "") . $closings[$seed];
    }

    /**
     * Load Dimensi Profil Lulusan from BSKAP JSON standard (8 dimensions).
     * Maps real student data as supporting evidence for each dimension.
     */
    private function loadGraduateProfileFromBskap($student)
    {
        $path = resource_path('js/utils/bskap_2025_intel.json');
        if (!file_exists($path)) {
            return [];
        }
        $bskap = json_decode(file_get_contents($path), true);
        $rawDimensions = $bskap['standards']['profile_lulusan_2025'] ?? [];
        if (empty($rawDimensions)) return [];

        // Gather student data for source mapping
        $today = Carbon::today();
        $semesterStart = $today->copy()->subMonths(6);
        $allAtt = Attendance::where('student_id', $student->id)
            ->whereBetween('date', [$semesterStart, $today])->get();
        $totalAtt = $allAtt->count();
        $hadirCount = $allAtt->filter(fn($a) => strtolower($a->status) === 'hadir')->count();
        $sakitCount = $allAtt->filter(fn($a) => strtolower($a->status) === 'sakit')->count();
        $izinCount = $allAtt->filter(fn($a) => in_array(strtolower($a->status), ['izin', 'ijin']))->count();
        $alpaCount = $allAtt->filter(fn($a) => in_array(strtolower($a->status), ['alpa', 'alpha']))->count();
        $attRate = $totalAtt > 0 ? round(($hadirCount / $totalAtt) * 100) : 0;

        $infractions = Infraction::where('student_id', $student->id)
            ->whereBetween('date', [$semesterStart, $today])->get();
        $totalPts = $infractions->sum('points');
        $infByCategory = $infractions->groupBy('category');
        $infCats = $infractions->pluck('category')->unique()->values()->toArray();

        $grades = Grade::where('student_id', $student->id)
            ->whereBetween('date', [$semesterStart, $today])->get();
        $graded = $grades->filter(fn($g) => $g->score !== null);
        $avgScore = $graded->count() > 0 ? round($graded->avg('score')) : 0;

        // Today status
        $todayAtt = Attendance::where('student_id', $student->id)
            ->whereDate('date', $today)->get();
        $allHadirToday = $todayAtt->count() > 0 && $todayAtt->every(fn($a) => strtolower($a->status) === 'hadir');

        // Map source data for each BSKAP dimension
        $dimensionSources = [
            'Keimanan & Ketakwaan' => [
                'sumber' => [
                    'Data pelanggaran terkait akhlak & spiritual (jika ada)',
                ],
                'rincian' => $infByCategory->has('Akhlak') || $infByCategory->has('Spiritual')
                    ? 'Ada catatan pembinaan akhlak'
                    : 'Tidak ada catatan pelanggaran akhlak/spiritual'
            ],
            'Kewargaan' => [
                'sumber' => [
                    'Data kehadiran & partisipasi semester ini',
                    'Catatan pelanggaran tata tertib sekolah',
                ],
                'rincian' => $totalAtt > 0
                    ? "Kehadiran {$attRate}% dari {$totalAtt} sesi" . ($totalPts > 0 ? "; pelanggaran: {$totalPts} poin" : "; tanpa pelanggaran")
                    : 'Belum ada data kehadiran'
            ],
            'Penalaran Kritis' => [
                'sumber' => [
                    'Nilai akademik dari setiap mata pelajaran',
                    'Rata-rata nilai semester',
                ],
                'rincian' => $graded->count() > 0
                    ? "Rata-rata nilai: {$avgScore} dari {$graded->count()} penilaian"
                    : 'Belum ada data nilai'
            ],
            'Kreativitas' => [
                'sumber' => [
                    'Nilai tugas & proyek (jika ada)',
                    'Partisipasi dalam kegiatan ekstrakurikuler',
                ],
                'rincian' => $graded->count() > 0
                    ? "Terdapat {$graded->count()} catatan penilaian"
                    : 'Belum ada data penilaian kreativitas'
            ],
            'Kolaborasi' => [
                'sumber' => [
                    'Data kehadiran (indikator partisipasi sosial)',
                    'Catatan pelanggaran terkait interaksi sosial',
                ],
                'rincian' => $totalAtt > 0
                    ? ($allHadirToday ? 'Hadir semua sesi hari ini' : "Kehadiran semester: {$attRate}%")
                    : 'Belum ada data'
            ],
            'Kemandirian' => [
                'sumber' => [
                    'Pola kehadiran (sakit/izin vs tanpa keterangan)',
                    'Konsistensi nilai akademik',
                ],
                'rincian' => $totalAtt > 0
                    ? ($izinCount + $sakitCount) > 0
                        ? "{$sakitCount}x sakit, {$izinCount}x izin, {$alpaCount}x alpa"
                        : "Hadir {$hadirCount}/{$totalAtt} tanpa alpa"
                    : 'Belum ada data'
            ],
            'Kesehatan' => [
                'sumber' => [
                    'Data ketidakhadiran karena sakit',
                    'Catatan kesehatan dari UKS/klinik (jika terintegrasi)',
                ],
                'rincian' => $sakitCount > 0
                    ? "Tercatat sakit {$sakitCount}x semester ini"
                    : 'Tidak ada catatan ketidakhadiran karena sakit'
            ],
            'Komunikasi' => [
                'sumber' => [
                    'Catatan partisipasi di kelas (dari guru)',
                    'Pelanggaran terkait komunikasi (jika ada)',
                ],
                'rincian' => $infByCategory->has('Komunikasi')
                    ? 'Ada catatan pembinaan komunikasi'
                    : 'Tidak ada catatan pelanggaran komunikasi'
            ],
        ];

        $result = [];
        foreach ($rawDimensions as $dim) {
            $ds = $dimensionSources[$dim['dimensi']] ?? [
                'sumber' => ['Belum ada data terkait dimensi ini'],
                'rincian' => 'Data belum tersedia'
            ];
            $result[] = [
                'nama_dimensi' => $dim['dimensi'],
                'sumber'       => $ds['sumber'],
                'rincian'      => $ds['rincian'],
            ];
        }
        return $result;
    }

    /**
     * Get library loan history for the student.
     */
    public function myLibraryLoans(Request $request)
    {
        $student = $this->getStudent();
        if (!$student) {
            return response()->json(['message' => 'Data siswa tidak ditemukan.'], 404);
        }

        $loans = LibraryLoan::with(['book', 'librarian'])
            ->where('student_id', $student->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'student' => ['name' => $student->name, 'class' => $this->getClassName($student)],
            'loans'   => $loans
        ]);
    }
}
