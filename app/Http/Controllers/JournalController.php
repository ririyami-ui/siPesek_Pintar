<?php

namespace App\Http\Controllers;

use App\Models\Journal;
use Illuminate\Http\Request;

class JournalController extends Controller
{
    /**
     * Display a listing of journals
     */
    public function index(Request $request)
    {
        $query = Journal::with(['class', 'subject', 'schedule', 'teacher']);
        
        if (!auth()->user()->isAdmin()) {
            $query->where('user_id', auth()->id());
        }

        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        if ($request->has('date_start') && $request->has('date_end')) {
            $query->whereBetween('date', [$request->date_start, $request->date_end]);
        } elseif ($request->has('date')) {
            $query->whereDate('date', $request->date);
        }

        return response()->json(['data' => $query->orderBy('date', 'desc')->get()]);
    }

    /**
     * Store a newly created journal
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'schedule_id' => 'nullable|exists:schedules,id',
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'required|exists:subjects,id',
            'date' => 'required|date',
            'topic' => 'required|string',
            'learning_objectives' => 'nullable|string',
            'learning_activities' => 'nullable|string',
            'reflection' => 'nullable|string',
            'status' => 'nullable|string',
            'follow_up' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_assignment' => 'boolean',
            'user_id' => 'nullable|exists:users,id',
        ]);

        if (!auth()->user()->isAdmin() || !isset($validated['user_id'])) {
            $validated['user_id'] = auth()->id();
        }

        $validated['is_assignment'] = $validated['is_assignment'] ?? false;
        $date = \Carbon\Carbon::parse($validated['date'])->format('Y-m-d');
        $validated['date'] = $date;

        // [FEATURE] Prevent journal entry on School Agenda / Holidays
        $holiday = \App\Models\Holiday::where(function($q) use ($date) {
            $q->where('date', $date)
              ->orWhere(function($sub) use ($date) {
                  $sub->where('start_date', '<=', $date)
                      ->where('end_date', '>=', $date);
              });
        })->first();

        if ($holiday && !auth()->user()->isAdmin()) {
            // Check if it's a blocking holiday (exclude minor ones if needed, but per user request, assume all agendas)
            return response()->json([
                'message' => "Jurnal tidak aktif: Hari ini adalah agenda sekolah ({$holiday->name}). Anda tidak perlu mengisi jurnal mengajar rutin."
            ], 422);
        }

        $journal = Journal::create($validated);

        return response()->json($journal->load(['class', 'subject']), 201);
    }

    /**
     * Display the specified journal
     */
    public function show(Journal $journal)
    {
        if (!auth()->user()->isAdmin() && $journal->user_id !== auth()->id()) {
            abort(403);
        }

        return response()->json($journal->load(['class', 'subject', 'schedule']));
    }

    /**
     * Update the specified journal
     */
    public function update(Request $request, Journal $journal)
    {
        if (!auth()->user()->isAdmin() && $journal->user_id !== auth()->id()) {
            abort(403);
        }

        $validated = $request->validate([
            'date' => 'sometimes|required|date',
            'topic' => 'sometimes|required|string',
            'learning_objectives' => 'nullable|string',
            'learning_activities' => 'nullable|string',
            'reflection' => 'nullable|string',
            'status' => 'nullable|string',
            'follow_up' => 'nullable|string',
            'notes' => 'nullable|string',
            'is_assignment' => 'boolean',
        ]);

        if (isset($validated['date'])) {
            $validated['date'] = \Carbon\Carbon::parse($validated['date'])->format('Y-m-d');
        }

        $journal->update($validated);

        return response()->json($journal->load(['class', 'subject']));
    }

    /**
     * Remove the specified journal
     */
    public function destroy(Journal $journal)
    {
        if (!auth()->user()->isAdmin() && $journal->user_id !== auth()->id()) {
            abort(403);
        }

        $journal->delete();

        return response()->noContent();
    }
}
