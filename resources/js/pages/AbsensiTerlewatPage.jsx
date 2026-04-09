import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    AlertCircle, 
    Calendar, 
    Clock, 
    User, 
    BookOpen, 
    ArrowLeft, 
    ChevronRight, 
    Loader2,
    ClipboardCheck,
    History
} from 'lucide-react';
import api from '../lib/axios';
import moment from 'moment';

const AbsensiTerlewatPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [missingData, setMissingData] = useState([]);
    const [days, setDays] = useState(7);

    const fetchMissingAttendance = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/attendances/missing?days=${days}`);
            setMissingData(response.data.data || []);
        } catch (error) {
            console.error('Error fetching missing attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMissingAttendance();
    }, [days]);

    const handleInputClick = (item) => {
        // Redirect to attendance page with pre-filled params
        // Note: classId and subjectId are required for the attendance page logic
        const queryParams = new URLSearchParams({
            classId: item.class_id,
            subjectId: item.subject_id,
            date: item.date
        }).toString();
        
        navigate(`/absensi?${queryParams}`);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Section */}
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 dark:bg-black/40 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-white/20 dark:border-gray-800/40 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:scale-105 transition-transform border border-gray-100 dark:border-gray-700"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tighter leading-none mb-2 sm:mb-3 flex items-center gap-3">
                            <History size={28} className="text-rose-600" />
                            Absensi Terlewat
                        </h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-xl">
                                Riwayat Jadwal Tanpa Absensi
                            </p>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl border border-rose-100 dark:border-rose-800/30">
                                <AlertCircle size={14} />
                                <span className="text-[10px] font-black uppercase tracking-tighter">{missingData.length} Jadwal Terdeteksi</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <span className="text-[10px] font-black uppercase text-gray-400">Rentang:</span>
                    <select 
                        value={days} 
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="bg-white dark:bg-gray-800 border-none rounded-xl px-4 py-2 text-xs font-bold shadow-lg outline-none focus:ring-2 focus:ring-rose-500/50 transition-all cursor-pointer dark:text-white"
                    >
                        <option value={7}>7 Hari Terakhir</option>
                        <option value={14}>14 Hari Terakhir</option>
                        <option value={30}>30 Hari Terakhir</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-800">
                    <Loader2 className="animate-spin text-rose-600 mb-4" size={48} />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] animate-pulse">Scanning Teaching History...</p>
                </div>
            ) : missingData.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md rounded-[3rem] border border-dashed border-gray-200 dark:border-gray-800">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                        <ClipboardCheck size={40} />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2">Semua Terkendali!</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center max-w-md">
                        Tidak ada riwayat mengajar yang terlewatkan absensinya dalam {days} hari terakhir. Kerja bagus!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {missingData.map((item, idx) => (
                        <div 
                            key={idx} 
                            className="group relative bg-white dark:bg-gray-900 rounded-[2.5rem] border-2 border-gray-100 dark:border-gray-800 p-6 shadow-xl hover:shadow-2xl hover:border-rose-500/30 transition-all duration-300"
                        >
                            {/* Date Badge */}
                            <div className="absolute top-6 right-6">
                                <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-[10px] font-black text-gray-500 uppercase flex items-center gap-2">
                                    <Calendar size={12} className="text-rose-500" />
                                    {moment(item.date).format('DD MMM YYYY')}
                                </div>
                            </div>

                            {/* Main Info */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0 font-black italic tracking-tighter text-xl">
                                        {item.rombel.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-gray-800 dark:text-white leading-none">{item.rombel}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{item.day}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 shrink-0">
                                            <BookOpen size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Mata Pelajaran</p>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 line-clamp-1">{item.subject_name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 shrink-0">
                                            <Clock size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Waktu Sesi</p>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.time}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 shrink-0">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 leading-none">Guru Pengampu</p>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 line-clamp-1">{item.teacher_name}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Area */}
                            <button 
                                onClick={() => handleInputClick(item)}
                                className="w-full group/btn relative flex items-center justify-between p-4 bg-gray-50 hover:bg-rose-600 dark:bg-gray-800 dark:hover:bg-rose-600 rounded-2xl transition-all duration-300"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-gray-700 rounded-xl text-rose-600 group-hover/btn:bg-white/20 group-hover/btn:text-white transition-colors duration-300">
                                        <ClipboardCheck size={20} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-200 group-hover/btn:text-white transition-colors duration-300">
                                        Bantu Absensi
                                    </span>
                                </div>
                                <div className="text-gray-300 group-hover/btn:text-white transition-all transform group-hover/btn:translate-x-1 duration-300">
                                    <ChevronRight size={20} />
                                </div>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer Notice */}
            <div className="mt-12 text-center p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem] opacity-60">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.5em] mb-2 leading-none">Digital Attendance Verification System</p>
                <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed max-w-lg mx-auto">
                    Data di atas dihasilkan melalui pencocokan jadwal mingguan aktif dengan rekaman absensi digital. Silakan hubungi operator jika terdapat jadwal yang seharusnya libur namun muncul di daftar ini.
                </p>
            </div>
        </div>
    );
};

export default AbsensiTerlewatPage;
