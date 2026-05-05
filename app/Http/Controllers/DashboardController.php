<?php

namespace App\Http\Controllers;

use App\Models\Journal;
use App\Models\Schedule;
use App\Models\Grade;
use App\Models\TeachingProgram;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Attendance;
use App\Models\TeacherAssignment;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    /**
     * Get real-time monitoring data for Admin Dashboard
     */
    public function getMonitoringData(Request $request)
    {
        $dayMapping = [
            'Sunday' => 'Minggu',
            'Monday' => 'Senin',
            'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday' => 'Kamis',
            'Friday' => 'Jumat',
            'Saturday' => 'Sabtu',
        ];

        $now = Carbon::now();
        $todayDay = $dayMapping[$now->format('l')];
        $todayDate = $now->format('Y-m-d');
        $currentTime = $now->format('H:i');

        // [FIX] Fetch schedules that match today's day AND are currently active (within date range if set)
        $allSchedules = Schedule::with(['class', 'subject', 'teacher'])
                ->where('day', $todayDay)
                ->where(function($q) use ($todayDate) {
                    // Match if NO dates are set (assume always active for that day)
                    // OR if today is within the set date range
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
                ->orderBy('start_time')
                ->get();

        // Split schedules based on type
        $schedules = $allSchedules->where('type', 'teaching')->values();
        $nonTeachingSchedules = $allSchedules->where('type', 'non-teaching')->values();

        // [FEATURE] Check School Agenda / Holidays
        $agenda = \App\Models\Holiday::where(function($query) use ($todayDate) {
            $query->where('date', $todayDate)
                  ->orWhere(function($q) use ($todayDate) {
                      $q->where('start_date', '<=', $todayDate)
                        ->where('end_date', '>=', $todayDate);
                  });
        })->first();
        
        // [FIX] Pre-fetch teacher names based on auth_user_id to ensure consistency with Schedule table
        $teacherUserIds = $schedules->pluck('teacher_id')->filter()->unique();
        $teacherUsers = \App\Models\User::whereIn('id', $teacherUserIds)->pluck('name', 'id');

        // Find if there is currently an active non-teaching activity
        $activeNonTeaching = $nonTeachingSchedules->first(function($sch) use ($currentTime) {
            $start = Carbon::parse($sch->start_time)->format('H:i');
            $end = Carbon::parse($sch->end_time)->format('H:i');
            return $currentTime >= $start && $currentTime < $end;
        });

        $classIds = $schedules->pluck('class_id')->unique();
        $subjectIds = $schedules->pluck('subject_id')->unique();

        // [CACHE] Programs data is very static, cache for 12 hours
        $activeSemester = $request->header('X-Active-Semester', 'Ganjil');
        $academicYear = $request->header('X-Academic-Year', '');
        $progCacheKey = "teaching_programs_{$activeSemester}_{$academicYear}";
        
        $programs = Cache::remember($progCacheKey, 43200, function() use ($activeSemester, $academicYear) {
            return TeachingProgram::where('type', 'subject_program')
                ->where('academic_year', $academicYear)
                ->where('semester', $activeSemester)
                ->get();
        });

        // Fetch dynamic data (Journals, Attendance) without cache for real-time accuracy
        $journals = Journal::whereIn('class_id', $classIds)
            ->whereIn('subject_id', $subjectIds)
            ->where('date', $todayDate)
            ->get();
        
        $journalsBySchedule = $journals->whereNotNull('schedule_id')->groupBy('schedule_id');
        $journalsByClassSubject = $journals->whereNull('schedule_id')->groupBy(function($j) {
            return $j->class_id . '-' . $j->subject_id;
        });

        // [OPTIMIZATION] Pre-fetch attendance counts and student lists
        $attendanceData = Attendance::whereIn('class_id', $classIds)
            ->whereIn('subject_id', $subjectIds)
            ->where('date', $todayDate)
            ->with('student:id,name')
            ->get()
            ->groupBy(function($item) {
                return $item->class_id . '-' . $item->subject_id;
            });

        // [OPTIMIZATION] Pre-fetch student counts per class
        $studentCounts = Student::whereIn('class_id', $classIds)
            ->select('class_id', DB::raw('count(*) as total'))
            ->groupBy('class_id')
            ->pluck('total', 'class_id');

        // [OPTIMIZATION] Pre-fetch teacher assignments
        $assignments = TeacherAssignment::whereIn('class_id', $classIds)
            ->whereIn('subject_id', $subjectIds)
            ->with('teacher')
            ->get()
            ->groupBy(function($item) {
                return $item->class_id . '-' . $item->subject_id;
            });

        // [ACCURACY] Improved semester-month logic mapping for school calendar
        // Ganjil: July (7) to Dec (12), Genap: Jan (1) to June (6)
        $activeSemester = $request->header('X-Active-Semester', 'Ganjil');
        $currentMonth = (int)$now->format('n');
        
        // Define base month for the semester (July for Ganjil, January for Genap)
        $startMonth = $activeSemester === 'Ganjil' ? 7 : 1;
        
        // Calculate relative month index (0-5) within the semester
        // This handles wrap-around logic for the academic year
        $monthIndex = $currentMonth >= $startMonth 
            ? $currentMonth - $startMonth 
            : ($currentMonth + 12 - $startMonth);

        // Limit index to 0-5 (standard 6-month semester)
        $monthIndex = max(0, min(5, $monthIndex));

        // [NEW] Pre-fetch weekly teaching plans (Perencanaan Jadwal Mengajar)
        // type='journal' records store per-class, per-week topic plans
        $currentDay = (int)$now->format('j');
        $currentWeekNum = (int)ceil($currentDay / 7); // 1-4
        $currentMonthName = $now->format('F'); // e.g. "March"

        $teachingPlans = TeachingProgram::whereIn('class_id', $classIds)
            ->whereIn('subject_id', $subjectIds)
            ->where(function($q) use ($currentWeekNum, $currentMonthName) {
                // Match current week & month, or just topic-filled records this month
                $q->where('week', $currentWeekNum)
                  ->where('month', $currentMonthName);
            })
            ->whereNotNull('topic')
            ->get()
            ->groupBy(function($p) {
                return $p->class_id . '-' . $p->subject_id;
            });

        $monitoringData = $schedules->map(function ($schedule) use ($now, $todayDate, $currentTime, $assignments, $journalsBySchedule, $journalsByClassSubject, $attendanceData, $studentCounts, $programs, $monthIndex, $currentDay, $teachingPlans, $activeNonTeaching, $teacherUsers, $agenda) {
            // Priority 1: Search by schedule_id (most accurate)
            $journal = $journalsBySchedule->has($schedule->id) ? $journalsBySchedule->get($schedule->id)->first() : null;
            
            $startTime = Carbon::parse($schedule->start_time)->format('H:i');
            $endTime = Carbon::parse($schedule->end_time)->format('H:i');
            
            $isActiveTime = $currentTime >= $startTime && $currentTime < $endTime;
            $isActive = $isActiveTime;

            // If a non-teaching activity (break/ceremony) is currently active,
            // teaching sessions are technically paused. We still mark them as isActiveTime
            // for the purposes of selection, but we can flag them if needed.
            if ($activeNonTeaching) {
                // Keep isActive true if it IS the scheduled time, so it stays as the "active" card
                // but its priority might be handled in the status below.
            }

            $key = $schedule->class_id . '-' . $schedule->subject_id;
            
            // [FIX] Status priority: TIME first, then journal existence
            // Always prioritize teacher from Schedule table to match Master Data Jadwal
            $teacherName = $teacherUsers[$schedule->teacher_id] ?? $schedule->teacher->name ?? '-';

            $currentAttendance = $attendanceData->get($key, collect());
            $hasTakenAttendance = $currentAttendance->count() > 0;

            // Status priority: TIME first, then attendance/journal existence
            $status = 'belum_mulai';
            if ($isActive) {
                // [GRACE PERIOD] Only mark as 'terlambat' (needs attention) after 5 minutes of class start
                $startTimeMoment = Carbon::parse($schedule->start_time);
                $minutesSinceStart = $now->diffInMinutes($startTimeMoment, false); // Negative if in the past
                $isWithinGracePeriod = abs($minutesSinceStart) <= 15;

                if ($hasTakenAttendance || $journal) {
                    $status = 'berlangsung';
                } elseif ($isWithinGracePeriod) {
                    // Still in grace period, show as 'menunggu' (not purple yet)
                    $status = 'menunggu_absen';
                } else {
                    $status = 'terlambat';
                }
            } elseif ($currentTime > $endTime) {
                if ($hasTakenAttendance || $journal) {
                    $status = 'selesai';
                } else {
                    $status = 'alfa';
                }
            }
            
            $isAssignment = ($journal && $journal->is_assignment);
            if ($isAssignment) {
                $status = 'assignment';
            }

            $hasActivity = $hasTakenAttendance || $journal;
            
            // [FIX] Needs attention ONLY if:
            // 1. Status is 'alfa' or 'terlambat' (past class without journal OR active class after grace period)
            // 2. Status is 'menunggu_absen' or 'berlangsung' but NO attendance has been taken yet
            // BUT: We exclude 'belum_mulai' and 'selesai'
            $needsAttention = ($status === 'alfa' || $status === 'terlambat' || $status === 'menunggu_absen' || ($status === 'berlangsung' && !$hasTakenAttendance)) && !$isAssignment && $status !== 'belum_mulai';

            // [OVERRIDE] If there is a School Agenda / Holiday, suspend normal activity logic
            if ($agenda) {
                $status = $agenda->is_holiday ? 'libur' : 'agenda';
                $needsAttention = false; // Never flag as 'alfa'/'belum absen' on holidays
                $hasTakenAttendance = false; // Keep UI state un-colored
            }

            // [NEW] Get Suggested Topic from PROMES
            $promesTopic = null;
            $program = $programs->where('subject_id', (int)$schedule->subject_id)
                ->where('grade_level', $schedule->class->rombel)
                ->first() ?: $programs->where('subject_id', (int)$schedule->subject_id)
                    ->where('grade_level', $schedule->class->level ?? null)
                    ->first();

            if ($program && !empty($program->promes) && !empty($program->prota)) {
                $topics = [];
                $prota = is_array($program->prota) ? $program->prota : [];
                $promes = is_array($program->promes) ? $program->promes : [];
                $pekanEfektif = is_array($program->pekan_efektif) ? $program->pekan_efektif : [];
                $monthConfig = $pekanEfektif[$monthIndex] ?? null;
                $totalWeeksInMonth = isset($monthConfig['totalWeeks']) ? (int)$monthConfig['totalWeeks'] : 4;
                $accWeekIndex = min((int)floor(($currentDay - 1) / 7), max(0, $totalWeeksInMonth - 1));
                
                foreach ($prota as $row) {
                    $rowId = $row['id'] ?? '';
                    $promesKey = $rowId . "_" . $monthIndex . "_" . $accWeekIndex;
                    if (isset($promes[$promesKey]) && $promes[$promesKey]) {
                        $topics[] = $row['materi'] ?? '(Materi Kosong)';
                    }
                }
                $promesTopic = count($topics) > 0 ? implode(', ', $topics) : null;
            }

            $plannedTopic = $teachingPlans->has($key) ? $teachingPlans->get($key)->first()?->topic : null;

            return [
                'id' => $schedule->id,
                'class_id' => $schedule->class_id,
                'rombel' => $schedule->class->rombel ?? '-',
                'subject' => $schedule->subject->name ?? '-',
                'teacher' => $teacherName,
                'time' => $startTime . ' - ' . $endTime,
                'start_period' => $schedule->start_period,
                'status' => $status,
                'promes_topic' => $promesTopic,
                'planned_topic' => $plannedTopic,
                'topic' => $journal ? $journal->topic : null,
                'is_assignment' => $journal ? (bool)$journal->is_assignment : false,
                'journal_id' => $journal ? $journal->id : null,
                'attendance_summary' => [
                    'hadir' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'hadir')->count(),
                    'sakit' => [
                        'count' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'sakit')->count(),
                        'students' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'sakit')->pluck('student.name')
                    ],
                    'izin' => [
                        'count' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'izin' || strtolower($a->status) === 'ijin')->count(),
                        'students' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'izin' || strtolower($a->status) === 'ijin')->pluck('student.name')
                    ],
                    'alpa' => [
                        'count' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'alpa' || strtolower($a->status) === 'alpha')->count(),
                        'students' => $currentAttendance->filter(fn($a) => strtolower($a->status) === 'alpa' || strtolower($a->status) === 'alpha')->pluck('student.name')
                    ],
                ],
                'total_students' => $studentCounts->get($schedule->class_id, 0),
                'needs_attention' => $needsAttention,
                'has_activity' => $hasActivity,
            ];
        })->values();

        // [FIX] Group by class_id to ensure data isolation (previously grouped by rombel which might collide)
        $groupedMonitoringData = $monitoringData->groupBy('class_id')->map(function ($group) {
            // Priority 1: Currently active (berlangsung), waiting for attendance, OR assignment
            // 'menunggu_absen' is also a currently-running class — teacher is expected to be there
            $active = $group->first(fn($item) => in_array($item['status'], ['berlangsung', 'menunggu_absen', 'terlambat', 'assignment']));
            if ($active) return $active;

            // Priority 2: Upcoming schedule (belum_mulai) — next scheduled class
            $upcoming = $group->where('status', 'belum_mulai')->sortBy('time')->first();
            if ($upcoming) return $upcoming;

            // Priority 3: Needs attention (Alfa) - class time has passed with no journal/absent
            $alfa = $group->where('status', 'alfa')->sortByDesc('time')->first();
            if ($alfa) return $alfa;

            // Priority 4: Completed (Selesai)
            $completed = $group->where('status', 'selesai')->sortByDesc('time')->first();
            if ($completed) return $completed;

            return $group->sortByDesc('time')->first();
        })->values()->sortBy(function($item) {
            return $item['rombel'];
        }, SORT_NATURAL)->values();

        // Determine if today is the end of the school week (assuming 5 or 6 day week)
        // Usually, 5 days = Friday(5), 6 days = Saturday(6)
        // If not set in env, defaults to 5 it seems standard
        $schoolDaysCount = env('SCHOOL_DAYS_COUNT', 5);
        $w = (int)date('w'); // 0 (Sun) to 6 (Sat)
        $isWeekend = ($schoolDaysCount == 5 && $w == 5) || ($schoolDaysCount == 6 && $w == 6);

        // Find the absolute maximum end time for any schedule (teaching or non-teaching) today
        $maxEndTimeRaw = $schedules->max('end_time');
        $maxNonTeachingEndTimeRaw = $nonTeachingSchedules->max('end_time');
        
        $finalMaxEndTimeRaw = $maxEndTimeRaw;
        if ($maxNonTeachingEndTimeRaw && (!$finalMaxEndTimeRaw || $maxNonTeachingEndTimeRaw > $finalMaxEndTimeRaw)) {
            $finalMaxEndTimeRaw = $maxNonTeachingEndTimeRaw;
        }

        $maxEndTime = $finalMaxEndTimeRaw ? Carbon::parse($finalMaxEndTimeRaw)->format('H:i') : null;

        // Find the absolute minimum start time
        $minStartTimeRaw = $schedules->min('start_time');
        $minNonTeachingStartTimeRaw = $nonTeachingSchedules->min('start_time');
        $finalMinStartTimeRaw = $minStartTimeRaw;
        if ($minNonTeachingStartTimeRaw && (!$finalMinStartTimeRaw || $minNonTeachingStartTimeRaw < $finalMinStartTimeRaw)) {
            $finalMinStartTimeRaw = $minNonTeachingStartTimeRaw;
        }
        $minStartTime = $finalMinStartTimeRaw ? Carbon::parse($finalMinStartTimeRaw)->format('H:i') : null;

        // [AGGREGATION] School-wide student statistics
        $studentStats = [
            'total' => Student::count(),
            'male' => Student::where('gender', 'L')->count(),
            'female' => Student::where('gender', 'P')->count(),
        ];

        // [AGGREGATION] Today's school-wide attendance summary
        $schoolAttendance = Attendance::where('date', $todayDate)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $attendanceSummary = [
            'hadir' => $schoolAttendance->get('H', 0),
            'sakit' => $schoolAttendance->get('S', 0),
            'izin' => $schoolAttendance->get('I', 0),
            'alfa' => $schoolAttendance->get('A', 0),
            'terlambat' => $schoolAttendance->get('T', 0),
        ];

        $stats = [
            'total_cards' => $monitoringData->count(),
            'berlangsung' => $monitoringData->where('status', 'berlangsung')->count(),
            'selesai' => $monitoringData->where('status', 'selesai')->count(),
            'alfa' => $monitoringData->whereIn('status', ['alfa', 'terlambat'])->count(),
            'belum_mulai' => $monitoringData->where('status', 'belum_mulai')->count(),
            'needs_attention' => $monitoringData->where('needs_attention', true)->count(),
            'student_stats' => $studentStats,
            'attendance_summary' => $attendanceSummary,
        ];

        return response()->json([
            'date' => $todayDate,
            'day' => $todayDay,
            'current_time' => $currentTime,
            'min_start_time' => $minStartTime,
            'max_end_time' => $maxEndTime,
            'active_non_teaching' => $activeNonTeaching ? [
                'activity_name' => $activeNonTeaching->activity_name,
                'start_time' => $activeNonTeaching->start_time ? Carbon::parse($activeNonTeaching->start_time)->format('H:i') : null,
                'end_time' => $activeNonTeaching->end_time ? Carbon::parse($activeNonTeaching->end_time)->format('H:i') : null,
            ] : null,
            'non_teaching_schedules' => $nonTeachingSchedules->map(function($sch) {
                return [
                    'activity_name' => $sch->activity_name,
                    'start_time' => $sch->start_time ? Carbon::parse($sch->start_time)->format('H:i') : null,
                    'end_time' => $sch->end_time ? Carbon::parse($sch->end_time)->format('H:i') : null,
                ];
            }),
            'is_weekend' => $isWeekend,
            'school_agenda' => $agenda ? [
                'title' => $agenda->title,
                'is_holiday' => $agenda->is_holiday,
                'description' => $agenda->description
            ] : null,
            'stats' => $stats,
            'data' => $groupedMonitoringData,
            'full_data' => $monitoringData,
        ]);
    }

    public function getGradeMonitoringData(Request $request)
    {
        $semester = $request->query('semester', 'Ganjil');
        $academicYear = $request->query('academic_year', date('Y') . '/' . (date('Y') + 1));

        $classes = SchoolClass::orderBy('rombel')->get();
        $classIds = $classes->pluck('id');

        // [COMPREHENSIVE] Pre-fetch all teacher assignments for all classes
        $allAssignments = TeacherAssignment::whereIn('class_id', $classIds)
            ->with(['subject', 'teacher'])
            ->get()
            ->groupBy('class_id');

        // [OPTIMIZATION] Pre-fetch student counts per class
        $studentCounts = Student::whereIn('class_id', $classIds)
            ->select('class_id', DB::raw('count(*) as total'))
            ->groupBy('class_id')
            ->pluck('total', 'class_id');

        // [OPTIMIZATION] Pre-fetch all grades for the given period
        $allGrades = Grade::whereIn('class_id', $classIds)
            ->where('semester', $semester)
            ->where('academic_year', $academicYear)
            ->get()
            ->groupBy(function($grade) {
                return $grade->class_id . '-' . $grade->subject_id;
            });

        $monitoringData = $classes->map(function ($class) use ($semester, $academicYear, $allAssignments, $studentCounts, $allGrades) {
            $classAssignments = $allAssignments->get($class->id, collect());
            
            $subjects = $classAssignments->groupBy('subject_id')->map(function ($group) use ($class, $semester, $academicYear, $studentCounts, $allGrades) {
                $subject = $group->first()->subject;
                $teacher = $group->first()->teacher;
                
                $totalStudents = $studentCounts->get($class->id, 0);
                
                // Get grades for this class and subject from the pre-fetched collection
                $key = $class->id . '-' . $subject->id;
                $subjectGrades = $allGrades->get($key, collect());
                
                $studentsWithGradesCount = $subjectGrades->pluck('student_id')->unique()->count();
                $isCompleted = $totalStudents > 0 && $studentsWithGradesCount >= $totalStudents;
                $avgScore = $subjectGrades->avg('score') ?: 0;

                return [
                    'subject_id' => $subject->id,
                    'subject_name' => $subject->name,
                    'teacher_name' => $teacher->name ?? 'Belum Ditentukan',
                    'is_completed' => $isCompleted,
                    'completion_count' => $studentsWithGradesCount,
                    'total_students' => $totalStudents,
                    'average_score' => round($avgScore, 2)
                ];
            })->values();

            $totalSubjects = $subjects->count();
            $completedSubjects = $subjects->where('is_completed', true)->count();
            $classAvg = $subjects->avg('average_score') ?: 0;

            return [
                'id' => $class->id,
                'rombel' => $class->rombel,
                'total_subjects' => $totalSubjects,
                'completed_subjects' => $completedSubjects,
                'average_score' => round($classAvg, 2),
                'completion_percentage' => $totalSubjects > 0 ? round(($completedSubjects / $totalSubjects) * 100, 1) : 0,
                'subjects' => $subjects
            ];
        });

        return response()->json([
            'data' => $monitoringData,
            'stats' => [
                'total_classes' => $classes->count(),
                'avg_school_score' => round($monitoringData->avg('average_score'), 2),
                'avg_completion' => round($monitoringData->avg('completion_percentage'), 1)
            ]
        ]);
    }

    public function getCurriculumCompliance(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        if (!$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat mengakses laporan capaian kurikulum.');
        }

        $now = Carbon::now();
        $startOfWeek = $now->copy()->startOfWeek()->format('Y-m-d');
        $endOfWeek = $now->copy()->endOfWeek()->format('Y-m-d');

        $classes = SchoolClass::orderBy('rombel')->get();
        $classIds = $classes->pluck('id');

        // 1. Get targets from assignments & subjects
        $assignments = TeacherAssignment::whereIn('class_id', $classIds)
            ->with(['subject', 'teacher'])
            ->get();

        // 2. Get realizations from journals this week
        $journalsThisWeek = Journal::whereIn('class_id', $classIds)
            ->whereBetween('date', [$startOfWeek, $endOfWeek])
            ->with('schedule')
            ->get()
            ->groupBy(function($j) {
                return $j->class_id . '-' . $j->subject_id;
            });

        $complianceData = $classes->map(function ($class) use ($assignments, $journalsThisWeek) {
            $classAssignments = $assignments->where('class_id', $class->id);
            
            $subjects = $classAssignments->map(function ($as) use ($class, $journalsThisWeek) {
                $target = $as->subject->weekly_hours ?? 0;
                $key = $class->id . '-' . $as->subject_id;
                
                $realization = 0;
                if ($journalsThisWeek->has($key)) {
                    foreach ($journalsThisWeek->get($key) as $journal) {
                        if ($journal->schedule) {
                            $realization += ($journal->schedule->end_period - $journal->schedule->start_period + 1);
                        } else {
                            // If manually entered journal without schedule, we assume 2 JP or a default
                            $realization += 2; 
                        }
                    }
                }

                $diff = $realization - $target;
                $status = 'exact';
                if ($realization === 0) $status = 'not_started';
                elseif ($realization < $target) $status = 'under_target';
                elseif ($realization > $target) $status = 'over_target';

                return [
                    'subject_name' => $as->subject->name ?? '?',
                    'teacher_name' => $as->teacher->name ?? '?',
                    'target' => (int)$target,
                    'realization' => (int)$realization,
                    'diff' => $diff,
                    'status' => $status,
                ];
            })->values();

            $totalTarget = $subjects->sum('target');
            $totalRealization = $subjects->sum('realization');

            return [
                'class_id' => $class->id,
                'rombel' => $class->rombel,
                'total_target' => $totalTarget,
                'total_realization' => $totalRealization,
                'compliance_rate' => $totalTarget > 0 ? round(($totalRealization / $totalTarget) * 100, 1) : 0,
                'subjects' => $subjects
            ];
        });

        return response()->json([
            'period' => "{$startOfWeek} s/d {$endOfWeek}",
            'data' => $complianceData,
            'stats' => [
                'avg_compliance' => round($complianceData->avg('compliance_rate'), 1),
                'total_jp_target' => $complianceData->sum('total_target'),
                'total_jp_realization' => $complianceData->sum('total_realization'),
            ]
        ]);
    }
}
