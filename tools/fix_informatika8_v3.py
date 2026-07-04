"""fix_informatika8_v3.py – Force-correct all materi_inti element fields.

Existing mappings are wrong due to substring bug "tik" matching "praktik".
Use explicit keyword matching with checks in correct priority order.
"""
import json, re

SRC = "resources/js/utils/bskap_2025_intel.json"

# Exact element mapping rules (first match wins, ordered by specificity)
def get_element(materi):
    """Return correct element name based on materi name."""
    m = materi

    # Priority order: most unique/longest keywords first
    if re.search(r'\bBerpikir\b', m):
        return "Berpikir Komputasional"
    if re.search(r'\bAlgoritma\b', m):
        return "Algoritma dan Pemrograman"
    if re.search(r'\bDampak\b', m):
        return "Dampak Sosial Informatika"
    if re.search(r'\bPraktik\b', m) and not re.search(r'\bTIK\b', m):
        return "Praktik Lintas Bidang"
    if re.search(r'\bJaringan\b', m):
        return "Jaringan Komputer dan Internet"
    if re.search(r'\bSistem\b', m):
        return "Sistem Komputer"
    if re.search(r'\bAnalisis\b', m):
        return "Analisis Data"
    if re.search(r'\bTIK\b', m):
        return "Teknologi Informasi dan Komunikasi"
    if re.search(r'\bTeknologi\b', m):
        return "Teknologi Informasi dan Komunikasi"

    return None  # unknown


with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

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

changes = 0
for grade in ["7", "8", "9"]:
    info = data["subjects"]["SMP"][grade].get("Informatika")
    if not info:
        continue

    print(f"\n=== Informatika SMP {grade} ===")

    for semester in ["ganjil", "genap"]:
        sem = info[semester]
        sem["elemen"] = ELEMEN_8[:]

        for mi in sem["materi_inti"]:
            old_e = mi["elemen"]
            expected = get_element(mi["materi"])

            if expected and old_e != expected:
                print(f"  {semester}: '{mi['materi'][:30]}...'  {old_e:>30s} -> {expected}")
                mi["elemen"] = expected
                changes += 1

with open(SRC, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} fixes ===")
