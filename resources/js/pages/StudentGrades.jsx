import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, ChevronDown, FileText, BookOpen, Award, Info, Hand, Scale, RefreshCw,
  TrendingUp, TrendingDown, Minus, AlertTriangle, Brain
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import RadarChart from '../components/RadarChart';

const TYPE_COLORS = {
  'formatif':  'bg-blue-100   text-blue-700   border-blue-200',
  'sumatif':   'bg-purple-100 text-purple-700  border-purple-200',
  'harian':    'bg-cyan-100   text-cyan-700    border-cyan-200',
  'uts':       'bg-orange-100 text-orange-700  border-orange-200',
  'uas':       'bg-red-100    text-red-700     border-red-200',
  'praktik':   'bg-emerald-100 text-emerald-700 border-emerald-200',
  'tugas':     'bg-amber-100  text-amber-700   border-amber-200',
};

function getPredikat(score) {
  if (score >= 90) return { label: 'A', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  if (score >= 80) return { label: 'B', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (score >= 70) return { label: 'C', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { label: 'D', color: 'text-red-600 bg-red-50 border-red-200' };
}

function ScoreBar({ score }) {
  const pct = Math.min(score, 100);
  const color = score >= 80 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${score >= 80 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
        {score % 1 === 0 ? score : score.toFixed(1)}
      </span>
    </div>
  );
}

function ScoreBadge({ score }) {
  const v = parseFloat(score);
  if (isNaN(v)) return <span className="text-xs text-slate-400 italic">N/A</span>;
  const color = v >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
              : v >= 70 ? 'text-amber-600 bg-amber-50 border-amber-200'
              : 'text-red-600 bg-red-50 border-red-200';
  return (
    <span className={`inline-flex items-center font-bold text-sm px-2.5 py-0.5 rounded-full border ${color}`}>
      {v % 1 === 0 ? v : v.toFixed(1)}
    </span>
  );
}

function TypeBadge({ type }) {
  const cls = TYPE_COLORS[type?.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium border ${cls} capitalize`}>
      {type ?? '-'}
    </span>
  );
}

function RadialProgress({ percent, size = 72, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  const color = percent >= 80 ? '#10b981' : percent >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
        {Math.round(percent)}
      </text>
    </svg>
  );
}

export default function StudentGrades() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('summary');
  const [expanded, setExpanded]   = useState(null);
  const [expandedType, setExpandedType] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/grades');
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data nilai.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Memuat data nilai...</p>
    </div>
  );

  const bySubject   = data?.by_subject ?? [];
  const sorted      = [...bySubject].sort((a, b) => b.nilai_akhir - a.nilai_akhir);
  const overallAvg  = bySubject.length > 0
    ? Math.round(bySubject.reduce((s, x) => s + (x.nilai_akhir || 0), 0) / bySubject.length)
    : 0;
  const overallPred = getPredikat(overallAvg);

  const infractionSummary = data?.infraction_summary;
  const penalty = infractionSummary?.penalty ?? 0;
  const weights = data?.weights;

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart2 size={22} className="text-emerald-600" />
            Laporan Nilai
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.student?.name} · {data?.student?.class}</p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors font-medium disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Overall banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-white flex items-center gap-5">
        <RadialProgress percent={overallAvg} size={88} stroke={8} />
        <div className="flex-1">
          <p className="text-white/70 text-sm">Rata-rata Nilai Akhir Keseluruhan</p>
          <div className="flex items-baseline gap-3 mt-1">
            <p className="text-4xl font-bold">{overallAvg}</p>
            <span className="text-xl font-bold text-white/70">/ 100</span>
          </div>
          <p className="text-white/60 text-xs mt-1">
            {bySubject.length} mapel · {data?.total_grades ?? 0} total penilaian
          </p>
        </div>
        <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black bg-white/20">
          {overallPred.label}
        </div>
      </div>

      {/* Weights Settings Information */}
      {weights && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex flex-shrink-0 items-center justify-center">
            <Scale size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-700 dark:text-blue-400 text-sm">
              Sistem Penilaian {weights.is_custom ? '(Kesepakatan Kelas)' : '(Standar)'}
            </p>
            <p className="text-blue-600 dark:text-blue-300 text-xs mt-0.5">
              Nilai Akhir: <b>{weights.academic}% Akademik</b> + <b>{weights.attitude}% Sikap.</b><br/>
              Khusus Akademik: <b>{weights.knowledge}% Pengetahuan</b> + <b>{weights.practice}% Praktik.</b>
            </p>
          </div>
        </div>
      )}

      {/* Behavior / Penalty Banner */}
      <div className={`border rounded-2xl p-4 flex items-start sm:items-center gap-3 ${
        penalty > 0 
          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
      }`}>
        <div className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center ${
          penalty > 0 ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
        }`}>
          {penalty > 0 ? <Hand size={18} /> : <Award size={18} />}
        </div>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${penalty > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {penalty > 0 ? 'Pengurangan Poin Tata Tertib' : 'Nilai Sikap Sempurna (100)'}
          </p>
          <p className={`text-xs mt-0.5 ${penalty > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
            {penalty > 0 
              ? <>Tercatat <b>{infractionSummary?.total_points}</b> poin pelanggaran. <b>Nilai Sikap ({weights?.attitude}%)</b> otomatis <b>dikurangi {penalty} angka</b> menurut kesepakatan.</>
              : <>Luar biasa! Tidak ada pelanggaran yang tercatat. Anda otomatis mendapatkan <b>Nilai Sikap 100</b> di semua mata pelajaran sesuai kesepakatan.</>
            }
          </p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('summary')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'summary' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          <FileText size={14} />
          Rekap Nilai
        </button>
        <button
          onClick={() => setView('detail')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'detail' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          <BookOpen size={14} />
          Detail Per Mapel
        </button>
        <button
          onClick={() => setView('analysis')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${view === 'analysis' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          <Brain size={14} />
          Analisis Karakter
        </button>
      </div>

      {/* ── ANALYSIS / RADAR CHART ── */}
      {view === 'analysis' && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Early Warning / Notifikasi Wali Murid */}
          {(data?.warnings?.length > 0) && (
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/50 rounded-xl">
                  <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="font-black text-rose-900 dark:text-rose-100 uppercase tracking-widest text-xs">Catatan Penting Wali Murid</h3>
              </div>
              <ul className="space-y-3">
                {data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-bold text-rose-700 dark:text-rose-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Profil Pelajar Pancasila</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Analisis ini mencakup 8 dimensi karakter siswa berdasarkan integrasi data akademik, kedisiplinan, dan presensi di sekolah.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(data?.radar_data || {}).map(([key, val]) => (
                    <div key={key} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{key}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${val}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{val}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-[350px] aspect-square flex items-center justify-center bg-slate-50 dark:bg-slate-900/30 rounded-[2rem] p-4">
                {data?.radar_data && <RadarChart data={data.radar_data} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUMMARY / RAPOR TABLE ── */}
      {view === 'summary' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            <Award size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-700 dark:text-white text-sm">Nilai Per Mata Pelajaran</h2>
            <span className="ml-auto text-xs text-slate-400">{bySubject.length} mata pelajaran</span>
          </div>

          {bySubject.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <BarChart2 size={36} className="mx-auto mb-2 opacity-30" />
              Belum ada data nilai.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-5 py-3 text-left font-semibold">No</th>
                      <th className="px-5 py-3 text-left font-semibold">Mata Pelajaran</th>
                      <th className="px-5 py-3 text-center font-semibold">Jml Penilaian</th>
                      <th className="px-5 py-3 text-left font-semibold w-52">Nilai Akhir (Terbobot)</th>
                      <th className="px-5 py-3 text-center font-semibold">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sorted.map((subj, i) => {
                      const pred = getPredikat(subj.nilai_akhir);
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-3.5 text-slate-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-white">{subj.subject_name}</td>
                          <td className="px-5 py-3.5 text-center text-slate-500 text-xs">{subj.total_input}</td>
                          <td className="px-5 py-3.5 min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <ScoreBar score={subj.nilai_akhir} />
                              </div>
                              {subj.trend === 'up' && <TrendingUp size={16} className="text-emerald-500 shrink-0 animate-bounce" title="Meningkat" />}
                              {subj.trend === 'down' && <TrendingDown size={16} className="text-red-500 shrink-0 animate-pulse" title="Menurun" />}
                              {subj.trend === 'stable' && <Minus size={14} className="text-slate-300 shrink-0" title="Stabil" />}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex w-8 h-8 rounded-lg text-sm font-black border items-center justify-center ${pred.color}`}>
                              {pred.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 dark:bg-emerald-950/20 border-t-2 border-emerald-200 dark:border-emerald-800">
                      <td colSpan={2} className="px-5 py-3 font-bold text-slate-700 dark:text-white text-sm">
                        Rata-rata Keseluruhan
                      </td>
                      <td className="px-5 py-3 text-center text-slate-500 text-xs">{data?.total_grades ?? 0}</td>
                      <td className="px-5 py-3 min-w-[180px]">
                        <ScoreBar score={overallAvg} />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex w-8 h-8 rounded-lg text-sm font-black border items-center justify-center ${overallPred.color}`}>
                          {overallPred.label}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                {sorted.map((subj, i) => {
                  const pred = getPredikat(subj.nilai_akhir);
                  return (
                    <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-6 text-xs text-slate-400 shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-white text-sm truncate">{subj.subject_name}</p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="flex-1">
                            <ScoreBar score={subj.nilai_akhir} />
                          </div>
                          {subj.trend === 'up' && <TrendingUp size={14} className="text-emerald-500 shrink-0" />}
                          {subj.trend === 'down' && <TrendingDown size={14} className="text-red-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{subj.total_input} penilaian</p>
                      </div>
                      <span className={`inline-flex w-9 h-9 rounded-xl text-base font-black border items-center justify-center shrink-0 ${pred.color}`}>
                        {pred.label}
                      </span>
                    </div>
                  );
                })}
                {/* Mobile footer */}
                <div className="px-4 py-3.5 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="w-6 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-sm">Rata-rata Keseluruhan</p>
                    <div className="mt-1.5">
                      <ScoreBar score={overallAvg} />
                    </div>
                  </div>
                  <span className={`inline-flex w-9 h-9 rounded-xl text-base font-black border items-center justify-center shrink-0 ${overallPred.color}`}>
                    {overallPred.label}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DETAIL CARDS ── */}
      {view === 'detail' && (
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <BarChart2 size={36} className="mx-auto mb-2 opacity-30" />
              Belum ada data nilai.
            </div>
          ) : (
            sorted.map((subj, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <RadialProgress percent={subj.nilai_akhir} size={52} stroke={5} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{subj.subject_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Akademik <b>{subj.nilai_akademik}</b> <span className="opacity-50">/</span> Sikap <b>{subj.nilai_sikap}</b>
                    </p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ${expanded === i ? 'rotate-180' : ''}`} />
                </button>

                {expanded === i && (
                  <div className="border-t border-slate-100 dark:border-slate-700">
                    {/* Detail Komponen Akademik */}
                    <div className="px-5 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex divide-x divide-blue-200 dark:divide-blue-800">
                      <div className="flex-1 text-center px-2">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400/70 tracking-wider">Pengetahuan</p>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mt-0.5">{subj.avg_knowledge}</p>
                      </div>
                      <div className="flex-1 text-center px-2">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400/70 tracking-wider">Praktik</p>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mt-0.5">{subj.avg_practice}</p>
                      </div>
                    </div>

                    {subj.by_type.map((typeGroup, ti) => (
                      <div key={ti}>
                        <button
                          className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={() => setExpandedType(prev => ({ ...prev, [`${i}-${ti}`]: !prev[`${i}-${ti}`] }))}
                        >
                          <div className="flex items-center gap-2">
                            <TypeBadge type={typeGroup.type} />
                            <span className="text-xs text-slate-500">{typeGroup.count} item</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={typeGroup.average} />
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedType[`${i}-${ti}`] ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {expandedType[`${i}-${ti}`] && (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {typeGroup.records.map((rec, ri) => (
                              <div key={ri} className="flex items-center gap-3 px-6 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {rec.topic || 'Tidak ada keterangan'}
                                  </p>
                                  {rec.date && (
                                    <p className="text-xs text-slate-400">
                                      {new Date(rec.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                                <ScoreBadge score={rec.score} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
