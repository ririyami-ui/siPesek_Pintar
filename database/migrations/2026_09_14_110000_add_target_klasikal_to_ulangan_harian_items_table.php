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
        if (Schema::hasTable('ulangan_harian_items') && !Schema::hasColumn('ulangan_harian_items', 'target_klasikal')) {
            Schema::table('ulangan_harian_items', function (Blueprint $table) {
                $table->decimal('target_klasikal', 5, 2)->default(80.00)->after('kktp_score');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ulangan_harian_items') && Schema::hasColumn('ulangan_harian_items', 'target_klasikal')) {
            Schema::table('ulangan_harian_items', function (Blueprint $table) {
                $table->dropColumn('target_klasikal');
            });
        }
    }
};
