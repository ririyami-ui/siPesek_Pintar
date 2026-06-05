<?php

namespace App\Console\Commands;

use App\Jobs\SendScheduleReminderJob;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SendScheduleReminders extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'reminders:send {--minutes=5 : Lead time in minutes}';

    /**
     * The console command description.
     */
    protected $description = 'Send push reminders for schedules that will start in X minutes (default 5).';

    public function handle()
    {
        $lead = (int)$this->option('minutes');
        $now = Carbon::now();
        $target = $now->copy()->addMinutes($lead);
        $targetTime = $target->format('H:i');

        // Map dayOfWeek to Indonesian day names (0=Sunday)
        $days = [0=>'Minggu',1=>'Senin',2=>'Selasa',3=>'Rabu',4=>'Kamis',5=>'Jumat',6=>'Sabtu'];
        $dayName = $days[$now->dayOfWeek] ?? 'Senin';

        $today = $now->toDateString();

        $this->info("Looking for schedules on {$dayName} starting at {$targetTime}");

        $query = Schedule::with(['teacher','subject','class'])
            ->where('type', 'teaching')
            ->where('day', $dayName)
            ->where(function($q) use ($today) {
                $q->where(function($sub) {
                    $sub->whereNull('start_date')->whereNull('end_date');
                })->orWhere(function($sub) use ($today) {
                    $sub->where('start_date', '<=', $today)
                        ->where(function($dateRange) use ($today) {
                            $dateRange->where('end_date', '>=', $today)
                                      ->orWhereNull('end_date');
                        });
                });
            })
            ->whereRaw("LEFT(start_time,5) = ?", [$targetTime])
            ->get();

        $count = 0;
        foreach ($query as $schedule) {
            $cacheKey = "schedule_reminder_sent:{$schedule->id}:{$target->toDateString()}:{$lead}";
            if (Cache::has($cacheKey)) {
                continue; // already sent
            }

            SendScheduleReminderJob::dispatch($schedule);
            Cache::put($cacheKey, true, now()->addMinutes(15));
            $count++;
        }

        $this->info("Dispatched {$count} reminders.");
        return 0;
    }
}
