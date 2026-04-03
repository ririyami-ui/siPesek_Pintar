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
            $table->string('type')->default('journal')->after('class_id'); // journal, calendar_structure, subject_program
            $table->string('grade_level')->nullable()->after('type');
            
            // JSON Columns for complex data
            $table->json('pekan_efektif')->nullable()->after('grade_level');
            $table->json('atp_items')->nullable()->after('pekan_efektif');
            $table->json('prota')->nullable()->after('atp_items');
            $table->json('promes')->nullable()->after('prota');
            
            // Summary Columns
            $table->integer('jp_per_week')->nullable()->after('promes');
            $table->integer('total_effective_weeks')->nullable()->after('jp_per_week');
            $table->integer('total_effective_hours')->nullable()->after('total_effective_weeks');

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
