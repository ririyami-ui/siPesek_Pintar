import React, { useState, useEffect, useCallback } from 'react';
import {
  MonitorPlay, Clock, CheckCircle2, XCircle, AlertCircle,
  BookOpen, User, RefreshCw, Wifi, WifiOff, ChevronRight,
  CalendarDays, TrendingUp, AlertTriangle, MessageCircle, Send, X, Bot
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  hadir: { label: 'Hadir',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, dot: 'bg-emerald-500' },
  sakit: { label: 'Sakit',   color: 'bg-amber-100  text-amber-700  border-amber-200',  icon: AlertCircle,   dot: 'bg-amber-500'   },
  izin:  { label: 'Izin',    color: 'bg-blue-100   text-blue-700   border-blue-200',   icon: AlertCircle,   dot: 'bg-blue-500'    },
  alpa:  { label: 'Alpa',    color: 'bg-red-100    text-red-700    border-red-200',    icon: XCircle,       dot: 'bg-red-500'     },
};

const SESSION_STATUS = {
  ongoing:   'bg-emerald-500 text-white',
  upcoming:  'bg-slate-200   text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  completed: 'bg-slate-100   text-slate-400 dark:bg-slate-800 dark:text-slate-500',
};

const ATTENDANCE_CARD_STYLE = {
  hadir: {
    gradient: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    shadow: 'shadow-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    text: 'text-emerald-800 dark:text-emerald-300',
    muted: 'text-emerald-600/70 dark:text-emerald-400/60',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    emotion: '😊',
    accent: 'bg-emerald-500'
  },
  sakit: {
    gradient: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
    shadow: 'shadow-amber-500/10',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-800 dark:text-amber-300',
    muted: 'text-amber-600/70 dark:text-amber-400/60',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    emotion: '🤒',
    accent: 'bg-amber-500'
  },
  izin: {
    gradient: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    shadow: 'shadow-blue-500/10',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-800 dark:text-blue-300',
    muted: 'text-blue-600/70 dark:text-blue-400/60',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    emotion: '✉️',
    accent: 'bg-blue-500'
  },
  ijin: {
    gradient: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
    shadow: 'shadow-blue-500/10',
    border: 'border-blue-200 dark:border-blue-800/50',
    text: 'text-blue-800 dark:text-blue-300',
    muted: 'text-blue-600/70 dark:text-blue-400/60',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    emotion: '✉️',
    accent: 'bg-blue-500'
  },
  alpa: {
    gradient: 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30',
    shadow: 'shadow-rose-500/10',
    border: 'border-rose-200 dark:border-rose-800/50',
    text: 'text-rose-800 dark:text-rose-300',
    muted: 'text-rose-600/70 dark:text-rose-400/60',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    emotion: '⚠️',
    accent: 'bg-rose-500'
  },
  alpha: {
    gradient: 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30',
    shadow: 'shadow-rose-500/10',
    border: 'border-rose-200 dark:border-rose-800/50',
    text: 'text-rose-800 dark:text-rose-300',
    muted: 'text-rose-600/70 dark:text-rose-400/60',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    emotion: '⚠️',
    accent: 'bg-rose-500'
  },
  default: {
    gradient: 'bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800',
    shadow: 'shadow-slate-500/5',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-800 dark:text-slate-100',
    muted: 'text-slate-500 dark:text-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    emotion: '⏳',
    accent: 'bg-slate-400'
  }
};

