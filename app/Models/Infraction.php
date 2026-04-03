<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Infraction extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'student_id',
        'date',
        'points',
        'description',
        'category',
        'semester',
        'academic_year',
    ];

    protected $casts = [
        'date' => 'date',
        'points' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
