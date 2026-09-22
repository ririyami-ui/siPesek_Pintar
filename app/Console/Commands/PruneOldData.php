<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneOldData extends Command
{
    protected $signature = 'data:prune';

    protected $description = 'Hapus rekomendasi substitusi lama, audit log lama, dan file temp yang sudah usang';

    public function handle()
    {
        $substitutionCutoff = Carbon::now()->subDays(30);
        $auditCutoff = Carbon::now()->subDays(180);
        $fileCutoff = Carbon::now()->subDays(7);

        $subDeleted = DB::table('substitution_recommendations')
            ->where('created_at', '<', $substitutionCutoff)
            ->delete();

        $auditDeleted = DB::table('audit_logs')
            ->where('created_at', '<', $auditCutoff)
            ->delete();

        $removedFiles = 0;
        foreach (['app/temp-rpp', 'app/temp_pdfs'] as $dir) {
            $path = storage_path($dir);
            if (! is_dir($path)) {
                continue;
            }
            foreach (glob($path.'/*') ?: [] as $file) {
                if (is_file($file) && Carbon::createFromTimestamp(filemtime($file))->lt($fileCutoff)) {
                    @unlink($file);
                    $removedFiles++;
                }
            }
        }

        $this->info("Rekomendasi substitusi >30 hari dihapus: {$subDeleted}.");
        $this->info("Audit log >180 hari dihapus: {$auditDeleted}.");
        $this->info("File temp >7 hari dihapus: {$removedFiles}.");

        return Command::SUCCESS;
    }
}
