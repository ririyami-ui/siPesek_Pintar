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
        'user_profiles'
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

        $file = $request->file('backup_file');
        $sql = file_get_contents($file->getRealPath());

        if (!$sql) {
            return response()->json(['message' => 'File kosong atau tidak valid.'], 400);
        }

        try {
            $dbName = config('database.connections.mysql.database');
            $host = config('database.connections.mysql.host');
            $port = config('database.connections.mysql.port');
            $user = config('database.connections.mysql.username');
            $pass = config('database.connections.mysql.password');

            // 1. Create a connection WITHOUT a specific database first
            $dsn = "mysql:host={$host};port={$port}";
            $pdo = new \PDO($dsn, $user, $pass);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
            
            // 2. Create the database if it doesn't exist
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            
            // 3. Switch to using that database
            $pdo->exec("USE `{$dbName}`;");
            
            // 4. Disable foreign key checks for the session
            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

            // 5. Use a more robust split that ignores semicolons inside quotes
            $statements = preg_split("/;(?=(?:[^'\"`]*['\"`][^'\"`]*['\"`])*[^'\"`]*$)/", $sql);
            
            foreach ($statements as $statement) {
                $statement = trim($statement);
                if (!empty($statement)) {
                    $pdo->exec($statement . ';');
                }
            }

            // 6. Re-enable foreign key checks
            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");

            return response()->json(['message' => 'Database berhasil dipulihkan dari file cadangan.']);
        } catch (\Exception $e) {
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
            $host = config('database.connections.mysql.host');
            $port = config('database.connections.mysql.port');
            $dbName = config('database.connections.mysql.database');
            $user = config('database.connections.mysql.username');
            $pass = config('database.connections.mysql.password');

            // 1. Connect without database first
            $dsn = "mysql:host={$host};port={$port}";
            $pdo = new \PDO($dsn, $user, $pass);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            // 2. Create database if not exists and switch to it
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            $pdo->exec("USE `{$dbName}`;");

            $pdo->exec("SET FOREIGN_KEY_CHECKS=0;");

            foreach ($this->tablesToManage as $table) {
                // Check if table exists before truncating
                $stmt = $pdo->prepare("SHOW TABLES LIKE ?");
                $stmt->execute([$table]);
                if ($stmt->rowCount() > 0) {
                    $pdo->exec("TRUNCATE TABLE `{$table}`;");
                }
            }

            $pdo->exec("SET FOREIGN_KEY_CHECKS=1;");

            return response()->json(['message' => 'Seluruh data aplikasi berhasil dihapus.']);
        } catch (\Exception $e) {
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
            'user_profiles' => 'Profil Pengguna'
        ];

        return $labels[$table] ?? $table;
    }
}
