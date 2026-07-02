<?php

namespace App\Http\Controllers;

use App\Models\StudentActivityPoint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ActivityPointController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'class_id' => 'required|integer',
            'subject_id' => 'required|integer',
            'date' => 'required|date',
        ]);

        $points = StudentActivityPoint::where('class_id', $request->class_id)
            ->where('subject_id', $request->subject_id)
            ->where('date', $request->date)
            ->get()
            ->groupBy('student_id')
            ->map(function ($items) {
                return $items->pluck('activity_category_id')->toArray();
            });

        return response()->json(['data' => $points]);
    }

    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'class_id' => 'required|integer',
            'subject_id' => 'required|integer',
            'points' => 'required|array',
            'points.*.student_id' => 'required|integer',
            'points.*.activity_category_ids' => 'array',
            'points.*.activity_category_ids.*' => 'integer',
        ]);

        $teacherId = Auth::id();
        $date = $validated['date'];
        $classId = $validated['class_id'];
        $subjectId = $validated['subject_id'];

        // Delete existing points for this class/subject/date combination
        StudentActivityPoint::where('class_id', $classId)
            ->where('subject_id', $subjectId)
            ->where('date', $date)
            ->delete();

        $newPoints = [];
        foreach ($validated['points'] as $item) {
            if (empty($item['activity_category_ids'])) continue;
            foreach ($item['activity_category_ids'] as $catId) {
                $newPoints[] = [
                    'student_id' => $item['student_id'],
                    'teacher_id' => $teacherId,
                    'class_id' => $classId,
                    'subject_id' => $subjectId,
                    'activity_category_id' => $catId,
                    'date' => $date,
                    'point' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        if (!empty($newPoints)) {
            StudentActivityPoint::insert($newPoints);
        }

        return response()->json(['message' => 'Poin keaktifan berhasil disimpan.'], 201);
    }
}
