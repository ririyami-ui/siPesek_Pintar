<?php

namespace App\Http\Controllers;

use App\Models\Infraction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class InfractionController extends Controller
{
    public function index(Request $request)
    {
        $query = Infraction::query()->with(['student']);
        
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->student_id);
        }
        if ($request->filled('semester')) {
            $query->where('semester', $request->semester);
        }
        if ($request->filled('academic_year')) {
            $query->where('academic_year', $request->academic_year);
        }
        if ($request->filled('class_id')) {
            $query->whereHas('student', function($q) use ($request) {
                $q->where('class_id', $request->class_id);
            });
        }
        if ($request->has('date_start') && $request->has('date_end')) {
            $query->whereBetween('date', [$request->date_start, $request->date_end]);
        }
        $infractions = $query->orderBy('date', 'desc')->get();
        return response()->json($infractions);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'student_id' => 'required|exists:students,id',
            'date' => 'required|date',
            'points' => 'required|integer',
            'description' => 'nullable|string',
            'category' => 'nullable|string',
            'semester' => 'required|string',
            'academic_year' => 'required|string',
        ]);

        $infraction = Infraction::create([
            'user_id' => Auth::id(),
            ...$validated
        ]);

        return response()->json($infraction, 201);
    }

    public function update(Request $request, Infraction $infraction)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin() && $infraction->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'student_id' => 'sometimes|required|exists:students,id',
            'date' => 'sometimes|required|date',
            'points' => 'sometimes|required|integer',
            'description' => 'nullable|string',
            'category' => 'nullable|string',
            'semester' => 'sometimes|required|string',
            'academic_year' => 'sometimes|required|string',
        ]);

        $infraction->update($validated);
        return response()->json($infraction);
    }

    public function destroy(Infraction $infraction)
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin() && $infraction->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $infraction->delete();
        return response()->json(null, 204);
    }
}
