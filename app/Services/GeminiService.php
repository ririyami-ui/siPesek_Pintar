<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    protected string $apiKey;
    protected string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    protected string $model = 'gemini-2.0-flash'; // Optimized default

    public function __construct()
    {
        $this->resolveSettings();
    }

    /**
     * Centralized logic to resolve API Key and Model from Profile or Config
     */
    protected function resolveSettings(): void
    {
        // 1. Default from config
        $this->apiKey = (string) config('services.gemini.api_key', '');
        if ($this->apiKey === 'your_gemini_api_key_here') $this->apiKey = '';

        // 2. Override from current user profile
        if (auth()->check()) {
            $profile = \App\Models\UserProfile::where('user_id', auth()->id())->first();
            if ($profile) {
                if ($profile->google_ai_api_key && $profile->google_ai_api_key !== 'your_gemini_api_key_here') {
                    $this->apiKey = $profile->google_ai_api_key;
                }
                if ($profile->gemini_model) {
                    $this->model = $profile->gemini_model;
                }
            }
        }

        // 3. Fallback to master admin if still empty
        if (empty($this->apiKey)) {
            $primaryAdminId = \App\Models\User::whereIn('role', ['admin', 'adminer'])
                ->orderBy('id', 'asc')
                ->value('id');

            if ($primaryAdminId) {
                $adminProfile = \App\Models\UserProfile::where('user_id', $primaryAdminId)->first();
                if ($adminProfile) {
                    if ($adminProfile->google_ai_api_key && $adminProfile->google_ai_api_key !== 'your_gemini_api_key_here') {
                        $this->apiKey = $adminProfile->google_ai_api_key;
                    }
                    // Only override model if not explicitly set by user or we want global school consistency
                    if (empty($this->model) || $this->model === 'gemini-2.0-flash') {
                        $this->model = $adminProfile->gemini_model ?? $this->model;
                    }
                }
            }
        }
    }

    /**
     * Unified core method to call Gemini API with robust retry logic
     * Supports both simple strings and structured content (history/parts)
     */
    public function callGeminiApi($promptOrContents, string $modelOverride = null, int $maxTokens = 4096, float $temperature = 0.7, ?string $systemInstruction = null): ?string
    {
        $retries = 3;
        $delay = 1000; // 1 second initial delay
        $lastError = null;
        $finalModel = $modelOverride ?: $this->model;

        for ($i = 0; $i < $retries; $i++) {
            try {
                if (!$this->apiKey) {
                    throw new \Exception('Gemini API Key is not configured.');
                }

                // Fallback to flash-lite if overloaded (503) on subsequent attempts
                if ($i > 0 && $lastError && str_contains($lastError, '503')) {
                    $finalModel = 'gemini-2.0-flash-lite-preview-02-05'; 
                }

                $contents = is_string($promptOrContents) 
                    ? [['role' => 'user', 'parts' => [['text' => $promptOrContents]]]]
                    : $promptOrContents;

                $payload = [
                    'contents' => $contents,
                    'generationConfig' => [
                        'temperature' => $temperature,
                        'maxOutputTokens' => $maxTokens,
                    ]
                ];

                if ($systemInstruction) {
                    $payload['systemInstruction'] = [
                        'role' => 'system',
                        'parts' => [['text' => $systemInstruction]]
                    ];
                }

                $response = Http::timeout(90)->post(
                    "{$this->baseUrl}/models/{$finalModel}:generateContent?key={$this->apiKey}",
                    $payload
                );

                if ($response->successful()) {
                    $data = $response->json();
                    return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
                }

                $status = $response->status();
                $errorBody = $response->json();
                $errorMessage = $errorBody['error']['message'] ?? 'Unknown Error';
                $lastError = "$status: $errorMessage";

                Log::warning("Gemini API Attempt " . ($i + 1) . " failed ($status): $errorMessage");

                // Retry on transient errors
                if ($status === 503 || $status === 429 || $status === 504) {
                    if ($i < $retries - 1) {
                        usleep($delay * 1000);
                        $delay *= 2;
                        continue;
                    }
                }

                throw new \Exception("Gemini API Error ($status): $errorMessage");

            } catch (\Exception $e) {
                $lastError = $e->getMessage();
                if ($i < $retries - 1 && (str_contains($lastError, 'timed out') || str_contains($lastError, '503') || str_contains($lastError, '429'))) {
                    Log::warning("Retrying Gemini API after exception: $lastError");
                    usleep($delay * 1000);
                    $delay *= 2;
                    continue;
                }
                Log::error('Gemini API Fatal Error', ['error' => $lastError]);
                return null;
            }
        }

        return null;
    }


    /**
     * Backward compatibility / Shorthand for text generation
     */
    public function generateText(string $prompt, array $options = []): ?string
    {
        return $this->callGeminiApi(
            $prompt, 
            $options['model'] ?? null, 
            $options['maxTokens'] ?? 2048, 
            $options['temperature'] ?? 0.7
        );
    }


    /**
     * Analyze teaching journal
     */
    public function analyzeJournal(array $journalData): ?array
    {
        $cacheKey = 'journal_analysis_' . md5(json_encode($journalData));
        
        return Cache::remember($cacheKey, 3600, function () use ($journalData) {
            $prompt = $this->buildJournalAnalysisPrompt($journalData);
            $response = $this->generateText($prompt);

            if (!$response) {
                return null;
            }

            return [
                'analysis' => $response,
                'cached' => false,
            ];
        });
    }

    /**
     * Generate Lesson Plan (RPP)
     */
    public function generateLessonPlan(array $data)
    {
        $prompt = $this->buildLessonPlanPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 4096]);
    }

    /**
     * Generate Quiz
     */
    public function generateQuiz(array $data)
    {
        $prompt = $this->buildQuizPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 3072]);
    }

    /**
     * Generate Handout
     */
    public function generateHandout(array $data)
    {
        $prompt = $this->buildHandoutPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 4096]);
    }

    /**
     * Generate Worksheet (LKPD)
     */
    public function generateWorksheet(array $data)
    {
        $prompt = $this->buildWorksheetPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 3072]);
    }

    /**
     * Analyze student performance
     */
    public function analyzeStudentPerformance(array $data): ?string
    {
        $prompt = $this->buildStudentAnalysisPrompt($data);
        return $this->generateText($prompt);
    }

    /**
     * Chat with AI Teaching Assistant
     */
    public function chat($message, $history = [], $context = [])
    {
        $systemInstruction = null;
        $realHistory = [];
        $modelName = $this->model;

        // Support options array passed as second argument (as seen in StudentChatController)
        if (is_array($history) && isset($history['system_instruction'])) {
            $systemInstruction = $history['system_instruction'];
            $realHistory = $history['history'] ?? [];
            $modelName = $history['model'] ?? $modelName;
        } else {
            $realHistory = $history;
            $systemInstruction = "Anda adalah asisten guru yang membantu dalam perencanaan pembelajaran dan analisis pendidikan.";
            if (!empty($context)) {
                $systemInstruction .= "\n\nKonteks: " . json_encode($context, JSON_UNESCAPED_UNICODE);
            }
        }

        // Prepare contents for callGeminiApi
        $contents = $realHistory;
        
        // Add current user message
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $message]]
        ];
        
        return $this->callGeminiApi($contents, $modelName, 4096, 0.7, $systemInstruction);
    }

    // =================== PROMPT BUILDERS ===================

    private function buildJournalAnalysisPrompt(array $data): string
    {
        return "Analisis jurnal mengajar berikut dan berikan saran pedagogis:\n\n" .
               "Tanggal: {$data['date']}\n" .
               "Kelas: {$data['class']}\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Materi: {$data['topic']}\n" .
               "Catatan: {$data['notes']}\n\n" .
               "Berikan analisis singkat tentang:\n" .
               "1. Kesesuaian materi dengan kurikulum\n" .
               "2. Saran metode pembelajaran\n" .
               "3. Rekomendasi tindak lanjut";
    }

    private function buildLessonPlanPrompt(array $data): string
    {
        return "Buatkan Rencana Pelaksanaan Pembelajaran (RPP) dengan detail berikut:\n\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Kelas: {$data['class']}\n" .
               "Materi: {$data['topic']}\n" .
               "Alokasi Waktu: {$data['duration']} menit\n" .
               "Kompetensi Dasar: {$data['competency']}\n\n" .
               "Format RPP harus mencakup:\n" .
               "1. Tujuan Pembelajaran\n" .
               "2. Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup)\n" .
               "3. Asesmen\n" .
               "4. Media dan Sumber Belajar";
    }

    private function buildQuizPrompt(array $data): string
    {
        $count = $data['question_count'] ?? 10;
        $type = $data['question_type'] ?? 'pilihan ganda';
        
        return "Buatkan soal {$type} sebanyak {$count} soal untuk:\n\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Kelas: {$data['class']}\n" .
               "Materi: {$data['topic']}\n" .
               "Tingkat Kesulitan: {$data['difficulty']}\n\n" .
               "Format:\n" .
               "- Nomor soal\n" .
               "- Pertanyaan\n" .
               "- Pilihan jawaban (A-D)\n" .
               "- Kunci jawaban\n" .
               "- Pembahasan singkat";
    }

    private function buildHandoutPrompt(array $data): string
    {
        return "Buatkan handout materi pembelajaran untuk:\n\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Kelas: {$data['class']}\n" .
               "Topik: {$data['topic']}\n\n" .
               "Handout harus mencakup:\n" .
               "1. Pengantar materi\n" .
               "2. Penjelasan konsep utama\n" .
               "3. Contoh soal dan pembahasan\n" .
               "4. Rangkuman\n" .
               "5. Latihan soal";
    }

    private function buildWorksheetPrompt(array $data): string
    {
        return "Buatkan Lembar Kerja Peserta Didik (LKPD) untuk:\n\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Kelas: {$data['class']}\n" .
               "Materi: {$data['topic']}\n\n" .
               "LKPD harus berisi:\n" .
               "1. Tujuan pembelajaran\n" .
               "2. Petunjuk kerja\n" .
               "3. Kegiatan/eksperimen\n" .
               "4. Pertanyaan diskusi\n" .
               "5. Kesimpulan";
    }

    private function buildStudentAnalysisPrompt(array $data): string
    {
        return "Analisis performa siswa berikut:\n\n" .
               "Nama: {$data['student_name']}\n" .
               "Kelas: {$data['class']}\n" .
               "Mata Pelajaran: {$data['subject']}\n" .
               "Nilai Rata-rata: {$data['average_score']}\n" .
               "Kehadiran: {$data['attendance']}%\n\n" .
               "Berikan:\n" .
               "1. Analisis performa akademik\n" .
               "2. Identifikasi area yang perlu perbaikan\n" .
               "3. Rekomendasi strategi pembelajaran individual";
    }
}
