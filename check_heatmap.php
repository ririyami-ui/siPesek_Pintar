<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$service = new App\Services\AutoScheduleService(1);
$service->prepareTemplate();

$assignments = App\Models\TeacherAssignment::with(['subject', 'teacher'])
    ->whereHas('subject', function($q) { $q->where('weekly_hours', '>', 0); })
    ->get();
$allClasses = App\Models\SchoolClass::all()->keyBy('id');
$initialBlocks = $this_is_a_hack; // I'll just use reflection or a modified script.
