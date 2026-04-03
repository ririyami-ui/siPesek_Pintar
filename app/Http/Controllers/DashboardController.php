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

        // [REAL-TIME] Fetch fresh data directly without caching to ensure 100% precision during transitions
        $allSchedules = Schedule::with(['class', 'subject', 'teacher'])
                ->where('day', $todayDay)
                ->orderBy('start_time')
                ->get();

        // Split schedules based on type
        $schedules = $allSchedules->where('type', 'teaching')->values();
        $nonTeachingSchedules = $allSchedules->where('type', 'non-teaching')->values();
        
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

        $monitoringData = $schedules->map(function ($schedule) use ($todayDate, $currentTime, $assignments, $journalsBySchedule, $journalsByClassSubject, $attendanceData, $studentCounts, $programs, $monthIndex, $currentDay, $teachingPlans) {
            // Priority 1: Search by schedule_id (most accurate)
            $journal = $journalsBySchedule->has($schedule->id) ? $journalsBySchedule->get($schedule->id)->first() : null;
            
            // Fallback: Search by Class-Subject-Date for older/manual entries (schedule_id IS NULL)
            if (!$journal) {
                $key = $schedule->class_id . '-' . $schedule->subject_id;
                $journal = $journalsByClassSubject->has($key) ? $journalsByClassSubject->get($key)->first() : null;
            }

            $startTime = Carbon::parse($schedule->start_time)->format('H:i');
            $endTime = Carbon::parse($schedule->end_time)->format('H:i');
            
            $isActive = $currentTime >= $startTime && $currentTime < $endTime;

            // Status priority: TIME first, then journal existence
            $assignment = isset($assignments[$key]) ? $assignments[$key]->first() : null;
            $teacherName = $assignment ? $assignment->teacher->name : ($schedule->teacher->name ?? '-');

            $currentAttendance = $attendanceData->get($key, collect());
            $hasTakenAttendance = $currentAttendance->count() > 0;

            // Status priority: TIME first, then attendance/journal existence
            $status = 'belum_mulai';
            if ($isActive) {
                // Class is currently ongoing
                // If attendance has been taken, it's 'berlangsung' (Guru sudah masuk)
                // If not, it's 'alfa' (Guru belum masuk/absen)
                $status = $hasTakenAttendance || $journal ? 'berlangsung' : 'alfa';
            } elseif ($currentTime > $endTime) {
                // Class time has passed — now check journal
                if ($journal) {
                    $status = 'selesai'; // Completed with journal
                } else {
                    $status = 'alfa';    // No journal after class ended
                }
            }
            // Handle assignment status (overrides normal flow)
            if ($journal && $journal->is_assignment) {
                $status = 'assignment';
            }

            // [NEW] Get Suggested Topic from PROMES
            $promesTopic = null;
            
            // Tier 1: Exact Rombel Match
            $program = $programs->where('subject_id', $schedule->subject_id)
                ->where('grade_level', $schedule->class->rombel)
                ->first();
                
            if (!$program) {
                // Tier 2: Grade Level Match
                $program = $programs->where('subject_id', $schedule->subject_id)
                    ->where('grade_level', $schedule->class->level ?? null)
                    ->first();
            }

            if ($program && !empty($program->promes) && !empty($program->prota)) {
                $topics = [];
                $prota = is_array($program->prota) ? $program->prota : [];
                $promes = is_array($program->promes) ? $program->promes : [];
                
                // Determine accurate week index based on Pekan Efektif
                $pekanEfektif = is_array($program->pekan_efektif) ? $program->pekan_efektif : [];
                $monthConfig = $pekanEfektif[$monthIndex] ?? null;
                $totalWeeksInMonth = isset($monthConfig['totalWeeks']) ? (int)$monthConfig['totalWeeks'] : 4;
                
                $accWeekIndex = min((int)floor(($currentDay - 1) / 7), max(0, $totalWeeksInMonth - 1));
                
                foreach ($prota as $row) {
                    $rowId = $row['id'] ?? '';
                    $promesKey = $rowId . "_" . $monthIndex . "_" . $accWeekIndex;
                    
                    $val = $promes[$promesKey] ?? null;
                    if ($val !== null && $val !== '' && $val !== 0 && $val !== '0' && $val !== false && $val !== 'false') {
                        $topics[] = $row['materi'] ?? '(Materi Kosong)';
                    }
                }
                $promesTopic = count($topics) > 0 ? implode(', ', $topics) : null;
            }

            // [NEW] Look up planned topic from Teaching Plan (Perencanaan Jadwal Mengajar)
            $teachingPlanKey = $schedule->class_id . '-' . $schedule->subject_id;
            $plannedTopic = null;
            if ($teachingPlans->has($teachingPlanKey)) {
                $plan = $teachingPlans->get($teachingPlanKey)->first();
                $plannedTopic = $plan ? $plan->topic : null;
            }

            return [
                'id' => $schedule->id,
                'rombel' => $schedule->class->rombel ?? '-',
                'subject' => $schedule->subject->name ?? '-',
                'teacher' => $teacherName,
                'time' => $startTime . ' - ' . $endTime,
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
            ];
        })->values();

        // [OPTIMIZATION] Filter and group by rombel to show only one active card per class
        // Priority: berlangsung/assignment > alfa > selesai
        $groupedMonitoringData = $monitoringData->groupBy('rombel')->map(function ($group) {
            // Priority 1: Currently active or assignment
            $active = $group->first(fn($item) => in_array($item['status'], ['berlangsung', 'assignment']));
            if ($active) return $active;

            // Priority 2: Needs attention (Alfa)
            $alfa = $group->where('status', 'alfa')->sortByDesc('time')->first();
            if ($alfa) return $alfa;
            
            // Priority 3: Upcoming schedule (belum_mulai)
            $upcoming = $group->where('status', 'belum_mulai')->sortBy('time')->first();
            if ($upcoming) return $upcoming;

            // Priority 4: Completed (Selesai)
            $completed = $group->where('status', 'selesai')->sortByDesc('time')->first();
            if ($completed) return $completed;

            // Final fallback: Show the last schedule of the day instead of the first
            return $group->sortByDesc('time')->first();
        })->sortKeys(SORT_NATURAL)->values();

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

        return response()->json([
            'date' => $todayDate,
            'day' => $todayDay,
            'current_time' => $currentTime,
            'active_non_teaching' => $activeNonTeaching ? [
                'activity_name' => $activeNonTeaching->activity_name,
                'start_time' => Carbon::parse($activeNonTeaching->start_time)->format('H:i'),
                'end_time' => Carbon::parse($activeNonTeaching->end_time)->format('H:i'),
            ] : null,
            'non_teaching_schedules' => $nonTeachingSchedules->map(function($sch) {
                return [
                    'activity_name' => $sch->activity_name,
                    'start_time' => Carbon::parse($sch->start_time)->format('H:i'),
                    'end_time' => Carbon::parse($sch->end_time)->format('H:i'),
                ];
            }),
            'max_end_time' => $maxEndTime,
            'is_weekend' => $isWeekend,
            'data' => $groupedMonitoringData->values(),
            'stats' => [
                'total' => $monitoringData->count(),
                'berlangsung' => $monitoringData->where('status', 'berlangsung')->count(),
                'selesai' => $monitoringData->where('status', 'selesai')->count(),
                'alfa' => $monitoringData->where('status', 'alfa')->count(),
                'belum_mulai' => $monitoringData->where('status', 'belum_mulai')->count(),
            ]
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
}
