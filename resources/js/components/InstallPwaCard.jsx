import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ArrowBigDown } from 'lucide-react';

const InstallPwaCard = ({ 
    title = "Pasang Aplikasi", 
    message = "Akses layanan sekolah lebih cepat dan mudah dari layar utama Anda.",
    role = "parent",
    onInstall,
    onDismiss
}) => {
    // If props are provided, use them. Otherwise, use internal logic for standalone use.
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPromptInternal, setShowPromptInternal] = useState(false);

    useEffect(() => {
        if (onInstall) return; // If external handlers are provided, skip internal logic

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
            if (!isDismissed) {
                setShowPromptInternal(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setShowPromptInternal(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [onInstall]);

    const handleInstallClick = async () => {
        if (onInstall) {
            onInstall();
            return;
        }

        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setShowPromptInternal(false);
    };

    const handleDismissClick = () => {
        if (onDismiss) {
            onDismiss();
            return;
        }

        setShowPromptInternal(false);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    // Show if either internal or external state says so
    const isVisible = onInstall ? true : showPromptInternal;

    if (!isVisible) return null;

    // Customize message based on role if default is used
    const displayMessage = message === "Akses layanan sekolah lebih cepat dan mudah dari layar utama Anda." 
        ? (role === 'teacher' 
            ? "Kelola kelas dan interaksi siswa lebih praktis dari layar utama Anda." 
            : (role === 'admin' 
                ? "Pantau sistem sekolah lebih mudah dari layar utama Anda." 
                : "Pantau belajar anak lebih mudah dari layar utama Anda."))
        : message;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[50] animate-in slide-in-from-bottom-5 duration-500 max-w-md mx-auto">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 rounded-2xl shadow-2xl border border-white/20 text-white relative overflow-hidden group">
                {/* Decorative background element */}
                <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Smartphone size={100} />
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                        <Download className="text-white animate-bounce" size={24} />
                    </div>
                    
                    <div className="flex-1">
                        <h3 className="font-bold text-sm">{title}</h3>
                        <p className="text-xs text-white/80">{displayMessage}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={handleInstallClick}
                            className="bg-white text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform"
                        >
                            Pasang
                        </button>
                    </div>

                    <button 
                        onClick={handleDismissClick}
                        className="absolute -top-1 -right-1 p-2 text-white/50 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPwaCard;
