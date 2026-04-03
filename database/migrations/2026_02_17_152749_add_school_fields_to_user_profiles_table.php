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
        Schema::table('user_profiles', function (Blueprint $table) {
            // New School Fields
            $table->string('npsn')->nullable()->after('school_level');
            $table->string('nss')->nullable()->after('npsn');
            $table->text('address')->nullable()->after('nss');
            $table->string('logo_path')->nullable()->after('address');

            // Remove weight fields
            $table->dropColumn(['academic_weight', 'attitude_weight']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropColumn(['npsn', 'nss', 'address', 'logo_path']);
            
            $table->integer('academic_weight')->default(50);
            $table->integer('attitude_weight')->default(50);
        });
    }
};
