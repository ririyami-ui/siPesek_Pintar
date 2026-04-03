import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, CheckCircle2, XCircle, AlertCircle, Filter,
  ChevronDown, TrendingUp, Calendar, Award
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const STATUSES = [
  { key: 'hadir', label: 'Hadir', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  { key: 'sakit', label: 'Sakit', color: 'text-amber-600',   bg: 'bg-amber-50   dark:bg-amber-950/30',   border: 'border-amber-200',   bar: 'bg-amber-400'   },
  { key: 'izin',  label: 'Izin',  color: 'text-blue-600',    bg: 'bg-blue-50    dark:bg-blue-950/30',    border: 'border-blue-200',    bar: 'bg-blue-400'    },
  { key: 'alpa',  label: 'Alpa',  color: 'text-red-600',     bg: 'bg-red-50     dark:bg-red-950/30',     border: 'border-red-200',     bar: 'bg-red-500'     },
];

function StatusBadge({ status }) {
  const cfg = STATUSES.find(s => s.key === status);
  if (!cfg) return <span className="text-xs text-slate-400">{status}</span>;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function PercentBar({ value, max = 100, color = 'bg-emerald-500' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StudentAttendance() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState('bySubject'); // 'bySubject' | 'daily'
  const [expanded, setExpanded] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/attendance');
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data kehadiran.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Memuat rekap kehadiran...</p>
    </div>
  );

  const overall    = data?.overall ?? {};
  const bySubject  = data?.by_subject ?? [];
  const daily      = data?.daily ?? [];
  const totalDays  = overall.total || 0;
  const hadirPct   = totalDays > 0 ? Math.round((overall.hadir / totalDays) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BookOpen size={22} className="text-emerald-600" />
          Rekap Kehadiran
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{data?.student?.name} · {data?.student?.class}</p>
      </div>

      {/* Overall summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => (
          <div key={s.key} className={`rounded-2xl p-4 border ${s.bg} ${s.border}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{overall[s.key] ?? 0}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.color}`}>{s.label}</p>
            <PercentBar value={overall[s.key] ?? 0} max={totalDays} color={s.bar} />
          </div>
        ))}
      </div>

      {/* Attendance percentage summary */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-emerald-600" />
            <span className="font-semibold text-slate-700 dark:text-white text-sm">Persentase Kehadiran (Total)</span>
          </div>
          <span className={`text-lg font-bold ${hadirPct >= 80 ? 'text-emerald-600' : hadirPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
            {hadirPct}%
          </span>
        </div>
        <div className="w-full h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${hadirPct >= 80 ? 'bg-emerald-500' : hadirPct >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${hadirPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">{overall.hadir ?? 0} dari {totalDays} pertemuan hadir</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('bySubject')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'bySubject' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Per Mata Pelajaran
        </button>
        <button
          onClick={() => setView('daily')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'daily' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Harian
        </button>
      </div>

      {/* Per Subject view */}
      {view === 'bySubject' && (
        <div className="space-y-3">
          {bySubject.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
              Belum ada data kehadiran.
            </div>
          ) : (
            bySubject.map((subj, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{subj.subject_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PercentBar value={subj.hadir} max={subj.total} color="bg-emerald-500" />
                      <span className={`text-xs font-medium shrink-0 ${subj.pct_hadir >= 80 ? 'text-emerald-600' : subj.pct_hadir >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {subj.pct_hadir}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`ml-4 text-slate-400 transition-transform shrink-0 ${expanded === i ? 'rotate-180' : ''}`}
                  />
                </button>

                {expanded === i && (
                  <div className="px-5 pb-4 grid grid-cols-4 gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                    {STATUSES.map(s => (
                      <div key={s.key} className="text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{subj[s.key] ?? 0}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Daily view */}
      {view === 'daily' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <Calendar size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-700 dark:text-white text-sm">Riwayat Kehadiran Harian</h2>
          </div>
          {daily.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">Belum ada riwayat.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[360px] overflow-y-auto custom-scrollbar">
              {daily.map((d, i) => (
                <div key={i} className="flex items-center px-5 py-3 gap-4">
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{d.subject_name}</p>
                    {d.planned_material ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                         Materi: {d.planned_material}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Materi tidak terjadwal</p>
                    )}
                    {d.note && <p className="text-[10px] text-slate-400 mt-0.5">Catatan: {d.note}</p>}
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
