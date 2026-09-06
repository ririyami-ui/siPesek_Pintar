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
        if (!Schema::hasColumn('teachers', 'auth_user_id')) {
            Schema::table('teachers', function (Blueprint $table) {
                $table->foreignId('auth_user_id')->nullable()->constrained('users')->onDelete('set null');
            });
        }

        if (!Schema::hasColumn('admins', 'auth_user_id')) {
            Schema::table('admins', function (Blueprint $table) {
                $table->foreignId('auth_user_id')->nullable()->constrained('users')->onDelete('set null');
            });
        }
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
