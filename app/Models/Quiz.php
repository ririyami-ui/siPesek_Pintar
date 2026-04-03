<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Quiz extends Model
{
    protected $fillable = [
        'user_id',
        'subject',
        'grade_level',
        'topic',
        'quiz_data',
        'academic_year',
        'semester',
        'is_saved'
    ];

    protected $casts = [
        'quiz_data' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
