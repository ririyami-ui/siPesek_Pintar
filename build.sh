#!/bin/bash

# Smart School Production Build Script
echo "🚀 Starting Production Build..."

# 1. Install Composer Dependencies
echo "📦 Installing Composer dependencies..."
composer install --no-dev --optimize-autoloader

# 2. Install NPM Dependencies & Build Frontend
echo "📦 Installing NPM dependencies..."
npm install
echo "🏗️ Building Frontend with Vite..."
npm run build

# 3. Optimizing Laravel
# ⚠️ WARNING: If you run this on Windows but upload to Linux, 
# it will cause "No such file or directory" errors because of cached absolute paths.
# Best to run these commands on the actual server or clear bootstrap/cache before upload.
echo "⚙️ Optimizing Laravel..."
# php artisan config:cache # Commented out to avoid path errors on different OS
# php artisan route:cache  # Commented out to avoid path errors on different OS
php artisan view:cache

# 4. Storage Link
echo "🔗 Linking Storage..."
php artisan storage:link

echo "✅ Production Build Complete!"
echo "Next steps: Upload all files to your server and run migrations."
