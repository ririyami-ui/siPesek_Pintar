# Bug Report: Mata Pelajaran Tidak Muncul di Dropdown

**Date:** May 24, 2026  
**Severity:** HIGH  
**Status:** IDENTIFIED  
**Component:** SubjectController.php - Subject Listing Endpoint

---

## 1. Problem Description

**Issue:** Dropdown mata pelajaran tidak menampilkan data

**Impact:**
- User tidak bisa memilih mata pelajaran
- Fitur yang bergantung pada subject selection tidak bisa digunakan
- Blocking untuk input nilai, jurnal, jadwal, dll

---

## 2. Root Cause Analysis

### Location
**File:** `app/Http/Controllers/SubjectController.php`  
**Method:** `index()` (lines 17-68)

### The Problem

**Logika filtering terlalu ketat:**

```php
// Line 27-39: Admin Logic
if ($user->isAdmin()) {
    if ($request->has('class_id') || $request->has('teacher_id')) {
        // Filter berdasarkan TeacherAssignment
        $assignmentQuery = TeacherAssignment::query();
        // ...
        $subjectIds = $assignmentQuery->pluck('subject_id')->unique();
        $query->whereIn('id', $subjectIds);
    }
    return response()->json(['data' => $query->get()]);
}
```

**Masalahnya:**
1. **Jika ada parameter `class_id`** → Hanya tampilkan subjects yang sudah di-assign ke class tersebut
2. **Jika belum ada TeacherAssignment** → Subjects kosong
3. **Untuk Teacher** → Hanya tampilkan subjects yang di-assign ke teacher tersebut
4. **Untuk role lain dengan class_id** → Filter berdasarkan TeacherAssignment

### Skenario yang Menyebabkan Dropdown Kosong

**Skenario 1: Admin dengan class_id parameter**
```
Request: GET /api/subjects?class_id=1
↓
Check TeacherAssignment untuk class_id=1
↓
Jika tidak ada assignment → subjects = []
↓
Dropdown kosong ❌
```

**Skenario 2: Teacher tanpa assignment**
```
Request: GET /api/subjects
User: Teacher (role=teacher)
↓
Cari TeacherAssignment untuk teacher ini
↓
Jika tidak ada assignment → subjects = []
↓
Dropdown kosong ❌
```

**Skenario 3: Frontend mengirim class_id secara default**
```
Frontend: api.get('/subjects') // Mungkin ada default class_id
↓
Backend filter berdasarkan class_id
↓
Jika class belum punya assignment → subjects = []
↓
Dropdown kosong ❌
```

---

## 3. Data Verification

### Database Status
- **Total Subjects:** 13 (aktif)
- **Soft Deleted:** 0
- **TeacherAssignments:** [Perlu dicek]

### Expected Behavior
- **Admin tanpa filter:** Tampilkan SEMUA 13 subjects
- **Admin dengan class_id:** Tampilkan subjects untuk class tersebut
- **Teacher:** Tampilkan subjects yang di-assign ke teacher
- **Dropdown kosong:** Hanya jika memang tidak ada data

### Actual Behavior
- **Dropdown kosong** meskipun ada 13 subjects di database
- **Filtering terlalu agresif** bahkan untuk admin

---

## 4. Solution Options

### Option 1: Tambah Parameter `all=true` (RECOMMENDED)

**Pros:**
- Backward compatible
- Flexible untuk berbagai use case
- Admin bisa melihat semua subjects saat setup awal

**Implementation:**
```php
public function index(Request $request)
{
    $user = auth()->user();
    if (!$user) {
        return response()->json(['data' => []]);
    }

    $query = Subject::query();

    // [NEW] Allow admin to get all subjects with ?all=true
    if ($user->isAdmin() && $request->has('all') && $request->all === 'true') {
        return response()->json(['data' => $query->get()]);
    }

    // Rest of the logic...
}
```

**Frontend Update:**
```javascript
// Untuk dropdown yang perlu semua subjects
api.get('/subjects?all=true')

// Untuk filter berdasarkan class
api.get('/subjects?class_id=1')
```

---

### Option 2: Default Tampilkan Semua, Filter Jika Ada Parameter

**Pros:**
- Lebih intuitif
- Dropdown selalu ada data
- Filter hanya jika diminta

