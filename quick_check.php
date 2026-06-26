<?php
$f='f:/app-firebase/sekolahPintar/smart-school-backend/resources/json/books/index.json';
$d=json_decode(file_get_contents($f),1);
echo 'Entries: '.count($d)."\n";
foreach($d as $b) if(stripos($b['mapel'],'Informatika')!==false) echo json_encode($b,JSON_UNESCAPED_UNICODE)."\n";
