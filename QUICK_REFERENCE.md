# Quick Reference Guide - Smart School Backend

**Generated:** May 24, 2026  
**Purpose:** Quick lookup for developers and administrators

---

## 1. Documentation Index

### 📋 Audit & Analysis
| Document | Size | Purpose | Priority |
|----------|------|---------|----------|
| `audit.md` | 22 KB | Security & code quality audit | 🔴 CRITICAL |
| `SESSION_SUMMARY.md` | 12.5 KB | Complete session overview | 📊 Reference |

### 🔧 Feature Documentation
| Document | Size | Purpose | Audience |
|----------|------|---------|----------|
| `REKAP_INDIVIDU_DOCUMENTATION.md` | 19.8 KB | Rekap Individu feature guide | Developers |
| `TESTING_GUIDE_ROMBEL_FIX.md` | 11.9 KB | Testing procedures | QA/Testers |

### 🐛 Bug Fixes
| Document | Size | Purpose | Status |
|----------|------|---------|--------|
| `BUG_FIX_ROMBEL_FILTER.md` | 9.1 KB | Rombel filter fix details | ✅ FIXED |

### 📚 Project Documentation
| Document | Size | Purpose |
|----------|------|---------|
| `DEDICATION.md` | 1.4 KB | Project dedication |
| `DEPLOY.md` | 3 KB | Deployment guide |

---

## 2. Critical Issues Checklist

### 🔴 CRITICAL (Fix This Week)

```
[ ] Encrypt Gemini API keys
    File: app/Services/GeminiService.php
    Action: Move to .env, use Laravel encryption
    
[ ] Add multi-factor confirmation to destructive operations
    File: app/Http/Controllers/Admin/DatabaseManagementController.php
    Action: Require email + SMS confirmation
    
[ ] Validate SQL before execution
    File: app/Http/Controllers/Admin/DatabaseManagementController.php:246
    Action: Add SQL syntax validation
    
[ ] Implement proper device verification
    File: app/Http/Controllers/Api/AuthController.php:62-77
    Action: Use device fingerprinting
    
[ ] Add authorization checks to search
    File: app/Http/Controllers/StudentController.php:20-31
    Action: Apply class-level authorization
```

### 🟠 HIGH (Fix This Sprint)

```
[ ] Refactor large controllers
    - DashboardController.php (593 lines)
    - ScheduleController.php (39KB)
    - AiFeaturesController.php (16KB)
    
[ ] Add comprehensive tests
    Target: 80% code coverage
    
[ ] Implement API documentation
    Tool: Swagger/OpenAPI
    
[ ] Optimize N+1 queries
    Files: Multiple controllers
    
[ ] Add password complexity requirements
    File: app/Http/Controllers/Api/AuthController.php:20
```

---

## 3. Bug Fix Summary

### Rombel Filter Bug ✅ FIXED

**Problem:** Selecting class "7A" showed students from "8D"

**Root Cause:** 
```php
// WRONG
WHERE class_id = '7A'  // Comparing integer to string
```

**Solution:**
```php
// CORRECT
INNER JOIN classes ON students.class_id = classes.id
WHERE classes.rombel = '7A'
```

**File:** `app/Http/Controllers/StudentController.php` (lines 52-56)

**Status:** ✅ Fixed and ready for testing

---

## 4. Key Metrics

### Code Statistics
- **Total Controllers:** 26
- **Total Models:** 20+
- **Total Services:** 7
- **Frontend Components:** 50+
- **Lines of Code:** 10,000+

### Performance Baselines
- **API Response Time:** 500-800ms
- **Database Queries:** 8-10 per operation
- **Cache TTL:** 5-60 minutes
- **AI Generation:** 5-10 seconds

### Security Status
- **Risk Level:** ⚠️ MODERATE
- **Critical Issues:** 8
- **High Issues:** 5
- **Medium Issues:** 10+

---

## 5. File Structure Quick Reference

