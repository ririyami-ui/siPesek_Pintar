<?php
$indexPath = __DIR__ . '/resources/json/books/index.json';
$index = json_decode(file_get_contents($indexPath), true);
$found = array_filter($index, function($b) {
    return stripos($b['mapel'], 'Informatika') !== false;
});
echo "Found " . count($found) . " entries for Informatika.\n";
foreach($found as $b) {
    echo $b['mapel'] . " - " . $b['path'] . "\n";
}
