# Smart School Backend - Code Audit Report

**Date:** May 24, 2026  
**Application:** Sekolah Pintar (Smart School) - Backend  
**Tech Stack:** Laravel 10 + React 18 + MySQL  
**Audit Scope:** Full codebase analysis including architecture, security, code quality, and best practices

---

## Executive Summary

Smart School is a comprehensive school management system with AI-powered pedagogical features. The application demonstrates solid architectural patterns but has several security concerns, performance considerations, and code quality issues that require attention.

**Overall Assessment:** ⚠️ **MODERATE RISK** - Production-ready with caveats

---

## 1. Architecture & Technology Stack

### Backend
- **Framework:** Laravel 10 (PHP 8.1+)
- **API:** RESTful with Laravel Sanctum (token-based authentication)
- **Database:** MySQL (with SQLite/PostgreSQL support)
- **Key Libraries:**
  - `laravel/sanctum` - API authentication
  - `minishlink/web-push` - Push notifications
  - `guzzlehttp/guzzle` - HTTP client
  - Google Gemini API integration for AI features

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v7
- **Key Libraries:**
  - `react-big-calendar` - Scheduling UI
  - `recharts` - Data visualization
  - `jspdf` + `html2canvas` - PDF generation
  - `html5-qrcode` - QR code scanning
  - `@capacitor/*` - Mobile app support (Android)

### Infrastructure
- **PWA Support:** Service workers, offline capabilities, push notifications
- **Mobile:** Capacitor for Android app packaging
- **Deployment:** Laravel Vite plugin for asset compilation

---

## 2. Core Features & Modules

### Academic Management
- Student/Teacher/Class/Subject CRUD operations
- Automated timetable generation (`AutoScheduleService`)
- Grade management with KKTP assessment support
- Teaching journals with AI analysis

### Attendance & Monitoring
- Real-time attendance tracking
- Attendance trend analytics
- Admin dashboards for monitoring

### Library System
- Book cataloging with ISBN lookup
- Loan management with fine calculation
- Transaction tracking with unique IDs
- Librarian-specific operations

### AI Assistant ("Asisten Guru")
- Lesson plan (RPP) generation
- Quiz generation
- Handout/worksheet creation
- Student performance analysis
- Teaching journal analysis
- Real-time chat with context awareness

### Student/Parent Portal
- Dashboard with grades, attendance, infractions
- Library loan history
- Weekly schedule view
- Missing tasks tracking

### Administrative Features
- Database backup/restore with one-time download tickets
- Database truncation and wiping
- System log cleanup
- Audit logging for all changes

---

## 3. Security Analysis

### ✅ Strengths

1. **Authentication & Authorization**
   - Laravel Sanctum for token-based API auth
   - Role-based access control (admin, teacher, librarian, student, staff)
   - Device locking for student accounts (prevents multi-device abuse)
   - Password verification for destructive operations

2. **Input Validation**
   - Comprehensive request validation using Laravel's validation rules
   - Unique constraints on sensitive fields (NIS, NISN)
   - Type casting and data validation

3. **Database Security**
   - Foreign key constraints enabled
   - Soft deletes for data preservation
   - Audit logging for tracking changes
   - Transaction support for data consistency

4. **API Rate Limiting**
   - Login endpoint: 5 attempts per minute
   - Student chat: 10 requests per minute

### ⚠️ Security Concerns

#### 1. **CRITICAL: API Key Exposure Risk**
**Location:** `app/Services/GeminiService.php:26-60`

```php
// API key stored in user profiles and config
$this->apiKey = (string) config('services.gemini.api_key', '');
if ($profile) {
    if ($profile->google_ai_api_key && $profile->google_ai_api_key !== 'your_gemini_api_key_here') {
        $this->apiKey = $profile->google_ai_api_key;
    }
}
```

**Issues:**
- Gemini API keys stored in database (user profiles)
- Keys accessible to authenticated users
- No encryption for stored keys
- Fallback to admin's key if user key missing (privilege escalation risk)

**Recommendation:**
- Use Laravel's encrypted config or HashiCorp Vault
- Store keys in environment variables only
- Implement key rotation mechanism
- Never expose keys in user profiles

---

#### 2. **HIGH: Dangerous Database Operations Without Audit Trail**
**Location:** `app/Http/Controllers/Admin/DatabaseManagementController.php`

