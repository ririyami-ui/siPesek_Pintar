<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Worksheet extends Model
{
    protected $fillable = [
        'user_id',
        'rpp_id',
        'rpp_topic',
        'subject',
        'grade_level',
        'class_id',
        'class_room',
        'content'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
