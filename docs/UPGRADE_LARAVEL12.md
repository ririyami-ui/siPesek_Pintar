# Rencana Upgrade Laravel 10 → 12 (Proyek Terpisah)

> Dokumen perencanaan ini untuk migrasi **tanpa mengganggu** proyek berjalan (`main`).
> Dibuat: 2026-09-24. Semua perintah dijalankan di **salinan/cabang** proyek, bukan `main`.

## 1. Status & Fakta Terverifikasi (2026-09-24)

| Item | Nilai Sekarang | Target | Catatan |
|---|---|---|---|
| Laravel framework | `^10.10` | `^12.0` | Lewati L11 (EOL security 12 Mar 2026) |
| PHP (lokal) | 8.1.25 (CLI) | 8.2 / 8.3 | **Wajib naik dulu sebelum composer update** |
| PHP (hosting) | 8.2–8.3 | 8.2+ | Sudah mendukung, tidak hambatan |
| Sanctum | `^3.3` | `^4.0` | Wajib publish migration setelah upgrade |
| phpunit (dev) | `^10.1` | `^11.0` | Panduan resmi upgrade L12 |
| Collision (dev) | `^7.0` | `^8.1` | |
| Ignition (dev) | `spatie/laravel-ignition ^2.0` | hapus → `laravel/pail` | Ignition tidak lagi dipakai skeleton v12 |
| Support L10 security | s/d 4 Feb 2025 (EOL) | — | Sudah lewat, inilah alasan utama upgrade |
| Support L12 security | s/d 24 Feb 2027 | — | |
| Support L13 security | s/d 17 Mar 2028 | — | Opsi bila mau paling tahan lama |

## 2. Tujuan

- Mendapatkan kembali patch keamanan resmi (L10 & L11 sudah EOL).
- Siap untuk adopsi `laravel/ai` (butuh `illuminate ^12` dan PHP 8.3).
- Frontend React/Vite (semua `resources/js/`) **tidak berubah** — hanya plumbing backend yang dimigrasi.
- Bisa dijalankan di revisi/pelaksanaan terpisah tanpa cutover tergesa.

## 3. Prinsip Kerja

1. **Tidak mengubah `main`** — semua pekerjaan di branch/cabang terpisah.
2. **Backup penuh** sebelum sentuh apa pun (DB, `.env`, `composer.lock`).
3. **Migrasi bertahap** dan setiap tahap di-commit agar bisa di-rollback per langkah.
4. **SQA menyeluruh** di staging sebelum cutover; rollback plan tersedia.

## 4. Tahapan Pelaksanaan

### Fase 0 — Snapshot & Persiapan (aman)
- [ ] Commit `main` bersih (untracked scratch tidak ikut di-commit).
- [ ] Buat cadangan DB: `php artisan backup:database` (command `BackupDatabase`).
- [ ] Simpan salinan `.env` → `.env.l10.bak` dan `composer.lock` → `composer.lock.l10.bak`.
- [ ] Buat branch: `git checkout -b upgrade-laravel12`.
- [ ] (Opsional) beri tag: `git tag l10-baseline`.

### Fase 1 — Upgrade PHP Lokal
- [ ] Naikkan PHP lokal 8.1.25 → **8.2** (disarankan 8.3 agar seragam hosting).
- [ ] Verifikasi: `php -v` → 8.2/8.3.
- [ ] Cek ekstensi aktif: `php -m` memuat `mbstring, intl, gd, zip, pdo_mysql, sqlite3`.
- [ ] Cek Composer jalan: `composer --version`.

