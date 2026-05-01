<?php

namespace App\Http\Controllers;

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

        $analysis = $this->geminiService->analyzeJournal($validated);

        if (!$analysis) {
            return response()->json([
                'message' => 'Failed to analyze journal'
            ], 500);
        }

        return response()->json($analysis);
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

        $rpp = $this->geminiService->generateLessonPlan($validated);

        if (!$rpp) {
            return response()->json([
                'message' => 'Failed to generate lesson plan'
            ], 500);
        }

        return response()->json([
            'lesson_plan' => $rpp
        ]);
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

        $quiz = $this->geminiService->generateQuiz($validated);

        if (!$quiz) {
            return response()->json([
                'message' => 'Failed to generate quiz'
            ], 500);
        }

        return response()->json([
            'quiz' => $quiz
        ]);
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

        $handout = $this->geminiService->generateHandout($validated);

        if (!$handout) {
            return response()->json([
                'message' => 'Failed to generate handout'
            ], 500);
        }

        return response()->json([
            'handout' => $handout
        ]);
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

        $worksheet = $this->geminiService->generateWorksheet($validated);

        if (!$worksheet) {
            return response()->json([
                'message' => 'Failed to generate worksheet'
            ], 500);
        }

        return response()->json([
            'worksheet' => $worksheet
        ]);
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

        $analysis = $this->geminiService->analyzeStudentPerformance($validated);

        if (!$analysis) {
            return response()->json([
                'message' => 'Failed to analyze student'
            ], 500);
        }

        return response()->json([
            'analysis' => $analysis
        ]);
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

        $response = $this->geminiService->chat(
            $validated['message'],
            [], // history
            $validated['context'] ?? []
        );

        if (!$response) {
            return response()->json([
                'message' => 'Failed to get AI response'
            ], 500);
        }

        return response()->json([
            'response' => $response
        ]);
    }
}
