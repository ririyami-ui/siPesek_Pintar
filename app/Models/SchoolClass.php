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
}
