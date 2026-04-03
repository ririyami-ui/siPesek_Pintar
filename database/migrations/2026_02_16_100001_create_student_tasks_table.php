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
        Schema::create('student_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('deadline');
            $table->string('class_name')->nullable(); // Store class name string for display
            $table->foreignId('class_id')->nullable()->constrained('classes')->onDelete('set null'); // Optional link
            $table->string('subject_name')->nullable();
            $table->foreignId('subject_id')->nullable()->constrained('subjects')->onDelete('set null'); // Optional link
            $table->string('status')->default('Pending'); // Pending, Completed
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
        Schema::dropIfExists('student_tasks');
    }
};
