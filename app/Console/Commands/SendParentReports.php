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
        {--force : Re-generate even if already sent}
        {--no-ai : Pakai template saja, tanpa panggilan Gemini}';

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
        // Note: filter push_subscription hanya untuk jalur massal (cron).
        // Saat --student-id (regenerate admin), tetap proses walau tanpa subscription.
        $query = Student::whereNotNull('auth_user_id');

        if ($studentId) {
            $query->where('id', $studentId);
        } else {
            $query->whereHas('authUser', fn($q) => $q->whereNotNull('push_subscription'));

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
            // Current month: jalur bulanan berjalan tgl 1, sehingga period
            // yang dilaporkan adalah bulan sebelumnya (bulan yang baru selesai).
            $prevMonth = $now->copy()->subMonth();
            $periodStart = $prevMonth->copy()->startOfMonth()->toDateString();
            $periodEnd   = $prevMonth->copy()->endOfMonth()->toDateString();
            $periodLabel = $prevMonth->translatedFormat('F Y'); // e.g. "Juni 2026"
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


            $statsSnapshot = [
                'avg_nilai_akhir'   => $calculated['overall_nilai_akhir'] ?? null,
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
                    'summary_academic'      => $summary['academic'] ?? '',
                    'summary_attendance'    => $summary['attendance'] ?? '',
                    'summary_behavior'      => $summary['behavior'] ?? '',
                    'summary_activity'      => $summary['activity'] ?? '',
                    'summary_recommendation'=> $summary['recommendation'] ?? '',
                    'full_report'           => $summary['full'] ?? '',
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
                'type' => $i->category ?: 'Pelanggaran',
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
        // Template dasar (0 token) — selalu tersedia
        $fallback = $this->generateFallbackSummaries($data, $type, $periodLabel);

        // AI hanya bila: tidak di-disable, key terkonfigurasi, dan ada materi narasi
        $useAi = !$this->option('no-ai')
            && $this->gemini->isConfigured()
            && $this->hasPeriodData($data);

        if (!$useAi) {
            return $fallback;
        }

        // 1 panggilan gabungan → parse JSON → merge (AI menang bila non-empty)
        $ai = $this->generateCombinedSummary($student, $data, $type, $periodLabel);
        if (!$ai) {
            return $fallback;
        }

        return [
            'academic'       => $ai['academic']       ?: $fallback['academic'],
            'attendance'     => $ai['attendance']     ?: $fallback['attendance'],
            'behavior'       => $ai['behavior']       ?: $fallback['behavior'],
            'activity'       => $ai['activity']       ?: $fallback['activity'],
            'recommendation' => $ai['recommendation'] ?: $fallback['recommendation'],
            'full'           => $ai['full']           ?: $fallback['full'],
        ];
    }

    /**
     * Apakah periode ini punya materi narasi yang layak untuk AI?
     * Absensi saja tidak cukup (cukup template).
     */
    private function hasPeriodData(array $data): bool
    {
        return !empty($data['grades'])
            || (int) ($data['totalInfractions'] ?? 0) > 0
            || (int) ($data['totalKeaktifan'] ?? 0) > 0;
    }

    /**
     * Satu panggilan Gemini untuk seluruh bagian laporan (hemat token).
     * Kembalikan array section atau null bila gagal.
     */
    private function generateCombinedSummary(Student $student, array $data, string $type, string $periodLabel): ?array
    {
        $studentName = $student->name;
        $className   = $data['class_name'];
        $gradesJson  = json_encode($data['grades'], JSON_UNESCAPED_UNICODE);
        $attJson     = json_encode($data['attendance'], JSON_UNESCAPED_UNICODE);
        $keaktifanJson = json_encode($data['keaktifanDetails'], JSON_UNESCAPED_UNICODE);

        $systemInstruction = <<<TXT
Anda adalah asisten AI yang membantu guru membuat laporan perkembangan siswa untuk orang tua/wali murid.
Gaya bahasa: ramah, informatif, menyemangati.
Jangan gunakan emoji berlebihan. Gunakan bahasa Indonesia yang sopan dan komunikatif.
BALAS HANYA SATU OBJEK JSON (tanpa teks lain, tanpa markdown):
{"academic":"...","attendance":"...","behavior":"...","activity":"...","recommendation":"...","full":"..."}
Setiap nilai adalah 1-2 paragraf teks siap baca orang tua.
TXT;

        $prompt = <<<TXT
Buatkan laporan perkembangan siswa untuk orang tua/wali murid.

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

Isi setiap bagian:
- academic: ringkasan akademik, fokus mapel baik & perlu peningkatan.
- attendance: ringkasan kehadiran, mendorong perbaikan tanpa menghakimi.
- behavior: ringkasan perilaku/disiplin; jika 0 beri apresiasi, jika ada sampaikan konstruktif.
- activity: ringkasan keaktifan; hargai partisipasi, dorong lebih aktif.
- recommendation: saran konkret untuk orang tua di rumah.
- full: gabungan narasi lengkap.

HANYA JSON, tanpa teks lain.
TXT;

        $raw = $this->safeCallGemini($prompt, $systemInstruction);
        if (!$raw) {
            return null;
        }

        return $this->parseCombinedJson($raw);
    }

    /**
     * Parse JSON dari respons Gemini; strip markdown fence bila perlu.
     */
    private function parseCombinedJson(string $raw): ?array
    {
        $json = trim($raw);

        // Lepas fence ```json ... ```
        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $json, $m)) {
            $json = trim($m[1]);
        }

        // Potong teks di luar objek JSON
        $start = strpos($json, '{');
        $end = strrpos($json, '}');
        if ($start === false || $end === false || $end < $start) {
            return null;
        }
        $json = substr($json, $start, $end - $start + 1);

        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            return null;
        }

        $sections = ['academic', 'attendance', 'behavior', 'activity', 'recommendation', 'full'];
        $out = [];
        foreach ($sections as $s) {
            $val = $decoded[$s] ?? null;
            $out[$s] = is_string($val) && trim($val) !== '' ? trim($val) : null;
        }
        return $out;
    }

    /**
     * Deskripsi singkat perkembangan anak dari data nyata (tanpa AI),
     * dipakai bila Gemini gagal atau API key belum diisi.
     */
    private function generateFallbackSummaries(array $data, string $type, string $periodLabel): array
    {
        $name = $data['student_name'] ?? 'Ananda';
        $grades = $data['grades'] ?? [];
        $att = $data['attendance'] ?? [];
        $attPct = $att['percentage'] ?? 0;
        $hadir = $att['hadir'] ?? 0;
        $sakit = $att['sakit'] ?? 0;
        $izin = $att['izin'] ?? 0;
        $alpa = $att['alpa'] ?? 0;
        $totalAtt = $att['total'] ?? 0;
        $infPts = $data['totalInfractionPoints'] ?? 0;
        $infCount = $data['totalInfractions'] ?? 0;
        $keaktifan = $data['totalKeaktifan'] ?? 0;

        // Akademik
        if (count($grades) === 0) {
            $academic = "Pada periode ini belum tercatat nilai untuk {$name}. " .
                "Guru masih dalam proses penilaian. Bunda/Ayah tetap dapat memantau perkembangan ananda melalui kehadiran dan keaktifan di sekolah.";
        } else {
            $parts = [];
            foreach ($grades as $g) {
                $parts[] = "{$g['subject']}: " . number_format((float) ($g['avg'] ?? 0), 1) . " ({$g['count']} data)";
            }
            $academic = "Selama periode ini, rata-rata nilai ananda adalah: " . implode('; ', $parts) . ". " .
                "Terus dampingi ananda mengulang materi di rumah agar hasil belajar semakin meningkat.";
        }

        // Kehadiran
        if ($totalAtt > 0) {
            $attendance = "Kehadiran {$name} pada periode ini mencapai {$attPct}% ({$hadir} hadir, {$sakit} sakit, {$izin} izin, {$alpa} alpa). " .
                ($alpa > 0
                    ? "Ada catatan alpa, mohon perhatikan keterangan ananda saat tidak hadir."
                    : "Disiplin kehadiran ananda terjaga baik, pertahankan.");
        } else {
            $attendance = "Belum ada catatan kehadiran untuk {$name} pada periode ini.";
        }

        // Perilaku
        if ($infPts > 0) {
            $behavior = "Pada periode ini ananda tercatat {$infCount} catatan pelanggaran dengan total {$infPts} poin. " .
                "Kami mohon kerja sama Bunda/Ayah untuk membimbing ananda agar dapat memperbaiki sikap dan disiplin.";
        } else {
            $behavior = "Tidak ada catatan pelanggaran untuk {$name} pada periode ini. " .
                "Sikap dan kedisiplinan ananda terjaga baik, apresiasi untuk ananda.";
        }

        // Keaktifan
        if ($keaktifan > 0) {
            $activity = "Ananda mengumpulkan {$keaktifan} poin keaktifan pada periode ini. " .
                "Partisipasi aktif seperti ini sangat baik untuk perkembangan belajar, terus pertahankan.";
        } else {
            $activity = "Belum ada poin keaktifan tercatat untuk {$name} pada periode ini. " .
                "Bunda/Ayah dapat mendorong ananda untuk lebih aktif bertanya dan berpartisipasi di kelas.";
        }

        // Rekomendasi
        $recommendation = "Untuk {$periodLabel}, kami sarankan Bunda/Ayah membiasakan diskusi singkat setiap hari tentang kegiatan belajar ananda, " .
            "menemani mengerjakan tugas, dan memberikan apresiasi atas usaha ananda. " .
            "Jika ada kendala, jangan ragu menghubungi wali kelas melalui aplikasi.";

        $className = $data['class_name'] ?? '-';
        // Full
        $full = "Laporan perkembangan {$name} ({$className}) untuk {$periodLabel}.\n\n" .
            "Akademik: {$academic}\n\n" .
            "Kehadiran: {$attendance}\n\n" .
            "Perilaku: {$behavior}\n\n" .
            "Keaktifan: {$activity}\n\n" .
            "Rekomendasi: {$recommendation}";


        return [
            'academic'      => $academic,
            'attendance'    => $attendance,
            'behavior'      => $behavior,
            'activity'      => $activity,
            'recommendation'=> $recommendation,
            'full'          => $full,
        ];
    }

    /**
     * Panggil Gemini dengan sistem instruksi; kembalikan null bila gagal
     * agar laporan tetap tersimpan walau AI error.
     */
    private function safeCallGemini(string $prompt, string $systemInstruction = ''): ?string
    {
        try {
            return $this->gemini->callGeminiApi($prompt, null, 2048, 0.7, $systemInstruction);
        } catch (\Throwable $e) {
            Log::warning("Gemini summary failed for parent report: {$e->getMessage()}");
            return null;
        }
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
