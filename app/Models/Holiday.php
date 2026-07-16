<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Holiday extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'title',
        'name',
        'start_date',
        'end_date',
        'date',
        'description',
        'type',
        'category',
        'is_holiday',
        'is_emergency',
        'start_time',
        'end_time'
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'date' => 'date',
        'is_holiday' => 'boolean',
        'is_emergency' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
