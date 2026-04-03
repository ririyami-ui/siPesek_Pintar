<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'nis', 'nisn', 'name', 'gender',
        'birth_place', 'birth_date', 'absen',
        'class_id', 'user_id', 'auth_user_id',
    ];

    public function class()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    /**
     * The User account used by the parent/student to log in.
     */
    public function authUser()
    {
        return $this->belongsTo(User::class, 'auth_user_id');
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }

    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }
}
