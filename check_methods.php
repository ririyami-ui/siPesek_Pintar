<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
$methods = get_class_methods(App\Services\AiGeneratorService::class);
print_r($methods);
