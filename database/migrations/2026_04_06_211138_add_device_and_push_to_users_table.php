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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'device_id')) {
                $table->string('device_id')->nullable()->after('status');
            }
            if (!Schema::hasColumn('users', 'push_subscription')) {
                $table->text('push_subscription')->nullable()->after('device_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['device_id', 'push_subscription']);
        });
    }
};
