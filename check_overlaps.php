<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\SchoolClass;
use Carbon\Carbon;

$days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
$allOverlaps = [];
$allTeachers = Teacher::with('assignments')->get();

foreach ($days as $day) {
    $schedules = Schedule::where('day', $day)->with(['class', 'subject', 'teacher'])->get();
    $teacherSchedules = [];
    $overlaps = [];

    foreach ($schedules as $s) {
        $potentialTeachers = [];
        if ($s->teacher_id) {
            $potentialTeachers[] = $s->teacher_id;
        } else {
            foreach ($allTeachers as $t) {
                foreach ($t->assignments as $as) {
                    if ($as->class_id == $s->class_id && $as->subject_id == $s->subject_id) {
                        $potentialTeachers[] = $t->auth_user_id;
                    }
                }
            }
        }
        
        foreach ($potentialTeachers as $teacherId) {
            if (!isset($teacherSchedules[$teacherId])) {
                $teacherSchedules[$teacherId] = [];
            }
            
            foreach ($teacherSchedules[$teacherId] as $existing) {
                $start1 = strtotime($s->start_time);
                $end1 = strtotime($s->end_time);
                $start2 = strtotime($existing->start_time);
                $end2 = strtotime($existing->end_time);
                
                if ($start1 < $end2 && $end1 > $start2) {
                    $overlaps[] = [
                        'teacher' => "Teacher AuthID: $teacherId",
                        's1' => [
                            'id' => $s->id,
                            'class' => $s->class->rombel ?? 'N/A',
                            'time' => $s->start_time . ' - ' . $s->end_time,
                            'teacher_id' => $s->teacher_id
                        ],
                        's2' => [
                            'id' => $existing->id,
                            'class' => $existing->class->rombel ?? 'N/A',
                            'time' => $existing->start_time . ' - ' . $existing->end_time,
                            'teacher_id' => $existing->teacher_id
                        ]
                    ];
                }
            }
            
            $teacherSchedules[$teacherId][] = $s;
        }
    }
    
    if (!empty($overlaps)) {
        $allOverlaps[$day] = $overlaps;
    }
}

echo "OVERLAPS DETECTED:\n";
echo json_encode($allOverlaps, JSON_PRETTY_PRINT);
echo "\n";
