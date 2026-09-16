<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->unsignedBigInteger('ulangan_harian_item_id')->nullable()->after('kktp_assessment_id');
            $table->foreign('ulangan_harian_item_id')->references('id')->on('ulangan_harian_items')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropForeign(['ulangan_harian_item_id']);
            $table->dropColumn('ulangan_harian_item_id');
        });
    }
};