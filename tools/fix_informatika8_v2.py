"""fix_informatika8_v2.py – Restore Informatika 8 elements (corrected matching).

Step 1: For each materi_inti, look up the CORRECT element name from a
direct mapping table (materi_keyword -> element_name).

Step 2: Use WHOLE-WORD matching to avoid "TIK" matching "informatika".
"""
import json, re

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

# Direct mapping from unique old elemen value -> new elemen value
# Based on the actual materi names and their BSKAP elements
GANJIL_MAP = {
    "Berpikir Komputasional": "Berpikir Komputasional",
    "Teknologi Informasi": "Teknologi Informasi dan Komunikasi",
}

# Better approach: map by keywords with word-boundary regex
def map_elemen(materi_name):
    """Map a materi name to correct element using whole-word matching."""
    m_lower = materi_name.lower()
    rules = [
        (r'\bberpikir\b', "Berpikir Komputasional"),
        (r'\btik\b', "Teknologi Informasi dan Komunikasi"),
        (r'\bsistem\b', "Sistem Komputer"),
        (r'\bjaringan\b', "Jaringan Komputer dan Internet"),
        (r'\bdata\b', "Analisis Data"),
        (r'\balgoritma\b', "Algoritma dan Pemrograman"),
        (r'\bdampak\b', "Dampak Sosial Informatika"),
        (r'\bpraktik\b', "Praktik Lintas Bidang"),
    ]
    for pattern, element in rules:
        if re.search(pattern, m_lower):
            return element
    # Default
    return "Teknologi Informasi dan Komunikasi"


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

        # Restore 8 elements (order from buku)
        sem["elemen"] = ELEMEN_8[:]
        print(f"  {semester}: elemen {len(old_elemen)} -> {len(ELEMEN_8)} elements")

        # Fix each materi_inti element field
        for mi in sem["materi_inti"]:
            old_e = mi["elemen"]
            old_materi = mi["materi"]

            if old_e in ELEMEN_8:
                continue  # already correct

            # Determine correct element based on materi name content
            new_e = map_elemen(old_materi)

            if old_e != new_e:
                print(f"    '{old_materi[:30]}...'  {old_e:>12} -> {new_e}")
                mi["elemen"] = new_e
                changes += 1

with open(SRC, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} fixes ===")
