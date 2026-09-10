<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DatabaseManagementController extends Controller
{
    protected array $tablesToManage;

    protected array $protectedTables;

    protected array $tableLabels;

    public function __construct()
    {
        $this->tablesToManage = config('database_tables.managed', []);
        $this->protectedTables = config('database_tables.protected', []);
        $this->tableLabels = config('database_tables.labels', []);
    }

    private function verifyPassword($password)
    {
        if (! $password) {
            return false;
        }

        return Hash::check($password, auth()->user()->password);
    }

    private function logAudit(string $action, array $extra = []): void
    {
        try {
            DB::table('audit_logs')->insert([
                'user_id' => auth()->id(),
                'action' => $action,
                'auditable_type' => 'database',
                'auditable_id' => 0,
                'old_values' => null,
                'new_values' => json_encode($extra),
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
            Log::warning('Audit log gagal ditulis: '.$e->getMessage());
        }
    }

    public function getTables()
    {
        $tables = [];
        foreach ($this->tablesToManage as $tableName) {
            if (Schema::hasTable($tableName)) {
                $count = DB::table($tableName)->count();
                $tables[] = [
                    'name' => $tableName,
                    'count' => $count,
                    'label' => $this->tableLabels[$tableName] ?? $tableName,
                    'protected' => in_array($tableName, $this->protectedTables),
                ];
            }
        }

        return response()->json(['data' => $tables]);
    }

    public function truncateTable(Request $request)
    {
        $request->validate([
            'table' => 'required|string',
            'password' => 'required|string',
            'confirmation' => 'required|string|in:KOSONGKAN',
        ]);

        if (! $this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        $tableName = $request->table;

        if (! in_array($tableName, $this->tablesToManage)) {
            return response()->json(['message' => 'Tabel tidak diizinkan untuk dikosongkan.'], 403);
        }

        try {
            $countBefore = DB::table($tableName)->count();

            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
            DB::table($tableName)->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');

            $this->logAudit('truncate_table', [
                'table' => $tableName,
                'rows_deleted' => $countBefore,
            ]);

            return response()->json(['message' => "Tabel {$tableName} berhasil dikosongkan."]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal mengosongkan tabel: '.$e->getMessage()], 500);
        }
    }

    public function backupDatabase(Request $request)
    {
        $request->validate([
            'tables' => 'sometimes|array',
            'tables.*' => ['string', Rule::in($this->tablesToManage)],
        ]);

        $selected = $request->input('tables');

        $tablesToBackup = (is_array($selected) && count($selected) > 0)
            ? array_values(array_intersect($this->tablesToManage, $selected))
            : $this->tablesToManage;

        if (count($tablesToBackup) === 0) {
            return response()->json(['message' => 'Tidak ada tabel yang dipilih untuk backup.'], 422);
        }

        $isPartial = count($tablesToBackup) < count($this->tablesToManage);

        ini_set('memory_limit', '512M');
        set_time_limit(600);

        $filename = 'backup-smart-school-'.Carbon::now()->format('Y-m-d-H-i-s').'.sql';
        $directory = storage_path('app/backups');

        if (! file_exists($directory)) {
            mkdir($directory, 0755, true);
        }

        $path = $directory.'/'.$filename;
        $handle = fopen($path, 'w');

        if (! $handle) {
            return response()->json(['message' => 'Gagal membuat file backup di server.'], 500);
        }

        try {
            fwrite($handle, "-- Smart School Manager Database Backup\n");
            fwrite($handle, '-- Date: '.Carbon::now()->toDateTimeString()."\n");
            fwrite($handle, '-- Backup scope: '.($isPartial ? 'partial' : 'full')."\n");
            if ($isPartial) {
                fwrite($handle, '-- Tables: '.implode(', ', $tablesToBackup)."\n");
            }
            fwrite($handle, "\nSET FOREIGN_KEY_CHECKS=0;\n\n");

            foreach ($tablesToBackup as $table) {
                if (! Schema::hasTable($table)) {
                    continue;
                }

                fwrite($handle, "-- Table: {$table}\n");

                try {
                    $createTable = DB::select("SHOW CREATE TABLE `{$table}`");
                    $createTableSql = ((array) $createTable[0])['Create Table'] ?? ((array) $createTable[0])['Table'];

                    fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
                    fwrite($handle, $createTableSql.";\n\n");
                } catch (\Exception $e) {
                    fwrite($handle, "TRUNCATE TABLE `{$table}`;\n");
                }

                $processRows = function ($rows) use ($handle, $table) {
                    foreach ($rows as $row) {
                        $rowArray = (array) $row;
                        $columns = implode('`, `', array_keys($rowArray));
                        $values = array_map(function ($value) {
                            if (is_null($value)) {
                                return 'NULL';
                            }

                            return "'".addslashes($value)."'";
                        }, array_values($rowArray));
                        $valuesList = implode(', ', $values);

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

            fwrite($handle, 'SET FOREIGN_KEY_CHECKS=1;');
            fclose($handle);

            $ticket = Str::random(64);
            Cache::put('backup_ticket_'.$ticket, [
                'path' => $path,
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'referer' => request()->header('referer'),
            ], now()->addMinutes(5));

            $this->logAudit('backup_database', [
                'filename' => $filename,
                'scope' => $isPartial ? 'partial' : 'full',
                'tables' => $tablesToBackup,
            ]);

            return response()->json([
                'ticket' => $ticket,
                'filename' => $filename,
            ]);

        } catch (\Exception $e) {
            if ($handle) {
                fclose($handle);
            }
            if (file_exists($path)) {
                unlink($path);
            }

            return response()->json(['message' => 'Error saat membuat backup: '.$e->getMessage()], 500);
        }
    }

    public function downloadBackup(Request $request)
    {
        $ticket = $request->query('ticket');

        if (! $ticket) {
            abort(403, 'Ticket backup tidak ditemukan.');
        }

        $cacheKey = 'backup_ticket_'.$ticket;
        $ticketData = Cache::get($cacheKey);

        if (! $ticketData || empty($ticketData['path']) || ! file_exists($ticketData['path'])) {
            abort(404, 'File backup sudah kedaluwarsa atau tidak ditemukan.');
        }

        if (($ticketData['ip'] ?? null) !== $request->ip() || ($ticketData['user_agent'] ?? null) !== $request->userAgent()) {
            Cache::forget($cacheKey);
            abort(403, 'Ticket backup tidak valid untuk perangkat ini.');
        }

        $origin = $request->header('origin') ?: $request->header('referer');
        $expectedOrigin = $request->getSchemeAndHttpHost();
        if ($origin && ! str_starts_with($origin, $expectedOrigin)) {
            Cache::forget($cacheKey);
            abort(403, 'Origin tidak valid.');
        }

        $path = $ticketData['path'];
        Cache::forget($cacheKey);

        $filename = basename($path);

        return response()->download($path, $filename, [
            'Content-Type' => 'application/octet-stream',
        ])->deleteFileAfterSend();
    }

    public function restoreDatabase(Request $request)
    {
        $request->validate([
            'backup_file' => 'required|file|max:51200',
            'password' => 'required|string',
            'confirmation' => 'required|string|in:PULIHKAN',
            'tables' => 'sometimes|array',
            'tables.*' => ['string', Rule::in($this->tablesToManage)],
        ]);

        if (! $this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        ini_set('memory_limit', '1024M');
        set_time_limit(900);

        $file = $request->file('backup_file');
        $path = $file->getRealPath();

        try {
            $pdo = DB::getPdo();
            $pdo->exec('SET FOREIGN_KEY_CHECKS=0;');

            $sql = file_get_contents($path);

            if (empty($sql)) {
                throw new \Exception('File backup kosong atau tidak dapat dibaca.');
            }

            $requested = $request->input('tables');
            $isPartial = is_array($requested) && count($requested) > 0;

            if ($isPartial) {
                // Pastikan tabel kritis (admin, user, migrasi) tidak pernah di-restore selektif.
                $requestedAllProtected = true;
                foreach ($requested as $name) {
                    if (! in_array($name, $this->protectedTables)) {
                        $requestedAllProtected = false;
                        break;
                    }
                }

                if ($requestedAllProtected) {
                    throw new \Exception('Tabel kritis (admin, user, migrasi) tidak dapat dipulihkan secara selektif.');
                }

                [, $sections] = $this->splitBackupSections($sql);

                $restoredNames = [];
                $skippedNames = [];
                $selectedSections = [];

                foreach ($sections as $section) {
                    if (! preg_match('/(?i)^[ \t]*DROP\s+TABLE\s+IF\s+EXISTS\s+`([^`]+)`\s*;/m', $section, $m)) {
                        continue;
                    }

                    $tableName = $m[1];

                    if (! in_array($tableName, $requested)) {
                        continue;
                    }

                    if (in_array($tableName, $this->protectedTables)) {
                        $skippedNames[] = $tableName;

                        continue;
                    }

                    $selectedSections[] = $section;
                    $restoredNames[] = $tableName;
                }

                if (count($selectedSections) === 0) {
                    throw new \Exception('Tidak ada tabel yang dapat dipulihkan dari file backup.');
                }

                $combinedSql = $this->buildPartialBackupSql($sql, $selectedSections);

                $this->validateSqlStatements($combinedSql);

                DB::unprepared($combinedSql);

                $message = 'Tabel berhasil dipulihkan: '.implode(', ', $restoredNames).'.';

                if ($skippedNames) {
                    $message .= ' Tabel kritis dilewati: '.implode(', ', $skippedNames).'.';
                }

                $this->logAudit('restore_database', [
                    'filename' => $file->getClientOriginalName(),
                    'size_bytes' => $file->getSize(),
                    'scope' => 'partial',
                    'restored_tables' => $restoredNames,
                    'skipped_tables' => $skippedNames,
                ]);
            } else {
                $this->validateSqlStatements($sql);

                $sql = $this->stripDefiner($sql);

                DB::unprepared($sql);

                $message = 'Database berhasil dipulihkan dan cache telah dibersihkan.';

                $this->logAudit('restore_database', [
                    'filename' => $file->getClientOriginalName(),
                    'size_bytes' => $file->getSize(),
                    'scope' => 'full',
                ]);
            }

            $pdo->exec('SET FOREIGN_KEY_CHECKS=1;');

            \Illuminate\Support\Facades\Artisan::call('cache:clear');

            return response()->json(['message' => $message]);
        } catch (\Exception $e) {
            Log::error('Database Restore Failed: '.$e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'message' => 'Gagal memulihkan database: '.$e->getMessage().'. Cek log untuk detail teknis.',
            ], 500);
        }
    }

    /**
     * Validasi seluruh statement SQL terhadap daftar statement yang diizinkan.
     */
    private function validateSqlStatements(string $sql): void
    {
        $allowedStatements = [
            '/^\s*CREATE\s+TABLE\b/i',
            '/^\s*INSERT\s+INTO\b/i',
            '/^\s*TRUNCATE\s+TABLE\b/i',
            '/^\s*DROP\s+TABLE\b/i',
            '/^\s*SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01]\s*;?\s*$/i',
            '/^\s*\/\*/',
            '/^\s*--/',
            '/^\s*$/',
        ];

        foreach (preg_split('/;\s*(?=\n|$)/', $sql) as $statement) {
            $trimmed = trim($statement);
            if ($trimmed === '') {
                continue;
            }

            $isAllowed = false;
            foreach ($allowedStatements as $pattern) {
                if (preg_match($pattern, $trimmed)) {
                    $isAllowed = true;
                    break;
                }
            }

            if (! $isAllowed) {
                throw new \Exception('Isi backup tidak valid.');
            }
        }
    }

    /**
     * Pecah file backup menjadi header dan bagian per-tabel.
     * Primary: berdasarkan komentar `-- Table: X` (format backup aplikasi sendiri).
     * Fallback: berdasarkan statement `DROP TABLE IF EXISTS` (format mysqldump eksternal).
     */
    private function splitBackupSections(string $sql): array
    {
        $parts = preg_split('/(?=^-- Table: [^\r\n]+\r?\n[ \t]*DROP\s+TABLE\s+IF\s+EXISTS\s+`[^`]+`\s*;)/mi', $sql);

        if (count($parts) > 1) {
            $header = array_shift($parts);

            return [$header, $parts];
        }

        $parts = preg_split('/(?=^[ \t]*DROP\s+TABLE\s+IF\s+EXISTS\s+`[^`]+`\s*;)/mi', $sql);
        $header = array_shift($parts);

        return [$header, $parts];
    }

    /**
     * Gabungkan header backup dengan bagian tabel terpilih yang akan dipulihkan.
     */
    private function buildPartialBackupSql(string $fullSql, array $selectedSections): string
    {
        [$header] = $this->splitBackupSections($fullSql);

        $header = $this->stripDefiner($header);
        $sections = array_map(fn ($section) => $this->stripDefiner($section), $selectedSections);

        return $header."\n".implode("\n", $sections)."\nSET FOREIGN_KEY_CHECKS=1;\n";
    }

    private function stripDefiner(string $sql): string
    {
        $sql = preg_replace('/DEFINER\s*=\s*`[^`]+`@`[^`]+`/', '', $sql);
        $sql = preg_replace('/DEFINER\s*=\s*[^\s@]+@[^\s@]+/', '', $sql);

        return $sql;
    }

    public function wipeDatabase(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
            'confirmation' => 'required|string|in:RESET TOTAL',
        ]);

        if (! $this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        try {
            ini_set('memory_limit', '256M');

            DB::beginTransaction();
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            $wipedTables = [];
            foreach ($this->tablesToManage as $table) {
                if (in_array($table, $this->protectedTables)) {
                    continue;
                }
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                    $wipedTables[] = $table;
                }
            }

            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            DB::commit();

            $this->logAudit('wipe_database', ['tables_wiped' => $wipedTables]);

            return response()->json([
                'message' => 'Data aplikasi berhasil direset. Akun admin dan akun pengguna tetap aman.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['message' => 'Gagal menghapus data: '.$e->getMessage()], 500);
        }
    }

    public function cleanSystemLogs(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        if (! $this->verifyPassword($request->password)) {
            return response()->json(['message' => 'Password salah. Akses ditolak.'], 403);
        }

        try {
            $logPath = storage_path('logs/laravel.log');
            if (file_exists($logPath)) {
                file_put_contents($logPath, '');
            }

            DB::table('personal_access_tokens')
                ->where('expires_at', '<', now())
                ->delete();

            \Illuminate\Support\Facades\Artisan::call('cache:clear');
            \Illuminate\Support\Facades\Artisan::call('view:clear');

            $this->logAudit('clean_system_logs');

            return response()->json(['message' => 'Log sistem berhasil dibersihkan dan sistem telah dioptimasi.']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal membersihkan log: '.$e->getMessage()], 500);
        }
    }
}
