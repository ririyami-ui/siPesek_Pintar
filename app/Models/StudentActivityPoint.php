<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentActivityPoint extends Model
{
    protected $fillable = [
        'student_id',
        'teacher_id',
        'class_id',
        'subject_id',
        'activity_category_id',
        'date',
        'point',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'teacher_id');
    }

    public function class()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function category()
    {
        return $this->belongsTo(ActivityCategory::class, 'activity_category_id');
    }
}
