<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Services\GeminiService;

$gemini = new GeminiService();

// Mock data similar to what's in StudentChatController
$studentName = "Budi Santoso";
$systemPrompt = "Anda adalah **Si Pintar**, asisten AI untuk Wali Murid. 
TUGAS: Menjawab pertanyaan Wali Murid HANYA seputar data akademik anak mereka ($studentName).
DATA SISWA:
- Nama: $studentName
- Kelas: 9A
- Rata-rata Nilai: 85
- Presensi: Hadir: 20, Sakit: 1, Alpa: 0
- Nilai Matematika: 90";

$message = "Berapa nilai matematika Budi?";

echo "Testing Student Data Access...\n";
echo "Message: $message\n";
echo "-------------------\n";

$response = $gemini->chat($message, [
    'system_instruction' => $systemPrompt,
    'history' => []
]);

echo "Response: $response\n";

if (str_contains($response, '90')) {
    echo "\nSUCCESS: AI correctly identified the student's grade.\n";
} else {
    echo "\nFAILURE: AI did not provide the specific data.\n";
}
