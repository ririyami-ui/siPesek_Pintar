<?php
$content = shell_exec('git -C f:/app-firebase/sekolahPintar/smart-school-backend show c06f1c2:resources/json/books/index.json');
if ($content) {
    $bytes = file_put_contents('f:/app-firebase/sekolahPintar/smart-school-backend/resources/json/books/index.json', $content);
    echo "Wrote $bytes bytes\n";
    // verify
    $check = json_decode($content, true);
    if ($check) {
        echo "Valid JSON, entries: " . count($check) . "\n";
        foreach ($check as $b) {
            if (stripos($b['mapel'], 'Informatika') !== false) {
                echo "Informatika entry: " . json_encode($b, JSON_UNESCAPED_UNICODE) . "\n";
            }
        }
    } else {
        echo "JSON error: " . json_last_error_msg() . "\n";
    }
} else {
    echo "Failed to get git content\n";
}
