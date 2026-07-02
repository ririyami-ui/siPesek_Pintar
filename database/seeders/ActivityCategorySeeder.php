<?php

namespace Database\Seeders;

use App\Models\ActivityCategory;
use Illuminate\Database\Seeder;

class ActivityCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Aktif Bertanya', 'default_point' => 1, 'icon' => '❓'],
            ['name' => 'Menjawab Pertanyaan', 'default_point' => 1, 'icon' => '✋'],
            ['name' => 'Tugas Tepat Waktu', 'default_point' => 1, 'icon' => '📝'],
            ['name' => 'Kerja Kelompok Aktif', 'default_point' => 1, 'icon' => '🤝'],
            ['name' => 'Inisiatif', 'default_point' => 2, 'icon' => '💡'],
            ['name' => 'Partisipasi Diskusi', 'default_point' => 1, 'icon' => '💬'],
        ];

        foreach ($categories as $cat) {
            ActivityCategory::firstOrCreate(['name' => $cat['name']], $cat);
        }
    }
}
