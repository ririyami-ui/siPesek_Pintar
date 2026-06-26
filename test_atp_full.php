<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$service = app(\App\Services\AiGeneratorService::class);
$result = $service->generateATP([
    'subject' => 'Informatika',
    'gradeLevel' => '8',
    'semester' => 'Ganjil',
    'totalJP' => 72,
    'jpPerWeek' => 4
]);

echo json_encode($result, JSON_PRETTY_PRINT);
