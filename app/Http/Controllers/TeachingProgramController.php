<?php

namespace App\Http\Controllers;

use App\Models\TeachingProgram;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TeachingProgramController extends Controller
{
    public function index(Request $request)
    {
        $query = TeachingProgram::query()->with(['subject', 'schoolClass']);
        
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }
        if ($request->has('grade_level')) {
            $query->where('grade_level', $request->grade_level);
        }
        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }
        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        $programs = $query->get();
        return response()->json(['data' => $programs]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'type' => 'nullable|string',
            'grade_level' => 'nullable|string',
            'subject_id' => 'nullable|exists:subjects,id',
            'class_id' => 'nullable|exists:classes,id',
            'week' => 'nullable|integer',
            'month' => 'nullable|string',
            'topic' => 'nullable|string',
            'subtopic' => 'nullable|string',
            'status' => 'nullable|string',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
            'notes' => 'nullable|string',
            'pekan_efektif' => 'nullable|array',
            'atp_items' => 'nullable|array',
            'prota' => 'nullable|array',
            'promes' => 'nullable|array',
            'jp_per_week' => 'nullable|integer',
            'total_effective_weeks' => 'nullable|integer',
            'total_effective_hours' => 'nullable|integer',
        ]);

        // Specific logic for unique programs:
        // Calendar structures are unique by user + grade + semester + year + type='calendar_structure'
        // Subject programs are unique by user + grade + subject + semester + year + type='subject_program'
        
        $matchCriteria = [
            'user_id' => Auth::id(),
            'type' => $request->type ?? 'journal',
            'semester' => $request->semester,
            'academic_year' => $request->academic_year,
        ];

        if ($request->type === 'calendar_structure') {
            $matchCriteria['grade_level'] = $request->grade_level;
        } elseif ($request->type === 'subject_program' || $request->type === 'atp_document') {
            $matchCriteria['grade_level'] = $request->grade_level;
            $matchCriteria['subject_id'] = $request->subject_id;
        } else {
            // Journal or default
            $matchCriteria['class_id'] = $request->class_id;
            $matchCriteria['week'] = $request->week;
            $matchCriteria['month'] = $request->month;
        }

        $program = TeachingProgram::updateOrCreate(
            $matchCriteria,
            array_merge($validated, ['user_id' => Auth::id()])
        );

        return response()->json($program, $program->wasRecentlyCreated ? 201 : 200);
    }

    public function update(Request $request, TeachingProgram $program)
    {
        if (!Auth::user()->isAdmin() && $program->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'subject_id' => 'nullable|exists:subjects,id',
            'class_id' => 'nullable|exists:classes,id',
            'week' => 'sometimes|required|integer',
            'month' => 'sometimes|required|string',
            'topic' => 'sometimes|required|string',
            'subtopic' => 'nullable|string',
            'status' => 'nullable|string',
            'semester' => 'sometimes|required|string',
            'academic_year' => 'sometimes|required|string',
            'notes' => 'nullable|string',
        ]);

        $program->update($validated);
        return response()->json($program);
    }

    public function destroy(TeachingProgram $program)
    {
        if (!Auth::user()->isAdmin() && $program->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $program->delete();
        return response()->json(null, 204);
    }
}
