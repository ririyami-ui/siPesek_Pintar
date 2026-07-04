"""Re-verify ACTUAL element table names from BSKAP clean text.
Compare with current Intel JSON values to confirm correct fix list.
"""
import json, re

lines = open('bskap_clean.txt', encoding='utf-8').readlines()

def get_elemen_names(section_header):
    """Extract element names from the 'Elemen Deskripsi' table."""
    capture_section = False
    in_table = False
    elements = []
    for i, line in enumerate(lines):
        if section_header in line.upper() and 'CAPAIAN' in line.upper() and len(line) < 100:
            capture_section = True
            continue
        if not capture_section:
            continue
        # Find the actual "Elemen Deskripsi" table header
        # After "C. Karakteristik" section, there's an element table
        stripped = line.strip()
        if stripped.startswith('Elemen') and 'Deskripsi' in stripped:
            in_table = True
            continue
        if in_table:
            # Stop at "D. Capaian Pembelajaran"
            if stripped.startswith('D. Capaian') or stripped.startswith('D. Capaian'):
                break
            if not stripped or stripped.startswith('==='):
                continue
            # An element name is a short standalone line (not a continuation of description)
            # It typically appears before multi-line descriptions
            # Element names DON'T start with lowercase
            # They DON'T contain description indicators
            is_elemen_name = False
            first_word = stripped.split()[0] if stripped.split() else ''
            if first_word and first_word[0].isupper() and not stripped.startswith('-'):
                # Check if this could be an element name
                # Element name lines in BSKAP are usually short and followed by multi-line descriptions
                is_elemen_name = True
                # But it could be description continuation; check if first word is known element
                # For now, let's just collect all candidates
                elements.append(stripped[:60])
            # Skip longer lines that are clearly descriptions
            
    return elements

# Manual extraction from clean file - verified by reading tables
# From the actual output above:
OFFICIAL_ELEMENTS = {
    "Agama Kristen": ["Allah Berkarya", "Manusia dan Nilai-nilai Kristiani", "Gereja dan Masyarakat Majemuk", "Alam dan Lingkungan Hidup"],
    "Agama Hindu": ["Kitab Suci Weda", "Sraddha dan Bhakti", "Susila", "Acara", "Sejarah Agama Hindu"],
    "Agama Buddha": ["Sejarah", "Ritual", "Etika"],
    "Agama Khonghucu": ["Sejarah Suci", "Kitab Suci", "Keimanan", "Tata Ibadah", "Perilaku Junzi (君子)"],
}

# Load Intel
with open('resources/js/utils/bskap_2025_intel.json', 'r', encoding='utf-8') as f:
    intel = json.load(f)

# Map subject name in Intel -> official elements
INTEL_NAMES = {
    "Pendidikan Agama Kristen": "Agama Kristen",
    "Pendidikan Agama Hindu": "Agama Hindu",
    "Pendidikan Agama Buddha": "Agama Buddha",
    "Pendidikan Agama Khonghucu": "Agama Khonghucu",
}

issues = []
for intel_name, official_key in INTEL_NAMES.items():
    official = OFFICIAL_ELEMENTS[official_key]
    for grade in ["7", "8", "9"]:
        info = intel["subjects"]["SMP"][grade].get(intel_name)
        if not info:
            continue
        intel_ganjil = info['ganjil']['elemen']
        intel_genap = info['genap']['elemen']
        intel_all = list(dict.fromkeys(intel_ganjil + intel_genap))
        
        if set(intel_all) != set(official):
            missing = set(official) - set(intel_all)
            extra = set(intel_all) - set(official)
            print(f"\n{intel_name} (SMP {grade})")
            print(f"  Official: {official}")
            print(f"  Intel:    {intel_all}")
            if missing: print(f"  MISSING: {missing}")
            if extra: print(f"  EXTRA:   {extra}")
            issues.append((intel_name, grade, missing, extra))
        else:
            print(f"{intel_name} (SMP {grade}): ✅ OK")

if not issues:
    print("\n=== ALL AGAMA SUBJECTS MATCH BSKAP OFFICIAL ELEMENTS ===")
