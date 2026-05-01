<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

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

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
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

        $date = \Carbon\Carbon::parse($validated['date'])->format('Y-m-d');
        
        // [FEATURE] Prevent attendance entry on School Agenda / Holidays
        $holiday = \App\Models\Holiday::where(function($q) use ($date) {
            $q->where('date', $date)
              ->orWhere(function($sub) use ($date) {
                  $sub->where('start_date', '<=', $date)
                      ->where('end_date', '>=', $date);
              });
        })->first();

        if ($holiday && !auth()->user()->isAdmin()) {
            return response()->json([
                'message' => "Absensi tidak aktif: Hari ini adalah agenda sekolah ({$holiday->name})."
            ], 422);
        }

        DB::beginTransaction();
        try {
            $user = auth()->user();
            $records = [];
            
            foreach ($validated['attendances'] as $item) {
                // Get old value for auditing
                $existing = Attendance::where([
                    'student_id' => $item['student_id'],
                    'date'       => $validated['date'],
                    'subject_id' => $validated['subject_id'],
                ])->first();

                $oldStatus = $existing ? $existing->status : null;

                $record = Attendance::updateOrCreate(
                    [
                        'student_id' => $item['student_id'],
                        'date'       => $validated['date'],
                        'subject_id' => $validated['subject_id'],
                    ],
                    [
                        'class_id' => $validated['class_id'],
                        'status'   => $item['status'],
                        'note'     => $item['note'] ?? null,
                        'user_id'  => $user->id,
                    ]
                );

                // Audit logging
                if (!$existing) {
                    \App\Services\AuditService::log($record, 'create', null, $record->toArray());
                } elseif ($oldStatus != $item['status']) {
                    \App\Services\AuditService::log($record, 'update', ['status' => $oldStatus], ['status' => $item['status']]);
                }

                $records[] = $record;
            }

            DB::commit();

            // Send Push Notifications to Parents
            $subjectName = 'Pelajaran';
            if (!empty($validated['subject_id'])) {
                $subject = \App\Models\Subject::find($validated['subject_id']);
                if ($subject) {
                    $subjectName = $subject->name;
                }
            }

            $statusMap = ['hadir' => 'Hadir', 'sakit' => 'Sakit', 'izin' => 'Izin', 'alpa' => 'Alpa / Tanpa Keterangan'];
            foreach ($validated['attendances'] as $item) {
                $statusLabel = $statusMap[$item['status']] ?? $item['status'];
                $title = "Update Absensi: {$statusLabel}";
                $body = "Status kehadiran ananda pada mata pelajaran {$subjectName} telah tercatat sebagai {$statusLabel}.";
                \App\Services\PushNotificationService::sendToStudentParent($item['student_id'], $title, $body, '/siswa/kehadiran');
            }
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

    /**
     * Get missing attendance schedules for past days
     */
    public function missing(Request $request)
    {
        $daysToLookBack = $request->query('days', 7);
        $user = auth()->user();
        $isAdmin = ($user->role === 'admin' || $user->role === 'adminer');
        
        $dayMapping = [
            'Sunday' => 'Minggu',
            'Monday' => 'Senin',
            'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday' => 'Kamis',
            'Friday' => 'Jumat',
            'Saturday' => 'Sabtu',
        ];

        $missing = [];
        $today = Carbon::today();

        for ($i = 1; $i <= $daysToLookBack; $i++) {
            $date = $today->copy()->subDays($i);
            $dayName = $dayMapping[$date->format('l')];
            
            // Skip weekends if not specified otherwise
            if ($dayName === 'Minggu' || $dayName === 'Sabtu') continue;

            $todayDateFormatted = $date->format('Y-m-d');

            // [FIX] Skip checking if this date was a Holiday or School Agenda
            $isHoliday = \App\Models\Holiday::where(function($query) use ($todayDateFormatted) {
                $query->where('date', $todayDateFormatted)
                      ->orWhere(function($q) use ($todayDateFormatted) {
                          $q->where('start_date', '<=', $todayDateFormatted)
                            ->where('end_date', '>=', $todayDateFormatted);
                      });
            })->exists();

            if ($isHoliday) continue;

            $schedules = \App\Models\Schedule::where('day', $dayName)
                ->where('type', 'teaching')
                ->where(function($q) use ($date) {
                    $todayDate = $date->format('Y-m-d');
                    // [UNIFIED LOGIC] Match if NO dates are set (assume always active for that day)
                    // OR if that date is within the set date range
                    $q->where(function($sub) {
                        $sub->whereNull('start_date')->whereNull('end_date');
                    })
                    ->orWhere(function($sub) use ($todayDate) {
                        $sub->where('start_date', '<=', $todayDate)
                            ->where(function($dateRange) use ($todayDate) {
                                $dateRange->where('end_date', '>=', $todayDate)
                                          ->orWhereNull('end_date');
                            });
                    });
                })
                ->with(['class', 'subject', 'teacher']);

            if (!$isAdmin) {
                // If not admin, only show schedules assigned to this teacher
                $schedules->where('teacher_id', $user->id);
            }

            $daySchedules = $schedules->get();

            foreach ($daySchedules as $sch) {
                // Check if attendance exists for this date, class, and subject
                $exists = Attendance::where([
                    'date' => $date->format('Y-m-d'),
                    'class_id' => $sch->class_id,
                    'subject_id' => $sch->subject_id
                ])->exists();

                if (!$exists) {
                    $missing[] = [
                        'date' => $date->format('Y-m-d'),
                        'day' => $dayName,
                        'class_id' => $sch->class_id,
                        'rombel' => $sch->class->rombel ?? '-',
                        'subject_id' => $sch->subject_id,
                        'subject_name' => $sch->subject->name ?? '-',
                        'teacher_name' => $sch->teacher->name ?? '-',
                        'teacher_id' => $sch->teacher_id,
                        'time' => Carbon::parse($sch->start_time)->format('H:i') . ' - ' . Carbon::parse($sch->end_time)->format('H:i'),
                    ];
                }
            }
        }

        return response()->json(['data' => $missing]);
    }

    public function resetMissing(Request $request)
    {
        $user = $request->user();
        // [FIX] Use isAdmin() to recognize both 'admin' and 'adminer' roles consistently
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'password' => 'required|string'
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Password salah. Reset dibatalkan demi keamanan.'], 403);
        }

        try {
            // Set all active schedules' start_date to today so they don't look backwards
            \App\Models\Schedule::where('type', 'teaching')
                ->where(function($q) {
                    $q->whereNull('start_date')
                      ->orWhere('start_date', '<', \Carbon\Carbon::today()->format('Y-m-d'));
                })
                ->update(['start_date' => \Carbon\Carbon::today()->format('Y-m-d')]);

            return response()->json(['message' => 'Riwayat absensi terlewat berhasil dibersihkan dan siklus disetel ulang ke hari ini.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mereset: ' . $e->getMessage()], 500);
        }
    }
}
