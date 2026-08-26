<?php

namespace App\Http\Controllers;

use App\Models\Student;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Cache; // Import Cache Facade
use Illuminate\Support\Str; // Import Str Facade

class AppInstallationController extends Controller
{
    public function index(Request $request)
    {
        $query = Student::query()
            ->with(['user', 'class'])
            ->join('users', 'students.auth_user_id', '=', 'users.id')
            ->select('students.*', 'users.device_id', 'users.push_subscription');

        // Apply filters
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('students.name', 'like', "%{$search}%")
                    ->orWhere('students.nisn', 'like', "%{$search}%")
                    ->orWhere('users.email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('class_id')) {
            $query->where('students.class_id', $request->input('class_id'));
        }

        if ($request->filled('installation_status')) {
            if ($request->input('installation_status') === 'installed') {
                $query->whereNotNull('users.device_id');
            } elseif ($request->input('installation_status') === 'not_installed') {
                $query->whereNull('users.device_id');
            }
        }
        
        if ($request->filled('push_status')) {
            if ($request->input('push_status') === 'active') {
                $query->whereNotNull('users.push_subscription');
            } elseif ($request->input('push_status') === 'inactive') {
                $query->whereNull('users.push_subscription');
            }
        }

        $students = $query->paginate($request->input('per_page', 15));

        // Global stats
        $totalStudents = Student::count();
        $installedCount = User::whereNotNull('device_id')->where('role', 'student')->count();
        $notInstalledCount = User::whereNull('device_id')->where('role', 'student')->count();
        $pushActiveCount = User::whereNotNull('push_subscription')->where('role', 'student')->count();

        return response()->json([
            'stats' => [
                'total_students' => $totalStudents,
                'installed_count' => $installedCount,
                'not_installed_count' => $notInstalledCount,
                'push_active_count' => $pushActiveCount,
            ],
            'students' => $students->through(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'nisn' => $student->nisn,
                    'class' => $student->class ? $student->class->rombel : null,
                    'device_id' => $student->device_id,
                    'push_subscription' => $student->push_subscription ? true : false, // Return boolean for simpler UI
                    'installation_status' => $student->device_id ? 'installed' : 'not_installed',
                    'push_status' => $student->push_subscription ? 'active' : 'inactive',
                ];
            })->toArray(), // Corrected closing and added toArray()
        ]);
    }

    public function generatePdfTicket(Request $request)
    {
        // Validate and store current filters in cache with a ticket
        $validated = $request->validate([
            'search' => 'nullable|string',
            'class_id' => 'nullable|exists:classes,id',
            'installation_status' => 'nullable|in:installed,not_installed',
            'push_status' => 'nullable|in:active,inactive',
        ]);

        $ticket = Str::random(64);
        Cache::put('pdf_export_ticket_' . $ticket, [
            'filters' => $validated,
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ], now()->addMinutes(5)); // Ticket valid for 5 minutes

        return response()->json(['ticket' => $ticket]);
    }

    public function exportPdf(Request $request)
    {
        $ticket = $request->query('ticket');
        if (!$ticket) {
            abort(403, 'Tiket ekspor PDF tidak ditemukan.');
        }

        $cacheKey = 'pdf_export_ticket_' . $ticket;
        $ticketData = Cache::get($cacheKey);

        if (!$ticketData || !isset($ticketData['filters'])) {
            abort(404, 'Tiket ekspor PDF sudah kedaluwarsa atau tidak valid.');
        }

        if (($ticketData['ip'] ?? null) !== $request->ip() || ($ticketData['user_agent'] ?? null) !== $request->userAgent()) {
            Cache::forget($cacheKey);
            abort(403, 'Tiket ekspor PDF tidak valid untuk perangkat ini.');
        }

        $filters = $ticketData['filters'];

        // Remove ticket after use (one-time use)
        Cache::forget($cacheKey);

        // Get all students matching the filters, without pagination
        $query = Student::query()
            ->with(['user', 'class'])
            ->join('users', 'students.auth_user_id', '=', 'users.id')
            ->select('students.*', 'users.device_id', 'users.push_subscription');

        // Apply filters from ticket
        if (isset($filters['search']) && !empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('students.name', 'like', "%{$search}%")
                    ->orWhere('students.nisn', 'like', "%{$search}%")
                    ->orWhere('users.email', 'like', "%{$search}%");
            });
        }

        if (isset($filters['class_id']) && !empty($filters['class_id'])) {
            $query->where('students.class_id', $filters['class_id']);
        }

        if (isset($filters['installation_status']) && !empty($filters['installation_status'])) {
            if ($filters['installation_status'] === 'installed') {
                $query->whereNotNull('users.device_id');
            } elseif ($filters['installation_status'] === 'not_installed') {
                $query->whereNull('users.device_id');
            }
        }
        
        if (isset($filters['push_status']) && !empty($filters['push_status'])) {
            if ($filters['push_status'] === 'active') {
                $query->whereNotNull('users.push_subscription');
            } elseif ($filters['push_status'] === 'inactive') {
                $query->whereNull('users.push_subscription');
            }
        }
        
        $students = $query->get()->map(function ($student) {
            return [
                'id' => $student->id,
                'name' => $student->name,
                'nisn' => $student->nisn,
                'class' => $student->class ? $student->class->rombel : null,
                'device_id' => $student->device_id,
                'push_subscription' => $student->push_subscription ? true : false,
                'installation_status' => $student->device_id ? 'installed' : 'not_installed',
                'push_status' => $student->push_subscription ? 'active' : 'inactive',
            ];
        });

        try {
            $pdf = Pdf::loadView('reports.app_installations', ['students' => $students]);
            return $pdf->download('rekap_instalasi_aplikasi.pdf');
        } catch (\Throwable $e) {
            \Log::error('PDF Generation Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'filters' => $filters,
                'ticket' => $ticket,
            ]);
            abort(500, 'Gagal membuat PDF: Terjadi kesalahan internal. Mohon laporkan ke administrator. Detail error di log.');
        }
    }
    public function resetDevice(Student $student)
    {
        if (!auth()->user()->isAdmin()) {
            abort(403);
        }

        if ($student->auth_user_id) {
            $user = User::find($student->auth_user_id);
            if ($user) {
                $user->device_id = null;
                $user->push_subscription = null; // Also reset push subscription
                $user->save();
                return response()->json(['message' => 'Perangkat dan langganan push berhasil direset.']);
            }
        }

        return response()->json(['message' => 'Akun login tidak ditemukan untuk siswa ini.'], 404);
    }
}
