<?php

namespace App\Jobs;

use App\Models\Schedule;
use App\Services\PushNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendScheduleReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public Schedule $schedule;

    /**
     * Create a new job instance.
     */
    public function __construct(Schedule $schedule)
    {
        $this->schedule = $schedule;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $schedule = $this->schedule->load(['teacher', 'subject', 'class']);

        $teacher = $schedule->teacher;
        if (!$teacher) return;

        $subjectName = $schedule->subject->name ?? 'Sesi pelajaran';
        $className = $schedule->class->rombel ?? $schedule->class->code ?? '';
        $startTime = substr($schedule->start_time, 0, 5);

        $title = 'Pengingat Pengajaran — 5 Menit Lagi';
        $body = sprintf("%s kurang lima menit, mohon Bapak/Ibu Guru mempersiapkan diri. (%s — Kelas %s)", $subjectName, $startTime, $className);

        PushNotificationService::sendToUser($teacher, $title, $body, '/teacher/schedule');
    }
}
