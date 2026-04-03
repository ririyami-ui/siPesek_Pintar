import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import moment from 'moment';
import api from '../lib/axios';
import StyledTable from '../components/StyledTable';
import ClockDisplay from '../components/ClockDisplay';
import { useSettings } from '../utils/SettingsContext';
import RunningText from '../components/RunningText';

const AbsensiPage = () => {
  const [activeSchedule, setActiveSchedule] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: "Hadir" }
  const [previousMaterial, setPreviousMaterial] = useState(null);
  const [previousLearningActivities, setPreviousLearningActivities] = useState(null);
  const { activeSemester, academicYear } = useSettings();

  const autoSaveTimeout = useRef(null);

  useEffect(() => {
    const fetchActiveScheduleAndStudentsAndAttendance = async () => {
      try {
        const now = moment();
        const todayDayName = now.locale('en').format('dddd');
        const dayMap = {
          'Sunday': 'Minggu',
          'Monday': 'Senin',
          'Tuesday': 'Selasa',
          'Wednesday': 'Rabu',
          'Thursday': 'Kamis',
          'Friday': 'Jumat',
          'Saturday': 'Sabtu',
        };
        const currentDayIndonesian = dayMap[todayDayName];
        const attendanceDate = now.format('YYYY-MM-DD');

        // Fetch schedules for today
        const scheduleRes = await api.get('/schedules', {
          params: { day: currentDayIndonesian }
        });
        const schedules = scheduleRes.data.data || scheduleRes.data;

        let foundActiveSchedule = null;

        for (const schedule of schedules) {
          const className = schedule.class?.rombel || schedule.className || '';
          const classId = schedule.class_id || schedule.classId || '';
          const subjectId = schedule.subject_id || schedule.subjectId || '';
          const subjectName = schedule.subject?.name || schedule.subjectName || schedule.subject || '';

          const startTime = moment(schedule.start_time || schedule.startTime, 'HH:mm:ss');
          let endTime = moment(schedule.end_time || schedule.endTime, 'HH:mm:ss');

          if (endTime.isBefore(startTime)) {
            endTime.add(1, 'day');
          }

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

          // Fetch last journal entry for previous material context
          try {
            const journalRes = await api.get('/journals', {
              params: {
                class_id: foundActiveSchedule.classId,
                subject_id: foundActiveSchedule.subjectId,
              }
            });
            const journals = journalRes.data.data || journalRes.data || [];
            if (journals.length > 0) {
              // Get the most recent journal
              const lastJournal = journals.sort((a, b) => moment(b.date).diff(moment(a.date)))[0];
              setPreviousMaterial(lastJournal.topic || 'Tidak ada materi sebelumnya');
              setPreviousLearningActivities(lastJournal.notes || 'Tidak ada aktivitas pembelajaran sebelumnya');
            } else {
              setPreviousMaterial('Tidak ada materi sebelumnya');
              setPreviousLearningActivities('Tidak ada aktivitas pembelajaran sebelumnya');
            }
          } catch (err) {
            console.log('No previous journal found');
            setPreviousMaterial('Tidak ada materi sebelumnya');
            setPreviousLearningActivities('Tidak ada aktivitas pembelajaran sebelumnya');
          }

          // Fetch existing attendance for today
          try {
            const attendanceRes = await api.get('/attendances', {
              params: {
                date: attendanceDate,
                class_id: foundActiveSchedule.classId,
                subject_id: foundActiveSchedule.subjectId,
              }
            });
            const existingAttendance = attendanceRes.data.data || [];
            const loadedAttendance = {};
            existingAttendance.forEach(record => {
              loadedAttendance[record.student_id] = record.status;
            });

            setAttendance(prev => {
              const newAttendance = { ...prev };
              fetchedStudents.forEach(student => {
                if (!newAttendance[student.id]) {
                  newAttendance[student.id] = loadedAttendance[student.id] || 'hadir';
                }
              });
              return newAttendance;
            });
          } catch (err) {
            // No existing attendance, default to 'hadir'
            setAttendance(prev => {
              const newAttendance = {};
              fetchedStudents.forEach(student => {
                newAttendance[student.id] = prev[student.id] || 'hadir';
              });
              return newAttendance;
            });
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
    const interval = setInterval(fetchActiveScheduleAndStudentsAndAttendance, 60000);

    return () => clearInterval(interval);
  }, [activeSemester, academicYear]);

  const handleAttendanceChange = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSaveAttendance = useCallback(async (scheduleToSave, studentsToSave, attendanceToSave) => {
    if (!scheduleToSave || !studentsToSave || studentsToSave.length === 0) {
      toast.error('Tidak ada jadwal aktif atau siswa untuk disimpan.');
      return;
    }

    try {
      const attendanceDate = moment().format('YYYY-MM-DD');
      const attendanceData = studentsToSave.map(student => ({
        student_id: student.id,
        status: attendanceToSave[student.id] || 'hadir',
        note: null,
      }));

      await api.post('/attendances/bulk', {
        date: attendanceDate,
        class_id: scheduleToSave.classId,
        subject_id: scheduleToSave.subjectId,
        attendances: attendanceData,
      });

      toast.success(`Absensi untuk kelas ${scheduleToSave.class} berhasil disimpan!`);
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Gagal menyimpan absensi.');
    }
  }, []);

  useEffect(() => {
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }

    if (activeSchedule) {
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
  ];

  return (
    <div className="p-3 sm:p-6 bg-background-light dark:bg-background-dark min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark dark:text-primary-light mb-6">Absensi Siswa</h1>

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

      {activeSchedule ? (
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
      ) : (
        <RunningText text="Tidak ada jadwal aktif saat ini. Silakan cek jadwal Anda." />
      )}
    </div>
  );
};

export default AbsensiPage;