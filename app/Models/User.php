<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'username',
        'password',
        'role',
        'nip',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /**
     * Check if the user has any admin role
     */
    public function isAdmin(): bool
    {
        return in_array($this->role, ['admin', 'adminer']);
    }

    /**
     * Check if the user is a librarian or admin
     */
    public function isLibrarian(): bool
    {
        return in_array($this->role, ['admin', 'adminer', 'librarian']);
    }

    /**
     * Check if the user is a super admin (for very specific bypasses if needed)
     */
    public function isSuperAdmin(): bool
    {
        return $this->username === 'admin' || $this->role === 'admin';
    }

    public function libraryLoans()
    {
        return $this->hasMany(LibraryLoan::class, 'librarian_id');
    }

    protected $appends = ['photo_url'];

    public function getPhotoUrlAttribute(): ?string
    {
        $filename = "profile_photos/{$this->id}.jpg";
        if (file_exists(public_path($filename))) {
            return asset($filename);
        }
        
        $filenamePng = "profile_photos/{$this->id}.png";
        if (file_exists(public_path($filenamePng))) {
            return asset($filenamePng);
        }

        $filenameJpeg = "profile_photos/{$this->id}.jpeg";
        if (file_exists(public_path($filenameJpeg))) {
            return asset($filenameJpeg);
        }

        $filenameWebp = "profile_photos/{$this->id}.webp";
        if (file_exists(public_path($filenameWebp))) {
            return asset($filenameWebp);
        }
        
        return null;
    }
}
