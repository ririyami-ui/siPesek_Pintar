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
            if (!Schema::hasColumn('user_profiles', 'npsn')) {
                $table->string('npsn')->nullable()->after('school_level');
            }
            if (!Schema::hasColumn('user_profiles', 'nss')) {
                $table->string('nss')->nullable()->after('npsn');
            }
            if (!Schema::hasColumn('user_profiles', 'address')) {
                $table->text('address')->nullable()->after('nss');
            }
            if (!Schema::hasColumn('user_profiles', 'logo_path')) {
                $table->string('logo_path')->nullable()->after('address');
            }

            // Remove weight fields
            $dropColumns = [];
            if (Schema::hasColumn('user_profiles', 'academic_weight')) $dropColumns[] = 'academic_weight';
            if (Schema::hasColumn('user_profiles', 'attitude_weight')) $dropColumns[] = 'attitude_weight';
            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
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
