
# Laporan Pencocokan CP: `bskap_2025_intel.json` vs `bskap_clean.txt`

## Ringkasan

| Item | Nilai |
|------|-------|
| **Status** | ✅ Sebagian besar cocok, ada perbedaan level detail |
| **Regulasi** | Kedua file merujuk Kepka BSKAP **046/H/KR/2025** — ✅ cocok |
| **8 Dimensi Profil Lulusan** | JSON mencantumkan semua 8 dimensi — ✅ |
| **Fase → Kelas** | Mapping JSON (A:I-II, B:III-IV, C:V-VI, D:VII-IX, E:X, F:XI-XII) — ✅ sesuai dokumen |
| **Jumlah Mapel** | JSON mencakup semua mapel yang ada di dokumen resmi — ✅ |
| **Level Detail** | JSON: **rangkuman/snippet** — dokumen: **teks resmi penuh** |

---

## Perbandingan Per Mapel

### 1. Matematika

| Aspek | JSON (`cp_snippet`) | Dokumen Resmi |
|-------|---------------------|---------------|
| Fase A (Kelas 1-2) | Bilangan sampai 100 | Bilangan sampai 100 — ✅ cocok |
| Fase C (Kelas 5-6) | Bilangan sampai 1000 | Bilangan sampai 1000 — ✅ cocok |
| Elemen | Bilangan, Geometri, Analisis Data | Sama — ✅ |
| **Omission** | — | Dokumen mencakup "Analisis Data dan Peluang" serta *higher-order reasoning* yang tidak disebut eksplisit di JSON |

**Verdik:** ⚠️ Isi pokok cocok, JSON ringkas.

### 2. Bahasa Indonesia

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Kemampuan menyimak, membaca, berbicara, menulis | Sama — ✅ |
| **Omission** | — | Dokumen mencantumkan **tingkatan CEFR**, pedagogi berbasis genre, dan kaitan eksplisit ke 8 dimensi profil lulusan |

**Verdik:** ⚠️ JSON ringkas, tidak mencantumkan CEFR.

### 3. Pendidikan Agama Islam (PAI)

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Hafalan surat pendek, rukun ibadah, akhlak | Sama — ✅ |
| Elemen | Al-Qur'an, Aqidah, Akhlak, Fikih | Sama — ✅ |
| **Omission** | — | Dokumen mencakup ranah spiritual, moral, sosial-etik, dan pemetaan 8 dimensi |

**Verdik:** ✅ Isi inti sesuai.

### 4. Ilmu Pengetahuan Alam (IPA)

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Metode ilmiah, klasifikasi makhluk hidup, fisika dasar | Sama — ✅ |
| **Omission** | — | Dokumen mencakup analisis ekosistem, kepedulian lingkungan, dan 8 dimensi |

**Verdik:** ⚠️ Ringkas, omission pada aspek lingkungan dan dimensi profil lulusan.

### 5. Informatika

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Berpikir komputasional, TIK, sistem komputer, jaringan | Sama — ✅ |
| Elemen | BK, TIK, SK, JKI | Sama — ✅ |
| **Omission** | — | Dokumen mencakup **kewargaan digital**, etika, proyek lintas disiplin, dan CEFR |

**Verdik:** ⚠️ Kurang aspek etika digital dan kewargaan.

### 6. Bahasa Inggris

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Memahami dan merespon teks lisan | Sama — ✅ |
| **Omission** | — | Dokumen menyebut **target CEFR B1**, 6 keterampilan elemental, kaitan dengan 8 dimensi |

**Verdik:** ⚠️ Ringkas, tidak ada level CEFR.

### 7. Pendidikan Pancasila

| Aspek | JSON | Dokumen Resmi |
|-------|------|---------------|
| Fokus | Simbol, aturan, nilai Pancasila | Sama — ✅ |
| **Omission** | — | Dokumen mencakup kompetensi kewargaan, nilai, integrasi 8 dimensi |

**Verdik:** ⚠️ Ringkas.

---

## Temuan Kritis

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | **JSON hanya berisi `cp_snippet` (rangkuman), bukan teks CP resmi** | Tidak bisa digunakan untuk verifikasi legal atau kutipan langsung. Cukup untuk referensi AI/internal |
| 2 | **8 Dimensi Profil Lulusan** tidak disebut eksplisit di snippet Matematika, IPA, Informatika, Bahasa Inggris | AI yang menggunakan snippet mungkin tidak mengaitkan CP dengan dimensi profil lulusan |
| 3 | **Tingkat CEFR** tidak ada di snippet Bahasa Inggris dan Bahasa Indonesia | AI tidak bisa membedakan target kompetensi per fase berdasarkan standar internasional |
| 4 | **Kewargaan Digital / Etika** tidak ada di snippet Informatika | AI mungkin tidak memasukkan aspek etika dalam rekomendasi pembelajaran Informatika |
| 5 | **Fondasi PAUD** ada di dokumen tetapi JSON fokus ke SD-SMA | Tidak masalah karena aplikasi target SD-SMA |
| 6 | **Regulasi** `046/H/KR/2025` ✅, **Fase mapping** ✅, **Elemen per mapel** ✅ | Semua cocok dengan dokumen |

---

## Kesimpulan

`bskap_2025_intel.json` adalah **rangkuman yang cukup akurat** dari `bskap_clean.txt`. Cocok untuk:
- Referensi cepat struktur CP (elemen, fase, kelas)
- Input AI generator (RPP, ATP, kuis)
- Navigasi kurikulum di UI

**Tidak cocok untuk:**
- Verifikasi legal/resmi (butuh dokumen asli)
- Sitasi teks CP persis kata-kata dokumen
- Analisis mendalam yang membutuhkan detail seperti level CEFR, dimensi profil lulusan per mapel, atau kompetensi kewargaan digital

**Rekomendasi:** Jika ingin JSON lebih akurat, tambahkan:
1. `cp_full` — teks CP lengkap (copy dari `bskap_clean.txt`)
2. `cefr_level` untuk Bahasa Indonesia dan Bahasa Inggris
3. `eight_dimensions_mapping` per elemen (dimensi profil lulusan mana yang relevan)
4. `digital_citizenship` — flag untuk mapel yang mengandung aspek kewargaan digital

---
*Dibuat: 26 Juni 2026 | Pembanding: `bskap_2025_intel.json` vs `bskap_clean.txt` (Kepka 046/H/KR/2025)*
