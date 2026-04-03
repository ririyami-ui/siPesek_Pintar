import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../lib/axios';
import moment from 'moment';
import { Book, Users, Clock, Zap, X, ExternalLink } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';
import { getTopicForSchedule } from '../utils/topicUtils';

export default function JadwalPage() {
  const { activeSemester, academicYear } = useSettings();
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null); // State for popup
  const [loading, setLoading] = useState(true);

  // Fetch schedules, programs, and classes from Laravel API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resSchedules, resPrograms, resClasses] = await Promise.all([
          api.get('/schedules'),
          api.get('/teaching-programs'),
          api.get('/classes')
        ]);

        // Map schedules to match the old Firestore format for UI compatibility
        const scheduleList = resSchedules.data.data || resSchedules.data || [];
        const mappedSchedules = scheduleList.map(s => ({
          id: s.id,
          subject: s.subject?.name || '',
          class: s.class?.rombel || '',
          day: s.day,
          startTime: s.start_time,
          endTime: s.end_time,
          startPeriod: s.start_period || 0,
          endPeriod: s.end_period || 0,
          type: s.type || 'teaching'
        }));

        setSchedules(mappedSchedules);

        // Map programs and classes to old format as well
        const programList = resPrograms.data.data || resPrograms.data || [];
        setPrograms(programList.map(p => ({
          ...p,
          subject: p.subject?.name,
          gradeLevel: p.grade_level,
          pekanEfektif: p.pekan_efektif,
          academicYear: p.academic_year
        })));

        const classList = resClasses.data.data || resClasses.data || [];
        setClasses(classList.map(c => ({
          ...c,
          rombel: c.rombel,
          level: c.level
        })));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedTopic) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedTopic]);

  // Group schedules by day of the week
  const groupedSchedules = schedules
    .filter(schedule => schedule.type !== 'non-teaching')
    .reduce((acc, schedule) => {
      if (!acc[schedule.day]) acc[schedule.day] = [];
      acc[schedule.day].push(schedule);
      return acc;
    }, {});

  // Sort by Class (Rombel), then start period
  Object.keys(groupedSchedules).forEach(day => {
    groupedSchedules[day].sort((a, b) => {
      // 1. Sort by Class (Rombel)
      const classA = a.class || '';
      const classB = b.class || '';
      const classDiff = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
      if (classDiff !== 0) return classDiff;

      // 2. Sort by Start Period (Jam Ke-)
      const periodA = parseInt(a.startPeriod) || 0;
      const periodB = parseInt(b.startPeriod) || 0;
      if (periodA !== periodB) return periodA - periodB;
      
      // 3. Sort by Start Time (fallback)
      return moment(a.startTime, 'HH:mm').diff(moment(b.startTime, 'HH:mm'));
    });
  });

  const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const getDayDate = (dayName) => {
    const today = moment();
    const momentDayIndex = daysOrder.indexOf(dayName) + 1;
    let targetDay = moment().day(momentDayIndex);
    if (targetDay.isBefore(today, 'day')) targetDay = targetDay.add(1, 'week');
    return targetDay;
  };

  const getClassColor = (className) => {
    if (!className) return 'bg-gray-100 text-gray-600 border-gray-200';
    
    // Hash function to get consistent color for same class name
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', accent: 'bg-blue-500' },
      { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-500' },
      { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', accent: 'bg-violet-500' },
      { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', accent: 'bg-amber-500' },
      { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', accent: 'bg-rose-500' },
      { bg: 'bg-cyan-50 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', accent: 'bg-cyan-500' },
      { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', accent: 'bg-orange-500' },
      { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800', accent: 'bg-fuchsia-500' },
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  const dayColors = {
    'Senin': 'bg-blue-600',
    'Selasa': 'bg-emerald-600',
    'Rabu': 'bg-amber-500',
    'Kamis': 'bg-rose-600',
    'Jumat': 'bg-indigo-600',
    'Sabtu': 'bg-pink-600',
    'Minggu': 'bg-slate-600',
  };

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-lg dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <div className="mb-6">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Jadwal Mengajar</h2>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">
          Semester {activeSemester} | TA {academicYear}
        </p>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-gray-400 dark:text-gray-500 font-medium italic">Tidak ada jadwal mengajar yang tersedia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {daysOrder.map(day => groupedSchedules[day] && (
            <div key={day} className="bg-gray-50 dark:bg-gray-900/40 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
              <div className={`p-4 ${dayColors[day] || 'bg-indigo-500'} text-white`}>
                <h3 className="text-lg font-black tracking-tight">{day}</h3>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{getDayDate(day).format('DD MMMM YYYY')}</p>
              </div>
              
              <ul className="p-3 space-y-2">
                {groupedSchedules[day].map((schedule, index) => {
                  const displayClass = typeof schedule.class === 'object' && schedule.class !== null
                    ? schedule.class.rombel
                    : schedule.class;
                  const classInfo = classes.find(c => (c.rombel || '').trim().toUpperCase() === (displayClass || '').trim().toUpperCase());
                  const scheduleGrade = classInfo?.level || displayClass?.match(/\d+/)?.[0] || '';
                  const topic = getTopicForSchedule(schedule, getDayDate(day), programs, classes, activeSemester, academicYear);
                  const classColor = getClassColor(displayClass);
                  
                  return (
                    <li key={index} className="bg-white dark:bg-gray-800 p-3.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group relative overflow-hidden pl-5">
                      {/* Class Accent Border */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${classColor.accent}`} />
                      
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white font-black text-sm truncate leading-tight">{schedule.subject}</p>
                        </div>
                        <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter border ${classColor.bg} ${classColor.text} ${classColor.border}`}>
                          Kelas {displayClass}
                        </span>
                      </div>

                      {topic && (
                        <div 
                          onClick={() => setSelectedTopic({ subject: schedule.subject, topic: topic, grade: scheduleGrade })}
                          className="cursor-pointer mb-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/30 hover:bg-emerald-100/50 transition-colors"
                        >
                          <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 italic line-clamp-1 flex items-center gap-1">
                            <Zap size={8} className="text-emerald-500" fill="currentColor" /> {topic}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="opacity-50" />
                          <span>{schedule.startTime} - {schedule.endTime}</span>
                        </div>
                        <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 px-1.5 py-0.5 rounded-md text-[8px] font-black">
                          JAM {schedule.startPeriod}-{schedule.endPeriod}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal - Portal escapes parent transforms/scrolling */}
      {selectedTopic && createPortal(
        <div
          className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 no-print"
          onClick={() => setSelectedTopic(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-green-50/30 dark:bg-green-900/10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Book size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white leading-tight text-base">Detail Materi</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-medium">{selectedTopic.subject}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTopic(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                aria-label="Tutup"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedTopic.topic}
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                to={`/rpp?grade=${selectedTopic.grade}&subject=${encodeURIComponent(selectedTopic.subject)}&topic=${encodeURIComponent(selectedTopic.topic)}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
                onClick={() => {
                  setSelectedTopic(null);
                  document.body.style.overflow = 'unset';
                }}
              >
                <Zap size={16} fill="white" className="group-hover:animate-pulse" />
                Buat RPP
              </Link>
              <Link
                to={`/handout-generator?grade=${selectedTopic.grade}&subject=${encodeURIComponent(selectedTopic.subject)}&topic=${encodeURIComponent(selectedTopic.topic)}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2 group"
                onClick={() => {
                  setSelectedTopic(null);
                  document.body.style.overflow = 'unset';
                }}
              >
                <Book size={16} className="group-hover:scale-110 transition-transform" />
                Buat Bahan Ajar
              </Link>
              <button
                onClick={() => setSelectedTopic(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
