<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Teacher extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'created_by',
        'auth_user_id',
        'code',
        'name',
        'nip',
        'username',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
    ];

    protected $appends = ['total_weekly_hours'];

    public function getTotalWeeklyHoursAttribute()
    {
        return $this->assignments()->with('subject')->get()->sum(function($a) {
            return $a->subject ? (int)$a->subject->weekly_hours : 0;
        });
    }

    public function authUser()
    {
        return $this->belongsTo(User::class, 'auth_user_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignments()
    {
        return $this->hasMany(TeacherAssignment::class);
    }
}
