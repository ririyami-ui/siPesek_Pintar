# Panduan Deployment Smart School

Dokumen ini berisi langkah-langkah untuk melakukan deployment aplikasi **Smart School** ke server produksi (Shared Hosting atau VPS).

## ⚠️ PERINGATAN PENTING (BACA DULU)
**1. JANGAN** menjalankan perintah `php artisan config:cache` di komputer lokal Anda (Windows) sebelum mengunggah ke hosting (Linux). Hal ini akan menyebabkan error "No such file or directory".

**2. JANGAN** mengunggah file `public/hot`. File ini dibuat saat Anda menjalankan `npm run dev`. Jika file ini ada di hosting, website akan mencoba mencari aset di `localhost:5173` (yang menyebabkan error CORS / failed to load resource).

Jika Anda mengalami masalah di atas, ikuti **Langkah 5** di bawah.

## 1. Persiapan Lokal
Sebelum mengunggah file, jalankan perintah build di komputer lokal Anda:

```bash
# Jalankan script build (Linux/Mac)
sh build.sh

# Atau jalankan perintah manual (Windows)
composer install --no-dev --optimize-autoloader
npm install
npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 2. Unggah File ke Hosting
Unggah seluruh folder proyek ke direktori utama hosting Anda (misalnya `public_html` atau folder sub-domain).

### Struktur Direktori yang Disarankan (Shared Hosting):
Jika Anda menggunakan Shared Hosting, pastikan file `.htaccess` di root folder sudah benar agar mengarah ke file `index.php`.

## 3. Konfigurasi Database & Environment
1. Buat database baru di cPanel/Panel Hosting Anda.
2. Salin file `.env.example` menjadi `.env`.
3. Sesuaikan konfigurasi berikut di file `.env`:
   ```env
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://nama-domain-anda.com

   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=nama_db_anda
   DB_USERNAME=user_db_anda
   DB_PASSWORD=password_db_anda

   GEMINI_API_KEY=AIzaSy... (jika ingin set global)
   ```

## 4. Jalankan Migrasi di Server
Jika Anda memiliki akses SSH:
```bash
php artisan migrate --force
```
Jika tidak memiliki SSH, Anda bisa mengakses URL `/install` jika aplikasi menyediakannya, atau mengimpor database secara manual dari phpMyAdmin.

## 5. Perbaikan Error Storage (Shared Hosting)
Jika Anda mendapatkan error `file_put_contents` atau `failed to open stream: No such file or directory` pada folder `sessions` atau `views`, ikuti langkah ini:

1. Buka browser Anda.
2. Akses URL: `https://domain-anda.com/fix-storage.php`
3. Script ini akan otomatis membuat folder yang hilang (`storage/framework/sessions`, `views`, dll) dan mengatur izin aksesnya (permissions).
4. Setelah muncul pesan "All done!", **HAPUS** file `public/fix-storage.php` demi keamanan.

## 6. Sinkronisasi Link Storage
Jika gambar tidak muncul, pastikan Anda sudah menjalankan langkah nomor 5 di atas. Jika masih tidak muncul, Anda bisa mencoba menjalankan perintah ini via SSH:
```bash
php artisan storage:link
```
Atau buat file `cron job` satu kali yang menjalankan `ln -s /path/to/storage/app/public /path/to/public/storage`.

## 6. Selesai
Aplikasi Anda kini siap digunakan di lingkungan produksi! 🚀
