import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, User, BookOpen, Loader2, ChevronRight } from 'lucide-react';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function StudentSchedule() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState({});
  const { activeSemester, academicYear } = useSettings();

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoading(true);
        const res = await api.get('/student/schedule');
        const allSchedules = res.data.schedule || [];
        
        // Group by day
        const grouped = {};
        DAYS.forEach(day => {
          grouped[day] = allSchedules.filter(s => s.day === day)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
        });
        
        setSchedules(grouped);
      } catch (err) {
        console.error('Error fetching schedules:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [activeSemester, academicYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Memuat Jadwal Pelajaran...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-premium">
      {/* Compact Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-5 dark:opacity-10 rotate-12">
          <CalendarDays size={80} />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-500/20">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-white tracking-tight leading-none mb-2">Jadwal Pelajaran</h2>
            <div className="flex items-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-xl italic leading-none">
                {activeSemester} • {academicYear}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DAYS.map((day) => (
          <div key={day} className="bg-white dark:bg-slate-800 rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-500 group">
            <div className="bg-gray-50 dark:bg-slate-900/50 px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">{day}</h3>
              <div className="px-3 py-1 bg-white dark:bg-slate-800 rounded-xl text-[10px] font-black text-emerald-600 border border-emerald-100 dark:border-emerald-900/30">
                {schedules[day]?.length || 0} Sesi
              </div>
            </div>
            
            <div className="p-2 space-y-1">
              {schedules[day]?.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-white/5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100/50 dark:bg-slate-900/80">
                        <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">Jam</th>
                        <th className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">Mata Pelajaran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules[day].map((item, idx) => (
                        <tr 
                          key={idx} 
                          className={`
                            transition-colors duration-200
                            ${idx % 2 === 0 
                              ? 'bg-white dark:bg-slate-800/40' 
                              : 'bg-emerald-50/30 dark:bg-emerald-500/5'
                            }
                            hover:bg-emerald-100/20 dark:hover:bg-emerald-500/10
                          `}
                        >
                          <td className="px-4 py-3 text-[11px] font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap border-b border-slate-50 dark:border-white/5">
                            {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-slate-50 dark:border-white/5">
                            {item.subject_name || item.activity_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center opacity-30 grayscale italic">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Libur / Tidak Ada Jadwal</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
