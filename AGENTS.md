# Agent Rules

1. No improvisation – follow existing code patterns and conventions.
2. No hallucination – only act on verified information; ask when uncertain.
3. Stay focused – address one task at a time without deviating.

## Additional Constraints (User-Specified)
4. **No improvisation** – Do not invent new patterns or solutions. Follow existing code patterns and conventions strictly.
5. **No hallucination** – Only act on verified information from the codebase. Ask questions when uncertain about requirements or implementation details.
6. **Focus on code improvement** – Prioritize refactoring, optimization, and fixing existing code issues over adding new features.

## Project Status – BSKAP Kurikulum 2025 (HANDOFF, 2026-09-11)

### Data yang sudah disinkronkan ke CP resmi (SK BSKAP 046/H/KR/2025)
- `resources/js/utils/bskap_2025_intel.json`: materi_inti SMP dikoreksi (topik buangan dihapus/diganti, contoh: Pesawat Sederhana, Catur Asrama, muamalah, himpunan, persamaan/fungsi kuadrat). Elemen Informatika SMP disetel ke 2 elemen resmi (Berpikir Komputasional & Literasi Digital); label Seni Rupa "Mengekspresikan"→"Menciptakan"; Hindu "Sraddha and Bhakti"→"Sraddha dan Bhakti". Peta bab (`textbooks.SMP`) diselaraskan ke materi; Matematika 9 peta bab diperbaiki (sebelumnya duplikat kelas 8).
- Peta bab SD (`textbooks.SD`) juga sudah diselaraskan: Matematika 6 diganti ke materi (sebelumnya Pecahan/Desimal, Rasio, Kubus-Balok, Peluang → kini bilangan bulat, lingkaran, bangun ruang, jaring-jaring, penyajian data); buku IPAS kelas 2 dihapus (IPAS resmi dimulai kelas 3, Fase B); PJOK kelas 2/3/4/5/6 bab diselaraskan ke materi (7/6/8/7/4 bab). Mapel inti IPAS ditambahkan untuk SD kelas 3 (elemen Fase B: Pemahaman IPAS & Keterampilan Proses; 8 materi dari bab buku kelas 3; cp_snippet grounded ke CP Fase B) — struktur `subjects.SD['3']` kini identik dengan kelas 4.
- Peta bab buku SMA (`textbooks.SMA`) diselaraskan ke materi_inti (1:1, urutan ganjil lalu genap) utk semua mapel yg punya mapel inti (kelas 10-12). IPA/IPS kelas 10 & Antropologi 11/12 tak punya mapel inti — dibiarkan apa adanya. Catatan: CP Fase F 2025 ringkas/abstrak (topik rinci spt vektor/stoikiometri tidak disebut dlm teks CP), jadi materi_inti SMA 11/12 memakai nama topik turunan buku.
- `storage/app/json/bskap_2025_intel.json`: salinan tanpa BOM utk konsistensi (DIGITIGNORE, tidak di-commit).
- `resources/js/utils/bskap_full_cp.json`: diekstrak dari `bskap_clean.txt` via `tools/extract_cp_full.js`. CP SMA kelas 11/12 kini reguler (bukan "Tingkat Lanjut"); varian Tingkat Lanjut disimpan terpisah di key `"... Tingkat Lanjut"` (B. Indonesia, Matematika, B. Inggris, Sejarah — hanya Fase F/kls 11-12). Struktur file: `{SD:{...},SMP:{...},SMA:{...}}` (TIDAK ada pembungkus `subjects`).
- `gemini.js` (line 1043 & 2087): membaca CP_FULL langsung `CP_FULL?.[level]?.[grade]?.[subject]` — jangan dikembalikan ke `.subjects?.[level]`.
- `gemini.js` & `AiGeneratorService.php` (`resolveBskapSubjectKey`): fallback Fase E (SMA kelas 10) — CP_FULL & textbooks mapel Fisika/Kimia/Biologi dipetakan ke payung `"IPA"`, Ekonomi/Sosiologi/Geografi/Sejarah ke `"IPS"` (CP resmi Fase E memakai taksonomi payung). Tanpa ini RPP/ATP kelas 10 rumpun sains/sosial tak mendapatkan cp_full & peta bab.

### Cara regenerasi
- `node tools/extract_cp_full.js` → regenerasi `resources/js/utils/bskap_full_cp.json` dari `bskap_clean.txt` (sumber dokumen resmi, header "TINGKAT LANJUT" sudah dipetakan ke key terpisah).
- `storage/app/json/bskap_2025_verbatim.json` = fallback lama (11 mapel SMP), hanya dipakai bila `bskap_full_cp.json` tidak ada (lihat `AiGeneratorService::loadBskapData()`, app/Services/AiGeneratorService.php:157-188).

### Sisa yang pernah diindikasikan (belum dikerjakan, verifikasi dulu sebelum action)
- `cp_snippet` Hindu SMP 8 "Tri Kaya Parisudha" & SMP 9 "Catur Asrama" adalah kutipan CP resmi (bukan materi) — JANGAN diubah.
- Gap buku SD (bukan konflik, butuh buku asli utk pengisian): `textbooks.SD` belum punya Seni Rupa, Prakarya, Bahasa Daerah (semua kelas 1-6), Pendidikan Agama Islam kelas 2/3, Bahasa Inggris kelas 2/3.
- Gap buku SMA: Bahasa Inggris 11/12, Prakarya 10-12, buku per-mapel kelas 10 utk Fisika/Kimia/Biologi/Ekonomi/Sosiologi/Geografi/Sejarah (buku yg ada hanya gabungan "IPA/IPS Terpadu" kelas 10, tak punya mapel inti), dan Antropologi 11/12 tanpa mapel inti yg cocok. Verifikasi ke `bskap_clean.txt`/materi dulu sebelum ubah.
- Berdasarkan AGENTS rule 1-2, selalu verifikasi ke `bskap_clean.txt` / kode sebelum ubah data.

### Git state
- Commit terakhir terkait: `df3c033` (peta bab SMA → materi_inti), `cd818dc` (fallback CP_FULL Fase E → IPA/IPS), sebelum `b4d43d7` (peta bab & data IPAS SD), `6a5b4fb` (SMA Tingkat Lanjut), `09450fc` (peta bab SMP). Semua sudah di-push ke origin/main.
- Artefak `vite.config.js.timestamp-*.mjs` (untracked) jangan di-commit.
