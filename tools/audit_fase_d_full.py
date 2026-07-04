"""audit_fase_d_full.py – Full audit of SMP 7-9 subjects.

Compare Intel JSON element lists against expected elements from buku/BSKAP.
Print mismatches for manual review only — no auto-fix.
"""
import json, sys

INTEL = "resources/js/utils/bskap_2025_intel.json"

# ── Expected elements per subject (Fase D / SMP 7-9) ──
# Source: BSKAP No.046/H/KR/2025 + buku Kemendikbud
# Subjects not listed = skip (e.g. Muatan Lokal, Agama yg udah diverifikasi)
EXPECTED = {
    "Informatika_ganjil": [
        "Berpikir Komputasional",
        "Teknologi Informasi dan Komunikasi",
        "Sistem Komputer",
        "Jaringan Komputer dan Internet",
    ],
    "Informatika_genap": [
        "Analisis Data",
        "Algoritma dan Pemrograman",
        "Dampak Sosial Informatika",
        "Praktik Lintas Bidang",
    ],
    "Matematika": [
        "Bilangan",
        "Aljabar",
        "Pengukuran",
        "Geometri",
        "Analisis Data dan Peluang",
    ],
    "Bahasa Indonesia": [
        "Menyimak",
        "Membaca dan Memirsa",
        "Berbicara dan Mempresentasikan",
        "Menulis",
    ],
    "Pendidikan Pancasila": [
        "Pancasila",
        "Undang-Undang Dasar Negara Republik Indonesia Tahun 1945",
        "Bhinneka Tunggal Ika",
        "Negara Kesatuan Republik Indonesia",
    ],
    "IPAS": [
        "Pemahaman IPAS",
        "Keterampilan Proses",
    ],
    "Pendidikan Agama Islam": [
        "Al-Qur'an Hadis",
        "Akidah",
        "Akhlak",
        "Fikih",
        "Sejarah Peradaban Islam",
    ],
    "Pendidikan Agama Kristen": [
        "Allah Tritunggal",
        "Kemanusiaan",
        "Gereja dan Masyarakat",
        "Alam dan Lingkungan Hidup",
    ],
    "Pendidikan Agama Katolik": [
        "Pribadi Peserta Didik",
        "Yesus Kristus",
        "Gereja",
        "Kemasyarakatan",
    ],
    "Pendidikan Agama Hindu": [
        "Sraddha dan Bhakti",
        "Susila",
        "Sejarah dan Tradisi",
        "Yadnya",
    ],
    "Pendidikan Agama Buddha": [
        "Percaya (Saddha)",
        "Etik (Sila)",
        "Kitab Suci Agama Buddha",
        "Perayaan Hari Raya Agama Buddha",
        "Kepemimpinan",
        "Dialog dan Kerja sama Antarumat Beragama",
    ],
    "Pendidikan Agama Khonghucu": [
        "Sejarah dan Tokoh Agama Khonghucu",
        "Kitab Suci",
        "Etika dan Kebajikan (De)",
        "Perilaku Junzi (君子)",
        "Liturgi dan Doa",
        "Dialog dan Kerja Sama Antarumat Beragama",
    ],
    "PJOK": [
        "Keterampilan Gerak",
        "Pengetahuan Gerak",
        "Pemanfaatan Gerak",
        "Gaya Hidup Sehat",
        "Kebugaran Jasmani",
    ],
    "IPS": [
        "Pemahaman IPS",
        "Keterampilan Proses",
    ],
    "Seni Rupa": [
        "Mengalami",
        "Menciptakan",
        "Merefleksikan",
        "Berpikir dan Bekerja Artistik",
        "Berdampak",
    ],
    "Prakarya": [
        "Observasi dan Eksplorasi",
        "Produksi",
        "Refleksi dan Evaluasi",
        "Desain/Perencanaan",
    ],
    "Bahasa Inggris": [
        "Menyimak - Berbicara",
        "Membaca - Memirsa",
        "Membaca - Menulis",  # some grades may differ
    ],
    "Bahasa Daerah": [
        "Menyimak",
        "Membaca dan Memirsa",
        "Berbicara dan Mempresentasikan",
        "Menulis",
    ],
}


def audit():
    with open(INTEL, "r", encoding="utf-8") as f:
        data = json.load(f)

    errors = []
    for grade in ["7", "8", "9"]:
        smp = data["subjects"]["SMP"][grade]
        print(f"\n{'='*60}")
        print(f"  SMP {grade}")
        print(f"{'='*60}")

        for subj_name, subj_data in sorted(smp.items()):
            # Skip non-dict items
            if not isinstance(subj_data, dict):
                continue

            # Handle Informatika specially (split semester)
            if subj_name == "Informatika":
                for sem in ["ganjil", "genap"]:
                    sem_data = subj_data.get(sem, {})
                    elemen_list = sem_data.get("elemen", [])
                    expected_key = f"Informatika_{sem}"
                    expected_list = EXPECTED.get(expected_key, [])

                    if set(elemen_list) != set(expected_list):
                        print(f"  ❌ {subj_name} {sem}: MISMATCH")
                        print(f"     Intel: {elemen_list}")
                        print(f"     Expected: {expected_list}")
                        errors.append(f"SMP {grade} {subj_name} {sem}")
                    else:
                        print(f"  ✅ {subj_name} {sem}: OK ({len(elemen_list)} elemen)")
                continue

            # Normal subjects: check all semesters
            for sem in ["ganjil", "genap"]:
                sem_data = subj_data.get(sem, {})
                if not sem_data:
                    continue
                elemen_list = sem_data.get("elemen", [])

                expected_list = EXPECTED.get(subj_name, [])
                if not expected_list:
                    print(f"  ⚠️  {subj_name} {sem}: NO EXPECTED DATA (skip)")
                    continue

                if set(elemen_list) != set(expected_list):
                    print(f"  ❌ {subj_name} {sem}: MISMATCH")
                    print(f"     Intel: {elemen_list}")
                    print(f"     Expected: {expected_list}")
                    errors.append(f"SMP {grade} {subj_name} {sem}")
                else:
                    print(f"  ✅ {subj_name} {sem}: OK ({len(elemen_list)} elemen)")

    print(f"\n{'='*60}")
    if errors:
        print(f"\n❌ {len(errors)} MISMATCHES:")
        for e in errors:
            print(f"   - {e}")
    else:
        print("\n✅ ALL SUBJECTS MATCH EXPECTED ELEMENTS!")


if __name__ == "__main__":
    audit()
