<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AssignSemesterToBooks extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'books:assign-semester';

    /**
     * The console command description.
     */
    protected $description = 'Assign semester (Ganjil/Genap) to book chapters where missing.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $basePath = base_path('resources/json/books');
        $files = $this->getJsonFiles($basePath);
        $this->info('Found ' . count($files) . ' book files.');

        foreach ($files as $file) {
            $fullPath = $basePath . '/' . $file;
            $content = json_decode(file_get_contents($fullPath), true);
            if (!isset($content['chapters'])) {
                continue;
            }
            $changed = false;
            foreach ($content['chapters'] as $idx => &$ch) {
                if (isset($ch['semester']) && $ch['semester'] !== null) {
                    continue; // already set
                }
                // Determine semester: odd index (1‑based) => Ganjil, even => Genap
                $semester = ((($idx + 1) % 2) === 1) ? 'Ganjil' : 'Genap';
                $ch['semester'] = $semester;
                $changed = true;
            }
            unset($ch); // break reference
            if ($changed) {
                // Preserve formatting
                file_put_contents($fullPath, json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                $this->info("Updated {$file}");
            }
        }
        $this->info('Semester assignment completed.');
    }

    /**
     * Recursively collect json files relative to base path.
     */
    protected function getJsonFiles(string $dir, string $prefix = ''): array
    {
        $result = [];
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $full = $dir . '/' . $item;
            $rel = $prefix . $item;
            if (is_dir($full)) {
                $result = array_merge($result, $this->getJsonFiles($full, $rel . '/'));
            } elseif (pathinfo($item, PATHINFO_EXTENSION) === 'json') {
                $result[] = $rel;
            }
        }
        return $result;
    }
}
?>
