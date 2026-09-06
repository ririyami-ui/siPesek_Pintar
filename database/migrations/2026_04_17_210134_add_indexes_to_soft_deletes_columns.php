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
        $tables = [
            'users', 'students', 'teachers', 'subjects', 'classes', 
            'grades', 'schedules', 'attendances', 'journals'
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (!Schema::hasIndex('users', 'users_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('students', 'students_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('teachers', 'teachers_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('subjects', 'subjects_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('classes', 'classes_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('grades', 'grades_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('schedules', 'schedules_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('attendances', 'attendances_deleted_at_index')) {
                $table->index('deleted_at');
            }
            if (!Schema::hasIndex('journals', 'journals_deleted_at_index')) {
                $table->index('deleted_at');
            }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tables = [
            'users', 'students', 'teachers', 'subjects', 'classes', 
            'grades', 'schedules', 'attendances', 'journals'
        ];

        foreach ($tables as $tableName) {
            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                $table->dropIndex([ $tableName . '_deleted_at_index' ]);
            });
        }
    }
};
