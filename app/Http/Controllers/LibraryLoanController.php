<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\LibraryLoan;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LibraryLoanController extends Controller
{
    /**
     * List all loans with filters
     */
    public function index(Request $request)
    {
        $query = LibraryLoan::with(['student.class', 'book', 'librarian']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('transaction_id', 'like', "%$search%")
                  ->orWhereHas('student', function($sq) use ($search) {
                      $sq->where('name', 'like', "%$search%")
                        ->orWhere('nis', 'like', "%$search%")
                        ->orWhere('nisn', 'like', "%$search%");
                  })
                  ->orWhereHas('book', function($bq) use ($search) {
                      $bq->where('title', 'like', "%$search%")
                        ->orWhere('isbn', 'like', "%$search%");
                  });
            });
        }

        $loans = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 20));

        return response()->json($loans);
    }

    /**
     * Store a new loan
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'student_id' => 'required|exists:students,id',
            'book_ids' => 'required|array|min:1',
            'book_ids.*' => 'exists:books,id',
            'loan_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:loan_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        DB::beginTransaction();

        try {
            $createdLoans = [];
            
            // Generate a unique transaction ID for this group of books
            $transactionId = 'TRX-' . strtoupper(bin2hex(random_bytes(4)));

            // Get unique book IDs to avoid duplicate processing in same transaction
            $bookIds = array_unique($request->book_ids);

            foreach ($bookIds as $bookId) {
                $book = Book::find($bookId);

                if ($book->available_stock <= 0) {
                    throw new \Exception("Stok buku '{$book->title}' sedang kosong.");
                }

                // Check if student already has an active loan for this book
                $existingLoan = LibraryLoan::where('student_id', $request->student_id)
                    ->where('book_id', $bookId)
                    ->where('status', 'dipinjam')
                    ->first();

                if ($existingLoan) {
                    throw new \Exception("Siswa ini sudah meminjam buku '{$book->title}' dan belum dikembalikan.");
                }

                $loan = LibraryLoan::create([
                    'transaction_id' => $transactionId,
                    'student_id' => $request->student_id,
                    'book_id' => $bookId,
                    'loan_date' => $request->loan_date,
                    'due_date' => $request->due_date,
                    'status' => 'dipinjam',
                    'librarian_id' => auth()->id(),
                ]);

                // Reduce stock
                $book->decrement('available_stock');
                
                $createdLoans[] = $loan->load(['student', 'book', 'librarian']);
            }

            DB::commit();

            return response()->json([
                'message' => 'Peminjaman berhasil dicatat',
                'transaction_id' => $transactionId,
                'data' => $createdLoans
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    /**
     * Get loans by transaction ID (for barcode scan)
     */
    public function getTransaction($transactionId)
    {
        $loans = LibraryLoan::with(['student.class', 'book', 'librarian'])
            ->where('transaction_id', $transactionId)
            ->get();

        if ($loans->isEmpty()) {
            return response()->json(['message' => 'Transaksi tidak ditemukan'], 404);
        }

        return response()->json($loans);
    }

    /**
     * Update an existing loan dates
     */
    public function update(Request $request, LibraryLoan $loan)
    {
        $validator = Validator::make($request->all(), [
            'loan_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:loan_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $loan->update([
            'loan_date' => $request->loan_date,
            'due_date' => $request->due_date,
        ]);

        return response()->json([
            'message' => 'Data sirkulasi berhasil diperbarui',
            'data' => $loan->load(['student', 'book', 'librarian'])
        ]);
    }

    /**
     * Process return of a book
     */
    public function returnBook(Request $request, LibraryLoan $loan)
    {
        if ($loan->status !== 'dipinjam' && $loan->status !== 'terlambat') {
            return response()->json(['message' => 'Buku ini sudah dikembalikan sebelumnya.'], 400);
        }

        $returnDate = $request->input('return_date', Carbon::now()->toDateString());
        $loan->return_date = $returnDate;
        
        // Check for late return
        $dueDate = Carbon::parse($loan->due_date);
        $actualReturnDate = Carbon::parse($returnDate);
        
        if ($actualReturnDate->gt($dueDate)) {
            $loan->status = 'kembali'; // Or keep 'terlambat' status for history? 
            // In many systems, status becomes 'kembali' but with a record of delay
            
            // Calculate fine if needed (e.g., 1000 per day)
            $daysLate = $actualReturnDate->diffInDays($dueDate);
            $loan->fine_amount = $daysLate * 1000; // Example fine logic
        } else {
            $loan->status = 'kembali';
        }

        $loan->save();

        // Increase stock
        $loan->book->increment('available_stock');

        return response()->json([
            'message' => 'Buku berhasil dikembalikan',
            'data' => $loan->load(['student', 'book'])
        ]);
    }

    /**
     * Get summary stats for library dashboard
     */
    public function stats()
    {
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth()->toDateString();
        $endOfMonth = $now->copy()->endOfMonth()->toDateString();

        return response()->json([
            'total_books' => Book::count(),
            'total_physical_books' => Book::sum('total_stock') ?? 0,
            'active_loans' => LibraryLoan::where('status', 'dipinjam')->count(),
            'total_students_borrowing' => LibraryLoan::where('status', 'dipinjam')->distinct('student_id')->count('student_id'),
            'overdue_loans' => LibraryLoan::where('status', 'dipinjam')
                ->where('due_date', '<', $now->toDateString())
                ->count(),
            
            // Real Monthly Stats
            'monthly_loans' => LibraryLoan::whereBetween('loan_date', [$startOfMonth, $endOfMonth])->count(),
            'monthly_returns' => LibraryLoan::whereBetween('return_date', [$startOfMonth, $endOfMonth])
                ->where('status', 'kembali')
                ->count(),

            'popular_books' => LibraryLoan::select('book_id', DB::raw('count(*) as total'))
                ->groupBy('book_id')
                ->orderByDesc('total')
                ->take(5)
                ->with('book')
                ->get(),
                
            'active_students' => LibraryLoan::select('student_id', DB::raw('count(*) as total'))
                ->groupBy('student_id')
                ->orderByDesc('total')
                ->take(5)
                ->with('student')
                ->get(),
        ]);
    }

    /**
     * Get Report by Classification (Category)
     */
    public function getClassificationReport()
    {
        $books = Book::all()->groupBy('category');
        
        $report = [];
        foreach ($books as $category => $items) {
            $report[] = [
                'category' => $category ?: 'Lainnya / Belum Dikategorikan',
                'books' => $items->map(function($book) {
                    return [
                        'title' => $book->title,
                        'isbn' => $book->isbn,
                        'stock' => $book->total_stock
                    ];
                }),
                'total_titles' => $items->count(),
                'total_physical' => $items->sum('total_stock')
            ];
        }

        return response()->json($report);
    }

    /**
     * Get Borrowers Report
     */
    public function borrowersReport()
    {
        $data = LibraryLoan::with(['student.class', 'book'])
            ->where('status', 'dipinjam')
            ->orWhere('status', 'terlambat')
            ->orderBy('due_date')
            ->get();

        return response()->json($data);
    }
}
