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
        if (!$user) {
            return response()->json(['data' => []]);
        }

        $query = Subject::query();

        // 1. Admin Logic
        if ($user->isAdmin()) {
            return response()->json(['data' => $query->orderBy('name')->get()]);
        }

        // 2. Teacher Logic
        if ($user->role === 'teacher') {
            $teacherRecord = Teacher::where('auth_user_id', $user->id)->first();
            if (!$teacherRecord) return response()->json(['data' => []]);

            $subjectIds = TeacherAssignment::where('teacher_id', $teacherRecord->id)
                ->pluck('subject_id')->unique();
            
            return response()->json(['data' => $query->whereIn('id', $subjectIds)->orderBy('name')->get()]);
        }

        // 3. Fallback for Class Context (Students, etc)
        if ($request->has('class_id')) {
            $subjectIds = TeacherAssignment::where('class_id', $request->class_id)
                ->pluck('subject_id')->unique();
            return response()->json(['data' => $query->whereIn('id', $subjectIds)->orderBy('name')->get()]);
        }

        return response()->json(['data' => []]);
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
            'weekly_hours' => 'required|integer|min:1|max:10',
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
            'weekly_hours' => 'nullable|integer|min:1|max:10',
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
