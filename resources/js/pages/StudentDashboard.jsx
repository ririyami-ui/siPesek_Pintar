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
    <div className="max-w-3xl mx-auto space-y-6 bg-gradient-to-b from-slate-50 to-emerald-50/10 dark:from-slate-900 dark:to-emerald-900/10 backdrop-blur-sm p-4 rounded-2xl shadow-lg">
      {/* Small Header Section */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {student?.photo_url ? (
                    <img src={student.photo_url} className="w-full h-full object-cover" alt="Student" />
                ) : (
                    <User size={16} className="text-slate-400" />
                )}
            </div>
            <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight truncate">{student?.name}</h1>
                <p className="text-[10px] font-medium text-slate-500 truncate">
                    Kelas {student?.class} · Absen {student?.absen}
                </p>
                <p className="text-[9px] font-medium text-slate-400 truncate mt-0.5">
                    NIS: {student?.nis || '-'} · NISN: {student?.nisn || '-'}
                </p>
            </div>
        </div>
        <div className="text-right shrink-0">
            <div className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {new Date(data?.server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">LIVE</div>
        </div>
      </div>

      {/* Holiday Banner */}
      {data?.holiday && (
        <div className="bg-amber-50/80 dark:bg-amber-950/40 backdrop-blur-md rounded-2xl p-4 border border-amber-200 dark:border-amber-900/30 flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl shrink-0">
            <CalendarDays size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{data.holiday.title}</p>
            {data.holiday.description && (
              <p className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/70">{data.holiday.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Focus: Current Learning */}
      {!data?.holiday && (
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <MonitorPlay size={14} /> Sedang Berlangsung
        </h3>

        {current ? (
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-6 border border-slate-100 dark:border-white/5 shadow-sm">
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
            <div className="bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-dashed border-slate-200 dark:border-white/5 text-center">
                <p className="text-sm text-slate-400 italic font-medium">Tidak ada pelajaran yang sedang berlangsung saat ini.</p>
            </div>
        )}
      </div>
      )}

      {/* Dimensi Profil Lulusan */}
      {data?.graduate_profile && data.graduate_profile.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <Bot size={14} /> Dimensi Profil Lulusan
            <span className="text-[9px] text-slate-400 font-normal normal-case">(BSKAP 2025)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.graduate_profile.map((dim, idx) => (
              <div key={idx} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    {dim.nama_dimensi}
                  </h4>
                </div>

                {/* Rincian / evidence */}
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3 italic border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                  {dim.rincian}
                </p>

                {/* Sumber data */}
                <div className="pt-2 border-t border-slate-50 dark:border-white/5">
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Sumber Data:</p>
                  <ul className="space-y-1">
                    {dim.sumber.map((s, si) => (
                      <li key={si} className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule List */}
      {!data?.holiday && (
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <CalendarDays size={14} /> Agenda Hari Ini
        </h3>

        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
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
      )}

      {/* Minimal Footer */}
      <div className="py-6 text-center">
            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">
                Smart Monitoring System
            </p>
      </div>
    </div>
  );
}
