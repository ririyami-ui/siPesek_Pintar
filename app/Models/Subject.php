<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subject extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'code', 'school_level', 'weekly_hours'];

    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }

    public function teachingPrograms()
    {
        return $this->hasMany(TeachingProgram::class);
    }

    public function kktpAssessments()
    {
        return $this->hasMany(KktpAssessment::class);
    }

    public function journals()
    {
        return $this->hasMany(Journal::class);
    }

    public function handouts()
    {
        return $this->hasMany(Handout::class);
    }
}
