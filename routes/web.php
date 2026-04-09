<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\InstallController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Installation Routes
Route::get('/install', [InstallController::class, 'index'])->name('install.index');
Route::post('/install', [InstallController::class, 'postInstall'])->name('install.post');

// Emergency migration route for production (No SSH)
Route::get('/run-migrations', function() {
    try {
        Artisan::call('migrate', ['--force' => true]);
        return "Database berhasil diupdate ke versi terbaru!";
    } catch (\Exception $e) {
        return "Gagal mengupdate database: " . $e->getMessage();
    }
});

// Emergency cache clear for production
Route::get('/clear-cache', function() {
    try {
        Artisan::call('config:clear');
        Artisan::call('cache:clear');
        Artisan::call('view:clear');
        Artisan::call('route:clear');
        return "Semua Cache Berhasil Dibersihkan! Aplikasi sekarang menggunakan path server.";
    } catch (\Exception $e) {
        return "Gagal membersihkan cache: " . $e->getMessage();
    }
});

// PWA Manifest Route
Route::get('/pwa-manifest.json', [App\Http\Controllers\UserProfileController::class, 'getPwaManifest'])->name('pwa.manifest');

Route::get('/', function () {
    return view('index');
});

Route::get('/login', function () {
    return view('index');
});

Route::get('/{any?}', function () {
    return view('index');
})->where('any', '^(?!install|login).*$');
