<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class UpdateBookSchema extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'books:update-schema';

    /**
     * The console command description.
     */
    protected $description = 'Add missing fields (bloom_level, suggested_jp, semester) to all book JSON files';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $basePath = base_path('resources/json/books');
        $files = $this->getJsonFiles($basePath);
        $this->info("Found " . count($files) . " book files.");
        foreach ($files as $file) {
            $fullPath = $basePath . '/' . $file;
            $content = json_decode(file_get_contents($fullPath), true);
            if (!isset($content['chapters'])) {
                continue;
            }
            $changed = false;
            foreach ($content['chapters'] as &$chapter) {
                // ensure semester field exists (optional, keep existing if present)
                if (!isset($chapter['semester'])) {
                    $chapter['semester'] = null; // will be filled later if needed
                    $changed = true;
                }
                if (!isset($chapter['sub_topics'])) {
                    continue;
                }
                foreach ($chapter['sub_topics'] as $idx => $sub) {
                    // sub_topic may be string or object; normalize to object
                    if (is_string($sub)) {
                        $sub = ['name' => $sub];
                    }
                    if (!isset($sub['bloom_level'])) {
                        $sub['bloom_level'] = 'LOTS';
                        $changed = true;
                    }
                    if (!isset($sub['suggested_jp'])) {
                        $sub['suggested_jp'] = 1;
                        $changed = true;
                    }
                    $chapter['sub_topics'][$idx] = $sub;
                }
            }
            if ($changed) {
                file_put_contents($fullPath, json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                $this->info("Updated {$file}");
            }
        }
        $this->info('Schema update completed.');
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
