<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BackupDatabase extends Command
{
    protected $signature = 'db:backup
        {--keep=7 : Jumlah file backup terakhir yang dipertahankan}';

    protected $description = 'Backup database ke storage/app/backups dan bersihkan backup lama';

    protected $tablesToBackup = [
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

    public function handle(): int
    {
        // Batas waktu & memori untuk database besar
        ini_set('memory_limit', '512M');
        set_time_limit(600); // 10 menit

        $directory = storage_path('app/backups');

        if (!file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        $filename = "backup-smart-school-" . Carbon::now()->format('Y-m-d-H-i-s') . ".sql";
        $path = $directory . '/' . $filename;
        $handle = fopen($path, 'w');

        if (!$handle) {
            $this->error("Gagal membuat file backup di {$path}.");
            return 1;
        }

        try {
            fwrite($handle, "-- Smart School Manager Database Backup\n");
            fwrite($handle, "-- Date: " . Carbon::now()->toDateTimeString() . "\n\n");
            fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($this->tablesToBackup as $table) {
                if (!Schema::hasTable($table)) continue;

                fwrite($handle, "-- Table: {$table}\n");

                // CREATE TABLE statement agar portable
                try {
                    $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
                    $createTableSql = ((array) $createTable[0])['Create Table'] ?? ((array) $createTable[0])['Table'];
                    fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
                    fwrite($handle, $createTableSql . ";\n\n");
                } catch (\Exception $e) {
                    // Fallback TRUNCATE bila SHOW CREATE TABLE gagal
                    fwrite($handle, "TRUNCATE TABLE `{$table}`;\n");
                }

                $processRows = function ($rows) use ($handle, $table) {
                    foreach ($rows as $row) {
                        $rowArray = (array) $row;
                        $columns = implode("`, `", array_keys($rowArray));
                        $values = array_map(function ($value) {
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

            $this->info("Backup berhasil: {$filename}");

            $keep = max(1, (int) $this->option('keep'));
            $this->pruneOldBackups($directory, $keep, $filename);

            return 0;
        } catch (\Exception $e) {
            if ($handle) fclose($handle);
            if (file_exists($path)) unlink($path);
            $this->error("Error saat membuat backup: " . $e->getMessage());
            return 1;
        }
    }

    /**
     * Hapus file backup lama, sisakan hanya N terbaru.
     */
    private function pruneOldBackups(string $directory, int $keep, string $current): void
    {
        $files = glob($directory . '/*.sql');
        if (!$files) return;

        // Urutkan menurun berdasarkan nama file (format timestamp di nama)
        usort($files, function ($a, $b) {
            return strcmp(basename($b), basename($a));
        });

        foreach (array_slice($files, $keep) as $old) {
            if (basename($old) === $current) continue;
            @unlink($old);
            $this->line("Hapus backup lama: " . basename($old));
        }
    }
}
