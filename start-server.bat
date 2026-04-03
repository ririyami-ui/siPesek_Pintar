@echo off
title Server Si Pesek Pintar
color 0A

echo ==================================================
echo         MEMULAI SERVER SI PESEK PINTAR
echo ==================================================
echo.

echo 1. Membersihkan cache lama...
call php artisan optimize:clear
echo.

echo 2. Menjalankan Server Aplikasi...
echo    Silakan buka browser dan ketik: http://localhost:8000
echo    Biarkan jendela hitam ini tetap terbuka!
echo.
echo ==================================================
call php artisan serve

pause
