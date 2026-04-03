<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Handout extends Model
{
    protected $fillable = [
        'user_id',
        'topic',
        'subject_id',
        'subject',
        'grade_level',
        'content',
        'teacher_name',
        'teacher_title',
        'school'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