```php
public function wipeDatabase(Request $request)
{
    // Truncates ALL tables after password verification
    foreach ($this->tablesToManage as $table) {
        DB::table($table)->truncate();
    }
}
```

**Issues:**
- `wipeDatabase()` destroys all data with only password verification
- `truncateTable()` allows truncating individual tables
- No audit log of what was deleted
- No confirmation dialog or time-based safeguards
- No backup creation before deletion

**Recommendation:**
- Require multi-factor confirmation (email + SMS)
- Create automatic backup before destructive operations
- Log all deletions with timestamps and user info
- Implement soft delete recovery window
- Add rate limiting on destructive operations

---

#### 3. **HIGH: SQL Injection Risk in Backup Restore**
**Location:** `app/Http/Controllers/Admin/DatabaseManagementController.php:246-257`

```php
$sql = file_get_contents($path);
// Regex replacement for DEFINER
$sql = preg_replace('/DEFINER\s*=\s*`[^`]+`@`[^`]+`/', '', $sql);
DB::unprepared($sql);  // ⚠️ Executes arbitrary SQL
```

**Issues:**
- `DB::unprepared()` executes raw SQL without parameterization
- File upload validation only checks MIME type
- No SQL syntax validation before execution
- Malicious SQL could be injected via backup file

**Recommendation:**
- Validate SQL syntax before execution
- Use prepared statements where possible
- Implement SQL parser to detect dangerous operations
- Restrict file upload to specific directory
- Add file size limits

---

#### 4. **HIGH: Device Lock Bypass Potential**
**Location:** `app/Http/Controllers/Api/AuthController.php:62-77`

```php
if ($user->role === 'student') {
    $deviceId = $request->input('device_id');
    if ($deviceId) {
        if (!$user->device_id) {
            $user->device_id = $deviceId;  // First login binds device
            $user->save();
        } else if ($user->device_id !== $deviceId) {
            return response()->json(['message' => 'Device mismatch'], 403);
        }
    }
}
```

**Issues:**
- Device ID can be spoofed (client-provided)
- No cryptographic verification of device identity
- Device ID stored as plain text
- No device fingerprinting or hardware binding

**Recommendation:**
- Use device fingerprinting (hardware identifiers)
- Implement certificate pinning for mobile apps
- Hash device IDs with salt
- Add device verification via push notification

---

#### 5. **MEDIUM: Insufficient Authorization Checks**
**Location:** `app/Http/Controllers/StudentController.php:20-31`

```php
if ($search = request('search')) {
    $students = Student::where(function($q) use ($search) {
        // Returns ALL students matching search
    })->limit(10)->get();
    return response()->json(['data' => $students]);
}
```

**Issues:**
- Search endpoint bypasses class/role restrictions
- Teachers can see all students via search
- Librarians can access student data without proper filtering
- No pagination on search results

**Recommendation:**
- Apply same authorization rules to search
- Implement proper pagination
- Log search queries for audit
- Add rate limiting on search

---

#### 6. **MEDIUM: Weak Password Requirements**
**Location:** `app/Http/Controllers/Api/AuthController.php:20`

```php
'password' => 'required|string|min:8',
```

**Issues:**
- Only 8 character minimum
- No complexity requirements (uppercase, numbers, symbols)
- No password history
- No expiration policy

**Recommendation:**
- Enforce: min 12 chars, uppercase, lowercase, numbers, symbols
- Implement password history (prevent reuse)
- Add password expiration (90 days)
- Implement account lockout after failed attempts

---

#### 7. **MEDIUM: Unencrypted Sensitive Data**
**Location:** Multiple models

**Issues:**
- Push subscriptions stored as JSON in database
- User signatures stored as file paths
- No encryption for PII (addresses, phone numbers)
- Audit logs contain potentially sensitive information

**Recommendation:**
- Encrypt sensitive fields using Laravel's encryption
- Use database-level encryption for PII
- Implement field-level access control
- Redact sensitive data from logs

---

#### 8. **MEDIUM: Missing CSRF Protection on API**
**Location:** `routes/api.php`

**Issues:**
- API routes don't use CSRF tokens (correct for stateless API)
- But no alternative token validation
- Relies solely on Sanctum tokens
- No request signing or HMAC validation

**Recommendation:**
- Implement request signing for sensitive operations
- Add rate limiting per user/IP
- Implement API key rotation
- Add request timestamp validation

