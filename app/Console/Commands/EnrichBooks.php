<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class EnrichBooks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'books:enrich';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Enrich book JSON files with metadata fields for ATP, RPP, teaching material, and quiz to guide AI generators.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $basePath = resource_path('json/books');
        $indexFile = $basePath . DIRECTORY_SEPARATOR . 'index.json';
        if (!File::exists($indexFile)) {
            $this->error('index.json not found in resources/json/books');
            return 1;
        }
        $index = json_decode(File::get($indexFile), true);
        if (!is_array($index)) {
            $this->error('Invalid JSON in index.json');
            return 1;
        }
        foreach ($index as &$entry) {
            // Ensure entry has required fields
            $entry = $this->addMissingFields($entry);
            // Enrich corresponding detail file if exists
            $detailPath = $basePath . DIRECTORY_SEPARATOR . $entry['path'];
            if (File::exists($detailPath)) {
                $detail = json_decode(File::get($detailPath), true);
                if (is_array($detail)) {
                    $detail = $this->addMissingFields($detail);
                    File::put($detailPath, json_encode($detail, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    $this->info('Enriched detail file: ' . $entry['path']);
                }
            }
        }
        // Save updated index
        File::put($indexFile, json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info('Enriched index.json and related files.');
        return 0;
    }

    /**
     * Add placeholder metadata fields if they are missing.
     *
     * @param array $data
     * @return array
     */
    private function addMissingFields(array $data): array
    {
        // Fields to add: atp, rpp, teaching_material, quiz
        $placeholders = [
            'atp' => [], // Annual teaching plan
            'rpp' => [], // Lesson plan
            'teaching_material' => [], // List of material files or URLs
            'quiz' => [], // Quiz structure
        ];
        foreach ($placeholders as $key => $value) {
            if (!array_key_exists($key, $data)) {
                $data[$key] = $value;
            }
        }
        return $data;
    }
}