```
smart-school-backend/
├── app/
│   ├── Http/Controllers/
│   │   ├── StudentController.php ⭐ (FIXED)
│   │   ├── Api/StudentDashboardController.php
│   │   ├── Admin/DatabaseManagementController.php 🔴
│   │   └── ... (23 more)
│   ├── Models/
│   │   ├── Student.php
│   │   ├── Grade.php
│   │   ├── Attendance.php
│   │   └── ... (17 more)
│   ├── Services/
│   │   ├── GeminiService.php 🔴
│   │   ├── GradeCalculationService.php
│   │   └── ... (5 more)
│   └── Middleware/
│       ├── IsAdmin.php
│       ├── IsLibrarian.php
│       └── ... (10 more)
├── routes/
│   ├── api.php (186 lines)
│   └── web.php
├── resources/js/
│   ├── pages/
│   │   ├── RekapIndividuPage.jsx (1,088 lines)
│   │   └── ... (34 more)
│   ├── components/
│   │   └── ... (50+ components)
│   └── utils/
│       ├── gemini.js
│       ├── pdfGenerator.js
│       └── ... (8 more)
├── database/
│   ├── migrations/ (10+ files)
│   └── seeders/
├── config/
│   ├── services.php
│   └── ... (15 more)
└── Documentation/
    ├── audit.md ⭐
    ├── REKAP_INDIVIDU_DOCUMENTATION.md ⭐
    ├── BUG_FIX_ROMBEL_FILTER.md ⭐
    ├── TESTING_GUIDE_ROMBEL_FIX.md ⭐
    └── SESSION_SUMMARY.md ⭐
```

---

## 6. API Endpoints Quick Reference

### Authentication
```
POST   /api/login                    - Login (5 req/min limit)
POST   /api/logout                   - Logout
GET    /api/me                       - Current user
POST   /api/verify-password          - Verify password
```

### Students
```
GET    /api/students?rombel=7A       - List students by class ⭐ FIXED
POST   /api/students                 - Create student
GET    /api/students/{id}            - Get student
PUT    /api/students/{id}            - Update student
DELETE /api/students/{id}            - Delete student
POST   /api/students/promote         - Promote to next class
```

### Grades
```
GET    /api/grades                   - List grades
POST   /api/grades                   - Create grade
GET    /api/grades/summary/{id}      - Grade summary
POST   /api/grades/batch             - Batch create
DELETE /api/grades/batch             - Batch delete
```

### Attendance
```
GET    /api/attendances              - List attendance
POST   /api/attendances/bulk         - Bulk create
GET    /api/attendances/summary      - Summary
```

### AI Features
```
POST   /api/ai/analyze-journal       - Analyze journal
POST   /api/ai/generate-lesson-plan  - Generate RPP
POST   /api/ai/generate-quiz         - Generate quiz
POST   /api/ai/generate-handout      - Generate handout
POST   /api/ai/chat                  - Chat with AI
```

### Admin
```
GET    /api/admin/database/tables    - List tables
POST   /api/admin/database/truncate  - Truncate table 🔴
POST   /api/admin/database/wipe      - Wipe database 🔴
POST   /api/admin/database/backup    - Backup database
POST   /api/admin/database/restore   - Restore database
```

---

## 7. Database Schema Quick Reference

### Core Tables
```
users
├── id, name, email, username, password, role
├── Roles: admin, teacher, librarian, student, staff

students
├── id, name, nis, nisn, class_id, gender, birth_date
├── Relationships: class, grades, attendances

classes
├── id, rombel, level, code, user_id (wali_kelas)

grades
├── id, student_id, subject_id, class_id, score, type
├── Types: Harian, Tugas, Kuis, Formatif, Sumatif, etc.

attendances
├── id, student_id, subject_id, date, status
├── Status: hadir, sakit, izin, alpa

infractions
├── id, student_id, infraction_type_id, date, points

schedules
├── id, class_id, subject_id, teacher_id, day, start_time, end_time
```

---

## 8. Environment Configuration

### Required .env Variables
```
APP_NAME=Smart School
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=smart_school
DB_USERNAME=root
DB_PASSWORD=***

GEMINI_API_KEY=***  🔴 NEEDS ENCRYPTION
REDIS_HOST=localhost
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### Recommended Settings
```
APP_DEBUG=false              (Never true in production)
LOG_LEVEL=warning            (Not debug)
CACHE_DRIVER=redis           (Not file)
SESSION_DRIVER=cookie        (Secure)
QUEUE_CONNECTION=redis       (For jobs)
```

---

## 9. Common Tasks

### Deploy Code Changes
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
composer install
npm install

# 3. Run migrations
php artisan migrate

# 4. Clear cache
php artisan cache:clear
php artisan config:clear

# 5. Build frontend
npm run build

# 6. Restart services
systemctl restart php-fpm
systemctl restart nginx
```