---

### 🔒 Authentication Flow

```
Client Login → AuthController::login()
  ├─ Validate email/username + password
  ├─ Check device_id (students only)
  ├─ Create Sanctum token
  └─ Return token + user data

Subsequent Requests
  ├─ Include token in Authorization header
  ├─ Sanctum middleware validates token
  └─ Request proceeds with auth()->user()
```

**Issues with this flow:**
- No token expiration enforcement
- No refresh token mechanism
- Tokens stored in browser localStorage (XSS vulnerable)
- No logout on all devices option

---

## 4. Code Quality Issues

### 4.1 Performance Concerns

#### 1. **N+1 Query Problem**
**Location:** Multiple controllers

```php
// GradeController::index()
$grades = $query->orderBy('date', 'desc')->get();
// Missing: ->with(['student', 'subject', 'schoolClass'])
```

**Impact:** Each grade loads student/subject/class separately  
**Fix:** Add eager loading with `with()`

---

#### 2. **Inefficient Scheduling Algorithm**
**Location:** `app/Services/AutoScheduleService.php:75`

```php
$maxAttempts = 150;  // Brute force approach
for ($i = 0; $i < $maxAttempts; $i++) {
    // Try random allocation until success
}
```

**Issues:**
- Brute force scheduling (up to 150 attempts)
- No optimization algorithm (genetic, constraint satisfaction)
- Can timeout on large datasets
- Memory intensive (512MB allocated)

**Recommendation:**
- Implement constraint satisfaction algorithm
- Use graph coloring for conflict resolution
- Add caching for template slots
- Implement incremental scheduling

---

#### 3. **Large File Operations Without Streaming**
**Location:** `app/Http/Controllers/Admin/DatabaseManagementController.php:246`

```php
$sql = file_get_contents($path);  // Loads entire file into memory
DB::unprepared($sql);  // Executes as single query
```

**Issues:**
- Large backups (>100MB) cause memory exhaustion
- No streaming or chunking
- Single transaction for entire restore

**Recommendation:**
- Implement streaming SQL parser
- Process in chunks (1000 rows at a time)
- Use multiple transactions
- Add progress tracking

---

#### 4. **Unoptimized AI API Calls**
**Location:** `app/Services/GeminiService.php:67-146`

```php
public function callGeminiApi($promptOrContents, ...) {
    $retries = 3;
    $delay = 1000;  // 1 second
    // Exponential backoff but no circuit breaker
}
```

**Issues:**
- No caching for identical prompts
- Retry logic without circuit breaker
- No request deduplication
- Timeout set to 90 seconds (very long)

**Recommendation:**
- Implement Redis caching for prompts
- Add circuit breaker pattern
- Reduce timeout to 30 seconds
- Implement request deduplication

---

### 4.2 Code Organization Issues

#### 1. **God Controllers**
- `DashboardController.php` - 28,813 bytes (too large)
- `ScheduleController.php` - 39,889 bytes (too large)
- `AiFeaturesController.php` - 16,565 bytes (too large)

**Recommendation:**
- Split into smaller, focused controllers
- Extract business logic to services
- Use action classes for complex operations

---

#### 2. **Missing Service Layer Abstraction**
**Location:** Controllers directly access models

```php
// In GradeController
$grade = Grade::updateOrCreate([...]);
// Should use GradeService
```

**Issues:**
- Business logic scattered in controllers
- Difficult to test
- Code duplication across controllers
- Hard to reuse logic

---

#### 3. **Inconsistent Error Handling**
**Location:** Various controllers

```php
// Some endpoints return 422 with message
return response()->json(['message' => 'Error'], 422);

// Others return 500 with exception
return response()->json(['message' => $e->getMessage()], 500);

// Some don't catch exceptions at all
```

**Recommendation:**
- Create custom exception classes
- Implement global exception handler
- Standardize error response format
- Log all errors with context

---

### 4.3 Testing & Documentation

**Issues:**
- No visible test files in codebase
- No API documentation (Swagger/OpenAPI)
- No inline code documentation
- No architecture decision records (ADRs)

**Recommendation:**
- Implement PHPUnit tests (target 80% coverage)
- Generate OpenAPI/Swagger documentation
- Add PHPDoc comments to all public methods
- Create architecture documentation

---

## 5. Database Design

