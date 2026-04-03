<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\InstallController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Installation Routes
Route::get('/install', [InstallController::class, 'index'])->name('install.index');
Route::post('/install', [InstallController::class, 'postInstall'])->name('install.post');

Route::get('/', function () {
    return view('index');
});

Route::get('/login', function () {
    return view('index');
});

Route::get('/{any?}', function () {
    return view('index');
})->where('any', '^(?!install|login).*$');
