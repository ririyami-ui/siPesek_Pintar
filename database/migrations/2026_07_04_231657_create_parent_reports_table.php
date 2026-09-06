<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('parent_reports')) {
            return;
        }

        Schema::create('parent_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->enum('type', ['weekly', 'monthly'])->default('weekly');
            $table->string('period_label');
            $table->date('period_start');
            $table->date('period_end');
            $table->text('summary_academic')->nullable();
            $table->text('summary_attendance')->nullable();
            $table->text('summary_behavior')->nullable();
            $table->text('summary_activity')->nullable();
            $table->text('summary_recommendation')->nullable();
            $table->text('full_report')->nullable();
            $table->json('stats_snapshot')->nullable();
            $table->json('radar_snapshot')->nullable();
            $table->boolean('is_sent')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'type', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parent_reports');
    }
};
