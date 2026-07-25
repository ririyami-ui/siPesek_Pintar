<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\User;
use App\Services\StudentDistributionService;
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

        // [BYPASS] If searching, look through ALL students (essential for library/barcode)
        if ($search = request('search')) {
            $students = Student::where(function($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('nis', 'like', "%$search%")
                  ->orWhere('nisn', 'like', "%$search%")
                  ->orWhere('nis', $search)
                  ->orWhere('nisn', $search);
            })->with('class')->limit(10)->get();
            
            return response()->json(['data' => $students]);
        }

        $query = Student::query();
        
        if ($user && $user->role === 'teacher' && !$user->isLibrarian()) {
            // Find teacher record
            $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
            
            if ($teacher) {
                // Get class IDs assigned to teacher
                $classIds = $teacher->assignments()->pluck('class_id')->unique();
                $query->whereIn('class_id', $classIds);
            } else {
                return response()->json(['data' => []]);
            }
        } elseif ($user && !$user->isAdmin() && !$user->isLibrarian()) {
            $query->where('created_by', $user->id);
        }

        if (request()->filled('class_id')) {
            $query->where('class_id', request()->class_id);
        } elseif (request()->filled('rombel')) {
            $query->whereHas('class', function($q) {
                $q->where('rombel', request()->rombel);
            });
        }

        // Add Search Functionality (Support NISN, NIS, and Name)
        if ($search = request('search')) {
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('nis', 'like', "%$search%")
                  ->orWhere('nisn', 'like', "%$search%")
                  ->orWhere('nis', $search) // Exact match for leading zeros
                  ->orWhere('nisn', $search); // Exact match for leading zeros
            });
        }

        $students = $query
            ->select('students.*')
            ->join('classes', 'students.class_id', '=', 'classes.id')
            ->orderBy('classes.rombel')
            ->orderByRaw('CAST(students.absen AS UNSIGNED)')
            ->with('class')
            ->get();
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
            'address' => 'nullable|string',
            'absen' => 'nullable|string',
            'class_id' => 'required|exists:classes,id',
        ]);

        $validatedData['created_by'] = auth()->id();

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

        if ($user && !$user->isAdmin()) {
            if ($user->role === 'teacher') {
                // [FIX] Teachers can view any student in their assigned classes
                $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
                $assignedClassIds = $teacher ? $teacher->assignments()->pluck('class_id')->unique() : collect();
                if (!$assignedClassIds->contains($student->class_id)) {
                    abort(403);
                }
            } else {
                // Other non-admin roles can only see students they created
                if ($student->created_by !== $user->id) {
                    abort(403);
                }
            }
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

        if ($user && !$user->isAdmin()) {
            if ($user->role === 'teacher') {
                // [FIX] Teachers can update students in their assigned classes
                $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
                $assignedClassIds = $teacher ? $teacher->assignments()->pluck('class_id')->unique() : collect();
                if (!$assignedClassIds->contains($student->class_id)) {
                    abort(403);
                }
            } else {
                if ($student->created_by !== $user->id) {
                    abort(403);
                }
            }
        }

        $validatedData = $request->validate([
            'code' => 'nullable|string',
            'nis' => 'nullable|string',
            'nisn' => 'nullable|string',
            'name' => 'required|string|max:255',
            'gender' => 'required|string',
            'birth_place' => 'nullable|string',
            'birth_date' => 'nullable|date',
            'address' => 'nullable|string',
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

        // [FIX] Only admin can delete students — teachers can view/edit but not delete
        if ($user && !$user->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat menghapus data siswa.');
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($student) {
            // 1. Delete linked user account to avoid "Ghost Users"
            if ($student->auth_user_id) {
                User::find($student->auth_user_id)?->delete();
            }

            // 2. Delete the student record (attendances, notes etc will be deleted via DB cascade)
            $student->delete();

            return response()->noContent();
        });
    }

    /**
     * Reset the locked device ID for a student.
     */
    public function resetDevice(Student $student)
    {
        if (!auth()->user()->isAdmin()) {
            abort(403);
        }

        if ($student->auth_user_id) {
            $user = User::find($student->auth_user_id);
            if ($user) {
                $user->device_id = null;
                $user->save();
                return response()->json(['message' => 'Perangkat berhasil direset.']);
            }
        }

        return response()->json(['message' => 'Akun login tidak ditemukan untuk siswa ini.'], 404);
    }

    /**
     * Promote students to a new class or graduate them.
     */
    public function promote(Request $request)
    {
        if (!auth()->user()->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat memproses kenaikan kelas.');
        }

        $validatedData = $request->validate([
            'student_ids' => 'required|array',
            'student_ids.*' => 'exists:students,id',
            'target_class_id' => 'nullable|exists:classes,id',
        ]);

        $studentIds = $validatedData['student_ids'];
        $targetClassId = $validatedData['target_class_id'] ?? null;

        return \Illuminate\Support\Facades\DB::transaction(function () use ($studentIds, $targetClassId) {
            $students = Student::whereIn('id', $studentIds)->get();

            if ($targetClassId) {
                // Promote / Move to new class
                foreach ($students as $student) {
                    $student->update(['class_id' => $targetClassId]);
                }
                // Reset absen sequentially sorted A-Z
                $promoted = Student::where('class_id', $targetClassId)
                    ->whereNull('deleted_at')
                    ->orderBy('name')
                    ->get();
                $no = 1;
                foreach ($promoted as $s) {
                    $s->update(['absen' => $no++]);
                }
                return response()->json(['message' => count($studentIds) . ' siswa berhasil dipindahkan ke kelas baru.']);
            } else {
                // Graduate (Soft Delete)
                $count = 0;
                foreach ($students as $student) {
                    // Soft delete the linked user account to prevent login
                    if ($student->auth_user_id) {
                        User::find($student->auth_user_id)?->delete();
                    }
                    // Soft delete the student
                    $student->delete();
                    $count++;
                }
                return response()->json(['message' => $count . ' siswa berhasil diluluskan dan diarsipkan.']);
            }
        });
    }

    /**
     * Promote students across multiple classes with fair random distribution.
     */
    public function promoteDistribution(Request $request, StudentDistributionService $distService)
    {
        if (!auth()->user()->isAdmin()) {
            abort(403, 'Hanya Admin yang dapat memproses kenaikan kelas.');
        }

        $validatedData = $request->validate([
            'source_class_ids' => 'required|array|min:1',
            'source_class_ids.*' => 'exists:classes,id',
            'target_class_ids' => 'required|array|min:1',
            'target_class_ids.*' => 'exists:classes,id',
            'preview' => 'boolean',
        ]);

        $preview = $validatedData['preview'] ?? true;

        if ($preview) {
            // Preview only - don't persist
            $result = $distService->previewDistribution(
                $validatedData['source_class_ids'],
                $validatedData['target_class_ids']
            );
        } else {
            // Execute and persist
            $result = $distService->executeDistribution(
                $validatedData['source_class_ids'],
                $validatedData['target_class_ids']
            );
        }

        return response()->json($result);
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
