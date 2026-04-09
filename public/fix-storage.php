<?php
/**
 * Laravel Production Storage Fixer
 * This script ensures all required directories exist and permissions are correct.
 * Access it via: yourdomain.com/fix-storage.php
 */

$basePath = realpath(__DIR__ . '/../');

$directories = [
    $basePath . '/storage/app/public',
    $basePath . '/storage/framework/cache/data',
    $basePath . '/storage/framework/sessions',
    $basePath . '/storage/framework/testing',
    $basePath . '/storage/framework/views',
    $basePath . '/storage/logs',
    $basePath . '/bootstrap/cache',
];

echo "<h3>🛠 Fixing Laravel Directory Structure...</h3>";

foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        if (mkdir($dir, 0775, true)) {
            echo "✅ Created directory: <code>$dir</code><br>";
        } else {
            echo "❌ Failed to create directory: <code>$dir</code><br>";
        }
    } else {
        // Ensure permissions are correct if it already exists
        chmod($dir, 0775);
        echo "ℹ️ Directory exists, updated permissions: <code>$dir</code><br>";
    }
}

echo "<h3>🔗 Fixing Storage Symlink...</h3>";

$target = $basePath . '/storage/app/public';
$link = __DIR__ . '/storage';

if (file_exists($link)) {
    echo "⚠️ Symlink/folder <code>$link</code> already exists. Attempting to remove it...<br>";
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        shell_exec("rd /s /q \"$link\"");
    } else {
        @unlink($link);
        @rmdir($link);
    }
}

if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    $output = shell_exec("mklink /J \"$link\" \"$target\"");
    echo "🪟 Windows Junction: " . ($output ? $output : "Done") . "<br>";
} else {
    if (symlink($target, $link)) {
        echo "✅ Symlink created successfully!<br>";
    } else {
        echo "❌ Failed to create symlink. You may need to ask your host or use a cron job.<br>";
    }
}

echo "<h3>🧹 Clearing Old Caches (Windows Paths Fix)...</h3>";

$cacheFiles = [
    $basePath . '/bootstrap/cache/config.php',
    $basePath . '/bootstrap/cache/routes.php',
    $basePath . '/bootstrap/cache/services.php',
    $basePath . '/bootstrap/cache/packages.php',
];

foreach ($cacheFiles as $file) {
    if (file_exists($file)) {
        if (unlink($file)) {
            echo "✅ Deleted old cache file: <code>" . basename($file) . "</code> (Fixes Windows paths error)<br>";
        } else {
            echo "❌ Failed to delete cache file: <code>" . basename($file) . "</code><br>";
        }
    }
}

echo "<h3>⚡ Fixing Vite (Production Mode)...</h3>";

$hotFile = __DIR__ . '/hot';
if (file_exists($hotFile)) {
    if (unlink($hotFile)) {
        echo "✅ Deleted <code>public/hot</code> file. This fixes the CORS / 5173 error by forcing Production Mode.<br>";
    } else {
        echo "❌ Failed to delete <code>public/hot</code> file. Please delete it manually via File Manager.<br>";
    }
} else {
    echo "ℹ️ <code>public/hot</code> file not found. System is already in production mode or assets are missing.<br>";
}

$buildFolder = __DIR__ . '/build';
if (!is_dir($buildFolder)) {
    echo "⚠️ <b>Warning:</b> <code>public/build</code> folder not found! Make sure you have run <code>npm run build</code> locally and uploaded the 'build' folder.<br>";
} else {
    echo "✅ <code>public/build</code> folder detected.<br>";
}

echo "<br><b>✅ All done!</b> Please delete this file (<code>fix-storage.php</code>) for security reasons.";
