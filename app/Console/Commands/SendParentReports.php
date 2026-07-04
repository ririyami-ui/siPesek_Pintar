<?php

namespace App\Console\Commands;

use App\Models\Grade;
use App\Models\Attendance;
use App\Models\Infraction;
use App\Models\Student;
use App\Models\StudentActivityPoint;
use App\Models\ParentReport;
use App\Models\UserProfile;
use App\Models\SchoolClass;
use App\Services\GeminiService;
use App\Services\PushNotificationService;
use App\Services\GradeCalculationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Artisan command to generate AI-powered parent reports.
 * Weekly: every Sunday at 19:00
 * Monthly: 1st of month at 07:00
 *
 * Usage:
 *   php artisan reports:send-parent  --type=weekly  --dry-run
 *   php artisan reports:send-parent  --type=monthly
 *   php artisan reports:send-parent  --type=weekly  --student-id=5
 */
class SendParentReports extends Command
{
    protected $signature = 'reports:send-parent
        {--type=weekly : Report type: weekly or monthly}
        {--student-id= : Optional: generate for specific student only}
        {--dry-run : Preview report without saving or sending}
        {--force : Re-generate even if already sent}';

    protected $description = 'Generate AI-powered weekly/monthly parent reports and send push notifications';

    private GeminiService $gemini;

