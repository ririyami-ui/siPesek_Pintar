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
        Schema::create('class_agreements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('class_id')->constrained('classes')->onDelete('cascade');
            $table->integer('knowledge_weight')->default(40);
            $table->integer('practice_weight')->default(60);
            $table->integer('academic_weight')->default(50);
            $table->integer('attitude_weight')->default(50);
            $table->text('agreements')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'class_id']); // Ensure only one agreement per class per user
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('class_agreements');
    }
};
