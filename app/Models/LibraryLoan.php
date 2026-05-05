<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LibraryLoan extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'transaction_id',
        'student_id',
        'book_id',
        'loan_date',
        'due_date',
        'return_date',
        'status',
        'fine_amount',
        'librarian_id',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function book()
    {
        return $this->belongsTo(Book::class);
    }

    public function librarian()
    {
        return $this->belongsTo(User::class, 'librarian_id');
    }
}
