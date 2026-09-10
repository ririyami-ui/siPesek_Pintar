<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Managed Database Tables
    |--------------------------------------------------------------------------
    |
    | Daftar tabel yang dikelola oleh modul Master Data > Kelola Database.
    | Digunakan oleh DatabaseManagementController dan BackupDatabase command.
    |
    */

    'managed' => [
        'migrations',
        'audit_logs',
        'admins',
        'teachers',
        'students',
        'books',
        'library_loans',
        'classes',
        'schedules',
        'subjects',
        'attendances',
        'journals',
        'grades',
        'infractions',
        'infraction_types',
        'teaching_programs',
        'student_tasks',
        'class_agreements',
        'holidays',
        'lesson_plans',
        'quizzes',
        'handouts',
        'worksheets',
        'kktp_assessments',
        'student_notes',
        'teacher_assignments',
        'user_profiles',
        'users',
        'personal_access_tokens',
        'password_reset_tokens',
    ],

    /*
    |--------------------------------------------------------------------------
    | Protected Tables (Never Wipe)
    |--------------------------------------------------------------------------
    |
    | Tabel yang TIDAK BOLEH di-wipe/reset total karena berisi akun admin,
    | user login, dan tracking migrasi. Tabel ini tetap aman saat "Reset Total".
    |
    */

    'protected' => [
        'migrations',
        'admins',
        'users',
        'password_reset_tokens',
        'personal_access_tokens',
    ],

    /*
    |--------------------------------------------------------------------------
    | Table Labels
    |--------------------------------------------------------------------------
    |
    | Label human-readable untuk setiap tabel di UI.
    |
    */

    'labels' => [
        'audit_logs' => 'Log Aktivitas Sistem',
        'admins' => 'Data Admin',
        'teachers' => 'Data Guru',
        'students' => 'Data Siswa',
        'classes' => 'Data Kelas',
        'schedules' => 'Jadwal Mengajar',
        'subjects' => 'Mata Pelajaran',
        'attendances' => 'Presensi Siswa',
        'journals' => 'Jurnal Mengajar',
        'grades' => 'Data Nilai',
        'infractions' => 'Pelanggaran Siswa',
        'infraction_types' => 'Jenis Pelanggaran',
        'teaching_programs' => 'Program Mengajar (PROMES)',
        'student_tasks' => 'Penugasan Siswa',
        'class_agreements' => 'Kesepakatan Kelas',
        'holidays' => 'Agenda & Libur',
        'lesson_plans' => 'Riwayat RPP AI',
        'quizzes' => 'Kuis AI',
        'handouts' => 'Bahan Ajar',
        'worksheets' => 'Riwayat LKPD',
        'kktp_assessments' => 'Penilaian KKTP Digital',
        'student_notes' => 'Catatan Siswa',
        'teacher_assignments' => 'Penugasan Guru',
        'user_profiles' => 'Profil Pengguna',
        'users' => 'Akun Pengguna',
        'personal_access_tokens' => 'Token Sesi Login',
        'password_reset_tokens' => 'Token Reset Password',
        'books' => 'Master Data Buku (Perpustakaan)',
        'library_loans' => 'Riwayat Sirkulasi & Peminjaman',
        'migrations' => 'Sistem Migration (Versi Database)',
    ],
];
