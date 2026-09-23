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
- Peta bab buku SMA (`textbooks.SMA`) diselaraskan ke materi_inti (1:1, urutan ganjil lalu genap) utk semua mapel yg punya mapel inti (kelas 10-12). Antropologi 11/12 (buku ada di data) & SMA10 per-mapel tak punya peta bab mandiri — SMA10 rumpun sains/sosial diarahkan ke payung "IPA"/"IPS" 8/4 bab. Catatan: CP Fase F 2025 ringkas/abstrak (topik rinci spt vektor/stoikiometri tidak disebut dlm teks CP), jadi materi_inti SMA 11/12 memakai nama topik turunan buku.
- **Buku SMA 10 payung (SIBI, commit `3daec9b`)**: buku "Ilmu Pengetahuan Alam untuk SMA/MA Kelas X (Edisi Revisi)" (8 bab, ISBN 978-623-118-461-0) & "Ilmu Pengetahuan Sosial untuk SMA/MA Kelas X (Edisi Revisi)" (4 bab, ISBN 978-623-118-469-6), judul resmi koreksi SIBI (sebelumnya "IPA Terpadu"/"IPS Terpadu"). File `resources/json/books/sma/ipa_10.json` & `ips_10.json`, index entry `sma-ipa-10`/`sma-ips-10` (mapel "IPA"/"IPS").
- **Backfill sub_topics (Fase 3, commit `5af3001`)**: `tools/backfill_subtopics.cjs` mengisi `sub_topics` bab buku dari `materi_inti` CP (token/substring score ≥ 0.15, urutan ganjil lalu genap) utk semua jenjang non-agama (119 file). Hasil align_report `tools/align_report.cjs`: TOTAL 937 → covered 657, partial 65, zero 105, no-book 110 (SMP Bahasa Daerah/Kepercayaan/Seni 72 + SMA Informatika/Seni Rupa/Prakarya 38). `align_report.cjs` memakai UMBRELLA (Fase E→IPA/IPS) konsisten backend — resolver payung hanya utk `grade == 10`.
- `storage/app/json/bskap_2025_intel.json`: salinan tanpa BOM utk konsistensi (DIGITIGNORE, tidak di-commit).
- `resources/js/utils/bskap_full_cp.json`: diekstrak dari `bskap_clean.txt` via `tools/extract_cp_full.js`. CP SMA kelas 11/12 kini reguler (bukan "Tingkat Lanjut"); varian Tingkat Lanjut disimpan terpisah di key `"... Tingkat Lanjut"` (B. Indonesia, Matematika, B. Inggris, Sejarah — hanya Fase F/kls 11-12). Struktur file: `{SD:{...},SMP:{...},SMA:{...}}` (TIDAK ada pembungkus `subjects`). CP 6 mapel agama sudah diupdate ke **KEPKA BKPDM 020/2026** (commit `ee7a609`): Islam (KKO baru Memahami→Membaca/menghafal/menulis), Kristen (iptek→IPTEK, membarui→membaharui), Katolik (sekolah, Sakramen kapitalisasi, Tradisi Suci, Martyria→Marturia), Hindu (Mengenali/Menerapkan/Menganalisis/Merefleksikan), Buddha (CP ditulis ulang penuh, artefak PDF dibersihkan), Khonghucu (rekonstruksi manual ortografi CJK).
- `gemini.js` (line 1043 & 2087): membaca CP_FULL langsung `CP_FULL?.[level]?.[grade]?.[subject]` — jangan dikembalikan ke `.subjects?.[level]`.
- `gemini.js` & `AiGeneratorService.php` (`resolveBskapSubjectKey`): fallback Fase E (SMA kelas 10) — CP_FULL & textbooks mapel Fisika/Kimia/Biologi dipetakan ke payung `"IPA"`, Ekonomi/Sosiologi/Geografi/Sejarah ke `"IPS"` (CP resmi Fase E memakai taksonomi payung). Tanpa ini RPP/ATP kelas 10 rumpun sains/sosial tak mendapatkan cp_full & peta bab.

### Cara regenerasi
- `node tools/extract_cp_full.js` → regenerasi `resources/js/utils/bskap_full_cp.json` dari `bskap_clean.txt` (sumber dokumen resmi, header "TINGKAT LANJUT" sudah dipetakan ke key terpisah).
  - ⚠️ HAZARD (verifikasi 2026-09-22): `bskap_clean.txt` untuk 6 mapel agama MASIH memuat teks SK BSKAP 046/2025, sedangkan data ter-commit sudah pakai KEPKA BKPDM 020/2026. Regenerasi akan MENURUNKAN 6 mapel agama (128 semester) ke teks SK 046. Jangan jalankan `extract_cp_full.js` tanpa menimpa bagian agama di `bskap_clean.txt` dengan teks KEPKA (sumber: isi ter-commit `bskap_full_cp.json` / PDF KEPKA). Mapel umum sudah sinkron 100%.
- `storage/app/json/bskap_2025_verbatim.json` = fallback lama (11 mapel SMP), hanya dipakai bila `bskap_full_cp.json` tidak ada (lihat `AiGeneratorService::loadBskapData()`, app/Services/AiGeneratorService.php:157-188).

