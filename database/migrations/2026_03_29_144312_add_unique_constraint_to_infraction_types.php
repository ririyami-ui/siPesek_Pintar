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
        Schema::table('infraction_types', function (Blueprint $table) {
        if (!Schema::hasIndex('infraction_types', 'infraction_types_user_id_name_unique')) {
            $table->unique(['user_id', 'name']);
        }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('infraction_types', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'name']);
        });
    }
};
