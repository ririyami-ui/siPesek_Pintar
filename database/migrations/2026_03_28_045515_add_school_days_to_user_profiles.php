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
        Schema::table('user_profiles', function (Blueprint $table) {
            $columns = collect(DB::select("SHOW COLUMNS FROM user_profiles"))
                ->pluck('Field')
                ->toArray();

            if (!in_array('school_days', $columns)) {
                $table->integer('school_days')->default(6)->after('active_semester');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropColumn('school_days');
        });
    }
};
