<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$assignments = App\Models\TeacherAssignment::with('subject')->get()->groupBy('class_id');
$classes = App\Models\SchoolClass::all();

foreach ($classes as $c) {
    $classAssignments = $assignments[$c->id] ?? collect();
    $totalHours = 0;
    $blocks = [];
    foreach ($classAssignments as $as) {
        $h = $as->subject->weekly_hours;
        $totalHours += $h;
        if ($h == 6) { $blocks[] = 3; $blocks[] = 3; }
        elseif ($h == 5) { $blocks[] = 3; $blocks[] = 2; }
        elseif ($h == 4) { $blocks[] = 2; $blocks[] = 2; }
        elseif ($h > 0) { $blocks[] = $h; }
    }
    sort($blocks);
    echo "Kelas {$c->rombel}: Total $totalHours JP | Blocks: [" . implode(', ', $blocks) . "]\n";
}
