<?php
$b = json_decode(file_get_contents('resources/json/books/smp/informatika_8.json'), true);
echo isset($b['atp']) ? count($b['atp']) : '0';
