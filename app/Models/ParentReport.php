<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ParentReport extends Model
{
    protected $fillable = [
        'student_id',
        'class_id',
        'type',
        'period_label',
        'period_start',
        'period_end',
        'summary_academic',
        'summary_attendance',
        'summary_behavior',
        'summary_activity',
        'summary_recommendation',
        'full_report',
        'stats_snapshot',
        'radar_snapshot',
        'is_sent',
        'sent_at',
        'read_at',
    ];

    protected $casts = [
        'period_start'    => 'date',
        'period_end'      => 'date',
        'stats_snapshot'  => 'array',
        'radar_snapshot'  => 'array',
        'is_sent'         => 'boolean',
        'sent_at'         => 'datetime',
        'read_at'         => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function class(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
