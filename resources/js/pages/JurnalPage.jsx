import React, { useState, useEffect, useCallback } from 'react';
import { Save, Trash, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import moment from 'moment';
import toast from 'react-hot-toast';
import StyledInput from '../components/StyledInput';
import StyledSelect from '../components/StyledSelect';
import StyledButton from '../components/StyledButton';
import StyledTable from '../components/StyledTable';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../utils/SettingsContext';
import JournalReminder from '../components/JournalReminder';
import { getTopicForSchedule } from '../utils/topicUtils';

export default function JurnalPage() {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [topic, setTopic] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [learningActivities, setLearningActivities] = useState('');
  const [reflection, setReflection] = useState('');
  const [status, setStatus] = useState('Terlaksana');
  const [followUp, setFollowUp] = useState('');
  const [notes, setNotes] = useState('');
  const [isAssignment, setIsAssignment] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [journals, setJournals] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingJournalId, setEditingJournalId] = useState(null);
  const [filterClass, setFilterClass] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const { activeSemester, academicYear, userProfile } = useSettings();

  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const subjectIdFromUrl = searchParams.get('subjectId');
  const dateFromUrl = searchParams.get('date');
  const teacherIdFromUrl = searchParams.get('teacherId');

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    if (dateFromUrl) {
      setCurrentDate(dateFromUrl);
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setCurrentDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [dateFromUrl]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [
          api.get('/classes'),
          api.get('/subjects'),
          api.get('/teaching-programs'),
        ];
        
        if (isAdmin) {
          fetchPromises.push(api.get('/teachers'));
        }

        const responses = await Promise.all(fetchPromises);
        const classesRes = responses[0];
        const subjectsRes = responses[1];
        const programsRes = responses[2];
        const teachersRes = responses[3];

        const fetchedClasses = (classesRes.data.data || classesRes.data).sort((a, b) => a.rombel.localeCompare(b.rombel));
        const fetchedSubjects = subjectsRes.data.data || subjectsRes.data;
        const rawPrograms = programsRes.data.data || programsRes.data || [];
        const fetchedPrograms = (Array.isArray(rawPrograms) ? rawPrograms : Object.values(rawPrograms)).map(p => ({
          ...p,
          subject: p.subject?.name || '',
          gradeLevel: p.grade_level,
          academicYear: p.academic_year,
          pekanEfektif: p.pekan_efektif,
          updatedAt: p.updated_at
        }));

        setClasses(fetchedClasses);
        setSubjects(fetchedSubjects);
        setPrograms(fetchedPrograms);
        
        if (teachersRes) {
          setTeachers(teachersRes.data.data || teachersRes.data || []);
        }

        if (classIdFromUrl) {
          const preselectedClass = fetchedClasses.find(cls => cls.rombel === classIdFromUrl || cls.id == classIdFromUrl);
          if (preselectedClass) setSelectedClass(preselectedClass.id);
        }
        if (subjectIdFromUrl) {
          const preselectedSubject = fetchedSubjects.find(sub => sub.name === subjectIdFromUrl || sub.id == subjectIdFromUrl);
          if (preselectedSubject) setSelectedSubject(preselectedSubject.id);
        }
        if (teacherIdFromUrl) {
          setSelectedTeacher(teacherIdFromUrl);
        } else if (userProfile?.id) {
          setSelectedTeacher(userProfile.id);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
        toast.error('Gagal memuat data pendukung.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userProfile) fetchData();
  }, [classIdFromUrl, subjectIdFromUrl, teacherIdFromUrl, userProfile, isAdmin]);

  // Auto-fill topic from PROMES
  useEffect(() => {
    if (selectedClass && selectedSubject && programs.length > 0 && !editingJournalId) {
      const classData = classes.find(c => c.id == selectedClass);
      const subjectData = subjects.find(s => s.id == selectedSubject);
      
      if (classData && subjectData) {
        const dummySchedule = {
          class: classData.rombel,
          subject: subjectData.name
        };
        const suggestedTopic = getTopicForSchedule(
          dummySchedule, 
          currentDate || moment(), 
          programs, 
          classes, 
          activeSemester, 
          academicYear
        );
        
        if (suggestedTopic) {
          setTopic(suggestedTopic);
        }
      }
    }
  }, [selectedClass, selectedSubject, currentDate, programs, classes, subjects, activeSemester, academicYear, editingJournalId]);

  const fetchJournalEntries = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await api.get('/journals');
      const fetchedJournals = response.data.data || response.data || [];
      setJournals(fetchedJournals);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      toast.error('Gagal memuat jurnal mengajar.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournalEntries();
  }, [fetchJournalEntries, activeSemester, academicYear]);

  const handleSaveJournal = async () => {
    if (!selectedClass || !selectedSubject || !topic) {
      toast.error('Harap lengkapi Kelas, Mata Pelajaran, dan Materi.');
      return;
    }

    const classData = classes.find(cls => cls.id == selectedClass);
    const subjectData = subjects.find(sub => sub.id == selectedSubject);

    if (!classData || !subjectData) {
      toast.error('Kelas atau Mata Pelajaran tidak ditemukan.');
      return;
    }

    const journalData = {
      date: moment(currentDate).format('YYYY-MM-DD'),
      class_id: classData.id,
      subject_id: subjectData.id,
      topic: topic,
      learning_objectives: learningObjectives,
      learning_activities: learningActivities,
      reflection: reflection,
      status: status,
      follow_up: followUp,
      notes: notes,
      is_assignment: isAssignment,
      user_id: isAdmin ? selectedTeacher : userProfile?.id,
    };

    const promise = editingJournalId
      ? api.put(`/journals/${editingJournalId}`, journalData)
      : api.post('/journals', journalData);

    toast.promise(promise, {
      loading: editingJournalId ? 'Menyimpan perubahan...' : 'Menyimpan jurnal...',
      success: () => {
        setSelectedClass('');
        setSelectedSubject('');
        setLearningObjectives('');
        setLearningActivities('');
        setReflection('');
        setStatus('Terlaksana');
        setFollowUp('');
        setNotes('');
        setIsAssignment(false);
        setEditingJournalId(null);
        fetchJournalEntries(true);
        return editingJournalId ? 'Perubahan berhasil disimpan!' : 'Jurnal berhasil disimpan!';
      },
      error: 'Gagal menyimpan jurnal.',
    });
  };

  const handleEditJournal = (journal) => {
    setEditingJournalId(journal.id);
    setCurrentDate(moment(journal.date).format('YYYY-MM-DD'));
    setSelectedClass(journal.class_id);
    setSelectedSubject(journal.subject_id);
    setTopic(journal.topic);
    setLearningObjectives(journal.learning_objectives || '');
    setLearningActivities(journal.learning_activities || '');
    setReflection(journal.reflection || '');
    setStatus(journal.status || 'Terlaksana');
    setFollowUp(journal.follow_up || '');
    setNotes(journal.notes || '');
    setIsAssignment(journal.is_assignment || false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteJournal = async (journalId) => {
    toast.promise(api.delete(`/journals/${journalId}`), {
      loading: 'Menghapus jurnal...',
      success: () => {
        fetchJournalEntries(true);
        return 'Jurnal berhasil dihapus!';
      },
      error: 'Gagal menghapus jurnal.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Jurnal Mengajar</h2>
      
      <JournalReminder
        activeSemester={activeSemester}
        academicYear={academicYear}
      />

      <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-gray-800">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Form Section */}
          <div className="lg:w-1/3">
            <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg mb-6 space-y-4">
              <StyledInput
                type="date"
                label="Tanggal"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />

              <StyledSelect
                label="Kelas"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Pilih Kelas</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.rombel}</option>
                ))}
              </StyledSelect>

              <StyledSelect
                label="Mata Pelajaran"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Pilih Mata Pelajaran</option>
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </StyledSelect>

              {isAdmin && (
                <StyledSelect
                  label="Guru (Admin Only)"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                >
                  <option value="">Pilih Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.auth_user_id}>{t.name}</option>
                  ))}
                </StyledSelect>
              )}

              <StyledInput
                type="text"
                label="Materi"
                placeholder="Materi yang diajarkan"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <StyledInput
                type="textarea"
                label="Tujuan Pembelajaran"
                placeholder="Tujuan pembelajaran hari ini"
                voiceEnabled={true}
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
              />

              <StyledInput
                type="textarea"
                label="Kegiatan Pembelajaran"
                placeholder="Deskripsi kegiatan di kelas"
                voiceEnabled={true}
                value={learningActivities}
                onChange={(e) => setLearningActivities(e.target.value)}
              />

              <StyledInput
                type="textarea"
                label="Refleksi"
                placeholder="Refleksi diri setelah mengajar"
                voiceEnabled={true}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />

              <StyledSelect
                label="Keterlaksanaan Pembelajaran"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Terlaksana">Terlaksana</option>
                <option value="Terlaksana Sebagian">Terlaksana Sebagian</option>
                <option value="Tidak Terlaksana">Tidak Terlaksana</option>
              </StyledSelect>

              <StyledInput
                type="textarea"
                label="Tindak Lanjut"
                placeholder="Rencana tindak lanjut"
                voiceEnabled={true}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAssignment"
                  checked={isAssignment}
                  onChange={(e) => setIsAssignment(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="isAssignment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dinas Luar / Berikan Tugas Mandiri
                </label>
              </div>

              <div className="mt-6 flex gap-2">
                <StyledButton onClick={handleSaveJournal} className="flex-1">
                  <Save size={16} className="mr-2" />
                  {editingJournalId ? 'Simpan Perubahan' : 'Simpan Jurnal'}
                </StyledButton>
                {editingJournalId && (
                  <StyledButton
                    onClick={() => {
                      setEditingJournalId(null);
                      setLearningObjectives('');
                      setLearningActivities('');
                      setReflection('');
                      setStatus('Terlaksana');
                      setFollowUp('');
                      setNotes('');
                      setIsAssignment(false);
                    }}
                    variant="outline"
                  >
                    Batal
                  </StyledButton>
                )}
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="lg:w-2/3 overflow-x-auto">
            <div className="mb-4 flex flex-col md:flex-row gap-4">
              <StyledSelect
                label="Filter Kelas"
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="md:w-48"
              >
                <option value="">Semua Kelas</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.rombel}</option>
                ))}
              </StyledSelect>

              {isAdmin && (
                <StyledSelect
                  label="Filter Guru"
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="md:w-64"
                >
                  <option value="">Semua Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.auth_user_id}>{t.name}</option>
                  ))}
                </StyledSelect>
              )}
            </div>

            {journals.length > 0 ? (
              <div className="overflow-y-auto h-96">
                <StyledTable headers={
                  isAdmin 
                    ? ['Tanggal', 'Guru', 'Kelas', 'Mata Pelajaran', 'Materi', 'Status', 'Aksi']
                    : ['Tanggal', 'Kelas', 'Mata Pelajaran', 'Materi', 'Status', 'Aksi']
                }>
                  {journals
                    .slice()
                    .filter(j => !filterClass || j.class_id == filterClass)
                    .filter(j => !filterTeacher || j.user_id == filterTeacher)
                    .sort((a, b) => moment(b.date).diff(moment(a.date)))
                    .map(journal => {
                    const classInfo = classes.find(c => c.id == journal.class_id);
                    const subjectInfo = subjects.find(s => s.id == journal.subject_id);

                    return (
                      <tr key={journal.id}>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm font-medium text-text-light dark:text-text-dark">
                          {moment(journal.date).format('DD/MM/YYYY')}
                        </td>
                        {isAdmin && (
                          <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm text-text-dark dark:text-text-dark font-medium">
                            {journal.teacher?.name || '-'}
                          </td>
                        )}
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark">
                          {classInfo?.rombel || '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark">
                          {subjectInfo?.name || '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark font-medium">
                          {journal.topic}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              journal.status === 'Terlaksana' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              journal.status === 'Tidak Terlaksana' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                              {journal.status || 'Terlaksana'}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm flex gap-2">
                          <StyledButton onClick={() => handleEditJournal(journal)} size="sm">Edit</StyledButton>
                          <StyledButton onClick={() => handleDeleteJournal(journal.id)} size="sm" variant="danger">
                            <Trash size={16} />
                          </StyledButton>
                        </td>
                      </tr>
                    );
                  })}
                </StyledTable>
              </div>
            ) : (
              <p className="text-text-muted-light dark:text-text-muted-dark">Belum ada jurnal mengajar yang tersimpan.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}