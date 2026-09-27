import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, ChevronDown, Pin } from 'lucide-react';
import api from '../lib/axios';
import moment from 'moment';
import 'moment/locale/id';

const AUDIENCE_LABEL = {
  all: 'Semua',
  admin: 'Admin',
  teacher: 'Guru',
  staff: 'Staf',
  student: 'Siswa',
  parent: 'Orang Tua',
};

const AUDIENCE_COLOR = {
  all: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  teacher: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  student: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  parent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
};

const AnnouncementWidget = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data?.data ?? []);
    } catch (err) {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return null;

  const pinned = announcements.filter(a => a.is_pinned);
  const visible = [...pinned, ...announcements.filter(a => !a.is_pinned)]
    .slice(0, isOpen ? announcements.length : 3);

  if (visible.length === 0) return null;

  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
            <Megaphone size={14} />
            Pengumuman Sekolah
          </h5>
          {announcements.length > 3 && (
            <button
              type="button"
              onClick={() => setIsOpen(v => !v)}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
            >
              {isOpen ? 'Tutup' : `Lihat ${announcements.length}`}
              <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visible.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-100 dark:border-white/5 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  <Megaphone size={15} className="text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.is_pinned && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                        <Pin size={9} /> Penting
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${AUDIENCE_COLOR[a.audience] || AUDIENCE_COLOR.all}`}>
                      {AUDIENCE_LABEL[a.audience] || a.audience}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      {moment(a.published_at || a.created_at).locale('id').format('D MMM YYYY')}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 leading-snug">
                    {a.title}
                  </p>
                </div>
                <ChevronDown
                  size={14}
                  className={`shrink-0 mt-0.5 text-slate-300 dark:text-slate-600 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedId === a.id && (
                <div className="px-3 pb-3 pl-[38px] text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium animate-fade-in">
                  <p className="whitespace-pre-wrap">{a.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementWidget;