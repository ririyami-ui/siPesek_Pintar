<?php
try {
    $pdo = new PDO('mysql:host=localhost;port=3306;dbname=pesek', 'root', '');
    echo 'OK - connected to pesek';
} catch(Exception $e) {
    echo 'FAIL: ' . $e->getMessage();
}
