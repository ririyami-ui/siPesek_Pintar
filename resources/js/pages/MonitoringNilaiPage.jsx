import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Clock, 
    Search, 
    Loader2, 
    GraduationCap, 
    ChevronRight, 
    AlertCircle, 
    CheckCircle2,
    TrendingUp,
    BarChart3,
    ArrowUpRight
} from 'lucide-react';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';
import RunningText from '../components/RunningText';

const ClassMonitorCard = ({ item, navigate }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const subjects = item?.subjects || [];
    const activeSubject = subjects[activeIndex] || null;

    useEffect(() => {
        if (subjects.length <= 1) return;
        
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % subjects.length);
        }, 5000); // 5-second rotation

        return () => clearInterval(interval);
    }, [subjects.length]);

    return (
        <div className="group relative bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col h-[420px]">
            {/* Header: Class Name & Global Score */}
            <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
                        <span className="text-xl font-black italic tracking-tighter">{item?.rombel?.substring(0, 2) || '?'}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tighter leading-tight">{item?.rombel || 'CLASS'}</h3>
                        <p className="text-[8px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1">Monitor Unit</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600 block leading-none">{item?.average_score || '0'}</span>
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Rerata</span>
                </div>
            </div>

            {/* Main Display: Rotating Subject Info */}
            <div className="flex-1 px-6 py-4 flex flex-col justify-center relative overflow-hidden bg-white dark:bg-gray-900">
                <div key={activeIndex} className="animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col items-center text-center">
                        <div className={`mb-3 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ${activeSubject?.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {activeSubject?.is_completed ? 'Status: Complete' : 'Status: Incomplete'}
                        </div>
                        
                        <h4 className="text-xl font-black text-gray-800 dark:text-white tracking-tight mb-1 line-clamp-2 min-h-[3rem] flex items-center justify-center leading-tight">
                            {activeSubject?.subject_name || 'No Subjects'}
                        </h4>
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-6 italic line-clamp-1 h-4 uppercase tracking-tighter">
                            {activeSubject?.teacher_name || '-'}
                        </p>

                        <div className="grid grid-cols-2 gap-4 w-full mb-2">
                            <div className="text-center p-3 rounded-[1.5rem] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 transition-all">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Rerata</p>
                                <p className={`text-xl font-black ${activeSubject?.is_completed ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {activeSubject?.average_score || '0'}
                                </p>
                            </div>
                            <div className="text-center p-3 rounded-[1.5rem] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 transition-all">
                                <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Progres</p>
                                <p className="text-xl font-black text-indigo-600">
                                    {activeSubject?.total_students > 0 ? Math.round((activeSubject?.completion_count / activeSubject?.total_students) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar for the 5s interval */}
                <div className="absolute left-0 bottom-0 h-1 bg-indigo-600/10 w-full overflow-hidden">
                    {subjects.length > 1 && (
                        <div 
                            key={activeIndex}
                            className="h-full bg-indigo-600"
                            style={{ width: '100%', animation: 'timer-bar 5s linear forwards' }}
                        />
                    )}
                </div>
            </div>

            {/* Bottom Section: Indicators */}
            <div className="p-6 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-2 justify-center">
                    {subjects.map((sub, idx) => (
                        <div 
                            key={idx}
                            title={`${sub.subject_name} (${sub.teacher_name})`}
                            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 relative ${
                                idx === activeIndex 
                                    ? 'ring-4 ring-indigo-500/30 scale-125 z-20 shadow-lg' 
                                    : 'opacity-50 hover:opacity-100'
                            } ${
                                sub.is_completed 
                                    ? 'bg-emerald-500' 
                                    : sub.completion_count > 0 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                        >
                            {idx === activeIndex && (
                                <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
                            )}
                        </div>
                    ))}
                </div>
                <div className="mt-4 flex flex-col items-center">
                    <button 
                        onClick={() => navigate(`/rekapitulasi?classId=${item.id}`)}
                        className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 tracking-[0.2em] bg-indigo-50 dark:bg-indigo-900/40 px-4 py-2 rounded-xl transition-all active:scale-95 border border-indigo-100 dark:border-indigo-800"
                    >
                        Access Monitor Details →
                    </button>
                </div>
            </div>
        </div>
    );
};

const MonitoringNilaiPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [stats, setStats] = useState({
        total_classes: 0,
        avg_school_score: 0,
        avg_completion: 0
    });
    const [searchTerm, setSearchTerm] = useState('');
    const { activeSemester, academicYear } = useSettings();
    const [currentTime, setCurrentTime] = useState(moment());

    const fetchData = async () => {
        try {
            const response = await api.get('/admin/grades/monitoring', {
                params: {
                    semester: activeSemester,
                    academic_year: academicYear
                }
            });
            setData(response.data.data || []);
            setStats(response.data.stats || {
                total_classes: 0,
                avg_school_score: 0,
                avg_completion: 0
            });
        } catch (error) {
            console.error('Error fetching grade monitoring data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 300000); // 5 minutes refresh
        const timer = setInterval(() => setCurrentTime(moment()), 1000);
        return () => {
            clearInterval(interval);
            clearInterval(timer);
        };
    }, [activeSemester, academicYear]);

    const filteredData = data.filter(item => 
        (item?.rombel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item?.subjects || []).some(sub => 
            (sub?.subject_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (sub?.teacher_name || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    if (loading && data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="animate-spin text-purple-600 mb-4" size={40} />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Initializing CCTV Units...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2 lg:p-4 animate-fade-in bg-gray-50/30 dark:bg-transparent min-h-screen pb-20">
            {/* Legend / CCTV Info Bar */}
            <div className="relative z-30 flex flex-wrap items-center justify-center gap-6 px-6 py-3 bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-full border border-white/20 dark:border-gray-800/40 text-[9px] font-black uppercase tracking-widest text-gray-500 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span>Mapel Tuntas</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                    <span>Proses Input</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
                    <span>Belum Input</span>
                </div>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-700 mx-2" />
                <div className="flex items-center gap-2">
                    <Clock size={12} />
                    <span>Auto-Rotation: 5s</span>
                </div>
            </div>

            {/* Header Section */}
            <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 dark:border-gray-800/40 shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <BarChart3 size={120} />
                </div>
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className="p-5 rounded-[2rem] bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-2xl shadow-purple-500/40 transform -rotate-3 transition-transform">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter leading-none mb-3">Monitoring Capaian Nilai</h2>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-2xl border border-purple-200/50 dark:border-purple-800/30 shadow-inner">
                                <Clock size={14} className="text-purple-600" />
                                <span className="text-xs font-black text-purple-600 tracking-wider uppercase">{currentTime.format('HH:mm:ss')}</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl italic leading-none">{activeSemester} // {academicYear}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                    <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-[1.5rem] border border-white/40 dark:border-gray-700/40 shadow-lg">
                        <div className="flex items-center gap-2 mb-1 opacity-50">
                            <TrendingUp size={12} />
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Rerata Sekolah</p>
                        </div>
                        <p className="text-2xl font-black text-purple-600 tracking-tighter">{stats?.avg_school_score || 0}</p>
                    </div>
                    <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-[1.5rem] border border-white/40 dark:border-gray-700/40 shadow-lg">
                        <div className="flex items-center gap-2 mb-1 opacity-50">
                            <GraduationCap size={12} />
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Unit</p>
                        </div>
                        <p className="text-2xl font-black text-indigo-600 tracking-tighter">{stats?.total_classes || 0}</p>
                    </div>
                    <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-[1.5rem] border border-white/40 dark:border-gray-700/40 shadow-lg">
                        <div className="flex items-center gap-2 mb-1 opacity-50">
                            <CheckCircle2 size={12} />
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Progres Input</p>
                        </div>
                        <p className="text-2xl font-black text-emerald-500 tracking-tighter">{stats?.avg_completion || 0}%</p>
                    </div>
                </div>
            </div>

            {/* Sub-Header & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.4em] italic">Live Stream Monitoring Data</span>
                </div>
                <div className="relative w-full sm:w-96 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={20} />
                    <input 
                        type="text"
                        placeholder="Search Class Units..."
                        className="pl-14 pr-6 py-4 w-full rounded-[2rem] bg-white dark:bg-gray-800 border-none shadow-2xl focus:ring-4 focus:ring-purple-500/20 outline-none text-sm font-bold transition-all placeholder:opacity-50 tracking-tight"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Monitoring */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredData.length === 0 ? (
                    <div className="col-span-full py-32 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[4rem] border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center grayscale opacity-50">
                        <GraduationCap size={64} className="mb-6 text-gray-300" />
                        <p className="font-black text-gray-500 uppercase tracking-[0.5em]">No Data Stream Found</p>
                    </div>
                ) : (
                    filteredData.map((item) => (
                        <ClassMonitorCard key={item.id} item={item} navigate={navigate} />
                    ))
                )}
            </div>
            
            <div className="mt-12 mb-8">
                <RunningText text="PEMANTAUAN CAPAIAN NILAI REAL-TIME // PASTIKAN SELURUH UNIT KELAS DALAM STATUS TERKENDALI // HUBUNGI GURU PENGAMPU JIKA INDIKATOR STATUS BERWARNA MERAH // TETAP PANTAU PROGRESS INPUT RAPOR //" />
            </div>
        </div>
    );
};

export default MonitoringNilaiPage;
