<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TeachingProgram extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'subject_id',
        'class_id',
        'type',
        'grade_level',
        'pekan_efektif',
        'atp_items',
        'prota',
        'promes',
        'jp_per_week',
        'total_effective_weeks',
        'total_effective_hours',
        'week',
        'month',
        'topic',
        'subtopic',
        'status',
        'semester',
        'academic_year',
        'notes',
    ];

    protected $casts = [
        'pekan_efektif' => 'array',
        'atp_items' => 'array',
        'prota' => 'array',
        'promes' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function schoolClass()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
