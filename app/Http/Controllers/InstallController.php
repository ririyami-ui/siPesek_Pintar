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

class InstallController extends Controller
{
    public function index()
    {
        // If already installed, redirect to home
        if (File::exists(storage_path('installed.lock'))) {
            return redirect('/');
        }

        return view('install.index');
    }

    public function postInstall(Request $request)
    {
        $request->validate([
            'db_host' => 'required',
            'db_port' => 'required',
            'db_name' => 'required',
            'db_user' => 'required',
            'admin_name' => 'required',
            'admin_email' => 'required|email',
            'admin_password' => 'required|min:8',
        ]);

        try {
            // 1. Try to connect to MySQL (without database first)
            $dsn = "mysql:host={$request->db_host};port={$request->db_port}";
            $pdo = new \PDO($dsn, $request->db_user, $request->db_password);
            $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            // 2. Create database if not exists
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$request->db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

            // 3. Temporarily update database config for the current process
            config([
                'database.connections.mysql.host' => $request->db_host,
                'database.connections.mysql.port' => $request->db_port,
                'database.connections.mysql.database' => $request->db_name,
                'database.connections.mysql.username' => $request->db_user,
                'database.connections.mysql.password' => $request->db_password,
            ]);
            DB::purge('mysql');
            DB::reconnect('mysql');

            // 4. Run migrations (Update instead of Fresh)
            Artisan::call('migrate', ['--force' => true]);

            // 5. Create or Update Admin User
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
                [
                    'full_name' => $request->admin_name,
                ]
            );

            // 6. Update .env file (DO THIS LAST to avoid premature server restart)
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

            // 7. Generate App Key if empty (also updates .env)
            if (empty(config('app.key')) || config('app.key') === 'base64:...') {
                Artisan::call('key:generate', ['--force' => true]);
            }

            // 8. Create lock file
            File::put(storage_path('installed.lock'), date('Y-m-d H:i:s'));

            return response()->json(['success' => true, 'message' => 'Instalasi/Pembaruan Berhasil!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Gagal: ' . $e->getMessage()], 500);
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
            // Quote value and escape double quotes
            $escapedValue = str_replace('"', '\"', $value);
            $quotedValue = "\"{$escapedValue}\"";

            if (preg_match("/^{$key}=/m", $content)) {
                // Use a safe replacement that doesn't interpret $ or \ as backreferences
                $content = preg_replace_callback("/^{$key}=.*/m", function() use ($key, $quotedValue) {
                    return "{$key}={$quotedValue}";
                }, $content);
            } else {
                $content .= "\n{$key}={$quotedValue}";
            }
        }

        if (!File::put($path, $content)) {
            throw new \Exception("Gagal menulis ke file .env. Pastikan file tersebut memiliki izin tulis.");
        }
    }
}
