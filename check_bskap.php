<?php
$b = json_decode(file_get_contents('resources/js/utils/bskap_2025_intel.json'), true);
echo json_encode($b['subjects']['SMP']['8']['Informatika'] ?? 'Not found', JSON_PRETTY_PRINT);
