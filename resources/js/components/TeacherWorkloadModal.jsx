import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../lib/axios';
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  Users,
  User,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  BarChart3,
  TrendingDown
} from 'lucide-react';

export default function TeacherWorkloadModal({ isOpen, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedTeachers, setExpandedTeachers] = useState({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/schedules/teacher-workload');
            setData(response.data);
            
            // Auto-expand teachers with critical load
            const initialExpanded = {};
            response.data.teachers.forEach(t => {
                if (t.status === 'critical') initialExpanded[t.id] = true;
            });
            setExpandedTeachers(initialExpanded);
        } catch (err) {
            console.error("Error fetching teacher workload:", err);
            setError(err.response?.data?.message || "Gagal memuat beban kerja guru.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const toggleTeacher = (id) => {
        setExpandedTeachers(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!isOpen) return null;

    const filteredTeachers = data?.teachers.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getStatusInfo = (status, saturation) => {
        switch (status) {
            case 'critical':
                return {
                    label: 'Kritis (Overload)',
                    color: 'text-red-600 bg-red-50 border-red-100',
                    bar: 'bg-red-500',
                    icon: <AlertCircle size={14} />
                };
            case 'high':
                return {
                    label: 'Beban Tinggi',
                    color: 'text-amber-600 bg-amber-50 border-amber-100',
                    bar: 'bg-amber-500',
                    icon: <AlertTriangle size={14} />
                };
            case 'underload':
                return {
                    label: 'Kurang Jam',
                    color: 'text-blue-600 bg-blue-50 border-blue-100',
                    bar: 'bg-blue-400',
                    icon: <TrendingDown size={14} />
                };
            default:
                return {
                    label: 'Sehat',
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                    bar: 'bg-emerald-500',
                    icon: <CheckCircle size={14} />
                };
        }
    };

    return (
        <Modal onClose={onClose} size="5xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <Users size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                Monitoring Beban Guru
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                                Analisis kejenuhan guru berdasarkan total JP yang diampu.
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

                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Templat Aktif</span>
                            <h4 className="font-black text-gray-700 dark:text-white">{data.profile_name}</h4>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Kapasitas Maks</span>
                            <h4 className="font-black text-gray-700 dark:text-white">{data.capacity} JP / Pekan</h4>
                        </div>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/20">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Total Guru Teranalisis</span>
                            <h4 className="font-black text-indigo-900 dark:text-white">{data.teachers.length} Orang</h4>
                        </div>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari nama guru..."
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Menghitung beban kerja...</p>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
                        <p className="text-red-600 dark:text-red-400 font-bold">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredTeachers.map((t) => {
                            const statusInfo = getStatusInfo(t.status, t.saturation);
                            return (
                                <div key={t.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                    <div className="p-4">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-[300px]">
                                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-indigo-500">
                                                    <User size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-gray-900 dark:text-white leading-tight uppercase">{t.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${statusInfo.color}`}>
                                                            {statusInfo.icon} {statusInfo.label}
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 font-bold uppercase">{t.total_hours} / {t.capacity} JP</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                    <span>Saturasi</span>
                                                    <span className={t.saturation > 85 ? 'text-red-500' : ''}>{t.saturation}%</span>
                                                </div>
                                                <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 ${statusInfo.bar}`}
                                                        style={{ width: `${Math.min(t.saturation, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => toggleTeacher(t.id)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors shrink-0"
                                            >
                                                {expandedTeachers[t.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </button>
                                        </div>

                                        {expandedTeachers[t.id] && (
                                            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 animate-in slide-in-from-top-2 duration-300">
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <BarChart3 size={12} /> Detil Penugasan
                                                </h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {t.assignments.map((as, idx) => (
                                                        <div key={idx} className="p-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/30 transition-colors">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-xs font-black text-gray-900 dark:text-white uppercase">{as.class}</span>
                                                                <span className="text-[10px] font-black bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700 text-gray-500">
                                                                    {as.hours} JP
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{as.subject}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-sm"
                    >
                        Tutup Monitoring
                    </button>
                </div>
            </div>
        </Modal>
    );
}
