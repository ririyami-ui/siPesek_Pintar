"""fix_agama_renames.py – Fix minor renaming in agama element names.

Hindu:      "Sraddha and Bhakti" -> "Sraddha dan Bhakti"
Khonghucu:  "Perilaku Junzi" -> "Perilaku Junzi (君子)"
"""
import json

SRC = "resources/js/utils/bskap_2025_intel.json"

ELEMENT_MAP = {
    "Sraddha and Bhakti": "Sraddha dan Bhakti",
    "Perilaku Junzi": "Perilaku Junzi (君子)",
}

SUBJECTS = ["Pendidikan Agama Hindu", "Pendidikan Agama Khonghucu"]

with open(SRC, "r", encoding="utf-8") as f:
    data = json.load(f)

changes = 0
for grade in ["7", "8", "9"]:
    for subj in SUBJECTS:
        info = data["subjects"]["SMP"][grade].get(subj)
        if not info:
            continue
        label = f"{subj} (SMP {grade})"
        for sem in ["ganjil", "genap"]:
            sem_data = info[sem]
            # Fix elemen array
            old_elemen = sem_data["elemen"][:]
            new_elemen = [ELEMENT_MAP.get(e, e) for e in old_elemen]
            sem_data["elemen"] = new_elemen
            if old_elemen != new_elemen:
                print(f"{label} {sem}: elemen {old_elemen} -> {new_elemen}")
            # Fix materi_inti
            for mi in sem_data["materi_inti"]:
                old_e = mi["elemen"]
                if old_e in ELEMENT_MAP:
                    mi["elemen"] = ELEMENT_MAP[old_e]
                    changes += 1
                    print(f"  materi '{mi['materi'][:30]}...' element {old_e} -> {mi['elemen']}")

with open(SRC, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n=== DONE: {changes} materi_inti fixes ===")
