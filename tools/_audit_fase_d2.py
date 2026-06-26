"""Manually compare Intel JSON elements vs BSKAP Fase D elements"""
import json

INTEL_FILE = 'resources/js/utils/bskap_2025_intel.json'

with open(INTEL_FILE, 'r', encoding='utf-8') as f:
    intel = json.load(f)

# From official BSKAP No 046/2025 Lampiran II - Fase D Elements
# Manually verified from the extracted text
FASE_D_OFFICIAL = {
    "Pendidikan Agama Islam": ["Al-Qur'an Hadis", "Akidah", "Akhlak", "Fikih", "Sejarah Peradaban Islam"],
    "Pendidikan Agama Kristen": ["Allah Tritunggal", "Karya Keselamatan Allah dalam Yesus Kristus", "Hidup dalam Roh Kudus", "Gereja sebagai Persekutuan Orang Percaya", "Keluarga sebagai Komunitas Dasar", "Masyarakat yang Majemuk"],
    "Pendidikan Agama Katolik": ["Pribadi Peserta Didik", "Yesus Kristus", "Gereja", "Masyarakat"],
    "Pendidikan Agama Hindu": ["Tattwa", "Susila", "Acara"],
    "Pendidikan Agama Buddha": ["Sejarah Keagamaan", "Kitab Suci", "Keyakinan", "Etika", "Perayaan Keagamaan"],
    "Pendidikan Agama Khonghucu": ["Sejarah Keagamaan", "Kitab Suci", "Keyakinan", "Etika", "Perayaan Keagamaan"],
    "Pendidikan Pancasila": ["Pancasila", "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945", "Negara Kesatuan Republik Indonesia", "Bhinneka Tunggal Ika"],
    "Bahasa Indonesia": ["Menyimak", "Membaca dan Memirsa", "Berbicara dan Mempresentasikan", "Menulis"],
    "Matematika": ["Bilangan", "Aljabar", "Geometri", "Analisis Data dan Peluang"],
    "Bahasa Inggris": ["Menyimak - Berbicara", "Membaca - Memirsa", "Menulis - Mempresentasikan"],
    "IPA": ["Pemahaman IPA", "Keterampilan Proses"],
    "IPS": ["Pemahaman IPS", "Keterampilan Proses"],
    "Informatika": ["Berpikir Komputasional", "Literasi Digital"],
    "PJOK": ["Keterampilan Gerak", "Pengetahuan Gerak", "Pemanfaatan Gerak", "Kebugaran Jasmani", "Gaya Hidup Sehat"],
    "Prakarya": ["Observasi dan Eksplorasi", "Perencanaan", "Produksi", "Refleksi dan Evaluasi"],
}

print("=" * 100)
print("BSKAP FASE D ELEMENT COMPARISON")
print("=" * 100)

issues = []

for subject, official_elemen in sorted(FASE_D_OFFICIAL.items()):
    intel_subj = intel['subjects']['SMP']['7'].get(subject)
    if not intel_subj:
        print(f"\n  {subject}: NOT FOUND IN INTEL JSON")
        continue
    
    intel_ganjil = intel_subj['ganjil']['elemen']
    intel_genap = intel_subj['genap']['elemen']
    intel_all = []
    for e in intel_ganjil + intel_genap:
        if e not in intel_all:
            intel_all.append(e)
    
    off_set = set(official_elemen)
    intel_set = set(intel_all)
    
    print(f"\n  {subject}:")
    print(f"    Official: {official_elemen}")
    print(f"    Intel:    {intel_all}")
    
    if intel_set == off_set:
        print(f"    >> OK")
    elif intel_set.issuperset(off_set):
        extra = intel_set - off_set
        print(f"    >> EXTRA elements: {extra}")
        issues.append((subject, "EXTRA", extra))
    elif off_set.issuperset(intel_set):
        missing = off_set - intel_set
        print(f"    >> MISSING elements: {missing}")
        issues.append((subject, "MISSING", missing))
    else:
        extra = intel_set - off_set
        missing = off_set - intel_set
        print(f"    >> MISMATCH")
        if missing: print(f"       Missing: {missing}")
        if extra: print(f"       Extra:   {extra}")
        issues.append((subject, "MISMATCH", {"missing": missing, "extra": extra}))

print("\n" + "=" * 100)
if issues:
    print(f"\nISSUES FOUND: {len(issues)}")
    for subject, kind, detail in issues:
        print(f"  - {subject}: {kind} - {detail}")
else:
    print("\nALL SUBJECTS MATCH OK!")
