<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneStaleTokens extends Command
{
    protected $signature = 'tokens:prune-stale {--days=180 : Hapus token yang tidak dipakai selama N hari}';

    protected $description = 'Hapus personal access token yang sudah lama tidak aktif (login aktif tetap permanen)';

    public function handle()
    {
        $days = (int) $this->option('days');
        $cutoff = Carbon::now()->subDays($days);

        $deleted = DB::table('personal_access_tokens')
            ->where(function ($query) use ($cutoff) {
                $query->where('last_used_at', '<', $cutoff)
                    ->orWhere(function ($query) use ($cutoff) {
                        $query->whereNull('last_used_at')
                            ->where('created_at', '<', $cutoff);
                    });
            })
            ->delete();

        $this->info("Token tidak aktif > {$days} hari yang dihapus: {$deleted}.");

        return Command::SUCCESS;
    }
}
