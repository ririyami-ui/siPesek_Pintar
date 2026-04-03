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
        Schema::table('teachers', function (Blueprint $table) {
            $table->foreignId('auth_user_id')->nullable()->constrained('users')->onDelete('set null')->after('user_id');
        });

        Schema::table('admins', function (Blueprint $table) {
            $table->foreignId('auth_user_id')->nullable()->constrained('users')->onDelete('set null')->after('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropForeign(['auth_user_id']);
            $table->dropColumn('auth_user_id');
        });

        Schema::table('admins', function (Blueprint $table) {
            $table->dropForeign(['auth_user_id']);
            $table->dropColumn('auth_user_id');
        });
    }
};
