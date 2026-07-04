"""
Compare intel JSON elements against BSKAP extracted text for Fase D (SMP 7-9).
Run from project root.
"""
import json, re

INTEL_FILE = 'resources/js/utils/bskap_2025_intel.json'
BSKAP_FILE = 'bskap_extracted.txt'

# Load Intel JSON
with open(INTEL_FILE, 'r', encoding='utf-8') as f:
    intel = json.load(f)

# Load BSKAP as lines
with open(BSKAP_FILE, 'r', encoding='utf-8') as f:
    bskap_lines = f.readlines()

# === Known BSKAP Fase D element structure per subject ===
# Based on reading of Lampiran II
# Format: {subject_name_in_intel: (bskap_section_header_keyword, [expected_elemen_for_fase_d])}
# These are from the actual BSKAP document
FASE_D_ELEMEN = {
    "Pendidikan Agama Islam": ("PENDIDIKAN AGAMA ISLAM", ["Al-Qur'an Hadis", "Akidah", "Akhlak", "Fikih", "Sejarah Peradaban Islam"]),
    "Pendidikan Agama Kristen": ("PENDIDIKAN AGAMA KRISTEN", ["Allah Tritunggal", "Karya Keselamatan Allah dalam Yesus Kristus", "Hidup dalam Roh Kudus", "Gereja sebagai Persekutuan Orang Percaya", "Keluarga sebagai Komunitas Dasar", "Masyarakat yang Majemuk"]),
    "Pendidikan Agama Katolik": ("PENDIDIKAN AGAMA KATOLIK", ["Nilai-nilai Kristiani"]),  # simplified
    "Pendidikan Agama Hindu": ("PENDIDIKAN AGAMA HINDU", ["Tattwa", "Susila", "Acara"]),
    "Pendidikan Agama Buddha": ("PENDIDIKAN AGAMA BUDDHA", ["Sejarah Keagamaan", "Kitab Suci", "Keyakinan", "Etika", "Perayaan Keagamaan"]),
    "Pendidikan Agama Khonghucu": ("PENDIDIKAN AGAMA KHONGHUCU", ["Sejarah Keagamaan", "Kitab Suci", "Keyakinan", "Etika", "Perayaan Keagamaan"]),
    "Pendidikan Pancasila": ("PENDIDIKAN PANCASILA", ["Pancasila", "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945", "Negara Kesatuan Republik Indonesia", "Bhinneka Tunggal Ika"]),
    "Bahasa Indonesia": ("BAHASA INDONESIA", ["Menyimak", "Membaca dan Memirsa", "Berbicara dan Mempresentasikan", "Menulis"]),
    "Matematika": ("MATEMATIKA", ["Bilangan", "Aljabar", "Geometri", "Analisis Data dan Peluang"]),
    "Bahasa Inggris": ("BAHASA INGGRIS", ["Menyimak - Berbicara", "Membaca - Memirsa", "Menulis - Mempresentasikan"]),
    "IPA": ("ILMU PENGETAHUAN ALAM", ["Pemahaman IPA", "Keterampilan Proses"]),
    "IPS": ("ILMU PENGETAHUAN SOSIAL", ["Pemahaman IPS", "Keterampilan Proses"]),
    "Informatika": ("INFORMATIKA", ["Berpikir Komputasional", "Literasi Digital"]),
    "PJOK": ("PENDIDIKAN JASMANI, OLAHRAGA, DAN KESEHATAN", ["Keterampilan Gerak", "Pengetahuan Gerak", "Pemanfaatan Gerak", "Kebugaran Jasmani", "Gaya Hidup Sehat"]),
}

def extract_bskap_fase_d_elemen(subject_header_keyword, max_lines=200):
    """Extract element names for Fase D from BSKAP text."""
    capture = False
    fase_d_capture = False
    elemen_list = []
    
    for i, line in enumerate(bskap_lines):
        if f"CAPAIAN PEMBELAJARAN {subject_header_keyword}" in line.upper() and len(line) < 120:
            capture = True
            continue
        
        if capture:
            if "Elemen" in line and "Deskripsi" not in line and len(line.strip()) > 5 and len(line.strip()) < 100:
                # Check if this is part of a section header
                if re.match(r'^[A-Za-z]', line.strip()) and not re.match(r'^=== ', line):
                    eleman = line.strip().rstrip('\n').rstrip()
                    # Filter out page markers and section numbers
                    if not re.match(r'^\d+\.\d+\.', eleman) and not re.match(r'^Fase', eleman):
                        elemen_list.append(eleman)
            
            if "Fase D" in line and "Umumnya untuk Kelas" in line:
                fase_d_capture = True
            
            if fase_d_capture and "D. Capaian Pembelajaran" in line:
                # Found the CP section, the elements right before it are the key ones
                pass
            
            if capture and re.match(r'^[XVI]+\. ', line) and "CAPAIAN" in line and i > 0:
                break
            
            max_lines -= 1
            if max_lines <= 0:
                break
    
    return elemen_list

