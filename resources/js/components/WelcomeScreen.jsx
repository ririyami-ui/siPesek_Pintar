import React, { useState, useEffect } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import api from '../lib/axios';

const WelcomeScreen = () => {
    const [publicSettings, setPublicSettings] = useState(null);
    const [showSchoolName, setShowSchoolName] = useState(false);

    useEffect(() => {
        api.get('/public-settings')
            .then(res => setPublicSettings(res.data))
            .catch(() => {});
        
        // Staggered transition for premium experience
        const timer = setTimeout(() => setShowSchoolName(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const logoSrc = publicSettings?.logo_url || (window.Laravel?.basePath || "") + "/Logo Smart Teaching Baru_.png";

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8f9ff] dark:bg-[#020617] overflow-hidden font-sans">
            {/* Dynamic Premium Aurora Background */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[140px] animate-aurora"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-[140px] animate-aurora" style={{ animationDelay: '-10s' }}></div>
            </div>

            <div className="relative flex flex-col items-center max-w-xl w-full px-8">
                {/* 3D Floating Logo Container with Glassmorphism */}
                <div className="relative mb-16 animate-welcome-float">
                    <div className="absolute inset-8 bg-blue-500/20 blur-[80px] rounded-full scale-125"></div>
                    
                    <div className="relative welcome-glass rounded-[4rem] p-10 overflow-hidden group">
                        <img
                            src={logoSrc}
                            className="w-32 h-32 object-contain relative z-10 animate-welcome-zoom-in"
                            alt="Branding Logo"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = (window.Laravel?.basePath || "") + "/logo.png";
                            }}
                        />
                        {/* Shimmer interaction */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-shimmer"></div>
                    </div>

                    {/* Authentication Badge */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-5 py-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-blue-100/50 dark:border-gray-800/50 flex items-center gap-2.5 animate-fade-in-up-css" style={{ animationDelay: '0.8s' }}>
                        <ShieldCheck size={16} className="text-blue-600" />
                        <span className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-900 dark:text-blue-100">Verified System</span>
                    </div>
                </div>

                {/* Main Branding: Progressive Crossfade */}
                <div className="text-center relative h-48 flex flex-col items-center justify-center w-full">
                    
                    {/* Stage 1: Product Branding (Si Pesek Pintar) */}
                    <div className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) absolute w-full px-6 ${showSchoolName ? 'opacity-0 scale-95 -translate-y-8 blur-md pointer-events-none' : 'opacity-100 scale-100 translate-y-0'}`}>
                        <p className="text-blue-600/50 dark:text-blue-400/40 font-black tracking-[0.4em] uppercase text-[9px] mb-4">Official Product of SMPN 7 Bondowoso</p>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-tight break-words antialiased">
                            Si Pesek <span className="bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent italic">Pintar</span>
                        </h1>
                    </div>
 
                    {/* Stage 2: Entity Branding (School Name) */}
                    <div className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) absolute w-full px-6 ${showSchoolName ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-110 translate-y-8 blur-md pointer-events-none'}`}>
                        <p className="text-indigo-600/50 dark:text-indigo-400/40 font-black tracking-[0.4em] uppercase text-[9px] mb-4">Welcome to Environment of</p>
                        <h1 className="text-lg md:text-2xl font-black tracking-tighter bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-100 bg-clip-text text-transparent leading-tight break-words antialiased px-2">
                            {publicSettings?.school_name || "Si Pesek Pintar"}
                        </h1>
                    </div>
                </div>

                {/* Progress Visualizer */}
                <div className="mt-16 w-64 h-[4px] bg-gray-100 dark:bg-gray-800/40 rounded-full overflow-hidden relative shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-600 to-transparent w-full animate-progress-line"></div>
                </div>
                
                <div className="mt-10 flex items-center gap-3 animate-pulse opacity-50">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.6em]">
                        Finalizing Environment
                    </p>
                </div>
            </div>

            {/* Premium Footnote */}
            <div className="absolute bottom-12 flex flex-col items-center gap-2 opacity-20">
                <div className="w-8 h-[1px] bg-gray-400 mb-2"></div>
                <p className="text-[9px] font-black uppercase tracking-[0.8em] text-gray-600">
                    Smart Teaching Assistant
                </p>
            </div>
        </div>
    );
};

export default WelcomeScreen;
