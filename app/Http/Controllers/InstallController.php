<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Admin;
use App\Models\UserProfile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class InstallController extends Controller
{
    public function index()
    {
        // If lock exists but no admin user found, unlock so install can proceed
        if (File::exists(storage_path('installed.lock'))) {
            if (!\App\Models\User::where('role', 'admin')->exists()) {
                File::delete(storage_path('installed.lock'));
            }
        }
        if (File::exists(storage_path('installed.lock'))) {
            return redirect('/');
        }
        return view('install.index');
    }

    public function postInstall(Request $request)
    {
        header('Content-Type: application/json; charset=utf-8');

        $validator = \Validator::make($request->all(), [
            'db_host' => 'required',
            'db_port' => 'required|integer',
            'db_name' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_]+$/'],
            'db_user' => 'required',
            'db_password' => 'nullable|string',
            'admin_name' => 'required',
            'admin_email' => 'required|email',
            'admin_password' => 'required|min:8',
        ]);
        if (!empty($request->db_name) && !preg_match('/^[A-Za-z0-9_]+$/', $request->db_name)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => 'Nama database tidak valid.']);
            exit;
        }
        if ($validator->fails()) {
            http_response_code(422);
            echo json_encode(['success' => false, 'message' => $validator->errors()->first()]);
            exit;
        }

        try {
            $dsn = "mysql:host={$request->db_host};port={$request->db_port}";
            $pdo = new \PDO($dsn, $request->db_user, $request->db_password);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            $dbName = str_replace('`', '``', $request->db_name);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

            config([
                'database.connections.mysql.host' => $request->db_host,
                'database.connections.mysql.port' => $request->db_port,
                'database.connections.mysql.database' => $request->db_name,
                'database.connections.mysql.username' => $request->db_user,
                'database.connections.mysql.password' => $request->db_password,
            ]);
            DB::purge('mysql');
            DB::reconnect('mysql');

            // Safe migration — no DROP
            $this->runSafeMigration();

            $user = User::updateOrCreate(
                ['email' => $request->admin_email],
                [
                    'name' => $request->admin_name,
                    'password' => Hash::make($request->admin_password),
                    'role' => 'admin',
                ]
            );
            Admin::updateOrCreate(
                ['auth_user_id' => $user->id],
                [
                    'created_by' => $user->id,
                    'auth_user_id' => $user->id,
                    'name' => $request->admin_name,
                    'username' => $request->admin_email,
                ]
            );
            UserProfile::updateOrCreate(
                ['user_id' => $user->id],
                ['full_name' => $request->admin_name]
            );

            $this->updateEnv([
                'DB_HOST' => $request->db_host,
                'DB_PORT' => $request->db_port,
                'DB_DATABASE' => $request->db_name,
                'DB_USERNAME' => $request->db_user,
                'DB_PASSWORD' => $request->db_password,
                'APP_URL' => url('/'),
                'APP_ENV' => 'production',
                'APP_DEBUG' => 'false',
            ]);

            if (empty(config('app.key')) || config('app.key') === 'base64:...') {
                Artisan::call('key:generate', ['--force' => true]);
            }

            File::put(storage_path('installed.lock'), date('Y-m-d H:i:s'));

            echo json_encode(['success' => true, 'message' => 'Instalasi/Pembaruan Berhasil!']);
            exit;
        } catch (\Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Gagal instalasi.']);
            exit;
        }
    }

    private function runSafeMigration()
    {
        $diskFiles = collect(\File::files(database_path('migrations')))
            ->map(fn($f) => $f->getFilenameWithoutExtension())
            ->values();

        if (!Schema::hasTable('migrations')) {
            try {
                Artisan::call('migrate', ['--force' => true]);
            } catch (\Exception $e) {
                if (str_contains($e->getMessage(), 'already exists')) {
                    Schema::create('migrations', function ($table) {
                        $table->id();
                        $table->string('migration', 255);
                        $table->integer('batch');
                    });
                    $batch = 1;
                    foreach ($diskFiles as $name) {
                        DB::table('migrations')->insert([
                            'migration' => $name,
                            'batch' => $batch,
                        ]);
                    }
                    Artisan::call('migrate', ['--force' => true]);
                } else {
                    throw $e;
                }
            }
            return;
        }

        // Migrations table exists — retry one-by-one
        // Each iteration: try migrate, catch 'already exists', mark that file done, repeat
        $attempts = 0;
        $maxAttempts = $diskFiles->count();
        while ($attempts < $maxAttempts) {
            try {
                Artisan::call('migrate', ['--force' => true]);
                break; // all remaining files ran successfully
            } catch (\Exception $e) {
                if (!str_contains($e->getMessage(), 'already exists')) {
                    throw $e; // real error
                }
                $dbEntries = DB::table('migrations')->pluck('migration');
                $pending = $diskFiles->diff($dbEntries);
                if ($pending->isEmpty()) break;

                // Mark the failing file as done and retry
                $failingFile = $pending->first();
                $maxBatch = DB::table('migrations')->max('batch') ?? 0;
                DB::table('migrations')->insert([
                    'migration' => $failingFile,
                    'batch' => $maxBatch + 1,
                ]);
                $attempts++;
            }
        }
    }

    private function updateEnv($data)
    {
        $path = base_path('.env');
        if (!File::exists($path)) {
            File::copy(base_path('.env.example'), $path);
        }
        $content = File::get($path);
        foreach ($data as $key => $value) {
            $escapedValue = str_replace('"', '\\"', $value);
            $quotedValue = "\"{$escapedValue}\"";
            if (preg_match("/^{$key}=/m", $content)) {
                $content = preg_replace_callback("/^{$key}=.*/m", function () use ($key, $quotedValue) {
                    return "{$key}={$quotedValue}";
                }, $content);
            } else {
                $content .= "\n{$key}={$quotedValue}";
            }
        }
        if (!File::put($path, $content)) {
            throw new \Exception('Gagal menulis ke file .env. Pastikan file tersebut memiliki izin tulis.');
        }
    }
}
