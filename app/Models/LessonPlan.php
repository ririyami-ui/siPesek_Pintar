<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LessonPlan extends Model
{
    protected $fillable = [
        'user_id',
        'subject_id',
        'subject',
        'grade_level',
        'topic',
        'kd',
        'student_characteristics',
        'content',
        'assessment_model',
        'academic_year',
        'semester',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
