import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import moment from 'moment';
import api from '../lib/axios';
import StyledTable from '../components/StyledTable';
import ClockDisplay from '../components/ClockDisplay';
import { useSettings } from '../utils/SettingsContext';
import RunningText from '../components/RunningText';
import { useSearchParams } from 'react-router-dom';
import { History } from 'lucide-react';

const AbsensiPage = () => {
  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const subjectIdFromUrl = searchParams.get('subjectId');
  const dateFromUrl = searchParams.get('date');

  const [activeSchedule, setActiveSchedule] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: "Hadir" }
  const [previousMaterial, setPreviousMaterial] = useState(null);
  const [previousLearningActivities, setPreviousLearningActivities] = useState(null);
  const { activeSemester, academicYear, userProfile, refreshMonitoringData } = useSettings();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const [holidays, setHolidays] = useState([]);
  const [activityCategories, setActivityCategories] = useState([]);
  const [activityPoints, setActivityPoints] = useState({}); // { studentId: [catId, ...] }
  const [showActivityInput, setShowActivityInput] = useState(false);
  // Mode Absen Pagi Kegiatan (mis. P5) — agenda kegiatan is_holiday=false
  const [isKegiatanMode, setIsKegiatanMode] = useState(false);
  const [kegiatanInfo, setKegiatanInfo] = useState(null); // { id, name }
  const [kegiatanClasses, setKegiatanClasses] = useState([]);
  const [selectedKegiatanClass, setSelectedKegiatanClass] = useState(null);
  const [isKegiatanLoading, setIsKegiatanLoading] = useState(false);

  const autoSaveTimeout = useRef(null);

  useEffect(() => {
    const fetchActiveScheduleAndStudentsAndAttendance = async () => {
      try {
        const now = moment();
        const targetDate = dateFromUrl || now.format('YYYY-MM-DD');

        // Check if target date is a holiday or kegiatan (agenda kegiatan)
        try {
          const holidaysRes = await api.get('/holidays');
          const fetched = holidaysRes.data.data || holidaysRes.data || [];
          setHolidays(fetched);
          const selected = moment(targetDate).startOf('day');
          const holiday = fetched.find(h => {
            if (h.start_date && h.end_date) {
              const start = moment(h.start_date).startOf('day');
              const end = moment(h.end_date).startOf('day');
              return selected.isBetween(start, end, null, '[]');
            }
            return h.date && moment(h.date).isSame(selected, 'day');
          });
          if (holiday) {
            if (holiday.is_holiday) {
              // Libur: blokir absensi
              setActiveSchedule({ isHoliday: true });
              setStudents([]);
              setAttendance({});
              setIsKegiatanMode(false);
              setKegiatanInfo(null);
              setSelectedKegiatanClass(null);
              return;
            }
            // Agenda kegiatan (mis. P5): mode Absen Pagi Kegiatan tanpa mapel
            setIsKegiatanMode(true);
            setKegiatanInfo({
              id: holiday.id,
              name: holiday.name || holiday.title || 'Kegiatan',
              start_time: holiday.start_time,
              end_time: holiday.end_time,
            });
            setActiveSchedule(null);
            setSelectedKegiatanClass(null);
            await loadKegiatanClasses();
            return;
          }
          setIsKegiatanMode(false);
          setKegiatanInfo(null);
          setSelectedKegiatanClass(null);
        } catch (e) {
          console.error('Error fetch holidays', e);
        }
        const dayMap = {
          'Sunday': 'Minggu',
          'Monday': 'Senin',
          'Tuesday': 'Selasa',
          'Wednesday': 'Rabu',
          'Thursday': 'Kamis',
          'Friday': 'Jumat',
          'Saturday': 'Sabtu',
        };
        const targetDayIndonesian = dayMap[moment(targetDate).format('dddd')];

        // Fetch schedules
        const scheduleRes = await api.get('/schedules', {
          params: { day: targetDayIndonesian }
        });
        const allSchedules = scheduleRes.data.data || scheduleRes.data;
        // [FIX] Filter only schedules for the target day to prevent cross-day detection errors
        const schedules = allSchedules.filter(s => s.day === targetDayIndonesian);

        let foundActiveSchedule = null;

        // If classId and subjectId provided via URL (Admin help mode)
        if (classIdFromUrl && subjectIdFromUrl) {
          const matchedSchedule = schedules.find(s => {
            const sClassId = String(s.class_id || s.classId);
            const sSubjectId = String(s.subject_id || s.subjectId);
            const targetClassId = String(classIdFromUrl);
            const targetSubjectId = String(subjectIdFromUrl);

            return (sClassId === targetClassId || s.class?.rombel === classIdFromUrl) && 
                   (sSubjectId === targetSubjectId || s.subject?.name === subjectIdFromUrl);
          });

          if (matchedSchedule) {
            foundActiveSchedule = {
              id: matchedSchedule.id,
              class: matchedSchedule.class?.rombel || matchedSchedule.className || '',
              classId: matchedSchedule.class_id || matchedSchedule.classId,
              subject: matchedSchedule.subject?.name || matchedSchedule.subjectName || '',
              subjectId: matchedSchedule.subject_id || matchedSchedule.subjectId,
              startTime: matchedSchedule.start_time,
              endTime: matchedSchedule.end_time,
              isManualMode: true
            };
          }
        }

        // Standard Real-time Mode (if no URL params or URL params didn't match)
        if (!foundActiveSchedule) {
          // Sort schedules to be deterministic: Teaching first, then by start time
          const sortedSchedules = [...schedules].sort((a, b) => {
            if (a.type === 'teaching' && b.type !== 'teaching') return -1;
            if (a.type !== 'teaching' && b.type === 'teaching') return 1;
            return moment(a.start_time || a.startTime, 'HH:mm:ss').diff(moment(b.start_time || b.startTime, 'HH:mm:ss'));
          });

          for (const schedule of sortedSchedules) {
            if (schedule.type !== 'teaching') continue; // Skip non-teaching in auto-detection for Absensi

            const className = schedule.class?.rombel || schedule.className || '';
            const classId = schedule.class_id || schedule.classId || '';
            const subjectId = schedule.subject_id || schedule.subjectId || '';
            const subjectName = schedule.subject?.name || schedule.subjectName || schedule.subject || '';

            const startTime = moment(schedule.start_time || schedule.startTime, 'HH:mm:ss');
            let endTime = moment(schedule.end_time || schedule.endTime, 'HH:mm:ss');

            if (endTime.isBefore(startTime)) {
              endTime.add(1, 'day');
            }

            // [REFINED] Exact match for current time
            if (now.isBetween(startTime, endTime, null, '[]')) {
              foundActiveSchedule = {
                id: schedule.id,
                class: className,
                classId: classId,
                subject: subjectName,
                subjectId: subjectId,
                startTime: startTime.format('HH:mm'),
                endTime: endTime.format('HH:mm'),
              };
              break;
            }
          }

          // Fallback: If no exact match, look for the most recently started schedule that is still "active" 
          // [REFINED] We pick the LATEST started schedule from those that started in the last 2 hours
          // This prevents picking 8B when we should be in 8A if they overlap or are very close.
          if (!foundActiveSchedule) {
             const recentlyStarted = sortedSchedules
                .filter(s => s.type === 'teaching')
                .reverse() // Check from the latest started session first
                .find(s => {
                    const sStart = moment(s.start_time || s.startTime, 'HH:mm:ss');
                    // Look back up to 3 hours, but we check newest first due to .reverse()
                    return now.isAfter(sStart) && now.diff(sStart, 'minutes') < 180; 
                });

             if (recentlyStarted) {
                foundActiveSchedule = {
                  id: recentlyStarted.id,
                  class: recentlyStarted.class?.rombel || recentlyStarted.className || '',
                  classId: recentlyStarted.class_id || recentlyStarted.classId,
                  subject: recentlyStarted.subject?.name || recentlyStarted.subjectName || recentlyStarted.subject || '',
                  subjectId: recentlyStarted.subject_id || recentlyStarted.subjectId,
                  startTime: moment(recentlyStarted.start_time || recentlyStarted.startTime, 'HH:mm:ss').format('HH:mm'),
                  endTime: moment(recentlyStarted.end_time || recentlyStarted.endTime, 'HH:mm:ss').format('HH:mm'),
                };
             }
          }
        }

        setActiveSchedule(foundActiveSchedule);

        if (foundActiveSchedule) {
          // Fetch students for this class
          const studentsRes = await api.get('/students', {
            params: { class_id: foundActiveSchedule.classId }
          });
          const fetchedStudents = (studentsRes.data.data || studentsRes.data).sort((a, b) => {
            const absenA = parseInt(a.absen) || 0;
            const absenB = parseInt(b.absen) || 0;
            return absenA - absenB;
          });
          setStudents(fetchedStudents);

          // Fetch all attendance for this class on the target date to allow carry-over
          try {
            const attendanceRes = await api.get('/attendances', {
              params: {
                date: targetDate,
                class_id: foundActiveSchedule.classId,
                // We don't filter by subject_id here so we can see other sessions' attendance
              }
            });
            const allDayAttendance = attendanceRes.data.data || [];
            
            // 1. Check if current subject already has attendance
            const currentSubjectAttendance = allDayAttendance.filter(
              record => record.subject_id == foundActiveSchedule.subjectId
            );

            let attendanceToUse = {};

            if (currentSubjectAttendance.length > 0) {
              // Use existing attendance for this subject
              currentSubjectAttendance.forEach(record => {
                attendanceToUse[record.student_id] = record.status;
              });
            } else if (allDayAttendance.length > 0) {
              // PRE-FILL LOGIC: If current subject is empty, take from the EARLIEST session recorded today
              // This is the "Daily Attendance" (Absen Harian) logic requested by the user
              
              // Group by subject to find sessions
              const sessions = {};
              allDayAttendance.forEach(record => {
                const subId = record.subject_id || 'daily';
                if (!sessions[subId]) sessions[subId] = [];
                sessions[subId].push(record);
              });

              // Take the first available session (usually the morning one)
              const firstSessionId = Object.keys(sessions)[0];
              const templateRecords = sessions[firstSessionId];
              
              templateRecords.forEach(record => {
                attendanceToUse[record.student_id] = record.status;
              });

              toast('Absensi otomatis diisi dari sesi sebelumnya hari ini.', {
                icon: 'ℹ️',
                duration: 4000
              });
            }

            setAttendance(prev => {
              const newAttendance = { ...prev };
              fetchedStudents.forEach(student => {
                // [FIX] Jangan override input guru yang belum tersimpan di semua cabang
                // (baik currentSubjectAttendance ada maupun pre-fill dari sesi lain)
                if (prev[student.id] !== undefined && prev[student.id] !== '') {
                  newAttendance[student.id] = prev[student.id];
                } else {
                  newAttendance[student.id] = attendanceToUse[student.id] || 'hadir';
                }
              });
              return newAttendance;
            });
          } catch (err) {
            setAttendance(prev => {
              const newAttendance = {};
              fetchedStudents.forEach(student => {
                newAttendance[student.id] = prev[student.id] || 'hadir';
              });
              return newAttendance;
            });
          }

          // Fetch activity categories & existing points
          try {
            const catRes = await api.get('/activity-categories');
            setActivityCategories(catRes.data.data || []);
          } catch (e) {
            // categories not required
          }
          try {
            const pointRes = await api.get('/activity-points', {
              params: { class_id: foundActiveSchedule.classId, subject_id: foundActiveSchedule.subjectId, date: targetDate }
            });
            const pointData = pointRes.data.data || {};
            // Convert { studentId: [catId, ...], ... } -> setActivityPoints
            setActivityPoints(pointData);
          } catch (e) {
            // points not required
          }
        } else {
          setStudents([]);
          setAttendance({});
          setPreviousMaterial(null);
        }
      } catch (error) {
        console.error('Error fetching schedule/students:', error);
      }
    };

    fetchActiveScheduleAndStudentsAndAttendance();
    // Only auto-refresh in real-time mode AND user tidak sedang edit
    let interval;
    if (!classIdFromUrl && !Object.keys(attendance).length) {
      interval = setInterval(fetchActiveScheduleAndStudentsAndAttendance, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSemester, academicYear, classIdFromUrl, subjectIdFromUrl, dateFromUrl]);

  const handleAttendanceChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const loadKegiatanClasses = async () => {
    setIsKegiatanLoading(true);
    try {
      const res = await api.get('/classes?all=true');
      const cls = res.data.data || res.data || [];
      setKegiatanClasses([...cls].sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
    } catch (err) {
      console.error('Error fetch classes for kegiatan:', err);
      setKegiatanClasses([]);
    } finally {
      setIsKegiatanLoading(false);
    }
  };

  const handleSelectKegiatanClass = async (cls) => {
    setSelectedKegiatanClass(cls);
    setStudents([]);
    setAttendance({});
    try {
      const targetDate = dateFromUrl || moment().format('YYYY-MM-DD');
      const studentsRes = await api.get('/students', { params: { class_id: cls.id } });
      const list = (studentsRes.data.data || studentsRes.data || []).sort((a, b) => {
        const absenA = parseInt(a.absen) || 0;
        const absenB = parseInt(b.absen) || 0;
        return absenA - absenB;
      });
      setStudents(list);

      // Prefill absensi kegiatan yang sudah ada (subject_id null) untuk tanggal ini
      const attendanceRes = await api.get('/attendances', {
        params: { date: targetDate, class_id: cls.id }
      });
      const all = attendanceRes.data.data || [];
      const kegiatan = all.filter(r => r.subject_id === null || r.subject_id === undefined || r.subject_id === '');
      const map = {};
      kegiatan.forEach(r => { map[r.student_id] = r.status; });

      setAttendance(prev => {
        const next = { ...prev };
        list.forEach(s => { next[s.id] = map[s.id] || 'hadir'; });
        return next;
      });
    } catch (err) {
      console.error('Error loading kegiatan students:', err);
      toast.error('Gagal memuat siswa kelas.');
    }
  };

  const handleSaveKegiatanAttendance = async () => {
    if (!selectedKegiatanClass || students.length === 0) {
      toast.error('Pilih kelas kegiatan terlebih dahulu.');
      return;
    }
    const targetDate = dateFromUrl || moment().format('YYYY-MM-DD');
    const isRepairMode = !!dateFromUrl;

    // [BATAS JAM] Non-admin realtime: hanya bisa isi dalam rentang jam kegiatan
    if (!isAdmin && !isRepairMode && kegiatanInfo?.start_time && kegiatanInfo?.end_time) {
      const now = moment();
      const start = moment(String(kegiatanInfo.start_time).slice(0, 5), 'HH:mm');
      const end = moment(String(kegiatanInfo.end_time).slice(0, 5), 'HH:mm');
      if (!now.isBetween(start, end, null, '[]')) {
        toast.error(`Absensi kegiatan hanya dapat diisi dalam rentang jam ${String(kegiatanInfo.start_time).slice(0, 5)} - ${String(kegiatanInfo.end_time).slice(0, 5)}.`);
        return;
      }
    }

    try {
      const attendanceData = students.map(student => ({
        student_id: student.id,
        status: attendance[student.id] || 'hadir',
        note: null,
      }));

      await api.post('/attendances/bulk', {
        date: targetDate,
        class_id: selectedKegiatanClass.id,
        subject_id: null,
        skip_time_check: isRepairMode,
        attendances: attendanceData,
      });

      toast.success(`Absensi kegiatan untuk kelas ${selectedKegiatanClass.rombel} berhasil disimpan!`);
      if (typeof refreshMonitoringData === 'function') {
        refreshMonitoringData();
      }
    } catch (error) {
      console.error('Error saving kegiatan attendance:', error);
      const msg = error.response?.data?.message || 'Gagal menyimpan absensi kegiatan.';
      toast.error(msg);
    }
  };

  const handleToggleActivityPoint = (studentId, catId) => {
    setActivityPoints(prev => {
      const current = prev[studentId] || [];
      if (current.includes(catId)) {
        return { ...prev, [studentId]: current.filter(id => id !== catId) };
      }
      return { ...prev, [studentId]: [...current, catId] };
    });
  };

  const handleSaveAttendance = useCallback(async (scheduleToSave, studentsToSave, attendanceToSave) => {
    if (!scheduleToSave || !studentsToSave || studentsToSave.length === 0) {
      toast.error('Tidak ada jadwal aktif atau siswa untuk disimpan.');
      return;
    }

    try {
      const attendanceDate = dateFromUrl || moment().format('YYYY-MM-DD');
      const attendanceData = studentsToSave.map(student => ({
        student_id: student.id,
        status: attendanceToSave[student.id] || 'hadir',
        note: null,
      }));

      const response = await api.post('/attendances/bulk', {
        date: attendanceDate,
        class_id: scheduleToSave.classId,
        subject_id: scheduleToSave.subjectId,
        attendances: attendanceData,
      });

      // Save activity points in bulk
      try {
        const pointsPayload = studentsToSave.map(student => ({
          student_id: student.id,
          activity_category_ids: activityPoints[student.id] || [],
        }));
        await api.post('/activity-points/bulk', {
          date: attendanceDate,
          class_id: scheduleToSave.classId,
          subject_id: scheduleToSave.subjectId,
          points: pointsPayload,
        });
      } catch (pointErr) {
        console.error('Error saving activity points:', pointErr);
        // Don't block attendance save for points failure
      }

      toast.success(`Absensi untuk kelas ${scheduleToSave.class} berhasil disimpan!`);

      // Refresh global monitoring cache if available (important for Admin help mode)
      if (typeof refreshMonitoringData === 'function') {
        refreshMonitoringData();
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      const msg = error.response?.data?.message || 'Gagal menyimpan absensi.';
      toast.error(msg);
    }
  }, [dateFromUrl]);

  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    // Only auto-save in real-time mode (not manual help mode)
    if (activeSchedule && !dateFromUrl) {
      const now = moment();
      const endTime = moment(activeSchedule.endTime, 'HH:mm');

      if (endTime.isBefore(now)) {
        endTime.add(1, 'day');
      }

      const timeUntilEnd = endTime.diff(now);

      if (timeUntilEnd > 0) {
        const scheduleToSave = activeSchedule;
        const studentsToSave = students;
        const attendanceToSave = attendance;

        autoSaveTimeout.current = setTimeout(() => {
          toast.success(`Waktu untuk kelas ${scheduleToSave.class} berakhir. Menyimpan absensi...`);
          handleSaveAttendance(scheduleToSave, studentsToSave, attendanceToSave);
        }, timeUntilEnd);
      }
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [activeSchedule, students, attendance, handleSaveAttendance]);

  const columns = [
    {
      header: { label: 'No. Absen', className: 'w-16' },
      accessor: 'absen',
      cellClassName: 'w-16',
    },
    {
      header: { label: 'NIS' },
      accessor: 'nis',
    },
    {
      header: { label: 'Nama' },
      accessor: 'name',
    },
    {
      header: { label: 'Jenis Kelamin' },
      accessor: row => (row.gender === 'L' ? 'L' : row.gender === 'P' ? 'P' : ''),
    },
    {
      header: { label: 'Absen' },
      accessor: row => (
        <div className="flex items-center gap-1 sm:gap-3">
          {[{ label: 'Hadir', value: 'hadir', color: 'peer-checked:bg-green-500 peer-checked:text-white', bg: 'bg-green-50' },
          { label: 'Sakit', value: 'sakit', color: 'peer-checked:bg-yellow-500 peer-checked:text-white', bg: 'bg-yellow-50' },
          { label: 'Ijin', value: 'izin', color: 'peer-checked:bg-blue-500 peer-checked:text-white', bg: 'bg-blue-50' },
          { label: 'Alpha', value: 'alpa', color: 'peer-checked:bg-red-500 peer-checked:text-white', bg: 'bg-red-50' }].map(statusOption => (
            <label key={statusOption.value} className="relative flex flex-col items-center cursor-pointer group">
              <input
                type="radio"
                className="sr-only peer"
                name={`attendance-${row.id}`}
                value={statusOption.value}
                checked={attendance[row.id] === statusOption.value}
                onChange={() => handleAttendanceChange(row.id, statusOption.value)}
              />
              <div className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full border-2 border-gray-200 dark:border-gray-600 ${statusOption.bg} dark:bg-gray-800 transition-all duration-300 ${statusOption.color} shadow-sm group-hover:scale-110 active:scale-95`}>
                <span className="text-xs sm:text-sm font-black">{statusOption.label.charAt(0)}</span>
              </div>
              <span className="text-[10px] hidden sm:block mt-1 font-bold text-gray-500 uppercase">{statusOption.label}</span>
            </label>
          ))}
        </div>
      ),
    },
    // Activity Points Column (only if categories exist and toggle is on)
    ...(activityCategories.length > 0 ? [{
      header: { label: '✨ Keaktifan', className: 'min-w-[160px]' },
      cellClassName: 'min-w-[160px]',
      accessor: row => (
        <div className="flex flex-wrap gap-1">
          {activityCategories.map(cat => {
            const isActive = (activityPoints[row.id] || []).includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleToggleActivityPoint(row.id, cat.id)}
                className={`text-xs px-2 py-1 rounded-full border transition-all ${
                  isActive
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300'
                    : 'bg-gray-50 border-gray-200 text-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500'
                } hover:scale-110 active:scale-95`}
                title={cat.name}
              >
                {cat.icon || '⭐'} {cat.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      ),
    }] : []),
  ];

  // Kolom tanpa "Keaktifan" untuk mode kegiatan (poin tidak disimpan di mode ini)
  const kegiatanColumns = columns.filter(col => (col.header?.label || '') !== '✨ Keaktifan');

  return (
    <div className="p-3 sm:p-6 bg-background-light dark:bg-background-dark min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark dark:text-primary-light mb-6">Absensi Siswa</h1>

      {dateFromUrl && dateFromUrl !== moment().format('YYYY-MM-DD') && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 rounded-3xl flex items-center gap-4 animate-pulse">
          <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg">
            <History size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-tighter">Mode Perbaikan Absensi</h3>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Anda sedang mengisi absensi untuk tanggal {moment(dateFromUrl).format('DD MMMM YYYY')}.</p>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 sm:p-6 rounded-3xl shadow-lg mb-6 border border-gray-200 dark:border-gray-700">

        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex-1 text-center md:text-left">
            {activeSchedule ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-primary dark:text-primary-light uppercase tracking-widest opacity-70">Sesi Belajar Aktif</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {activeSchedule.class} — {activeSchedule.subject}
                </h2>
                <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                  <div className="px-3 py-1 bg-primary/10 dark:bg-primary/20 rounded-full text-xs font-bold text-primary dark:text-primary-light border border-primary/20">
                    Smt {activeSemester}
                  </div>
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {academicYear}
                  </div>
                </div>
              </div>
            ) : isKegiatanMode ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-primary dark:text-primary-light uppercase tracking-widest opacity-70">Absensi Pagi Kegiatan</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {kegiatanInfo?.name || 'Kegiatan'}
                </h2>
                {kegiatanInfo?.start_time && kegiatanInfo?.end_time && (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Rentang Input Absensi: {String(kegiatanInfo.start_time).slice(0, 5)} - {String(kegiatanInfo.end_time).slice(0, 5)}
                  </p>
                )}
                <div className="flex items-center justify-center md:justify-start gap-4 mt-2">
                  <div className="px-3 py-1 bg-primary/10 dark:bg-primary/20 rounded-full text-xs font-bold text-primary dark:text-primary-light border border-primary/20">
                    Smt {activeSemester}
                  </div>
                  <div className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {academicYear}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <span className="animate-pulse">⏳</span>
                </div>
                <p className="text-sm font-medium italic">Menunggu jadwal aktif berikutnya...</p>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner">
            <ClockDisplay size="sm" variant="minimal" />
          </div>
        </div>

        {(previousMaterial || previousLearningActivities) && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Review Sesi Terakhir:</span>
            </div>
            <div className="flex-1">
              <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                {previousMaterial === 'Tidak ada materi sebelumnya' ? 'Belum ada catatan materi dari jurnal pertemuan terakhir.' : previousMaterial}
                {previousLearningActivities && previousLearningActivities !== 'Tidak ada aktivitas pembelajaran sebelumnya' && ` — ${previousLearningActivities}`}
              </p>
            </div>
          </div>
        )}
      </div>

      {activeSchedule?.isHoliday ? (
        <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-3xl shadow-lg flex items-center gap-4">
          <div className="bg-white/20 p-2 rounded-xl">
            <span className="text-2xl">📅</span>
          </div>
          <div>
            <h3 className="font-bold text-lg">Hari Libur / Agenda Sekolah</h3>
            <p className="text-sm opacity-90">Absensi tidak dapat dilakukan karena tanggal ini merupakan hari libur atau agenda sekolah.</p>
          </div>
        </div>
      ) : activeSchedule ? (
        <>
          <div className="overflow-x-auto bg-surface-light dark:bg-surface-dark rounded-lg shadow-md">
            <StyledTable headers={columns.map(col => col.header)}>
              {students.map((student, index) => (
                <tr key={student.id || index} className={
                  index % 2 === 0 ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'
                }>
                  {columns.map((col, colIndex) => (
                    <td key={colIndex} className={`px-6 py-4 text-sm text-text-light dark:text-text-dark ${col.cellClassName || ''}`}>
                      {typeof col.accessor === 'function' ? col.accessor(student, index) : student[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))}
            </StyledTable>
          </div>
          <button
            onClick={() => handleSaveAttendance(activeSchedule, students, attendance)}
            className="mt-6 px-6 py-3 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition duration-300"
          >
            Simpan Absensi
          </button>
        </>
      ) : isKegiatanMode ? (
        selectedKegiatanClass ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                Absen Pagi Kegiatan — {selectedKegiatanClass.rombel}
              </h3>
              <button
                onClick={() => { setSelectedKegiatanClass(null); setStudents([]); setAttendance({}); }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Ganti Kelas
              </button>
            </div>
            <div className="overflow-x-auto bg-surface-light dark:bg-surface-dark rounded-lg shadow-md">
              <StyledTable headers={kegiatanColumns.map(col => col.header)}>
                {students.map((student, index) => (
                  <tr key={student.id || index} className={
                    index % 2 === 0 ? 'bg-white dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'
                  }>
                    {kegiatanColumns.map((col, colIndex) => (
                      <td key={colIndex} className={`px-6 py-4 text-sm text-text-light dark:text-text-dark ${col.cellClassName || ''}`}>
                        {typeof col.accessor === 'function' ? col.accessor(student, index) : student[col.accessor]}
                      </td>
                    ))}
                  </tr>
                ))}
              </StyledTable>
            </div>
            <button
              onClick={handleSaveKegiatanAttendance}
              className="mt-6 px-6 py-3 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition duration-300"
            >
              Simpan Absensi Kegiatan
            </button>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-1">Pilih Kelas untuk Absen Pagi Kegiatan</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Kegiatan {kegiatanInfo?.name || ''} berlangsung hari ini. Pilih kelas yang Anda ampu untuk mencatat kehadiran pagi.
            </p>
            {isKegiatanLoading ? (
              <p className="text-sm text-slate-400 animate-pulse">Memuat kelas...</p>
            ) : kegiatanClasses.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {kegiatanClasses.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => handleSelectKegiatanClass(cls)}
                    className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl border border-transparent hover:border-blue-500 hover:scale-105 transition-all text-center shadow-md group"
                  >
                    <p className="text-sm font-black text-blue-700 dark:text-blue-300">{cls.rombel}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada kelas yang dapat diinput untuk kegiatan ini.</p>
            )}
          </div>
        )
      ) : (
        <RunningText text="Tidak ada jadwal aktif saat ini. Silakan cek jadwal Anda." />
      )}
    </div>
  );
};

export default AbsensiPage;