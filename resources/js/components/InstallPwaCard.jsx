import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, ArrowBigDown } from 'lucide-react';

const InstallPwaCard = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            
            // Check if already dismissed in this session
            const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
            if (!isDismissed) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if app is already installed/running in standalone
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setShowPrompt(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-[50] animate-in slide-in-from-bottom-5 duration-500">
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
                        <h3 className="font-bold text-sm">Pasang Aplikasi</h3>
                        <p className="text-xs text-white/80">Pantau belajar anak lebih mudah dari layar utama Anda.</p>
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
                        onClick={handleDismiss}
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
