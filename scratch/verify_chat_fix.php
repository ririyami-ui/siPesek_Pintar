<?php

// Mocking the environment for testing
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\GeminiService;

$gemini = new GeminiService();

$message = "Halo, bagaimana perkembangan anak saya?";
$systemPrompt = "Anda adalah **Si Pintar**, asisten AI untuk Wali Murid. Panggil user dengan 'Ayah/Bunda'.";

echo "Testing Si Pintar Chat...\n";
echo "Message: $message\n";
echo "-------------------\n";

$response = $gemini->chat($message, [
    'system_instruction' => $systemPrompt,
    'history' => []
]);

echo "Response: $response\n";

if (str_contains(strtolower($response), 'ayah') || str_contains(strtolower($response), 'bunda')) {
    echo "\nSUCCESS: AI responded with the correct persona.\n";
} else {
    echo "\nFAILURE: AI did not use the 'Ayah/Bunda' persona.\n";
}
