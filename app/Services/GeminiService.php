<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    private string $apiKey;
    private string $baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    private string $model = 'gemini-3.1-flash-lite-preview'; // Default fallback

    public function __construct()
    {
        $this->apiKey = (string) config('services.gemini.api_key');
        
        // Treat placeholder/default values as empty
        if ($this->apiKey === 'your_gemini_api_key_here' || empty($this->apiKey)) {
            $this->apiKey = '';
        }

        // Use user-specific API key if available
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
        
        if (empty($this->apiKey)) {
            // Fallback to sync from master admin profile if user doesn't have settings
            $this->syncSettingsFromProfile();
        }
        
        if (empty($this->apiKey)) {
            throw new \Exception('Gemini API Key is not configured. Please set it in your profile or .env file.');
        }
    }

    /**
     * Sync settings from the shared school profile (Master Admin)
     */
    private function syncSettingsFromProfile()
    {
        try {
            // Get the master admin ID
            $primaryAdminId = \App\Models\User::whereIn('role', ['admin', 'adminer'])
                ->orderBy('id', 'asc')
                ->value('id');

            if ($primaryAdminId) {
                $profile = \App\Models\UserProfile::where('user_id', $primaryAdminId)->first();
                if ($profile) {
                    if ((empty($this->apiKey) || $this->apiKey === 'your_gemini_api_key_here') && $profile->google_ai_api_key) {
                        $this->apiKey = $profile->google_ai_api_key;
                    }
                    if ($profile->gemini_model) {
                        $this->model = $profile->gemini_model;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to sync GeminiService settings: ' . $e->getMessage());
        }
    }

    /**
     * Generate text from a prompt
     */
    public function generateText(string $prompt, array $options = []): ?string
    {
        try {
            $response = Http::timeout(30)->post(
                "{$this->baseUrl}/models/{$this->model}:generateContent?key={$this->apiKey}",
                [
                    'contents' => [
                        [
                            'parts' => [
                                ['text' => $prompt]
                            ]
                        ]
                    ],
                    'generationConfig' => [
                        'temperature' => $options['temperature'] ?? 0.7,
                        'maxOutputTokens' => $options['maxTokens'] ?? 2048,
                    ]
                ]
            );

            if ($response->successful()) {
                $data = $response->json();
                return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
            }

            Log::error('Gemini API Error', ['response' => $response->body()]);
            return null;
        } catch (\Exception $e) {
            Log::error('Gemini API Exception', ['error' => $e->getMessage()]);
            return null;
        }
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
    public function generateLessonPlan(array $data): ?string
    {
        $prompt = $this->buildLessonPlanPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 4096]);
    }

    /**
     * Generate Quiz
     */
    public function generateQuiz(array $data): ?string
    {
        $prompt = $this->buildQuizPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 3072]);
    }

    /**
     * Generate Handout
     */
    public function generateHandout(array $data): ?string
    {
        $prompt = $this->buildHandoutPrompt($data);
        return $this->generateText($prompt, ['maxTokens' => 4096]);
    }

    /**
     * Generate Worksheet (LKPD)
     */
    public function generateWorksheet(array $data): ?string
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
    public function chat(string $message, array $context = []): ?string
    {
        $systemContext = "Anda adalah asisten guru yang membantu dalam perencanaan pembelajaran dan analisis pendidikan.";
        
        if (!empty($context)) {
            $systemContext .= "\n\nKonteks: " . json_encode($context, JSON_UNESCAPED_UNICODE);
        }

        $fullPrompt = "{$systemContext}\n\nPertanyaan: {$message}";
        
        return $this->generateText($fullPrompt);
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
