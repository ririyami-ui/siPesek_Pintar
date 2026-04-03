<?php

namespace App\Http\Controllers;

use App\Models\Grade;
use App\Models\Student;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GradeController extends Controller
{
    public function index(Request $request)
    {
        $query = Grade::query()->with(['student', 'subject', 'schoolClass']);
        
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }
        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }
        if ($request->has('date_start') && $request->has('date_end')) {
            $query->whereBetween('date', [$request->date_start, $request->date_end]);
        }
        // Support legacy filtering
        if ($request->has('className')) {
             $query->whereHas('schoolClass', function($q) use ($request) {
                 $q->where('rombel', $request->className);
             });
        }

        $grades = $query->orderBy('date', 'desc')->get();
        return response()->json(['data' => $grades]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'class_id' => 'nullable|exists:classes,id',
            'score' => 'required|numeric',
            'type' => 'required|string',
            'date' => 'required|date',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
            'topic' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $grade = Grade::updateOrCreate(
            [
                'user_id' => Auth::id(),
                'student_id' => $request->student_id,
                'class_id' => $request->class_id,
                'subject_id' => $request->subject_id,
                'date' => $request->date,
                'type' => $request->type,
                'topic' => $request->topic, // Material unique identifier for that day/type
                'semester' => $request->semester,
                'academic_year' => $request->academic_year
            ],
            array_merge($validated, ['user_id' => Auth::id()])
        );

        return response()->json($grade, 201);
    }

    public function storeBatch(Request $request)
    {
        $request->validate([
            'grades' => 'required|array',
            'grades.*.student_id' => 'required|exists:students,id',
            'grades.*.score' => 'required|numeric',
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'required|exists:subjects,id',
            'date' => 'required|date',
            'type' => 'required|string', // Assessment Type
            'topic' => 'required|string', // Material
            'semester' => 'required|string',
            'academic_year' => 'required|string',
        ]);
        
        try {
            DB::beginTransaction();
            
            $commonData = $request->only(['class_id', 'subject_id', 'date', 'type', 'topic', 'semester', 'academic_year']);
            $gradesData = $request->grades;
            $savedGrades = [];

            foreach ($gradesData as $g) {
                // Update or Create
                 $grade = Grade::updateOrCreate(
                    [
                        'user_id' => Auth::id(),
                        'student_id' => $g['student_id'],
                        'class_id' => $commonData['class_id'],
                        'subject_id' => $commonData['subject_id'],
                        'date' => $commonData['date'],
                        'type' => $commonData['type'],
                        'topic' => $commonData['topic'],
                        'semester' => $commonData['semester'],
                        'academic_year' => $commonData['academic_year']
                    ],
                    [
                        'score' => $g['score'],
                        'notes' => $g['notes'] ?? null
                    ]
                );
                $savedGrades[] = $grade;
            }

            DB::commit();
            return response()->json(['message' => 'Nilai berhasil disimpan', 'count' => count($savedGrades)]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Batch save error: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyimpan nilai batch'], 500);
        }
    }

    public function getMaterials(Request $request) 
    {
        // Get unique topics/materials based on filters
        $query = Grade::query();
        
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }
        
        if ($request->has('class_id')) $query->where('class_id', $request->class_id);
        if ($request->has('subject_id')) $query->where('subject_id', $request->subject_id);
        if ($request->has('type')) $query->where('type', $request->type);
         if ($request->has('semester')) $query->where('semester', $request->semester);
        
        $materials = $query->distinct()->pluck('topic');
        return response()->json($materials);
    }


    public function destroyBatch(Request $request)
    {
        $request->validate([
            'class_id' => 'required',
            'subject_id' => 'required',
            'date' => 'required|date',
            'type' => 'required',
            'topic' => 'required',
        ]);

        try {
            $query = Grade::query();
            if (!Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }

            $deleted = $query->where('class_id', $request->class_id)
                ->where('subject_id', $request->subject_id)
                ->where('date', $request->date)
                ->where('type', $request->type)
                ->where('topic', $request->topic)
                ->delete();

            return response()->json(['message' => "$deleted data nilai berhasil dihapus"]);
        } catch (\Exception $e) {
            Log::error("Error deleting grades batch: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menghapus data nilai'], 500);
        }
    }

    public function update(Request $request, Grade $grade)
    {
        if (!Auth::user()->isAdmin() && $grade->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'student_id' => 'sometimes|required|exists:students,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'class_id' => 'nullable|exists:classes,id',
            'score' => 'sometimes|required|numeric',
            'type' => 'sometimes|required|string',
            'date' => 'sometimes|required|date',
            'semester' => 'sometimes|required|string',
            'academic_year' => 'sometimes|required|string',
            'topic' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $grade->update($validated);
        return response()->json($grade);
    }

    public function destroy(Grade $grade)
    {
        if (!Auth::user()->isAdmin() && $grade->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $grade->delete();
        return response()->json(null, 204);
    }

    /**
     * Get comprehensive grades summary for a student using GradeCalculationService
     * Used by Admin and Teachers to see the exact same computed score as the Parent/Student.
     */
    public function getSummary(Request $request, $student_id)
    {
        $student = Student::findOrFail($student_id);

        $query = Grade::query()->with(['subject', 'schoolClass'])
            ->where('student_id', $student_id);
        
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $grades = $query->orderBy('date', 'desc')->get();

        $gradeService = new GradeCalculationService();
        $calculatedData = $gradeService->calculateStudentGrades(
            $student, 
            $grades, 
            $request->semester, 
            $request->academic_year
        );

        return response()->json([
            'student'            => ['name' => $student->name, 'class' => $student->schoolClass->rombel ?? ''],
            'by_subject'         => $calculatedData['by_subject'],
            'total_grades'       => $grades->count(),
            'weights'            => $calculatedData['weights'],
            'attendance_summary' => $calculatedData['attendance_summary'],
            'infraction_summary' => $calculatedData['infraction_summary'],
            'radar_data'         => $calculatedData['radar_data'],
            'warnings'           => $calculatedData['warnings'],
            'overall_nilai_akhir'=> $calculatedData['overall_nilai_akhir'],
        ]);
    }
}
