import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 left-4 md:left-auto md:w-80 bg-red-500/90 dark:bg-red-600/90 backdrop-blur-xl text-white p-4 rounded-2xl shadow-[0_8px_32px_rgba(239,68,68,0.3)] border border-white/20 flex items-center justify-between z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-full animate-pulse">
          <WifiOff size={20} />
        </div>
        <div>
          <p className="text-xs font-bold leading-none">Sedang Offline</p>
          <p className="text-[10px] opacity-80 mt-1 leading-tight">Data akan otomatis tersinkron saat internet tersedia.</p>
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
