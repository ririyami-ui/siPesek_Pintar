<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AttendanceController extends Controller
{
    /**
     * Get attendance records with filters
     */
    public function index(Request $request)
    {
        $query = Attendance::with(['student', 'class', 'subject']);
        
        // Removed user_id restriction to allow global visibility for the same class/subject

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

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        return response()->json(['data' => $query->orderBy('date', 'desc')->get()]);
    }

    /**
     * Store bulk attendance records
     */
    public function storeBulk(Request $request)
    {
        // [NORMALIZATION] Ensure status is normalized before validation
        if ($request->has('attendances') && is_array($request->attendances)) {
            $attendances = $request->attendances;
            foreach ($attendances as &$item) {
                if (isset($item['status'])) {
                    $status = strtolower($item['status']);
                    if ($status === 'ijin') $status = 'izin';
                    if ($status === 'alpha') $status = 'alpa';
                    $item['status'] = $status;
                }
            }
            $request->merge(['attendances' => $attendances]);
        }

        $validated = $request->validate([
            'date' => 'required|date',
            'class_id' => 'required|exists:classes,id',
            'subject_id' => 'nullable|exists:subjects,id',
            'attendances' => 'required|array',
            'attendances.*.student_id' => 'required|exists:students,id',
            'attendances.*.status' => 'required|in:hadir,sakit,izin,alpa',
            'attendances.*.note' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $records = [];
            foreach ($validated['attendances'] as $item) {
                $records[] = Attendance::updateOrCreate(
                    [
                        'student_id' => $item['student_id'],
                        'date' => $validated['date'],
                        'subject_id' => $validated['subject_id'],
                    ],
                    [
                        'class_id' => $validated['class_id'],
                        'status' => $item['status'],
                        'note' => $item['note'] ?? null,
                        'user_id' => auth()->id(),
                    ]
                );
            }

            DB::commit();
            return response()->json(['message' => 'Attendance recorded successfully', 'data' => $records], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to record attendance'], 500);
        }
    }

    /**
     * Get attendance summary/statistics
     */
    public function summary(Request $request)
    {
        $validated = $request->validate([
            'class_id' => 'required|exists:classes,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date',
        ]);

        $query = Attendance::where('class_id', $validated['class_id'])
            ->whereBetween('date', [$validated['start_date'], $validated['end_date']]);

        $summary = $query->select('student_id', 'status', DB::raw('count(*) as count'))
            ->groupBy('student_id', 'status')
            ->with('student')
            ->get();

        return response()->json($summary);
    }
}
