import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Activity, 
    Clock, 
    User, 
    BookOpen, 
    Search, 
    Loader2, 
    Users, 
    AlertCircle, 
    CheckCircle2,
    Calendar,
    Radio
} from 'lucide-react';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';
import RunningText from '../components/RunningText';

const ClassAttendanceCard = ({ rombel, schedules, currentTime }) => {
    // Find the relevant schedule to show for this rombel
    const activeSchedule = useMemo(() => {
        // 1. Priority: Currently ongoing (Status: berlangsung)
        const ongoing = schedules.find(s => s.status === 'berlangsung');
        if (ongoing) return ongoing;

        // 2. Priority: Next upcoming (Status: belum_mulai)
        const upcoming = schedules.filter(s => s.status === 'belum_mulai')
                                   .sort((a, b) => a.time.localeCompare(b.time))[0];
        if (upcoming) return upcoming;

        // 3. Fallback: Last finished (Status: selesai or alfa)
        return schedules[schedules.length - 1];
    }, [schedules, schedules.length]);

    if (!activeSchedule) return null;

    const summary = activeSchedule.attendance_summary || {};
    const totalAttendance = (summary.hadir || 0) + (summary.sakit?.count || 0) + (summary.izin?.count || 0) + (summary.alpa?.count || 0);
    const hasActivity = activeSchedule.journal_id || totalAttendance > 0;
    
    // Calculate Smart Notice
    let smartStatus = 'pending';
    let smartMessage = 'Menunggu jadwal dimulai...';
    let statusColor = 'text-gray-400 bg-gray-100';

    const isAssignment = activeSchedule.is_assignment === true || activeSchedule.is_assignment == 1;

    if (activeSchedule.status === 'berlangsung') {
        const startTime = moment(activeSchedule.time.split(' - ')[0], 'HH:mm');
        const diffMinutes = currentTime.diff(startTime, 'minutes');

        if (isAssignment) {
            smartStatus = 'assignment';
            smartMessage = 'PENUGASAN: Guru dinas luar/tugas mandiri.';
            statusColor = 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-800/50';
        } else if (hasActivity) {
            smartStatus = 'safe';
            smartMessage = 'TERKENDALI: Guru terpantau di lokasi kelas.';
            statusColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200';
        } else if (diffMinutes > 15) {
            smartStatus = 'warning';
            smartMessage = 'WASPADAI: Belum terdeteksi aktivitas guru!';
            statusColor = 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-200';
        } else {
            smartStatus = 'starting';
            smartMessage = 'MENUNGGU: Sesi baru saja dimulai.';
            statusColor = 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800/50';
        }
    } else if (activeSchedule.status === 'selesai' || activeSchedule.status === 'alfa') {
        if (isAssignment) {
            smartStatus = 'assignment';
            smartMessage = 'PENUGASAN: Selesai (Dinas Luar).';
            statusColor = 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-800/50';
        } else {
            smartStatus = 'finished';
            smartMessage = 'SELESAI: Sesi KBM hari ini telah berakhir.';
            statusColor = 'text-slate-600 bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-800/50';
        }
    }

    return (
        <div className={`group relative bg-white dark:bg-gray-900 rounded-[2.5rem] border-4 transition-all duration-500 overflow-hidden flex flex-col min-h-[400px] ${statusColor.split(' ').filter(c => c.startsWith('border-')).join(' ')} shadow-xl hover:shadow-2xl`}>
            {/* CCTV Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-10" />
            
            {/* Elegance Status Tag (Integrated) */}
            <div className="absolute top-0 right-0 z-20">
              {isAssignment ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/90 backdrop-blur-md rounded-bl-3xl border-l border-b border-indigo-400/30 text-white shadow-lg">
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping absolute inset-0 opacity-40"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full relative"></div>
                  </div>
                  <span className="text-[8px] font-black tracking-[0.2em] uppercase leading-none">Penugasan</span>
                </div>
              ) : (activeSchedule.status === 'berlangsung' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/90 backdrop-blur-md rounded-bl-3xl border-l border-b border-rose-400/30 text-white shadow-lg">
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping absolute inset-0 opacity-40"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full relative"></div>
                  </div>
                  <span className="text-[8px] font-black tracking-[0.2em] uppercase leading-none">Live Monitor</span>
                </div>
              ) : (
                <div className={`flex items-center gap-2 px-4 py-2 backdrop-blur-md rounded-bl-3xl border-l border-b border-white/20 text-[8px] font-black uppercase tracking-[0.2em] ${
                  activeSchedule.status === 'selesai' 
                    ? 'bg-emerald-500/20 text-emerald-500' 
                    : 'bg-gray-500/10 text-gray-400'
                }`}>
                  <span className="leading-none">{activeSchedule.status === 'selesai' ? 'Selesai' : activeSchedule.status.toUpperCase()}</span>
                </div>
              ))}
            </div>

            {/* Header: Rombel & Time */}
            <div className={`p-6 pb-4 border-b flex justify-between items-center transition-colors duration-500 ${statusColor.split(' ').filter(c => c.includes('bg-') || c.includes('border-')).join(' ')} bg-opacity-30 dark:bg-opacity-20`}>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0">
                        <span className="text-xl font-black italic tracking-tighter">{rombel.substring(0, 2)}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-gray-800 dark:text-white leading-none">{rombel}</h3>
                        <p className="text-[8px] font-bold text-gray-400 tracking-[0.2em] uppercase mt-1.5 flex items-center gap-1.5">
                            CCTV Absensi Monitoring
                        </p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-tighter shadow-inner">
                    {activeSchedule.time}
                </div>
            </div>

            {/* Content Display */}
            <div className="flex-1 p-6 flex flex-col justify-center text-center">
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Mata Pelajaran Aktif</p>
                    <h4 className="text-xl font-black text-gray-800 dark:text-white tracking-tight leading-tight line-clamp-2 min-h-[3rem] flex items-center justify-center">
                        {activeSchedule.subject}
                    </h4>
                    <p className="text-xs font-bold text-gray-500 mt-2 uppercase tracking-tighter">
                        {activeSchedule.teacher}
                    </p>
                </div>

                {/* Grid Attendance Stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                        { label: 'Hadir', val: summary.hadir || 0, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20', students: [] },
                        { label: 'Sakit', val: summary.sakit?.count || 0, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20', students: summary.sakit?.students || [] },
                        { label: 'Izin', val: summary.izin?.count || 0, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20', students: summary.izin?.students || [] },
                        { label: 'Alpa', val: summary.alpa?.count || 0, color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20', students: summary.alpa?.students || [] }
                    ].map((st, i) => (
                        <div key={i} className={`p-2 rounded-xl border border-transparent transition-all flex flex-col items-center ${st.color}`}>
                            <span className="text-[7px] font-black uppercase opacity-60 mb-0.5">{st.label}</span>
                            <span className="text-lg font-black leading-none">{st.val}</span>
                        </div>
                    ))}
                </div>

                {/* Detailed Absent Students List */}
                {((summary.sakit?.count || 0) > 0 || (summary.izin?.count || 0) > 0 || (summary.alpa?.count || 0) > 0) && (
                    <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-800 text-left">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Users size={10} />
                            Daftar Tidak Masuk
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                            {[
                                { list: summary.sakit?.students || [], color: 'bg-amber-500/10 text-amber-600 border-amber-200/50', label: 'S' },
                                { list: summary.izin?.students || [], color: 'bg-blue-500/10 text-blue-600 border-blue-200/50', label: 'I' },
                                { list: summary.alpa?.students || [], color: 'bg-rose-500/10 text-rose-600 border-rose-200/50', label: 'A' }
                            ].map((group, gIdx) => 
                                group.list.map((name, nIdx) => (
                                    <div key={`${gIdx}-${nIdx}`} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-bold ${group.color}`}>
                                        <span className="opacity-70 font-black">{group.label}</span>
                                        <span>{name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Smart Notice Bar */}
            <div className="p-4 border-t border-gray-50 dark:border-gray-800 bg-gray-50/30 dark:bg-black/10">
                <div className={`px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-inner border border-white/40 dark:border-gray-800/40 ${statusColor} bg-opacity-100 transition-colors duration-500`}>
                    {smartStatus === 'safe' ? <CheckCircle2 size={14} /> : (smartStatus === 'warning' ? <AlertCircle size={14} className="animate-pulse" /> : <Clock size={14}/>)}
                    <span className="text-[9px] font-black uppercase tracking-wider leading-none">{smartMessage}</span>
                </div>
            </div>
        </div>
    );
};

const MonitoringAbsensiPage = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(moment());

    const fetchData = async () => {
        try {
            const response = await api.get('/admin/dashboard/monitoring');
            setData(response.data.data || []);
            // DEBUG LOG
            console.log('Monitoring Data Feed:', response.data.data?.map(item => ({
                rombel: item.rombel,
                subject: item.subject,
                assign: item.is_assignment,
                status: item.status
            })));
        } catch (error) {
            console.error('Error fetching monitoring data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 300000); // 5 min refresh
        const timer = setInterval(() => setCurrentTime(moment()), 1000);
        return () => {
            clearInterval(interval);
            clearInterval(timer);
        };
    }, []);

    // Group schedules by rombel for CCTV focus
    const rombelGroups = useMemo(() => {
        const groups = {};
        data.forEach(item => {
            if (!groups[item.rombel]) {
                groups[item.rombel] = [];
            }
            groups[item.rombel].push(item);
        });
        return groups;
    }, [data]);

    const filteredRombels = useMemo(() => {
        return Object.keys(rombelGroups).filter(rombel => 
            rombel.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rombelGroups[rombel].some(s => 
                s.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.teacher.toLowerCase().includes(searchTerm.toLowerCase())
            )
        ).sort();
    }, [rombelGroups, searchTerm]);

    if (loading && data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="animate-spin text-rose-600 mb-4" size={40} />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Initializing Absensi Units...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-2 lg:p-4 animate-fade-in bg-gray-50/30 dark:bg-transparent min-h-screen pb-20">
            {/* Legend / Status Bar */}
            <div className="relative z-30 flex flex-wrap items-center justify-center gap-6 px-6 py-3 bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-full border border-white/20 dark:border-gray-800/40 text-[9px] font-black uppercase tracking-widest text-gray-500 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Terkendali</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>Penugasan</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Masa Transisi</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Belum Aktif</span>
                </div>
                <div className="w-px h-3 bg-gray-300 dark:bg-gray-700 mx-2" />
                <div className="flex items-center gap-2">
                    <Radio size={12} className="text-rose-500" />
                    <span>Real-Time Scanning</span>
                </div>
            </div>

            {/* Header Section */}
            <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 dark:border-gray-800/40 shadow-2xl overflow-hidden mb-10">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Users size={120} />
                </div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="p-5 rounded-[2rem] bg-gradient-to-br from-rose-600 to-pink-700 text-white shadow-2xl shadow-rose-500/40 transform rotate-3">
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter leading-none mb-3">Monitoring Absensi</h2>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-rose-100 dark:bg-rose-900/30 rounded-2xl border border-rose-200/50 dark:border-rose-800/30 shadow-inner">
                                <Clock size={14} className="text-rose-600" />
                                <span className="text-xs font-black text-rose-600 tracking-wider uppercase">{currentTime.format('HH:mm:ss')}</span>
                            </div>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl italic leading-none">Status KBM Aktif</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 relative z-10 shrink-0">
                    <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-[1.5rem] border border-white/40 dark:border-gray-700/40 shadow-lg min-w-[120px]">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Unit</p>
                        <p className="text-2xl font-black text-rose-600 tracking-tighter">{filteredRombels.length}</p>
                    </div>
                    <div className="p-4 bg-white/60 dark:bg-gray-800/60 rounded-[1.5rem] border border-white/40 dark:border-gray-700/40 shadow-lg min-w-[120px]">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Live Tracking</p>
                        <p className="text-2xl font-black text-emerald-500 tracking-tighter">Active</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end px-4 mb-4">
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 focus-within:text-rose-500 transition-colors" size={20} />
                    <input 
                        type="text"
                        placeholder="Search Class Units..."
                        className="pl-14 pr-6 py-4 w-full rounded-[2rem] bg-white dark:bg-gray-800 border-none shadow-2xl focus:ring-4 focus:ring-rose-500/20 outline-none text-sm font-bold transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Monitoring */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-8">
                {filteredRombels.length === 0 ? (
                    <div className="col-span-full py-32 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-[4rem] border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center grayscale opacity-50">
                        <Users size={64} className="mb-6 text-gray-300" />
                        <p className="font-black text-gray-500 uppercase tracking-[0.5em]">No Active Units Found</p>
                    </div>
                ) : (
                    filteredRombels.map((rombel) => (
                        <ClassAttendanceCard key={rombel} rombel={rombel} schedules={rombelGroups[rombel]} currentTime={currentTime} />
                    ))
                )}
            </div>
            
            <div className="mt-12 mb-8">
                <RunningText text="PEMANTAUAN KEHADIRAN SISWA REAL-TIME // PASTIKAN GURU SUDAH BERADA DI LOKASI KELAS // HUBUNGI PIKET JIKA STATUS KBM BERWARNA MERAH ATAU BELUM ADA AKTIVITAS SETELAH 15 MENIT //" />
            </div>
        </div>
    );
};

export default MonitoringAbsensiPage;
