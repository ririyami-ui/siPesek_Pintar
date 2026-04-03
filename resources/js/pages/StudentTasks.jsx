import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, AlertTriangle, BookOpen, ChevronLeft, ChevronRight, CheckCircle2, FileSearch, Calendar, FileX } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const TYPE_LABELS = {
  harian: 'Harian',
  praktik: 'Praktik',
  uts: 'Tengah Semester',
  uas: 'Akhir Semester',
  formatif: 'Ulangan',
  sumatif: 'Ulangan/Tes',
  tugas: 'Tugas Mandiri',
};

function TaskCard({ task }) {
  const isGrade  = task.type === 'grade';
  const isDone   = task.status === 'Selesai';
  const isLow    = isGrade && task.score > 0 && task.score < 75;
  const typeLabel = TYPE_LABELS[task.assessment_type?.toLowerCase()] ?? task.assessment_type;

  return (
    <div className={`p-5 rounded-[2.5rem] border transition-all duration-300 hover:shadow-xl shrink-0 w-[310px] relative flex flex-col ${
      isDone 
        ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' 
        : (isGrade ? 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/30' : 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30')
    }`}>
      {/* Top Status Indicator - Centang Kecil */}
      {isDone && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-md animate-fade-in-premium">
          <CheckCircle2 size={12} className="text-white" />
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
            isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : (isGrade ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700')
          }`}>
            {typeLabel}
          </span>
          {task.date && (
            <span className="text-[10px] text-slate-400 font-bold">
              {new Date(task.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        <p className="font-bold text-slate-800 dark:text-white text-[11px] leading-snug line-clamp-2 mb-2 min-h-[2.2rem]">{task.topic}</p>

        {task.planned_material && (
          <div className="bg-white/40 dark:bg-black/20 rounded-xl px-2.5 py-1.5 mb-2 border border-white/50 dark:border-white/5">
            <p className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mb-0.5">Materi</p>
            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-tight line-clamp-2">{task.planned_material}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className={`text-[9px] font-black uppercase tracking-wider ${isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
            {task.status}
          </span>
          {isGrade && task.score > 0 && (
            <span className={`text-base font-black ${isLow ? 'text-red-600 animate-pulse' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {task.score}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentTasks() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/tasks');
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data tugas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm font-bold tracking-widest uppercase">Mengevaluasi Progres...</p>
    </div>
  );

  const all = data?.missing_tasks ?? [];
  const filtered = filter === 'all' ? all : all.filter(t => t.type === filter);
  
  const pendingGrades = all.filter(t => t.type === 'grade' && (!t.score || t.score <= 0));
  const lowGrades     = all.filter(t => t.type === 'grade' && t.score > 0 && t.score < 75);
  const pendingTasks  = all.filter(t => t.type === 'task'  && t.status !== 'Selesai');
  
  const totalAttention = pendingGrades.length + pendingTasks.length + lowGrades.length;

  const totalGrade = all.filter(t => t.type === 'grade').length;
  const totalTask  = all.filter(t => t.type === 'task').length;

  const grouped = filtered.reduce((acc, task) => {
    const sName = task.subject_name || 'Lainnya';
    if (!acc[sName]) acc[sName] = [];
    acc[sName].push(task);
    return acc;
  }, {});

  const subjectNames = Object.keys(grouped).sort();

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-premium pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <ClipboardList size={28} className="text-emerald-500" />
            Timeline Belajar
          </h1>
          <p className="text-sm text-slate-500 font-medium">Jejak capaian kompetensi akademik</p>
        </div>
      </div>

      {/* Summary Banner (Only shown if attention is needed) */}
      {totalAttention > 0 && (
        <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-[2.5rem] p-7 text-white shadow-xl relative overflow-hidden">
          <AlertTriangle className="absolute -bottom-4 -right-4 w-36 h-36 text-white/10 rotate-12" />
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-md">
              <ClipboardList size={36} />
            </div>
            <div>
              <p className="text-4xl font-black tracking-tighter">{totalAttention}</p>
              <p className="text-lg font-bold text-white/90">Hasil Belum Optimal</p>
              <p className="text-xs text-white/70 mt-1 leading-relaxed max-w-sm">
                {pendingGrades.length > 0 && `${pendingGrades.length} Belum Dinilai`}
                {pendingGrades.length > 0 && (lowGrades.length > 0 || pendingTasks.length > 0) && ' · '}
                {lowGrades.length > 0 && `${lowGrades.length} Capaian di Bawah Target (Kktp)`}
                {(lowGrades.length > 0 || pendingGrades.length > 0) && pendingTasks.length > 0 && ' · '}
                {pendingTasks.length > 0 && `${pendingTasks.length} Tugas Mandiri`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {all.length > 0 && (
        <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-3xl w-fit mx-auto shadow-sm border border-slate-200 dark:border-white/5">
          {[
            { key: 'all',   label: `Semua` },
            { key: 'grade', label: `Nilai` },
            { key: 'task',  label: `Tugas` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-8 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${filter === tab.key ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
            >
              {tab.label} {all.length > 0 && <span className="ml-1 opacity-50">{all.length > 0 && (tab.key === 'all' ? all.length : (tab.key === 'grade' ? totalGrade : totalTask))}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Main Timeline Body */}
      {subjectNames.length > 0 && (
        <div className="space-y-12">
          {subjectNames.map((sName) => {
            const items = [...grouped[sName]].sort((a, b) => new Date(a.date) - new Date(b.date));
            return (
              <div key={sName} className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                      <BookOpen size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">{sName}</h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{items.length} Jejak Belajar</p>
                    </div>
                  </div>
                  
                  {/* Premium Scroll Hint */}
                  <div className="hidden sm:flex items-center gap-2 text-slate-300">
                    <ChevronLeft size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Geser Timeline</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                {/* The Timeline Row */}
                <div className="relative">
                  {/* Scrollable Container */}
                  <div className="flex overflow-x-auto gap-4 pt-6 pb-6 px-1 no-scrollbar scroll-smooth">
                    {items.map((task, i) => (
                      <TaskCard key={`${sName}-${i}`} task={task} />
                    ))}
                    
                    {/* End Cap */}
                    <div className="shrink-0 w-10 flex items-center justify-center" />
                  </div>

                  {/* Right Edge Fade Shadow (Premium Signal) */}
                  <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-white/90 dark:from-slate-900/90 to-transparent pointer-events-none z-10" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subjectNames.length === 0 && all.length > 0 && (
        <div className="text-center py-20 bg-slate-50 dark:bg-slate-950/20 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800/50">
           <FileSearch size={48} className="mx-auto text-slate-300 mb-4" />
           <p className="text-slate-500 font-bold">Tidak ada item dalam kategori ini.</p>
        </div>
      )}
    </div>
  );
}
