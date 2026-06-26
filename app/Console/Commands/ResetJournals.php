<?php

namespace App\Console\Commands;

use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResetJournals extends Command
{
    protected $signature = 'journal:reset';
    protected $description = 'Kosongkan semua jurnal saat pergantian semester (1 Januari atau 1 Juli)';

    public function handle()
    {
        $now = Carbon::now('Asia/Jakarta');
        $day = (int) $now->format('d');
        $month = (int) $now->format('m');
        // Hanya eksekusi pada 1 Januari atau 1 Juli
        if (!($day === 1 && ($month === 1 || $month === 7))) {
            $this->info('Bukan hari pergantian semester, tidak ada perubahan.');
            return 0;
        }
        // Nonaktifkan foreign key checks, truncate, aktifkan kembali
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('journals')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $this->info('Semua jurnal telah dikosongkan untuk semester baru.');
        return 0;
    }
}
