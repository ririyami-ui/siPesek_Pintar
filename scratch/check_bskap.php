<?php
$path = 'resources/js/utils/bskap_2025_intel.json';
if (!file_exists($path)) {
    die("File not found: $path");
}
$j = json_decode(file_get_contents($path), true);
echo "Textbooks key exists: " . (isset($j['textbooks']) ? "YES" : "NO") . "\n";
if (isset($j['textbooks'])) {
    echo "Levels: " . implode(", ", array_keys($j['textbooks'])) . "\n";
}