### Schema Overview

```
Core Tables:
├── users (authentication)
├── students (student profiles)
├── teachers (teacher profiles)
├── classes (school classes)
├── subjects (subjects/courses)
├── schedules (timetable)
├── attendances (attendance records)
├── grades (academic scores)
├── journals (teaching journals)
├── infractions (discipline records)
├── books (library catalog)
├── library_loans (book loans)
├── audit_logs (change tracking)
└── user_profiles (extended user data)
```

### Issues

#### 1. **Missing Indexes**
- No indexes on frequently queried columns
- Foreign key columns not indexed
- Search columns (NIS, NISN) not indexed

**Impact:** Slow queries on large datasets

---

#### 2. **Soft Deletes Without Proper Filtering**
**Location:** Models use `SoftDeletes` trait

```php
// But queries don't always exclude soft-deleted records
$students = Student::where('class_id', $classId)->get();
// May include deleted students
```

**Recommendation:**
- Add global scope to exclude soft-deleted records
- Or explicitly use `withTrashed()` when needed

---

#### 3. **No Data Retention Policy**
- Audit logs grow indefinitely
- No archival strategy
- No GDPR compliance for data deletion

**Recommendation:**
- Implement data retention policies
- Archive old records to separate storage
- Implement GDPR right-to-be-forgotten

---

## 6. API Security & Design

### Endpoint Analysis

#### Public Endpoints (No Auth Required)
```
POST   /api/login                          - Login
GET    /api/public-settings                - PWA settings
GET    /api/admin/database/backup/download - Backup download (ticket-based)
```

#### Protected Endpoints (Auth Required)
```
GET    /api/me                             - Current user
POST   /api/logout                         - Logout
GET    /api/students                       - List students
POST   /api/students                       - Create student
GET    /api/schedules                      - List schedules
POST   /api/ai/chat                        - AI chat
```

#### Admin-Only Endpoints
```
POST   /api/register                       - Register user
POST   /api/admin/database/wipe            - Wipe database
POST   /api/admin/database/truncate        - Truncate table
POST   /api/admin/database/restore         - Restore database
```

### Issues

1. **No API versioning** - Breaking changes will affect all clients
2. **No deprecation warnings** - Old endpoints removed without notice
3. **Inconsistent response format** - Some return `{data: [...]}`, others return `{...}`
4. **No pagination defaults** - Some endpoints return all records
5. **No filtering standardization** - Each endpoint has different filter syntax

---

## 7. Frontend Security

### Issues

1. **Sensitive Data in localStorage**
   - Auth tokens stored in localStorage (XSS vulnerable)
   - No HttpOnly flag on cookies

2. **No Content Security Policy (CSP)**
   - Vulnerable to XSS attacks
   - No script source restrictions

3. **Missing Security Headers**
   - No X-Frame-Options
   - No X-Content-Type-Options
   - No Strict-Transport-Security

4. **Unvalidated External Dependencies**
   - `@google/generative-ai` - No integrity checks
   - Multiple npm packages without pinned versions

---

## 8. Deployment & Configuration

### Environment Configuration

**Current State:**
```
APP_DEBUG=true              ⚠️ Debug mode enabled in production
LOG_LEVEL=debug             ⚠️ Verbose logging
GEMINI_API_KEY=             ⚠️ Empty (must be set)
```

### Issues

1. **Debug Mode Enabled**
   - Exposes stack traces to users
   - Reveals application structure
   - Increases attack surface

2. **No Environment Separation**
   - Same config for dev/staging/production
   - No separate database per environment

3. **Missing Security Headers in .htaccess**
   - No HSTS
   - No CSP
   - No X-Frame-Options

---

## 9. Compliance & Privacy

### GDPR Compliance

**Issues:**
- No data export functionality
- No right-to-be-forgotten implementation
- No consent management
- No data processing agreements documented

### Data Protection

**Issues:**
- Student addresses stored unencrypted
- No data classification
- No encryption at rest
- No encryption in transit (HTTPS not enforced)

---

## 10. Recommendations Priority Matrix

### 🔴 CRITICAL (Fix Immediately)

1. **Encrypt Gemini API keys** - Prevent credential theft
2. **Add multi-factor confirmation to destructive operations** - Prevent accidental data loss
3. **Validate SQL before execution** - Prevent SQL injection
4. **Implement proper device verification** - Prevent account takeover
5. **Enable HTTPS enforcement** - Protect data in transit

