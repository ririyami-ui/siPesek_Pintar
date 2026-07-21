<?php

namespace App\Http\Controllers;

class PingController extends Controller
{
    public function ping()
    {
        header('Content-Type: application/json');
        echo json_encode(['ok' => true]);
        exit;
    }
}