### Fase 2 — Update Dependensi (`composer.json`) — TARGET L12 LANGSUNG
- [ ] Ubah `php` dari `^8.1` → `^8.3`.
- [ ] Ubah `laravel/framework` `^10.10` → `^12.0`.
- [ ] Ubah `laravel/sanctum` `^3.3` → `^4.0`.
- [ ] Ubah dev: `phpunit/phpunit` → `^11.0`, `nunomaduro/collision` → `^8.1`.
- [ ] Hapus `spatie/laravel-ignition`; tambah `laravel/pail`.
- [ ] Jalankan `composer update` (bisa berkali-kali, satu paket per error).
- [ ] Risiko & verifikasi paket pihak ketiga yang dipakai:
  - `barryvdh/laravel-dompdf ^3.1` — diharapkan kompatibel L12.
  - `minishlink/web-push ^8.0` — mandiri, periksa constraint PHP.
  - `webklex/laravel-pdfmerger 1.3.2` — **RISIKO**: dukungan L12 hanya di fork `stitch-digital/laravel-pdfmerger 2.0.1` (PR #2). Perlu uji swap concat merge; alternatif langsung `setasign/fpdi` bila perlu.
- [ ] `php artisan about` untuk memastikan versi terbaca.

### Fase 3 — Migrasi Struktur L11/L12 (bagian terbesar)
- [ ] Hapus `app/Providers/RouteServiceProvider.php`, `EventServiceProvider.php`, `BroadcastServiceProvider.php`, `AuthServiceProvider.php`.
- [ ] Hapus `app/Http/Kernel.php`, `app/Console/Kernel.php`, `app/Exceptions/Handler.php`.
- [ ] Pindahkan registrasi ke `bootstrap/app.php`:
  - Global/group web: `TrustProxies`, `HandleCors`, `PreventRequestsDuringMaintenance`, `TrimStrings`, `ValidatePostSize` (default bawaan).
  - `web` group + `CheckInstallation` (append ke web group).
  - Atur Dedupe.
  - Alias middleware dari `Kernel::$middlewareAliases`: `auth`, `guest`, `admin` (`IsAdmin`), `librarian` (`IsLibrarian`), `signed` (`ValidateSignature`).
- [ ] Schedule & commands: pindahkan isi `app/Console/Kernel::schedule()` → `bootstrap/app.php` via `->withSchedule(function ($schedule) { ... })` — mencakup `PruneOldData`, `PruneStaleTokens`, `SendScheduleReminders`, `SendParentReports`, `LibraryNotifyDueTomorrow`, `ResetJournals`, `BackupDatabase`, dll. (16 command custom di `app/Console/Commands`).
- [ ] Validasi command teregistrasi: `php artisan list | Select-String "prune|remind|backup"`.
- [ ] Sanctum: jalankan `php artisan vendor:publish --tag=sanctum-migrations`; pastikan tabel `personal_access_tokens` tidak bentrok dengan yang sudah ada (cek riwayat: index `last_used_at` sudah dibuat di proyek ini).
- [ ] Periksa semua `config/` terhadap skeleton v12 `config/` (session, cache, queue, filesystems, database — kebijakan: pertahankan nilai kustom, ambil struktur baru).
- [ ] Cek `app/Models/User.php` konsisten dengan L12 (не wajib, hanya bila perlu).

### Fase 4 — Jembatan 11 → 12 (imprestasi Cs)
Catatan: karena langsung lompat ke `^12.0`, pastikan keempat perubahan "dampak menengah" versi 12 diterima:
- [ ] **Carbon 3** — uji semua tampilan tanggal (`format`, diff, `parse('+1 hari')`) di halaman yang menampilkan tanggal.
- [ ] Konvensi `config/database.php` & local disk `storage_path` default (periksa relatif path).
- [ ] Jika ada UUIDv7/ULID: verifikasi generator; proyek kemungkinan pakai increment int — aman.
- [ ] Diff `config/*.php` & `bootstrap/app.php` dengan skeleton v12 (gunakan `laravel/laravel` fresh) dan terapkan delta yang relevan.

### Fase 5 — SQA Menyeluruh (Staging) — SEBELUM cutover
- [ ] Salin DB ke DB test, jalankan `php artisan migrate:fresh` lalu `db:seed` (bila ada) untuk uji migrasi bersih.
- [ ] `php artisan route:list`, `php artisan config:cache`, `php artisan route:cache`, `php artisan schedule:list`.
- [ ] Regression manual per fitur penting:
  - Login semua role (admin, guru, siswa, walimurid).
  - Master data (kelas, siswa, guru, buku/library).
  - RPP/ATP generation + download.
  - **Analisis Ulangan Harian** end-to-end: buat, input nilai, simpan → `syncToGrades` (nilai tampil di aplikasi siswa/walimurid + push), download **Word/PDF** (chart + statistik + tabel remidi + ketuntasan klasikal setelah remidi), hapus.
  - **Chat AI (Gemini)** — `AiGeneratorService` + `gemini.js` tetap dipanggil.
  - Push notification web-push & PDF merger.
  - Scheduler/reminder (jalankan perintah manual sekali).
- [ ] Frontend: `npm ci`, `node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build` → bandingkan `public/build/manifest.json` sesuai sumber.
- [ ] `php artisan optimize` di akhir.

### Fase 6 — Cutover ke Hosting
- [ ] Merge/rebuild branch → deploy (git pull + ganti `public/build`).
- [ ] `composer install --no-dev --optimize-autoloader`.
- [ ] `php artisan migrate --force`, `config:cache`, `route:cache`.
- [ ] `php artisan storage:link` (bila belum), cek `.env` versi baru (PHP 8.3).
- [ ] Uji smoke setelah go-live (login, satu analisis ulangan, satu ekspor Word/PDF).
- [ ] **Rollback plan**: checkout tag `l10-baseline` + restore DB backup (snapshot Fase 0).

## 5. Matriks Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Migrasi Kernel→bootstrap salah | App tidak boot (500) | Tahap kecil + commit per langkah, uji `php artisan about` |
| Middleware custom hilang | Rute tanpa proteksi (IDOR) | Ceklist Fase 3 alias + regression login/role |
| pdfmerger tidak kompatibel | Export PDF gabung gagal | Uji swap fork `stitch-digital` atau fpdi langsung |
| Carbon 3 ubah format tanggal | Tampilan tanggal bergeser | SQA semua halaman ber-tanggal |
| Sanctum v4 config/migration | Token login rusak | Publish migration + uji login API/siswa |
| PHP lokal belum naik | Composer update gagal | Fase 1 wajib lunas dulu |

## 6. Kriteria Selesai (Definition of Done)
- [ ] `main` tetap di commit `58d3e2d` tanpa perubahan tidak terencana.
- [ ] Cabang `upgrade-laravel12` lolos seluruh checklist Fase 5.
- [ ] Versi aktif: Laravel 12.0+, PHP 8.3, Sanctum 4, tanpa `spatie/laravel-ignition`.
- [ ] Fitur analisis/remidi, AI (Gemini), push, dan ekspor Word/PDF diuji dan berfungsi identik.
- [ ] `public/build` hasil build ulang tersedia untuk upload hosting.

## 7. Catatan Tambahan
- **Jangan** mengerjakan ini bareng deploy hosting rutin; gunakan window terpisah.
- Bila ingin paling tahan lama, pertimbangkan target L13 (`^13.0`, PHP 8.3, security s/d Mar 2028) — namun jadikan keputusan setelah Fase 2 berhasil di 12.
- Regenerasi `bskap_full_cp.json` tetap final dilarang untuk 6 mapel agama (hazard AGENTS.md) — tidak terkait upgrade, hanya pengingat.