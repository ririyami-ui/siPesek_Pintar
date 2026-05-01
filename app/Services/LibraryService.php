<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LibraryService
{
    /**
     * Fetch book details from Google Books API by ISBN
     */
    public function fetchBookByIsbn(string $isbn)
    {
        try {
            // Clean ISBN (remove dashes/spaces)
            $isbn = str_replace(['-', ' '], '', $isbn);
            
            $response = Http::timeout(10)->get("https://www.googleapis.com/books/v1/volumes", [
                'q' => "isbn:$isbn"
            ]);

            if ($response->successful() && isset($response['items'][0])) {
                $book = $response['items'][0]['volumeInfo'];
                
                return [
                    'title' => $book['title'] ?? 'Unknown Title',
                    'author' => isset($book['authors']) ? implode(', ', $book['authors']) : 'Unknown Author',
                    'isbn' => $isbn,
                    'category' => isset($book['categories']) ? implode(', ', $book['categories']) : 'General',
                    'description' => $book['description'] ?? '',
                    'cover_url' => $book['imageLinks']['thumbnail'] ?? null,
                    'publisher' => $book['publisher'] ?? null,
                    'published_date' => $book['publishedDate'] ?? null,
                    'page_count' => $book['pageCount'] ?? null,
                ];
            }

            return null;
        } catch (\Exception $e) {
            Log::error("Error fetching book by ISBN ($isbn): " . $e->getMessage());
            return null;
        }
    }
}
