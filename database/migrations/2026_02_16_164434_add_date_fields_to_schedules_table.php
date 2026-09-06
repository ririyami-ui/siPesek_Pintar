<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            // Add columns only if they don't exist
            $columns = collect(DB::select("SHOW COLUMNS FROM schedules"))
                ->pluck('Field')
                ->toArray();

            if (!in_array('start_date', $columns)) {
                $table->date('start_date')->nullable()->after('day');
            }
            if (!in_array('end_date', $columns)) {
                $table->date('end_date')->nullable()->after('start_date');
            }
            if (!in_array('is_recurring', $columns)) {
                $table->boolean('is_recurring')->default(true)->after('end_date');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn(['start_date', 'end_date', 'is_recurring']);
        });
    }
};
