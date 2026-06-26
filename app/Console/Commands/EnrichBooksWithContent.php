<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class EnrichBooksWithContent extends Command
{
    protected $signature = 'books:enrich-content
        {--dry-run : Scan only, no file modifications}
        {--no-backup : Skip backing up original files}';

    protected $description = 'Generate atp, rpp, teaching_material, and quiz data for all book JSON files based on existing metadata.';

    /**
     * Remove UTF‑8 BOM if present.
     */
    protected function stripBom(string $text): string
    {
        $bom = pack('H*', 'EFBBBF');
        return preg_replace('/^' . $bom . '/', '', $text);
    }

    public function handle()
    {
        $basePath = base_path('resources/json/books');
        $indexPath = $basePath . '/index.json';

        if (!File::exists($indexPath)) {
            $this->error('index.json not found');
            return 1;
        }

        $index = json_decode($this->stripBom(File::get($indexPath)), true);
        if (!is_array($index)) {
            $this->error('Invalid index.json');
            return 1;
        }

        // Unique book file paths
        $paths = [];
        foreach ($index as $entry) {
            $paths[$entry['path']] = true;
        }

        $dryRun = $this->option('dry-run');
        $noBackup = $this->option('no-backup');
        $stats = ['processed'=>0, 'changed'=>0, 'errors'=>[]];

        foreach (array_keys($paths) as $relPath) {
            $fullPath = $basePath . '/' . $relPath;
            $stats['processed']++;

            if (!File::exists($fullPath)) {
                $stats['errors'][] = "File missing: {$relPath}";
                $this->warn("[SKIP] {$relPath} not found");
                continue;
            }

            $raw = $this->stripBom(File::get($fullPath));
            $book = json_decode($raw, true);
            if (!is_array($book) || !isset($book['chapters'])) {
                $stats['errors'][] = "Invalid JSON: {$relPath}";
                $this->warn("[SKIP] Invalid JSON {$relPath}");
                continue;
            }

            $original = json_encode($book, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $changed = false;

            // Always reset enrichment arrays to avoid duplication
            $book['atp'] = [];
            $book['rpp'] = [];
            $book['teaching_material'] = [];
            $book['quiz'] = [];
            $changed = true;

            // Build ATP entries per sub_topic
            foreach ($book['chapters'] as $chapter) {
                if (empty($chapter['sub_topics'])) continue;
                foreach ($chapter['sub_topics'] as $sub) {
                    $atpEntry = [
                        'chapter_no' => $chapter['no'] ?? null,
                        'materi' => $sub['name'] ?? '',
                        'tp' => $sub['name'] ?? '',
                        'jp' => $sub['suggested_jp'] ?? 1,
                        'kesulitan' => $sub['bloom_level'] ?? 'LOTS',
                        'profilLulusan' => null,
                    ];
                    $book['atp'][] = $atpEntry;
                    $changed = true;
                }
            }

            // Build RPP per chapter
            foreach ($book['chapters'] as $chapter) {
                $learningObjectives = [];
                $activities = [];
                if (!empty($chapter['sub_topics'])) {
                    foreach ($chapter['sub_topics'] as $sub) {
                        $learningObjectives[] = $sub['name'];
                        // Simple activity based on Bloom level
                        $bloom = $sub['bloom_level'] ?? 'LOTS';
                        if ($bloom === 'HOTS') {
                            $activities[] = "Proyek atau investigasi terkait {$sub['name']}";
                        } elseif ($bloom === 'MOTS') {
                            $activities[] = "Latihan aplikasi {$sub['name']}";
                        } else {
                            $activities[] = "Latihan pengenalan {$sub['name']}";
                        }
                    }
                }
                $rppEntry = [
                    'chapter_no' => $chapter['no'] ?? null,
                    'title' => $chapter['title'] ?? '',
                    'learning_objectives' => array_unique($learningObjectives),
                    'activities' => array_unique($activities),
                ];
                $book['rpp'][] = $rppEntry;
                $changed = true;
            }

            // Teaching material strings per chapter
            foreach ($book['chapters'] as $chapter) {
                $material = "Materi: {$chapter['title']} – halaman {$chapter['pages']}";
                $book['teaching_material'][] = $material;
                $changed = true;
            }

            // Generate simple quiz items per chapter (5 per chapter)
            foreach ($book['chapters'] as $chapter) {
                if (empty($chapter['sub_topics'])) continue;
                $subNames = array_column($chapter['sub_topics'], 'name');
                for ($i = 1; $i <= 5; $i++) {
                    $topic = $subNames[array_rand($subNames)];
                    $quizItem = "Soal {$i} (Bab {$chapter['no']}): pertanyaan tentang \"{$topic}\". Pilihan jawaban dapat dibuat berdasarkan istilah kunci.";
                    $book['quiz'][] = $quizItem;
                    $changed = true;
                }
            }

            if ($changed) {
                $stats['changed']++;
                $newJson = json_encode($book, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
                if (!$dryRun) {
                    if (!$noBackup) {
                        $backup = $fullPath . '.bak.' . date('Ymd_His');
                        File::put($backup, $original);
                    }
                    File::put($fullPath, $newJson);
                    $this->info("[✓] {$relPath} enriched");
                } else {
                    $this->info("[~] {$relPath} would be enriched (dry‑run)");
                }
            } else {
                $this->line("[·] {$relPath} already complete");
            }
        }

        $this->newLine();
        $this->info('===== Enrichment Summary =====');
        $this->info('Processed files: ' . $stats['processed']);
        $this->info('Files changed:   ' . $stats['changed']);
        if (!empty($stats['errors'])) {
            $this->warn('Errors: ' . count($stats['errors']));
            foreach ($stats['errors'] as $e) {
                $this->warn(' - ' . $e);
            }
        }
        $this->info('==============================');

        return 0;
    }
}
