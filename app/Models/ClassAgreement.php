<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClassAgreement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'class_id',
        'knowledge_weight',
        'practice_weight',
        'academic_weight',
        'attitude_weight',
        'agreements',
    ];

    public function class()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }
}
