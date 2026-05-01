<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE teachers CHANGE user_id created_by BIGINT UNSIGNED');
        DB::statement('ALTER TABLE students CHANGE user_id created_by BIGINT UNSIGNED');
        DB::statement('ALTER TABLE admins CHANGE user_id created_by BIGINT UNSIGNED');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE teachers CHANGE created_by user_id BIGINT UNSIGNED');
        DB::statement('ALTER TABLE students CHANGE created_by user_id BIGINT UNSIGNED');
        DB::statement('ALTER TABLE admins CHANGE created_by user_id BIGINT UNSIGNED');
    }
};
