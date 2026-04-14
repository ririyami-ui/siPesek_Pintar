import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../lib/axios';
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Calculator, 
  Zap, 
  LayoutList,
  ArrowRight,
  ClipboardCheck,
  Users
} from 'lucide-react';
import AllocationAuditModal from './AllocationAuditModal';
import TeacherWorkloadModal from './TeacherWorkloadModal';

export default function SchedulingSyncModal({ isOpen, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isWorkloadOpen, setIsWorkloadOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/schedules/sync-analysis');
            setData(response.data);
        } catch (err) {
            console.error("Error fetching sync analysis:", err);
            setError(err.response?.data?.message || "Gagal memuat analisis sinkronisasi.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="4xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <Calculator size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                Analisis Keselarasan Sesi
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                                Membandingkan kapasitas templat dengan total jam mengajar per kelas.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchData} 
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={`text-gray-400 group-hover:text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Menghitung data...</p>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
                        <p className="text-red-600 dark:text-red-400 font-bold">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Summary Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Templat Aktif</span>
                                <h4 className="text-lg font-black text-indigo-900 dark:text-white">{data.profile_name}</h4>
                            </div>
                            <div className="p-5 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-1">Kapasitas Sesi / Pekan</span>
                                <h4 className="text-lg font-black text-purple-900 dark:text-white">{data.total_capacity} Jam Pelajaran</h4>
                            </div>
                        </div>

                        {/* Analysis Note */}
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-4 rounded-2xl flex gap-3">
                            <Zap className="text-amber-500 shrink-0" size={20} fill="currentColor" />
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                                Untuk pembuatan jadwal otomatis yang sempurna, nilai <strong>Beban</strong> harus sama dengan <strong>Kapasitas</strong>. 
                                Jika beban lebih besar (Overload), jadwal tidak akan bisa selesai disusun secara lengkap.
                            </p>
                        </div>

                        {/* Table */}
                        <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-black/20 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <th className="px-6 py-4">Kelas</th>
                                            <th className="px-6 py-4">Kapasitas</th>
                                            <th className="px-6 py-4">Beban (Jam)</th>
                                            <th className="px-6 py-4 text-center">Selisih</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                        {data.data.map((item) => (
                                            <tr key={item.class_id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-black text-gray-500">
                                                            {item.rombel.match(/\d+/)?.[0] || '?'}
                                                        </div>
                                                        <span className="font-black text-sm text-gray-700 dark:text-gray-200">{item.rombel}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-sm text-gray-600 dark:text-gray-400">
                                                    {item.capacity}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-sm text-gray-900 dark:text-white">
                                                    {item.burden}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-sm font-black ${
                                                        item.diff === 0 ? 'text-gray-400' : (item.diff > 0 ? 'text-emerald-500' : 'text-red-500')
                                                    }`}>
                                                        {item.diff > 0 ? `+${item.diff}` : item.diff}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        {item.status === 'balanced' ? (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase border border-emerald-100">
                                                                <CheckCircle size={12} /> Serasi
                                                            </div>
                                                        ) : item.status === 'underload' ? (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase border border-amber-100">
                                                                <AlertTriangle size={12} /> Kurang Jam
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase border border-red-100">
                                                                <AlertCircle size={12} /> Overload
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900 text-[11px] p-4 rounded-2xl text-gray-500 italic font-medium">
                            * Jika status <strong>Overload</strong>, silakan kurangi jam pada Master Data Mata Pelajaran untuk kelas tersebut, atau tambah jumlah sesi pada Kelola Template Waktu.
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                    {!loading && data && (
                        <button
                            onClick={() => setIsWorkloadOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 text-sm border border-indigo-100 dark:border-indigo-800/30"
                        >
                            <Users size={18} /> Analisis Beban Guru
                        </button>
                    )}
                    {!loading && data && (
                        <button
                            onClick={() => setIsAuditOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-95 text-sm border border-emerald-100 dark:border-emerald-800/30"
                        >
                            <ClipboardCheck size={18} /> Audit Per Mapel
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-sm"
                    >
                        Tutup Analisis
                    </button>
                </div>
                
                <TeacherWorkloadModal 
                    isOpen={isWorkloadOpen} 
                    onClose={() => setIsWorkloadOpen(false)} 
                />
                
                <AllocationAuditModal 
                    isOpen={isAuditOpen} 
                    onClose={() => setIsAuditOpen(false)} 
                />
            </div>
        </Modal>
    );
}
