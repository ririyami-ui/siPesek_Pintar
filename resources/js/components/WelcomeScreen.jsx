import React from 'react';
import { Sparkles } from 'lucide-react';

const WelcomeScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8f9ff] dark:bg-[#020617] overflow-hidden">
            {/* Premium Aurora Background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-500/20 dark:bg-purple-600/10 rounded-full blur-[120px] animate-aurora"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-blue-500/20 dark:bg-blue-600/10 rounded-full blur-[120px] animate-aurora" style={{ animationDelay: '-5s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-[100px] animate-aurora" style={{ animationDelay: '-10s' }}></div>
            </div>

            <div className="relative flex flex-col items-center">
                {/* 3D Glass Logo Container */}
                <div className="relative mb-10 animate-welcome-zoom-in">
                    <div className="absolute inset-0 bg-purple-500/30 blur-3xl rounded-full scale-110 animate-pulse"></div>
                    <div className="relative p-1 bg-gradient-to-br from-white/80 to-white/20 dark:from-white/10 dark:to-white/5 rounded-[3.5rem] backdrop-blur-2xl shadow-2xl border border-white/50 dark:border-white/10 p-10 welcome-glass animate-welcome-float">
                        <div className="relative z-10">
                            <img
                                src={(window.Laravel?.basePath || "") + "/Logo Smart Teaching Baru_.png"}
                                alt="Si Pesek Pintar Logo"
                                className="w-28 h-28 object-contain filter drop-shadow-2xl"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = (window.Laravel?.basePath || "") + "/logo.png";
                                }}
                            />
                            {/* Decorative Sparkle */}
                            <div className="absolute -top-4 -right-4 p-2.5 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 rounded-2xl shadow-xl border border-white/40 dark:border-white/10 rotate-12 scale-110">
                                <Sparkles size={22} className="text-white animate-pulse" />
                            </div>
                        </div>

                        {/* Internal Glows */}
                        <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-purple-400/20 to-transparent blur-xl rounded-full"></div>
                    </div>
                </div>

                {/* Text Content with Premium Typography */}
                <div className="text-center space-y-3 animate-welcome-zoom-in" style={{ animationDelay: '0.2s' }}>
                    <h1 className="text-5xl font-black tracking-tighter">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-purple-700 to-blue-800 dark:from-white dark:via-purple-300 dark:to-blue-200">
                            Si Pesek Pintar
                        </span>
                    </h1>
                    <div className="flex flex-col items-center">
                        <p className="text-purple-600/70 dark:text-purple-400/60 font-black tracking-[0.3em] uppercase text-[10px]">
                            AI-Powered Professional Assistant
                        </p>

                        {/* Progress Line */}
                        <div className="mt-8 w-48 h-[2px] bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent w-full h-full animate-progress-line"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Build Info Overlay */}
            <div className="absolute bottom-12 text-center animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
                <div className="px-4 py-2 rounded-full bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/5">
                    <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        Initializing Core Engine v2.0.2
                    </p>
                </div>
                <p className="mt-4 text-purple-900/20 dark:text-purple-100/10 text-[9px] font-bold uppercase tracking-[0.5em]">
                    Developed by Deepmind Team
                </p>
            </div>
        </div>
    );
};

export default WelcomeScreen;
