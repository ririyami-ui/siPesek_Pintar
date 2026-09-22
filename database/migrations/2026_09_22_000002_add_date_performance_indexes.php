<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (! Schema::hasIndex('attendances', 'attendances_date_index')) {
                $table->index('date');
            }
        });

        Schema::table('journals', function (Blueprint $table) {
            if (! Schema::hasIndex('journals', 'journals_date_index')) {
                $table->index('date');
            }
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            if (! Schema::hasIndex('audit_logs', 'audit_logs_created_at_index')) {
                $table->index('created_at');
            }
        });

        Schema::table('ulangan_harian_items', function (Blueprint $table) {
            if (! Schema::hasIndex('ulangan_harian_items', 'ulangan_harian_items_date_index')) {
                $table->index('date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropIndex('attendances_date_index');
        });

        Schema::table('journals', function (Blueprint $table) {
            $table->dropIndex('journals_date_index');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_created_at_index');
        });

        Schema::table('ulangan_harian_items', function (Blueprint $table) {
            $table->dropIndex('ulangan_harian_items_date_index');
        });
    }
};
