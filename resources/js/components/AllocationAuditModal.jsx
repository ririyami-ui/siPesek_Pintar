import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../lib/axios';
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search,
  BookOpen,
  User,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

export default function AllocationAuditModal({ isOpen, onClose }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedClasses, setExpandedClasses] = useState({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/schedules/allocation-audit');
            setData(response.data);
            
            // Auto-expand classes that have issues
            const initialExpanded = {};
            response.data.forEach(cls => {
                const hasIssues = cls.subjects.some(s => s.status !== 'exact');
                if (hasIssues) initialExpanded[cls.class_id] = true;
            });
            setExpandedClasses(initialExpanded);
        } catch (err) {
            console.error("Error fetching allocation audit:", err);
            setError(err.response?.data?.message || "Gagal memuat audit alokasi.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const toggleClass = (id) => {
        setExpandedClasses(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!isOpen) return null;

    const filteredData = data.filter(cls => 
        cls.rombel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cls.subjects.some(s => s.subject.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const getStatusBadge = (status) => {
        switch (status) {
            case 'undistributed':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase border border-red-100 italic">
                        <AlertCircle size={12} /> Belum Distribusi
                    </div>
                );
            case 'incomplete':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase border border-amber-100">
                        <Clock size={12} /> Belum Lengkap
                    </div>
                );
            case 'overload':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black uppercase border border-purple-100">
                        <AlertTriangle size={12} /> Berlebih
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase border border-emerald-100">
                        <CheckCircle size={12} /> Lengkap
                    </div>
                );
        }
    };

    return (
        <Modal onClose={onClose} size="5xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <BookOpen size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">
                                Audit Distribusi Mapel
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                                Mengecek kesesuaian jam di jadwal dengan JP wajib tiap mata pelajaran.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchData} 
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} className={`text-gray-400 group-hover:text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari kelas atau mata pelajaran..."
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <RefreshCw className="animate-spin text-emerald-500 mb-4" size={40} />
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Menganalisis jadwal...</p>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
                        <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
                        <p className="text-red-600 dark:text-red-400 font-bold">{error}</p>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredData.map((cls) => (
                            <div key={cls.class_id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                <button 
                                    onClick={() => toggleClass(cls.class_id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-black/20 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-black text-gray-500">
                                            {cls.rombel.match(/\d+/)?.[0] || '?'}
                                        </div>
                                        <div className="text-left">
                                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{cls.rombel}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{cls.subjects.length} Mata Pelajaran</p>
                                        </div>
                                    </div>
                                    {expandedClasses[cls.class_id] ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                                </button>
                                
                                {expandedClasses[cls.class_id] && (
                                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="overflow-x-auto rounded-2xl border border-gray-50 dark:border-gray-700">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-black/20 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                        <th className="px-4 py-3">Mapel</th>
                                                        <th className="px-4 py-3">Guru</th>
                                                        <th className="px-4 py-3 text-center">Wajib</th>
                                                        <th className="px-4 py-3 text-center">Jadwal</th>
                                                        <th className="px-4 py-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                                    {cls.subjects.map((sub, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-200">
                                                                {sub.subject}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                                <div className="flex items-center gap-2">
                                                                    <User size={12} className="shrink-0" />
                                                                    <span className="truncate max-w-[150px]">{sub.teacher}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-black text-sm text-gray-400">
                                                                {sub.target} JP
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-black text-sm text-gray-900 dark:text-white">
                                                                {sub.scheduled} JP
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex justify-center">
                                                                    {getStatusBadge(sub.status)}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-6 border-t dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 text-sm"
                    >
                        Tutup Audit
                    </button>
                </div>
            </div>
        </Modal>
    );
}