**Implementation:**
```php
public function index(Request $request)
{
    $user = auth()->user();
    if (!$user) {
        return response()->json(['data' => []]);
    }

    $query = Subject::query();

    // 1. Admin Logic
    if ($user->isAdmin()) {
        // [CHANGE] Hanya filter jika ada parameter
        if ($request->has('class_id') || $request->has('teacher_id')) {
            $assignmentQuery = TeacherAssignment::query();
            if ($request->has('class_id')) {
                $assignmentQuery->where('class_id', $request->class_id);
            }
            if ($request->has('teacher_id')) {
                $assignmentQuery->where('teacher_id', $request->teacher_id);
            }
            $subjectIds = $assignmentQuery->pluck('subject_id')->unique();
            
            // [NEW] Jika tidak ada assignment, tetap tampilkan semua
            if ($subjectIds->isNotEmpty()) {
                $query->whereIn('id', $subjectIds);
            }
        }
        // [CHANGE] Selalu return data (tidak filter jika tidak ada parameter)
        return response()->json(['data' => $query->get()]);
    }

    // 2. Teacher Logic - tetap sama
    if ($user->role === 'teacher') {
        $teacherRecord = Teacher::where('auth_user_id', $user->id)->first();
        
        if (!$teacherRecord) {
            return response()->json(['data' => []]);
        }

        $assignmentQuery = TeacherAssignment::where('teacher_id', $teacherRecord->id);
        if ($request->has('class_id')) {
            $assignmentQuery->where('class_id', $request->class_id);
        }
        
        $subjectIds = $assignmentQuery->pluck('subject_id')->unique();
        
        // [NEW] Jika teacher belum punya assignment, tampilkan semua
        if ($subjectIds->isNotEmpty()) {
            $query->whereIn('id', $subjectIds);
        }
        
        return response()->json(['data' => $query->get()]);
    }

    // 3. Other Roles
    if ($request->has('class_id')) {
        $subjectIds = TeacherAssignment::where('class_id', $request->class_id)
            ->pluck('subject_id')->unique();
        
        // [NEW] Jika tidak ada assignment, tampilkan semua
        if ($subjectIds->isNotEmpty()) {
            $query->whereIn('id', $subjectIds);
        }
    }

    return response()->json(['data' => $query->get()]);
}
```

---

### Option 3: Pisahkan Endpoint untuk "All Subjects"

**Pros:**
- Jelas dan eksplisit
- Tidak mengubah behavior existing endpoint

**Implementation:**
```php
// Route baru
Route::get('/subjects/all', [SubjectController::class, 'all']);

// Method baru di SubjectController
public function all()
{
    $user = auth()->user();
    if (!$user || !$user->isAdmin()) {
        abort(403, 'Admin only');
    }
    
    return response()->json(['data' => Subject::all()]);
}
```

---

## 5. Recommended Solution

**Gunakan Option 2** (Default tampilkan semua, filter jika ada parameter)

**Alasan:**
1. ✅ Paling intuitif untuk user
2. ✅ Dropdown selalu ada data
3. ✅ Backward compatible (tidak break existing code)
4. ✅ Flexible untuk berbagai use case
5. ✅ Admin bisa setup awal tanpa harus create assignment dulu

---

## 6. Testing Checklist

### Test Case 1: Admin tanpa parameter
```
GET /api/subjects
Expected: Semua 13 subjects
```

### Test Case 2: Admin dengan class_id (ada assignment)
```
GET /api/subjects?class_id=1
Expected: Subjects yang di-assign ke class 1
```

### Test Case 3: Admin dengan class_id (belum ada assignment)
```
GET /api/subjects?class_id=999
Expected: Semua subjects (fallback)
```

### Test Case 4: Teacher dengan assignment
```
GET /api/subjects
User: Teacher dengan assignment
Expected: Subjects yang di-assign ke teacher
```

### Test Case 5: Teacher tanpa assignment
```
GET /api/subjects
User: Teacher tanpa assignment
Expected: Semua subjects (fallback)
```

---

## 7. Implementation Steps

1. **Backup current code**
2. **Update SubjectController.php** dengan Option 2
3. **Test di local environment**
4. **Verify dropdown muncul**
5. **Test filtering masih bekerja**
6. **Deploy ke staging**
7. **UAT dengan user**
8. **Deploy ke production**

---

## 8. Related Issues

**Kemungkinan masalah serupa di controller lain:**
- [ ] ClassController - Filter terlalu ketat?
- [ ] TeacherController - Filter terlalu ketat?
- [ ] ScheduleController - Filter terlalu ketat?

---

## 9. Prevention

**Best Practices:**
1. ✅ Default behavior: Tampilkan data
2. ✅ Filter hanya jika diminta (explicit parameter)
3. ✅ Fallback ke "tampilkan semua" jika filter kosong
4. ✅ Dokumentasi API yang jelas
5. ✅ Test dengan berbagai skenario

---

**Status:** Ready for implementation  
**Priority:** HIGH  
**Estimated Time:** 30 minutes
