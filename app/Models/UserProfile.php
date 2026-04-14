<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'school_name',
        'school_level',
        'npsn',
        'nss',
        'address',
        'logo_path',
        'principalName',
        'principalNip',
        'active_semester',
        'academic_year',
        'school_days',
        'gemini_model',
        'google_ai_api_key',
        'schedule_notifications_enabled',
        'audio_language',
        'teaching_time_slots',
    ];

    protected $casts = [
        'schedule_notifications_enabled' => 'boolean',
        'teaching_time_slots' => 'array',
    ];

    /**
     * Get the user that owns the profile
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
