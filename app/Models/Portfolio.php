<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Portfolio extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'academic_year',
        'semester',
        'content',
        'status',
    ];

    protected $casts = [
        'content' => 'json',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
