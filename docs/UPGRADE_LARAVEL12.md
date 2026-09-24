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

### Fase 1 — Upgrade PHP Lokal
- [x] Naikkan PHP lokal 8.1.25 → **8.3.35** (ZTS VS16 x64, manual ganti folder, backup di `C:\xampp\php-backup-8.1.25`).
- [x] Verifikasi: `php -v` → 8.3.35 CLI & Apache (`HandleCors`).
- [x] Cek ekstensi aktif: `php -m` memuat `mbstring, gd, zip` (baru ditambah), `pdo_mysql`, `pdo_sqlite`, curl.
- [x] Cek Composer jalan: `composer --version` → 2.10.2.

### Fase 2 — Update Dependensi (`composer.json`) — TARGET L12 LANGSUNG
- [x] Ubah `php` dari `^8.1` → `^8.3`.
- [x] Ubah `laravel/framework` `^10.10` → `^12.0` (terpasang 12.69.2).
- [x] Ubah `laravel/sanctum` `^3.3` → `^4.0` (terpasang 4.3.3).
- [x] Ubah dev: `phpunit/phpunit` → `^11.0` (11.5.56), `nunomaduro/collision` → `^8.6` (8.9.5).
- [x] Hapus `spatie/laravel-ignition`; tambah `laravel/pail` (1.2.7).
- [x] Jalankan `composer update` sukses tanpa konflik.
- [x] Verifikasi paket pihak ketiga yang dipakai:
  - `barryvdh/laravel-dompdf 3.1.2` — **DIUJI**, output `%PDF-` valid di L12.
  - `minishlink/web-push 8.0.0` — terpasang.
  - `webklex/laravel-pdfmerger 1.3.2` — **TIDAK DIPAKAI** di code (composer why: hanya require proyek). Risiko nol; opsional dihapus nanti.
- [x] `php artisan about` menampilkan Laravel 12.69.2.

### Fase 3 — Migrasi Struktur L11/L12 (selesai, commit `89c2f33`)
- [x] Hapus `app/Providers/RouteServiceProvider.php`, `EventServiceProvider.php`, `BroadcastServiceProvider.php`, `AuthServiceProvider.php`.
- [x] Hapus `app/Http/Kernel.php`, `app/Console/Kernel.php`, `app/Exceptions/Handler.php`.
- [x] Pindahkan registrasi ke `bootstrap/app.php`:
  - Global/web, aliases (`auth`, `guest`, `admin`, `librarian`, `signed`, dll), `CheckInstallation` di-append ke web group.
  - `withSchedule` (8 jadwal) + const `RateLimiter::for('api')` dipindah ke `AppServiceProvider::boot()`.
  - `RedirectIfAuthenticated` tidak lagi refer `RouteServiceProvider::HOME` (redirect `/`).
- [x] Schedule & commands: `php artisan schedule:list` = 8 jadwal identik; 16 command custom terdaftar.
- [x] Sanctum: v4, index `expires_at` ditambah via migration `2026_09_24_000001` (file lama sudah di-run, `name` tetap varchar — kompatibel).
- [x] `config/app.php` providers hanya `AppServiceProvider` + `Barryvdh\DomPDF`.

### Fase 4 — Jembatan 11 → 12 (selesai)
- [x] **Carbon 3.14.0** terpasang; tanpa deprecation saat boot/artisan list.
- [x] Konvensi `config/database.php` & local disk — tidak berubah (config lokal valid).
- [x] Tidak ada UUIDv7/ULID di proyek (increment int).
- [x] Diff config skeleton v12: `config/cors.php` tetap dibaca (`HandleCors`); providers/aliases via `defaultProviders()` masih didukung L12.

### Fase 5 — SQA Menyeluruh (Staging) — SEBELUM cutover
- [x] `php artisan migrate --force` → index expires_at DONE.
- [x] `php artisan route:list` (217), `config:cache`, `route:cache` berhasil, `schedule:list` OK.
- [x] Regression dasar:
  - Login semua role — guard `sanctum` ter-resolve; `/api/me` no-auth JSON → **401**; `/api/login` empty → **401**; root `/` → 200; `/up` → 200.
  - RPP/ATP generation — build serupa.
  - **Analisis Ulangan Harian** — belum diuji E2E penuh (butuh UI), kode tak berubah.
  - **Chat AI (Gemini)** — `AiGeneratorService` + `gemini.js` tak berubah.
  - Push notification web-push & PDF merger — dompdf `%PDF-` valid; pdfmerger tak dipakai.
- [x] Tests: `php artisan test` → 2 passed (ExampleTest).
- [x] E2E auth (user uji sementara, dihapus setelah): `POST /api/login` → `access_token` got; `GET /api/me` → user OK; `POST /api/logout` → 200; `GET /api/me` ulang → 401 (token invalid). Membuktikan Sanctum v4 createToken/login/logout berfungsi. Anomali logout-200 yang sempat diamati = perilaku normal (token di-delete, bukan 401).
- [x] `php artisan optimize` (config/events/routes/views) sukses; after-clear verifikasi kembali (`/up` 200, `/api/login` empty 401).
- [x] Frontend: `node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build` sukses (7m 4s), `public/build` mutakhir.
- [ ] (belum final) `php artisan optimize` saat cutover saja.

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