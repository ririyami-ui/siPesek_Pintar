<?php
$c = file_get_contents('resources/json/books/index.json');
echo 'BOM: ' . bin2hex(substr($c, 0, 3)) . PHP_EOL;
$c = preg_replace('/^\xEF\xBB\xBF/', '', $c);
$d = json_decode($c, true);
if ($d === null) {
    echo 'JSON ERR: ' . json_last_error_msg() . PHP_EOL;
} else {
    echo 'OK count=' . count($d) . PHP_EOL;
    foreach ($d as $b) {
        if (strpos($b['path'], 'info') !== false) {
            echo json_encode($b) . PHP_EOL;
        }
    }
}
