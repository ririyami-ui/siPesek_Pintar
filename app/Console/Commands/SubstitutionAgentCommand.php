<?php

namespace App\Console\Commands;

use App\Models\Attendance;
use App\Models\Holiday;
use App\Models\Journal;
use App\Models\Schedule;
use App\Models\SubstitutionRecommendation;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SubstitutionAgentCommand extends Command
{
    protected $signature = 'substitution:detect {--dry-run : Show what would be detected without saving}';

    protected $description = 'Deteksi jadwal yang tidak berjalan (guru tidak hadir) via missing journal + attendance';

    public function handle(): int
    {
        $today = Carbon::today()->toDateString();
        $now = Carbon::now();
        $cutoff = $now->copy()->subMinutes(20)->format('H:i:s');

        $this->info("=== Substitution Agent — {$today} ===");

        $schedules = Schedule::with(['class', 'subject', 'teacher'])
            ->where('day', Carbon::now()->locale('id')->dayName)
            ->where('type', '!=', 'non-teaching')
            ->where('end_time', '<=', $cutoff)
            ->get();

        if ($schedules->isEmpty()) {
            $this->info('Tidak ada jadwal yang perlu dicek.');
            return Command::SUCCESS;
        }

        // [AGENDA] Lewati jika hari ini libur atau agenda kegiatan (mis. P5) —
        // saat itu sesi mapel tidak berjalan, bukan berarti guru tidak hadir.
        $todayHoliday = Holiday::where(function ($q) use ($today) {
            $q->where('date', $today)
              ->orWhere(function ($sub) use ($today) {
                  $sub->where('start_date', '<=', $today)
                      ->where('end_date', '>=', $today);
              });
        })->first();

        if ($todayHoliday) {
            $this->info("Hari ini agenda/libur: {$todayHoliday->name}. Deteksi pengganti dilewati.");
            return Command::SUCCESS;
        }

        $detected = 0;
        $skipped = 0;

        foreach ($schedules as $schedule) {
            // Skip if already processed today
            $exists = SubstitutionRecommendation::where('schedule_id', $schedule->id)
                ->where('date', $today)
                ->exists();
            if ($exists) {
                $skipped++;
                continue;
            }

            // Check journal: is there a journal entry for this schedule today?
            $hasJournal = Journal::where('schedule_id', $schedule->id)
                ->whereDate('date', $today)
                ->exists();

            // Check attendance: is there attendance for this class+subject today?
            $hasAttendance = Attendance::where('class_id', $schedule->class_id)
                ->where('subject_id', $schedule->subject_id)
                ->whereDate('date', $today)
                ->exists();

            $this->line("  Schedule {$schedule->id}: journal=" . ($hasJournal ? 'Y' : 'N') . " attendance=" . ($hasAttendance ? 'Y' : 'N'));

            // Only detect when BOTH journal and attendance are missing
            // (journal alone may be late-filled, attendance alone may not be entered yet)
            if (!$hasJournal && !$hasAttendance) {
                $method = 'both';
            } else {
                // At least one exists = class is running normally
                continue;
            }

            if ($this->option('dry-run')) {
                $this->warn("  [DRY-RUN] Would create recommendation for schedule {$schedule->id} ({$schedule->class?->rombel} - {$schedule->subject?->name})");
                $detected++;
                continue;
            }

            try {
                SubstitutionRecommendation::create([
                    'schedule_id' => $schedule->id,
                    'class_id' => $schedule->class_id,
                    'subject_id' => $schedule->subject_id,
                    'original_teacher_id' => $schedule->teacher_id,
                    'date' => $today,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'status' => 'pending',
                    'detection_method' => $method,
                ]);
                $this->info("  + Created recommendation: {$schedule->class?->rombel} - {$schedule->subject?->name} ({$method})");
                $detected++;
            } catch (\Throwable $e) {
                $this->error("  ! Failed to create recommendation: {$e->getMessage()}");
            }
        }

        $this->info("Done. detected={$detected}, skipped_already_processed={$skipped}");
        return Command::SUCCESS;
    }
}
