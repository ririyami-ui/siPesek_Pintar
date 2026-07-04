"""fix_informatika8.py – Restore Informatika to 8 elements matching buku Kemendikbud.

BSKAP element table has 4 elements (Berpikir Komputasional, Literasi Digital,
Analisis Data, Algoritma dan Pemrograman) but Fase D (SMP) CP only covers
the first 2. HOWEVER, the official BUKU KEMENDIKBUD for SMP uses 8 elements:
  1. Berpikir Komputasional
  2. Teknologi Informasi dan Komunikasi
  3. Sistem Komputer
  4. Jaringan Komputer dan Internet
  5. Analisis Data
  6. Algoritma dan Pemrograman
  7. Dampak Sosial Informatika
  8. Praktik Lintas Bidang

We revert the earlier fix (that collapsed to 2 elements) and restore the
proper element names and their materi_inti.
"""
import json

SRC = "resources/js/utils/bskap_2025_intel.json"

ELEMEN_8 = [
    "Berpikir Komputasional",
    "Teknologi Informasi dan Komunikasi",
    "Sistem Komputer",
    "Jaringan Komputer dan Internet",
    "Analisis Data",
    "Algoritma dan Pemrograman",
    "Dampak Sosial Informatika",
    "Praktik Lintas Bidang",
]

# Materi mapping: (old_elemen -> new_elemen)
MATERI_MAP = {
    "Berpikir Komputasional": "Berpikir Komputasional",     # stays
    "Teknologi Informasi dan Komunikasi": "Teknologi Informasi dan Komunikasi",
    "Sistem Komputer": "Sistem Komputer",
    "Jaringan Komputer dan Internet": "Jaringan Komputer dan Internet",
    "Analisis Data": "Analisis Data",
    "Algoritma dan Pemrograman": "Algoritma dan Pemrograman",
    "Dampak Sosial Informatika": "Dampak Sosial Informatika",
    "Praktik Lintas Bidang": "Praktik Lintas Bidang",
}

# Fix map: if materi_inti currently has "Literasi Digital", we need to find
# which new element it maps to. Based on content:
#   TIK -> Teknologi Informasi dan Komunikasi
#   Sistem Komputer -> Sistem Komputer
#   Jaringan -> Jaringan Komputer dan Internet
#   Dampak Sosial -> Dampak Sosial Informatika
#   Praktik Lintas -> Praktik Lintas Bidang
LITERASI_REMAP = {
    "TIK": "Teknologi Informasi dan Komunikasi",
    "Sistem Komputer": "Sistem Komputer",
    "Jaringan": "Jaringan Komputer dan Internet",
    "Dampak": "Dampak Sosial Informatika",
    "Praktik": "Praktik Lintas Bidang",
    "Literasi Digital": "Teknologi Informasi dan Komunikasi",  # fallback
}

with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

changes = 0
for grade in ["7", "8", "9"]:
    info = data["subjects"]["SMP"][grade].get("Informatika")
    if not info:
        print(f"SMP {grade}: Informatika not found, skip")
        continue

    print(f"\n=== Informatika SMP {grade} ===")

    for semester in ["ganjil", "genap"]:
        sem = info[semester]
        old_elemen = sem["elemen"][:]

        # Restore 8 elements
        sem["elemen"] = ELEMEN_8[:]
        print(f"  {semester}: elemen {len(old_elemen)} elemen -> {len(ELEMEN_8)} elemen")

        # Fix each materi_inti element field
        for mi in sem["materi_inti"]:
            old_e = mi["elemen"]
            old_materi = mi["materi"]

            if old_e in ELEMEN_8:
                # Already correct, no change needed
                continue

            # Old elemen is "Literasi Digital" — derive correct one from materi name
            if old_e == "Literasi Digital":
                # Find best match by keyword
                new_e = "Teknologi Informasi dan Komunikasi"  # default
                for kw, mapped in LITERASI_REMAP.items():
                    if kw.lower() in old_materi.lower():
                        new_e = mapped
                        break
            else:
                new_e = old_e  # keep as-is (unlikely)

            if old_e != new_e:
                print(f"    materi '{old_materi[:35]}...' element {old_e} -> {new_e}")
                mi["elemen"] = new_e
                changes += 1

with open(SRC, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} materi_inti element fixes ===")
