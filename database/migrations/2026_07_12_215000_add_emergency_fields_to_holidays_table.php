<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('holidays', function (Blueprint $table) {
            if (!Schema::hasColumn('holidays', 'is_emergency')) {
                $table->boolean('is_emergency')->default(false)->after('is_holiday');
            }
            if (!Schema::hasColumn('holidays', 'start_time')) {
                $table->time('start_time')->nullable()->after('is_emergency');
            }
            if (!Schema::hasColumn('holidays', 'end_time')) {
                $table->time('end_time')->nullable()->after('start_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('holidays', function (Blueprint $table) {
            $table->dropColumn(['is_emergency', 'start_time', 'end_time']);
        });
    }
};
