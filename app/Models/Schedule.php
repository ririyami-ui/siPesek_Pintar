<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'class_id', 'subject_id', 'teacher_id', 'day', 'type', 
        'start_period', 'end_period', 'start_time', 'end_time',
        'start_date', 'end_date', 'is_recurring', 'activity_name'
    ];

    protected $casts = [
        'class_id' => 'integer',
        'subject_id' => 'integer',
        'teacher_id' => 'integer',
        'is_recurring' => 'boolean',
    ];

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
        return $this->belongsTo(User::class, 'teacher_id');
    }
}
