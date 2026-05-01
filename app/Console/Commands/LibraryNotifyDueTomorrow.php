<?php

namespace App\Console\Commands;

use App\Models\LibraryLoan;
use App\Services\PushNotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class LibraryNotifyDueTomorrow extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'library:notify-due-tomorrow';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send push notifications for library books due tomorrow';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $tomorrow = Carbon::tomorrow()->toDateString();
        
        $loans = LibraryLoan::with(['student', 'book'])
            ->where('status', 'dipinjam')
            ->where('due_date', $tomorrow)
            ->get();

        $this->info("Found " . $loans->count() . " loans due tomorrow ($tomorrow).");

        foreach ($loans as $loan) {
            $student = $loan->student;
            if (!$student) continue;

            $title = "📚 Pengingat Perpustakaan";
            $body = "Halo {$student->name}, buku \"{$loan->book->title}\" harus dikembalikan besok. Jangan sampai terlambat ya!";
            
            $sent = PushNotificationService::sendToStudentParent($student, $title, $body, '/siswa/perpustakaan');
            
            if ($sent) {
                $this->info("Notification sent to student: {$student->name}");
            } else {
                $this->warn("Failed to send notification to student: {$student->name} (No subscription or error)");
            }
        }

        return Command::SUCCESS;
    }
}
