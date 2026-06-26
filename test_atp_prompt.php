<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = $app->make(App\Services\AiGeneratorService::class);

// Load the book data manually to see what the service would use
$refGetBook = new ReflectionMethod($service, 'getRelevantBookContent');
$refGetBook->setAccessible(true);
$bookData = $refGetBook->invokeArgs($service, ['SMP', '8', 'Informatika', '', 'Ganjil']);
echo "=== BOOK DATA ALL_CHAPTERS ===\n";
echo "=== BOOK DATA ALL_CHAPTERS ===\n";
if ($bookData && isset($bookData['all_chapters'])) {
    foreach ($bookData['all_chapters'] as $ch) {
        echo "Chapter: " . $ch['title'] . "\n";
        if (isset($ch['sub_topics'])) {
            foreach ($ch['sub_topics'] as $st) {
                echo "  - " . $st['name'] . "\n";
            }
        }
    }
} else {
    echo "NO BOOK DATA FOUND\n";
    print_r($bookData);
}

// Now let's also call buildATPPrompt via reflection to see what prompt it generates
$ref = new ReflectionMethod($service, 'buildATPPrompt');
$ref->setAccessible(true);
$prompt = $ref->invokeArgs($service, [
    ['subject' => 'Informatika', 'gradeLevel' => '8', 'semester' => 'Ganjil', 'totalJP' => 72, 'jpPerWeek' => 4],
    $bookData ?: []
]);
echo "\n=== PROMPT ELEMEN & MATERI SECTION ===\n";
// Extract the elemen and materi section
preg_match('/\*\*ELEMEN & LINGKUP MATERI RESMI.*?\*\*\n- Elemen: (.*?)\n- Materi Inti: (.*?)\n/s', $prompt, $m);
if ($m) {
    echo "Elemen: " . $m[1] . "\n";
    echo "Materi: " . $m[2] . "\n";
} else {
    echo "Could not extract section. Full prompt:\n";
    echo $prompt;
}
