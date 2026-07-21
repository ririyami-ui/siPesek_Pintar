<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubstitutionRecommendation extends Model
{
    protected $fillable = [
        'schedule_id',
        'class_id',
        'subject_id',
        'original_teacher_id',
        'date',
        'start_time',
        'end_time',
        'status',
        'substitute_teacher_id',
        'detection_method',
        'substitute_notified_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'start_time' => 'datetime:H:i',
            'end_time' => 'datetime:H:i',
            'substitute_notified_at' => 'datetime',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function originalTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'original_teacher_id');
    }

    public function substituteTeacher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'substitute_teacher_id');
    }
}
