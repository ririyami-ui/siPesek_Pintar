<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Services\LibraryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BookController extends Controller
{
    protected $libraryService;

    public function __construct(LibraryService $libraryService)
    {
        $this->libraryService = $libraryService;
    }

    /**
     * List books with search
     */
    public function index(Request $request)
    {
        $query = Book::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('title', 'like', "%$search%")
                  ->orWhere('author', 'like', "%$search%")
                  ->orWhere('isbn', 'like', "%$search%");
            });
        }

        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        $books = $query->orderBy('title', 'asc')->paginate($request->input('per_page', 20));

        return response()->json($books);
    }

    /**
     * Store a new book
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'author' => 'nullable|string|max:255',
            'isbn' => 'nullable|string|max:50|unique:books,isbn',
            'category' => 'nullable|string|max:100',
            'total_stock' => 'required|integer|min:0',
            'location' => 'nullable|string|max:255',
            'cover_url' => 'nullable|string|url',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $request->all();
        $data['available_stock'] = $request->total_stock; // Initial stock
        
        $book = Book::create($data);

        return response()->json([
            'message' => 'Buku berhasil ditambahkan',
            'data' => $book
        ], 201);
    }

    /**
     * Display a specific book
     */
    public function show(Book $book)
    {
        return response()->json($book);
    }

    /**
     * Update book details
     */
    public function update(Request $request, Book $book)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:255',
            'isbn' => 'sometimes|nullable|string|max:50|unique:books,isbn,' . $book->id,
            'total_stock' => 'sometimes|required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Adjust available stock if total stock changes
        if ($request->has('total_stock')) {
            $diff = $request->total_stock - $book->total_stock;
            $book->available_stock += $diff;
        }

        $book->update($request->all());

        return response()->json([
            'message' => 'Data buku diperbarui',
            'data' => $book
        ]);
    }

    /**
     * Remove a book
     */
    public function destroy(Book $book)
    {
        // Check if book has active loans
        if ($book->loans()->where('status', 'dipinjam')->exists()) {
            return response()->json([
                'message' => 'Gagal menghapus: Buku ini masih memiliki status dipinjam aktif.'
            ], 400);
        }

        $book->delete();

        return response()->json(['message' => 'Buku berhasil dihapus']);
    }

    /**
     * Lookup book details by ISBN using Google Books API
     */
    public function lookup(string $isbn)
    {
        $bookData = $this->libraryService->fetchBookByIsbn($isbn);

        if (!$bookData) {
            return response()->json(['message' => 'Buku tidak ditemukan di database Google Books'], 404);
        }

        return response()->json($bookData);
    }
}
