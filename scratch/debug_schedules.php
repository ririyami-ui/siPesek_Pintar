<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Schedule;
use Carbon\Carbon;

$now = Carbon::now();
echo "Server Time: " . $now->toDateTimeString() . "\n";
echo "Server Time (H:i): " . $now->format('H:i') . "\n";
echo "Timezone: " . config('app.timezone') . "\n";

$dayMapping = [
    'Sunday' => 'Minggu',
    'Monday' => 'Senin',
    'Tuesday' => 'Selasa',
    'Wednesday' => 'Rabu',
    'Thursday' => 'Kamis',
    'Friday' => 'Jumat',
    'Saturday' => 'Sabtu',
];

$todayDay = $dayMapping[$now->format('l')];
echo "Today: " . $todayDay . "\n";

$schedules = Schedule::where('day', $todayDay)
    ->where('type', 'teaching')
    ->orderBy('start_time')
    ->get();

echo "\nSchedules for Today:\n";
foreach ($schedules as $s) {
    $start = Carbon::parse($s->start_time)->format('H:i');
    $end = Carbon::parse($s->end_time)->format('H:i');
    $isActive = ($now->format('H:i') >= $start && $now->format('H:i') < $end);
    echo "ID: {$s->id} | {$s->start_time} - {$s->end_time} | Status: " . ($isActive ? 'ACTIVE' : 'INACTIVE') . " | Rombel: " . ($s->class->rombel ?? '?') . "\n";
}
