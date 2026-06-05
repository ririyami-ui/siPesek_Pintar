<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$pjokTeachers = App\Models\TeacherAssignment::with(['subject', 'teacher', 'schoolClass'])
    ->whereHas('subject', function($q) { $q->where('name', 'like', '%pjok%'); })
    ->get()
    ->groupBy('teacher_id');

foreach ($pjokTeachers as $tId => $assignments) {
    $teacher = $assignments->first()->teacher;
    echo "Guru: {$teacher->name} (Libur: " . json_encode($teacher->unavailable_days) . ")\n";
    $total = 0;
    foreach ($assignments as $as) {
        echo "- {$as->subject->name} | {$as->schoolClass->rombel} | {$as->subject->weekly_hours} JP\n";
        $total += $as->subject->weekly_hours;
    }
    echo "TOTAL PJOK: $total JP\n\n";
}
