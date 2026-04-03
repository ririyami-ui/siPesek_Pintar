import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';
import Modal from './Modal';
import { Trash2, Edit } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';

const ScheduleInputMasterData = () => {
  const { activeSemester, academicYear } = useSettings();
  const [day, setDay] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [scheduleType, setScheduleType] = useState('teaching');
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [activityName, setActivityName] = useState('');

  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  useEffect(() => {
    fetchMasterData();
    fetchSchedules();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [subjectsRes, classesRes, userRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/classes'),
        api.get('/me')
      ]);
      
      const allSubjects = subjectsRes.data.data || subjectsRes.data || [];
      const allClasses = classesRes.data.data || classesRes.data || [];
      const userData = userRes.data;

      if (userData.role === 'teacher') {
        const teacherRes = await api.get('/teachers');
        const teachers = teacherRes.data.data || teacherRes.data || [];
        const currentTeacher = teachers.find(t => t.auth_user_id === userData.id);

        if (currentTeacher && currentTeacher.assignments) {
          setAssignments(currentTeacher.assignments);
          
          const assignedSubjectIds = new Set(currentTeacher.assignments.map(a => a.subject_id));
          const assignedClassIds = new Set(currentTeacher.assignments.map(a => a.class_id));

          setSubjects(allSubjects.filter(s => assignedSubjectIds.has(s.id)));
          setClasses(allClasses.filter(c => assignedClassIds.has(c.id)).sort((a, b) => a.rombel.localeCompare(b.rombel)));
        } else {
          setAssignments([]);
          setSubjects([]);
          setClasses([]);
        }
      } else {
        setAssignments([]);
        setSubjects(allSubjects);
        setClasses(allClasses.sort((a, b) => a.rombel.localeCompare(b.rombel)));
      }
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Gagal memuat data kelas/mata pelajaran.');
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await api.get('/schedules');
      setSchedules(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast.error('Gagal memuat jadwal.');
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!day || !startTime || !endTime) {
      toast.error('Hari dan Waktu wajib diisi.');
      return;
    }

    if (scheduleType === 'teaching' && (!selectedSubject || !selectedClass)) {
      toast.error('Kelas dan Mata Pelajaran wajib diisi untuk KBM.');
      return;
    }

    if (scheduleType === 'non-teaching' && !activityName) {
      toast.error('Nama Kegiatan wajib diisi untuk Non-KBM.');
      return;
    }

    setIsSubmitting(true);

    try {
      const scheduleData = {
        day,
        start_time: startTime,
        end_time: endTime,
        type: scheduleType,
        start_period: startPeriod ? parseInt(startPeriod) : null,
        end_period: endPeriod ? parseInt(endPeriod) : null,
        activity_name: scheduleType === 'non-teaching' ? activityName : null,
        subject_id: scheduleType === 'teaching' ? selectedSubject : null,
        class_id: scheduleType === 'teaching' ? selectedClass : null,
        teacher_id: null,
      };

      if (editingScheduleId) {
        await api.put(`/schedules/${editingScheduleId}`, scheduleData);
        toast.success('Jadwal berhasil diperbarui!');
        setEditingScheduleId(null);
      } else {
        await api.post('/schedules', scheduleData);
        toast.success('Jadwal berhasil ditambahkan!');
      }

      // Reset form
      setDay('');
      setStartTime('');
      setEndTime('');
      setSelectedSubject('');
      setSelectedClass('');
      setScheduleType('teaching');
      setStartPeriod('');
      setEndPeriod('');
      setActivityName('');

      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast.error('Gagal menyimpan jadwal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setDay(schedule.day);
    setStartTime(schedule.start_time);
    setEndTime(schedule.end_time);
    setScheduleType(schedule.type || 'teaching');
    setStartPeriod(schedule.start_period || '');
    setEndPeriod(schedule.end_period || '');
    setActivityName(schedule.activity_name || '');
    setSelectedSubject(schedule.subject_id || '');
    setSelectedClass(schedule.class_id || '');
  };

  const handleDeleteSchedule = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Jadwal',
      message: 'Apakah Anda yakin ingin menghapus jadwal ini?',
      onConfirm: async () => {
        try {
          await api.delete(`/schedules/${id}`);
          toast.success('Jadwal berhasil dihapus!');
          fetchSchedules();
        } catch (error) {
          console.error('Error deleting schedule:', error);
          toast.error('Gagal menghapus jadwal.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const cancelEditing = () => {
    setEditingScheduleId(null);
    setDay('');
    setStartTime('');
    setEndTime('');
    setScheduleType('teaching');
    setStartPeriod('');
    setEndPeriod('');
    setActivityName('');
    setSelectedSubject('');
    setSelectedClass('');
  };

  return (
    <div className="p-4 bg-white shadow-md rounded-lg dark:bg-gray-800">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Input Jadwal Mengajar</h2>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
          Semester: {activeSemester} (Tahun Ajaran {academicYear})
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleAddSchedule} className="space-y-4">
            <StyledSelect
              label="Hari:"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            >
              <option value="">Pilih Hari</option>
              {daysOfWeek.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </StyledSelect>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">Tipe Kegiatan:</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setScheduleType('teaching')}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${scheduleType === 'teaching' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  Mengajar (KBM)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('non-teaching')}
                  className={`flex-1 py-2 text-xs font-semibold transition-colors ${scheduleType === 'non-teaching' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  Non-KBM (Istirahat/Lainnya)
                </button>
              </div>
            </div>

            {scheduleType === 'teaching' ? (
              <>
                <StyledSelect
                  label="Kelas:"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  required={scheduleType === 'teaching'}
                >
                  <option value="">Pilih Kelas</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.rombel}</option>
                  ))}
                </StyledSelect>

                <StyledSelect
                  label="Mata Pelajaran:"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  required={scheduleType === 'teaching'}
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  {subjects
                    .filter(sub => {
                      if (!selectedClass) return true;
                      if (assignments.length === 0) return true;
                      return assignments.some(a => a.subject_id === sub.id && a.class_id == selectedClass);
                    })
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                </StyledSelect>
              </>
            ) : (
              <StyledInput
                type="text"
                label="Nama Kegiatan:"
                placeholder="Misal: Istirahat, Upacara, Rapat"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                required={scheduleType === 'non-teaching'}
              />
            )}

            <StyledInput
              type="number"
              label="Jam ke:"
              min="1"
              value={startPeriod}
              onChange={(e) => setStartPeriod(e.target.value)}
            />

            <StyledInput
              type="number"
              label="Sampai jam ke:"
              min="1"
              value={endPeriod}
              onChange={(e) => setEndPeriod(e.target.value)}
            />

            <StyledInput
              type="time"
              label="Waktu Mulai:"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />

            <StyledInput
              type="time"
              label="Waktu Selesai:"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />

            <div className="flex gap-2">
              <StyledButton type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Menyimpan...' : (editingScheduleId ? 'Update Jadwal' : 'Simpan Jadwal')}
              </StyledButton>
              {editingScheduleId && (
                <StyledButton type="button" onClick={cancelEditing} variant="secondary">
                  Batal
                </StyledButton>
              )}
            </div>
          </form>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold mb-3">Daftar Jadwal Tersimpan</h3>
          {schedules.length === 0 ? (
            <p className="text-gray-500">Tidak ada jadwal yang tersimpan.</p>
          ) : (
            <div className="overflow-x-auto">
              <StyledTable headers={['Hari', 'Kelas', 'Mata Pelajaran', 'Waktu', 'Aksi']}>
                {schedules.sort((a, b) => {
                  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
                  const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
                  if (dayDiff !== 0) return dayDiff;
                  
                  // Sort by Class Name (Rombel)
                  const classA = classes.find(c => c.id == a.class_id)?.rombel || a.className || '';
                  const classB = classes.find(c => c.id == b.class_id)?.rombel || b.className || '';
                  const classDiff = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
                  if (classDiff !== 0) return classDiff;

                  const periodA = parseInt(a.start_period) || 0;
                  const periodB = parseInt(b.start_period) || 0;
                  if (periodA !== periodB) return periodA - periodB;
                  
                  return (a.start_time || '').localeCompare(b.start_time || '');
                }).map((schedule) => {
                  const classInfo = classes.find(c => c.id == schedule.class_id);
                  const subjectInfo = subjects.find(s => s.id == schedule.subject_id);

                  return (
                    <tr key={schedule.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-light dark:text-text-dark">{schedule.day}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">
                        {schedule.type === 'non-teaching' ? '-' : (classInfo?.rombel || schedule.className || '-')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">
                        {schedule.type === 'non-teaching' ? (
                          <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {schedule.activity_name || 'Non-KBM'}
                          </span>
                        ) : (
                          subjectInfo?.name || schedule.subjectName || '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">
                        {schedule.start_time} - {schedule.end_time}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <StyledButton onClick={() => handleEditSchedule(schedule)} variant="primary" size="sm">
                          <Edit size={16} />
                        </StyledButton>
                        <StyledButton onClick={() => handleDeleteSchedule(schedule.id)} variant="danger" size="sm">
                          <Trash2 size={16} />
                        </StyledButton>
                      </td>
                    </tr>
                  );
                })}
              </StyledTable>
            </div>
          )}
        </div>
      </div>

      {confirmModal.isOpen && (
        <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ScheduleInputMasterData;
