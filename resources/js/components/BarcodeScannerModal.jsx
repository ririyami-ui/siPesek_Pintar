import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from './Modal';
import { Camera, RefreshCw } from 'lucide-react';

const BarcodeScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
    const [cameras, setCameras] = useState([]);
    const [activeCameraId, setActiveCameraId] = useState('');
    const [scanner, setScanner] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            stopScanner();
            return;
        }

        // Try to start scanning automatically
        startScanning();
    }, [isOpen]);

    const stopScanner = async () => {
        if (scanner) {
            try {
                if (isScanning) await scanner.stop();
                setScanner(null);
                setIsScanning(false);
            } catch (err) {
                console.error("Error stopping scanner", err);
            }
        }
    };

    const startScanning = async (cameraIndex = 0) => {
        setIsLoading(true);
        setError('');
        
        try {
            await stopScanner();
            
            const html5QrCode = new Html5Qrcode("reader");
            setScanner(html5QrCode);

            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 120 },
                aspectRatio: 1.0
            };

            const devices = await Html5Qrcode.getCameras();
            setAvailableCameras(devices);

            if (devices && devices.length > 0) {
                // If we have specific cameras, use the one at cameraIndex
                const targetCameraId = devices[cameraIndex % devices.length].id;
                await html5QrCode.start(
                    targetCameraId, 
                    config, 
                    (decodedText) => {
                        html5QrCode.stop().then(() => {
                            setIsScanning(false);
                            onScanSuccess(decodedText);
                            onClose();
                        });
                    },
                    () => {} 
                );
            } else {
                // Fallback to environment facing mode
                await html5QrCode.start(
                    { facingMode: "environment" }, 
                    config, 
                    (decodedText) => {
                        html5QrCode.stop().then(() => {
                            setIsScanning(false);
                            onScanSuccess(decodedText);
                            onClose();
                        });
                    },
                    () => {}
                );
            }
            
            setIsScanning(true);
        } catch (err) {
            console.error("Camera access failed", err);
            handleCameraError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const switchCamera = () => {
        const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
        setCurrentCameraIndex(nextIndex);
        startScanning(nextIndex);
    };

    const handleCameraError = (err) => {
        const errMsg = err.toString().toLowerCase();
        if (errMsg.includes("notallowederror") || errMsg.includes("permission denied")) {
            setError("Izin kamera ditolak. Silakan aktifkan izin kamera di pengaturan browser Anda.");
        } else if (errMsg.includes("notreadableerror") || errMsg.includes("concurrently")) {
            setError("Kamera sedang digunakan atau tidak tersedia. Coba tutup aplikasi lain.");
        } else {
            setError("Kamera tidak dapat diakses. Pastikan menggunakan HTTPS.");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="md" zIndex="z-[70]" position="top">
            <div className="p-4 sm:p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Camera size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Scan Barcode</h2>
                    {availableCameras.length > 1 && isScanning && (
                        <button 
                            onClick={switchCamera}
                            className="ml-auto p-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-primary hover:text-white transition-all"
                            title="Tukar Kamera"
                        >
                            <RefreshCw size={20} />
                        </button>
                    )}
                </div>

                <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-black border-4 border-gray-100 dark:border-gray-800 shadow-inner min-h-[250px] flex items-center justify-center">
                    <div id="reader" className="w-full"></div>
                    
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-20">
                            <RefreshCw size={32} className="animate-spin mb-2" />
                            <p className="text-xs">Menghubungkan Kamera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 text-white p-6 z-20">
                            <p className="text-sm mb-6 text-red-400">{error}</p>
                            <button 
                                onClick={startScanning}
                                className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-2xl text-sm font-bold transition-all border border-white/20"
                            >
                                Aktifkan Kamera
                            </button>
                        </div>
                    )}

                    {/* Targeting Box Overlay */}
                    {isScanning && !error && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                            <div className="w-64 h-24 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-lg"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-lg"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-lg"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-lg"></div>
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50 -translate-y-1/2 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                            </div>
                        </div>
                    )}
                </div>
                
                {!error && !isLoading && (
                    <p className="mt-6 text-sm text-gray-500 font-medium">
                        Arahkan kamera ke barcode buku.
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default BarcodeScannerModal;
