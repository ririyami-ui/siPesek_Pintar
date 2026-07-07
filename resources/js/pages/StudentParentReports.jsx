import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FileText, ChevronRight, CalendarDays, CheckCircle2,
  Clock, User, BarChart3, Award, ScrollText, Loader2,
  Eye, EyeOff, Activity, BookOpen, ShieldAlert, TrendingUp
} from 'lucide-react';
import api from '../lib/axios';

const TYPE_LABELS = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
};

export default function StudentParentReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parent-reports');
      setReports(res.data.reports || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (report) => {
    try {
      const res = await api.get(`/parent-reports/${report.id}`);
      setSelectedReport(res.data.report);
    } catch (err) {
      console.error('Failed to fetch report detail:', err);
    }
  };

  const filtered = filter === 'all' 
    ? reports 
    : reports.filter(r => r.type === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileText className="text-emerald-600" size={24} />
            Laporan Perkembangan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ringkasan perkembangan ananda secara periodik
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'weekly', 'monthly'].map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === t
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {t === 'all' ? 'Semua' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 dark:text-slate-500">
          <FileText size={48} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Belum ada laporan</p>
          <p className="text-sm mt-1">Laporan akan muncul setelah cron job berjalan (Minggu 19:00 / tgl 1 07:00)</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(report => (
            <div
              key={report.id}
              onClick={() => openDetail(report)}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    report.type === 'weekly' 
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' 
                      : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600'
                  }`}>
                    {report.type === 'weekly' ? <CalendarDays size={20} /> : <BarChart3 size={20} />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-white">
                      {TYPE_LABELS[report.type]} — {report.period_label}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={12} />
                        {report.period_start} s/d {report.period_end}
                      </span>
                      {report.is_sent && (
                        <span className="flex items-center gap-1 text-emerald-500">
                          <CheckCircle2 size={12} />
                          Terkirim
                        </span>
                      )}
                      {report.read_at ? (
                        <span className="flex items-center gap-1 text-blue-500">
                          <Eye size={12} />
                          Dibaca
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <EyeOff size={12} />
                          Belum dibaca
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {report.stats && (
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                      {report.stats.avg_nilai_akhir && (
                        <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-lg font-medium">
                          Nilai{' '}{Math.round(report.stats.avg_nilai_akhir)}
                        </span>
                      )}
                      {report.stats.keaktifan !== undefined && report.stats.keaktifan > 0 && (
                        <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 px-2 py-1 rounded-lg font-medium">
                          +{report.stats.keaktifan} poin
                        </span>
                      )}
                    </div>
                  )}
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-20 px-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedReport(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80 font-medium">{TYPE_LABELS[selectedReport.type]} — {selectedReport.period_label}</p>
                  <p className="text-lg font-bold mt-1">Laporan Perkembangan Ananda</p>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-white/80">
                <span className="flex items-center gap-1"><CalendarDays size={14} /> {selectedReport.period_start} s/d {selectedReport.period_end}</span>
                {selectedReport.is_sent && <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Terkirim</span>}
              </div>
            </div>

            {/* Stats Cards */}
            {selectedReport.stats && (
              <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {selectedReport.stats.avg_nilai_akhir && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{Math.round(selectedReport.stats.avg_nilai_akhir)}</p>
                    <p className="text-xs text-slate-500 mt-1">Nilai Akhir</p>
                  </div>
                )}
                {selectedReport.stats.attendance?.percentage !== undefined && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedReport.stats.attendance.percentage}%</p>
                    <p className="text-xs text-slate-500 mt-1">Kehadiran</p>
                  </div>
                )}
                {selectedReport.stats.infraction_points !== undefined && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{selectedReport.stats.infraction_points}</p>
                    <p className="text-xs text-slate-500 mt-1">Poin Pelanggaran</p>
                  </div>
                )}
                {selectedReport.stats.total_keaktifan !== undefined && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-purple-500">+{selectedReport.stats.total_keaktifan}</p>
                    <p className="text-xs text-slate-500 mt-1">Poin Keaktifan</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Summary Sections */}
            {selectedReport.sections && (
              <div className="px-6 py-4 space-y-4">
                {selectedReport.sections.academic && (
                  <SectionCard icon={<BookOpen size={16} />} title="Akademik" color="emerald">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.sections.academic}</p>
                  </SectionCard>
                )}
                {selectedReport.sections.attendance && (
                  <SectionCard icon={<Activity size={16} />} title="Kehadiran" color="blue">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.sections.attendance}</p>
                  </SectionCard>
                )}
                {selectedReport.sections.behavior && (
                  <SectionCard icon={<ShieldAlert size={16} />} title="Perilaku & Disiplin" color="amber">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.sections.behavior}</p>
                  </SectionCard>
                )}
                {selectedReport.sections.activity && (
                  <SectionCard icon={<TrendingUp size={16} />} title="Keaktifan" color="purple">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.sections.activity}</p>
                  </SectionCard>
                )}
                {selectedReport.sections.recommendation && (
                  <SectionCard icon={<Award size={16} />} title="Rekomendasi untuk Orang Tua" color="teal">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.sections.recommendation}</p>
                  </SectionCard>
                )}
                {selectedReport.full_report && (
                  <SectionCard icon={<ScrollText size={16} />} title="Laporan Lengkap" color="slate">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedReport.full_report}</p>
                  </SectionCard>
                )}
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ringkasan ini dihasilkan oleh AI • Si Pesek Pintar</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ icon, title, color, children }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-300' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-300' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-300' },
    slate: { bg: 'bg-slate-50 dark:bg-slate-700/30', text: 'text-slate-600 dark:text-slate-300' },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={`rounded-2xl p-4 ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${c.bg} ${c.text}`}>
          {icon}
        </div>
        <h3 className={`font-semibold text-sm ${c.text}`}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
