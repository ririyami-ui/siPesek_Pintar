import React, { useState, useEffect, useRef } from 'react';
import { Activity, Clock, User, BookOpen, CheckCircle2, AlertCircle, PlayCircle, Loader2, School, BellRing, Zap, Volume2 } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';

const AdminMonitoringDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(moment());
    const { 
        userProfile, 
        monitoringData,
        refreshMonitoringData,
        smartAudioEnabled: isAudioEnabled,
        isAudioUnlocked,
        testAudio
    } = useSettings();
    const [currentTime, setCurrentTime] = useState(moment());
    const syncIdsRef = useRef(new Set());

    // Effect to handle manual/auto refresh visual state
    useEffect(() => {
        if (monitoringData) {
            setLoading(false);
            setIsRefreshing(false);
            setLastUpdated(moment());
        }
    }, [monitoringData]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refreshMonitoringData();
    };

    const getCountdown = (targetTimeStr) => {
        if (!targetTimeStr) return null;
        const now = moment();
        const target = moment(targetTimeStr, ['HH:mm', 'H:mm', 'HH.mm', 'H.mm']);
        if (!target.isValid()) return null;
        let diff = target.diff(now);
        if (diff <= 0) return null;
        const duration = moment.duration(diff);
        return `${Math.floor(duration.asMinutes()).toString().padStart(2, '0')}:${duration.seconds().toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(moment());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const data = monitoringData?.data || [];
    const stats = monitoringData?.stats || { total: 0, berlangsung: 0, selesai: 0, alfa: 0, belum_mulai: 0 };
    const filteredData = showOnlyMissing ? data.filter(item => item.status === 'alfa') : data;
    
    // Improved detection: all scheduled times have passed
    const isPastSchoolDay = monitoringData?.max_end_time && 
        moment(currentTime.format('HH:mm'), 'HH:mm').isSameOrAfter(moment(monitoringData.max_end_time, 'HH:mm'));

    const isBeforeSchoolDay = monitoringData?.min_start_time &&
        moment(currentTime.format('HH:mm'), 'HH:mm').isBefore(moment(monitoringData.min_start_time, 'HH:mm'));
        
    // [FIX] Learning is finished if we are past the school day OR before the school day started
    const isAllLearningFinished = (isPastSchoolDay || isBeforeSchoolDay) && !monitoringData?.active_non_teaching;

    const getStatusConfig = (status) => {
        switch (status) {
            case 'berlangsung': return { label: 'Sedang Berlangsung', icon: <PlayCircle className="animate-pulse" size={16} /> };
            case 'selesai': return { label: 'Jurnal Selesai', icon: <CheckCircle2 size={16} /> };
            case 'alfa': return { label: 'Belum Ada Jurnal', icon: <AlertCircle size={16} /> };
            case 'assignment': return { label: 'Penugasan', icon: <BookOpen className="animate-pulse" size={16} /> };
            default: return { label: 'Belum Mulai', icon: <Clock size={16} /> };
        }
    };

    if (loading && data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <Loader2 className="animate-spin text-primary mb-4" size={40} />
                <p className="text-sm font-bold text-gray-500 animate-pulse">Menyiapkan Data Monitoring...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isAudioEnabled && !isAudioUnlocked && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-bounce-slow">
                    <div className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-full shadow-2xl border-2 border-white/20 cursor-pointer hover:bg-blue-700 transition-all font-black text-xs uppercase tracking-widest">
                        <Volume2 size={18} className="animate-pulse" />
                        Klik untuk aktifkan Audio
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                {/* Decorative background element */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                
                <div className="flex items-center gap-5 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse" />
                        {userProfile?.logoUrl || userProfile?.logo_url || userProfile?.logo_path || userProfile?.school_logo_url ? (
                            <img 
                                src={userProfile?.logoUrl || userProfile?.logo_url || userProfile?.school_logo_url || (window.Laravel?.baseUrl + '/storage/' + userProfile?.logo_path)} 
                                alt="School Logo" 
                                className="w-16 h-16 object-contain rounded-2xl bg-white p-2 shadow-lg border border-slate-100 relative z-10" 
                                onError={(e) => {
                                    e.target.onerror = null; 
                                    e.target.src = (window.Laravel?.baseUrl || "") + "/Logo Smart Teaching Baru_.png";
                                }}
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg relative z-10">
                                <School size={32} />
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tighter uppercase italic">
                                {userProfile?.school_name || userProfile?.schoolName || "SMART SCHOOL"}
                            </h1>
                            <div className="h-6 w-[2px] bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                            <div className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 font-mono text-sm font-black flex items-center gap-2 shadow-sm">
                                <Activity size={14} className="animate-pulse" />
                                {currentTime.format('HH:mm:ss')}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Monitoring Aktivitas Real-time</p>
                            </div>
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 dark:border-slate-700">
                                <Clock size={12} />
                                Terakhir Update: {lastUpdated.format('HH:mm:ss')}
                                {isRefreshing && <Loader2 size={10} className="animate-spin ml-1.5 opacity-50" />}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10 self-end md:self-center">
                    {isAudioEnabled && (
                        <button 
                            onClick={testAudio}
                            className="group flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest transition-all hover:shadow-lg hover:border-indigo-200 border border-slate-100 dark:border-slate-700 active:scale-95"
                            title="Uji coba suara pengumuman"
                        >
                            <Volume2 size={16} className="group-hover:text-indigo-500 transition-colors" />
                            Cek Audio
                        </button>
                    )}
                    <button 
                        onClick={() => setShowOnlyMissing(!showOnlyMissing)}
                        className={`group flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm ${showOnlyMissing ? 'bg-rose-500 text-white shadow-rose-200 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 hover:border-rose-200'}`}
                    >
                        <AlertCircle size={16} className={showOnlyMissing ? 'animate-bounce' : 'group-hover:text-rose-500 transition-colors'} />
                        {showOnlyMissing ? 'Tampilkan Semua' : 'Butuh Perhatian'}
                    </button>
                    <button 
                        onClick={handleManualRefresh}
                        className={`p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 transition-all hover:shadow-lg active:scale-95 ${isRefreshing ? 'opacity-50' : 'hover:text-indigo-600 hover:border-indigo-200'}`}
                        disabled={isRefreshing}
                        title="Refresh data sekarang"
                    >
                        <Loader2 className={isRefreshing ? "animate-spin" : ""} size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Berlangsung', count: stats.berlangsung, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', desc: 'KBM berjalan' },
                    { label: 'Selesai', count: stats.selesai, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', desc: 'Jurnal terisi' },
                    { label: 'Alpa', count: stats.alfa, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20', desc: 'Tanpa aktivitas' },
                    { label: 'Total', count: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', desc: 'Semua unit' }
                ].map((stat, i) => (
                    <div key={i} className={`p-4 rounded-3xl ${stat.bg} border border-white/20 shadow-sm flex flex-col justify-between`}>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{stat.label}</p>
                            <p className={`text-3xl font-black ${stat.color}`}>{stat.count}</p>
                        </div>
                        <p className={`text-[10px] font-bold opacity-70 mt-2 ${stat.color}`}>{stat.desc}</p>
                    </div>
                ))}
            </div>

            {monitoringData?.active_non_teaching && (
                <div className="mb-6 p-6 md:p-8 rounded-[2rem] bg-gradient-to-r from-purple-600 to-indigo-600 shadow-2xl text-white relative overflow-hidden animate-pulse">
                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                <BellRing size={40} />
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.3em] mb-1">Pemberitahuan</p>
                                <h3 className="text-3xl font-black">{monitoringData.active_non_teaching.activity_name}</h3>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold mb-1 opacity-90">Hingga {monitoringData.active_non_teaching.end_time}</p>
                            {getCountdown(monitoringData.active_non_teaching.end_time) && (
                                <div className="px-4 py-2 bg-white rounded-2xl text-lg font-black text-purple-700 shadow-xl flex items-center gap-2">
                                    <Clock size={18} /> {getCountdown(monitoringData.active_non_teaching.end_time)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className={`transition-all duration-1000 ${monitoringData?.active_non_teaching ? 'opacity-70 grayscale-[30%]' : 'opacity-100'}`}>
                {isAllLearningFinished && !showOnlyMissing && (
                    <div className="p-8 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-200 text-center mb-6">
                        {isPastSchoolDay ? <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-4" /> : <Clock size={32} className="mx-auto text-indigo-500 mb-4" />}
                        <h3 className="text-2xl font-black text-slate-800">
                            {isPastSchoolDay ? 'Pembelajaran Selesai' : 'Pembelajaran Belum Mulai'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-2">
                            {isPastSchoolDay ? 'Semua tugas mengajar hari ini telah tuntas.' : `Jadwal hari ini akan dimulai pada pukul ${monitoringData?.min_start_time}.`}
                        </p>
                    </div>
                )}

                {(!isAllLearningFinished || showOnlyMissing) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
                        {filteredData.length === 0 ? (
                            <div className="col-span-full py-20 bg-gray-50 dark:bg-gray-900/40 rounded-3xl border border-dashed text-center opacity-50">
                                <Clock size={48} className="mx-auto mb-4" />
                                <p className="font-bold">Tidak ada jadwal KBM saat ini.</p>
                            </div>
                        ) : (
                            filteredData.map((item) => {
                                const isLive = item.status === 'berlangsung';
                                const isAssignment = !!item.is_assignment;
                                return (
                                    <div 
                                        key={item.id} 
                                        className={`relative group rounded-[2.5rem] border transition-all duration-500 h-full flex flex-col p-8 overflow-hidden 
                                            ${isLive 
                                                ? 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)] scale-[1.02] z-10' 
                                                : 'bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl hover:-translate-y-1'
                                            }`}
                                    >
                                        {/* Luxury Badge for Live Status */}
                                        {isLive && (
                                            <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/20">
                                                <div className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
                                            </div>
                                        )}

                                        <div className="mb-6">
                                            <h3 className={`text-4xl font-black tracking-tighter ${isLive ? 'text-white' : 'text-gray-800 dark:text-white'}`}>
                                                {item.rombel}
                                            </h3>
                                            <div className={`h-1.5 w-12 rounded-full mt-2 ${isLive ? 'bg-white/30' : 'bg-indigo-500/20'}`} />
                                        </div>

                                        <div className="space-y-4 mb-8 text-left">
                                            <div className="group/item">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5 ${isLive ? 'text-indigo-100' : ''}`}>Guru</p>
                                                <p className="font-black text-sm leading-tight">{item.teacher}</p>
                                            </div>
                                            <div className="group/item">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5 ${isLive ? 'text-indigo-100' : ''}`}>Mapel</p>
                                                <p className="font-black text-sm leading-tight">{item.subject}</p>
                                            </div>
                                            <div className="group/item">
                                                <p className={`text-[10px] font-bold uppercase tracking-widest opacity-50 mb-0.5 ${isLive ? 'text-indigo-100' : ''}`}>Waktu</p>
                                                <p className="font-black text-sm leading-tight flex items-center gap-2">
                                                    <Clock size={14} className="opacity-50" />
                                                    {item.time}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Attendance Summary Section */}
                                        <div className={`mb-6 p-4 rounded-2xl border ${isLive ? 'bg-white/10 border-white/10' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${isLive ? 'text-white/70' : 'text-gray-400'}`}>Presensi Siswa</p>
                                                <p className={`text-[10px] font-black ${isLive ? 'text-white' : 'text-indigo-600'}`}>
                                                    {item.attendance_summary ? (item.attendance_summary.hadir + (item.attendance_summary.sakit?.count || 0) + (item.attendance_summary.izin?.count || 0) + (item.attendance_summary.alpa?.count || 0)) : 0} / {item.total_students || 0}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 mb-4">
                                                {[
                                                    { label: 'H', count: item.attendance_summary?.hadir || 0, color: isLive ? 'bg-emerald-400' : 'bg-emerald-500', title: 'Hadir' },
                                                    { label: 'S', count: item.attendance_summary?.sakit?.count || 0, color: isLive ? 'bg-amber-400' : 'bg-amber-500', title: 'Sakit' },
                                                    { label: 'I', count: item.attendance_summary?.izin?.count || 0, color: isLive ? 'bg-blue-400' : 'bg-blue-500', title: 'Izin' },
                                                    { label: 'A', count: item.attendance_summary?.alpa?.count || 0, color: isLive ? 'bg-rose-400' : 'bg-rose-500', title: 'Alpa' }
                                                ].map((stat, idx) => (
                                                    <div key={idx} title={stat.title} className="flex flex-col items-center">
                                                        <div className={`w-full h-1 rounded-full mb-1 ${stat.count > 0 ? stat.color : (isLive ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700')}`} />
                                                        <p className={`text-[9px] font-black mb-0.5 ${isLive ? 'text-white/60' : 'text-gray-400'}`}>{stat.label}</p>
                                                        <p className={`text-xs font-black ${isLive ? 'text-white' : 'text-gray-800 dark:text-white'}`}>{stat.count}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {(isLive || item.status === 'alfa') && getCountdown(item.time?.split(' - ')[1]) && (
                                            <div className={`mt-auto px-4 py-3 transition-colors backdrop-blur-sm rounded-2xl text-xs font-black text-center flex items-center justify-center gap-2 border ${
                                                isLive 
                                                    ? 'bg-white/10 hover:bg-white/20 border-white/10 text-white' 
                                                    : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-600'
                                            }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLive ? 'bg-white' : 'bg-rose-500'}`} />
                                                Sisa: {getCountdown(item.time?.split(' - ')[1])}
                                            </div>
                                        )}
                                        
                                        {!isLive && item.status === 'selesai' && (
                                            <div className="mt-auto flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                                                <CheckCircle2 size={14} /> Jurnal Selesai
                                            </div>
                                        )}

                                        <div className={`absolute bottom-0 left-0 h-1.5 w-full transition-all duration-1000 ${
                                            item.status === 'selesai' ? 'bg-emerald-500' : 
                                            item.status === 'alfa' ? 'bg-rose-500 shadow-[0_-4px_10px_rgba(244,63,94,0.4)]' : 
                                            isLive ? 'bg-white/40' : 'bg-gray-100 dark:bg-gray-800'
                                        }`} />
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMonitoringDashboard;
