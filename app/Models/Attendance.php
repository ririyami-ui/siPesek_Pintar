<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attendance extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'student_id',
        'class_id',
        'subject_id',
        'date',
        'status',
        'note',
        'user_id',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    // [VALIDATION] Define allowed attendance statuses
    public const STATUS_HADIR = 'hadir';
    public const STATUS_SAKIT = 'sakit';
    public const STATUS_IZIN  = 'izin';
    public const STATUS_ALPA  = 'alpa';

    public static function getAllowedStatuses(): array
    {
        return [
            self::STATUS_HADIR,
            self::STATUS_SAKIT,
            self::STATUS_IZIN,
            self::STATUS_ALPA,
        ];
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
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
