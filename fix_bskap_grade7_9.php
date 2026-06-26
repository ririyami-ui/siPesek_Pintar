<?php
$path = __DIR__.'/resources/js/utils/bskap_2025_intel.json';
$bskap = json_decode(file_get_contents($path), true);
if ($bskap===null) die('BSKAP parse error: '.json_last_error_msg());
foreach ([7,9] as $grade) {
    $bskap['subjects']['SMP'][(string)$grade]['Informatika'] = [
        'ganjil' => [
            'elemen' => [
                'Berpikir Komputasional',
                'Sistem Komputer'
            ],
            'materi_inti' => [
                ['materi'=>'Dekomposisi Masalah Kompleks','elemen'=>'Berpikir Komputasional'],
                ['materi'=>'Perangkat Keras (Hardware)','elemen'=>'Sistem Komputer']
            ],
            'cp_snippet' => ''
        ],
        'genap' => [
            'elemen' => [],
            'materi_inti' => [],
            'cp_snippet' => ''
        ]
    ];
}
file_put_contents($path, json_encode($bskap, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
echo "Grades 7 & 9 updated.\n";
?>
