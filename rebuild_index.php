<?php
/**
 * Auto-generate missing book index entries.
 * Reads all JSON book files on disk, maps filename to subject name,
 * adds entry to index.json if missing.
 */

$indexFile = __DIR__ . '/resources/json/books/index.json';
$booksDir  = __DIR__ . '/resources/json/books';

// --- Mapping filename prefix → subject name ---
$subjectMap = [
    // SMP
    'informatika'     => 'Informatika',
    'indo'            => 'Bahasa Indonesia',
    'inggris'         => 'Bahasa Inggris',
    'ipa'             => 'IPA',
    'ips'             => 'IPS',
    'matematika'      => 'Matematika',
    'pkn'             => 'Pendidikan Pancasila',
    'pai'             => 'Pendidikan Agama Islam',
    'pjok'            => 'PJOK',
    'prakarya'        => 'Prakarya',
    'daerah'          => 'Bahasa Daerah',
    'seni_musik'      => 'Seni Musik',
    'seni_rupa'       => 'Seni Rupa',
    'seni_tari'       => 'Seni Tari',
    'seni_teater'     => 'Seni Teater',
    'agama_buddha'    => 'Pendidikan Agama Buddha',
    'agama_hindu'     => 'Pendidikan Agama Hindu',
    'agama_katolik'   => 'Pendidikan Agama Katolik',
    'agama_kristen'   => 'Pendidikan Agama Kristen',
    'agama_khonghucu' => 'Pendidikan Agama Khonghucu',
    // SMA
    'biologi'         => 'Biologi',
    'fisika'          => 'Fisika',
    'kimia'           => 'Kimia',
    'sejarah'         => 'Sejarah',
    'sosiologi'       => 'Sosiologi',
    'ekonomi'         => 'Ekonomi',
    'geografi'        => 'Geografi',
];

// --- Load existing index ---
$currentIndex = json_decode(file_get_contents($indexFile), true) ?: [];
$indexedPaths = [];
foreach ($currentIndex as $entry) {
    $indexedPaths[$entry['path']] = true;
}

// --- Jenjang name mapping ---
$jenjangNames = ['sd' => 'SD', 'smp' => 'SMP', 'sma' => 'SMA'];

// --- Scan disk ---
$newEntries = [];
$counter = 0;

foreach (['sd', 'smp', 'sma'] as $jenjangDir) {
    $dirPath = "$booksDir/$jenjangDir";
    if (!is_dir($dirPath)) continue;

    foreach (scandir($dirPath) as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) !== 'json') continue;
        $relPath = "$jenjangDir/$file";

        // Skip if already indexed
        if (isset($indexedPaths[$relPath])) continue;

        // Parse filename: prefix_KELAS.json or prefix_subprefix_KELAS.json
        $basename = pathinfo($file, PATHINFO_FILENAME);
        // Try to extract kelas (last segment after underscore that's a number)
        $parts = explode('_', $basename);
        $kelas = array_pop($parts);
        if (!is_numeric($kelas)) continue; // can't determine grade

        $prefix = implode('_', $parts);
        $mapel = $subjectMap[$prefix] ?? null;
        if (!$mapel) {
            echo "WARN: Unknown subject prefix '$prefix' for $file, skipping\n";
            continue;
        }

        $jenjang = $jenjangNames[$jenjangDir] ?? strtoupper($jenjangDir);
        $roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        $kelasRoman = $roman[(int)$kelas - 1] ?? $kelas;

        $id = strtolower($jenjangDir . '-' . $prefix . '-' . $kelas);
        $title = "$mapel Kelas $kelasRoman (Kurikulum Merdeka)";

        $newEntries[] = [
            'id'      => $id,
            'jenjang' => $jenjang,
            'mapel'   => $mapel,
            'kelas'   => (string)$kelas,
            'title'   => $title,
            'path'    => $relPath,
        ];
        $counter++;
    }
}

// --- Append new entries to index ---
$updatedIndex = array_merge($currentIndex, $newEntries);

// Sort by jenjang, then by kelas, then by mapel
usort($updatedIndex, function($a, $b) {
    $order = ['SD' => 0, 'SMP' => 1, 'SMA' => 2];
    $ao = $order[$a['jenjang']] ?? 99;
    $bo = $order[$b['jenjang']] ?? 99;
    if ($ao !== $bo) return $ao - $bo;
    if ($a['kelas'] !== $b['kelas']) return (int)$a['kelas'] - (int)$b['kelas'];
    return strcmp($a['mapel'], $b['mapel']);
});

// Write back with pretty print
file_put_contents($indexFile, json_encode($updatedIndex, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "=== DONE ===\n";
echo "Existing entries: " . count($currentIndex) . "\n";
echo "New entries added: $counter\n";
echo "Total entries: " . count($updatedIndex) . "\n";

if ($counter > 0) {
    echo "\n--- New entries added ---\n";
    foreach ($newEntries as $e) {
        echo "  [{$e['jenjang']}] {$e['mapel']} kelas {$e['kelas']} → {$e['path']}\n";
    }
}
