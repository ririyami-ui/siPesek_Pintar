<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Book extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'author',
        'isbn',
        'category',
        'total_stock',
        'available_stock',
        'location',
        'cover_url',
    ];

    public function loans()
    {
        return $this->hasMany(LibraryLoan::class);
    }
}
