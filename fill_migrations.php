<?php
require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$files = scandir(__DIR__.'/database/migrations');
sort($files);
$inserted = 0;
foreach ($files as $f) {
    if (!str_ends_with($f, '.php')) continue;
    $name = pathinfo($f, PATHINFO_FILENAME);
    // avoid duplicate entries
    $exists = DB::table('migrations')->where('migration', $name)->exists();
    if (!$exists) {
        DB::table('migrations')->insert([
            'migration' => $name,
            'batch' => 1,
        ]);
        $inserted++;
    }
}

echo "Inserted $inserted migration records.\n";
?>
