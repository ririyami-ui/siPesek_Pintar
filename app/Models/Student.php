<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Student extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code', 'nis', 'nisn', 'name', 'gender',
        'birth_place', 'birth_date', 'address', 'absen',
        'class_id', 'created_by', 'user_id', 'auth_user_id',
    ];

    public function class()
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

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

    public function libraryLoans()
    {
        return $this->hasMany(LibraryLoan::class);
    }

    public function infractions()
    {
        return $this->hasMany(Infraction::class);
    }

    public function studentNotes()
    {
        return $this->hasMany(StudentNote::class);
    }

    public function parentReports()
    {
        return $this->hasMany(ParentReport::class);
    }
}
