"""fix_informatika.py – Fix Informatika Fase D elements & materi_inti

BSKAP No 046/2025 Lampiran II says Fase D (SMP) Informatika only has
2 elements: Berpikir Komputasional and Literasi Digital.
All Analisis Data, Algoritma & Pemrograman belong to Fase F only.

This script remaps the elemen field in every materi_inti and the elemen
array for SMP 7, 8, 9 to match BSKAP.
"""
import json, copy

SRC = "resources/js/utils/bskap_2025_intel.json"
DST = "resources/js/utils/bskap_2025_intel.json"  # same file, overwrite

# Mapping: (old_element_name) -> new_element_name
ELEMEN_MAP = {
    # Ganjil
    "Berpikir Komputasional": "Berpikir Komputasional",   # stays
    "Teknologi Informasi dan Komunikasi": "Literasi Digital",
    "Sistem Komputer": "Literasi Digital",
    "Jaringan Komputer dan Internet": "Literasi Digital",
    # Genap
    "Analisis Data": "Berpikir Komputasional",
    "Algoritma dan Pemrograman": "Berpikir Komputasional",
    "Dampak Sosial Informatika": "Literasi Digital",
    "Praktik Lintas Bidang": "Literasi Digital",
}

with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

changes = 0

for grade in ["7", "8", "9"]:
    info = data["subjects"]["SMP"][grade].get("Informatika")
    if not info:
        print(f"SMP {grade}: Informatika not found, skipping")
        continue

    print(f"\n=== Informatika SMP {grade} ===")

    for semester in ["ganjil", "genap"]:
        sem = info[semester]
        old_elemen = sem["elemen"][:]

        # Rebuild elemen list from unique, correctly mapped values
        new_elemen = []
        for old_e in old_elemen:
            new_e = ELEMEN_MAP.get(old_e, old_e)
            if new_e not in new_elemen:
                new_elemen.append(new_e)

        sem["elemen"] = new_elemen
        print(f"  {semester}: elemen {old_elemen} -> {new_elemen}")

        # Fix each materi_inti
        for mi in sem["materi_inti"]:
            old_e = mi["elemen"]
            new_e = ELEMEN_MAP.get(old_e, old_e)
            if old_e != new_e:
                print(f"    materi \"{mi['materi'][:50]}...\" elemen {old_e} -> {new_e}")
                mi["elemen"] = new_e
                changes += 1

with open(DST, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} materi_inti updated ===")
