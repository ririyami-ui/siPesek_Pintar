<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Grade extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'student_id',
        'subject_id',
        'class_id',
        'score',
        'type',
        'date',
        'semester',
        'academic_year',
        'topic',
        'notes',
        'kktp_assessment_id',
    ];

    protected $casts = [
        'date' => 'date',
        'score' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function schoolClass()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function kktpAssessment()
    {
        return $this->belongsTo(KktpAssessment::class);
    }
}
