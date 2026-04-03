<?php

namespace App\Http\Controllers;

use App\Models\StudentTask;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StudentTaskController extends Controller
{
    public function index(Request $request)
    {
        $query = StudentTask::query();
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $tasks = $query->orderBy('deadline', 'asc')->get();
        return response()->json($tasks);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'deadline' => 'required|date',
            'class_name' => 'nullable|string',
            'subject_name' => 'nullable|string',
            'status' => 'nullable|string',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
        ]);

        $task = StudentTask::create([
            'user_id' => Auth::id(),
            ...$validated
        ]);

        return response()->json($task, 201);
    }

    public function update(Request $request, StudentTask $student_task)
    {
         if (!Auth::user()->isAdmin() && $student_task->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string',
            'deadline' => 'sometimes|required|date',
            'class_name' => 'nullable|string',
            'subject_name' => 'nullable|string',
            'status' => 'nullable|string',
            'semester' => 'sometimes|required|string',
            'academic_year' => 'sometimes|required|string',
        ]);

        $student_task->update($validated);
        return response()->json($student_task);
    }

    public function destroy(StudentTask $student_task)
    {
        if (!Auth::user()->isAdmin() && $student_task->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $student_task->delete();
        return response()->json(null, 204);
    }
}