# Let's use a simpler approach: extract the "Elemen" table from each section
def extract_elemen_table(subject_keyword):
    """Extract elemen from the elements table in each subject section."""
    capture = False
    table_started = False
    elemen = []
    current_elemen = None
    
    for i, line in enumerate(bskap_lines):
        stripped = line.strip().rstrip('\n')
        
        if f"CAPAIAN PEMBELAJARAN {subject_keyword}" in stripped.upper():
            capture = True
            continue
        
        if not capture:
            continue
            
        # Look for the "Elemen Deskripsi" table header
        if stripped == "Elemen Deskripsi" or stripped.startswith("Elemen") and "Deskripsi" in stripped:
            table_started = True
            continue
            
        # After table started, capture element names (line before its description)
        if table_started:
            # Skip page markers
            if stripped.startswith("=== HALAMAN"):
                continue
            # Skip empty lines
            if not stripped:
                continue
            # Skip lines that are clearly descriptions (contain spaces indicating continuation)
            # Element names are typically short (one line) and come right before multi-line descriptions
            if not stripped.startswith(" ") and not stripped.startswith("-"):
                # Could be a section header like "D. Capaian Pembelajaran"
                if stripped.startswith("D. "):
                    break
                if stripped.startswith("C. "):
                    continue
                if len(stripped) > 5 and len(stripped) < 60 and not re.match(r'^\d+\.\d+', stripped):
                    if stripped not in ["Elemen", "Deskripsi"]:
                        current_elemen = stripped
                        elemen.append(current_elemen)
        
        # Stop at D. Capaian Pembelajaran (after table)
        if table_started and stripped.startswith("D. Capaian"):
            break
        if table_started and re.match(r'^[XVI]+\. ', stripped) and "CAPAIAN" in stripped:
            break
    
    # Deduplicate while preserving order
    seen = set()
    result = []
    for e in elemen:
        if e not in seen:
            seen.add(e)
            result.append(e)
    return result

print("=" * 80)
print("BSKAP FASE D ELEMENT COMPARISON: Intel JSON vs Official Document")
print("=" * 80)

for subject_name, (keyword, expected_elemen) in sorted(FASE_D_ELEMEN.items()):
    print(f"\n--- {subject_name} ---")
    
    # Get intel JSON elements for SMP 7
    intel_subj = intel['subjects']['SMP']['7'].get(subject_name)
    if intel_subj:
        intel_ganjil_elemen = intel_subj['ganjil']['elemen']
        intel_genap_elemen = intel_subj['genap']['elemen']
        intel_all = list(dict.fromkeys(intel_ganjil_elemen + intel_genap_elemen))
    else:
        intel_all = []
    
    # Get BSKAP elements
    bskap_elements = extract_elemen_table(keyword)
    
    print(f"  Intel JSON elemen (SMP 7): {intel_all}")
    print(f"  BSKAP extracted elemen:    {bskap_elements}")
    
    # Compare
    if set(intel_all) == set(bskap_elements):
        print("  STATUS: ✅ COCOK")
    elif set(intel_all).issuperset(set(bskap_elements)):
        extra = set(intel_all) - set(bskap_elements)
        print(f"  STATUS: ⚠️ INTEL KEBANYAKAN: {extra}")
    elif set(bskap_elements).issuperset(set(intel_all)):
        missing = set(bskap_elements) - set(intel_all)
        print(f"  STATUS: ⚠️ INTEL KURANG: {missing}")
    else:
        extra = set(intel_all) - set(bskap_elements)
        missing = set(bskap_elements) - set(intel_all)
        print(f"  STATUS: ❌ BEDA")
        if missing: print(f"    BSKAP punya, Intel tidak: {missing}")
        if extra: print(f"    Intel punya, BSKAP tidak: {extra}")
    
    if expected_elemen:
        print(f"  Expected (manual check):   {expected_elemen}")
        if set(intel_all) == set(expected_elemen):
            print(f"    ✅ Expected COCOK")
        else:
            extra_e = set(intel_all) - set(expected_elemen)
            missing_e = set(expected_elemen) - set(intel_all)
            if extra_e: print(f"    ⚠️ Extra vs expected: {extra_e}")
            if missing_e: print(f"    ⚠️ Missing vs expected: {missing_e}")

print("\n" + "=" * 80)
print("DONE")
