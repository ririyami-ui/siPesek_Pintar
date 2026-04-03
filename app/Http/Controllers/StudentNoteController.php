<?php

namespace App\Http\Controllers;

use App\Models\StudentNote;
use Illuminate\Http\Request;

class StudentNoteController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = StudentNote::query();
        if (!auth()->user()->isAdmin()) {
            $query->where('user_id', auth()->id());
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }
        if ($request->has('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->has('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }

        return response()->json($query->orderBy('updated_at', 'desc')->get());
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
            'note' => 'required|string',
        ]);

        $note = StudentNote::updateOrCreate(
            [
                'user_id' => auth()->id(),
                'student_id' => $validated['student_id'],
                'semester' => $validated['semester'],
                'academic_year' => $validated['academic_year'],
            ],
            [
                'note' => $validated['note']
            ]
        );

        return response()->json($note, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(StudentNote $studentNote)
    {
        if (!auth()->user()->isAdmin() && $studentNote->user_id !== auth()->id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($studentNote);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(StudentNote $studentNote)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, StudentNote $studentNote)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(StudentNote $studentNote)
    {
        //
    }
}
