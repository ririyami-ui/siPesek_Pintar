"""audit_fase_d_v2.py – Smart audit: union ganjil+genap elements vs expected.

Reports:
  ✅ OK                              = union matches expected
  ❌ NAME MISMATCH / MISSING / EXTRA = real issues
"""
import json

INTEL = "resources/js/utils/bskap_2025_intel.json"

# ── Expected element SETS per subject (Fase D / SMP 7-9) ──
# Source: BSKAP No.046/H/KR/2025 + buku Kemendikbud
EXPECTED = {
    "Informatika": {  # Union of ganjil+genap = 8 book elements
        "Berpikir Komputasional",
        "Teknologi Informasi dan Komunikasi",
        "Sistem Komputer",
        "Jaringan Komputer dan Internet",
        "Analisis Data",
        "Algoritma dan Pemrograman",
        "Dampak Sosial Informatika",
        "Praktik Lintas Bidang",
    },
    "Matematika": {
        "Bilangan",
        "Aljabar",
        "Pengukuran",
        "Geometri",
        "Analisis Data dan Peluang",
    },
    "Bahasa Indonesia": {
        "Menyimak",
        "Membaca dan Memirsa",
        "Berbicara dan Mempresentasikan",
        "Menulis",
    },
    "Pendidikan Pancasila": {
        "Pancasila",
        "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
        "Bhinneka Tunggal Ika",
        "Negara Kesatuan Republik Indonesia",
    },
    "IPAS": {
        "Pemahaman IPAS",
        "Keterampilan Proses",
    },
    "Pendidikan Agama Islam": {
        "Al-Qur'an Hadis",
        "Akidah",
        "Akhlak",
        "Fikih",
        "Sejarah Peradaban Islam",
    },
    "Pendidikan Agama Kristen": {
        "Allah Tritunggal",
        "Kemanusiaan",
        "Gereja dan Masyarakat",
        "Alam dan Lingkungan Hidup",
    },
    "Pendidikan Agama Katolik": {
        "Pribadi Peserta Didik",
        "Yesus Kristus",
        "Gereja",
        "Kemasyarakatan",
    },
    "Pendidikan Agama Hindu": {
        "Sraddha dan Bhakti",
        "Susila",
        "Sejarah dan Tradisi",
        "Yadnya",
    },
    "Pendidikan Agama Buddha": {
        "Percaya (Saddha)",
        "Etik (Sila)",
        "Kitab Suci Agama Buddha",
        "Perayaan Hari Raya Agama Buddha",
        "Kepemimpinan",
        "Dialog dan Kerja sama Antarumat Beragama",
    },
    "Pendidikan Agama Khonghucu": {
        "Sejarah dan Tokoh Agama Khonghucu",
        "Kitab Suci",
        "Etika dan Kebajikan (De)",
        "Perilaku Junzi (君子)",
        "Liturgi dan Doa",
        "Dialog dan Kerja Sama Antarumat Beragama",
    },
    "PJOK": {
        "Keterampilan Gerak",
        "Pengetahuan Gerak",
        "Pemanfaatan Gerak",
        "Gaya Hidup Sehat",
        "Kebugaran Jasmani",
    },
    "IPS": {
        "Pemahaman IPS",
        "Keterampilan Proses",
    },
    "Seni Rupa": {
        "Mengalami",
        "Menciptakan",
        "Merefleksikan",
        "Berpikir dan Bekerja Artistik",
        "Berdampak",
    },
    "Prakarya": {
        "Observasi dan Eksplorasi",
        "Produksi",
        "Refleksi dan Evaluasi",
        "Desain/Perencanaan",
    },
    "Bahasa Inggris": {
        "Menyimak - Berbicara",
        "Membaca - Memirsa",
        "Membaca - Menulis",
    },
    "Bahasa Daerah": {
        "Menyimak",
        "Membaca dan Memirsa",
        "Berbicara dan Mempresentasikan",
        "Menulis",
    },
}


def audit():
    with open(INTEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_issues = 0

    for grade in ["7", "8", "9"]:
        smp = data["subjects"]["SMP"][grade]
        print(f"\n{'='*60}")
        print(f"  SMP {grade}")
        print(f"{'='*60}")

        for subj_name in sorted(smp.keys()):
            subj_data = smp[subj_name]
            if not isinstance(subj_data, dict):
                continue

            # Gather union of elements across ganjil+genap
            all_elemen = set()
            sem_elemen = {}
            for sem in ["ganjil", "genap"]:
                sem_data = subj_data.get(sem, {})
                elist = sem_data.get("elemen", [])
                sem_elemen[sem] = set(elist)
                all_elemen.update(elist)

            expected = EXPECTED.get(subj_name)
            if expected is None:
                print(f"  ⚠️  {subj_name}: NO EXPECTED DATA (skip)")
                continue

            # Compare
            missing = expected - all_elemen
            extra = all_elemen - expected

            # Check name mismatches (fuzzy: similar but not exact)
            name_issues = []
            for ee in all_elemen:
                if ee in expected:
                    continue
                # Check if it's a close match to any expected
                for ex in expected:
                    # Remove common diffs
                    ee_clean = ee.lower().replace(" dan ", " dan ").replace(" and ", " dan ").strip()
                    ex_clean = ex.lower().replace(" dan ", " dan ").replace(" and ", " dan ").strip()
                    if ee_clean == ex_clean and ee != ex:
                        name_issues.append((subj_name, ee, ex))
                        break

            if missing or extra:
                total_issues += 1
                print(f"  ❌ {subj_name}: ISSUES")
                if missing:
                    print(f"       MISSING from expected: {sorted(missing)}")
                if extra:
                    print(f"       EXTRA (not in expected): {sorted(extra)}")
                # Show which elements are in which semester
                print(f"       ganjil: {sorted(sem_elemen['ganjil'])}")
                print(f"       genap:  {sorted(sem_elemen['genap'])}")
            elif name_issues:
                total_issues += 1
                print(f"  ❌ {subj_name}: NAME MISMATCHES → need rename")
                for _, old, new in name_issues:
                    print(f"       '{old}' → '{new}'")
                print(f"       ganjil: {sorted(sem_elemen['ganjil'])}")
                print(f"       genap:  {sorted(sem_elemen['genap'])}")
            else:
                print(f"  ✅ {subj_name}: OK — {sorted(expected)}")
                print(f"       ganjil: {sorted(sem_elemen['ganjil'])}")
                print(f"       genap:  {sorted(sem_elemen['genap'])}")

    print(f"\n{'='*60}")
    if total_issues:
        print(f"\n❌ {total_issues} subjects with issues (across all grades)")
    else:
        print("\n✅ ALL SUBJECTS MATCH EXPECTED ELEMENTS!")


if __name__ == "__main__":
    audit()
