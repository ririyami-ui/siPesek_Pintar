<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Response;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class DatabaseManagementController extends Controller
{
    /**
     * Verify user password before destructive actions
     */
    private function verifyPassword($password)
    {
        if (!$password) return false;
        return Hash::check($password, auth()->user()->password);
    }

    protected $tablesToManage = [
        'admins',
        'teachers',
        'students',
        'classes',
        'schedules',
        'subjects',
        'attendances',
        'journals',
        'grades',
        'infractions',
        'infraction_types',
        'teaching_programs',
        'student_tasks',
        'class_agreements',
        'holidays',
        'lesson_plans',
        'quizzes',
        'handouts',
        'worksheets',
        'kktp_assessments',
        'student_notes',
        'teacher_assignments',
        'user_profiles',
        'users',
        'personal_access_tokens'
    ];

    public function getTables()
    {
        $tables = [];
        foreach ($this->tablesToManage as $tableName) {
            if (Schema::hasTable($tableName)) {
                $count = DB::table($tableName)->count();
                $tables[] = [
                    'name' => $tableName,
                    'count' => $count,
                    'label' => $this->getTableLabel($tableName)
                ];
            }
        }

        return response()->json(['data' => $tables]);
    }

    public function truncateTable(Request $request)
    {
        $request->validate([
            'table' => 'required|string',
            'password' => 'required|string'
        ]);

        if (!$this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        $tableName = $request->table;

        if (!in_array($tableName, $this->tablesToManage)) {
            return response()->json(['message' => 'Tabel tidak diizinkan untuk dikosongkan.'], 403);
        }

        try {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            DB::table($tableName)->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            return response()->json(['message' => "Tabel {$tableName} berhasil dikosongkan."]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengosongkan tabel: ' . $e->getMessage()], 500);
        }
    }

    public function backupDatabase()
    {
        // Increase limits for processing large databases
        ini_set('memory_limit', '512M');
        set_time_limit(600); // 10 minutes

        $filename = "backup-smart-school-" . Carbon::now()->format('Y-m-d-H-i-s') . ".sql";
        $directory = storage_path('app/backups');
        
        if (!file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        $path = $directory . '/' . $filename;
        $handle = fopen($path, 'w');
        
        if (!$handle) {
            return response()->json(['message' => 'Gagal membuat file backup di server.'], 500);
        }

        try {
            fwrite($handle, "-- Smart School Manager Database Backup\n");
            fwrite($handle, "-- Date: " . Carbon::now()->toDateTimeString() . "\n\n");
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($this->tablesToManage as $table) {
                if (!Schema::hasTable($table)) continue;

                fwrite($handle, "-- Table: {$table}\n");
                fwrite($handle, "TRUNCATE TABLE `{$table}`;\n");

                // Use chunking to process rows efficiently
                DB::table($table)->orderBy('id')->chunk(500, function($rows) use ($handle, $table) {
                    foreach ($rows as $row) {
                        $rowArray = (array)$row;
                        $columns = implode("`, `", array_keys($rowArray));
                        $values = array_map(function($value) {
                            if (is_null($value)) return "NULL";
                            return "'" . addslashes($value) . "'";
                        }, array_values($rowArray));
                        $valuesList = implode(", ", $values);
                        
                        fwrite($handle, "INSERT INTO `{$table}` (`{$columns}`) VALUES ({$valuesList});\n");
                    }
                });
                
                fwrite($handle, "\n");
            }

            fwrite($handle, "SET FOREIGN_KEY_CHECKS=1;");
            fclose($handle);

            // Generate a secure one-time ticket for the download
            $ticket = Str::random(64);
            Cache::put('backup_ticket_' . $ticket, $path, now()->addMinutes(5));

            return response()->json([
                'ticket' => $ticket,
                'filename' => $filename
            ]);

        } catch (\Exception $e) {
            if ($handle) fclose($handle);
            if (file_exists($path)) unlink($path);
            return response()->json(['message' => 'Error saat membuat backup: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Publicly accessible but secure download via ticket
     */
    public function downloadBackup(Request $request)
    {
        $ticket = $request->query('ticket');
        
        if (!$ticket) {
            abort(403, 'Ticket backup tidak ditemukan.');
        }

        $cacheKey = 'backup_ticket_' . $ticket;
        $path = Cache::get($cacheKey);

        if (!$path || !file_exists($path)) {
            abort(404, 'File backup sudah kedaluwarsa atau tidak ditemukan.');
        }

        // Remove ticket after use (one-time use)
        Cache::forget($cacheKey);

        $filename = basename($path);

        return response()->download($path, $filename, [
            'Content-Type' => 'application/octet-stream',
        ])->deleteFileAfterSend();
    }

    public function restoreDatabase(Request $request)
    {
        $request->validate([
            'backup_file' => 'required|file',
            'password' => 'required|string'
        ]);

        if (!$this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        // Increase limits for large SQL files
        ini_set('memory_limit', '512M');
        set_time_limit(300);

        $file = $request->file('backup_file');
        $sql = file_get_contents($file->getRealPath());

        if (!$sql) {
            return response()->json(['message' => 'File kosong atau tidak valid.'], 400);
        }

        try {
            DB::beginTransaction();
            
            // 1. Get existing PDO connection (safe for shared hosting)
            $pdo = DB::getPdo();
            
            // 2. Disable foreign key checks
            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

            // 3. Simple and robust execution of the full SQL file
            // DB::unprepared is ideal for raw SQL that might contain multiple statements
            DB::unprepared($sql);

            // 4. Re-enable foreign key checks
            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");

            DB::commit();

            return response()->json(['message' => 'Database berhasil dipulihkan dari file cadangan.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal memulihkan database: ' . $e->getMessage()], 500);
        }
    }

    public function wipeDatabase(Request $request)
    {
        $request->validate([
            'password' => 'required|string'
        ]);

        if (!$this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        try {
            ini_set('memory_limit', '256M');
            
            DB::beginTransaction();
            
            DB::statement("SET FOREIGN_KEY_CHECKS=0;");

            foreach ($this->tablesToManage as $table) {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                }
            }

            DB::statement("SET FOREIGN_KEY_CHECKS=1;");
            
            DB::commit();

            return response()->json(['message' => 'Seluruh data aplikasi berhasil dihapus.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menghapus data: ' . $e->getMessage()], 500);
        }
    }

    public function cleanSystemLogs(Request $request)
    {
        $request->validate([
            'password' => 'required|string'
        ]);

        if (!$this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        try {
            // 1. Clear laravel.log
            $logPath = storage_path('logs/laravel.log');
            if (file_exists($logPath)) {
                file_put_contents($logPath, '');
            }

            // 2. Prune expired Sanctum tokens
            DB::table('personal_access_tokens')
                ->where('expires_at', '<', now())
                ->delete();
            
            // 3. Clear application cache & views
            \Illuminate\Support\Facades\Artisan::call('cache:clear');
            \Illuminate\Support\Facades\Artisan::call('view:clear');

            return response()->json(['message' => 'Log sistem berhasil dibersihkan dan sistem telah dioptimasi.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal membersihkan log: ' . $e->getMessage()], 500);
        }
    }

    private function getTableLabel($table)
    {
        $labels = [
            'admins' => 'Data Admin',
            'teachers' => 'Data Guru',
            'students' => 'Data Siswa',
            'classes' => 'Data Kelas',
            'schedules' => 'Jadwal Mengajar',
            'subjects' => 'Mata Pelajaran',
            'attendances' => 'Presensi Siswa',
            'journals' => 'Jurnal Mengajar',
            'grades' => 'Data Nilai',
            'infractions' => 'Pelanggaran Siswa',
            'infraction_types' => 'Jenis Pelanggaran',
            'teaching_programs' => 'Program Mengajar (PROMES)',
            'student_tasks' => 'Penugasan Siswa',
            'class_agreements' => 'Kesepakatan Kelas',
            'holidays' => 'Agenda & Libur',
            'lesson_plans' => 'Riwayat RPP AI',
            'quizzes' => 'Kuis AI',
            'handouts' => 'Bahan Ajar',
            'worksheets' => 'Riwayat LKPD',
            'kktp_assessments' => 'Penilaian KKTP Digital',
            'student_notes' => 'Catatan Siswa',
            'teacher_assignments' => 'Penugasan Guru',
            'user_profiles' => 'Profil Pengguna',
            'users' => 'Akun Pengguna',
            'personal_access_tokens' => 'Token Sesi Login'
        ];

        return $labels[$table] ?? $table;
    }
}
