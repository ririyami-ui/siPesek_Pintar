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
    <div className="max-w-4xl mx-auto space-y-3">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-lg font-bold text-slate-800 dark:text-white">Rekap Presensi Sesi Pembelajaran</h1>
           <p className="text-xs text-slate-500">{data?.student?.name} · {data?.student?.class}</p>
         </div>
         <div className="text-right">
           <p className={`text-xl font-bold ${hadirPct >= 80 ? 'text-emerald-600' : hadirPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{hadirPct}%</p>
           <p className="text-[10px] text-slate-400">{overall.hadir ?? 0}/{totalDays} hari</p>
         </div>
       </div>

       {/* Overall summary inline */}
       <div className="flex gap-2">
         {STATUSES.map(s => (
           <div key={s.key} className={`flex-1 rounded-lg px-2 py-1.5 border ${s.bg} ${s.border} text-center`}>
             <p className={`text-sm font-bold ${s.color}`}>{overall[s.key] ?? 0}</p>
             <p className={`text-[9px] font-medium ${s.color}`}>{s.label}</p>
           </div>
         ))}
       </div>

      {/* View toggle */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setView('bySubject')}
          className={`flex-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${view === 'bySubject' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Per Mapel
        </button>
        <button
          onClick={() => setView('daily')}
          className={`flex-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${view === 'daily' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          Harian
        </button>
      </div>

      {/* Per Subject view */}
      {view === 'bySubject' && (
        <div className="space-y-2">
          {bySubject.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Belum ada data kehadiran.
            </div>
          ) : (
            bySubject.map((subj, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 dark:text-white text-xs truncate">{subj.subject_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${subj.pct_hadir}%` }} />
                      </div>
                      <span className={`text-[10px] font-medium ${subj.pct_hadir >= 80 ? 'text-emerald-600' : subj.pct_hadir >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                        {subj.pct_hadir}%
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`ml-2 text-slate-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`}
                  />
                </button>

                {expanded === i && (
                  <div className="px-3 pb-2 flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                    {STATUSES.map(s => (
                      <div key={s.key} className="flex-1 text-center">
                        <p className={`text-sm font-bold ${s.color}`}>{subj[s.key] ?? 0}</p>
                        <p className="text-[9px] text-slate-400">{s.label}</p>
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
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {daily.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">Belum ada riwayat.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
              {daily.map((d, i) => (
                <div key={i} className="flex items-center px-3 py-2 gap-3">
                  <div className="w-16 shrink-0">
                    <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{d.subject_name}</p>
                    {d.note && <p className="text-[9px] text-slate-400 truncate">{d.note}</p>}
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
