<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class NormalizeBooks extends Command
{
    protected $signature = 'books:normalize
        {--dry-run : Only scan, no changes}
        {--no-backup : Skip backup before writing}';

    protected $description = 'Normalize all book JSON files: consistent format, sub_topics objects, missing fields';

    protected function stripBom($text)
    {
        $bom = pack('H*', 'EFBBBF');
        return preg_replace('/^' . $bom . '/', '', $text);
    }

    public function handle()
    {
        $basePath = base_path('resources/json/books');
        $indexPath = $basePath . '/index.json';

        if (!file_exists($indexPath)) {
            $this->error('index.json not found!');
            return 1;
        }

        $indexJson = $this->stripBom(file_get_contents($indexPath));
        $index = json_decode($indexJson, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error('Invalid index.json: ' . json_last_error_msg());
            return 1;
        }

        $this->info('Found ' . count($index) . ' entries in index.json');

        // Group by path to avoid duplicates
        $paths = [];
        foreach ($index as $entry) {
            $path = $entry['path'] ?? null;
            if ($path) {
                $paths[$path] = true;
            }
        }

        $this->info('Unique book files: ' . count($paths));

        $dryRun = $this->option('dry-run');
        $noBackup = $this->option('no-backup');

        $stats = [
            'total' => 0,
            'normalized' => 0,
            'errors' => [],
            'details' => []
        ];

        // Process each detail file
        foreach ($paths as $relPath => $_) {
            $fullPath = $basePath . '/' . $relPath;
            $stats['total']++;

            if (!file_exists($fullPath)) {
                $stats['errors'][] = "File not found: {$relPath}";
                $this->warn("  [SKIP] File not found: {$relPath}");
                continue;
            }

            $raw = $this->stripBom(file_get_contents($fullPath));
            $content = json_decode($raw, true);
            if (!$content) {
                $stats['errors'][] = "Invalid JSON: {$relPath}";
                $this->warn("  [SKIP] Invalid JSON: {$relPath}");
                continue;
            }

            $original = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $changes = [];

            // --- Top-level fields ---
            if (!isset($content['publisher'])) {
                $content['publisher'] = 'Kemendikbudristek';
                $changes[] = 'add:publisher';
            }

            // Ensure atp, rpp, teaching_material, quiz arrays exist
            foreach (['atp', 'rpp', 'teaching_material', 'quiz'] as $field) {
                if (!isset($content[$field])) {
                    $content[$field] = [];
                    $changes[] = "add:{$field}";
                }
            }

            // --- Chapters ---
            if (!isset($content['chapters']) || !is_array($content['chapters'])) {
                $stats['errors'][] = "No chapters: {$relPath}";
                $this->warn("  [SKIP] No chapters: {$relPath}");
                continue;
            }

            foreach ($content['chapters'] as $ci => &$chapter) {
                // Add semester if missing
                if (!isset($chapter['semester']) || empty($chapter['semester'])) {
                    $chapter['semester'] = (($chapter['no'] ?? $ci + 1) % 2 === 1) ? 'Ganjil' : 'Genap';
                    $changes[] = "ch{$ci}:add:semester";
                }

                // Normalize sub_topics
                if (isset($chapter['sub_topics']) && is_array($chapter['sub_topics'])) {
                    $changed = false;
                    foreach ($chapter['sub_topics'] as $si => &$sub) {
                        if (is_string($sub)) {
                            $sub = [
                                'name' => $sub,
                                'bloom_level' => 'LOTS',
                                'suggested_jp' => 1
                            ];
                            $changed = true;
                        } elseif (is_array($sub)) {
                            if (!isset($sub['name'])) {
                                $sub['name'] = 'Sub-topik ' . ($si + 1);
                                $changed = true;
                            }
                            if (!isset($sub['bloom_level'])) {
                                $sub['bloom_level'] = 'LOTS';
                                $changed = true;
                            }
                            if (!isset($sub['suggested_jp'])) {
                                $sub['suggested_jp'] = 1;
                                $changed = true;
                            }
                        }
                    }
                    unset($sub);
                    if ($changed) {
                        $changes[] = "ch{$ci}:normalize:sub_topics";
                    }
                } else {
                    $chapter['sub_topics'] = [];
                    $changes[] = "ch{$ci}:add:sub_topics";
                }

                // Ensure key_terms exists
                if (!isset($chapter['key_terms']) || !is_array($chapter['key_terms'])) {
                    $chapter['key_terms'] = [];
                    $changes[] = "ch{$ci}:add:key_terms";
                }
            }
            unset($chapter);

            // --- Re-encode with consistent formatting ---
            $normalized = json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // Ensure 4-space indentation (JSON_PRETTY_PRINT uses 4, but some SD files have 5-6)
            $normalized = preg_replace_callback('/^  +/m', function($m) {
                $len = strlen($m[0]);
                $spaces4 = floor($len / 4) * 4;
                if ($spaces4 < $len) {
                    $spaces4 += 4;
                }
                return str_repeat(' ', $spaces4);
            }, $normalized);

            // Trailing newline
            $normalized = rtrim($normalized) . "\n";

            if ($normalized !== $original) {
                $stats['normalized']++;

                $detail = implode(', ', array_unique($changes));
                $stats['details'][] = "  [{$relPath}] → {$detail}";

                if (!$dryRun) {
                    if (!$noBackup) {
                        $backupPath = $fullPath . '.bak.' . date('Ymd_His');
                        file_put_contents($backupPath, $original);
                    }
                    file_put_contents($fullPath, $normalized);
                    $this->line("  <info>✓</info> {$relPath}");
                    if (!empty($changes)) {
                        $this->line("     " . implode(', ', array_unique($changes)));
                    }
                } else {
                    $this->line("  <comment>~</comment> {$relPath} (would normalize)");
                }
            } else {
                $this->line("  <fg=gray>·</fg=gray> {$relPath} (ok)");
            }
        }

        // --- Summary ---
        $this->newLine();
        $this->info('═══════════════════════════════════');
        $this->info('  Normalization Complete');
        $this->info('  Total files scanned: ' . $stats['total']);
        $this->info('  Files normalized:    ' . $stats['normalized']);
        if ($dryRun) {
            $this->info('  Mode: DRY RUN (no changes written)');
        } else {
            $this->info('  Backups: created (.bak)');
        }
        if (!empty($stats['errors'])) {
            $this->warn('  Errors: ' . count($stats['errors']));
            foreach ($stats['errors'] as $err) {
                $this->warn('    - ' . $err);
            }
        }
        $this->info('═══════════════════════════════════');

        if (!empty($stats['details'])) {
            $this->newLine();
            $this->line('Sample changes:');
            $show = array_slice($stats['details'], 0, 10);
            foreach ($show as $d) {
                $this->line($d);
            }
            if (count($stats['details']) > 10) {
                $this->line('  ... and ' . (count($stats['details']) - 10) . ' more');
            }
        }

        return 0;
    }
}
