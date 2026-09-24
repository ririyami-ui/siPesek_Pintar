<?php

use App\Http\Middleware\CheckInstallation;
use App\Http\Middleware\Authenticate;
use App\Http\Middleware\IsAdmin;
use App\Http\Middleware\IsLibrarian;
use App\Http\Middleware\RedirectIfAuthenticated;
use App\Http\Middleware\ValidateSignature;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Illuminate\Console\Scheduling\Schedule $schedule): void {
        $schedule->command('library:notify-due-tomorrow')->dailyAt('07:00');
        $schedule->command('reminders:send')->everyMinute();
        $schedule->command('db:backup')->dailyAt('02:00')->withoutOverlapping();
        $schedule->command('tokens:prune-stale')->dailyAt('02:30')->withoutOverlapping();
        $schedule->command('data:prune')->dailyAt('03:00')->withoutOverlapping();
        $schedule->command('reports:send-parent --type=weekly')->weeklyOn(0, '19:00');
        $schedule->command('reports:send-parent --type=monthly')->monthlyOn(1, '07:00');
        $schedule->command('substitution:detect')
            ->twiceDaily(9, 13)
            ->withoutOverlapping()
            ->appendOutputTo(storage_path('logs/substitution-agent.log'));
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->validateCsrfTokens(except: [
            'install',
            'install/*',
        ]);

        $middleware->appendToGroup('web', CheckInstallation::class);

        $middleware->alias([
            'auth' => Authenticate::class,
            'auth.basic' => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
            'auth.session' => \Illuminate\Session\Middleware\AuthenticateSession::class,
            'cache.headers' => \Illuminate\Http\Middleware\SetCacheHeaders::class,
            'can' => \Illuminate\Auth\Middleware\Authorize::class,
            'guest' => RedirectIfAuthenticated::class,
            'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
            'precognitive' => \Illuminate\Foundation\Http\Middleware\HandlePrecognitiveRequests::class,
            'signed' => ValidateSignature::class,
            'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
            'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
            'admin' => IsAdmin::class,
            'librarian' => IsLibrarian::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontFlash([
            'current_password',
            'password',
            'password_confirmation',
        ]);
    })->create();