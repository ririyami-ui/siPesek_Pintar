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
        Schema::table('classes', function (Blueprint $table) {
            $indexes = collect(\Illuminate\Support\Facades\DB::select("SHOW INDEX FROM classes"))->pluck('Key_name');

            // Drop old unique('code') only if it still exists
            if ($indexes->contains('classes_code_unique')) {
                $table->dropUnique(['code']);
            }

            // Add new composite unique only if it doesn't already exist
            if (!$indexes->contains('classes_code_user_id_unique')) {
                $table->unique(['code', 'user_id']);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('classes', function (Blueprint $table) {
            $table->dropUnique(['code', 'user_id']);
            $table->unique('code');
        });
    }
};
