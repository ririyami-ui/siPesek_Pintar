<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instalasi Awal - si Pesek Pintar</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #6366f1;
            --primary-hover: #4f46e5;
        }
        
        body { 
            font-family: 'Plus Jakarta Sans', sans-serif; 
            background: #0f172a;
            overflow-x: hidden;
        }

        .bg-animate {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background: radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
                        radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 1) 0%, rgba(15, 23, 42, 1) 100%);
        }

        .blob {
            position: absolute;
            width: 500px;
            height: 500px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
            filter: blur(80px);
            border-radius: 50%;
            z-index: -1;
            animation: move 25s infinite alternate;
        }

        @keyframes move {
            from { transform: translate(-10%, -10%) rotate(0deg); }
            to { transform: translate(20%, 20%) rotate(360deg); }
        }

        .glass { 
            background: rgba(255, 255, 255, 0.03); 
            backdrop-filter: blur(20px); 
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .input-glass {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .input-glass:focus {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--primary);
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
            box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.4);
            transition: all 0.3s ease;
        }

        .btn-primary:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px -5px rgba(99, 102, 241, 0.5);
            filter: brightness(1.1);
        }

        .btn-primary:active:not(:disabled) {
            transform: translateY(0);
        }

        .step-number {
            background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 md:p-8">
    <div class="bg-animate"></div>
    <div class="blob" style="top: -100px; left: -100px;"></div>
    <div class="blob" style="bottom: -100px; right: -100px; animation-delay: -5s;"></div>

    <div class="max-w-2xl w-full relative">
        <div class="text-center mb-12 animate-in fade-in slide-in-from-top duration-1000">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/5 border border-white/10 mb-6 backdrop-blur-xl shadow-2xl">
                <svg class="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                </svg>
            </div>
            <h1 class="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">Instalasi Awal</h1>
            <p class="text-slate-400 text-lg font-medium px-4">si Pesek Pintar <span class="text-slate-600 mx-2">•</span> Sistem Pengelolaan Sekolah Pint</p>
        </div>

        <form id="installForm" class="glass rounded-[3rem] p-8 md:p-12 space-y-10 relative overflow-hidden animate-in fade-in zoom-in duration-700">
            @csrf
            
            @if(session('db_error'))
            <div class="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3">
                <svg class="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                    <h4 class="text-rose-400 font-bold text-sm">Kesalahan Koneksi Database</h4>
                    <p class="text-rose-400/70 text-xs mt-1 leading-relaxed">{{ session('db_error') }}</p>
                    <p class="text-slate-500 text-[10px] mt-2 italic">Sistem mencoba menghubungkan kembali namun gagal. Pastikan konfigurasi di bawah sudah benar.</p>
                </div>
            </div>
            @endif

            <!-- Step 1: Database -->
            <div class="space-y-8">
                <div class="flex items-center gap-4">
                    <div class="step-number w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold text-lg">1</div>
                    <div>
                        <h3 class="text-xl font-bold text-white">Konfigurasi Database</h3>
                        <p class="text-slate-500 text-sm">Hubungkan sistem dengan database MySQL Anda</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Host</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </span>
                            <input type="text" name="db_host" value="localhost" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="localhost">
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Port</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                            </span>
                            <input type="text" name="db_port" value="3306" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="3306">
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Database</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                            </span>
                            <input type="text" name="db_name" value="smart_school_db" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="nama_database">
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Username</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            </span>
                            <input type="text" name="db_user" value="root" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="root">
                        </div>
                    </div>
                    <div class="space-y-2 md:col-span-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            </span>
                            <input type="password" name="db_password" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="••••••••">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Step 2: Admin -->
            <div class="space-y-8 pt-8 border-t border-white/5">
                <div class="flex items-center gap-4">
                    <div class="step-number w-10 h-10 rounded-2xl text-white flex items-center justify-center font-bold text-lg">2</div>
                    <div>
                        <h3 class="text-xl font-bold text-white">Akun Administrator</h3>
                        <p class="text-slate-500 text-sm">Atur kredensial akses utama untuk panel admin</p>
                    </div>
                </div>

                <div class="space-y-5">
                    <div class="space-y-2">
                        <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Nama Lengkap</label>
                        <div class="relative group">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path></svg>
                            </span>
                            <input type="text" name="admin_name" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="Nama Anda" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="space-y-2">
                            <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Email</label>
                            <div class="relative group">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                </span>
                                <input type="email" name="admin_email" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="admin@sekolah.id" required>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Password</label>
                            <div class="relative group">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                                </span>
                                <input type="password" name="admin_password" class="input-glass w-full pl-12 pr-5 py-4 rounded-2xl outline-none font-medium" placeholder="Minimal 8 karakter" required minlength="8">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button type="submit" id="submitBtn" class="btn-primary w-full py-5 text-white font-bold rounded-[2rem] flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                <span id="btnText" class="tracking-wide">INSTAL SEKARANG</span>
                <svg id="loadingIcon" class="hidden animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </button>
        </form>

        <!-- Result Box -->
        <div id="resultBox" class="hidden glass rounded-[3rem] p-12 text-center animate-in fade-in zoom-in duration-700 relative overflow-hidden">
            <div id="iconBox" class="w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative z-10"></div>
            <h2 id="resultTitle" class="text-3xl font-bold mb-4 tracking-tight relative z-10"></h2>
            <p id="resultMessage" class="text-slate-400 text-lg mb-10 leading-relaxed max-w-md mx-auto relative z-10"></p>
            <div class="relative z-10 flex flex-col gap-4">
                <a id="redirectBtn" href="/" class="hidden btn-primary px-10 py-5 text-white font-bold rounded-[2rem] inline-block shadow-2xl">
                    MASUK KE DASHBOARD
                </a>
                <button id="retryBtn" class="hidden text-slate-500 hover:text-white font-bold py-2 transition-colors">
                    Coba Lagi
                </button>
            </div>
            <!-- Decorative circle behind icon -->
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[80px] -z-0"></div>
        </div>
    </div>

    <script>
        document.getElementById('installForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const loading = document.getElementById('loadingIcon');
            const form = e.target;
            const resultBox = document.getElementById('resultBox');
            const iconBox = document.getElementById('iconBox');
            const resultTitle = document.getElementById('resultTitle');
            const resultMessage = document.getElementById('resultMessage');
            const redirectBtn = document.getElementById('redirectBtn');
            const retryBtn = document.getElementById('retryBtn');

            btn.disabled = true;
            btnText.innerText = 'MENYIAPKAN SISTEM...';
            loading.classList.remove('hidden');

            const formData = new FormData(form);

            try {
                const response = await fetch('/install', {
                    method: 'POST',
                    body: formData,
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                const data = await response.json();
                
                // Wait a bit for dramatic effect
                await new Promise(r => setTimeout(r, 1000));

                form.classList.add('hidden');
                resultBox.classList.remove('hidden');

                if (data.success) {
                    iconBox.className = 'w-24 h-24 mx-auto rounded-[2rem] bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-8 border border-emerald-500/30';
                    iconBox.innerHTML = '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';
                    resultTitle.className = 'text-3xl font-bold mb-4 text-white';
                    resultTitle.innerText = 'Instalasi Berhasil!';
                    resultMessage.innerText = 'Sistem telah siap digunakan. Akun Administrator Anda telah aktif.';
                    redirectBtn.classList.remove('hidden');
                    retryBtn.classList.add('hidden');
                } else {
                    iconBox.className = 'w-24 h-24 mx-auto rounded-[2rem] bg-rose-500/20 text-rose-400 flex items-center justify-center mb-8 border border-rose-500/30';
                    iconBox.innerHTML = '<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>';
                    resultTitle.className = 'text-3xl font-bold mb-4 text-white';
                    resultTitle.innerText = 'Instalasi Terhambat';
                    resultMessage.innerText = data.message;
                    redirectBtn.classList.add('hidden');
                    retryBtn.classList.remove('hidden');
                }
            } catch (error) {
                console.error(error);
                alert('Koneksi terputus. Pastikan server lokal Anda aktif.');
                btn.disabled = false;
                btnText.innerText = 'INSTAL SEKARANG';
                loading.classList.add('hidden');
            }
        });

        document.getElementById('retryBtn').addEventListener('click', () => {
            document.getElementById('resultBox').classList.add('hidden');
            document.getElementById('installForm').classList.remove('hidden');
            const btn = document.getElementById('submitBtn');
            btn.disabled = false;
            document.getElementById('btnText').innerText = 'INSTAL SEKARANG';
            document.getElementById('loadingIcon').classList.add('hidden');
        });
    </script>
</body>
</html>