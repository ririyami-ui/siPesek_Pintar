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
                basePath: subfolder, // Use empty string for root, e.g., "" or "/subfolder"
                apiBaseUrl: origin + subfolder + '/api'
            };
            
            // Set manifest link dynamically
            document.getElementById('manifest-link').href = window.Laravel.baseUrl + '/pwa-manifest.json';
            console.log('Laravel Config (Robust):', window.Laravel);
        </script>

        @viteReactRefresh
        @vite('resources/js/main.jsx')
    </head>
    <body class="antialiased">
        <div id="root"></div>
    </body>
</html>
