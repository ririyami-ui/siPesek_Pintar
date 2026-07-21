<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('library:notify-due-tomorrow')->dailyAt('07:00');
        $schedule->command('reminders:send')->everyMinute();
        $schedule->command('reports:send-parent --type=weekly')->weeklyOn(0, '19:00');
        $schedule->command('reports:send-parent --type=monthly')->monthlyOn(1, '07:00');
        $schedule->command('substitution:detect')
            ->twiceDaily(9, 13)
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/substitution-agent.log'));
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');
        require base_path('routes/console.php');
    }
}
