import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertOctagon, Info, Calendar, ChevronDown, ChevronUp, History } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export default function StudentInfractions() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/infractions');
      setData(res.data);
    } catch {
      toast.error('Gagal memuat catatan pelanggaran.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-slate-500">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm">Memuat catatan pelanggaran...</p>
    </div>
  );

  const records = data?.records ?? [];
  const byCategory = data?.by_category ?? [];
  const totalPoints = data?.total_points ?? 0;
  const penalty = data?.penalty ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in-premium">
      {/* Header */}
      <div className="flex justify-between items-end px-1">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert size={18} className="text-emerald-600" />
            Catatan Pelanggaran
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">{data?.student?.name} · {data?.student?.class}</p>
        </div>
        <div className="text-right">
           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Kejadian</span>
           <p className="text-base font-black text-slate-700 dark:text-slate-300 leading-none">{records.length}</p>
        </div>
      </div>

      {/* Overview Cards (Shrunk) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`p-4 rounded-3xl text-white shadow-md relative overflow-hidden ${totalPoints > 0 ? 'bg-gradient-to-br from-rose-500 to-orange-600' : 'bg-gradient-to-br from-emerald-600 to-teal-700'}`}>
          <div className="absolute top-0 right-0 p-2 opacity-10 rotate-12 scale-125">
             <AlertOctagon size={60} />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Akumulasi Poin</p>
              <p className="text-3xl font-black mt-1">{totalPoints}</p>
            </div>
            <div className="bg-white/20 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-tight flex items-center gap-1.5 self-end mb-1">
              <History size={10} /> {records.length} Riwayat
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-3xl border-2 shadow-sm flex flex-col justify-center relative ${penalty > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30'}`}>
          <p className={`${penalty > 0 ? 'text-rose-600' : 'text-emerald-700'} text-[10px] font-black uppercase tracking-widest mb-1.5`}>Estimasi Nilai Sikap</p>
          <div className="flex items-center gap-2">
            <div className={`text-2xl font-black ${penalty > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <span className="opacity-40 text-lg">100 - {penalty} =</span> {Math.max(0, 100 - penalty)}
            </div>
          </div>
        </div>
      </div>

      {/* Simplified Grouped History (Shrunk) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ringkasan Riwayat</h3>
           <span className="text-[9px] font-bold text-slate-300 lowercase italic">Klik untuk detail</span>
        </div>

        {byCategory.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center border border-slate-100 dark:border-white/5 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert size={24} className="text-emerald-500" />
            </div>
            <p className="font-black text-slate-800 dark:text-white text-base">Luar Biasa!</p>
            <p className="text-xs text-slate-500 font-medium">Ananda belum memiliki catatan pelanggaran.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {byCategory.map((cat, idx) => {
              const isOpen = expandedCat === idx;
              const catRecords = records.filter(r => r.category === cat.category);
              
              return (
                <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden transition-all duration-300">
                  {/* Category Header (More Compact) */}
                  <button 
                    onClick={() => setExpandedCat(isOpen ? null : idx)}
                    className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors ${isOpen ? 'bg-slate-50 dark:bg-slate-900/50' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cat.total_points > 10 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                      <AlertOctagon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">{cat.category}</h4>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">({cat.count}x)</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        Terakhir: {new Date(cat.latest_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right mr-1">
                      <p className="text-xs font-black text-rose-500">+{cat.total_points}</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                  </button>

                  {/* Expanded Detail List (Shrunk) */}
                  {isOpen && (
                    <div className="border-t border-slate-50 dark:border-white/5 bg-white dark:bg-slate-800 divide-y divide-slate-50 dark:divide-white/5 animate-slide-down">
                      {catRecords.map((rec) => (
                        <div key={rec.id} className="p-3 pl-14 flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Calendar size={10} className="text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                {new Date(rec.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed italic">
                              "{rec.description || 'Tidak ada keterangan spesifik.'}"
                            </p>
                          </div>
                          <div className="shrink-0 pt-2 text-[9px] font-bold text-slate-400">
                             +{rec.points}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