    public function handle()
    {
        $this->gemini = new GeminiService();
        $type = $this->option('type');
        $studentId = $this->option('student-id');

        if (!in_array($type, ['weekly', 'monthly'])) {
            $this->error('Type must be: weekly or monthly');
            return 1;
        }

        $this->info("Generating {$type} parent reports...");

        // Determine period
        [$periodStart, $periodEnd, $periodLabel] = $this->getPeriod($type);
        $this->info("Period: {$periodLabel} ({$periodStart} s/d {$periodEnd})");

        // Build student query
        $query = Student::whereNotNull('auth_user_id')
            ->whereHas('authUser', fn($q) => $q->whereNotNull('push_subscription'));

        if ($studentId) {
            $query->where('id', $studentId);
        } else {
            // Skip if already sent (unless --force)
            if (!$this->option('force')) {
                $query->whereDoesntHave('parentReports', function($q) use ($type, $periodStart) {
                    $q->where('type', $type)
                      ->where('period_start', $periodStart)
                      ->where('is_sent', true);
                });
            }
        }

        $students = $query->with('class')->get();

        if ($students->isEmpty()) {
            $this->info('No students to process.');
            return 0;
        }

        $this->info("Found {$students->count()} student(s) to process.");

        $bar = $this->output->createProgressBar($students->count());
        $bar->start();

        $success = 0;
        $failed = 0;

        foreach ($students as $student) {
            try {
                $this->processStudent($student, $type, $periodStart, $periodEnd, $periodLabel);
                $success++;
            } catch (\Throwable $e) {
                $this->newLine();
                $this->error("  ✗ Gagal siswa {$student->name}: " . $e->getMessage());
                Log::error("Parent report failed for student {$student->id}: " . $e->getMessage());
                $failed++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. Success: {$success}, Failed: {$failed}");

        return $failed > 0 ? 1 : 0;
    }

    private function getPeriod(string $type): array
    {
        $now = Carbon::now();

        if ($type === 'weekly') {
            // Current week: Monday to Sunday
            $periodEnd   = $now->copy()->endOfWeek(Carbon::MONDAY)->toDateString();
            $periodStart = Carbon::parse($periodEnd)->subDays(6)->toDateString();
            $weekNum = $now->weekOfMonth;
            $periodLabel = "Minggu ke-{$weekNum} ({$periodStart} s/d {$periodEnd})";
        } else {
            // Current month
            $periodStart = $now->copy()->startOfMonth()->toDateString();
            $periodEnd   = $now->copy()->endOfMonth()->toDateString();
            $periodLabel = $now->copy()->translatedFormat('F Y'); // e.g. "Juli 2026"
        }

        return [$periodStart, $periodEnd, $periodLabel];
    }

    private function processStudent(Student $student, string $type, string $periodStart, string $periodEnd, string $periodLabel): void
    {
        $isDryRun = $this->option('dry-run');

        $this->line("  Processing: {$student->name} ({$student->class?->rombel})");

        // 1. Gather data
        $data = $this->gatherStudentData($student, $periodStart, $periodEnd);

        // 2. Generate AI summary
        $summary = $this->generateSummaries($student, $data, $type, $periodLabel);

        // 3. Save report (unless dry-run)
        if (!$isDryRun) {
            $gradeService = new GradeCalculationService();
            $grades = Grade::where('student_id', $student->id)
                ->whereBetween('date', [$periodStart, $periodEnd])
                ->get();

            $calculated = $grades->isNotEmpty()
                ? $gradeService->calculateStudentGrades($student, $grades)
                : null;

            // Build stats snapshot
            $statsSnapshot = [
                'avg_nilai_akhir'  => $calculated['overall_nilai_akhir'] ?? null,
                'by_subject_count' => $grades->count(),
                'attendance'       => $data['attendance'],
                'infraction_points'=> $data['totalInfractionPoints'],
                'total_keaktifan'  => $data['totalKeaktifan'],
            ];

            // Save
            $report = ParentReport::updateOrCreate(
                [
                    'student_id'    => $student->id,
                    'type'          => $type,
                    'period_start'  => $periodStart,
                ],
                [
                    'class_id'              => $student->class_id,
                    'period_label'          => $periodLabel,
                    'period_end'            => $periodEnd,
                    'summary_academic'      => $summary['academic'] ?? null,
                    'summary_attendance'    => $summary['attendance'] ?? null,
                    'summary_behavior'      => $summary['behavior'] ?? null,
                    'summary_activity'      => $summary['activity'] ?? null,
                    'summary_recommendation'=> $summary['recommendation'] ?? null,
                    'full_report'           => $summary['full'] ?? null,
                    'stats_snapshot'        => $statsSnapshot,
                    'radar_snapshot'        => $calculated['radar_data'] ?? null,
                ]
            );

            // 4. Send push notification
            if ($student->auth_user_id) {
                $this->sendPushNotification($student, $report, $type, $periodLabel);
            }
        }
    }

    private function gatherStudentData(Student $student, string $periodStart, string $periodEnd): array
    {
        // Grades
        $grades = Grade::where('student_id', $student->id)
            ->whereBetween('date', [$periodStart, $periodEnd])
            ->with('subject')
            ->get();

        // Attendance
        $attendances = Attendance::where('student_id', $student->id)
            ->whereBetween('date', [$periodStart, $periodEnd])
            ->get();

        $attendanceCounts = $attendances->groupBy('status')->map->count();
        $hadir = $attendanceCounts->get('hadir', 0);
        $sakit = $attendanceCounts->get('sakit', 0);
        $izin  = $attendanceCounts->get('izin', 0);
        $alpa  = $attendanceCounts->get('alpa', 0);
        $totalAtt = $attendances->count();
        $attPct = $totalAtt > 0 ? round(($hadir / $totalAtt) * 100, 1) : 0;

        // Infractions
        $infractions = Infraction::where('student_id', $student->id)
            ->whereBetween('date', [$periodStart, $periodEnd])
            ->get();
        $totalInfractionPoints = $infractions->sum('points');

        // Keaktifan
        $totalKeaktifan = StudentActivityPoint::where('student_id', $student->id)
            ->whereBetween('date', [$periodStart, $periodEnd])
            ->sum('point');

        // Per subject grades summary
        $bySubject = $grades->groupBy('subject_id')->map(fn($r, $id) => [
            'subject' => $r->first()->subject?->name ?? 'Tanpa Mapel',
            'avg'    => round($r->avg('score'), 1),
            'count'  => $r->count(),
            'types'  => $r->groupBy('type')->map(fn($t) => round($t->avg('score'), 1))->toArray(),
        ])->values()->toArray();

        return [
            'student_name'   => $student->name,
            'class_name'     => $student->class?->rombel ?? '-',
            'period_start'   => $periodStart,
            'period_end'     => $periodEnd,
            'grades'         => $bySubject,
            'attendance'     => [
                'hadir' => $hadir, 'sakit' => $sakit, 'izin' => $izin, 'alpa' => $alpa,
                'total' => $totalAtt, 'percentage' => $attPct,
            ],
            'totalInfractionPoints' => $totalInfractionPoints,
            'totalInfractions'      => $infractions->count(),
            'totalKeaktifan'        => $totalKeaktifan,
            'infractions'           => $infractions->map(fn($i) => [
                'date' => $i->date?->toDateString(),
                'type' => $i->infractionType?->name,
                'points' => $i->points,
            ])->toArray(),
            'keaktifanDetails' => StudentActivityPoint::where('student_id', $student->id)
                ->whereBetween('date', [$periodStart, $periodEnd])
                ->with('category')
                ->get()
                ->groupBy('category.name')
                ->map(fn($items) => [
                    'count' => $items->count(),
                    'points'=> $items->sum('point'),
                ])->toArray(),
        ];
    }

    private function generateSummaries(Student $student, array $data, string $type, string $periodLabel): array
    {
        $studentName = $student->name;
        $className   = $data['class_name'];
        $gradesJson  = json_encode($data['grades'], JSON_UNESCAPED_UNICODE);
        $attJson     = json_encode($data['attendance'], JSON_UNESCAPED_UNICODE);
        $keaktifanJson = json_encode($data['keaktifanDetails'], JSON_UNESCAPED_UNICODE);

        // Build AI prompt
        $systemInstruction = <<<TXT
Anda adalah asisten AI yang membantu guru membuat laporan perkembangan siswa untuk orang tua/wali murid.
Gaya bahasa: ramah, informatif, menyemangati. 
Format jawaban: paragraph teks yang mudah dibaca orang tua (bukan JSON atau kode).
Jangan gunakan emoji berlebihan. Gunakan bahasa Indonesia yang sopan dan komunikatif.
TXT;

        $prompt = <<<TXT
Buatkan laporan perkembangan siswa untuk orang tua/wali murid dengan detail berikut:

IDENTITAS:
- Nama Siswa: {$studentName}
- Kelas: {$className}
- Periode: {$periodLabel} ({$data['period_start']} s/d {$data['period_end']})

DATA NILAI (Rata-rata per Mapel):
{$gradesJson}

DATA KEHADIRAN:
{$attJson}

DATA KEAKTIFAN (point per kategori):
{$keaktifanJson}

POIN PELANGGARAN PERIODE INI: {$data['totalInfractionPoints']} poin ({$data['totalInfractions']} kali)
TXT;

        // Different sub-prompts for structured output
        $academic = $this->safeCallGemini(
            "Berdasarkan data berikut, tulis 1-2 paragraf ringkasan akademik untuk orang tua:\n\n" .
            "Nama: {$studentName}, Kelas: {$className}\nNilai: {$gradesJson}\n" .
            "Fokus pada mapel yang baik dan yang perlu peningkatan. Gunakan bahasa menyemangati.",
            $systemInstruction
        );

        $attendance = $this->safeCallGemini(
            "Tulis 1 paragraf ringkasan kehadiran untuk orang tua:\n\n" .
            "Nama: {$studentName}\nKehadiran: {$attJson}\n" .
            "Jangan menghakimi, tapi mendorong perbaikan.",
            $systemInstruction
        );

        $behavior = $this->safeCallGemini(
            "Tulis 1 paragraf ringkasan perilaku/disiplin untuk orang tua:\n\n" .
            "Nama: {$studentName}\nPelanggaran periode ini: {$data['totalInfractionPoints']} poin.\n" .
            "Jika 0, berikan apresiasi. Jika ada, sampaikan secara konstruktif.",
            $systemInstruction
        );

        $activity = $this->safeCallGemini(
            "Tulis 1 paragraf tentang keaktifan siswa di kelas:\n\n" .
            "Nama: {$studentName}\nKeaktifan: {$keaktifanJson}\n" .
            "Hargai setiap bentuk partisipasi. Dorong untuk lebih aktif.",
            $systemInstruction
        );

        $recommendation = $this->safeCallGemini(
            "Berdasarkan data berikut, tulis 1 paragraf saran/rekomendasi untuk orang tua:\n\n" .
            "Nama: {$studentName}\nNilai: {$gradesJson}\nKehadiran: {$attJson}\n" .
            "Pelanggaran: {$data['totalInfractionPoints']} poin\nKeaktifan: {$keaktifanJson}\n" .
            "Saran konkret yang bisa dilakukan orang tua di rumah.",
            $systemInstruction
        );

        $full = $this->safeCallGemini($prompt, $systemInstruction);

        return [
            'academic'      => $academic,
            'attendance'    => $attendance,
            'behavior'      => $behavior,
            'activity'      => $activity,
            'recommendation'=> $recommendation,
            'full'          => $full,
        ];
    }

    

    private function sendPushNotification(Student $student, ParentReport $report, string $type, string $periodLabel): void
    {
        $title = '📋 Laporan ' . ($type === 'weekly' ? 'Mingguan' : 'Bulanan') . " {$student->name}";
        $body = $report->summary_academic
            ? substr($report->summary_academic, 0, 150) . '...'
            : "Laporan perkembangan {$student->name} untuk periode {$periodLabel} sudah tersedia.";

        PushNotificationService::sendToStudentParent(
            $student->id,
            $title,
            $body,
            '/parent/laporan'
        );

        $report->update(['is_sent' => true, 'sent_at' => now()]);
    }
}
