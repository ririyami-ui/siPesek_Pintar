<?php

namespace App\Http\Controllers;

use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class SubjectController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Subject::query();

        // Admin can request everything
        if ($request->has('all') && $user->isAdmin()) {
            return response()->json(['data' => $query->get()]);
        }

        // Determine teacher context
        $teacherId = $request->input('teacher_id');
        if (!$teacherId && $user->role === 'teacher') {
            $teacherRecord = Teacher::where('auth_user_id', $user->id)->first();
            $teacherId = $teacherRecord ? $teacherRecord->id : null;
        }

        // Apply filters based on TeacherAssignment
        if ($teacherId || $request->has('class_id')) {
            $assignmentQuery = TeacherAssignment::query();

            if ($teacherId) {
                $assignmentQuery->where('teacher_id', $teacherId);
            }

            if ($request->has('class_id')) {
                $assignmentQuery->where('class_id', $request->class_id);
            }

            $subjectIds = $assignmentQuery->pluck('subject_id')->unique();
            
            // If class_id was provided but no assignments found, result should be empty
            if ($request->has('class_id') && $subjectIds->isEmpty()) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('id', $subjectIds);
            }
        } elseif ($user->role === 'teacher' && !$user->isAdmin()) {
            // If logged in as teacher but no assignments found at all
            $query->whereRaw('1 = 0');
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        /** @var User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|unique:subjects,code',
            'school_level' => 'nullable|string|max:10',
        ]);

        $subject = Subject::create($validated);

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json($subject, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Subject $subject)
    {
        return $subject;
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Subject $subject)
    {
        /** @var User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }

        $validated = $request->validate([
            'name' => 'string|max:255',
            'code' => 'string|unique:subjects,code,' . $subject->id,
            'school_level' => 'nullable|string|max:10',
        ]);

        $subject->update($validated);

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json($subject);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Subject $subject)
    {
        /** @var User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }

        $subject->delete();

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json(null, 204);
    }
}
