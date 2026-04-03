import React from 'react';
import { Download, CheckCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AboutPage({ installPrompt, onInstall, isPwaInstalled }) {
  const handleManualInstall = () => {
    if (isPwaInstalled) {
      toast.success('Aplikasi sudah terinstall sebagai PWA!');
      return;
    }

    if (!installPrompt) {
      toast.error('Install prompt tidak tersedia. Pastikan aplikasi belum terinstall dan browser mendukung PWA.');
      return;
    }

    onInstall();
    toast.success('Memulai proses instalasi...');
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* PWA Install Section */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-8 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mb-32 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
              <Smartphone size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Install Aplikasi</h2>
              <p className="text-blue-100">Akses lebih cepat tanpa browser</p>
            </div>
          </div>

          {isPwaInstalled ? (
            <div className="flex items-center gap-3 p-4 bg-green-500/30 backdrop-blur-md rounded-2xl border border-green-300/30">
              <CheckCircle size={24} className="text-green-200" />
              <div>
                <p className="font-bold">Aplikasi Sudah Terinstall</p>
                <p className="text-sm text-green-100">Anda sudah menggunakan versi PWA</p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleManualInstall}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white text-blue-600 font-black rounded-2xl shadow-xl hover:bg-blue-50 transition-all active:scale-95 text-lg"
            >
              <Download size={24} />
              {installPrompt ? 'Install Sekarang' : 'Install Tidak Tersedia'}
            </button>
          )}

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-blue-100">
              <CheckCircle size={16} />
              <span>Akses Offline</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100">
              <CheckCircle size={16} />
              <span>Notifikasi Push</span>
            </div>
            <div className="flex items-center gap-2 text-blue-100">
              <CheckCircle size={16} />
              <span>Lebih Cepat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Original About Content */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 text-text-light dark:text-text-dark">
        <h1 className="text-3xl font-bold text-primary-dark dark:text-primary-light mb-6 text-center">Tentang Aplikasi</h1>

        <div className="flex flex-col items-center mb-8">
          <img
            src={(window.Laravel?.baseUrl || "") + "/logo.png"}
            alt="Si Pesek Pintar Logo"
            className="w-32 h-32 mb-4"
          />
          <p className="text-lg font-semibold">Aplikasi Versi. 2.0.2</p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-text-light dark:text-text-dark mb-2">Pengembang</h2>
          <p className="text-md">Nama: Ririyami, S.Kom</p>
          <p className="text-md">Kabupaten/Kota: Bondowoso</p>
          <p className="text-md">Pekerjaan: Guru Informatika SMP Negeri 7 Bondowoso</p>
          <p className="text-md">CP: 082330108384</p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-text-light dark:text-text-dark mb-2">Deskripsi Aplikasi</h2>
          <p className="text-md">Aplikasi didedikasikan untuk guru hebat Bondowoso, terima kasih untuk semua pihak yang telah memberi masukan dan saran untuk penyempurnaan aplikasi ini.</p>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-text-light dark:text-text-dark mb-4">Dukungan & Bantuan</h2>
          <p className="text-md mb-4">Dukungan dan support anda untuk mempertahankan server bisa ke:</p>
          <img
            src={(window.Laravel?.baseUrl || "") + "/Logo OVO Trans.png"}
            alt="OVO Logo"
            className="w-24 h-auto mx-auto mb-2"
          />
          <p className="text-lg font-bold">OVO Nomor: 082330108384</p>
        </div>
      </div>
    </div>
  );
}