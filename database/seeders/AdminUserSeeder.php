<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Create default admin user
        User::updateOrCreate(
            ['email' => 'admin@smartschool.id'],
            [
                'name' => 'Administrator',
                'username' => 'admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );

        // Optional: Create a demo teacher account
        User::updateOrCreate(
            ['email' => 'teacher@smartschool.id'],
            [
                'name' => 'Guru Demo',
                'username' => 'teacher',
                'password' => Hash::make('password'),
                'role' => 'teacher',
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('✅ Admin users created successfully!');
        $this->command->info('📧 Email: admin@smartschool.id');
        $this->command->info('🔑 Password: password');
        $this->command->line('');
        $this->command->info('📧 Email: teacher@smartschool.id');
        $this->command->info('🔑 Password: password');
        $this->command->warn('⚠️  PLEASE CHANGE THE PASSWORD AFTER FIRST LOGIN!');
    }
}
