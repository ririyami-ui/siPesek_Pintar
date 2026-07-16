import React, { useState, useEffect, useCallback } from 'react';
import {
  MonitorPlay, Clock, CheckCircle2, XCircle, AlertCircle,
  BookOpen, User, RefreshCw, Wifi, WifiOff,
  CalendarDays, School, Award, BarChart3, ShieldAlert, Bot, Ban
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

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
  const [summary, setSummary] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [realtimeRes, attendanceRes, gradesRes, infractionsRes] = await Promise.all([
        api.get('/student/realtime'),
        api.get('/student/attendance'),
        api.get('/student/grades'),
        api.get('/student/infractions'),
      ]);

      setData(realtimeRes.data);

      const attOverall = attendanceRes.data?.overall ?? {};
      const totalSesi = attOverall.total || 0;
      const kehadiranPct = totalSesi > 0
        ? Math.round((attOverall.hadir / totalSesi) * 100)
        : null;

      setSummary({
        kehadiran_pct: kehadiranPct,
        hadir: attOverall.hadir ?? 0,
        sakit: attOverall.sakit ?? 0,
        izin: attOverall.izin ?? 0,
        alpa: attOverall.alpa ?? 0,
        total_sesi: totalSesi,
        rata_nilai: gradesRes.data?.overall_nilai_akhir ?? null,
        by_subject: gradesRes.data?.by_subject ?? [],
        total_pelanggaran: infractionsRes.data?.total_points ?? 0,
        total_kejadian: infractionsRes.data?.total_count ?? 0,
      });
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

  const chartOptions = {
    cutout: '78%',
    plugins: { tooltip: { enabled: true }, legend: { display: false } },
    maintainAspectRatio: false,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Identity Card - Compact Student Info */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 shadow-sm overflow-hidden">
        <div className="p-3.5 sm:p-5">
          <div className="flex items-center gap-3">
            {/* Avatar small */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center overflow-hidden ring-2 ring-emerald-200/50 dark:ring-emerald-700/30">
                {student?.photo_url ? (
                  <img src={student.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <User size={18} className="text-emerald-500 dark:text-emerald-400" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-[1.5px] border-white dark:border-slate-800 flex items-center justify-center">
                <span className="text-[6px] text-white font-black">{student?.absen || '?'}</span>
              </div>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base font-black text-slate-800 dark:text-white leading-tight">
                {student?.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                  Kelas {student?.class}
                </span>
                <span className="text-[8px] text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[9px] font-medium text-slate-400">
                  {student?.gender === 'L' ? 'Laki-laki' : student?.gender === 'P' ? 'Perempuan' : '-'}
                </span>
              </div>
            </div>

            {/* Tiny clock */}
            <div className="text-right shrink-0">
              <div className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {new Date(data?.server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">LIVE</div>
            </div>
          </div>

          {/* Compact detail row */}
          <div className="mt-2.5 pt-2.5 border-t border-emerald-100/40 dark:border-emerald-900/20">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]">
              <span className="text-slate-400">NIS: <strong className="text-slate-700 dark:text-slate-200 font-mono">{student?.nis || '-'}</strong></span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-400">NISN: <strong className="text-slate-700 dark:text-slate-200 font-mono">{student?.nisn || '-'}</strong></span>
              <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">|</span>
              <span className="text-slate-400">Lahir: <strong className="text-slate-700 dark:text-slate-200">{student?.birth_place ? `${student.birth_place}, ${student.birth_date}` : (student?.birth_date || '-')}</strong></span>
            </div>
          </div>
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

      {/* Emergency Banner */}
      {data?.emergency_holiday && (
        <div className="bg-red-50/80 dark:bg-red-950/40 backdrop-blur-md rounded-2xl p-4 border border-red-200 dark:border-red-900/30 flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl shrink-0">
            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-700 dark:text-red-300">Peringatan: {data.emergency_holiday.title}</p>
            <p className="text-[10px] font-medium text-red-600/80 dark:text-red-400/70">
              {data.emergency_holiday.description ? `${data.emergency_holiday.description} · ` : ''}
              Blokir jam {data.emergency_holiday.start_time} - {data.emergency_holiday.end_time}
            </p>
          </div>
        </div>
      )}

      {/* Main Focus: Current Learning */}
      {(!data?.holiday || data?.emergency_holiday) && (
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

      {/* Today's Schedule List */}
      {(!data?.holiday || data?.emergency_holiday) && (
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <CalendarDays size={14} /> Agenda Hari Ini
        </h3>

        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-50 dark:divide-white/5">
                {schedule.map((s, idx) => (
                    <div key={idx} className={`p-4 flex items-center gap-4 ${s.status === 'ongoing' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : (s.status === 'completed' ? 'opacity-50' : '')} ${s.is_blocked ? 'bg-red-50/80 dark:bg-red-950/30' : ''}`}>
                        <div className="w-16 shrink-0 text-right">
                            <p className={`text-[11px] font-bold ${s.is_blocked ? 'text-red-500 dark:text-red-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{s.start_time}</p>
                            <p className={`text-[9px] ${s.is_blocked ? 'text-red-400 dark:text-red-500 line-through' : 'text-slate-400 font-medium'}`}>{s.end_time}</p>
                        </div>
                        <div className={`w-1 h-8 rounded-full ${s.is_blocked ? 'bg-red-400' : (s.status === 'ongoing' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700')}`} />
                        <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm truncate ${s.is_blocked ? 'text-red-600 dark:text-red-400 line-through' : 'text-slate-800 dark:text-white'}`}>{s.subject_name}</p>
                            <p className={`text-[10px] font-medium truncate italic ${s.is_blocked ? 'text-red-500/60 dark:text-red-400/60' : 'text-slate-400'}`}>{s.teacher_name}</p>
                        </div>
                        <div className="shrink-0">
                            {s.is_blocked ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                <Ban size={10} />
                                Diblokir
                              </div>
                            ) : (
                              <StatusBadge status={s.attendance_status} />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
      )}

      {/* Daily Narrative */}
      {data?.daily_narrative && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/40 backdrop-blur-md rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/30 flex gap-4 items-start">
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

      {/* Overall Summary Cards */}
      {summary && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
            <BarChart3 size={14} /> Ringkasan Belajar
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Kehadiran - Doughnut */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                  <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Kehadiran</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0">
                  {summary.total_sesi > 0 ? (
                    <Doughnut
                      data={{
                        labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
                        datasets: [{
                          data: [
                            Math.round((summary.hadir / summary.total_sesi) * 100),
                            Math.round((summary.sakit / summary.total_sesi) * 100),
                            Math.round((summary.izin / summary.total_sesi) * 100),
                            Math.round((summary.alpa / summary.total_sesi) * 100),
                          ],
                          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
                          borderWidth: 0,
                        }]
                      }}
                      options={chartOptions}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <BookOpen size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-slate-800 dark:text-white">
                    {summary.kehadiran_pct !== null ? `${summary.kehadiran_pct}%` : 'N/A'}
                  </p>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-500 dark:text-slate-400">{summary.hadir} Hadir</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-slate-500 dark:text-slate-400">{summary.sakit} Sakit</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="text-slate-500 dark:text-slate-400">{summary.izin} Izin</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-slate-500 dark:text-slate-400">{summary.alpa} Alpa</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nilai - Per Subject */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <Award size={14} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rata Nilai Per Mapel</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 shrink-0">
                  {summary.by_subject?.length > 0 ? (
                    <Doughnut
                      data={{
                        labels: summary.by_subject.map(s => s.subject_name),
                        datasets: [{
                          data: summary.by_subject.map(s => s.nilai_akhir),
                          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
                          borderWidth: 0,
                        }]
                      }}
                      options={{
                        cutout: '72%',
                        plugins: { tooltip: { enabled: true }, legend: { display: false } },
                        maintainAspectRatio: false,
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <Award size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-3 gap-y-1">
                  {summary.by_subject?.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i % 8] }} />
                      <span className="text-slate-500 dark:text-slate-400 truncate">{s.subject_name}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 ml-auto">{s.nilai_akhir}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pelanggaran - Doughnut */}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl p-4 border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/40">
                  <ShieldAlert size={14} className="text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pelanggaran</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0">
                  <Doughnut
                    data={{
                      labels: ['Point', 'Sisa'],
                      datasets: [{
                        data: [Math.min(summary.total_pelanggaran, 100), Math.max(100 - summary.total_pelanggaran, 0)],
                        backgroundColor: ['#ef4444', '#fee2e2'],
                        borderWidth: 0,
                      }]
                    }}
                    options={chartOptions}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-slate-800 dark:text-white">
                    {summary.total_pelanggaran > 0 ? summary.total_pelanggaran : 0}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    {summary.total_kejadian} kejadian tercatat
                  </p>
                </div>
              </div>
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