function AttendanceBadge({ status }) {
  const style = ATTENDANCE_CARD_STYLE[status?.toLowerCase()] || ATTENDANCE_CARD_STYLE.default;
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-sm ${style.badge}`}>
      <span>{style.emotion}</span>
      <span>{status || 'Belum absen'}</span>
    </div>
  );
}

function TimeDisplay({ serverTime }) {
  const [now, setNow] = useState(serverTime ? new Date(serverTime) : new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(prev => new Date(prev.getTime() + 1000)), 1000);
    return () => clearInterval(interval);
  }, [serverTime]);

  return (
    <span className="font-mono tabular-nums text-3xl font-bold tracking-wide">
      {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [gradesData, setGradesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Chatbot state removed - now global in StudentLayout
  
  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [realtimeRes, gradesRes] = await Promise.all([
        api.get('/student/realtime'),
        api.get('/student/grades')
      ]);
      setData(realtimeRes.data);
      setGradesData(gradesRes.data);
      setLastUpdate(new Date());
    } catch (err) {
      if (!silent) toast.error('Gagal memuat data. Periksa koneksi internet.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 15s for realtime feel
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-medium">Memuat data pembelajaran...</p>
    </div>
  );

  const student = data?.student;
  const currentSession = data?.current_session;
  const upcomingSession = data?.upcoming_session;
  const schedule = data?.today_schedule ?? [];

  const currentCardStyle = currentSession 
    ? (ATTENDANCE_CARD_STYLE[currentSession.attendance_status?.toLowerCase()] || ATTENDANCE_CARD_STYLE.default)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <MonitorPlay size={22} className="text-emerald-600" />
            Pantau Belajar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.day}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors font-medium"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Student + Clock Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-xl animate-fade-in-premium">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <User size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xl truncate">{student?.name}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full font-medium">Kelas {student?.class}</span>
              <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full font-medium">No. Absen {student?.absen}</span>
              <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full font-medium">NISN {student?.nisn}</span>
            </div>
          </div>
          <div className="text-right">
            <TimeDisplay serverTime={data?.server_time} />
            <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mt-1">Live Sync</p>
          </div>
        </div>
      </div>

      {/* Early Warning Section for Parents */}
      {gradesData?.warnings?.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-3xl p-5 animate-fade-in-premium">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl">
              <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="font-black text-rose-900 dark:text-rose-100 uppercase tracking-widest text-[10px]">Perhatian Orang Tua</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {gradesData.warnings.map((w, i) => (
              <span key={i} className="px-3 py-1 bg-white dark:bg-white/5 border border-rose-100 dark:border-rose-800 rounded-full text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 shadow-sm">
                <div className="w-1 h-1 rounded-full bg-rose-400" />
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Toggle: Live Mode vs Report Mode */}
      {(!currentSession && !upcomingSession) ? (
        /* REPORT MODE: Show Narrative Summary */
        data?.daily_narrative && (
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden animate-fade-in-premium">
            <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10 rotate-12">
              <TrendingUp size={80} />
            </div>
            <div className="flex gap-4 items-start relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                 <MonitorPlay size={24} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-[10px] uppercase font-black text-indigo-500 tracking-widest mb-1.5 flex items-center gap-2">
                  Laporan Capaian Hari Ini
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <div 
                  className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium"
                  dangerouslySetInnerHTML={{ 
                    __html: data.daily_narrative
                      .replace(/\*\*(.*?)\*\*/g, '<b class="text-slate-900 dark:text-white font-black">$1</b>') 
                  }}
                />
              </div>
            </div>
          </div>
        )
      ) : (
        /* LIVE MODE: Show Schedule Highlights */
        <div className="space-y-5 animate-fade-in-premium">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Current Session */}
            <div className={`relative overflow-hidden rounded-3xl p-5 border-2 shadow-lg transition-all duration-500 ${
              currentSession 
                ? `${currentCardStyle.gradient} ${currentCardStyle.border} ${currentCardStyle.shadow}` 
                : 'border-dashed border-slate-200 bg-slate-50 dark:bg-slate-800/50'
            }`}>
              {/* Scan Line Animation for Live Card */}
              {currentSession && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-10">
                  <div className="absolute w-full h-20 bg-gradient-to-b from-transparent via-white/20 to-transparent -skew-y-12 animate-scan-line" />
                </div>
              )}

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex items-center justify-center">
                    {currentSession && <div className={`w-2.5 h-2.5 ${currentCardStyle.accent} rounded-full animate-pulse-soft absolute opacity-30`}></div>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${currentSession ? currentCardStyle.accent : 'bg-slate-300'}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${currentSession ? currentCardStyle.text : 'text-slate-400'}`}>
                    Sedang Berlangsung
                  </span>
                </div>
                {currentSession ? (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <p className={`font-black ${currentCardStyle.text} text-xl leading-tight`}>{currentSession.subject_name}</p>
                      <AttendanceBadge status={currentSession.attendance_status} />
                    </div>
                    <div className="space-y-1.5">
                      <p className={`text-xs ${currentCardStyle.muted} flex items-center gap-2 font-bold uppercase tracking-tight`}>
                        <Clock size={12} /> {currentSession.start_time} - {currentSession.end_time}
                      </p>
                      {currentSession.planned_material && (
                        <div className="bg-white/40 dark:bg-black/10 backdrop-blur-md rounded-xl px-3 py-2 mt-2 border border-white/30 dark:border-white/5">
                          <p className={`text-[9px] uppercase font-black ${currentCardStyle.muted} tracking-widest mb-0.5`}>Materi</p>
                          <p className={`text-[11px] font-bold ${currentCardStyle.text} leading-tight`}>{currentSession.planned_material}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm italic">Tidak ada pelajaran aktif.</p>
                )}
              </div>
            </div>

            {/* Upcoming Session */}
            <div className="rounded-3xl p-5 border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <ChevronRight size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Selanjutnya</span>
              </div>
              {upcomingSession ? (
                <>
                  <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight mb-1">{upcomingSession.subject_name}</p>
                  <p className="text-xs text-slate-400 font-medium">{upcomingSession.start_time} (Sesi Berikutnya)</p>
                </>
              ) : (
                <p className="text-slate-400 text-sm italic">Agenda hari ini sudah selesai.</p>
              )}
            </div>
          </div>

          {/* Full Today Schedule List */}
          {schedule.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <CalendarDays size={14} /> Agenda Hari Ini
                </h3>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-lg">{schedule.length} Sesi</span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-white/5">
                {schedule.map((s, idx) => (
                  <div key={idx} className={`p-4 flex items-center gap-4 transition-all ${s.status === 'ongoing' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : (s.status === 'completed' ? 'opacity-40 grayscale-[0.5]' : '')}`}>
                    <div className="w-16 shrink-0 text-right">
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200 leading-none mb-1">{s.start_time}</p>
                      <p className="text-[9px] font-bold text-slate-400">{s.end_time}</p>
                    </div>
                    <div className={`w-1 h-8 rounded-full ${s.status === 'ongoing' ? 'bg-emerald-500' : (s.status === 'completed' ? 'bg-slate-200' : 'bg-indigo-300')}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm truncate ${s.status === 'ongoing' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-white'}`}>{s.subject_name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate italic">{s.teacher_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AttendanceBadge status={s.attendance_status} />
                      {s.status === 'ongoing' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Update note */}
      {lastUpdate && (
        <p className="text-center text-xs text-slate-400 mt-2">
          Sinkronisasi Terakhir: {lastUpdate.toLocaleTimeString('id-ID')} · Live Sync
        </p>
      )}


    </div>
  );
}
