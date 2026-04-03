<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class HolidayController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Holiday::query();
        
        if ($user->role === 'teacher') {
            $query->where(function($q) use ($user) {
                // Teachers see their own holidays
                $q->where('user_id', $user->id)
                  // OR holidays created by admins (system-wide)
                  ->orWhereHas('user', function($subQ) {
                      $subQ->whereIn('role', ['admin', 'adminer']);
                  });
            });
        } elseif (!$user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        $holidays = $query->orderBy('date', 'asc')
            ->orderBy('start_date', 'asc')
            ->get();
        return response()->json(['data' => $holidays]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'name' => 'nullable|string',
            'date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'type' => 'nullable|string',
            'category' => 'nullable|string',
            'description' => 'nullable|string',
            'is_holiday' => 'boolean'
        ]);

        $holiday = Holiday::create([
            'user_id' => Auth::id(),
            ...$validated
        ]);

        return response()->json(['data' => $holiday], 201);
    }

    public function update(Request $request, Holiday $holiday)
    {
        if (!Auth::user()->isAdmin() && $holiday->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|required|string',
            'name' => 'nullable|string',
            'date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'type' => 'nullable|string',
            'category' => 'nullable|string',
            'description' => 'nullable|string',
            'is_holiday' => 'boolean'
        ]);

        $holiday->update($validated);
        return response()->json(['data' => $holiday]);
    }

    public function destroy(Holiday $holiday)
    {
        if (!Auth::user()->isAdmin() && $holiday->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $holiday->delete();
        return response()->json(null, 204);
    }
}
