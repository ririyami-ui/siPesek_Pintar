<?php

namespace App\Http\Controllers;

use App\Exceptions\GeminiException;
use App\Services\GeminiService;
use Illuminate\Http\Request;

class GeminiController extends Controller
{
    protected $geminiService;

    public function __construct(GeminiService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    /**
     * Analyze teaching journal
     */
    public function analyzeJournal(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'class' => 'required|string',
            'subject' => 'required|string',
            'topic' => 'required|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $analysis = $this->geminiService->analyzeJournal($validated);
            return response()->json($analysis);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Generate lesson plan (RPP)
     */
    public function generateLessonPlan(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'class' => 'required|string',
            'topic' => 'required|string',
            'duration' => 'required|integer',
            'competency' => 'required|string',
        ]);

        try {
            $rpp = $this->geminiService->generateLessonPlan($validated);
            return response()->json(['lesson_plan' => $rpp]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Generate quiz
     */
    public function generateQuiz(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'class' => 'required|string',
            'topic' => 'required|string',
            'question_count' => 'integer|min:1|max:50',
            'question_type' => 'string',
            'difficulty' => 'string',
        ]);

        try {
            $quiz = $this->geminiService->generateQuiz($validated);
            return response()->json(['quiz' => $quiz]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Generate handout
     */
    public function generateHandout(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'class' => 'required|string',
            'topic' => 'required|string',
        ]);

        try {
            $handout = $this->geminiService->generateHandout($validated);
            return response()->json(['handout' => $handout]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Generate worksheet (LKPD)
     */
    public function generateWorksheet(Request $request)
    {
        $validated = $request->validate([
            'subject' => 'required|string',
            'class' => 'required|string',
            'topic' => 'required|string',
        ]);

        try {
            $worksheet = $this->geminiService->generateWorksheet($validated);
            return response()->json(['worksheet' => $worksheet]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Analyze student performance
     */
    public function analyzeStudent(Request $request)
    {
        $validated = $request->validate([
            'student_name' => 'required|string',
            'class' => 'required|string',
            'subject' => 'required|string',
            'average_score' => 'required|numeric',
            'attendance' => 'required|numeric',
        ]);

        try {
            $analysis = $this->geminiService->analyzeStudentPerformance($validated);
            return response()->json(['analysis' => $analysis]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Chat with AI assistant
     */
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string',
            'context' => 'nullable|array',
        ]);

        try {
            $response = $this->geminiService->chat(
                $validated['message'],
                [],
                $validated['context'] ?? []
            );
            return response()->json(['response' => $response]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Auto-fill journal from ATP and previous journal context
     */
    public function autoFillJournal(Request $request)
    {
        $validated = $request->validate([
            'action' => 'required|string|in:auto_fill_journal',
            'subject' => 'required|string',
            'className' => 'required|string',
            'date' => 'required|date',
            'programMengajar' => 'nullable|array',
            'programMengajar.materi' => 'nullable|string',
            'programMengajar.pekanEfektif' => 'nullable',
            'previousJournal' => 'nullable|array',
            'previousJournal.topic' => 'nullable|string',
            'previousJournal.learningObjectives' => 'nullable|string',
            'previousJournal.learningActivities' => 'nullable|string',
        ]);

        try {
            $prompt = "Anda adalah asisten guru profesional. Buat draf jurnal mengajar.\n\n";
            $prompt .= "Mata Pelajaran: {$validated['subject']}\n";
            $prompt .= "Kelas: {$validated['className']}\n";
            $prompt .= "Tanggal: {$validated['date']}\n\n";

            if ($validated['programMengajar']['materi'] ?? null) {
                $prompt .= "Program Mengajar (ATP): {$validated['programMengajar']['materi']}\n";
                if (isset($validated['programMengajar']['pekanEfektif'])) {
                    $prompt .= "Pekan Efektif: " . json_encode($validated['programMengajar']['pekanEfektif']) . "\n";
                }
                $prompt .= "\n";
            }

            if ($validated['previousJournal']['topic'] ?? null) {
                $prompt .= "Jurnal Sebelumnya:\n";
                $prompt .= "- Materi: {$validated['previousJournal']['topic']}\n";
                if ($validated['previousJournal']['learningObjectives'] ?? null) {
                    $prompt .= "- Tujuan: {$validated['previousJournal']['learningObjectives']}\n";
                }
                if ($validated['previousJournal']['learningActivities'] ?? null) {
                    $prompt .= "- Kegiatan: {$validated['previousJournal']['learningActivities']}\n";
                }
                $prompt .= "\n";
            }

            $prompt .= "ATURAN WAJIB:\n";
            $prompt .= "- Gunakan HANYA materi pada 'Program Mengajar (ATP)' / 'Materi' di atas. Jangan menambah materi, KD, atau topik lain.\n";
            $prompt .= "- Jika tidak ada materi yang diberikan, kembalikan JSON dengan semua field berisi string kosong.\n";
            $prompt .= "- 'Jurnal Sebelumnya' hanya acuan gaya penulisan, BUKAN sumber materi.\n";
            $prompt .= "- Jangan menulis modul, RPP, silabus, atau penjelasan panjang. Ringkas, jelas, siap dipakai guru.\n";
            $prompt .= "- Tanpa markdown, tanpa tabel, tanpa bullet bertingkat.\n\n";
            $prompt .= "Isi lima field ini dalam Bahasa Indonesia:\n";
            $prompt .= "1. topic: nama materi persis seperti yang diberikan (maksimal 10 kata)\n";
            $prompt .= "2. learningObjectives: 1 kalimat, maksimal 20 kata\n";
            $prompt .= "3. learningActivities: tepat 3 poin singkat dipisah '; ' berurutan Pendahuluan, Inti, Penutup; tiap poin maksimal 10 kata\n";
            $prompt .= "4. reflection: 1 kalimat, maksimal 15 kata\n";
            $prompt .= "5. follow_up: 1 kalimat, maksimal 15 kata\n\n";
            $prompt .= "Balas HANYA JSON valid tanpa code fence dan tanpa teks tambahan:\n";
            $prompt .= '{
  "topic": "...",
  "learningObjectives": "...",
  "learningActivities": "...",
  "reflection": "...",
  "follow_up": "..."
}';

            $response = $this->geminiService->chat($prompt, [], [
                'system_instruction' => 'Anda adalah asisten guru yang mengisi jurnal mengajar harian. Tulis sangat ringkas, jelas, dan gunakan hanya materi yang diberikan. Jangan menulis modul, RPP, silabus, atau teks penjelas panjang.',
            ]);

            // Try to parse JSON from response
            $json = $response;
            // Strip markdown code fences if present
            $json = preg_replace('/^\s*```(?:json)?\s*/im', '', $json);
            $json = preg_replace('/\s*```\s*$/im', '', $json);
            $json = trim($json);

            $parsed = json_decode($json, true);

            if (!$parsed || !isset($parsed['topic'])) {
                // Some models prepend a short explanation before the JSON object.
                if (preg_match('/\{[\s\S]*\}/', $json, $matches)) {
                    $parsed = json_decode($matches[0], true);
                }
            }

            if (!$parsed || !isset($parsed['topic'])) {
                // Keep the fallback short so it cannot become a long module text.
                return response()->json([
                    'topic' => mb_substr(trim(strip_tags($response)), 0, 120),
                    'learningObjectives' => '',
                    'learningActivities' => '',
                    'reflection' => '',
                    'follow_up' => '',
                ]);
            }

            return response()->json($parsed);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }
}