### Run Tests
```bash
# Unit tests
php artisan test

# Specific test
php artisan test tests/Feature/StudentControllerTest

# With coverage
php artisan test --coverage
```

### Debug Issues
```bash
# Check logs
tail -f storage/logs/laravel.log

# Database queries
DB::listen(function($query) { Log::info($query->sql); });

# API requests
curl -H "Authorization: Bearer TOKEN" http://localhost/api/students?rombel=7A
```

---

## 10. Security Checklist

### Before Production Deployment
```
[ ] APP_DEBUG=false
[ ] HTTPS enabled
[ ] API keys in .env (not hardcoded)
[ ] Database backups configured
[ ] Rate limiting enabled
[ ] CORS properly configured
[ ] Security headers set
[ ] Logs monitored
[ ] Error tracking enabled
[ ] Backup strategy tested
```

### Regular Maintenance
```
[ ] Review error logs weekly
[ ] Check database size monthly
[ ] Update dependencies quarterly
[ ] Security audit annually
[ ] Backup verification monthly
[ ] Performance monitoring continuous
```

---

## 11. Troubleshooting Guide

### Issue: Rombel filter shows wrong students
**Solution:** Already fixed! See `BUG_FIX_ROMBEL_FILTER.md`

### Issue: Slow API responses
**Solution:** 
1. Check database indexes
2. Enable Redis caching
3. Optimize queries (see audit.md)

### Issue: Gemini API errors
**Solution:**
1. Verify API key in .env
2. Check API quota
3. Review error logs

### Issue: PDF export fails
**Solution:**
1. Check browser console
2. Verify html2canvas loaded
3. Check PDF size

### Issue: Students can't login
**Solution:**
1. Check device_id binding
2. Verify user account exists
3. Check password hash

---

## 12. Contact & Support

### For Issues With:

**Rombel Filter Bug**
- See: `BUG_FIX_ROMBEL_FILTER.md`
- Status: ✅ Fixed

**Rekap Individu Feature**
- See: `REKAP_INDIVIDU_DOCUMENTATION.md`
- Contact: Backend Team

**Security Concerns**
- See: `audit.md` sections 3-4
- Priority: 🔴 CRITICAL

**Testing Procedures**
- See: `TESTING_GUIDE_ROMBEL_FIX.md`
- Contact: QA Team

**Deployment Issues**
- See: `DEPLOY.md`
- Contact: DevOps Team

---

## 13. Important Links

### Documentation
- Audit Report: `audit.md`
- Feature Guide: `REKAP_INDIVIDU_DOCUMENTATION.md`
- Bug Fix: `BUG_FIX_ROMBEL_FILTER.md`
- Testing: `TESTING_GUIDE_ROMBEL_FIX.md`
- Summary: `SESSION_SUMMARY.md`

### Code Locations
- StudentController: `app/Http/Controllers/StudentController.php`
- RekapIndividuPage: `resources/js/pages/RekapIndividuPage.jsx`
- GeminiService: `app/Services/GeminiService.php`
- DatabaseManagement: `app/Http/Controllers/Admin/DatabaseManagementController.php`

### External Resources
- Laravel Docs: https://laravel.com/docs
- React Docs: https://react.dev
- Sanctum Auth: https://laravel.com/docs/sanctum
- Gemini API: https://ai.google.dev

---

## 14. Version Information

### Technology Stack
- **PHP:** 8.1+
- **Laravel:** 10.10+
- **React:** 18.2.0
- **Node:** 16+
- **MySQL:** 5.7+
- **Redis:** 6+

### Key Dependencies
- `laravel/sanctum` - API authentication
- `minishlink/web-push` - Push notifications
- `guzzlehttp/guzzle` - HTTP client
- `react-router-dom` - Frontend routing
- `recharts` - Data visualization

---

## 15. Last Updated

**Date:** May 24, 2026  
**By:** Code Analysis System  
**Status:** ✅ Current

**Next Review:** June 24, 2026

---

**Quick Links:**
- 🔴 [Critical Issues](audit.md#3-security-analysis)
- ⭐ [Rekap Individu](REKAP_INDIVIDU_DOCUMENTATION.md)
- 🐛 [Bug Fix](BUG_FIX_ROMBEL_FILTER.md)
- ✅ [Testing Guide](TESTING_GUIDE_ROMBEL_FIX.md)
- 📊 [Session Summary](SESSION_SUMMARY.md)

---

**End of Quick Reference Guide**
