<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover">
        <title>{{ config('app.name', 'Smart Data') }}</title>
        
        <!-- PWA Meta Tags -->
        <link rel="manifest" id="manifest-link" href="">
        <meta name="theme-color" content="#047857">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="google" content="notranslate">
        <script>
            // Robust subfolder detection
            const getSubfolder = () => {
                const path = window.location.pathname;
                if (path.includes('/smart-school-backend')) return '/smart-school-backend';
                return '';
            };
            const subfolder = getSubfolder();
            const origin = window.location.origin;
            
            window.Laravel = {
                baseUrl: origin + subfolder,
                basePath: subfolder, 
                apiBaseUrl: subfolder + '/api'
            };
            
            // Set manifest link dynamically
            document.getElementById('manifest-link').href = window.Laravel.baseUrl + '/pwa-manifest.json?v=' + Date.now();
        </script>

        @viteReactRefresh
        @vite('resources/js/main.jsx')
        
        <style>
            /* Shell Splash Screen - Instant Load - Outside Root */
            #pwa-shell-splash {
                position: fixed;
                inset: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #f8f9ff;
                z-index: 10000;
                transition: opacity 0.5s ease-out, visibility 0.5s;
            }
            .dark #pwa-shell-splash {
                background: #020617;
            }
            .splash-logo {
                width: 90px;
                height: 90px;
                margin-bottom: 24px;
                animation: pulse-glow 2s infinite ease-in-out;
            }
            .splash-spinner {
                width: 28px;
                height: 28px;
                border: 2px solid rgba(99, 102, 241, 0.1);
                border-top: 2px solid #6366f1;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse-glow {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.06); opacity: 1; }
            }
            #pwa-shell-splash.hidden {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }
        </style>
    </head>
    <body class="antialiased">
        <!-- Splash Screen OVERLAY (Outside Root for better transition) -->
        <div id="pwa-shell-splash">
            <img src="{{ asset('branding_logo.png') }}" class="splash-logo" alt="Si Pesek Pintar" onerror="this.style.display='none'">
            <div class="splash-spinner"></div>
            <div style="margin-top: 20px; font-family: sans-serif; font-size: 11px; color: #6366f1; letter-spacing: 4px; font-weight: 800; text-transform: uppercase;">Si Pesek Pintar</div>
        </div>

        <div id="root">
            <!-- React will mount here -->
        </div>

        <script>
            // Safety timeout to hide splash screen even if React fails
            setTimeout(() => {
                const splash = document.getElementById('pwa-shell-splash');
                if (splash && !splash.classList.contains('hidden')) {
                    console.log('Splash Screen closed via safety timeout');
                    splash.classList.add('hidden');
                }
            }, 8000);
        </script>
    </body>
</html>
