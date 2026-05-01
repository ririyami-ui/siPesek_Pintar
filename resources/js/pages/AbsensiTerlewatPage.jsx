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
    History,
    Trash2,
    X,
    ShieldAlert,
    Lock
} from 'lucide-react';
import api from '../lib/axios';
import moment from 'moment';
import { useSettings } from '../utils/SettingsContext';

const AbsensiTerlewatPage = () => {
    const navigate = useNavigate();
    const { userProfile } = useSettings();
    const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
    const [loading, setLoading] = useState(true);
    const [isResetting, setIsResetting] = useState(false);
    const [missingData, setMissingData] = useState([]);
    const [days, setDays] = useState(7);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPassword, setResetPassword] = useState('');

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

    const handleResetMissing = async () => {
        setIsResetting(true);
        try {
            await api.post('/admin/attendances/reset-missing', { password: resetPassword });
            setResetPassword('');
            setShowResetModal(false);
            fetchMissingAttendance(); // Reload data (will be 0)
        } catch (error) {
            console.error('Failed to reset missing attendance', error);
            alert(error.response?.data?.message || 'Gagal membersihkan riwayat absensi. Pastikan kata sandi benar.');
        } finally {
            setIsResetting(false);
        }
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

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 relative z-10 w-full md:w-auto mt-4 md:mt-0">
                    {isAdmin && (
                        <button 
                            onClick={() => setShowResetModal(true)}
                            disabled={isResetting}
                            className={`flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600 border border-rose-200 dark:border-rose-800/40 rounded-xl shadow-sm hover:shadow-md transition-all text-xs font-bold w-full sm:w-auto ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Trash2 size={16} />
                            <span className="whitespace-nowrap">Reset Riwayat</span>
                        </button>
                    )}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl px-2 py-1 shadow-sm border border-gray-100 dark:border-gray-700 w-full md:w-auto justify-between">
                        <span className="text-[10px] font-black uppercase text-gray-400 pl-2">Rentang:</span>
                        <select 
                            value={days} 
                            onChange={(e) => setDays(parseInt(e.target.value))}
                            className="bg-transparent border-none rounded-r-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-0 cursor-pointer dark:text-white"
                        >
                            <option value={7}>7 Hari Terakhir</option>
                            <option value={14}>14 Hari Terakhir</option>
                            <option value={30}>30 Hari Terakhir</option>
                        </select>
                    </div>
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

            {/* Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden animate-scale-in">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl">
                                    <ShieldAlert size={28} />
                                </div>
                                <button 
                                    onClick={() => setShowResetModal(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <h3 className="text-2xl font-black text-gray-800 dark:text-white leading-tight mb-2 uppercase tracking-tighter">
                                Konfirmasi Reset Fatal
                            </h3>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-8 leading-relaxed">
                                Tindakan ini akan mengabaikan seluruh riwayat absen terlewat sebelumnya. Masukkan password akun untuk memvalidasi.
                            </p>

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleResetMissing();
                            }} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 pl-1">Password Admin</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-rose-500 transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input 
                                            type="password"
                                            value={resetPassword}
                                            onChange={(e) => setResetPassword(e.target.value)}
                                            required
                                            autoFocus
                                            placeholder="••••••••"
                                            className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-rose-500 dark:focus:border-rose-500 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold transition-all outline-none text-gray-800 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowResetModal(false)}
                                        className="flex-1 px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-gray-700 text-xs font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isResetting || !resetPassword}
                                        className="flex-[1.5] flex items-center justify-center gap-3 px-6 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl shadow-lg shadow-rose-600/20 transition-all text-xs font-black uppercase tracking-widest"
                                    >
                                        {isResetting ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <>
                                                <Trash2 size={18} />
                                                Konfirmasi
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AbsensiTerlewatPage;
