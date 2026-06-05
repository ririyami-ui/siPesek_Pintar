<?php

namespace App\Services;

use Illuminate\Support\Facades\File;

class CurriculumService
{
    /**
     * Ambil indeks semua buku yang tersedia
     */
    public function getBookIndex()
    {
        $path = base_path('resources/json/books/index.json');
        if (!File::exists($path)) return [];
        return json_decode(File::get($path), true);
    }

    /**
     * Ambil konten buku spesifik berdasarkan ID
     */
    public function getBookContent($bookId)
    {
        $index = $this->getBookIndex();
        $bookInfo = collect($index)->firstWhere('id', $bookId);

        if (!$bookInfo) return null;

        $path = base_path('resources/json/books/' . $bookInfo['path']);
        if (!File::exists($path)) return null;

        return json_decode(File::get($path), true);
    }

    /**
     * Mencari materi/bab yang relevan berdasarkan keyword
     */
    public function findRelevantMateri($bookId, $query)
    {
        $content = $this->getBookContent($bookId);
        if (!$content || !isset($content['materi'])) return null;

        // Cari bab yang judulnya mengandung query atau materi di dalamnya
        return collect($content['materi'])->filter(function($item) use ($query) {
            return stripos($item['bab'] ?? '', $query) !== false || 
                   stripos(json_encode($item), $query) !== false;
        })->first();
    }
}
