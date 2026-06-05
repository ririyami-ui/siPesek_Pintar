# Debugging Guide: Nilai Tidak Muncul di Kartu Akademik

**Date:** May 24, 2026  
**Purpose:** Menemukan penyebab nilai tidak muncul di summary cards

---

## 🔍 Debugging Steps

### Step 1: Buka Browser DevTools

```
1. Buka halaman Rekap Individu
2. Tekan F12 (atau Ctrl+Shift+I)
3. Pilih tab "Console"
4. Jangan tutup DevTools
```

### Step 2: Pilih Siswa dan Lihat Console

```
1. Pilih kelas
2. Pilih siswa
3. Lihat console untuk error messages
4. Screenshot console jika ada error
```

### Step 3: Tambah Console.log untuk Debugging

**File:** `resources/js/pages/RekapIndividuPage.jsx`

**Cari baris 352-388 (useEffect untuk stats):**

```javascript
// SEBELUM
useEffect(() => {
    if (!gradesData) return;
    
    setStats({
        academicAvg: gradesData.by_subject?.length > 0 ? ...
```

**SESUDAH (tambah console.log):**

```javascript
useEffect(() => {
    if (!gradesData) {
        console.log('❌ gradesData is null/undefined');
        return;
    }
    
    console.log('✅ gradesData received:', gradesData);
    console.log('📊 by_subject:', gradesData.by_subject);
    console.log('📊 overall_nilai_akhir:', gradesData.overall_nilai_akhir);
    console.log('📊 attendance_summary:', gradesData.attendance_summary);
    console.log('📊 infraction_summary:', gradesData.infraction_summary);
    
    setStats({
        academicAvg: gradesData.by_subject?.length > 0 ? ...
```

### Step 4: Lihat Network Request

```
1. Buka DevTools → Network tab
2. Pilih siswa
3. Cari request ke `/api/grades/summary/`
4. Klik request tersebut
5. Lihat tab "Response"
6. Screenshot response JSON
```

### Step 5: Analisis Response Structure

**Lihat apakah response memiliki:**

```json
{
  "by_subject": [
    {
      "subject_name": "Matematika",
      "nilai_akademik": 85,
      "nilai_sikap": 90,
      ...
    }
  ],
  "overall_nilai_akhir": 87.5,
  "attendance_summary": {
    "hadir": 45,
    "sakit": 2,
    "izin": 1,
    "alpa": 0,
    ...
  },
  "infraction_summary": {
    "total_points": 5,
    ...
  },
  "weights": {
    "academic": 50,
    "attitude": 50,
    ...
  },
  "radar_data": {...}
}
```

---

## 📋 Checklist Debugging

- [ ] DevTools Console terbuka
- [ ] Tidak ada error messages
- [ ] Console.log menampilkan gradesData
- [ ] by_subject array tidak kosong
- [ ] Field names sesuai (nilai_akademik, nilai_sikap, dll)
- [ ] Network response valid JSON
- [ ] Response memiliki semua field yang diharapkan

---

## 🐛 Kemungkinan Masalah & Solusi

### Masalah #1: gradesData null/undefined

**Gejala:**
```
Console: ❌ gradesData is null/undefined
```

**Penyebab:**
- API endpoint tidak return data
- Student belum punya grades
- API error

**Solusi:**
- Cek apakah student punya nilai di database
- Cek API endpoint `/api/grades/summary/{student_id}`
- Lihat error di server logs

---

### Masalah #2: by_subject kosong

**Gejala:**
```
Console: by_subject: []
```

**Penyebab:**
- Student belum punya grades
- Filter semester/academic_year tidak sesuai

**Solusi:**
- Input nilai untuk student terlebih dahulu
- Verifikasi semester & academic year

---

### Masalah #3: Field names tidak sesuai

**Gejala:**
```
Console: by_subject: [{subject_name: "...", nilaiAkademik: 85}]
Tapi code mencari: g.nilai_akademik
```

**Penyebab:**
- Backend mengirim camelCase (nilaiAkademik)
- Frontend mencari snake_case (nilai_akademik)

**Solusi:**
- Sesuaikan field names di frontend
- Atau standardisasi di backend

---

### Masalah #4: Calculation error

**Gejala:**
```
Console: by_subject: [{...}]
Tapi academicAvg tetap 0
```

**Penyebab:**
- Reduce function error
- Field name salah
- Type mismatch

**Solusi:**
- Tambah error handling di reduce
- Verify field names
- Check data types

---

## 📝 Informasi yang Diperlukan

Untuk fix bug ini, saya butuh:

1. **Screenshot Console Output:**
   - Hasil console.log gradesData
   - Hasil console.log by_subject
   - Hasil console.log overall_nilai_akhir

2. **Screenshot Network Response:**
   - Full JSON response dari `/api/grades/summary/{student_id}`

3. **Informasi Student:**
   - Nama siswa yang ditest
   - Kelas siswa
   - Apakah siswa sudah punya nilai di database

4. **Error Messages:**
   - Apakah ada error di console
   - Apakah ada error di server logs

---

## 🔧 Quick Fix (Temporary)

Jika ingin quick fix sementara, tambah fallback di frontend:

**File:** `resources/js/pages/RekapIndividuPage.jsx` (baris 356)

```javascript
// SEBELUM
academicAvg: gradesData.by_subject?.length > 0 ? 
    (gradesData.by_subject.reduce((sum, g) => sum + g.nilai_akademik, 0) / gradesData.by_subject.length).toFixed(2) 
    : 0,

// SESUDAH (dengan fallback)
academicAvg: gradesData.by_subject?.length > 0 ? 
    (gradesData.by_subject.reduce((sum, g) => 
        sum + (g.nilai_akademik || g.nilaiAkademik || 0), 0
    ) / gradesData.by_subject.length).toFixed(2) 
    : 0,
```

---

## 📞 Lapor Hasil Debugging

Setelah debugging, berikan informasi:

1. Apakah console.log menampilkan data?
2. Apa struktur JSON dari API response?
3. Apakah ada error messages?
4. Apakah field names sesuai?

Dengan informasi ini, saya bisa membuat fix yang tepat.

---

**Status:** Waiting for debugging info  
**Next:** Implement fix based on findings
