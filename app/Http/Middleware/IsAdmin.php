<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;

class IsAdmin
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // [FIX] Use isAdmin() to recognize both 'admin' and 'adminer' roles consistently
        if (Auth::check() && Auth::user()->isAdmin()) {
            return $next($request);
        }

        return response()->json(['message' => 'Unauthorized. Admin role required.'], 403);
    }
}
