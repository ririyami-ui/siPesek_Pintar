<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Response;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;

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
        $databaseName = config('database.connections.mysql.database');
        $username = config('database.connections.mysql.username');
        $password = config('database.connections.mysql.password');
        $host = config('database.connections.mysql.host');

        $filename = "backup-" . Carbon::now()->format('Y-m-d-H-i-s') . ".sql";
        $path = storage_path('app/backups/' . $filename);

        if (!file_exists(storage_path('app/backups'))) {
            mkdir(storage_path('app/backups'), 0755, true);
        }

        // Use mysqldump if available, otherwise manual backup
        // For simplicity in different environments, we'll do a manual SQL generation
        // for the tables we manage.
        
        $sql = "-- Smart School Manager Database Backup\n";
        $sql .= "-- Date: " . Carbon::now()->toDateTimeString() . "\n\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ($this->tablesToManage as $table) {
            if (!Schema::hasTable($table)) continue;

            $rows = DB::table($table)->get();
            $sql .= "-- Table: {$table}\n";
            $sql .= "TRUNCATE TABLE `{$table}`;\n";

            foreach ($rows as $row) {
                $rowArray = (array)$row;
                $columns = implode("`, `", array_keys($rowArray));
                $values = array_map(function($value) {
                    if (is_null($value)) return "NULL";
                    return "'" . addslashes($value) . "'";
                }, array_values($rowArray));
                $valuesList = implode(", ", $values);
                
                $sql .= "INSERT INTO `{$table}` (`{$columns}`) VALUES ({$valuesList});\n";
            }
            $sql .= "\n";
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;";

        return Response::make($sql, 200, [
            'Content-Type' => 'application/sql',
            'Content-Disposition' => "attachment; filename={$filename}"
        ]);
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
