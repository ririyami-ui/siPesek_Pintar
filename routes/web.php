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

// Management Routes (Admin Only)
Route::middleware(['auth', 'admin'])->group(function () {
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

    // Emergency storage link route
    Route::get('/storage-link', function() {
        try {
            $link = public_path('storage');
            $target = storage_path('app/public');
            
            // 1. Check if link already exists
            if (file_exists($link)) {
                if (is_link($link)) {
                    return "✅ Storage link sudah ada dan merupakan symbolic link. Logo seharusnya sudah muncul.";
                }
                
                // 2. Resolve conflict (If public/storage is a real folder)
                if (is_dir($link)) {
                    $newName = $link . '_old_' . time();
                    if (!rename($link, $newName)) {
                        return "❌ Error: Folder 'public/storage' sudah ada dan gagal di-rename secara otomatis. Silakan HAPUS folder tersebut via File Manager (cPanel) Anda, lalu refresh halaman ini.";
                    }
                    $statusMsg = "ℹ️ Folder 'public/storage' lama telah di-rename menjadi '" . basename($newName) . "'. ";
                } else {
                    @unlink($link);
                    $statusMsg = "ℹ️ File 'public/storage' lama telah dihapus. ";
                }
            } else {
                $statusMsg = "";
            }
            
            // 3. Create the link
            // Try using Artisan link
            try {
                \Illuminate\Support\Facades\Artisan::call('storage:link');
            } catch (\Throwable $e) {}
            
            if (file_exists($link)) {
                return "✅ " . $statusMsg . "Storage link berhasil dibuat! Silakan cek logo sekarang.";
            }
            
            // Try Shell Exec (Workaround for some hostings)
            if (function_exists('shell_exec')) {
                @shell_exec("ln -s $target $link");
                if (file_exists($link)) {
                    return "✅ " . $statusMsg . "Storage link berhasil dibuat (via shell_exec)! Silakan cek logo sekarang.";
                }
            }

            // Try Manual PHP symlink (Global scope)
            if (function_exists('symlink')) {
                if (@\symlink($target, $link)) {
                    return "✅ " . $statusMsg . "Storage link berhasil dibuat (via manual symlink)! Silakan cek logo sekarang.";
                }
            }
            
            return "❌ Gagal membuat link via script. <br><br><b>Solusi Terakhir:</b><br>1. Masuk ke cPanel/File Manager.<br>2. Hapus folder <code>public/storage</code> jika ada.<br>3. Gunakan menu 'Terminal' di cPanel dan ketik: <br><code>ln -s " . $target . " " . $link . "</code>";
            
        } catch (\Throwable $e) {
            return "❌ Error: " . $e->getMessage();
        }
    });
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
})->where('any', '^(?!install|login|storage-link|clear-cache|run-migrations).*$');
