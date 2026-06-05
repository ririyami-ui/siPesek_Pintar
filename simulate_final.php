<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$service = new App\Services\AutoScheduleService(1);
echo "--- SIMULASI FINAL (DEFRAG) ---\n";
$startTime = microtime(true);
$result = $service->generate();
$endTime = microtime(true);

if ($result['success']) {
    echo "BERHASIL! Jadwal disusun dalam " . round($endTime - $startTime, 2) . " detik.\n";
    echo "Total: " . ($result['count'] ?? 'Unknown') . " JP\n";
    
    // Check PJOK specifically via DB
    $pjokSchedules = App\Models\Schedule::with(['subject', 'class'])
        ->whereHas('subject', function($q) { $q->where('name', 'like', '%pjok%'); })
        ->get();
    
    $violations = 0;
    foreach ($pjokSchedules as $s) {
        if ($s->end_period > 6) {
            echo "Violation: PJOK in {$s->class->rombel} ends at jam {$s->end_period}\n";
            $violations++;
        }
    }
    if ($violations == 0) echo "OK: Semua PJOK di Jam 1-6.\n";
} else {
    echo "GAGAL: " . $result['message'] . "\n";
}
