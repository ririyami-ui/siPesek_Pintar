<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use ZipArchive;

class BuildProduction extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'build:production';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Build and Package application for production (ZIP)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting Production Build Process...');

        // 1. Compile Assets (Vite)
        $this->info('Step 1: Compiling assets with Vite...');
        shell_exec('npm run build');

        // 2. Prepare Build Directory
        $buildDir = base_path('build_production');
        if (File::exists($buildDir)) {
            File::deleteDirectory($buildDir);
        }
        File::makeDirectory($buildDir);

        $this->info('Step 2: Copying production files...');
        
        // List of directories and files to include
        $include = [
            'app',
            'bootstrap',
            'config',
            'database',
            'public',
            'resources/views',
            'routes',
            'storage',
            'vendor',
            'artisan',
            'composer.json',
            '.env.example',
        ];

        foreach ($include as $path) {
            $source = base_path($path);
            $dest = $buildDir . DIRECTORY_SEPARATOR . $path;

            if (File::isDirectory($source)) {
                File::makeDirectory(File::dirname($dest), 0755, true, true);
                File::copyDirectory($source, $dest);
            } else {
                File::makeDirectory(File::dirname($dest), 0755, true, true);
                File::copy($source, $dest);
            }
        }

        // Clean up build directory (remove dev-only files in production folder)
        $this->info('Step 3: Cleaning up production files...');
        File::delete($buildDir . '/storage/installed.lock');
        File::cleanDirectory($buildDir . '/storage/logs');
        File::cleanDirectory($buildDir . '/storage/framework/views');
        File::cleanDirectory($buildDir . '/storage/framework/cache');
        File::cleanDirectory($buildDir . '/storage/framework/sessions');

        // 4. Create ZIP Archive
        $this->info('Step 4: Creating ZIP archive...');
        $zipFile = base_path('smart-school-production.zip');
        if (File::exists($zipFile)) {
            File::delete($zipFile);
        }

        $zip = new ZipArchive();
        if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) === TRUE) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($buildDir),
                \RecursiveIteratorIterator::LEAVES_ONLY
            );

            foreach ($files as $name => $file) {
                if (!$file->isDir()) {
                    $filePath = $file->getRealPath();
                    $relativePath = substr($filePath, strlen($buildDir) + 1);
                    $zip->addFile($filePath, $relativePath);
                }
            }
            $zip->close();
        }

        // 5. Cleanup
        File::deleteDirectory($buildDir);

        $this->info('-----------------------------------------');
        $this->info('BUILD SUCCESS!');
        $this->info('Production File: ' . $zipFile);
        $this->info('-----------------------------------------');
    }
}
