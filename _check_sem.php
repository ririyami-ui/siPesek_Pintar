<?php
$path = 'f:/app-firebase/sekolahPintar/smart-school-backend/resources/json/books';
$files = ['indo_7.json', 'ipa_7.json', 'matematika_7.json', 'inggris_7.json'];

foreach ($files as $f) {
    $full = $path . '/smp/' . $f;
    $c = json_decode(file_get_contents($full), true);
    echo $c['title'] . ':' . PHP_EOL;
    foreach ($c['chapters'] as $ch) {
        echo '  Ch ' . $ch['no'] . ': ' . $ch['semester'] . PHP_EOL;
    }
    echo PHP_EOL;
}
