<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Journal extends Model
{
    use HasFactory;

    protected $fillable = [
        'schedule_id',
        'class_id',
        'subject_id',
        'date',
        'topic',
        'learning_objectives',
        'learning_activities',
        'reflection',
        'status',
        'follow_up',
        'notes',
        'is_assignment',
        'user_id',
    ];

    protected $casts = [
        'date' => 'date',
        'is_assignment' => 'boolean',
    ];

    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }

    public function class()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function subject()
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
