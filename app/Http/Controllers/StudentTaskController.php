<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\StudentTask;
use App\Models\TeacherAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StudentTaskController extends Controller
{
    public function index(Request $request)
    {
        $query = StudentTask::query();

        if (!Auth::user()->isAdmin()) {
            $role = strtolower(Auth::user()->role ?? '');

            if (in_array($role, ['guru', 'teacher'])) {
                // Guru: tugas untuk kelas yang diampu + tugas yang dibuatnya sendiri
                $query->where(function ($q) {
                    $q->whereNull('class_id')
                      ->orWhereIn('class_id', $this->teacherClassIds())
                      ->orWhere('user_id', Auth::id());
                });
            } elseif ($role === 'student') {
                // Siswa: tugas untuk kelasnya (mencakup tugas umum tanpa class_id)
                $classId = Student::where('auth_user_id', Auth::id())->value('class_id');
                $query->where(function ($q) use ($classId) {
                    $q->whereNull('class_id')
                      ->orWhere('class_id', $classId);
                })
                ->where('status', '!=', 'completed');
            } else {
                // Staff / lainnya: hanya tugas pribadi
                $query->where('user_id', Auth::id());
            }
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
        $role = strtolower(Auth::user()->role ?? '');
        if (!Auth::user()->isAdmin() && !in_array($role, ['guru', 'teacher'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'deadline' => 'required|date',
            'class_name' => 'nullable|string',
            'class_id' => 'nullable|exists:classes,id',
            'subject_name' => 'nullable|string',
            'subject_id' => 'nullable|exists:subjects,id',
            'status' => 'nullable|string',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
        ]);

        // Guru hanya boleh membuat tugas untuk kelas yang diampunya
        if (!Auth::user()->isAdmin() && !empty($validated['class_id']) && !in_array((int) $validated['class_id'], $this->teacherClassIds())) {
            return response()->json(['message' => 'Anda hanya dapat membuat tugas untuk kelas yang Anda ampu.'], 403);
        }

        $task = StudentTask::create(array_merge($validated, [
            'user_id' => Auth::id(),
        ]));

        return response()->json($task, 201);
    }

    public function update(Request $request, StudentTask $student_task)
    {
        if (!$this->canManageStudentTask($student_task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string',
            'description' => 'nullable|string',
            'deadline' => 'sometimes|required|date',
            'class_name' => 'nullable|string',
            'class_id' => 'nullable|exists:classes,id',
            'subject_name' => 'nullable|string',
            'subject_id' => 'nullable|exists:subjects,id',
            'status' => 'nullable|string',
            'semester' => 'sometimes|required|string',
            'academic_year' => 'sometimes|required|string',
        ]);

        $student_task->update($validated);
        return response()->json($student_task);
    }

    public function destroy(StudentTask $student_task)
    {
        if (!$this->canManageStudentTask($student_task)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $student_task->delete();
        return response()->json(null, 204);
    }

    /**
     * IDs kelas yang diampu oleh guru (user) yang sedang login.
     */
    private function teacherClassIds(): array
    {
        return TeacherAssignment::whereHas('teacher', function ($q) {
            $q->where('auth_user_id', Auth::id());
        })->pluck('class_id')->map(fn ($id) => (int) $id)->toArray();
    }

    /**
     * Cek apakah user boleh mengelola tugas tertentu.
     */
    private function canManageStudentTask(StudentTask $task): bool
    {
        if (Auth::user()->isAdmin()) {
            return true;
        }

        $role = strtolower(Auth::user()->role ?? '');
        if (!in_array($role, ['guru', 'teacher'])) {
            return false;
        }

        if ($task->user_id === Auth::id()) {
            return true;
        }

        return !empty($task->class_id) && in_array((int) $task->class_id, $this->teacherClassIds());
    }
}
