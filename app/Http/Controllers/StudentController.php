<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class StudentController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        $query = Student::query();
        
        if ($user && $user->role === 'teacher') {
            // Find teacher record
            $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
            
            if ($teacher) {
                // Get class IDs assigned to teacher
                $classIds = $teacher->assignments()->pluck('class_id')->unique();
                $query->whereIn('class_id', $classIds);
            } else {
                return response()->json(['data' => []]);
            }
        } elseif ($user && !$user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        if (request()->has('class_id')) {
            $query->where('class_id', request()->class_id);
        } elseif (request()->has('rombel')) {
            $query->where('class_id', request()->rombel);
        }

        $students = $query->with('class')->get();
        return response()->json(['data' => $students]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'code' => 'nullable|string',
            'nis' => 'nullable|string',
            'nisn' => 'nullable|string',
            'name' => 'required|string|max:255',
            'gender' => 'required|string',
            'birth_place' => 'nullable|string',
            'birth_date' => 'nullable|date',
            'absen' => 'nullable|string',
            'class_id' => 'required|exists:classes,id',
        ]);

        $validatedData['user_id'] = auth()->id();

        if (!empty($validatedData['nis'])) {
            $request->validate(['nis' => 'unique:students,nis']);
        }
        if (!empty($validatedData['nisn'])) {
            $request->validate(['nisn' => 'unique:students,nisn']);
        }

        $student = Student::create($validatedData);

        // Auto-provision a student login account (username=nisn, password=nis)
        $this->syncStudentUser($student);

        return response()->json(['data' => $student->load('class')], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Student $student)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if ($user && !$user->isAdmin() && $student->user_id !== $user->id) {
            abort(403);
        }
        return response()->json(['data' => $student->load('class')]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Student $student)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if ($user && !$user->isAdmin() && $student->user_id !== $user->id) {
            abort(403);
        }

        $validatedData = $request->validate([
            'code' => 'nullable|string',
            'nis' => 'nullable|string',
            'nisn' => 'nullable|string',
            'name' => 'required|string|max:255',
            'gender' => 'required|string',
            'birth_place' => 'nullable|string',
            'birth_date' => 'nullable|date',
            'absen' => 'nullable|string',
            'class_id' => 'required|exists:classes,id',
        ]);

        if (!empty($validatedData['nis']) && $validatedData['nis'] !== $student->nis) {
            $request->validate(['nis' => 'unique:students,nis']);
        }
        if (!empty($validatedData['nisn']) && $validatedData['nisn'] !== $student->nisn) {
            $request->validate(['nisn' => 'unique:students,nisn']);
        }

        $student->update($validatedData);

        // Re-sync user account in case nisn/nis changed
        $this->syncStudentUser($student);

        return response()->json(['data' => $student->load('class')]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Student $student)
    {
        /** @var \App\Models\User $user */
        $user = auth()->user();
        
        if ($user && !$user->isAdmin() && $student->user_id !== $user->id) {
            abort(403);
        }

        $student->delete();

        return response()->noContent();
    }

    /**
     * Create or update the User account that parents use to log in.
     * Username = NISN, Password = NIS
     */
    private function syncStudentUser(Student $student): void
    {
        $nisn = $student->nisn;
        $nis  = $student->nis;

        // Only provision if both NISN and NIS exist
        if (!$nisn || !$nis) {
            return;
        }

        // Use existing linked user or find by username
        $authUser = $student->auth_user_id
            ? User::find($student->auth_user_id)
            : User::where('username', $nisn)->where('role', 'student')->first();

        if ($authUser) {
            // Update credentials if nisn/nis changed
            $authUser->update([
                'name'     => $student->name,
                'username' => $nisn,
                'password' => Hash::make($nis),
            ]);
        } else {
            // Create a brand-new student user account
            $authUser = User::create([
                'name'     => $student->name,
                'email'    => $nisn . '@siswa.sipesekpintar.id',
                'username' => $nisn,
                'password' => Hash::make($nis),
                'role'     => 'student',
                'status'   => 'active',
            ]);
        }

        // Link auth_user_id back to the student record
        if ($student->auth_user_id !== $authUser->id) {
            $student->updateQuietly(['auth_user_id' => $authUser->id]);
        }
    }
}