### Gap buku yang SUDAH diisi (2026-09-11, judul diverifikasi via SIBI/katalog resmi)
- SD Seni Rupa 1-6 ("Seni Rupa untuk SD/MI Kelas I–VI"), SD PAI 2/3/4/5 (pola judul mengikuti file: "PAI dan Budi Pekerti Kelas II..V"), SD B.Inggris 2/3 ("My Next Words Kelas II/III", prefix Unit). Seluruh bab = materi_inti 1:1 (ganjil lalu genap).
- SMA B.Inggris 11 "English for Change" & 12 "Life Today" (judul resmi SIBI), bab = materi_inti 1:1.
- Koreksi judul SMA 10 B.Inggris: sebelumnya "English for Change Kelas X" (itu judul kelas XI) → "Bahasa Inggris: Work in Progress untuk SMA/SMK/MA Kelas X" (resmi).

### Gap buku yang BELUM diisi (TANPA buku resmi nasional — jangan diisi karangan; tidak bisa diverifikasi)
- Bahasa Daerah SD 1-6 & SMP 7-9: muatan lokal, tak ada buku nasional resmi.
- Prakarya SD 1-6 & SMA 10-12: mapel inti ada tapi tak ada buku siswa resmi Kemdikbud untuk SD (Prakarya SD = muatan lokal) & SMA.
- SMA 10 per-mapel Fisika/Kimia/Biologi/Ekonomi/Sosiologi/Geografi/Sejarah (buku yg ada hanya gabungan "IPA"/"IPS" kelas 10 — dan keduanya sudah ada di `textbooks.SMA['10']`).
- Antropologi 11/12: buku SUDAH ada di data, tapi tanpa mapel inti.
- `cp_snippet` Hindu SMP 8 "Tri Kaya Parisudha" & SMP 9 "Catur Asrama" adalah kutipan CP resmi (bukan materi) — JANGAN diubah.
- Berdasarkan AGENTS rule 1-2, selalu verifikasi ke `bskap_clean.txt` / SIBI / kode sebelum ubah data.

### Git state
- Commit terakhir terkait: `5af3001` (Fase 3 backfill sub_topics), `3daec9b` (Buku SMA 10 payung IPA/IPS + umbrella resolve backend), `ee7a609` (CP 6 agama → KEPKA BKPDM 020/2026), `7068ceb` (gap buku SD/SMA diisi via `fill_gap_books.js`), `df3c033` (peta bab SMA → materi_inti), `cd818dc` (fallback CP_FULL Fase E → IPA/IPS), `b4d43d7` (peta bab & data IPAS SD), `6a5b4fb` (SMA Tingkat Lanjut), `09450fc` (peta bab SMP). Semua sudah di-push ke origin/main.
- Artefak `vite.config.js.timestamp-*.mjs` (untracked) jangan di-commit.

### WORK IN PROGRESS — Analisis Ulangan Harian (handoff 2026-09-22, BELUM di-commit)
- Perbaikan selesai (sudah `vite build` sukses 2×, belum commit): `UlanganHarianController.php` (index() filter semester/tahun + select eksplisit; `syncToGrades` public + baca `request()->input('assessment_type')`; skor 0 selalu `updateOrCreate`, remidi ≥ 0), `analisisButir.js` (tabel `rtabel05()` df1-40, fallback `1.96/√df` df>40), `ulanganHarianDocx.js` (rapikan tata letak: `tableCell` undef dihapus→`headCell`/`dataCell` — sebelumnya CRASH bila ada siswa tuntas; sub-bab D diberi else; penomoran Distribusi `3.`; judul sect.5 → "REKOMENDASI & PROGRAM PERBAIKAN"; `cantSplit:true` di tabel skor/butir/absen/ttd), `gemini.js`/`pdfGenerator.js` (JSDoc `@deprecated` rekomendasi AI).
- AGENTS.md: hazard regenerasi CP agama (baris setelah bullet Cara regenerasi) — jangan jalankan `extract_cp_full.js` tanpa menimpa agama `bskap_clean.txt` dgn KEPKA.
- **Chart di Word (selesai 2026-09-23)**: 3 chart PNG disisipkan ke laporan Word — Distribusi skor akhir (bar), Daya serap per butir (bar + garis KKTP line), Tuntas vs belum (donut). Pendekatan terverifikasi: `docx@9.7.1` TIDAK punya chart native → render Chart.js (`Chart as ChartJS` + register BarController/LineController/DoughnutController/Category/Linear/Bar/Line/Arc) di canvas browser → `canvas.toDataURL` → `Uint8Array` → `ImageRun` (620×320 / 420×420). Helper di `ulanganHarianDocx.js`: `renderChartToPng` (guarded `typeof document === 'undefined'` → null), `chartDistribusi`, `chartDayaSerap`, `chartKetuntasan`, `chartImageRun`. Diverifikasi: vite build sukses + e2e (stub `document` via `@napi-rs/canvas`, 3 PNG ter-embed di `word/media`). Catatan: import `./analisisButir` tanpa ekstensi hanya di-resolve Vite → uji e2e harus via `vite.ssrLoadModule`.
- **NEXT (belum dikerjakan):** — tidak ada; tunggu instruksi/commit.
- Jangan commit dulu tanpa instruksi; jangan stage artefak scratch: `02_ANALISIS ULANGAN HARIAN 2 KELAS IX - KOSONG.xlsx`, `Salinan-Kepka-BKPDM-...pdf`, `inspect_excel.cjs`, `inspect_excel.js`. Commit `936c698` (performa) BELUM di-push.
