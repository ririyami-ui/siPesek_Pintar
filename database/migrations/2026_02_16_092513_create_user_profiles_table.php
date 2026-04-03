<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            
            // School Information
            $table->string('school_name')->nullable();
            $table->string('school_level')->default('SD'); // SD, SMP, SMA, SMK
            $table->string('nip')->nullable();
            $table->string('title')->default('Bapak'); // Bapak/Ibu
            
            // Academic Settings
            $table->string('active_semester')->default('Ganjil');
            $table->string('academic_year')->nullable();
            
            // Gemini AI Settings
            $table->string('gemini_model')->default('gemini-1.5-flash');
            
            // Grading Weights
            $table->integer('academic_weight')->default(50);
            $table->integer('attitude_weight')->default(50);
            
            // Notification Settings
            $table->boolean('schedule_notifications_enabled')->default(true);
            
            $table->timestamps();
            
            // Ensure one profile per user
            $table->unique('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_profiles');
    }
};
