<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('substitution_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('original_teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->enum('status', ['pending', 'approved', 'dismissed'])->default('pending');
            $table->foreignId('substitute_teacher_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('detection_method', ['no_journal', 'no_attendance', 'both'])->nullable();
            $table->timestamp('substitute_notified_at')->nullable();
            $table->timestamps();

            // Prevent duplicate detection per schedule per day
            $table->unique(['schedule_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('substitution_recommendations');
    }
};
