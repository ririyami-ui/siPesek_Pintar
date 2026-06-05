# Bug Report: Nilai Tidak Muncul di Kartu Detail Akademik

**Date:** May 24, 2026  
**Severity:** HIGH  
**Status:** IDENTIFIED  
**Component:** RekapIndividuPage.jsx - Summary Cards

---

## 1. Masalah

**Gejala:**
- Halaman Rekap Individu membuka
- Kartu "Rata-rata Akademik" kosong atau menampilkan 0
- Kartu "Nilai Sikap" kosong atau menampilkan 0
- Kartu "Nilai Akhir" kosong atau menampilkan 0

**Impact:**
- User tidak bisa melihat ringkasan nilai siswa
- Data akademik tidak terlihat di kartu summary

---

## 2. Root Cause Analysis

### Lokasi Masalah
**File:** `resources/js/pages/RekapIndividuPage.jsx`  
**Lines:** 355-388 (useEffect untuk calculate stats)

### Penyebab Kemungkinan

**Masalah #1: Data gradesData tidak terisi**
```javascript
// Line 353
if (!gradesData) return;  // Jika gradesData kosong, stats tidak diupdate
```

**Masalah #2: Field name tidak sesuai**
```javascript
// Line 356
gradesData.by_subject?.length > 0 ? 
  (gradesData.by_subject.reduce((sum, g) => sum + g.nilai_akademik, 0) / ...)
```

Kemungkinan field name berbeda:
- `nilai_akademik` vs `nilaiAkademik` vs `academic_value`
- `nilai_sikap` vs `nilaiSikap` vs `attitude_value`

**Masalah #3: API response structure berbeda**
Backend mengirim data dengan struktur berbeda dari yang diharapkan frontend.

---

## 3. Debugging Steps

### Step 1: Cek Console Browser
```javascript
// Buka DevTools (F12) → Console
// Lihat apakah ada error saat load data
```

### Step 2: Cek Network Request
```
1. Buka DevTools → Network tab
2. Pilih siswa
3. Lihat request ke `/api/grades/summary/{student_id}`
4. Lihat response structure
```

### Step 3: Cek Data Structure
```javascript
// Di RekapIndividuPage.jsx, tambah console.log
useEffect(() => {
    if (!gradesData) return;
    
    console.log('gradesData:', gradesData);  // ← TAMBAH INI
    console.log('by_subject:', gradesData.by_subject);  // ← TAMBAH INI
    
    // ... rest of code
}, [gradesData, selectedStudent, selectedSubject]);
```

---

## 4. Solusi Potensial

### Option A: Cek Field Names di Backend
**File:** `app/Http/Controllers/Api/StudentDashboardController.php`

Verifikasi response structure:
```php
return response()->json([
    'by_subject' => [...],
    'overall_nilai_akhir' => ...,
    'attendance_summary' => [...],
    'infraction_summary' => [...],
    'weights' => [...],
    'radar_data' => [...]
]);
```

### Option B: Add Fallback di Frontend
```javascript
// Line 356 - tambah fallback
academicAvg: gradesData.by_subject?.length > 0 ? 
    (gradesData.by_subject.reduce((sum, g) => 
        sum + (g.nilai_akademik || g.nilaiAkademik || 0), 0
    ) / gradesData.by_subject.length).toFixed(2) 
    : 0,
```

### Option C: Add Null Checks
```javascript
// Tambah di awal useEffect
if (!gradesData || !gradesData.by_subject) {
    console.warn('gradesData or by_subject is missing');
    return;
}
```

---

## 5. Testing Checklist

- [ ] Buka halaman Rekap Individu
- [ ] Pilih kelas
- [ ] Pilih siswa
- [ ] Lihat apakah kartu nilai muncul
- [ ] Buka DevTools Console
- [ ] Lihat console.log output
- [ ] Verifikasi data structure
- [ ] Check Network tab untuk API response

---

## 6. Next Steps

1. **Debug:** Jalankan console.log untuk lihat data structure
2. **Verify:** Bandingkan dengan backend response
3. **Fix:** Sesuaikan field names atau add fallback
4. **Test:** Verifikasi kartu nilai muncul
5. **Deploy:** Push ke staging

---

**Status:** IDENTIFIED - Waiting for debugging info

**Priority:** HIGH

**Estimated Fix Time:** 30 minutes
