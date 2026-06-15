<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Portfolio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PortfolioController extends Controller
{
    protected $geminiService;

    public function __construct(\App\Services\GeminiService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    public function index()
    {
        $portfolios = Portfolio::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->get();
        
        return response()->json($portfolios);
    }

    public function generate(Request $request)
    {
        $request->validate([
            'academic_year' => 'required|string',
            'semester' => 'required|string',
        ]);

        // Cari atau buat baru berdasarkan tahun/semester/user
        $portfolio = Portfolio::updateOrCreate(
            [
                'user_id' => Auth::id(),
                'academic_year' => $request->academic_year,
                'semester' => $request->semester,
            ],
            [
                'content' => $request->existing_chapters ?? [],
                'status' => 'draft'
            ]
        );

        // PANGGIL AI UNTUK GENERATE KONTEN
        if ($request->has('chapter_id')) {
            $currentContent = $portfolio->content ?? [];
            if (isset($currentContent['chapters'])) {
                $currentContent = $currentContent['chapters'];
            }

            // Gunakan data dari request untuk AI
            $aiContent = $this->geminiService->generatePortfolioChapter([
                'chapter_id' => $request->chapter_id,
                'context' => $request->context ?? [],
                'user' => Auth::user(),
                'subject' => $request->subject
            ]);

            if ($aiContent) {
                $currentContent[$request->chapter_id] = [
                    'content' => $aiContent,
                    'status' => 'done',
                    'updatedAt' => now()
                ];
                $portfolio->content = $currentContent;
                $portfolio->save();
            } else {
                return response()->json([
                    'message' => 'AI (Gemini) gagal merespon. Mohon periksa API Key Anda di menu Profil atau coba ganti model ke "Gemini 1.5 Flash".'
                ], 422);
            }
        }

        return response()->json($portfolio);
    }

    public function show($id)
    {
        $portfolio = Portfolio::where('user_id', Auth::id())->findOrFail($id);
        return response()->json($portfolio);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'content' => 'required|array',
        ]);

        $portfolio = Portfolio::where('user_id', Auth::id())->findOrFail($id);
        $portfolio->update([
            'content' => $request->content,
            'status' => 'completed'
        ]);

        return response()->json($portfolio);
    }
}
