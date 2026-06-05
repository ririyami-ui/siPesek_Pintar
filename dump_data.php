<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Assignment;
use App\Models\SchoolClass;
use App\Models\Subject;
use App\Models\Teacher;

$assignments = Assignment::with(['teacher', 'subject'])->get()->toArray();
$classes = SchoolClass::all()->toArray();
$subjects = Subject::all()->toArray();

$teacher = Teacher::first();
$profile = $teacher ? $teacher->profile : null;
$slots = $profile ? $profile->teaching_time_slots : null;

$data = [
    'assignments' => $assignments,
    'classes' => $classes,
    'subjects' => $subjects,
    'profile' => ['teaching_time_slots' => $slots]
];

file_put_contents('simulate_data.json', json_encode($data));
echo "Data dumped to simulate_data.json\n";
