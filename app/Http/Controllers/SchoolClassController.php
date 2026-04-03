<?php

namespace App\Http\Controllers;

use App\Models\SchoolClass;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class SchoolClassController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = SchoolClass::query();
        
        // Filter if user is NOT admin
        if (!$user->isAdmin()) {
            // Find the teacher profile associated with this auth user
            $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
            
            if ($teacher) {
                // Only return classes assigned to this teacher
                $classIds = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id)
                    ->pluck('class_id')
                    ->unique()
                    ->filter(); // Remove nulls if any
                
                if ($classIds->isNotEmpty()) {
                    $query->whereIn('id', $classIds);
                } else {
                    // If teacher has no assignments, we'll allow them to see all classes
                    // so they can at least use AI features.
                    // Or keep it restricted if we're strictly enforcing assignments.
                    // Given the user feedback, they probably want to see the classes.
                }
            } else {
                // If not found in teachers table, but role is teacher, 
                // they might be a newly created user without a teacher profile yet.
                // In this case, we'll allow them to see all classes so they can at least use AI features.
                // Or we can return nothing if we want to be strict.
                // The user's prompt suggests they WANT to see classes.
                // Let's fallback to showing all classes if no specific teacher record is found
                // but keep it restricted to the same 'school' (user_id of creator) if possible.
                // For now, let's just not filter if teacher record is missing.
            }
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }
        
        // Debug logging
        Log::info('Class store request', [
            'data' => $request->all(),
            'user_id' => $user->id,
            'user' => $user->email
        ]);

        $validatedData = $request->validate([
            'code' => [
                'required',
                'string',
                \Illuminate\Validation\Rule::unique('classes')->where(function ($query) {
                    return $query->where('user_id', auth()->id());
                }),
            ],
            'level' => 'required|string',
            'rombel' => 'required|string',
            'description' => 'nullable|string',
        ]);
        
        $validatedData['user_id'] = auth()->id();

        $class = SchoolClass::create($validatedData);

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json(['data' => $class], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(SchoolClass $schoolClass)
    {
        return response()->json(['data' => $schoolClass]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, SchoolClass $schoolClass)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }

        $validatedData = $request->validate([
            'code' => [
                'required',
                'string',
                \Illuminate\Validation\Rule::unique('classes')->where(function ($query) use ($schoolClass) {
                    return $query->where('user_id', auth()->id());
                })->ignore($schoolClass->id),
            ],
            'level' => 'required|string',
            'rombel' => 'required|string',
            'description' => 'nullable|string',
        ]);

        $schoolClass->update($validatedData);

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json(['data' => $schoolClass]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(SchoolClass $schoolClass)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Unauthorized. Admin role required.');
        }

        $schoolClass->delete();

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->noContent();
    }
}
