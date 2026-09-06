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

            $dropColumns = [];
            if (in_array('nip', $columns)) $dropColumns[] = 'nip';
            if (in_array('title', $columns)) $dropColumns[] = 'title';

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->string('nip')->nullable();
            $table->string('title')->nullable();
        });
    }
};
