<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class CheckInstallation
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $isInstallPath = $request->is('install*') || $request->is('*/install*');
        $lockFileExists = File::exists(storage_path('installed.lock'));

        // If lock file exists, double-check database connection
        if ($lockFileExists && !$isInstallPath) {
            try {
                // Try connecting and checking if a core table exists
                DB::connection()->getPdo();
                if (!Schema::hasTable('users')) {
                    throw new \Exception('Table users not found');
                }
            } catch (\Exception $e) {
                // Database missing or connection failed - remove lock to allow re-install
                File::delete(storage_path('installed.lock'));
                return redirect()->route('install.index');
            }
        }

        // If not installed and not on install routes, redirect to install
        if (!$lockFileExists && !$isInstallPath) {
            return redirect()->route('install.index');
        }

        // If already installed and trying to access install routes, redirect to home
        if ($lockFileExists && $isInstallPath) {
            return redirect('/');
        }

        return $next($request);
    }
}
