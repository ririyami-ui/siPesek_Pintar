<?php

use App\Models\Student;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "Starting gender data migration...\n";

$students = Student::all();
$updatedCount = 0;

foreach ($students as $student) {
    $original = $student->gender;
    $clean = trim(strtoupper($original));
    $new = $original;

    if (in_array($clean, ['LAKI-LAKI', 'LAKI', 'PRIA', 'LAKI - LAKI', 'L'])) {
        $new = 'L';
    } elseif (in_array($clean, ['PEREMPUAN', 'WANITA', 'P'])) {
        $new = 'P';
    }

    if ($new !== $original) {
        $student->gender = $new;
        $student->save();
        $updatedCount++;
        echo "- Updated ID {$student->id}: '{$original}' -> '{$new}'\n";
    }
}

echo "\nMigration complete. Total updated: {$updatedCount}\n";
