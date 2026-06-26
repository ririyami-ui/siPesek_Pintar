<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SchoolClass extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'classes';

    protected $fillable = ['code', 'level', 'rombel', 'description', 'user_id'];

    public function wali()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function students()
    {
        return $this->hasMany(Student::class, 'class_id');
    }

    public function schedules()
    {
        return $this->hasMany(Schedule::class, 'class_id');
    }

    public function journals()
    {
        return $this->hasMany(Journal::class, 'class_id');
    }

    public function grades()
    {
        return $this->hasMany(Grade::class, 'class_id');
    }

    public function teachingPrograms()
    {
        return $this->hasMany(TeachingProgram::class, 'class_id');
    }

    public function teacherAssignments()
    {
        return $this->hasMany(TeacherAssignment::class, 'class_id');
    }

    public function classAgreements()
    {
        return $this->hasMany(ClassAgreement::class, 'class_id');
    }
}
