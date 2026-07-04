"""fix_pjok.py – Fix PJOK elements for SMP 7‑9 in bskap_2025_intel.json

Official PJOK Fase D elements (SMP 7‑9):
  1. Keterampilan Gerak
  2. Pengetahuan Gerak
  3. Pemanfaatan Gerak
  4. Kebugaran Jasmani
  5. Gaya Hidup Sehat

Current intel JSON:
  ganjil – [Keterampilan Gerak, Pengetahuan Gerak]
  genap  – [Pemanfaatan Gerak, Pengembangan Karakter]

We will:
  * Keep existing elements that already match.
  * Replace "Pengembangan Karakter" with "Gaya Hidup Sehat".
  * Add missing element "Kebugaran Jasmani" and a placeholder materi_inti entry.
  * Ensure elemen arrays contain the full 5 elements in correct order.
"""
import json

SRC = "resources/js/utils/bskap_2025_intel.json"

# Mapping old element name -> new element name (for existing materi)
ELEMENT_MAP = {
    "Pengembangan Karakter": "Gaya Hidup Sehat"
}

# Placeholder for missing Kebugaran Jasmani materi (added to genap list)
KEBERATAN_PLACEHOLDER = {
    "materi": "Kebugaran Jasmani (Olahraga Dasar)",
    "elemen": "Kebugaran Jasmani"
}

with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

changes = 0
for grade in ["7", "8", "9"]:
    pjok = data["subjects"]["SMP"][grade].get("PJOK")
    if not pjok:
        print(f"SMP {grade}: PJOK missing, skip")
        continue
    print(f"\n=== SMP {grade} PJOK ===")
    # Fix ganjil elemen (should be Keterampilan Gerak, Pengetahuan Gerak)
    ganjil = pjok["ganjil"]
    old_ganjil = ganjil["elemen"][:]
    ganjil["elemen"] = ["Keterampilan Gerak", "Pengetahuan Gerak"]
    print(f"  ganjil elemen {old_ganjil} -> {ganjil["elemen"]}")
    # Fix genap elemen (add missing two)
    genap = pjok["genap"]
    old_genap = genap["elemen"][:]
    # Replace any old element using map
    new_genap = []
    for e in old_genap:
        new_e = ELEMENT_MAP.get(e, e)
        if new_e not in new_genap:
            new_genap.append(new_e)
    # Ensure required elements are present
    required = ["Pemanfaatan Gerak", "Kebugaran Jasmani", "Gaya Hidup Sehat"]
    for r in required:
        if r not in new_genap:
            new_genap.append(r)
    genap["elemen"] = new_genap
    print(f"  genap elemen {old_genap} -> {genap["elemen"]}")
    # Fix materi_inti elements
    # Update existing materi_inti entries according to ELEMENT_MAP
    for mi in genap["materi_inti"]:
        old_e = mi["elemen"]
        if old_e in ELEMENT_MAP:
            mi["elemen"] = ELEMENT_MAP[old_e]
            changes += 1
            print(f"    materi '{mi['materi'][:30]}...' element {old_e} -> {mi['elemen']}")
    # Add placeholder for Kebugaran Jasmani if not already present
    exists = any(mi["elemen"] == "Kebugaran Jasmani" for mi in genap["materi_inti"])
    if not exists:
        genap["materi_inti"].append(KEBERATAN_PLACEHOLDER)
        changes += 1
        print(f"    added placeholder materi for Kebugaran Jasmani")

# Write back
with open(SRC, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} materi_inti updates applied ===")
