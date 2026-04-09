import React, { useState, useEffect, useCallback } from 'react';
import {
  MonitorPlay, Clock, CheckCircle2, XCircle, AlertCircle,
  BookOpen, User, RefreshCw, Wifi, WifiOff,
  CalendarDays, School, Bot
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  hadir: { label: 'Hadir',   color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  sakit: { label: 'Sakit',   color: 'bg-amber-100  text-amber-700',  dot: 'bg-amber-500'   },
  izin:  { label: 'Izin',    color: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-500'    },
  alpa:  { label: 'Alpa',    color: 'bg-red-100    text-red-700',    dot: 'bg-red-500'     },
};

function StatusBadge({ status }) {
  const s = status?.toLowerCase() || '';
  const config = STATUS_MAP[s];
  if (!config) return <span className="text-[10px] text-slate-400 italic">Belum Presensi</span>;
  
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/student/realtime');
      setData(response.data);
    } catch (err) {
      if (!silent) toast.error('Gagal memuat data terbaru.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
      <RefreshCw size={24} className="animate-spin mb-2" />
      <p className="text-xs font-medium">Memuat data pantau...</p>
    </div>
  );

  const student = data?.student;
  const current = data?.current_session;
  const schedule = data?.today_schedule ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Small Header Section */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                {student?.photo_url ? (
                    <img src={student.photo_url} className="w-full h-full object-cover" alt="Student" />
                ) : (
                    <User size={20} className="text-slate-400" />
                )}
            </div>
            <div>
                <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight">{student?.name}</h1>
                <p className="text-[11px] font-medium text-slate-500">
                    Kelas {student?.class} · No. Absen {student?.absen}
                </p>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                    NIS: {student?.nis || '-'} · NISN: {student?.nisn || '-'}
                </p>
            </div>
        </div>
        <div className="text-right">
            <div className="text-xl font-mono font-bold text-slate-700 dark:text-slate-300">
                {new Date(data?.server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Live Monitoring</div>
        </div>
      </div>

      {/* Main Focus: Current Learning */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <MonitorPlay size={14} /> Sedang Berlangsung
        </h3>

        {current ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <h4 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{current.subject_name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                            <User size={12} /> {current.teacher_name}
                        </p>
                    </div>
                    <StatusBadge status={current.attendance_status} />
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 flex flex-wrap gap-4">
                    <div className="text-xs">
                        <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-bold tracking-widest">Waktu</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{current.start_time} - {current.end_time}</span>
                    </div>
                    {current.planned_material && (
                        <div className="text-xs flex-1 min-w-[150px]">
                            <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-bold tracking-widest">Materi</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 italic">"{current.planned_material}"</span>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-8 border border-dashed border-slate-200 dark:border-white/5 text-center">
                <p className="text-sm text-slate-400 italic font-medium">Tidak ada pelajaran yang sedang berlangsung saat ini.</p>
            </div>
        )}
      </div>

      {/* Narrative AI Summary (Simple Box) */}
      {data?.daily_narrative && (
        <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30 flex gap-4 items-start">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl shrink-0">
                <Bot size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Analisis Belajar Hari Ini</h5>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {data.daily_narrative.replace(/\*\*/g, '')}
                </p>
            </div>
        </div>
      )}

      {/* Today's Schedule List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <CalendarDays size={14} /> Agenda Hari Ini
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-50 dark:divide-white/5">
                {schedule.map((s, idx) => (
                    <div key={idx} className={`p-4 flex items-center gap-4 ${s.status === 'ongoing' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : (s.status === 'completed' ? 'opacity-50' : '')}`}>
                        <div className="w-16 shrink-0 text-right">
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.start_time}</p>
                            <p className="text-[9px] text-slate-400 font-medium">{s.end_time}</p>
                        </div>
                        <div className={`w-1 h-8 rounded-full ${s.status === 'ongoing' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{s.subject_name}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate italic">{s.teacher_name}</p>
                        </div>
                        <div className="shrink-0">
                            <StatusBadge status={s.attendance_status} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="py-6 text-center">
            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
                Smart Monitoring System
            </p>
      </div>
    </div>
  );
}
