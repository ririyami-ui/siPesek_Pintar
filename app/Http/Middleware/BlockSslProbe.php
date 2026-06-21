<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class BlockSslProbe
{
    /**
     * Handle an incoming request.
     *
     * Block the browsers probing for HTTPS by rejecting early.
     * This middleware prevents "Unsupported SSL request" warnings 
     * when running php artisan serve (HTTP-only).
     */
    public function handle(Request $request, Closure $next)
    {
        // Check if request looks like an SSL probe (CONNECT method 
        // or specific TLS indicator)
        if ($request->method() === 'CONNECT') {
            abort(400, 'Bad Request');
        }
        
        // Check for HTTPS upgrade headers typical of PWA/ServiceWorker probes
        $upgrade = strtolower($request->header('Upgrade', ''));
        $connection = strtolower($request->header('Connection', ''));
        
        if (str_contains($upgrade, 'tls') || 
            str_contains($connection, 'upgrade')) {
            abort(400, 'Bad Request');
        }

        return $next($request);
    }
}
