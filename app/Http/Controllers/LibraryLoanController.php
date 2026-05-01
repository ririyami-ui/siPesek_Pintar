<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\LibraryLoan;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class LibraryLoanController extends Controller
{
    /**
     * List all loans with filters
     */
    public function index(Request $request)
    {
        $query = LibraryLoan::with(['student', 'book', 'librarian']);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('student_id')) {
            $query->where('student_id', $request->student_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('student', function($q) use ($search) {
                $q->where('name', 'like', "%$search%")->orWhere('nis', 'like', "%$search%");
            })->orWhereHas('book', function($q) use ($search) {
                $q->where('title', 'like', "%$search%")->orWhere('isbn', 'like', "%$search%");
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
            'book_id' => 'required|exists:books,id',
            'loan_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:loan_date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $book = Book::find($request->book_id);

        if ($book->available_stock <= 0) {
            return response()->json(['message' => 'Stok buku ini sedang kosong.'], 400);
        }

        // Check if student already has an active loan for this book
        $existingLoan = LibraryLoan::where('student_id', $request->student_id)
            ->where('book_id', $request->book_id)
            ->where('status', 'dipinjam')
            ->first();

        if ($existingLoan) {
            return response()->json(['message' => 'Siswa ini sudah meminjam buku yang sama dan belum dikembalikan.'], 400);
        }

        $loan = LibraryLoan::create([
            'student_id' => $request->student_id,
            'book_id' => $request->book_id,
            'loan_date' => $request->loan_date,
            'due_date' => $request->due_date,
            'status' => 'dipinjam',
            'librarian_id' => auth()->id(),
        ]);

        // Reduce stock
        $book->decrement('available_stock');

        return response()->json([
            'message' => 'Peminjaman berhasil dicatat',
            'data' => $loan->load(['student', 'book'])
        ], 201);
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
        return response()->json([
            'total_books' => Book::count(),
            'active_loans' => LibraryLoan::whereIn('status', ['dipinjam', 'terlambat'])->count(),
            'total_students_borrowing' => LibraryLoan::whereIn('status', ['dipinjam', 'terlambat'])->distinct('student_id')->count('student_id'),
            'overdue_loans' => LibraryLoan::where('status', 'dipinjam')->where('due_date', '<', Carbon::now()->toDateString())->count(),
        ]);
    }
}
