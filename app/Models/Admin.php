<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Admin extends Model
{
    use HasFactory;

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

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function authUser()
    {
        return $this->belongsTo(User::class, 'auth_user_id');
    }
}
