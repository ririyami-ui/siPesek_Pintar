<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class AiGeneratorService extends GeminiService
{
    protected $bskapIntel;
    protected $bskapVerbatim;

    public function __construct()
    {
        parent::__construct();
        $this->loadBskapData();
    }

    protected function loadBskapData()
    {
        try {
            $intelPath = resource_path('js/utils/bskap_2025_intel.json');
            if (file_exists($intelPath)) {
                $this->bskapIntel = json_decode(file_get_contents($intelPath), true);
            }

            // Also check storage as fallback or for verbatim
            if (Storage::exists('json/bskap_2025_intel.json') && !$this->bskapIntel) {
                $this->bskapIntel = json_decode(Storage::get('json/bskap_2025_intel.json'), true);
            }
            
            if (Storage::exists('json/bskap_2025_verbatim.json')) {
                $this->bskapVerbatim = json_decode(Storage::get('json/bskap_2025_verbatim.json'), true);
            }
        } catch (\Exception $e) {
            Log::error("Failed to load BSKAP data: " . $e->getMessage());
        }
    }

    public function generateLessonPlan(array $data)
    {
        // Use model from data if provided, otherwise fallback to class property (profile)
        $modelName = $data['modelName'] ?? $this->model;
        $level = $this->getLevel($data['gradeLevel']);
        $subjectKey = $this->getSubjectKey($data['subject']);
        
        // Ensure BSKAP data is loaded
        if (!$this->bskapVerbatim) {
            $this->loadBskapData();
        }

        if (!$this->bskapVerbatim) {
            Log::warning("BSKAP Verbatim data not loaded. Using fallback CP text.");
            $cpFullVerbatim = "Data Capaian Pembelajaran resmi tidak tersedia di server. Silakan susun berdasarkan elemen: " . ($data['elemen'] ?? 'N/A');
        } else {
            // Try to find the exact CP from national standard JSON
            $verbatimEntry = $this->bskapVerbatim['subjects'][$level][$data['gradeLevel']][$subjectKey] ?? [];
            $cpFullVerbatim = $verbatimEntry['cp_full'] ?? null;

            if (!$cpFullVerbatim) {
                Log::warning("CP not found in BSKAP for: $level - {$data['gradeLevel']} - $subjectKey. Using fallback.");
                $cpFullVerbatim = "Data Capaian Pembelajaran untuk Elemen \"{$data['elemen']}\" tidak ditemukan di database nasional. Silakan buat TP berdasarkan alur materi umum.";
            }
        }

        $prompt = $this->buildLessonPlanPrompt($data, $cpFullVerbatim, $level, $subjectKey);

        return $this->callGeminiApi($prompt, $modelName, 8192);
    }

    public function generateQuiz(array $data)
    {
        $modelName = $data['modelName'] ?? $this->model;
        $prompt = $this->buildQuizPrompt($data);
        $response = $this->callGeminiApi($prompt, $modelName, 8192);
        
        return $this->extractJson($response);
    }

    public function generateHandout(array $data)
    {
        $modelName = $data['modelName'] ?? $this->model;
        $prompt = $this->buildHandoutPrompt($data);
        return $this->callGeminiApi($prompt, $modelName, 8192);
    }

    public function generateWorksheet(array $data)
    {
        $modelName = $data['modelName'] ?? $this->model;
        $prompt = $this->buildWorksheetPrompt($data);
        return $this->callGeminiApi($prompt, $modelName, 8192);
    }

    /**
     * Chat with AI Teaching Assistant (Smartty)
     * Incorporates BSKAP data and user context
     */
    public function chat($message, $history = [], $context = [])
    {
        $modelName = $context['modelName'] ?? $this->model;
        $imageData = $context['imageData'] ?? null;
        
        $bskapData = $this->bskapIntel;
        $regulation = $bskapData['standards']['regulation'] ?? 'BSKAP No. 46 Tahun 2025';
        $philosophy = $bskapData['standards']['philosophy']['name'] ?? 'Deep Learning';

        $systemInstruction = "
        Anda adalah **Smartty**, asisten AI profesional tapi **super santai & akrab** buat aplikasi **Smart School Manager**.
        Pencipta Anda: **Bapak Ririyami, S.Kom** (Guru SMPN 7 Bondowoso & Ahli AI).

        **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
        - Regulasi Dasar: **{$regulation}**
        - Filosofi Operasional: **{$philosophy}**

        **Gaya Bicara (TONE & STYLE):**
        - **Santai & Akrab**: Panggil user dengan \"Bapak/Ibu\" atau \"Pak/Bu\". Gunakan kata-kata seperti \"Siap!\", \"Beres!\", \"Mantap!\", \"Gini loh...\".
        - **To The Point**: Langsung ke inti masalah.
        - **Emoji**: Pakai emoji secukupnya (😊, 👍, ✅, 🚀).

        **Keahlian Khusus:**
        - Membantu menyusun RPP, Kuis, Bahan Ajar, dan LKPD sesuai standar nasional.
        - Menganalisis data siswa (nilai, absensi, pelanggaran).
        - Memberikan saran pedagogis berdasarkan prinsip Deep Learning (Mindful, Meaningful, Joyful).

        **Konteks Live saat ini:**
        " . json_encode($context['liveContext'] ?? [], JSON_UNESCAPED_UNICODE) . "
        ";

        // Convert history to Gemini format if needed
        $contents = [];
        foreach ($history as $msg) {
            $role = ($msg['role'] === 'user') ? 'user' : 'model';
            $parts = [];
            
            if (isset($msg['parts'][0]['text'])) {
                $parts[] = ['text' => $msg['parts'][0]['text']];
            } elseif (isset($msg['content'])) {
                $parts[] = ['text' => $msg['content']];
            }

            if (isset($msg['image'])) {
                $cleanBase64 = preg_replace('/^data:image\/(png|jpeg|jpg|webp);base64,/', "", $msg['image']);
                $parts[] = [
                    'inlineData' => [
                        'mimeType' => 'image/jpeg',
                        'data' => $cleanBase64
                    ]
                ];
            }

            $contents[] = [
                'role' => $role,
                'parts' => $parts
            ];
        }

        // Add current message and optional image
        $currentParts = [['text' => $message]];
        if ($imageData) {
            $cleanBase64 = preg_replace('/^data:image\/(png|jpeg|jpg|webp);base64,/', "", $imageData);
            $currentParts[] = [
                'inlineData' => [
                    'mimeType' => 'image/jpeg',
                    'data' => $cleanBase64
                ]
            ];
        }

        $contents[] = [
            'role' => 'user',
            'parts' => $currentParts
        ];

        return $this->callGeminiApi($contents, $modelName, 4096, 0.7, $systemInstruction);
    }

    /**
     * Analyze class/rombel data
     */
    public function analyzeClass($data)
    {
        $modelName = $data['modelName'] ?? $this->model;
        $className = $data['className'] ?? 'Kelas';
        $isConcise = $data['isConcise'] ?? false;
        
        $bskapData = $this->bskapIntel;
        $regulation = $bskapData['standards']['regulation'] ?? 'BSKAP No. 46 Tahun 2025';

        // Summarize data to keep prompt size manageable
        $studentsCount = count($data['students'] ?? []);
        
        // Summarize attendance (Robust counting)
        $attendanceData = $data['attendanceSummary'] ?? [];
        $attSummaryStr = "Data tidak tersedia";
        if (is_array($attendanceData)) {
            $hCount = count(array_filter($attendanceData, fn($a) => strcasecmp($a['status'] ?? '', 'Hadir') === 0));
            $sCount = count(array_filter($attendanceData, fn($a) => strcasecmp($a['status'] ?? '', 'Sakit') === 0));
            $iCount = count(array_filter($attendanceData, fn($a) => strcasecmp($a['status'] ?? '', 'Ijin') === 0));
            $aCount = count(array_filter($attendanceData, fn($a) => strcasecmp($a['status'] ?? '', 'Alpha') === 0));
            $attSummaryStr = "Hadir: {$hCount}, Sakit: {$sCount}, Ijin: {$iCount}, Alpha: {$aCount}";
        }

        // Summarize grades
        $gradesData = $data['gradesSummary'] ?? [];
        $gradesSummaryStr = "Belum ada data nilai.";
        if (is_array($gradesData) && count($gradesData) > 0) {
            $scores = array_map(fn($g) => (float)($g['score'] ?? 0), $gradesData);
            $avg = count($scores) > 0 ? array_sum($scores) / count($scores) : 0;
            $max = count($scores) > 0 ? max($scores) : 0;
            $min = count($scores) > 0 ? min($scores) : 0;
            $gradesSummaryStr = "Rata-rata: " . round($avg, 1) . ", Tertinggi: $max, Terendah: $min (dari " . count($gradesData) . " entri nilai)";
        }

        // Summarize infractions
        $infractionsData = $data['infractionsSummary'] ?? [];
        $infSummaryStr = "Tidak ada catatan pelanggaran.";
        if (is_array($infractionsData) && count($infractionsData) > 0) {
            $totalPoints = array_reduce($infractionsData, fn($acc, $i) => $acc + (int)($i['points'] ?? 0), 0);
            $infSummaryStr = "Total Pelanggaran: " . count($infractionsData) . ", Total Poin Terpotong: " . $totalPoints;
        }

        // Summarize journals
        $journalsData = $data['journalsSummary'] ?? [];
        $journalsSummaryStr = is_array($journalsData) ? "Total Jurnal Mengajar: " . count($journalsData) : "Belum ada jurnal mengajar.";

        $prompt = "
        Anda adalah asisten AI untuk guru yang ahli dalam analisis data pendidikan berbasis standar nasional **{$regulation}**.
        Tugas Anda adalah menganalisis data kelas \"{$className}\" dan memberikan laporan infografis yang mendalam namun praktis.

        ### DATA KELAS:
        - **Jumlah Siswa**: {$studentsCount}
        - **Rekap Kehadiran**: {$attSummaryStr}
        - **Rekap Nilai**: {$gradesSummaryStr}
        - **Rekap Pelanggaran**: {$infSummaryStr}
        - **Jurnal Guru**: {$journalsSummaryStr}

        ### INSTRUKSI OUTPUT:
        Gunakan format Markdown yang sangat rapi untuk laporan ini. Berikan jawaban dalam struktur berikut:

        # 📊 INFOGRAFIS CAPAIAN KELAS
        [Berikan ringkasan eksekutif 2-3 kalimat]

        ## 🏆 KEKUATAN UTAMA (Strengths)
        - [Poin kekuatan 1]
        - [Poin kekuatan 2]
        - [Poin kekuatan 3]

        ## ⚠️ KELEMAHAN & TANTANGAN (Weaknesses)
        - [Poin kelemahan 1]
        - [Poin kelemahan 2]
        - [Poin kelemahan 3]

        ## 💡 SARAN PERBAIKAN (Action Plan)
        - [Saran 1]
        - [Saran 2]
        - [Saran 3]

        Gunakan bahasa yang profesional, suportif, dan berbasis data. Fokuslah pada aspek pedagogis dan perkembangan karakter siswa.

        ATURAN ANALISIS:
        1. **Privasi**: Gunakan nama siswa secara profesional, jangan gunakan ID teknis.
        2. **Objektivitas**: Berikan analisis berdasarkan data yang ada, jangan berasumsi berlebihan.
        3. **Solutif**: Setiap masalah yang ditemukan HARUS disertai saran perbaikan pedagogis yang konkret (PBL, Differentiation, Deep Learning).
        ";

        if ($isConcise) {
            $prompt .= "
            FORMAT LAPORAN (RINGKAS):
            ### Analisis Ringkas Kelas: {$className}
            **1. Poin Utama Akademik**
            - (1-2 poin signifikan)
            **2. Poin Utama Perilaku & Kehadiran**
            - (1-2 poin menonjol)
            **3. Tiga Rekomendasi Teratas**
            - (3 saran praktis)
            ";
        } else {
            $prompt .= "
            FORMAT LAPORAN (LENGKAP):
            ### Laporan Analisis Mendalam Kelas: {$className}
            
            **I. GAMBARAN UMUM AKADEMIK**
            (Analisis tren nilai, penguasaan materi, dan identifikasi siswa yang butuh perhatian/remedial).
            
            **II. POLA KEHADIRAN & KEDISIPLINAN**
            (Analisis tingkat kehadiran dan pola pelanggaran jika ada).
            
            **III. ANALISIS PEDAGOGIS (BERDASARKAN JURNAL)**
            (Bagaimana proses belajar mengajar berlangsung dan hambatan yang sering muncul).
            
            **IV. REKOMENDASI STRATEGIS (DEEP LEARNING)**
            (Saran spesifik untuk meningkatkan kualitas pembelajaran di kelas ini).
            ";
        }

        return $this->callGeminiApi($prompt, $modelName, 4096);
    }

    protected function buildLessonPlanPrompt($data, $cpFullVerbatim, $level, $subjectKey)
    {
        $schoolName = $data['schoolName'] ?? '[Nama Sekolah]';
        $teacherName = $data['teacherName'] ?? '[Nama Guru]';
        $teacherNip = $data['teacherNip'] ?? '-';
        $subject = $data['subject'];
        $kd = $data['kd'];
        $materi = $data['materi'];
        $elemen = $data['elemen'] ?? 'N/A';
        $gradeLevel = (string) ($data['gradeLevel'] ?? '');
        $semesterLabel = $this->getSemesterLabel($data['semester'] ?? '');
        $semesterKey = $this->getSemesterKey($data['semester'] ?? '');
        $jp = $data['jp'] ?? '-';
        $distribution = $data['distribution'] ?? [];
        $distributionCount = is_array($distribution) ? count($distribution) : 1;
        $distributionText = is_array($distribution) ? implode(', ', $distribution) : (string)$distribution;
        $assessmentModel = $data['assessmentModel'] ?? 'Rubrik';
        
        $bskapData = $this->bskapIntel ?? ['standards' => [], 'pedagogis' => [], 'subjects' => [], 'textbooks' => []];
        $regulation = $bskapData['standards']['regulation'] ?? 'Keputusan Kepala BSKAP No. 046/H/KR/2025';
        $philosophy = $bskapData['standards']['philosophy']['name'] ?? 'Deep Learning';
        $semesterFocus = $bskapData['standards']['semester_logic'][$semesterKey]['focus'] ?? 'Fondasi Dasar';

        // Regional Language detection
        $regionalLanguage = null;
        if (str_contains(strtolower($subject), 'bahasa daerah') || str_contains(strtolower($subject), 'basa jawa')) {
            if (str_contains(strtolower($subject), 'jawa')) $regionalLanguage = 'Jawa';
            elseif (str_contains(strtolower($subject), 'madura')) $regionalLanguage = 'Madura';
            elseif (str_contains(strtolower($subject), 'sunda')) $regionalLanguage = 'Sunda';
            elseif (str_contains(strtolower($subject), 'bali')) $regionalLanguage = 'Bali';
            else $regionalLanguage = 'Daerah';
        }

        // Industry Competencies string
        $industryCompetenciesText = "";
        foreach ($bskapData['standards']['industry_competencies_2025_2026'] ?? [] as $c) {
            $industryCompetenciesText .= "- " . ($c['name'] ?? 'N/A') . ": " . ($c['description'] ?? '') . "\n      ";
        }

        // Differentiation Strategies string
        $differentiationStrategiesText = "";
        foreach ($bskapData['pedagogis']['differentiation_strategies'] ?? [] as $s) {
            $differentiationStrategiesText .= "- **" . ($s['aspect'] ?? 'N/A') . "**: " . ($s['method'] ?? '') . "\n";
        }

        // Phases string
        $phasesText = implode(', ', array_map(function($p) {
            return "Fase " . ($p['phase'] ?? '?') . " (Kelas " . implode('-', $p['grades'] ?? []) . " " . ($p['level'] ?? '') . ")";
        }, $bskapData['standards']['phases'] ?? []));

        // Duration string
        $durationText = "";
        foreach ($bskapData['standards']['duration_per_jp'] ?? [] as $lvl => $min) {
            $durationText .= "- $lvl: 1 JP = $min Menit\n";
        }

        // Profile Lulusan string
        $profileLulusanText = "";
        foreach ($bskapData['standards']['profile_lulusan_2025'] ?? [] as $p) {
            if ($p['id'] !== 1) {
                $dimensi = $p['dimensi'] ?? 'N/A';
                $deskripsi = $p['deskripsi'] ?? ''; // Safely handle missing description
                $profileLulusanText .= "          *   **{$dimensi}**" . ($deskripsi ? ": {$deskripsi}" : "") . "\n";
            }
        }

        // Textbook info
        $textbookInfo = $bskapData['textbooks'][$level][$gradeLevel][$subjectKey] ?? null;
        $textbookTitle = $textbookInfo['title'] ?? "Buku Siswa {$subject} Kelas {$gradeLevel} Kurikulum Merdeka";
        $textbookPublisher = $textbookInfo['publisher'] ?? 'Kemendikbudristek';
        $textbookChapters = json_encode($textbookInfo['chapters'] ?? [], JSON_UNESCAPED_UNICODE);

        // Subject Data
        $subjectData = (($bskapData['subjects'][$level][$gradeLevel][$subjectKey] ?? $bskapData['subjects'][$level][$subjectKey] ?? [])[$semesterKey] ?? []);

        // Build the prompt using the structure from prompt rpp.txt
        $prompt = "
      Anda adalah \"Mesin Intelijen Kurikulum Nasional\" yang bekerja berdasarkan repositori data resmi **BSKAP_DATA**. DILARANG memberikan informasi yang bertentangan atau di luar cakupan data JSON tersebut.
      
      **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
      - Regulasi Dasar: **{$regulation}**
      - Filosofi Operasional: **{$philosophy}**
      - Standar Kompetensi: Terlampir dalam elemen per-mata pelajaran di database.
      
      Tugas Anda: Susun RPP/Modul Ajar lengkap yang **OTORITATIF** dan **PRESIISI** dengan parameter ini:
      - Sekolah: {$schoolName}
      - Guru: {$teacherName}
      - Mapel: {$subject}
      - KD/CP: {$kd}
      - Materi Pokok: {$materi}
      " . ($data['studentCharacteristics'] ? "- Karakteristik Peserta Didik (Manual): {$data['studentCharacteristics']}" : "") . "
      
      **SMART CP EXTRACTION (MANDATORY - BSKAP 46/2025 COMPLIANCE):**
      Berikut adalah CP LENGKAP untuk referensi: 
      {$cpFullVerbatim}
      
      TUGAS ANDA: Dari CP lengkap di atas, ekstrak HANYA bagian/elemen yang RELEVAN dengan Elemen \"{$elemen}\" dan Materi \"{$materi}\".
      - **WAJIB gunakan EXACT TEXT** dari CP (verbatim, NO paraphrase, NO summary)
      - Fokus pada kalimat yang benar-benar menggambarkan kompetensi untuk materi ini.
      - Jika tidak yakin elemen mana yang relevan, gunakan elemen yang setara dengan konten \"{$materi}\".
      
      **FORMAT CP DI RPP (MANDATORY):**
      - HAPUS nomor elemen (mis. \"2.1.\", \"2.2.\", \"3.1.\") dari teks CP
      - MULAI dengan konteks Fase: \"Pada akhir Fase [X], peserta didik mampu...\"
      - Gunakan exact text CP tanpa nomor elemen
      - Jika multiple elemen, gabungkan menjadi paragraf natural dengan konektor yang sesuai
      
      Contoh Format yang BENAR:
      \"Pada akhir Fase B, peserta didik mampu mengidentifikasi makna sila-sila Pancasila dan penerapannya dalam kehidupan sehari-hari.\"
      
      Contoh Format yang SALAH:
      \"2.1. Pancasila Mengidentifikasi makna sila-sila Pancasila...\"
      " . (!empty($data['profilLulusan']) ? "
      - **PROFIL LULUSAN (MANDATORY)**: Dimensi yang HARUS digunakan: **{$data['profilLulusan']}**. DILARANG KERAS berimprovisasi, menambah, atau mengurangi dimensi ini. Gunakan PERSIS seperti tertulis." : "") . "
      " . (($data['sourceType'] ?? '') === 'atp' ? "- **SUMBER UTAMA (ATP)**: RPP ini HARUS diturunkan secara spesifik dari butir Tujuan Pembelajaran (TP) yang tercantum di Alur Tujuan Pembelajaran (ATP). Gunakan Elemen {$elemen} sebagai jangkar kompetensi." : "") . "
      
      " . ($regionalLanguage ? "
      **INSTRUKSI BAHASA DAERAH ({$regionalLanguage})**:
      - Karena mata pelajaran ini adalah Bahasa Daerah, Anda **WAJIB** menggunakan **Bahasa {$regionalLanguage}** untuk seluruh isi konten pembelajaran (Tujuan Pembelajaran, Langkah Kegiatan, Materi Ajar, dsb).
      - Gunakan tingkatan bahasa yang sesuai (misal: Ngoko/Kromo untuk Jawa sesuai konteks materi).
      " . (str_contains(strtolower($regionalLanguage), 'jawa') || str_contains(strtolower($regionalLanguage), 'madura') ? "- Sertakan penggunaan **Aksara Hanacaraka (Aksara Jawa/Madura)** pada bagian yang relevan (terutama di bagian Materi Ajar Mendetail dan Latihan LKPD)." : "") . "
      - Tetap gunakan Bahasa Indonesia HANYA untuk instruksi struktural dan label header dokumen.
      " : "") . "
      
      **INTELIGENSI SEMESTER (WAJIB):**
      - Semester Aktif: **{$semesterLabel}**
      - Fokus: **{$semesterFocus}**

      **KOMPETENSI MASA DEPAN (STRATEGIS 2026):**
      Integrasikan butir-butir kompetensi industri berikut ke dalam Langkah Pembelajaran atau Asesmen jika relevan:
      {$industryCompetenciesText}

      **PRINSIP PENYUSUNAN:**
      1. **KESELARASAN KOGNITIF:** Pastikan level KKO (Kata Kerja Operasional) konsisten dari TP hingga KKTP.
      2. **FOKUS MATERI:** Pembahasan harus terpusat pada \"{$materi}\" tanpa melebar.
      3. **KESESUAIAN JENJANG:** Sesuaikan bahasa, contoh, dan kegiatan dengan tingkat perkembangan Kelas {$gradeLevel}.
      4. **INDIKATOR OPERASIONAL:** Turunkan TP menjadi beberapa IKTP yang spesifik dan terukur.

      **PENTING - OPERASIONALISASI TUJUAN (IKTP):**
      Anda **WAJIB** menurunkan Tujuan Pembelajaran (TP) yang luas menjadi beberapa **Indikator Tujuan Pembelajaran (IKTP)** yang spesifik, operasional, and terukur untuk kegiatan ini.
      - Cantumkan label **\"Indikator Tujuan Pembelajaran\"** secara eksplisit di bawah bagian Tujuan Pembelajaran.
      - IKTP harus menunjukkan langkah-langkah pencapaian kompetensi secara bertahap (misal: dari mengidentifikasi -> mengklasifikasi -> mensimulasikan).

      **PENTING - KESESUAIAN JENJANG KELAS:**
      Anda HARUS menyesuaikan seluruh konten RPP dengan jenjang kelas \"{$gradeLevel}\". Perhatikan hal-hal berikut:

      **Untuk Kelas SD (1-6):**
      - Gunakan bahasa yang sangat sederhana, konkret, and mudah dipahami anak usia 6-12 tahun.
      - Fokus pada pembelajaran berbasis permainan, cerita, and pengalaman langsung.
      - Contoh dan ilustrasi harus dari kehidupan sehari-hari anak (keluarga, sekolah, lingkungan sekitar).
      - Kegiatan harus melibatkan gerakan fisik, visual, and hands-on activities.
      - Durasi fokus: 15-20 menit per aktivitas untuk kelas rendah (1-3), 25-30 menit untuk kelas tinggi (4-6).
      - Hindari konsep abstrak yang terlalu kompleks; gunakan pendekatan konkret-visual.

      **Untuk Kelas SMP (7-9):**
      - Gunakan bahasa yang jelas namun mulai memperkenalkan istilah akademis.
      - Fokus pada pengembangan berpikir kritis dan analitis awal.
      - Contoh dari kehidupan remaja, isu sosial sederhana, dan fenomena yang dapat diamati.
      - Kegiatan berbasis diskusi kelompok, eksperimen sederhana, dan proyek kolaboratif.
      - Mulai memperkenalkan konsep abstrak dengan jembatan dari konkret.
      - Dorong kemandirian dan tanggung jawab dalam belajar.

      **Untuk Kelas SMA/SMK (10-12):**
      - Gunakan bahasa akademis yang tepat dan istilah teknis sesuai bidang.
      - Fokus pada berpikir tingkat tinggi: analisis, evaluasi, kreasi.
      - Contoh dari isu kontemporer, kasus nyata, penelitian, dan aplikasi profesional.
      - Kegiatan berbasis riset, debat, presentasi, dan proyek kompleks.
      - Integrasikan konsep lintas disiplin dan aplikasi dunia nyata.
      - Persiapkan peserta didik untuk pendidikan tinggi atau dunia kerja.

      **PENTING - KEPATUHAN KETAT CAPAIAN PEMBELAJARAN (CP) BERDASARKAN KEPUTUSAN KEPALA BSKAP NO. 046/H/KR/2025:**
      1. **SUMBER KEBENARAN TUNGGAL**: Data berikut adalah EKSTRAKSI RESMI dari **{$regulation}** untuk **{$semesterLabel}**.
      2. **VERBATIM CP (HARGA MATI)**: Pada bagian \"Capaian Pembelajaran (CP)\" di hasil RPP, Anda **WAJIB** menyalin teks hasil ekstraksi yang RELEVAN (dari langkah \"SMART CP EXTRACTION\") secara **VERBATIM (KATA PER KATA)**. 
      3. **DILARANG KERAS**: Melakukan parafrase, meringkas, atau mengubah satu kata pun dari isi CP yang telah diekstrak tersebut. Redaksi harus sesuai aslinya.
      4. **STRUKTUR DATA RESMI (SEMESTER " . strtoupper($semesterLabel) . "):**
      " . json_encode($subjectData, JSON_UNESCAPED_UNICODE) . "
      5. **AKURASI FASE**: Gunakan pemetaan Fase: {$phasesText}.
      6. **FORMAT**: Gunakan format Markdown standar (* atau -).

      **PENTING - REFERENSI BUKU PEMERINTAH (WAJIB):**
      
      Anda WAJIB mereferensikan buku teks resmi yang diterbitkan oleh **Kemendikdasmen (Kementerian Pendidikan Dasar dan Menengah)** sesuai dengan jenjang dan mata pelajaran. Berikut panduan lengkapnya:
      
      **WAJIB HUKUMNYA**: Seluruh konten RPP, materi, dan instrumen harus merujuk pada buku dan pedoman dari Kemendikdasmen.

      **1. SUMBER BUKU RESMI PEMERINTAH:**
      - **Platform Resmi**: Buku Sekolah Elektronik (BSE) - buku.kemdikbud.go.id (Sekarang dikelola Kemendikdasmen)
      - **Penerbit Resmi**: Pusat Kurikulum dan Perbukuan (Puskurbuk) Kemendikdasmen
      - **Status**: Buku yang telah dinilai dan ditetapkan oleh Kemendikbudristek

      **2. IDENTIFIKASI BUKU YANG TEPAT:**
      
      Untuk **{$subject}** Kelas **{$gradeLevel}**, Anda harus:
      
      a) **Tentukan Jenjang dengan Benar:**
         - SD/MI: Kelas 1-6
         - SMP/MTs: Kelas 7-9
         - SMA/MA: Kelas 10-12
         - SMK/MAK: Kelas 10-12 (sesuai program keahlian)
      
      **PENTING - PROFIL LULUSAN (8 DIMENSI RESMI):**
      DILARANG KERAS memasukkan \"Literasi AI\", \"Adaptabilitas\", atau \"EQ\" ke dalam daftar Profil Lulusan. Mereka adalah Kompetensi Industri, bukan Dimensi Profil Lulusan.
      " . (($data['sourceType'] ?? '') === 'atp' && !empty($data['profilLulusan']) ? "
      **WAJIB GUNAKAN DIMENSI INI (DARI ATP):**
      Karena RPP ini diturunkan dari ATP, Anda **HARUS** menggunakan dimensi Profil Lulusan yang sama dengan ATP: **{$data['profilLulusan']}**
      Pastikan TIDAK ADA unsur \"Literasi AI\" atau \"Adaptabilitas\" di sini.
      " : "
      Dalam bagian Profil Lulusan / Karakter, Anda **WAJIB** memilih **minimal 1 dan MAKSIMAL 3 dimensi** paling relevan dari daftar        - **PROFIL LULUSAN (8 DIMENSI 2025):**
          *   **Keimanan & Ketakwaan**: Beriman, bertakwa kepada Tuhan YME, dan berakhlak mulia. (Termasuk: Integritas akademik, rasa syukur atas keteraturan alam/ilmu, etika profesi, dan tanggung jawab moral).
{$profileLulusanText}
      ") . "

      b) **Identifikasi Kurikulum:**
         - **Kurikulum Merdeka** (prioritas utama untuk tahun 2025/2026)
         - Kurikulum 2013 (jika sekolah masih menggunakan)
      
      c) **Nama Buku yang Akurat:**
         - Format: \"[Nama Mata Pelajaran] untuk [Jenjang] Kelas [X]\"
         - Contoh: \"Matematika untuk SMP Kelas VII\", \"Bahasa Indonesia untuk SD Kelas 4\"
         - Untuk Kurikulum Merdeka: Sebutkan \"Buku Siswa\" atau \"Buku Guru\"
      
      d) **Penulis dan Tahun Terbit:**
         - Sebutkan nama penulis jika memungkinkan
         - Tahun terbit (prioritas: 2022-2025 untuk Kurikulum Merdeka)
         - Contoh: \"Tim Penulis Kemendikdasmen, 2022\"
      
      **3. PANDUAN REFERENSI PER MATA PELAJARAN:**
      
      **Untuk Jenjang SD:**
      - **Mata Pelajaran**: Pendidikan Agama dan Budi Pekerti, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS (Ilmu Pengetahuan Alam dan Sosial - dimulai Kelas III), PJOK, Seni dan Budaya (Musik, Rupa, Teater, atau Tari), Bahasa Inggris (pilihan/mulok).
      
      **Untuk Jenjang SMP:**
      - **Mata Pelajaran Wajib**: Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPA, IPS, Bahasa Inggris, PJOK, Seni, dan **Informatika** (WAJIB).
      - **Muatan Lokal**: Sesuai potensi daerah.

      **Untuk Jenjang SMA:**
      - **Kelas X (Fase E)**: Mapel umum serupa SMP sebagai fondasi.
      - **Kelas XI & XII (Fase F)**: **TIDAK ADA penjurusan** (IPA, IPS, Bahasa). Siswa memilih mapel pilihan (seperti Biologi, Fisika, Ekonomi, Geografi, dsb) sesuai minat dan rencana karier.

      **Identifikasi Buku yang Tepat:**
      - Gunakan format: \"[Nama Mata Pelajaran] untuk [Jenjang] Kelas [X] Kurikulum Merdeka\"
      - Contoh SD: \"IPAS untuk SD Kelas 4 Kurikulum Merdeka\"
      - Contoh SMA: \"Fisika untuk SMA Kelas XI Kurikulum Merdeka\"

      **4. CARA MENGGUNAKAN REFERENSI DALAM RPP:**
      
      a) **Di Bagian \"Buku Sumber\" (Kartu Soal/RPP):**
         - Tulis nama lengkap buku
         - Format: \"Buku Siswa [Mapel] Kelas [X], Kemendikbudristek, [Tahun]\"
         - Contoh: \"Buku Siswa Matematika Kelas VII, Kemendikbudristek, 2022\"
      
      b) **Di Bagian \"Daftar Pustaka\":**
         - Format APA atau format standar Indonesia
         - Contoh: Kemendikdasmen. (2022). Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka. Jakarta: Pusat Kurikulum dan Perbukuan.
      
       c) **Di Bagian \"Materi Ajar Mendetail\":**
          - Rujuk halaman spesifik jika memungkinkan
          - Contoh: \"Sesuai Buku Siswa [Mapel] Kemendikdasmen Halaman...\"
        
        **5. VALIDASI KESESUAIAN MATERI:**
        
        Pastikan materi yang Anda ambil:
        - ✅ Sesuai dengan CP yang tercantum di BSKAP 046/2025
        - ✅ Sesuai dengan fase pembelajaran (A-F)
        - ✅ Sesuai dengan tingkat kognitif peserta didik
        - ✅ Menggunakan terminologi yang sama dengan buku teks pemerintah Kemendikdasmen
        - ✅ Tidak bertentangan dengan nilai-nilai Pancasila dan UUD 1945
  
        **6. JIKA BUKU SPESIFIK TIDAK TERSEDIA:**
        
        Jika Anda tidak memiliki akses ke buku spesifik:
        - Gunakan referensi umum: \"Buku Siswa [Mapel] Kelas [X] Kurikulum Merdeka, Kemendikdasmen\"
        - Tambahkan catatan: \"Guru dapat menyesuaikan dengan buku teks yang digunakan di sekolah (Kemendikdasmen)\"
        - JANGAN membuat referensi fiktif atau tidak resmi
        - Tetap gunakan materi yang akurat sesuai CP and standar nasional Kemendikdasmen
  
        **7. CONTOH PENERAPAN LENGKAP:**
        
        Untuk Matematika Kelas 7, materi \"Bilangan Bulat\":
        Buku Sumber:
      - Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka, Kemendikdasmen, 2022
        - Buku Guru Matematika untuk SMP Kelas VII Kurikulum Merdeka, Kemendikdasmen, 2022
        
        Materi Ajar Mendetail:
        Berdasarkan Buku Siswa Matematika Kelas VII(Bab 2: Bilangan Bulat, hal. 45 - 68):
      [Isi materi yang diambil dari buku tersebut sesuai standar Kemendikdasmen]
        
        Daftar Pustaka:
      Kemendikdasmen. (2022). Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka.
        Jakarta: Pusat Kurikulum dan Perbukuan, Badan Standar, Kurikulum, dan Asesmen Pendidikan.

      **CATATAN SANGAT PENTING (KONTROL KUALITAS MATERI):**
      - **CEK KESESUAIAN KELAS:** Anda **WAJIB** memastikan materi dan KD yang dikembangkan **SANGAT SESUAI** dengan tingkat kelas **{$gradeLevel}** Kurikulum Merdeka/K13 resmi.
      - **JANGAN SALAH LEVEL:** Jangan memasukkan materi yang terlalu sulit (milik kelas lebih tinggi) atau terlalu mudah (milik kelas lebih rendah).
      - **RUJUKAN RESMI:** Seluruh pengembangan materi, definisi, dan langkah pembelajaran **HARUS MENGACU PADA BUKU TEKS PELAJARAN RESMI KEMDIKBUD** untuk mapel {$subject} Kelas {$gradeLevel} yang beredar saat ini.
      - **KOREKSI OTOMATIS:** Jika input KD/Materi dari user terasa \"kurang pas\" dengan kelasnya, **SESUAIKAN** kedalaman dan cakupannya agar cocok untuk siswa kelas {$gradeLevel}.
      
      - Referensi buku pemerintah ini WAJIB dicantumkan di bagian \"Media Belajar\" and \"Daftar Pustaka\"
      - Materi yang diambil harus akurat and tidak menyimpang dari buku sumber
      - Jika ada perbedaan antara buku lama dan CP 2025, prioritaskan CP 2025

      **OFFICIAL TEXTBOOK REFERENCE (INTERNAL ONLY - DO NOT SHOW IN RPP OUTPUT):**
      Berdasarkan database BSKAP_DATA, berikut adalah buku yang relevan untuk materi \"{$materi}\":
      - **Buku**: {$textbookTitle}
      - **Penerbit**: {$textbookPublisher}
      - **Peta Bab Resmi**: {$textbookChapters}

      **INSTRUKSI**: 
      1. Jika materi \"{$materi}\" cocok dengan salah satu bab di atas, Anda **WAJIB** menyebutkan nama bab tersebut secara spesifik di bagian \"Buku Sumber\".
      2. Gunakan urutan logika dari buku tersebut untuk menyusun langkah pembelajaran.

      **STRUKTUR RPP YANG HARUS DIHASILKAN (Gunakan Format Markdown Ini):**

      # MODUL AJAR DEEP LEARNING (STANDARD 2026)

      ## IDENTIFIKASI PEMBELAJARAN
      | Komponen | Detail Informasi |
      | :--- | :--- |
      | **Satuan Pendidikan** | {$schoolName} |
      | **Mata Pelajaran** | {$subject} |
      | **Elemen** | {$elemen} |
      | **Kelas / Semester** | {$gradeLevel} / {$semesterLabel} |
      | **Materi Pokok** | {$materi} |
      | **Alokasi Waktu** | {$jp} JP (Total: .... menit) ({$distributionCount} x tatap muka) |
      " . ($distributionCount > 1 ? "| **Rincian Pertemuan** | {$distributionText} |" : "") . "
      | **Sarana & Prasarana** | [Sebutkan alat, bahan, dan sumber belajar spesifik yang digunakan] |
      | **Model Pembelajaran** | [PILIH MODEL SPESIFIK: PBL/PJBL/DLL] |
      | **Tahun Ajaran** | " . ($data['academicYear'] ?? '-') . " |
      | **Guru Pengampu** | {$teacherName} |
      | **NIP Guru** | {$teacherNip} |

      ## I. KOMPETENSI INTI (CP & TP)
      **1. Capaian Pembelajaran (CP):**
      (Tuliskan kompetensi utama yang harus dicapai peserta didik sesuai dengan fase and materi pokok ini).

      **2. Tujuan Pembelajaran (TP):**
      **WAJIB: Buatlah maksimal 3 (tiga) poin Tujuan Pembelajaran yang esensial.**
      DILARANG membuat terlalu banyak TP agar tidak memberatkan \"tagihan nilai\" (asesmen) di rapor. Fokuslah pada kompetensi utama yang ingin dicapai dalam seluruh rangkaian pertemuan ini.
      **WAJIB MENGGUNAKAN FORMULA A-B-C-D (Audience, Behavior, Condition, Degree)**
      Setiap poin tujuan pembelajaran HARUS memuat 4 unsur ini secara eksplisit namun mengalir.
      
      **INSTRUKSI VARIASI KALIMAT (PENTING: JANGAN TULIS LABEL HURUFNYA):** 
      Gunakan variasi kalimat di bawah ini, tapi **JANGAN** menampilkan tanda (A), (B), (C), atau (D) di hasil akhir. Biarkan mengalir sebagai kalimat narasi yang utuh.

      - **Variasi 1 (Format C-A-B-D):** \"Melalui diskusi kelompok, peserta didik mampu menganalisis penyebab banjir dengan kritis.\"
      - **Variasi 2 (Format A-B-C-D):** \"Peserta didik dapat menyusun laporan melalui observasi lapangan secara sistematis.\"
      - **Variasi 3 (Format A-B-D-C):** \"Peserta didik mampu mendemonstrasikan gerakan tari dengan luwes setelah mengamati video contoh.\"

      **Pastikan 4 unsur (A, B, C, D) selalu ada dalam kalimat, namun TERSEMBUNYI (implisit).**

      **JANGAN GUNAKAN FORMAT INI (SALAH):**
      *❌ \"Menyimpulkan sifat-sifat magnet.\" (Tidak ada Condition, Audience, and Degree)*

      **3. Kesiapan Peserta Didik:**
      " . ($data['studentCharacteristics']
    ? "(PENTING: Gunakan data manual ini sebagai basis utama: \"{$data['studentCharacteristics']}\". Rangkai kata-kata tersebut menjadi narasi yang profesional tentang kesiapan peserta didik. Anda WAJIB menyesuaikan seluruh strategi, level tantangan, dan langkah pembelajaran di RPP ini agar selaras dengan kondisi peserta didik tersebut.)"
    : "(Analisis secara otomatis pengetahuan awal, minat, latar belakang, dan motivasi peserta didik terkait materi ini sesuai dengan jenjang kelas dan mata pelajarannya).") . "

      **4. Karakteristik Materi:**
      (Jenis pengetahuan, relevansi dengan kehidupan, struktur materi, serta integrasi nilai & karakter).

      **5. Dimensi Profil Lulusan (8 Dimensi):**
      Tuliskan Dimensi Profil Lulusan yang relevan dan **BERIKAN DESKRIPSI DETAIL** bagaimana dimensi tersebut diwujudkan dalam aktivitas pembelajaran ini.
      
      " . (!empty($data['profilLulusan']) ? "
      **WAJIB GUNAKAN DIMENSI INI (SESUAI PERENCANAAN):**
      {$data['profilLulusan']}
      
      (Instruksi: Jelaskan penerapan konkret untuk setiap dimensi di atas dalam konteks materi {$materi}).
      " : "
      Pilihlah minimal 1, maksimal 3 dimensi yang paling relevan dari standar berikut dan jelaskan penerapannya:
      - **Keimanan & Ketakwaan**: (Contoh: Menumbuhkan rasa syukur, integritas akademik, atau etika).
      - **Kewargaan**: (Contoh: Memahami peran sebagai warga negara atau nilai Pancasila).
      - **Penalaran Kritis**: (Contoh: Menganalisis masalah, mengevaluasi data, atau berpikir logis).
      - **Kreativitas**: (Contoh: Membuat karya orisinal, mencari solusi alternatif, atau berinovasi).
      - **Kolaborasi**: (Contoh: Kerja kelompok, diskusi aktif, atau gotong royong).
      - **Kemandirian**: (Contoh: Inisiatif belajar, manajemen waktu, atau kemandirian berpikir).
      - **Kesehatan**: (Contoh: Menjaga well-being, keseimbangan diri, atau kesehatan fisik).
      - **Komunikasi**: (Contoh: Menyampaikan ide secara efektif atau membangun relasi).
      ") . "
      
      **FORMAT OUTPUT PROFIL LULUSAN:**
      - [Nama Dimensi]: [Penjelasan mendetail mengenai bagaimana peserta didik melatih dimensi ini melalui aktivitas spesifik di RPP ini].

      
      ## II. LANGKAH-LANGKAH PEMBELAJARAN
      **PENTING - ALOKASI WAKTU:**
      Durasi total menit wajib dicantumkan dalam tabel Identifikasi. Standar Durasi:
{$durationText}
      
      HITUNGLAH durasi total menit dengan mengalikan total JP ({$jp}) sesuai jenjang Kelas {$gradeLevel}.

      **STRUKTUR PER PERTEMUAN:**
      Setiap pertemuan **WAJIB** memiliki rincian durasi yang jika dijumlahkan HASILNYA HARUS SAMA dengan alokasi JP per pertemuan tersebut.

      " . ($distributionCount > 1
    ? "Materi ini telah dialokasikan dalam Progam Semester (Promes) menjadi **{$distributionCount} pertemuan** dengan rincian JP per pertemuan: [{$distributionText}]. Anda WAJIB menyusun langkah pembelajaran sesuai dengan jumlah pertemuan dan alokasi JP tersebut."
    : "Materi ini disusun untuk **1 pertemuan** dengan total {$jp} JP.") . "

      **PRINSIP UTAMA - DEEP LEARNING & DIFERENSIASI:**
      Setiap fase pembelajaran (Pendahuluan, Inti, Penutup) HARUS mengintegrasikan ketiga prinsip Deep Learning:
      - **Mindful (Berkesadaran)**: Peserta didik hadir secara utuh, sadar akan tujuan belajarnya.
      - **Meaningful (Bermakna)**: Materi memiliki relevansi dunia nyata dan kedalaman pemahaman.
      - **Joyful (Menggembirakan)**: Suasana positif yang menumbuhkan rasa ingin tahu.

      **STRATEGI DIFERENSIASI (WAJIB TERAPKAN):**
{$differentiationStrategiesText}
      Uraikan secara spesifik dalam langkah pembelajaran bagaimana Anda melakukan diferensiasi ini untuk melayani keberagaman peserta didik.

      Setiap pertemuan **WAJIB** memiliki struktur lengkap berikut:

      **ALOKASI PERTEMUAN (WAJIB IKUTI PROMES):**
      " . ($distributionCount > 0
    ? "Berdasarkan data Program Semester (Promes), materi ini telah dijadwalkan untuk **{$distributionCount} KALI PERTEMUAN**. Anda **WAJIB** membuat rincian untuk **{$distributionCount} pertemuan** tersebut. Jangan kurang, jangan lebih."
    : "Jika materi ini sangat luas dan JP mencukupi, Anda boleh membaginya menjadi maksimal 2 pertemuan. Jika tidak, cukup 1 pertemuan.") . "
      
      ### PERTEMUAN [X] (Topik Spesifik: ...)
      *(Catatan: Anda WAJIB mengulangi struktur di bawah ini untuk SETIAP pertemuan yang dijadwalkan)*
      
      **1. Pendahuluan (Mindful Connection) - [10 menit]:**
      *   **Ritual Pembuka (Mindful):** Salam pembuka, **Berdoa bersama**, **Presensi/Mengabsen peserta didik**, dan Menanyakan Kabar untuk membangun koneksi awal yang hangat, rasa syukur, and kesadaran penuh.
      *   **Apersepsi (Meaningful):** Hubungkan materi baru dengan pengalaman atau pengetahuan siswa yang relevan dengan kehidupan nyata mereka.
      *   **Motivasi & Tujuan (Mindful + Joyful):** Sampaikan tujuan pembelajaran dengan cara yang memotivasi and membuat siswa antusias. Jelaskan MENGAPA materi ini penting untuk mereka.
      *   **Pemantik (Hook - Joyful):** Berikan pemicu rasa ingin tahu seperti video menarik, pertanyaan tantangan, cerita pendek, atau fenomena mengejutkan yang membuat siswa excited untuk belajar.

      **2. Kegiatan Inti (Penerapan Model & Deep Learning):**
      
      *PENTING (MODEL PEMBELAJARAN):* 
      - Jika input Model Pembelajaran adalah \"Otomatis\", Anda **WAJIB MEMILIH** dari standar preferred_models: " . json_encode(array_map(fn($m) => $m['name'], $bskapData['pedagogis']['preferred_models'] ?? []), JSON_UNESCAPED_UNICODE) . ".
      - **DILARANG KERAS** menggunakan istilah di luar standar tersebut atau menulis kata \"Otomatis\". Gunakan sintaks spesifik sebagaimana didefinisikan dalam pedagogis operasional.
      
      **INSTRUKSI SANGAT PENTING (NARATIF & MENDALAM):** 
      - Bagian kegiatan inti per pertemuan harus **TEBAL, NARATIF, and MENDETAIL**. 
      - **KERANGKA PROGRESIVITAS (WAJIB UNTUK 2+ PERTEMUAN):**
        - **Pertemuan 1 (Fondasi)**: Fokus pada pengenalan konsep, pemahaman dasar, and koneksi awal (Conceptual).
        - **Pertemuan 2 (Aplikasi/Praktik)**: Fokus pada prosedur, eksperimen, latihan terbimbing, atau pengembangan keterampilan (Procedural).
        - **Pertemuan 3+ (Ekspansi/Evaluasi)**: Fokus pada proyek kompleks, pemecahan masalah nyata, presentasi karya, atau asesmen sumatif (Creative/Evaluation).
      - Anda **WAJIB** memastikan setiap pertemuan memiliki sub-topik yang spesifik dan aktivitas yang **BERBEDA** secara signifikan. Jangan mengulang aktivitas yang sama di pertemuan yang berbeda.
      - Uraikan langkah pembelajaran menjadi skenario nyata langkah-per-langkah (step-by-step).
      - Bedakan jelas aktivitas **GURU** and aktivitas **PESERTA DIDIK**.
      - Pastikan urutannya logis sesuai sintaks model pembelajaran.

      Jalin sintaks/tahapan model tersebut secara harmonis ke dalam 3 level Deep Learning berikut untuk setiap pertemuan:
      
      *   **Memahami (Understanding - Mindful + Meaningful):** 
          - Tuliskan langkah-langkah fase awal model (seperti Orientasi pada masalah, Pemberian Stimulus, atau Identifikasi Masalah).
          - **Contoh Detail:** \"Guru menampilkan slide berisi gambar pencemaran lingkungan. Peserta didik secara bergiliran memberikan pendapat satu kata tentang gambar tersebut. Guru mencatat kata kunci di papan tulis.\"
          - Sertakan estimasi waktu untuk setiap langkah, misal: \"Orientasi Masalah [15 menit]\".
          
      *   **Mengaplikasi (Applying - Meaningful + Joyful) - (BAGIAN TERPANJANG):** 
          - Tuliskan langkah-langkah fase aksi model (seperti Penyelidikan Mandiri/Kelompok, Pengumpulan Data, atau Pembuatan Produk/Karya).
          - **Wajib Detil:** Jelaskan bagaimana pembagian kelompok dilakukan, apa instruksi spesifik LKPD, bagaimana guru memonitor, and bagaimana siswa berkolaborasi.
          - Sertakan estimasi waktu untuk setiap langkah, misal: \"Penyelidikan Kelompok [40 menit]\".
          - Aktivitas harus menantang (Joyful) and memiliki dampak nyata (Meaningful).
          
      *   **Merefleksi (Reflecting - Mindful + Meaningful):** 
          - Tuliskan langkah-langkah fase akhir model (seperti Pembuktian, Presentasi hasil, atau Menarik Kesimpulan).
          - Jelaskan mekanisme presentasi (misal: \"Gallery Walk\" atau \"Presentasi Panel\").
          - Sertakan estimasi waktu untuk setiap langkah, misal: \"Presentasi Hasil [15 menit]\".

      **3. Penutup (Creative Closure - Mindful + Meaningful + Joyful) - [10 menit]:**
      *   **Rangkuman & Refleksi (Mindful + Meaningful):** Siswa and guru merangkum pembelajaran and melakukan refleksi mendalam tentang makna pembelajaran hari ini.
      *   **Apresiasi & Motivasi (Joyful):** Berikan apresiasi positif atas partisipasi siswa and motivasi untuk terus belajar.
      *   **Preview:** Berikan gambaran menarik tentang materi pertemuan berikutnya.
      *   **Ritual Penutup (Mindful):** WAJIB diakhiri dengan **Doa Syukur** and **Salam Penutup** sebagai tanda syukur atas kelancaran proses belajar.

      **4. Integrasi 6C & Deep Learning (PRINSIP HUTANG BAYAR):**
      - **PRINSIP HUTANG BAYAR**: Setiap Dimensi Profil Lulusan yang Anda pilih di Bagian I **WAJIB** memiliki aktivitas nyata di langkah-langkah pembelajaran ini. DILARANG mencantumkan Dimensi yang tidak diajarkan.
      - Pastikan seluruh langkah di pertemuan ini secara eksplisit mengintegrasikan: Character, Citizenship, Collaboration, Communication, Creativity, Critical Thinking.
      - **CEK KONSISTENSI TP**: Setiap Tujuan Pembelajaran (TP) yang Anda tulis di atas **HARUS** memiliki aktivitas nyata di langkah-langkah ini. Jangan ada TP yang \"terlupakan\" atau tidak diajarkan.


      **CATATAN PENTING TENTANG KEPADATAN & KELENGKAPAN (PRIORITAS UTAMA):**
      - **TARGET KELENGKAPAN (MUTLAK):** Seluruh struktur RPP dari Identifikasi hingga Daftar Pustaka **WAJIB SELESAI 100%**. DILARANG TERPUTUS di tengah jalan.
      - **MANAJEMEN TOKEN:** Kelola kedalaman penjelasan Anda agar bagian **Lampiran (LKPD & Instrumen)** mendapatkan ruang yang cukup dan tidak terpotong.
      - **KEDALAMAN NARASI:** 
        - Buatlah skenario pembelajaran yang **substantif dan bermakna**, namun tetap **efisien** (to the point). 
        - Gunakan poin-poin atau paragraf yang padat informasi, hindari pengulangan kalimat.
        - Fokus pada kualitas interaksi Guru-Siswa daripada panjangnya teks.
      - **TARGET ESTIMASI:** 
        - **1 Pertemuan**: Sekitar 5-7 halaman konten berkualitas (Pastikan Lampiran Komplit).
        - **2+ Pertemuan**: Sekitar 8-10 halaman (Gunakan progresivitas yang jelas tanpa bertele-tele).
      
      **INSTRUKSI VERIFIKASI:** Sebelum mengakhiri respon, pastikan Anda telah menuliskan bagian **GLOSARIUM** dan **DAFTAR PUSTAKA** secara lengkap.
      
      ## III. MEDIA BELAJAR
      (Sebutkan secara spesifik media yang akan digunakan: nama video/platform, jenis infografis, alat peraga konkret, dll. Jangan hanya menulis \"video interaktif\" tapi sebutkan topik/judulnya).

      ## IV. LAMPIRAN
      
      ### 1. LKPD (LEMBAR KERJA PESERTA DIDIK)
      
      **LKPD - {$materi} (KONSISTENSI TP)**
      **PENTING UNTUK AI:** Soal-soal di bawah ini **HARUS** merupakan turunan langsung dari Tujuan Pembelajaran (TP). Setiap aktivitas LKPD adalah sarana latihan untuk mencapai TP.

      
      ---
      
      **Identitas Peserta Didik:**
      | Komponen | Keterangan |
      | :--- | :--- |
      | Nama | : _________________________________ |
      | Kelas | : _________________________________ |
      | Tanggal | : _________________________________ |
      
      **Tujuan Pembelajaran:**
      (Tuliskan maksimal 3 tujuan pembelajaran yang akan dicapai peserta didik melalui LKPD ini, harus konsisten dengan bagian I di atas, menggunakan bahasa yang mudah dipahami peserta didik).
      
      **Petunjuk Penggunaan:**
      1. Bacalah setiap instruksi dengan cermat sebelum mengerjakan.
      2. Kerjakan secara mandiri atau berkelompok sesuai arahan guru.
      3. Tuliskan jawaban dengan jelas dan lengkap.
      4. Tanyakan kepada guru jika ada yang kurang jelas.
      
      ---
      
      **KEGIATAN 1: MENGAMATI & MEMAHAMI**
      (Berikan stimulus berupa gambar, teks pendek, video, atau fenomena yang relevan dengan materi. Ajukan 3-4 pertanyaan pemantik yang mendorong peserta didik untuk mengamati and memahami konsep dasar).
      
      **Ruang Jawaban:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **KEGIATAN 2: MENGANALISIS & BERDISKUSI**
      (Berikan kasus, masalah, atau data yang perlu dianalisis peserta didik. Ajukan pertanyaan yang mendorong berpikir kritis and diskusi kelompok).
      
      **Ruang Jawaban:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **KEGIATAN 3: MENCOBA & BERKREASI**
      (Berikan tugas praktik, eksperimen sederhana, atau proyek kreatif yang memungkinkan peserta didik menerapkan pemahaman mereka).
      
      **Ruang Jawaban/Hasil Karya:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **REFLEKSI PEMBELAJARAN & PENILAIAN DIRI**
      
      1. Apa hal paling menarik yang kamu pelajari hari ini?
         ___________________________________________________________________________
      2. Apa yang masih sulit kamu pahami?
         ___________________________________________________________________________
      
      **Penilaian Diri:**
      | Aspek | Sudah Paham | Cukup Paham | Perlu Bimbingan |
      | :--- | :---: | :---: | :---: |
      | Saya memahami tujuan pembelajaran | ☐ | ☐ | ☐ |
      | Saya dapat menjelaskan konsep utama | ☐ | ☐ | ☐ |
      | Saya aktif dalam kegiatan | ☐ | ☐ | ☐ |
      
      ---

      ### 2. INSTRUMEN PENILAIAN (ASESMEN & KKTP)
      
      **A. ASESMEN DIAGNOSTIK (ASESMEN AWAL)**
      (Buatlah minimal 3-5 pertanyaan singkat atau aktivitas sederhana untuk memetakan kemampuan awal peserta didik terkait materi ini. Tujuannya untuk mengetahui kesiapan belajar).
      
      **B. KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)**
      *Pendekatan yang digunakan: {$assessmentModel}*
      
      > **Catatan:** Penentuan kriteria ketercapaian tujuan pembelajaran dalam modul ini merujuk pada standar penilaian dalam **Permendikbudristek No. 21 Th 2022** dan kompetensi pada **Keputusan Kepala BSKAP No. 046/H/KR/2025**.

      **ATURAN WAJIB KORELASI:** 
      Indikator/Kriteria di bawah ini **HARUS** merupakan turunan langsung dari **Tujuan Pembelajaran (TP)** yang Anda tulis di Bagian I. Jangan membuat indikator yang tidak ada di TP.

      " . ($assessmentModel === 'Deskripsi Kriteria' ? "
      **B.1. DESKRIPSI KRITERIA (Checklist)**
      Guru menetapkan kriteria ketuntasan yang spesifik. Peserta didik dianggap mencapai tujuan pembelajaran jika memenuhi minimal jumlah kriteria tertentu (misal 3 dari 4).

      | Kriteria (Indikator Ketercapaian) | Sudah Muncul (✔) | Belum Muncul (❌) |
      | :--- | :---: | :---: |
      | 1. [Indikator 1 - turunan TP] | | |
      | 2. [Indikator 2 - turunan TP] | | |
      | 3. [Indikator 3 - turunan TP] | | |
      | 4. [Indikator 4 - turunan TP] | | |
      | **Kesimpulan:** | Tuntas (jika ... kriteria muncul) / Belum Tuntas | |
      " : ($assessmentModel === 'Interval Nilai' ? "
      **B.1. INTERVAL NILAI**
      Guru menggunakan rentang nilai untuk menentukan tindak lanjut.

      | Rentang Nilai | Keterangan & Tindak Lanjut |
      | :--- | :--- |
      | **0 - 40%** | **Belum Mencapai Ketuntasan (Remedial Seluruh Bagian)** <br> Siswa belum memahami konsep dasar and memerlukan bimbingan intensif dari awal. |
      | **41 - 65%** | **Belum Mencapai Ketuntasan (Remedial Bagian Tertentu)** <br> Siswa sudah memahami sebagian konsep namun masih kesulitan di bagian [Sebutkan bagian sulit]. Perlu remedial pada indikator yang belum tuntas. |
      | **66 - 85%** | **Sudah Mencapai Ketuntasan (Tidak Perlu Remedial)** <br> Siswa sudah menguasai materi dengan baik. Dapat diberikan latihan pemantapan. |
      | **86 - 100%** | **Sudah Mencapai Ketuntasan (Pengayaan)** <br> Siswa sangat mahir. Berikan tantangan lebih kompleks atau menjadi tutor sebaya. |
      " : ($assessmentModel === 'Rubrik' ? "
      **B.1. RUBRIK PENILAIAN (LEVELING)**
      Guru menyusun tingkatan pencapaian untuk setiap indikator.

      | Aspek / Indikator | Baru Berkembang (1) | Layak (2) | Cakap (3) | Mahir (4) |
      | :--- | :--- | :--- | :--- | :--- |
      | **[Aspek 1 - e.g. Pemahaman]** | Belum mampu menjelaskan [konsep] secara mandiri. | Mampu menjelaskan konsep namun masih kurang tepat/lengkap. | Mampu menjelaskan konsep dengan benar and menggunakan bahasa sendiri. | Mampu menjelaskan konsep dengan sangat detail, logis, and memberikan contoh relevan. |
      | **[Aspek 2 - e.g. Keterampilan]** | Belum bisa menerapkan [prosedur]. | Bisa menerapkan prosedur tapi butuh bimbingan. | Bisa menerapkan prosedur dengan benar secara mandiri. | Bisa menerapkan prosedur dengan sangat lancar, efisien, and kreatif. |
      | **[Aspek 3 - e.g. Sikap]** | Kurang aktif dlm diskusi. | Cukup aktif tapi jarang berpendapat. | Aktif berdiskusi and menghargai pendapat teman. | Sangat aktif, menjadi inisiator diskusi, and memimpin kelompok dengan baik. |
      " : "
      **B.1. PENDEKATAN KKTP (OTOMATIS PILIHAN AI)**
      *(Karena Anda memilih mode Otomatis, AI telah menentukan metode penilaian yang paling efektif untuk materi ini)*:

      **Pilihan Metode: [Sebutkan nama metode: Rubrik/Deskripsi/Interval]**

      [TULISKAN ISI PENILAIAN SECARA LENGKAP & SPESIFIK DI SINI. Jika memilih Rubrik, buat tabel rubrik minimal 3 aspek. Jika Deskripsi, buat checklist minimal 4 kriteria. Jika Interval, buat panduan tindak lanjut yang disesuaikan dengan materi ini].
      "))) . "

      ---
      
      **C. ASESMEN FORMATIF & SUMATIF (INSTRUMEN)**
      **C.1. Asesmen Formatif (Selama Proses)**
      | Komponen | Teknik Penilaian | Instrumen |
      | :--- | :--- | :--- |
      | **Observasi 6C** | Pengamatan aktif | Lembar Observasi (Character, Citizenship, Collaboration, Communication, Creativity, Critical Thinking) |
      | **Refleksi Diri** | Self Assessment | Menilai pemahaman mandiri menggunakan kartu refleksi |
      | **Feedback** | Peer Feedback | Memberikan masukan konstruktif antar teman |

      **C.2. Asesmen Sumatif (Akhir Materi)**
      *(Sediakan minimal 2-3 contoh soal objektif atau instruksi tugas akhir yang mengukur Tujuan Pembelajaran secara utuh)*

      | Kriteria Ketuntasan | Perlu Bimbingan (1) | Cukup (2) | Baik (3) | Sangat Baik (4) |
      | :--- | :--- | :--- | :--- | :--- |
      | **Pemahaman Konten** | Mengalami miskonsepsi | Paham sebagian | Paham secara utuh | Paham & mampu mengembangkan |
      | **Aplikasi/Analisis** | Belum bisa menerapkan | Bisa menerapkan dengan bantuan | Bisa menerapkan mandiri | Bisa menganalisis & berinovasi |

      ### 3. MATERI AJAR MENDETAIL (KONSISTENSI TP)
      **WAJIB DIISI DENGAN KONTEN LENGKAP & RELEVAN!**
      - **CEK KONSISTENSI:** Pastikan materi yang ditulis di sini **MENJAWAB** seluruh Tujuan Pembelajaran (TP). Jika TP menuntut \"Menganalisis\", maka materi harus memberikan landasan teori untuk analisis tersebut.
      - Minimal 3-5 paragraf substantif yang mencakup konsep, teori, contoh konkret, and aplikasi nyata materi ini.

      ### 4. GLOSARIUM
      **WAJIB DIISI!** Daftar minimal 5-10 istilah penting and definisinya.
      - **[Istilah]**: Definisi...

      ### 5. DAFTAR PUSTAKA
      **WAJIB DIISI!** Minimal 3-5 referensi kredibel (Buku, Jurnal, Sumber Digital).

      &nbsp;
      &nbsp;

      ---
      **CATATAN PENTING UNTUK AI:**
      - **WAJIB** ada baris kosong setelah tag pembuka div and sebelum tag penutup div agar tabel Markdown tampil sempurna.
      - **JANGAN** ada baris kosong di antara baris tabel. Tabel harus rapat.
      - Gunakan bahasa Indonesia yang **Inspiratif, Profesional, and Terstruktur**.
      - Pastikan bagian **Materi Ajar Mendetail** benar-benar berisi konten akademis yang kuat.
      - **WAJIB** gunakan istilah **\"Peserta Didik\"** pengganti kata \"Siswa\" di seluruh dokumen.
      - **JANGAN** membuat bagian Tanda Tangan (Mengetahui Kepala Sekolah/Guru). Bagian ini akan ditambahkan otomatis oleh sistem.
      - **JANGAN** menggunakan placeholder seperti \"NIP. ....................\".
      - **PRINSIP HUTANG BAYAR (AUDIT KONSISTENSI)**: Periksa kembali hasil akhir Anda. Jika Anda mencantumkan \"Penalaran Kritis\" di Profil Lulusan, pastikan ada kegiatan diskusi atau analisis mendalam di langkah pembelajaran. Jika Anda mencantumkan \"Kemampuan Komunikasi\", pastikan ada kegiatan presentasi atau berbagi ide. RPP adalah janji yang harus \"dibayar\" dalam kegiatan nyata.

      - Output harus **langsung dalam format Markdown** tanpa komentar pembuka atau penutup dari asisten.
    ";

        return $prompt;
    }

    protected function buildQuizPrompt($data)
    {
        $subject = $data['subject'];
        $gradeLevel = $data['gradeLevel'];
        $topic = $data['topic'];
        $context = $data['context'] ?? '';
        $difficulty = $data['difficulty'] ?? 50;
        $typeCounts = $data['typeCounts'] ?? ['pg' => 10];
        
        // Batching context
        $batchNum = $data['batchNum'] ?? 1;
        $totalBatches = $data['totalBatches'] ?? 1;
        $allQuestions = $data['allQuestions'] ?? [];
        
        $bskapData = $this->bskapIntel;
        $regulation = $bskapData['standards']['regulation'] ?? 'BSKAP No. 46 Tahun 2025';

        // Calculate total questions for this batch
        $batchTotal = 0;
        $batchInstructions = "";
        foreach ($typeCounts as $type => $count) {
            $batchTotal += $count;
            for($i=0; $i<$count; $i++) {
                $batchInstructions .= "- Buatlah 1 soal tipe **$type**\n";
            }
        }
        
        $alreadyCovered = !empty($allQuestions) 
            ? "- **TOPIK YANG SUDAH DICAKUP**: [" . implode(', ', array_map(fn($q) => $q['pedagogical_materi'] ?? '', $allQuestions)) . "] (HINDARI pengulangan materi yang sama)\n"
            : "";

        return "
        LANDASAN REGULASI: **{$regulation}** (Standar Nasional Kurikulum Merdeka).
        STANDAR PEDAGOGIS: **Buku Teks Utama Kemendikbudristek** (Mindful, Meaningful, Joyful).
        
        TUGAS: Buatlah {$batchTotal} butir soal (Batch {$batchNum} dari {$totalBatches}) untuk:
        - Mapel: {$subject} | Kelas: {$gradeLevel} | Topik: {$topic}
        - Konteks: \"{$context}\" 
        " . (!$context ? '(WAJIB: Gunakan Database Internal Kurikulum Merdeka & BSKAP 46/2025 Anda untuk menentukan CP/Kompetensi yang relevan secara mandiri)' : '(WAJIB JADI SUMBER UTAMA)') . "
        - HOTS Meter: {$difficulty}%
        {$alreadyCovered}

        TUGAS UTAMA: 
        1. Analisis materi dalam \"Konteks\" yang belum dicakup di batch sebelumnya.
        2. Buatlah soal yang spesifik dan mendalam.
        {$batchInstructions}

        STRICT RULES:
        1. Gunakan Bahasa Indonesia akademis formal (PUEBI).
        2. **EFFICIENCY PRIORITY**: Gunakan kalimat yang PADAT dan SINGKAT. Hindari pengulangan kata. Maksimalkan substansi materi dalam ruang yang terbatas agar tidak terpotong.
        3. **REFERENSI MATERI (STRICT)**: Gunakan isi dari \"Konteks\" atau \"RINGKASAN MATERI\" sebagai sumber utama soal. Abaikan instruksi teknis guru jika ada; fokuslah pada konsep, fakta, dan data materi.
        4. **STIMULUS KAYA & DETAIL (CRITICAL - DEEP LEARNING)**: Stimulus **WAJIB** berbentuk narasi kaya (3-5 kalimat), data tabel, studi kasus, atau fenomena nyata. Dilarang soal hafalan definisi literal. Stimulus harus membangun konteks yang:
           - **Mindful**: Mengajak siswa menyadari fenomena/masalah secara utuh.
           - **Meaningful**: Menunjukkan relevansi materi dengan kehidupan nyata atau isu global/lokal.
        5. **TRUE/FALSE MULTI-STATEMENT (MANDATORY)**: Khusus tipe \"true_false\", Anda WAJIB membuat minimal 3-5 pernyataan dalam satu nomor soal untuk dianalisis siswa.
        6. **VARIASI POSISI JAWABAN (MANDATORY)**: Pastikan posisi jawaban benar (untuk PG/Complex) selalu berpindah-pindah. Khusus soal \"matching\" (menjodohkan), urutan pada array \"right_side\" WAJIB diacak agar tidak lurus sejajar dengan \"left_side\" (Contoh pasangan variatif, bukan A-1, B-2).
        7. **PRINSIP DEEP LEARNING (WAJIB)**:
           - **Kontekstual**: Hubungkan soal dengan kehidupan sehari-hari siswa agar bermakna.
           - **Reflektif**: Ajak siswa melihat kembali apa yang dipelajari dan proses belajarnya.
           - **Eksploratif**: Berikan ruang untuk berbagai kemungkinan jawaban atau solusi kreatif.
        
        STRUKTUR JSON PER TIPE (INPUT HARUS SESUAI):
        - **Wajib Ada di Setiap Soal (MANDATORY SINGKAT)**: 
          \"pedagogical_materi\": \"Materi spesifik (max 3 kata)\",
          \"competency\": \"Intisari CP (max 5 kata)\", 
          \"indicator\": \"Indikator (max 8 kata)\", 
          \"cognitive_level\": \"L1/L2/L3/L4/L5/L6\",
          \"stimulus\": \"Narasi kaya, studi kasus, atau data riil (3-5 kalimat, WAJIB DETAIL)\",
          \"image_hint\": \"Instruksi gambar (Opsional, gunakan [] jika ada)\"
        - **pg**: {\"type\": \"pg\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"options\": [\"A...\", \"B...\"], \"answer\": \"A...\", \"explanation\": \"...\"}
        - **pg_complex**: {\"type\": \"pg_complex\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"options\": [\"1...\", \"2...\"], \"answer\": [\"1...\", \"3...\"], \"explanation\": \"...\"}
         - **pg_matrix**: {\"type\": \"pg_matrix\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"rows\": [\"Pernyataan 1\", \"Pernyataan 2\"], \"columns\": [\"Kategori A\", \"Kategori B\"], \"answer\": [{\"row\": \"Pernyataan 1\", \"column\": \"Kategori A\"}], \"explanation\": \"...\"}
         - **matching**: {\"type\": \"matching\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"left_side\": [\"A\", \"B\"], \"right_side\": [\"1\", \"2\", \"3\"], \"pairs\": [{\"left\": \"A\", \"right\": \"1\"}], \"explanation\": \"...\"}
         - **true_false**: {\"type\": \"true_false\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"statements\": [{\"text\": \"Pernyataan 1\", \"isCorrect\": true}, {\"text\": \"Pernyataan 2\", \"isCorrect\": false}], \"explanation\": \"...\"}
         - **short_answer**: {\"type\": \"short_answer\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"answer\": \"Kunci jawaban (Singkat 1-3 kata)\", \"explanation\": \"...\"}
         - **sequencing**: {\"type\": \"sequencing\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"items\": [\"Langkah A\", \"Langkah B\", \"Langkah C\"], \"correct_order\": [\"Langkah B\", \"Langkah A\", \"Langkah C\"], \"explanation\": \"...\"}
         - **essay/uraian**: {\"type\": \"essay\", \"pedagogical_materi\": \"...\", \"competency\": \"...\", \"indicator\": \"...\", \"cognitive_level\": \"...\", \"stimulus\": \"...\", \"question\": \"...\", \"answer\": \"Kunci jawaban (WAJIB SINGKAT & PADAT)\", \"grading_guide\": \"Pedoman penskoran ringkas\", \"explanation\": \"Penjelasan singkat\"}

        FORMAT OUTPUT TOTAL (JSON ONLY):
        {
          \"title\": \"{$topic}\",
          \"questions\": [
             // Masukkan {$batchTotal} soal di sini
          ]
        }

        **RESPONSE MANDATE:**
        - Output HANYA JSON yang valid.
        - DILARANG memberikan teks penjelasan sebelum atau sesudah JSON.
        - Pastikan seluruh tanda petik dan koma sesuai standar JSON.
        ";
    }

    protected function buildHandoutPrompt($data)
    {
        $subject = $data['subject'] ?? 'Mata Pelajaran';
        $gradeLevel = $data['gradeLevel'] ?? 'Semua Kelas';
        $materi = $data['materi'] ?? $data['topic'] ?? 'Topik Umum';
        $kd = $data['kd'] ?? '';
        $elemen = $data['elemen'] ?? '';
        $teacherName = $data['teacherName'] ?? 'Guru Smart School';
        $teacherTitle = $data['teacherTitle'] ?? 'Bapak/Ibu';
        
        $bskapData = $this->bskapIntel;
        $regulation = $bskapData['standards']['regulation'] ?? 'Keputusan Kepala BSKAP No. 046/H/KR/2025';

        return "
        Anda adalah \"Mesin Intelijen Kurikulum Nasional\" yang bertugas menyusun **Bahan Ajar (Handout/Modul)** yang inovatif, mendalam, dan selaras dengan administrasi guru.
        
        **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
        - Regulasi Dasar: **{$regulation}**
        
        Tugas Anda: Susun Bahan Ajar (Handout) yang **OTORITATIF** dan **MENYENANGKAN** berdasarkan parameter ini:
        - Mapel: {$subject}
        - Jenjang/Kelas: {$gradeLevel}
        - Materi Pokok: {$materi}
        " . ($kd ? "- **KONSTRUKSI TP/KD**: {$kd}" : '') . "
        - Guru: {$teacherTitle} {$teacherName}

        **STRUKTUR MODUL (WAJIB IKUTI FORMAT INI):**

        # 📘 MODUL BELAJAR: [JUDUL MATERI DI SINI]
        
        > \"Belajar itu bukan tentang menjadi pintar, tapi tentang peka terhadap sekitarmu.\" - Smart Teaching
        
        ---

        ## 🎯 TARGET BELAJAR KITA HARI INI
        Di akhir modul ini, kamu bakal jago dalam:
        - [Tujuan 1 bahasa siswa]
        - [Tujuan 2 bahasa siswa]
        
        ---

        ## 🗺️ PETA KONSEP (MIND MAP)
        *(Sajikan ringkasan alur materi menggunakan diagram Mermaid `graph TD` agar siswa mudah membayangkan peta perjalanan belajarnya).*
        
        ---

        ## 🚀 APERSEPSI: TAHUKAH KAMU?
        (Berikan paragraf pembuka yang menarik dan relevan dengan dunia nyata).

        ---

        ## 📚 MATERI INTI (DAGINGNYA!)
        *(Bagian ini harus menjadi bagian TERPANJANG. Jangan hanya poin-poin. Jelaskan konsep selengkap-lengkapnya layaknya Anda mengajar di depan kelas dengan bahasa yang mengalir).*
        
        ### 1. [Sub-Bab 1]
        
        ### 2. [Sub-Bab 2]
        
        > **💡 TIPS JITU:**
        > (Masukkan tips atau cara cepat memahami konsep ini).

        ### 🔦 STUDI KASUS / POJOK LITERASI
        (Tambahkan satu cerita pendek, fakta menarik, atau kasus nyata untuk dianalisis).

        ---

        ## 🧪 CONTOH SOAL & BEDAH JAWABAN (WAJIB)
        *(Berikan minimal 2 contoh soal dengan tingkat kesulitan berbeda beserta penjelasan logikanya).*

        ---

        ## 📝 TANTANGAN MINIMU (LATIHAN) - WAJIB MUNCUL
        *(Berikan tepat 5 soal latihan bervariasi: pilihan ganda atau esai singkat).*

        ---

        ## 📖 KAMUS MINI (GLOSARIUM) - WAJIB MUNCUL
        *(Berikan minimal 5-10 istilah penting beserta definisinya).*
        
        ---
        *Disusun dengan penuh dedikasi oleh {$teacherTitle} {$teacherName}*
        
        **SIKAP KERJA & VERIFIKASI AKHIR (WAJIB):**
        1. **KOMPLITNYA STRUKTUR**: Jangan berhenti sebelum bagian \"KAMUS MINI\" selesai ditulis.
        2. **FORMAT**: Langsung format Markdown tanpa komentar basa-basi.
        ";
    }

    protected function buildWorksheetPrompt($data)
    {
        $rppContent = $data['rppContent'];
        $assessmentModel = $data['assessmentModel'] ?? 'Rubrik';
        $studentNames = $data['studentNames'] ?? [];
        
        $bskapData = $this->bskapIntel;
        $regulation = $bskapData['standards']['regulation'] ?? 'Keputusan Kepala BSKAP No. 046/H/KR/2025';

        $studentListText = !empty($studentNames)
            ? "Berikut adalah daftar nama peserta didik yang HARUS dimasukkan ke dalam tabel penilaian: \n" . implode(', ', $studentNames)
            : 'Buatlah satu baris kosong (...................) untuk nama peserta didik.';

        return "
        Anda adalah \"Mesin Intelijen Kurikulum Nasional\" spesialis penyusunan **Lembar Kerja Peserta Didik (LKPD)** yang presisi.
        
        **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
        - Regulasi Dasar: **{$regulation}**
        - Standar Asesmen: Metode **{$assessmentModel}**
        
        Tugas Anda: Turunkan materi dari RPP terlampir menjadi LKPD yang **OTORITATIF** dan **BERDIFERENSIASI**.
        
        **DATA RPP SUMBER:**
        " . substr($rppContent, 0, 15000) . "

        **ATURAN MAIN (WAJIB):**
        1. **SOURCE OF TRUTH**: DILARANG keras menambah materi di luar RPP kecuali untuk stimulus yang relevan.
        2. **GAMIFIKASI & PERAN:** Mulailah dengan **PENGANTAR YANG MENARIK**. Ajak peserta didik bermain peran (Role Playing).
        3. **AKTIVITAS BERBASIS TABEL & KASUS:**
           - Sajikan **KASUS NYATA** atau **DATA** untuk dianalisis.
           - Gunakan **TABEL KOSONG** untuk ruang jawab siswa agar terstruktur.
        4. **PENTING: FORMAT PENILAIAN / KKTP (Tabel Utuh):**
        Di bagian paling akhir LKPD, Anda WAJIB menyertakan **TABEL UTAMA ASESMEN KKTP**.
        {$studentListText}

        **STRUKTUR LKPD YANG HARUS DIHASILKAN (Gunakan Format Markdown Ini):**

        ### 1. LKPD (LEMBAR KERJA PESERTA DIDIK)
        
        **LKPD - [TOPIK DARI RPP] (KONSISTENSI TP)**
        **PENTING UNTUK AI:** Soal-soal di bawah ini **HARUS** merupakan turunan langsung dari Tujuan Pembelajaran (TP) yang ada di RPP. Setiap aktivitas LKPD adalah sarana latihan untuk mencapai TP tersebut.

        ---
        
        **Identitas Peserta Didik:**
        | Komponen | Keterangan |
        | :--- | :--- |
        | Nama | : _________________________________ |
        | Kelas | : _________________________________ |
        | Tanggal | : _________________________________ |
        
        **Tujuan Pembelajaran:**
        (Tuliskan maksimal 3 tujuan pembelajaran yang akan dicapai peserta didik melalui LKPD ini, harus konsisten dengan RPP, menggunakan bahasa yang mudah dipahami peserta didik).
        
        **Petunjuk Penggunaan:**
        1. Bacalah setiap instruksi dengan cermat sebelum mengerjakan.
        2. Kerjakan secara mandiri atau berkelompok sesuai arahan guru.
        3. Tuliskan jawaban dengan jelas dan lengkap.
        4. Tanyakan kepada guru jika ada yang kurang jelas.
        
        ---
        
        **KEGIATAN 1: MENGAMATI & MEMAHAMI**
        (Berikan stimulus berupa gambar, teks pendek, video, atau fenomena yang relevan dengan materi. Ajukan 3-4 pertanyaan pemantik yang mendorong peserta didik untuk mengamati and memahami konsep dasar).
        
        **Ruang Jawaban:**
        ___________________________________________________________________________
        ___________________________________________________________________________
        
        ---
        
        **KEGIATAN 2: MENGANALISIS & BERDISKUSI**
        (Berikan kasus, masalah, atau data yang perlu dianalisis peserta didik. Ajukan pertanyaan yang mendorong berpikir kritis and diskusi kelompok).
        
        **Ruang Jawaban:**
        ___________________________________________________________________________
        ___________________________________________________________________________
        
        ---
        
        **KEGIATAN 3: MENCOBA & BERKREASI**
        (Berikan tugas praktik, eksperimen sederhana, atau proyek kreatif yang memungkinkan peserta didik menerapkan pemahaman mereka).
        
        **Ruang Jawaban/Hasil Karya:**
        ___________________________________________________________________________
        ___________________________________________________________________________
        
        ---
        
        **REFLEKSI PEMBELAJARAN & PENILAIAN DIRI**
        
        1. Apa hal paling menarik yang kamu pelajari hari ini?
           ___________________________________________________________________________
        2. Apa yang masih sulit kamu pahami?
           ___________________________________________________________________________
        
        **Penilaian Diri:**
        | Aspek | Sudah Paham | Cukup Paham | Perlu Bimbingan |
        | :--- | :---: | :---: | :---: |
        | Saya memahami tujuan pembelajaran | ☐ | ☐ | ☐ |
        | Saya dapat menjelaskan konsep utama | ☐ | ☐ | ☐ |
        | Saya aktif dalam kegiatan | ☐ | ☐ | ☐ |
        
        ---

        **FORMAT PENILAIAN / KKTP (MANDATORY):**
        (Sertakan tabel penilaian sesuai metode {$assessmentModel} yang konsisten dengan Tujuan Pembelajaran).

        **CONSTRAINT:**
        - Output harus **LANGSUNG START** dari Judul LKPD (Markdown).
        - Jangan berikan komentar pembuka atau penutup.
        ";
    }

    protected function extractJson($text)
    {
        if (empty($text) || $text === 'No content generated') {
            return [];
        }

        // Simple JSON extractor
        $text = trim($text);
        
        // Remove markdown code blocks if present
        if (preg_match('/^```(?:json)?\s*([\s\S]*?)\s*```$/i', $text, $matches)) {
            $text = $matches[1];
        } else {
            // Try to find the first { and last }
            $start = strpos($text, '{');
            $end = strrpos($text, '}');
            
            if ($start !== false && $end !== false) {
                $text = substr($text, $start, $end - $start + 1);
            }
        }
        
        $decoded = json_decode($text, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            // Try to fix common truncation issues by adding missing closing braces
            $fixedText = $text;
            $openBraces = substr_count($fixedText, '{');
            $closeBraces = substr_count($fixedText, '}');
            $openBrackets = substr_count($fixedText, '[');
            $closeBrackets = substr_count($fixedText, ']');
            
            for ($i = 0; $i < ($openBrackets - $closeBrackets); $i++) $fixedText .= ']';
            for ($i = 0; $i < ($openBraces - $closeBraces); $i++) $fixedText .= '}';
            
            $decoded = json_decode($fixedText, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }

            Log::error("JSON Decode Error: " . json_last_error_msg(), [
                'error' => json_last_error_msg(),
                'text_preview' => substr($text, 0, 1000),
                'text_length' => strlen($text)
            ]);
            return [];
        }
        
        return $decoded ?? [];
    }

    // Helpers
    protected function getLevel($grade) {
        $g = is_numeric($grade) ? (int)$grade : strtoupper($grade);
        if (in_array($g, [1,2,3,4,5,6])) return 'SD';
        if (in_array($g, [7,8,9])) return 'SMP';
        return 'SMA'; 
    }

    protected function getSubjectKey($subject) {
        if (!$subject) return "";
        
        // Remove suffixes like "(Wajib)", "(Peminatan)", etc.
        $clean = preg_replace('/\s*\(.*?\)\s*/', '', $subject);
        $clean = trim($clean);

        if (str_starts_with($clean, "Bahasa Daerah")) return "Bahasa Daerah";
        
        return $clean;
    }

    protected function getSemesterKey($semester) {
        if (!$semester) return 'ganjil';
        $s = strtolower(trim((string)$semester));
        if ($s === '1' || $s === 'ganjil' || str_contains($s, 'semester 1')) return 'ganjil';
        return 'genap';
    }

    protected function getSemesterLabel($semester) {
        return $this->getSemesterKey($semester) === 'ganjil' ? 'Ganjil' : 'Genap';
    }
    
    protected function formatProfilLulusan($profiles) {
        $output = "";
        foreach ($profiles as $p) {
            if ($p['id'] !== 1) { // Skip Keimanan custom handling if needed, or include all
                $output .= "* **{$p['dimensi']}**: \n";
            }
        }
        return $output;
    }
}
