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
        Schema::table('holidays', function (Blueprint $table) {
            $columns = collect(DB::select("SHOW COLUMNS FROM holidays"))
                ->pluck('Field')
                ->toArray();

            if (!in_array('name', $columns)) {
                $table->string('name')->nullable()->after('title');
            }
            if (!in_array('category', $columns)) {
                $table->string('category')->default('lainnya')->after('type');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('holidays', function (Blueprint $table) {
            $table->dropColumn(['name', 'category']);
        });
    }
};
