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
        Schema::table('journals', function (Blueprint $table) {
            $table->text('learning_objectives')->nullable()->after('topic');
            $table->text('learning_activities')->nullable()->after('learning_objectives');
            $table->text('reflection')->nullable()->after('learning_activities');
            $table->string('status')->default('Terlaksana')->after('reflection');
            $table->text('follow_up')->nullable()->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('journals', function (Blueprint $table) {
            $table->dropColumn([
                'learning_objectives',
                'learning_activities',
                'reflection',
                'status',
                'follow_up'
            ]);
        });
    }
};
