<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Services\GradeBalanceService;
use Illuminate\Http\Request;

class GradeAnalysisController extends Controller
{
    protected $gradeService;

    public function __construct(GradeBalanceService $gradeService)
    {
        $this->gradeService = $gradeService;
    }

    public function getBalancedAnalysis(Request $request)
    {
        $request->validate([
            'student_id' => 'required|exists:students,id',
            'academic_year' => 'required|string',
            'semester' => 'required|in:Ganjil,Genap',
        ]);

        $data = $this->gradeService->calculateBalancedScore(
            $request->student_id,
            $request->academic_year,
            $request->semester
        );

        return response()->json($data);
    }
}
