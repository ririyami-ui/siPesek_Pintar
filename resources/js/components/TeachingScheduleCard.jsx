import React, { useEffect, useState } from 'react';
import moment from 'moment';
import 'moment/locale/id'; // Import Indonesian locale
import { Clock, CheckCircle, PlayCircle, Bell, CalendarOff, Calendar, Gift, Coffee, Sparkles, Smile, FileText, Book, Zap, RefreshCw, UserCheck } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';
import Countdown from './Countdown'; // Import Countdown component
import { getTopicForSchedule } from '../utils/topicUtils';
import api from '../lib/axios';

moment.updateLocale('id', {
  relativeTime: {
    future: "dalam %s",
    past: "%s yang lalu",
    s: 'beberapa detik',
    ss: 'beberapa detik',
    m: "semenit",
    mm: "%d menit",
    h: "sejam",
    hh: "%d jam",
    d: "sehari",
    dd: "%d hari",
    M: "sebulan",
    MM: "%d bulan",
    y: "setahun",
    yy: "%d tahun"
  }
});

const TeachingScheduleCard = ({ schedules, currentTime, holiday, programs, classes, carryOverMap, activeSemester, academicYear }) => {
  const [notifiedSchedules, setNotifiedSchedules] = useState(new Set());
  const [permissionGranted, setPermissionGranted] = useState(null);

  // Fetch attendance data for student dashboard
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        // Assuming api is available or imported elsewhere, but for now we follow the user's logic structure
        const response = await api.get('/attendances', {
          params: { date: moment().format('YYYY-MM-DD') }
        });
        setAttendanceRecords(response.data.data || []);
      } catch (err) {
        console.error("Error fetching attendance:", err);
      }
    };
    fetchAttendance();
  }, [currentTime.format('YYYY-MM-DD')]);

  useEffect(() => {
    const checkPerms = async () => {
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display === 'granted') {
          setPermissionGranted(true);
        } else {
          // Only request once on mount
          const requestStatus = await LocalNotifications.requestPermissions();
          setPermissionGranted(requestStatus.display === 'granted');
        }
      } catch (e) {
        console.error("Error checking notification permissions:", e);
        setPermissionGranted(false);
      }
    };
    checkPerms();
  }, []);

  const getHolidayGreeting = (h) => {
    const cat = h.category || '';
    const name = (h.name || '').toLowerCase();

    if (cat === 'semester_ganjil' || cat === 'semester_genap') {
      return {
        message: "Selamat berlibur dan selamat beristirahat dari rutinitas mengajar!",
        icon: <Coffee size={24} className="text-white" />,
        sub: "Waktunya merefresh semangat!"
      };
    }
    if (cat === 'ujian' || cat === 'ujian_semester' || name.includes('ujian') || name.includes('asasesmen')) {
      return {
        message: "Semangat mendampingi siswa di masa ujian. Semoga lancar!",
        icon: <FileText size={24} className="text-white" />,
        sub: "Tetap teliti dan sabar!"
      };
    }
    if (cat === 'tengah_semester' || name.includes('kts')) {
      return {
        message: "Selamat mengikuti kegiatan tengah semester bersama para siswa!",
        icon: <Smile size={24} className="text-white" />,
        sub: "Ciptakan momen belajar yang menyenangkan!"
      };
    }
    if (cat === 'rapat' || name.includes('rapat')) {
      return {
        message: "Selamat berdiskusi untuk kemajuan sekolah. Semoga berkah!",
        icon: <Coffee size={24} className="text-white" />,
        sub: "Rapat Pengabdian & Koordinasi"
      };
    }
    if (cat === 'workshop' || name.includes('workshop') || name.includes('iht')) {
      return {
        message: "Selamat menambah wawasan dan kompetensi baru hari ini!",
        icon: <Book size={24} className="text-white" />,
        sub: "Workshop & Pengembangan Diri"
      };
    }
    if (cat === 'class_meeting' || name.includes('class meeting')) {
      return {
        message: "Waktunya seru-seruan dan menjalin kekompakan antar siswa!",
        icon: <Smile size={24} className="text-white" />,
        sub: "Class Meeting Competition"
      };
    }
    if (cat === 'studi_tiru' || name.includes('studi tiru') || name.includes('outbound')) {
      return {
        message: "Selamat belajar dari pengalaman baru di luar sekolah!",
        icon: <Sparkles size={24} className="text-white" />,
        sub: "Studi Tiru & Kegiatan Luar"
      };
    }
    if (cat === 'keagamaan' || name.includes('pengajian') || name.includes('sholat')) {
      return {
        message: "Mari tingkatkan spiritualitas dan kebersamaan dalam ibadah.",
        icon: <Zap size={24} className="text-white" />,
        sub: "Kegiatan Spiritual"
      };
    }
    if (name.includes('upacara') || name.includes('senam')) {
      return {
        message: "Awali pagi dengan semangat kebersamaan dan kesehatan!",
        icon: <Sparkles size={24} className="text-white" />,
        sub: "Sehat fisik, cerdas pikiran!"
      };
    }

    // Default / National Holiday
    return {
      message: "Selamat menikmati waktu luang Anda. Selamat beristirahat!",
      icon: <Gift size={24} className="text-white" />,
      sub: "Hari ini adalah hari istimewa!"
    };
  };

  const getClosingGreeting = () => {
    const greetings = [
      {
        message: "Alhamdulillah, tugas mulia hari ini telah tuntas. Selamat beristirahat, Bapak/Ibu Guru!",
        sub: "Dedikasi Anda hari ini luar biasa"
      },
      {
        message: "Pembelajaran hari ini telah berakhir. Terima kasih atas inspirasi yang Anda bagikan hari ini!",
        sub: "Siswa beruntung memiliki Anda"
      },
      {
        message: "Waktunya melepas lelah. Sampai jumpa di hari esok dengan semangat baru!",
        sub: "Recharge energi untuk esok hari"
      },
      {
        message: "Hari yang penuh makna telah usai. Istirahatlah yang cukup untuk mengawali esok yang lebih cerah.",
        sub: "Malam ini milik Anda"
      },
      {
        message: "Tugas mengajar selesai. Selamat menikmati waktu berkualitas bersama keluarga!",
        sub: "Kebahagiaan dimulai dari rumah"
      }
    ];
    // Use day of the year + day of week as seed to keep it consistent throughout the day but varying by day
    const seed = moment().dayOfYear() + moment().day();
    return greetings[seed % greetings.length];
  };

  const isBreakActiveLogic = (startStr, endStr) => {
    const now = currentTime;
    const todayStr = now.format('YYYY-MM-DD');
    const start = moment(`${todayStr} ${startStr} `, 'YYYY-MM-DD HH:mm');
    const end = moment(`${todayStr} ${endStr} `, 'YYYY-MM-DD HH:mm');

    if (end.isBefore(start)) end.add(1, 'day');
    return now.isBetween(start, end, null, '[]');
  };

  const isAnyBreakHappening = () => {
    return schedules.some(s => {
      if (s.type !== 'non-teaching') return false;
      return isBreakActiveLogic(s.startTime, s.endTime);
    });
  };

  const isBreakActiveItem = (schedule) => {
    if (schedule.type !== 'non-teaching') return false;
    const now = currentTime;
    const todayStr = now.format('YYYY-MM-DD');
    const start = moment(`${todayStr} ${schedule.startTime} `, 'YYYY-MM-DD HH:mm');
    const fiveMinutesBefore = moment(start).subtract(5, 'minutes');
    const end = moment(`${todayStr} ${schedule.endTime} `, 'YYYY-MM-DD HH:mm');

    if (end.isBefore(start)) end.add(1, 'day');
    return now.isBetween(fiveMinutesBefore, end, null, '[]');
  };

  const getScheduleStatus = (schedule) => {
    const now = currentTime;
    const todayStr = now.format('YYYY-MM-DD');
    const startTime = moment(`${todayStr} ${schedule.startTime} `, 'YYYY-MM-DD HH:mm');
    const endTime = moment(`${todayStr} ${schedule.endTime} `, 'YYYY-MM-DD HH:mm');
    const fiveMinutesBefore = moment(startTime).subtract(5, 'minutes');

    if (endTime.isBefore(startTime)) {
      endTime.add(1, 'day');
    }

    if (schedule.type === 'teaching' && isAnyBreakHappening() && now.isBetween(startTime, endTime, null, '[]')) {
      return {
        status: 'paused',
        message: 'Sedang Istirahat',
        icon: <Clock className="mr-2" />,
        estimation: null,
      };
    }

    if (now.isBetween(startTime, endTime, null, '[]')) {
      return {
        status: 'ongoing',
        message: 'Sedang Berlangsung',
        icon: <PlayCircle className="mr-2" />,
        estimation: <Countdown endTime={schedule.endTime} />,
      };
    }

    if (now.isAfter(endTime)) {
      return {
        status: 'finished',
        message: 'Selesai',
        icon: <CheckCircle className="mr-2" />,
        estimation: null,
      };
    }

    if (now.isBetween(fiveMinutesBefore, startTime, null, '[]')) {
      return {
        status: 'upcoming-soon',
        message: 'Segera',
        icon: <Bell className="mr-2 animate-pulse" />,
        estimation: <Countdown endTime={schedule.startTime} prefix="Dimulai dalam" />,
      };
    }

    return {
      status: 'upcoming',
      message: null,
      icon: null,
      estimation: `Dimulai ${startTime.from(now)} `,
    };
  };

  useEffect(() => {
    const triggerNotifications = async () => {
      if (permissionGranted !== true) return;

      schedules.forEach(async (schedule) => {
        const { status } = getScheduleStatus(schedule);
        if (status === 'upcoming-soon' && !notifiedSchedules.has(schedule.id)) {
          const title = schedule.type === 'non-teaching' ? "Jadwal Non-KBM Segera Dimulai!" : "Jadwal Mengajar Segera Dimulai!";
          const body = schedule.type === 'non-teaching'
            ? `${schedule.activityName} akan dimulai dalam 5 menit.`
            : `${schedule.subject} di kelas ${schedule.class} akan dimulai dalam 5 menit.`;

          await LocalNotifications.schedule({
            notifications: [
              {
                title: title,
                body: body,
                id: new Date().getTime(),
                schedule: { at: new Date(Date.now() + 1000) },
                sound: null,
                attachments: null,
                actionTypeId: '',
                extra: null
              },
            ],
          });
          setNotifiedSchedules(prev => new Set(prev.add(schedule.id)));
        }
      });
    };

    triggerNotifications();
  }, [schedules, currentTime, notifiedSchedules]);

  // Helper to determine if holiday blocks routine schedule
  const isBlockingHoliday = (h) => {
    if (!h) return false;
    const name = (h.name || '').toLowerCase();

    // Upacara and Senam are usually morning activities, so regular schedule might continue
    if (name.includes('upacara') || name.includes('senam')) return false;

    // All other holidays/agendas (Rapat, Workshop, Libur, etc.) are considered blocking
    return true;
  };

  const shouldHideSchedules = holiday && isBlockingHoliday(holiday);

  // Filter: Show Teaching or Active Non-Teaching
  const visibleSchedules = shouldHideSchedules ? [] : schedules.filter(s => {
    // 1. Get current status
    const { status } = getScheduleStatus(s);

    // 2. Hide finished items (to let next agenda move up)
    if (status === 'finished') return false;

    // 3. For non-teaching, keep existing active logic
    if (s.type === 'non-teaching') return isBreakActiveItem(s);

    return true;
  }).sort((a, b) => {
    // Priority: Non-Teaching first if active
    const isNonTeachingA = a.type === 'non-teaching';
    const isNonTeachingB = b.type === 'non-teaching';
    if (isNonTeachingA && !isNonTeachingB) return -1;
    if (!isNonTeachingA && isNonTeachingB) return 1;
    return moment(a.startTime, 'HH:mm').diff(moment(b.startTime, 'HH:mm'));
  });

  return (
    <div className="w-full p-5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/30 overflow-hidden relative">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        <h2 className="text-xl font-bold mb-5 text-gray-800 dark:text-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            <span>Jadwal Hari Ini</span>
          </div>
        </h2>

        {visibleSchedules.length === 0 && !holiday ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-10 space-y-4">
            {schedules.length > 0 && schedules.every(s => getScheduleStatus(s).status === 'finished') ? (
              (() => {
                const closing = getClosingGreeting();
                return (
                  <div className="w-full p-6 bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 rounded-2xl shadow-xl border border-white/30 text-white animate-fade-in-up relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>

                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-lg border border-white/20">
                            <CheckCircle size={28} className="text-white" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-extrabold tracking-tight leading-tight">Tugas Tuntas!</h3>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-0.5">Semua Pembelajaran Selesai</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 mt-1">
                        <p className="text-sm font-medium italic opacity-95 leading-relaxed text-left">
                          "{closing.message}"
                        </p>
                        <div className="flex items-center gap-1.5 mt-3 opacity-90">
                          <Sparkles size={12} className="text-amber-200" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{closing.sub}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-700/50 rounded-full">
                  <CalendarOff size={32} />
                </div>
                <p className="font-medium">Tidak ada jadwal untuk hari ini</p>
              </>
            )}
          </div>
        ) : (
          <div className="w-full space-y-3">
            {/* Holiday Agenda at Top */}
            {holiday && (() => {
              const greeting = getHolidayGreeting(holiday);
              return (
                <div className="w-full p-5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl border border-white/30 text-white animate-fade-in-up relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>

                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md shadow-lg border border-white/20">
                          {greeting.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold tracking-tight leading-tight">{holiday.name}</h3>
                            <span className="flex h-2 w-2 rounded-full bg-white animate-ping"></span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/20">
                        Agenda Khusus
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10 mt-1">
                      <p className="text-sm font-medium italic opacity-95 leading-relaxed">
                        "{greeting.message}"
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 opacity-80">
                        <title size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{greeting.sub}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {visibleSchedules.map((schedule) => {
              const isNonTeaching = schedule.type === 'non-teaching';
              const { status, message, icon, estimation } = getScheduleStatus(schedule);

              const variants = {
                ongoing: {
                  bg: isNonTeaching ? "bg-pink-500/10" : "bg-emerald-500/10",
                  border: isNonTeaching ? "border-pink-500/30" : "border-emerald-500/30",
                  accent: isNonTeaching ? "bg-pink-500" : "bg-emerald-500",
                  text: isNonTeaching ? "text-pink-700 dark:text-pink-400" : "text-emerald-700 dark:text-emerald-400",
                  badge: isNonTeaching ? "bg-pink-500 text-white" : "bg-emerald-500 text-white"
                },
                'upcoming-soon': {
                  bg: "bg-amber-500/10",
                  border: "border-amber-500/30",
                  accent: "bg-amber-500",
                  text: "text-amber-700 dark:text-amber-400",
                  badge: "bg-amber-500 text-white"
                },
                finished: {
                  bg: "bg-slate-100 dark:bg-slate-800/50",
                  border: "border-slate-200 dark:border-slate-700",
                  accent: "bg-slate-400",
                  text: "text-slate-500 dark:text-slate-400",
                  badge: "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                },
                upcoming: {
                  bg: "bg-white/50 dark:bg-gray-800/40",
                  border: "border-gray-100 dark:border-gray-700/50",
                  accent: "bg-gray-300 dark:bg-gray-600",
                  text: "text-gray-600 dark:text-gray-400",
                  badge: "bg-gray-100 dark:bg-gray-700 text-gray-500"
                },
                paused: {
                  bg: "bg-gray-50/80 dark:bg-gray-800/60",
                  border: "border-gray-200/50 dark:border-gray-700/50",
                  accent: "bg-gray-400",
                  text: "text-gray-500 dark:text-gray-400",
                  badge: "bg-gray-100 dark:bg-gray-700 text-gray-500"
                },
                assignment: {
                  bg: "bg-indigo-500/10",
                  border: "border-indigo-500/30",
                  accent: "bg-indigo-600",
                  text: "text-indigo-700 dark:text-indigo-400",
                  badge: "bg-indigo-600 text-white"
                }
              };

              const isAssignment = schedule.is_assignment === true || schedule.is_assignment == 1;
              const currentVariant = isAssignment ? variants.assignment : variants[status];
              const cardTitle = isNonTeaching ? (schedule.activityName || 'Kegiatan') : schedule.subject;
              const cardSubtitle = isNonTeaching
                ? (schedule.class && schedule.class !== 'Umum' && schedule.class !== 'Semua Kelas' ? `Kelas ${schedule.class}` : 'Umum')
                : `Kelas ${schedule.class}`;

              return (
                <div
                  key={schedule.id}
                  className={`relative overflow-hidden ${isNonTeaching ? 'p-3 px-4' : 'p-4'} rounded-xl border transition-all duration-300 group ${currentVariant.bg} ${currentVariant.border} ${status === 'ongoing' ? 'shadow-lg ring-1 ring-inset ring-black/5 md:scale-[1.01]' : 'hover:bg-opacity-80'} ${status === 'upcoming-soon' ? 'animate-pulse-subtle' : ''}`}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${currentVariant.accent}`}></div>

                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`${isNonTeaching ? 'text-sm font-bold' : 'text-base sm:text-lg font-bold'} truncate ${currentVariant.text}`}>
                            {isAssignment ? `${cardTitle} (Penugasan)` : cardTitle}
                          </h3>
                          {(status === 'ongoing' || isAssignment) && (
                            <span className={`flex h-1.5 w-1.5 rounded-full ${isNonTeaching ? 'bg-pink-500' : (isAssignment ? 'bg-indigo-500' : 'bg-emerald-500')} animate-ping`}></span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          <span className={`${isAssignment ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : (isNonTeaching ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-gray-200/50 dark:bg-gray-700/50')} px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider`}>
                            {isAssignment ? 'Dinas Luar' : cardSubtitle}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">•</span>
                          <span className="font-mono bg-white/30 dark:bg-black/20 px-1.5 py-0.5 rounded italic sm:not-italic">{schedule.startTime} - {schedule.endTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 pt-2 sm:pt-0 border-black/5 dark:border-white/5">
                      {(status === 'ongoing' || status === 'upcoming-soon') && estimation && (
                        <div className={`text-[10px] sm:text-xs font-mono font-bold px-2 py-1 sm:py-0.5 rounded-md shadow-inner bg-black/5 dark:bg-white/5 ${currentVariant.text}`}>
                          {estimation}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {status === 'upcoming' || status === 'upcoming-soon' ? (
                          <div className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${currentVariant.badge}`}>
                            {status === 'upcoming-soon' ? 'Segera' : 'Nanti'}
                          </div>
                        ) : status === 'finished' ? (
                          <CheckCircle size={16} className="text-slate-400" />
                        ) : (
                          <div className={`p-1.5 rounded-lg ${currentVariant.badge} bg-opacity-20`}>
                            {status === 'paused' ? <Clock size={14} /> : icon || <Zap size={14} />}
                          </div>
                        )}

                        {/* Compact specific label for mobile status */}
                        {status === 'paused' && (
                          <span className="text-[10px] font-bold sm:hidden text-gray-400 uppercase tracking-tighter">Istirahat</span>
                        )}
                      </div>
                    </div>
                  </div>


                  {!isNonTeaching && (status === 'ongoing' || status === 'upcoming-soon' || status === 'paused') && (
                    <div className={`mt-3 pt-3 border-t ${currentVariant.border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-lg ${currentVariant.badge} bg-opacity-20`}>
                          {status === 'paused' ? <Clock size={12} /> : icon || <Zap size={12} />}
                        </div>
                        <span className={`text-[11px] font-bold ${currentVariant.text}`}>
                          {status === 'paused' ? 'Sedang Istirahat' : message}
                        </span>
                      </div>
                      {(() => {
                        const carryOver = carryOverMap && carryOverMap[`${schedule.class}-${schedule.subject}`];
                        const topic = getTopicForSchedule(schedule, currentTime, programs || [], classes || [], activeSemester, academicYear);

                        return (
                          <div className="flex flex-col gap-2 w-full">
                            {/* Attendance Status Badge for Students */}
                            {(() => {
                              const record = attendanceRecords.find(r => 
                                r.subject_id == schedule.subjectId && 
                                r.class_id == schedule.classId
                              );
                              if (!record) return null;

                              const statusColors = {
                                hadir: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                                sakit: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                                izin: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                                ijin: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                                alpa: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                                alpha: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              };

                              return (
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border animate-in fade-in slide-in-from-left-2 duration-700 ${statusColors[record.status?.toLowerCase()] || 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}>
                                  <UserCheck size={12} className="shrink-0" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">
                                    ABSENSI: {record.status?.toUpperCase()}
                                  </span>
                                </div>
                              );
                            })()}
                            
                            {carryOver && (
                              <div className="flex items-start gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/40 rounded-xl border border-red-200 dark:border-red-800 shadow-sm animate-bounce-short">
                                <RefreshCw size={12} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider leading-none mb-1">Materi Tertunda:</p>
                                  <p className="text-[11px] font-bold text-red-700 dark:text-red-300 italic leading-snug break-words line-clamp-2">
                                    {carryOver.material}
                                  </p>
                                </div>
                              </div>
                            )}
                            {topic && (
                              <div className="flex items-start gap-2 px-3 py-2 bg-white/50 dark:bg-black/20 rounded-xl border border-white/30 dark:border-white/5 shadow-inner animate-in slide-in-from-right-2 duration-500">
                                <Zap size={12} className="text-amber-500 shrink-0 mt-0.5" fill="currentColor" />
                                <div className="flex-1 min-w-0 overflow-hidden">
                                  <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider leading-none mb-1">Topik:</p>
                                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 italic leading-snug break-words line-clamp-2">
                                    {topic}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {!isNonTeaching && schedule.startPeriod && (
                    <div className="absolute top-1 right-2 opacity-20 pointer-events-none hidden sm:block">
                      <span className="text-[10px] font-bold italic tracking-tighter uppercase">JP {schedule.startPeriod}-{schedule.endPeriod}</span>
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
};

export default TeachingScheduleCard;