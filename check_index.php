<?php
$f = 'f:/app-firebase/sekolahPintar/smart-school-backend/resources/json/books/index.json';
$c = file_get_contents($f);
$d = json_decode($c, true);
echo "Entries: " . count($d) . "\n";
echo "First 3:\n";
for ($i=0; $i<min(3,count($d)); $i++) {
    echo json_encode($d[$i], JSON_UNESCAPED_UNICODE) . "\n";
}
