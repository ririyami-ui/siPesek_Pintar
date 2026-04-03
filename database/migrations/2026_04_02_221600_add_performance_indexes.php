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
        Schema::table('schedules', function (Blueprint $table) {
            $table->index(['teacher_id', 'day', 'start_time', 'end_time'], 'idx_schedule_collision');
            $table->index('type');
        });

        Schema::table('teacher_assignments', function (Blueprint $table) {
            $table->index(['class_id', 'subject_id'], 'idx_assignment_lookup');
        });

        Schema::table('journals', function (Blueprint $table) {
            $table->index(['class_id', 'subject_id', 'date'], 'idx_journal_monitoring');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropIndex('idx_schedule_collision');
            $table->dropIndex(['type']);
        });

        Schema::table('teacher_assignments', function (Blueprint $table) {
            $table->dropIndex('idx_assignment_lookup');
        });

        Schema::table('journals', function (Blueprint $table) {
            $table->dropIndex('idx_journal_monitoring');
        });
    }
};
