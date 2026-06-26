<?php

$booksRoot = __DIR__ . '/resources/json/books';
$bskapPath = __DIR__ . '/resources/js/utils/bskap_2025_intel.json';

$bskap = json_decode(file_get_contents($bskapPath), true);
if ($bskap === null) {
    die('BSKAP JSON error: ' . json_last_error_msg());
}

$processed = 0;
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($booksRoot));
foreach ($iterator as $fileInfo) {
    if ($fileInfo->isDir()) continue;
    if ($fileInfo->getExtension() !== 'json') continue;
    if ($fileInfo->getBasename() === 'index.json') continue;

    $book = json_decode(file_get_contents($fileInfo->getPathname()), true);
    if (!$book || !isset($book['chapters'])) continue;

    // Level dari path: /sd/, /smp/, /sma/
    $parentDir = basename(dirname($fileInfo->getPathname()));
    $level = strtoupper($parentDir);
    if (!in_array($level, ['SD', 'SMP', 'SMA'])) continue;

    // Ambil grade dari file: informatika_8.json -> 8
    $filename = $fileInfo->getBasename('.json');
    $parts = explode('_', $filename);
    $grade = end($parts);
    if (!is_numeric($grade)) continue;

    // Cari subject key: coba nama file tanpa _grade, lalu cocokkan dg BSKAP
    $fileStem = substr($filename, 0, -(strlen('_' . $grade)));
    $candidates = [
        strtolower($fileStem),
        ucfirst($fileStem),
        $fileStem,
    ];
    // Map khusus subjek multi-word
    $subjectMap = [
        'mtk' => 'Matematika',
        'mtk_lanjut' => 'Matematika Tingkat Lanjut',
        'inggris' => 'Bahasa Inggris',
        'indo' => 'Bahasa Indonesia',
        'daerah' => 'Bahasa Daerah',
        'pkn' => 'Pendidikan Pancasila',
        'pai' => 'Pendidikan Agama Islam',
        'pjok' => 'PJOK',
        'seni' => 'Seni Rupa',
        'seni_rupa' => 'Seni Rupa',
        'seni_musik' => 'Seni Musik',
        'seni_tari' => 'Seni Tari',
        'seni_teater' => 'Seni Teater',
        'ipa' => 'IPA',
        'ips' => 'IPS',
        'ipas' => 'IPAS',
        'prakarya' => 'Prakarya',
        'sejarah' => 'Sejarah',
        'sosiologi' => 'Sosiologi',
        'ekonomi' => 'Ekonomi',
        'geografi' => 'Geografi',
        'fisika' => 'Fisika',
        'kimia' => 'Kimia',
        'biologi' => 'Biologi',
        'informatika' => 'Informatika',
        'agama_kristen' => 'Pendidikan Agama Kristen',
        'agama_katolik' => 'Pendidikan Agama Katolik',
        'agama_hindu' => 'Pendidikan Agama Hindu',
        'agama_buddha' => 'Pendidikan Agama Buddha',
        'agama_khonghucu' => 'Pendidikan Agama Khonghucu',
        'kepercayaan' => 'Pendidikan Kepercayaan terhadap Tuhan YME',
    ];
    $subject = null;
    if (isset($subjectMap[$fileStem])) {
        $subject = $subjectMap[$fileStem];
    } else {
        // Brute force: coba cari di BSKAP subject keys
        foreach ($bskap['subjects'][$level][$grade] ?? [] as $sk => $sv) {
            if (strpos(strtolower($sk), strtolower($fileStem)) !== false ||
                strpos(strtolower($fileStem), strtolower($sk)) !== false) {
                $subject = $sk;
                break;
            }
        }
    }
    if (!$subject) {
        echo "  SKIP $filename: no subject match for $fileStem\n";
        continue;
    }

    // Pastikan struktur ada
    if (!isset($bskap['subjects'][$level][$grade][$subject])) {
        $bskap['subjects'][$level][$grade][$subject] = [];
    }

    // Inisialisasi semester default
    if (!isset($bskap['subjects'][$level][$grade][$subject]['ganjil'])) {
        $bskap['subjects'][$level][$grade][$subject]['ganjil'] = ['elemen' => [], 'materi_inti' => [], 'cp_snippet' => ''];
    }
    if (!isset($bskap['subjects'][$level][$grade][$subject]['genap'])) {
        $bskap['subjects'][$level][$grade][$subject]['genap'] = ['elemen' => [], 'materi_inti' => [], 'cp_snippet' => ''];
    }

    // Kelompokkan chapter per semester
    $elemenBySem = ['ganjil' => [], 'genap' => []];
    $materiBySem = ['ganjil' => [], 'genap' => []];

    foreach ($book['chapters'] as $ch) {
        $chSem = strtolower($ch['semester'] ?? 'ganjil');
        $chSem = in_array($chSem, ['genap', 'ganjil']) ? $chSem : 'ganjil';
        $title = $ch['title'] ?? '';
        if ($title) {
            $elemenBySem[$chSem][] = $title;
        }
        foreach ($ch['sub_topics'] ?? [] as $st) {
            $materiBySem[$chSem][] = [
                'materi' => $st['name'] ?? '',
                'elemen' => $title,
            ];
        }
    }

    // Tulis ke BSKAP
    foreach (['ganjil', 'genap'] as $sem) {
        $bskap['subjects'][$level][$grade][$subject][$sem]['elemen'] = $elemenBySem[$sem];
        $bskap['subjects'][$level][$grade][$subject][$sem]['materi_inti'] = $materiBySem[$sem];
        // cp_snippet dipertahankan dari buku jika ada
        if (!empty($book['cp_snippet'])) {
            $bskap['subjects'][$level][$grade][$subject][$sem]['cp_snippet'] = $book['cp_snippet'];
        }
    }

    $processed++;
    echo "  OK $level Grade $grade: $subject (dari $filename)\n";
}

// Simpan
file_put_contents($bskapPath, json_encode($bskap, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo "\nSelesai. $processed file buku diproses.\n";
echo "BSKAP diperbarui di: $bskapPath\n";
