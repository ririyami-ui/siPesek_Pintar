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
        Schema::create('kktp_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('rpp_id')->nullable()->constrained('lesson_plans')->onDelete('set null');
            $table->string('rpp_topic');
            $table->foreignId('class_id')->nullable()->constrained('classes')->onDelete('set null');
            $table->string('class_name')->nullable(); // Store rombel name snapshot
            $table->foreignId('subject_id')->nullable()->constrained()->onDelete('set null');
            $table->string('subject_name')->nullable(); // Store subject name snapshot
            $table->date('date');
            $table->json('scores'); // Stores the assessment scores structure
            $table->string('kktp_type'); // 'Rubrik', 'Deskripsi Kriteria', 'Interval Nilai', 'Manual Rubrik'
            $table->json('manual_criteria')->nullable(); // Stores custom criteria if manual mode
            $table->string('semester');
            $table->string('academic_year');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kktp_assessments');
    }
};
