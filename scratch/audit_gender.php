<?php

use App\Models\Student;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$stats = Student::select('gender', DB::raw('count(*) as total'))
    ->groupBy('gender')
    ->get();

echo "Gender Statistics:\n";
foreach ($stats as $stat) {
    echo "- " . ($stat->gender ?: '[NULL]') . ": " . $stat->total . "\n";
}

$inconsistent = Student::whereNotIn('gender', ['L', 'P'])->get();
if ($inconsistent->count() > 0) {
    echo "\nInconsistent records found: " . $inconsistent->count() . "\n";
    foreach ($inconsistent->take(10) as $s) {
        echo "- ID: {$s->id}, Name: {$s->name}, Gender: {$s->gender}\n";
    }
} else {
    echo "\nNo inconsistent records found (all are L or P).\n";
}
