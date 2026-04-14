import React from 'react';
import Modal from './Modal';
import { AlertCircle, User, BookOpen, Users, Brain, Calculator } from 'lucide-react';

export default function SchedulingReportModal({ isOpen, onClose, errors = [], message = '' }) {
    if (!isOpen) return null;

    const isMathError = message.includes('KEGAGALAN MATEMATIS');
    const isConclusion = message.includes('KESIMPULAN ANALISIS');

    return (
        <Modal onClose={onClose} size="3xl">
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl animate-pulse ${isMathError ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {isMathError ? <Calculator size={32} /> : <AlertCircle size={32} />}
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                            {isMathError ? 'Kapasitas Jadwal Terlampaui' : 'Gagal Membuat Jadwal Lengkap'}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                            {isMathError ? 'Terdeteksi masalah data secara matematis.' : 'Sistem menemui konflik yang tidak bisa diselesaikan.'}
                        </p>
                    </div>
                </div>

                {/* Main message block */}
                {message && (
                    <div className={`p-5 rounded-2xl border whitespace-pre-line text-sm leading-relaxed font-medium ${
                        isMathError
                            ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30 text-orange-900 dark:text-orange-200'
                            : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 text-red-900 dark:text-red-200'
                    }`}>
                        {message}
                    </div>
                )}

                {/* Conflict list — only shown if there are specific errors */}
                {errors.length > 0 && (
                    <>
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-4 rounded-2xl flex gap-3">
                            <Brain className="text-amber-600 shrink-0" size={20} />
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                                Daftar berikut menunjukkan blok mengajar yang tidak berhasil ditempatkan setelah seluruh percobaan selesai.
                            </p>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {errors.map((error, idx) => (
                                    <div key={idx} className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-sm">
                                                <BookOpen size={16} />
                                                {error.subject}
                                            </div>
                                            <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg text-gray-500">
                                                {error.size}
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                                                <User size={14} className="text-gray-400" />
                                                {error.teacher}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                                <Users size={14} className="text-gray-400" />
                                                Kelas: {error.class}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700/50">
                                            <p className="text-[10px] text-red-500 font-black flex items-center gap-1 uppercase">
                                                <AlertCircle size={10} /> Tidak menemukan slot kosong
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-xl transition-transform active:scale-95"
                    >
                        Tutup Laporan
                    </button>
                </div>
            </div>
        </Modal>
    );
}
