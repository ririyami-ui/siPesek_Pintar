<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Hapus duplikat: keep only the latest row per unique combination
        DB::statement('
            DELETE g1 FROM grades g1
            INNER JOIN grades g2
            WHERE g1.id < g2.id
            AND g1.user_id = g2.user_id
            AND g1.student_id = g2.student_id
            AND COALESCE(g1.class_id, 0) = COALESCE(g2.class_id, 0)
            AND COALESCE(g1.subject_id, 0) = COALESCE(g2.subject_id, 0)
            AND g1.date = g2.date
            AND g1.type = g2.type
            AND COALESCE(g1.topic, \'\') = COALESCE(g2.topic, \'\')
            AND g1.semester = g2.semester
            AND g1.academic_year = g2.academic_year
        ');

        // 2. Add unique constraint
        Schema::table('grades', function (Blueprint $table) {
            $table->unique(
                ['user_id', 'student_id', 'class_id', 'subject_id', 'date', 'type', 'topic', 'semester', 'academic_year'],
                'grades_unique_combination'
            );
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropUnique('grades_unique_combination');
        });
    }
};
