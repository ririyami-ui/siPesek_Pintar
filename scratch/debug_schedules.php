<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Schedule;
use Carbon\Carbon;

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

echo "Today: $todayDay, $todayDate\n";

$count = Schedule::where('day', $todayDay)
        ->where(function($q) use ($todayDate) {
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
        ->count();

echo "Count matching schedules: $count\n";

$allSeninCount = Schedule::where('day', 'Senin')->count();
echo "Total Senin schedules: $allSeninCount\n";

$mismatch = Schedule::where('day', 'Senin')
    ->where(function($q) use ($todayDate) {
        $q->where('start_date', '>', $todayDate)
          ->orWhere('end_date', '<', $todayDate);
    })
    ->get(['id', 'start_date', 'end_date']);

echo "Mismatched schedules: " . $mismatch->count() . "\n";
foreach($mismatch as $m) {
    echo "ID: {$m->id}, Start: {$m->start_date}, End: {$m->end_date}\n";
}
