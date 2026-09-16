<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class UlanganHarianItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'rpp_id',
        'rpp_topic',
        'class_id',
        'class_name',
        'subject_id',
        'subject_name',
        'date',
        'item_meta',
        'scores',
        'kktp_score',
        'target_klasikal',
        'remidi_scores',
        'semester',
        'academic_year',
    ];

    protected $casts = [
        'date' => 'date',
        'item_meta' => 'array',
        'scores' => 'array',
        'remidi_scores' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function rpp()
    {
        return $this->belongsTo(LessonPlan::class, 'rpp_id');
    }

    public function schoolClass()
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
