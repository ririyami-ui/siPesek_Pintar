<?php
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$booksDir = __DIR__ . '/resources/json/books';
$indexFile = $booksDir . '/index.json';

// Mapping filename prefix → subject name (include extra prefixes)
$subjectMap = [
    // SD
    'daerah'          => 'Bahasa Daerah',
    'indo'            => 'Bahasa Indonesia',
    'inggris'         => 'Bahasa Inggris',
    'matematika'      => 'Matematika',
    'pai'             => 'Pendidikan Agama Islam',
    'pkn'             => 'Pendidikan Pancasila',
    'pjok'            => 'PJOK',
    'prakarya'        => 'Prakarya',
    'ipas'            => 'IPAS',
    // SMP – same prefixes as SD plus additional
    // plus custom ones that appear in filenames
    'informatika'     => 'Informatika',
    'seni_musik'      => 'Seni Musik',
    'seni_rupa'       => 'Seni Rupa',
    'seni_tari'       => 'Seni Tari',
    'seni_teater'     => 'Seni Teater',
    // SMA – include advanced maths
    'mtk_lanjut'      => 'Matematika Lanjut',
    // other subjects already covered by SD prefixes will work for SMP/SMA
];

$jenjangNames = ['sd' => 'SD', 'smp' => 'SMP', 'sma' => 'SMA'];
$roman = [1=>'I',2=>'II',3=>'III',4=>'IV',5=>'V',6=>'VI',7=>'VII',8=>'VIII',9=>'IX',10=>'X',11=>'XI',12=>'XII'];

$entries = [];
foreach (['sd','smp','sma'] as $jenjangDir) {
    $dirPath = "$booksDir/$jenjangDir";
    if (!is_dir($dirPath)) continue;
    foreach (scandir($dirPath) as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) !== 'json') continue;
        $relPath = "$jenjangDir/$file";
        $basename = pathinfo($file, PATHINFO_FILENAME);
        $parts = explode('_', $basename);
        $kelasPart = array_pop($parts);
        if (!ctype_digit($kelasPart)) continue;
        $kelas = (int)$kelasPart;
        $prefix = implode('_', $parts);
        $mapel = $subjectMap[$prefix] ?? null;
        if (!$mapel) {
            // Try to guess by capitalizing prefix (fallback)
            $mapel = ucwords(str_replace('_', ' ', $prefix));
        }
        $jenjang = $jenjangNames[$jenjangDir] ?? strtoupper($jenjangDir);
        $id = strtolower($jenjangDir . '-' . $prefix . '-' . $kelas);
        $title = "$mapel Kelas " . ($roman[$kelas] ?? $kelas) . " (Kurikulum Merdeka)";
        $entries[] = [
            'id'      => $id,
            'jenjang' => $jenjang,
            'mapel'   => $mapel,
            'kelas'   => (string)$kelas,
            'title'   => $title,
            'path'    => $relPath,
        ];
    }
}

// Write pretty JSON (UTF-8)
file_put_contents($indexFile, json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Rebuilt index with " . count($entries) . " entries.\n";

// Verify Informatika entries
foreach ($entries as $e) {
    if (stripos($e['mapel'], 'Informatika') !== false) {
        echo "Informatika entry: " . json_encode($e, JSON_UNESCAPED_UNICODE) . "\n";
    }
}