### 🟠 HIGH (Fix Within 1 Sprint)

1. **Implement comprehensive authorization checks** - Prevent unauthorized access
2. **Add password complexity requirements** - Improve account security
3. **Encrypt sensitive database fields** - Protect PII
4. **Implement API versioning** - Enable safe evolution
5. **Add comprehensive logging** - Enable audit trails

### 🟡 MEDIUM (Fix Within 1 Quarter)

1. **Optimize N+1 queries** - Improve performance
2. **Refactor large controllers** - Improve maintainability
3. **Add comprehensive tests** - Improve reliability
4. **Implement API documentation** - Improve usability
5. **Add security headers** - Improve defense-in-depth

### 🟢 LOW (Nice to Have)

1. **Implement circuit breaker for AI API** - Improve resilience
2. **Add request signing** - Improve API security
3. **Implement data archival** - Improve performance
4. **Add GraphQL layer** - Improve flexibility
5. **Implement real-time notifications** - Improve UX

---

## 11. Security Checklist

- [ ] Encrypt all API keys and secrets
- [ ] Implement multi-factor authentication
- [ ] Add comprehensive audit logging
- [ ] Implement rate limiting on all endpoints
- [ ] Add input sanitization for all user inputs
- [ ] Implement CORS properly (not `*`)
- [ ] Add security headers (CSP, HSTS, X-Frame-Options)
- [ ] Implement HTTPS enforcement
- [ ] Add database encryption at rest
- [ ] Implement backup encryption
- [ ] Add intrusion detection
- [ ] Implement security scanning in CI/CD
- [ ] Add dependency vulnerability scanning
- [ ] Implement secrets scanning in git
- [ ] Add penetration testing schedule

---

## 12. Performance Optimization Opportunities

1. **Database Query Optimization**
   - Add missing indexes
   - Implement query caching
   - Use database views for complex queries

2. **API Response Optimization**
   - Implement pagination with cursor-based navigation
   - Add response compression (gzip)
   - Implement field selection (sparse fieldsets)

3. **Frontend Optimization**
   - Implement code splitting
   - Add lazy loading for components
   - Implement service worker caching strategy

4. **Infrastructure Optimization**
   - Implement CDN for static assets
   - Add Redis caching layer
   - Implement database read replicas

---

## 13. Monitoring & Observability

**Current State:** Minimal monitoring

**Recommendations:**
1. Implement centralized logging (ELK stack)
2. Add application performance monitoring (APM)
3. Implement error tracking (Sentry)
4. Add uptime monitoring
5. Implement security event monitoring
6. Add database performance monitoring

---

## 14. Conclusion

Smart School is a feature-rich application with solid architectural foundations. However, it requires immediate attention to security concerns, particularly around API key management, database operations, and authorization checks.

**Key Takeaways:**
- ✅ Good role-based access control foundation
- ✅ Comprehensive feature set
- ✅ AI integration well-implemented
- ⚠️ Security concerns need immediate remediation
- ⚠️ Performance optimization needed for scale
- ⚠️ Testing and documentation gaps

**Estimated Remediation Effort:**
- Critical issues: 2-3 weeks
- High priority: 4-6 weeks
- Medium priority: 8-12 weeks

**Recommended Next Steps:**
1. Schedule security audit with external firm
2. Implement critical security fixes
3. Set up automated security scanning
4. Establish security review process
5. Create incident response plan

---

## Appendix: File Structure

```
smart-school-backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/          (26 controllers)
│   │   ├── Middleware/           (12 middleware)
│   │   └── Requests/
│   ├── Models/                   (20+ models)
│   ├── Services/                 (7 services)
│   ├── Jobs/
│   ├── Console/
│   └── Exceptions/
├── routes/
│   ├── api.php                   (186 lines, main API routes)
│   ├── web.php
│   └── console.php
├── database/
│   ├── migrations/               (10+ migrations)
│   ├── seeders/
│   └── factories/
├── resources/
│   ├── js/                       (React components)
│   ├── css/
│   └── views/
├── config/                       (16 config files)
├── storage/
├── tests/
├── public/
└── vendor/
```

---

**Report Generated:** 2026-05-24  
**Auditor:** Code Analysis System  
**Status:** Ready for Review
