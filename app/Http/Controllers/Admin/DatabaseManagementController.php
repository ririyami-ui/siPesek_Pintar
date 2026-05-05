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
        'migrations',
        'audit_logs',
        'admins',
        'teachers',
        'students',
        'books',
        'library_loans',
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
        'personal_access_tokens',
        'password_reset_tokens'
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

                // Get CREATE TABLE statement for portability
                try {
                    $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
                    $createTableSql = ((array)$createTable[0])['Create Table'] ?? ((array)$createTable[0])['Table'];
                    
                    fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
                    fwrite($handle, $createTableSql . ";\n\n");
                } catch (\Exception $e) {
                    // Fallback to TRUNCATE if SHOW CREATE TABLE fails
                    fwrite($handle, "TRUNCATE TABLE `{$table}`;\n");
                }

                // Use chunking to process rows efficiently for tables with 'id', 
                // otherwise get all (safe for small systemic tables like migrations or tokens)
                $processRows = function($rows) use ($handle, $table) {
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
                };

                if (Schema::hasColumn($table, 'id')) {
                    DB::table($table)->orderBy('id')->chunk(500, $processRows);
                } else {
                    $processRows(DB::table($table)->get());
                }
                
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

        // Increase limits significantly for production hosting
        ini_set('memory_limit', '1024M');
        set_time_limit(900); // 15 minutes

        $file = $request->file('backup_file');
        $path = $file->getRealPath();

        try {
            // 1. Get PDO connection
            $pdo = DB::getPdo();
            
            // 2. Disable foreign key checks
            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

            // 3. Read and execute SQL in chunks/blocks if possible
            // For most SQL files, unprepared() is fine if memory is sufficient, 
            // but we'll wrap it in a more robust error catcher.
            $sql = file_get_contents($path);
            
            if (empty($sql)) {
                throw new \Exception("File backup kosong atau tidak dapat dibaca.");
            }

            // Remove any DEFINER statements that often cause issues on shared hosting
            // This replaces DEFINER=`anything`@`anything` with empty string
            $sql = preg_replace('/DEFINER\s*=\s*`[^`]+`@`[^`]+`/', '', $sql);
            $sql = preg_replace('/DEFINER\s*=\s*[^\s@]+@[^\s@]+/', '', $sql);

            DB::unprepared($sql);

            // 4. Re-enable foreign key checks
            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");

            // 5. Clear application cache to reflect new data
            Cache::flush();
            \Illuminate\Support\Facades\Artisan::call('cache:clear');

            return response()->json([
                'message' => 'Database berhasil dipulihkan dan cache telah dibersihkan.'
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Database Restore Failed: ' . $e->getMessage());
            \Illuminate\Support\Facades\Log::error($e->getTraceAsString());
            
            return response()->json([
                'message' => 'Gagal memulihkan database: ' . $e->getMessage() . '. Cek log untuk detail teknis.'
            ], 500);
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
            'migrations' => 'Sistem Migration (Versi Database)',
            'audit_logs' => 'Log Aktivitas Sistem',
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
            'personal_access_tokens' => 'Token Sesi Login',
            'password_reset_tokens' => 'Token Reset Password',
            'books' => 'Master Data Buku (Perpustakaan)',
            'library_loans' => 'Riwayat Sirkulasi & Peminjaman'
        ];

        return $labels[$table] ?? $table;
    }
}
