# Agent Rules

1. No improvisation – follow existing code patterns and conventions.
2. No hallucination – only act on verified information; ask when uncertain.
3. Stay focused – address one task at a time without deviating.

## Additional Constraints (User-Specified)
4. **No improvisation** – Do not invent new patterns or solutions. Follow existing code patterns and conventions strictly.
5. **No hallucination** – Only act on verified information from the codebase. Ask questions when uncertain about requirements or implementation details.
6. **Focus on code improvement** – Prioritize refactoring, optimization, and fixing existing code issues over adding new features.

## Project Status – BSKAP Kurikulum 2025 (HANDOFF, 2026-09-10)

### Data yang sudah disinkronkan ke CP resmi (SK BSKAP 046/H/KR/2025)
- `resources/js/utils/bskap_2025_intel.json`: materi_inti SMP dikoreksi (topik buangan dihapus/diganti, contoh: Pesawat Sederhana, Catur Asrama, muamalah, himpunan, persamaan/fungsi kuadrat). Elemen Informatika SMP disetel ke 2 elemen resmi (Berpikir Komputasional & Literasi Digital); label Seni Rupa "Mengekspresikan"→"Menciptakan"; Hindu "Sraddha and Bhakti"→"Sraddha dan Bhakti". Peta bab (`textbooks.SMP`) diselaraskan ke materi; Matematika 9 peta bab diperbaiki (sebelumnya duplikat kelas 8).
- `storage/app/json/bskap_2025_intel.json`: salinan tanpa BOM utk konsistensi (DIGITIGNORE, tidak di-commit).
- `resources/js/utils/bskap_full_cp.json`: diekstrak dari `bskap_clean.txt` via `tools/extract_cp_full.js`. CP SMA kelas 11/12 kini reguler (bukan "Tingkat Lanjut"); varian Tingkat Lanjut disimpan terpisah di key `"... Tingkat Lanjut"` (B. Indonesia, Matematika, B. Inggris, Sejarah — hanya Fase F/kls 11-12). Struktur file: `{SD:{...},SMP:{...},SMA:{...}}` (TIDAK ada pembungkus `subjects`).
- `gemini.js` (line 1043 & 2087): membaca CP_FULL langsung `CP_FULL?.[level]?.[grade]?.[subject]` — jangan dikembalikan ke `.subjects?.[level]`.

### Cara regenerasi
- `node tools/extract_cp_full.js` → regenerasi `resources/js/utils/bskap_full_cp.json` dari `bskap_clean.txt` (sumber dokumen resmi, header "TINGKAT LANJUT" sudah dipetakan ke key terpisah).
- `storage/app/json/bskap_2025_verbatim.json` = fallback lama (11 mapel SMP), hanya dipakai bila `bskap_full_cp.json` tidak ada (lihat `AiGeneratorService::loadBskapData()`, app/Services/AiGeneratorService.php:157-188).

### Sisa yang pernah diindikasikan (belum dikerjakan, verifikasi dulu sebelum action)
- `cp_snippet` Hindu SMP 8 "Tri Kaya Parisudha" & SMP 9 "Catur Asrama" adalah kutipan CP resmi (bukan materi) — JANGAN diubah.
- Peta bab SD belum diaudit (scope sebelumnya: SMP).
- Berdasarkan AGENTS rule 1-2, selalu verifikasi ke `bskap_clean.txt` / kode sebelum ubah data.

### Git state
- Commit terakhir terkait: `6a5b4fb` (SMA Tingkat Lanjut + fix CP_FULL frontend), sebelumnya `09450fc` (peta bab SMP). Keduanya sudah di-push ke origin/main.
- Artefak `vite.config.js.timestamp-*.mjs` (untracked) jangan di-commit.
