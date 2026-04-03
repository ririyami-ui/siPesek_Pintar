<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class KktpAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'rpp_id',
        'rpp_topic',
        'class_id',
        'class_name',
        'subject_id',
        'subject_name',
        'date',
        'scores',
        'kktp_type',
        'manual_criteria',
        'semester',
        'academic_year',
    ];

    protected $casts = [
        'date' => 'date',
        'scores' => 'array',
        'manual_criteria' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function rpp()
    {
        return $this->belongsTo(LessonPlan::class, 'rpp_id');
    }

    public function schoolClass() // avoiding class keyword
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }
}
