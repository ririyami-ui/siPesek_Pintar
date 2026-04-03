<?php

namespace App\Console\Commands;

use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SyncStudentUsers extends Command
{
    protected $signature   = 'students:sync-users {--force : Reset passwords even if user already exists}';
    protected $description = 'Create or update login accounts for all existing students (username=NISN, password=NIS)';

    public function handle(): int
    {
        $students = Student::whereNotNull('nisn')->whereNotNull('nis')->get();

        if ($students->isEmpty()) {
            $this->warn('Tidak ada siswa dengan NISN dan NIS yang ditemukan.');
            return self::SUCCESS;
        }

        $this->info("Memproses {$students->count()} siswa...");
        $bar = $this->output->createProgressBar($students->count());
        $bar->start();

        $created = 0;
        $updated = 0;

        foreach ($students as $student) {
            $authUser = $student->auth_user_id
                ? User::find($student->auth_user_id)
                : User::where('username', $student->nisn)->where('role', 'student')->first();

            if ($authUser) {
                if ($this->option('force')) {
                    $authUser->update([
                        'name'     => $student->name,
                        'username' => $student->nisn,
                        'password' => Hash::make($student->nis),
                    ]);
                }
                $updated++;
            } else {
                $authUser = User::create([
                    'name'     => $student->name,
                    'email'    => $student->nisn . '@siswa.sipesekpintar.id',
                    'username' => $student->nisn,
                    'password' => Hash::make($student->nis),
                    'role'     => 'student',
                    'status'   => 'active',
                ]);
                $created++;
            }

            // Link auth_user_id
            if ($student->auth_user_id !== $authUser->id) {
                $student->updateQuietly(['auth_user_id' => $authUser->id]);
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Selesai! Dibuat: {$created} | Diperbarui: {$updated}");

        return self::SUCCESS;
    }
}
