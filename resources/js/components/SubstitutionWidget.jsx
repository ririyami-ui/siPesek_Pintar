import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, UserCheck, UserX, Loader2, Clock, BookOpen, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const DETECTION_LABELS = {
  no_journal: 'Tidak ada jurnal',
  no_attendance: 'Tidak ada absensi',
  both: 'Jurnal & absensi kosong',
};

export default function SubstitutionWidget() {
  const [data, setData] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState({});
  const [lastDetect, setLastDetect] = useState(null);
  const mounted = useRef(true);

  const fetchSubstitutions = useCallback(async () => {
    try {
      const res = await api.get('/admin/substitutions');
      setData(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch substitutions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Auto-detect on mount
    api.post('/admin/substitutions/detect').then(res => {
      if (mounted.current) {
        setData(res.data.data || []);
        setLastDetect(new Date());
      }
    }).catch(() => {}).finally(() => {
      if (mounted.current) setLoading(false);
    });

    return () => { mounted.current = false; };
  }, []);

  const handleSuggest = async (id) => {
    setSuggesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.get(`/admin/substitutions/${id}/suggest`);
      setSuggestions(prev => ({ ...prev, [id]: res.data.data || [] }));
    } catch (err) {
      toast.error('Gagal mencari guru pengganti.');
    } finally {
      setSuggesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAssign = async (recId, teacherId, teacherName) => {
    try {
      await api.post(`/admin/substitutions/${recId}/assign`, { teacher_id: teacherId });
      toast.success(`${teacherName} ditugaskan sebagai pengganti!`);
      setData(prev => prev.map(r => r.id === recId ? { ...r, status: 'approved', substitute_teacher_id: teacherId } : r));
      setSuggestions(prev => ({ ...prev, [recId]: [] }));
    } catch (err) {
      toast.error('Gagal menugaskan pengganti.');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/admin/substitutions/${id}/dismiss`);
      toast.success('Rekomendasi diabaikan.');
      setData(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error('Gagal mengabaikan.');
    }
  };

  const pending = data.filter(r => r.status === 'pending');
  const approved = data.filter(r => r.status === 'approved');

  if (loading) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Substitusi Guru</h3>
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {pending.length} butuh tindakan
            </span>
          )}
        </div>
        <button onClick={() => { setLoading(true); api.post('/admin/substitutions/detect').then(r => { setData(r.data.data || []); setLastDetect(new Date()); }).finally(() => setLoading(false)); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Deteksi ulang">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
        {pending.length === 0 && approved.length === 0 && (
          <div className="p-6 text-center text-slate-400 text-sm">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-40" />
            <p>Tidak ada jadwal bermasalah hari ini</p>
          </div>
        )}

        {pending.map(rec => (
          <div key={rec.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">
                    {rec.class?.rombel || '-'}
                  </p>
                  <span className="text-[10px] font-medium text-slate-400">·</span>
                  <p className="font-medium text-slate-600 dark:text-slate-300 text-sm truncate">
                    {rec.subject?.name || '-'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock size={10} />
                    {rec.start_time} - {rec.end_time}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    <BookOpen size={10} />
                    {rec.original_teacher?.name || '-'}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    rec.detection_method === 'both' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {DETECTION_LABELS[rec.detection_method] || rec.detection_method}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleSuggest(rec.id)}
                  disabled={suggesting[rec.id]}
                  className="px-2.5 py-1.5 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  {suggesting[rec.id] ? <Loader2 size={12} className="animate-spin" /> : 'Cari'}
                </button>
                <button
                  onClick={() => handleDismiss(rec.id)}
                  className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>

            {/* Suggestions */}
            {suggestions[rec.id] && suggestions[rec.id].length > 0 && (
              <div className="mt-3 pl-5 border-l-2 border-blue-200 dark:border-blue-800 space-y-1.5">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Guru Tersedia:</p>
                {suggestions[rec.id].map(t => (
                  <div key={t.id} className="flex items-center justify-between py-1.5 px-2.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{t.name}</p>
                      {t.nip && <p className="text-[9px] text-slate-400">NIP. {t.nip}</p>}
                    </div>
                    <button
                      onClick={() => handleAssign(rec.id, t.id, t.name)}
                      className="px-2 py-1 text-[9px] font-bold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {suggestions[rec.id] && suggestions[rec.id].length === 0 && (
              <div className="mt-3 pl-5 border-l-2 border-slate-200 dark:border-slate-600">
                <p className="text-[10px] text-slate-400 italic">Tidak ada guru tersedia</p>
              </div>
            )}
          </div>
        ))}

        {approved.map(rec => (
          <div key={rec.id} className="p-4 opacity-60">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <p className="text-sm text-slate-600 dark:text-slate-400 line-through">
                {rec.class?.rombel} - {rec.subject?.name}
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">→ {rec.substitute_teacher?.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
