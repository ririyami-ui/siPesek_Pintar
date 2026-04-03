import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Trash, Plus, Calendar, Clock, BookOpen, User, CheckCircle2, Circle, AlertCircle, Edit3, X } from 'lucide-react';
import api from '../lib/axios';
import moment from 'moment';
import toast from 'react-hot-toast';
import StyledInput from '../components/StyledInput';
import StyledSelect from '../components/StyledSelect';
import StyledButton from '../components/StyledButton';
import StyledTable from '../components/StyledTable';
import { useSettings } from '../utils/SettingsContext';
import Modal from '../components/Modal';
import { Trash2 } from 'lucide-react';

export default function PenugasanPage() {
  const [tasks, setTasks] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activeSemester, academicYear } = useSettings();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Form State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);

  const fetchInitialData = async () => {
    try {
      const [classesRes, subjectsRes] = await Promise.all([
        api.get('/classes?all=true'),
        api.get('/subjects')
      ]);

      const classData = classesRes.data.data || classesRes.data || [];
      setClasses(classData.map(c => ({ id: String(c.id), ...c })));
      const subjectData = subjectsRes.data.data || subjectsRes.data || [];
      setSubjects(subjectData.map(s => ({ id: String(s.id), ...s })));
    } catch (error) {
      console.error("Error fetching initial data:", error);
      toast.error('Gagal memuat data pendukung.');
    }
  };

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/student-tasks', {
        params: {
          semester: activeSemester,
          academic_year: academicYear
        }
      });
      const taskData = res.data.data || res.data || [];
      setTasks(taskData.map(task => ({ id: String(task.id), ...task })));
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error('Gagal memuat daftar tugas.');
    } finally {
      setIsLoading(false);
    }
  }, [activeSemester, academicYear]);

  useEffect(() => {
    fetchInitialData();
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !taskTitle || !deadline) {
      toast.error('Harap lengkapi informasi tugas (Kelas, Mapel, Judul, Deadline).');
      return;
    }

    try {
      const taskData = {
        class_id: selectedClass,
        subject_id: selectedSubject,
        title: taskTitle,
        description: taskDescription,
        deadline: deadline,
        semester: activeSemester,
        academic_year: academicYear,
      };

      if (isEditing) {
        await api.put(`/student-tasks/${currentTaskId}`, taskData);
        toast.success('Tugas berhasil diperbarui!');
        setIsEditing(false);
        setCurrentTaskId(null);
      } else {
        await api.post('/student-tasks', {
          ...taskData,
          status: 'Pending'
        });
        toast.success('Tugas berhasil ditambahkan!');
      }

      setTaskTitle('');
      setTaskDescription('');
      setDeadline('');
      fetchTasks();
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error(isEditing ? 'Gagal memperbarui tugas.' : 'Gagal menambahkan tugas.');
    }
  };

  const handleEditClick = (task) => {
    setSelectedClass(task.classId || task.className);
    setSelectedSubject(task.subjectId || task.subjectName);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setDeadline(task.deadline);
    setIsEditing(true);
    setCurrentTaskId(task.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setCurrentTaskId(null);
    setTaskTitle('');
    setTaskDescription('');
    setDeadline('');
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
      await api.put(`/student-tasks/${taskId}`, { status: newStatus });
      toast.success(`Tugas ditandai sebagai ${newStatus === 'Completed' ? 'Selesai' : 'Tertunda'}`);
      fetchTasks();
    } catch (error) {
      console.error("Error updating task status:", error);
      toast.error('Gagal memperbarui status tugas.');
    }
  };

  const handleDeleteTask = (taskId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Tugas',
      message: 'Apakah Anda yakin ingin menghapus tugas ini? Tindakan ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        try {
          await api.delete(`/student-tasks/${taskId}`);
          toast.success('Tugas berhasil dihapus.');
          fetchTasks();
        } catch (error) {
          console.error("Error deleting task:", error);
          toast.error('Gagal menghapus tugas.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
          {isEditing ? <Edit3 size={24} className="text-orange-500" /> : <Plus size={24} className="text-primary" />}
          {isEditing ? 'Edit Penugasan' : 'Tambah Penugasan Baru'}
        </h2>

        <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <StyledSelect
              label="Kelas"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              required
            >
              <option value="">Pilih Kelas</option>
              {classes.slice().sort((a, b) => a.rombel.localeCompare(b.rombel)).map(cls => (
                <option key={cls.id} value={cls.id}>{cls.rombel}</option>
              ))}
            </StyledSelect>

            <StyledSelect
              label="Mata Pelajaran"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              required
            >
              <option value="">Pilih Mata Pelajaran</option>
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </StyledSelect>

            <StyledInput
              type="date"
              label="Deadline (Batas Waktu)"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>

          <div className="space-y-4 text-left">
            <StyledInput
              label="Judul Tugas"
              placeholder="Contoh: Tugas Mandiri Bab 3"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              required
            />
            <StyledInput
              type="textarea"
              label="Keterangan / Deskripsi (Opsional)"
              placeholder="Jelaskan detail tugas atau materi yang harus dikumpulkan"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end pt-2 gap-3">
              {isEditing && (
                <StyledButton
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  className="!border-gray-300 !text-gray-500 hover:!bg-gray-100 dark:hover:!bg-gray-700 dark:!border-gray-600 flex items-center"
                >
                  <X size={18} className="mr-2" /> Batalkan Edit
                </StyledButton>
              )}
              <StyledButton type="submit" className="flex items-center">
                {isEditing ? <CheckCircle2 size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                {isEditing ? 'Update Penugasan' : 'Simpan Penugasan'}
              </StyledButton>
            </div>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-800">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2">
          <ClipboardCheck size={24} className="text-primary" />
          Daftar Penugasan Siswa
        </h2>

        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <StyledTable headers={['Status', 'Tugas', 'Kelas / Mapel', 'Deadline', 'Aksi']}>
              {tasks.map((task) => {
                const isOverdue = moment().isAfter(moment(task.deadline), 'day') && task.status === 'Pending';
                return (
                  <tr key={task.id} className={task.status === 'Completed' ? 'opacity-60 bg-gray-50 dark:bg-gray-900/40' : ''}>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleTaskStatus(task.id, task.status)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${task.status === 'Completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200'
                          }`}
                      >
                        {task.status === 'Completed' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        {task.status === 'Completed' ? 'Selesai' : 'Belum'}
                      </button>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm ${task.status === 'Completed' ? 'line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-xs text-text-muted-light dark:text-text-muted-dark line-clamp-1 italic">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-primary">{task.className}</span>
                        <span className="text-text-muted-light dark:text-text-muted-dark">{task.subjectName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className={`flex items-center gap-1 text-xs font-bold ${isOverdue ? 'text-red-500 animate-pulse' : 'text-text-light dark:text-text-dark'}`}>
                        <Calendar size={14} />
                        {moment(task.deadline).format('DD MMM YYYY')}
                        {isOverdue && <AlertCircle size={14} />}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(task)}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit Tugas"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Hapus Tugas"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </StyledTable>
          </div>
        ) : (
          <div className="text-center py-10 text-text-muted-light dark:text-text-muted-dark italic">
            Belum ada tugas yang ditambahkan untuk semester ini.
          </div>
        )}
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
}
