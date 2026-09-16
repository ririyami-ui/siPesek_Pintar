<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ulangan_harian_items', function (Blueprint $table) {
            $table->json('remidi_scores')->nullable()->after('scores');
        });
    }

    public function down(): void
    {
        Schema::table('ulangan_harian_items', function (Blueprint $table) {
            $table->dropColumn('remidi_scores');
        });
    }
};