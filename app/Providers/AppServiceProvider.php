<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return app()->environment('local')
                ? Limit::none()
                : Limit::perMinute(300)->by($request->user()?->id ?: $request->ip());
        });

        if (config('app.env') === 'production' && str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}
