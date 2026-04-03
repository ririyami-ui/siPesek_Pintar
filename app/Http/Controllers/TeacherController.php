<?php

namespace App\Http\Controllers;

use App\Models\Teacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class TeacherController extends Controller
{
    public function index()
    {
        $query = Teacher::query();
        
        if (!Auth::user()->isAdmin()) {
            $query->where('auth_user_id', Auth::id());
        }

        $teachers = $query->with(['assignments.subject', 'assignments.schoolClass'])
            ->orderBy('name')
            ->get();
        return response()->json(['data' => $teachers]);
    }

    public function store(Request $request)
    {
        if (!Auth::user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin role required.'], 403);
        }

        $validated = $request->validate([
            'code' => 'nullable|string',
            'name' => 'required|string',
            'nip' => 'nullable|string',
            'username' => 'nullable|string',
            'password' => 'nullable|string',
        ]);

        $username = $validated['username'] ?? null;
        if (empty($username)) {
            // Auto generate username from name: "Budi Santoso" -> "budisantoso"
            $baseUsername = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $validated['name']));
            $username = $baseUsername;
            $counter = 1;
            while (\App\Models\User::where('username', $username)->exists()) {
                $username = $baseUsername . $counter;
                $counter++;
            }
        }
        $password = $validated['password'] ?? 'password123';

        $authUser = \App\Models\User::create([
            'name' => $validated['name'],
            'username' => $username,
            'password' => \Illuminate\Support\Facades\Hash::make($password),
            'role' => 'teacher',
            'nip' => $validated['nip'],
            'email' => str_contains($username, '@') ? $username : $username . '@smartschool.id',
        ]);

        // Remove password from the data to be saved to the teachers table
        $teacherData = $validated;
        unset($teacherData['password']);
        $teacherData['username'] = $username;

        $teacher = Teacher::create(array_merge($teacherData, [
            'user_id' => Auth::id(),
            'auth_user_id' => $authUser->id
        ]));

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json($teacher, 201);
    }

    public function show(Teacher $teacher)
    {
        if (!Auth::user()->isAdmin() && $teacher->auth_user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($teacher);
    }

    public function update(Request $request, Teacher $teacher)
    {
        if (!Auth::user()->isAdmin() && $teacher->auth_user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'code' => 'nullable|string',
            'name' => 'required|string',
            'nip' => 'nullable|string',
            'username' => 'nullable|string',
            'password' => 'nullable|string',
        ]);

        $teacherData = $validated;
        unset($teacherData['password']);
        $teacher->update($teacherData);

        if (!empty($validated['username'])) {
            if ($teacher->auth_user_id) {
                $authUser = $teacher->authUser;
                $userData = [
                    'name' => $validated['name'],
                    'username' => $validated['username'],
                    'nip' => $validated['nip'],
                ];
                if (!empty($validated['password'])) {
                    $userData['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
                }
                $authUser->update($userData);
            } else {
                $authUser = \App\Models\User::create([
                    'name' => $validated['name'],
                    'username' => $validated['username'],
                    'password' => \Illuminate\Support\Facades\Hash::make($validated['password'] ?? 'password123'),
                    'role' => 'teacher',
                    'nip' => $validated['nip'],
                    'email' => str_contains($validated['username'], '@') ? $validated['username'] : $validated['username'] . '@smartschool.id',
                ]);
                $teacher->update(['auth_user_id' => $authUser->id]);
            }
        }

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json($teacher);
    }

    public function destroy(Teacher $teacher)
    {
        if (!Auth::user()->isAdmin() && $teacher->auth_user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Prevent self-deletion
        if ($teacher->auth_user_id === Auth::id()) {
            return response()->json(['message' => 'You cannot delete your own account'], 403);
        }

        if ($teacher->auth_user_id) {
            \App\Models\User::find($teacher->auth_user_id)?->delete();
        }

        $teacher->delete();

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json(null, 204);
    }

    public function syncAssignments(Request $request, Teacher $teacher)
    {
        if (!Auth::user()->isAdmin() && $teacher->auth_user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'assignments' => 'present|array',
            'assignments.*.subject_id' => 'required|exists:subjects,id',
            'assignments.*.class_ids' => 'required|array',
            'assignments.*.class_ids.*' => 'exists:classes,id',
        ]);

        // Delete existing assignments for this teacher
        $teacher->assignments()->delete();

        // Create new assignments
        foreach ($validated['assignments'] as $assignRow) {
            foreach ($assignRow['class_ids'] as $classId) {
                $teacher->assignments()->create([
                    'subject_id' => $assignRow['subject_id'],
                    'class_id' => $classId
                ]);
            }
        }

        // [CACHE INVALIDATION] Clear monitoring cache for all days
        foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as $day) {
            Cache::forget("monitoring_schedules_{$day}");
        }

        return response()->json([
            'message' => 'Assignments synced successfully', 
            'data' => $teacher->load(['assignments.subject', 'assignments.schoolClass'])
        ]);
    }
}
