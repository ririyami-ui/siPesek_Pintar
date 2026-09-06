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
        Schema::table('teaching_programs', function (Blueprint $table) {
            if (!Schema::hasColumn('teaching_programs', 'type')) {
                $table->string('type')->default('journal')->after('class_id'); // journal, calendar_structure, subject_program
            }
            if (!Schema::hasColumn('teaching_programs', 'grade_level')) {
                $table->string('grade_level')->nullable()->after('type');
            }
            
            // JSON Columns for complex data
            if (!Schema::hasColumn('teaching_programs', 'pekan_efektif')) {
                $table->json('pekan_efektif')->nullable()->after('grade_level');
            }
            if (!Schema::hasColumn('teaching_programs', 'atp_items')) {
                $table->json('atp_items')->nullable()->after('pekan_efektif');
            }
            if (!Schema::hasColumn('teaching_programs', 'prota')) {
                $table->json('prota')->nullable()->after('atp_items');
            }
            if (!Schema::hasColumn('teaching_programs', 'promes')) {
                $table->json('promes')->nullable()->after('prota');
            }
            
            // Summary Columns
            if (!Schema::hasColumn('teaching_programs', 'jp_per_week')) {
                $table->integer('jp_per_week')->nullable()->after('promes');
            }
            if (!Schema::hasColumn('teaching_programs', 'total_effective_weeks')) {
                $table->integer('total_effective_weeks')->nullable()->after('jp_per_week');
            }
            if (!Schema::hasColumn('teaching_programs', 'total_effective_hours')) {
                $table->integer('total_effective_hours')->nullable()->after('total_effective_weeks');
            }

            // Relax constraints for non-journal types
            $table->integer('week')->nullable()->change();
            $table->string('month')->nullable()->change();
            $table->text('topic')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teaching_programs', function (Blueprint $table) {
            $table->dropColumn([
                'type', 'grade_level', 'pekan_efektif', 'atp_items', 
                'prota', 'promes', 'jp_per_week', 
                'total_effective_weeks', 'total_effective_hours'
            ]);
            
            $table->integer('week')->nullable(false)->change();
            $table->string('month')->nullable(false)->change();
            $table->text('topic')->nullable(false)->change();
        });
    }
};
