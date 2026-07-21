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

        // Filter otomatis berdasarkan semester + tahun ajaran
        if ($request->has('semester') && $request->has('academic_year')) {
            $years = explode('/', $request->academic_year);
            $year1 = $years[0] ?? date('Y');
            $year2 = $years[1] ?? (int)$year1 + 1;

            if ($request->semester === 'Ganjil') {
                $query->whereBetween('date', ["{$year1}-07-01", "{$year1}-12-31"]);
            } else {
                $query->whereBetween('date', ["{$year2}-01-01", "{$year2}-06-30"]);
            }
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

        // [SECURITY] Ensure non-admin teachers can only create journals for classes they teach
        $user = auth()->user();
        if (!$user->isAdmin()) {
            $teacher = \App\Models\Teacher::where('auth_user_id', $user->id)->first();
            if (!$teacher) {
                return response()->json([
                    'message' => 'Data guru tidak ditemukan. Hubungi admin untuk verifikasi.'
                ], 403);
            }

            // Check if teacher is assigned to this class and subject
            $isAssigned = \App\Models\TeacherAssignment::where('teacher_id', $teacher->id)
                ->where('class_id', $validated['class_id'])
                ->where('subject_id', $validated['subject_id'])
                ->exists();

            if (!$isAssigned) {
                return response()->json([
                    'message' => 'Anda tidak memiliki akses untuk mengisi jurnal untuk kelas/mata pelajaran ini.'
                ], 403);
            }
        }

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
        return response()->json(['debug' => ['user_id' => auth()->id(), 'journal_id' => $journal->id, 'journal_user_id' => $journal->user_id, 'is_admin' => auth()->user()->isAdmin()]]);
    }

    /**
     * Update the specified journal
     */
    public function update(Request $request, Journal $journal)
    {
        return response()->json(['debug' => ['user_id' => auth()->id(), 'journal_id' => $journal->id, 'journal_user_id' => $journal->user_id]]);
    }

    /**
     * Remove the specified journal
     */
    public function destroy(Journal $journal)
    {
        return response()->json(['debug' => ['user_id' => auth()->id(), 'journal_id' => $journal->id, 'journal_user_id' => $journal->user_id]]);
    }
}
