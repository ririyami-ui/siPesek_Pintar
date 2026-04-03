import React, { useState, useEffect, useCallback } from 'react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledInput from '../components/StyledInput';
import StyledSelect from '../components/StyledSelect';
import StyledButton from '../components/StyledButton';
import StyledTable from '../components/StyledTable';
import RiwayatNilai from '../components/RiwayatNilai'; // Import komponen baru
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../utils/SettingsContext';

const TabButton = ({ label, isActive, onClick }) => (
  <button
    className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ease-in-out focus:outline-none ${isActive
      ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
      : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-900/60'
      }`}
    onClick={onClick}
  >
    {label}
  </button>
);

export default function NilaiPage() {
  const [activeTab, setActiveTab] = useState('input'); // 'input' or 'history'

  // States for Input & Edit
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [material, setMaterial] = useState('');
  const [assessmentType, setAssessmentType] = useState('');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState('');
  const [showEditMode, setShowEditMode] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editSelectedClass, setEditSelectedClass] = useState('');
  const [editSelectedSubject, setEditSelectedSubject] = useState('');
  const [editAssessmentType, setEditAssessmentType] = useState('');
  const [editSelectedMaterial, setEditSelectedMaterial] = useState('');
  const [materialsForEdit, setMaterialsForEdit] = useState([]);
  const [editStudents, setEditStudents] = useState([]);
  const [editGrades, setEditGrades] = useState({});
  const [isFetchingEditData, setIsFetchingEditData] = useState(false);

  const assessmentTypes = ["Harian", "Ulangan", "Tengah Semester", "Akhir Semester", "Praktik"];

  // const classesCollectionRef = collection(db, 'classes');
  // const subjectsCollectionRef = collection(db, 'subjects');
  // const studentsCollectionRef = collection(db, 'students');
  // const gradesCollectionRef = collection(db, 'grades');

  const [searchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('classId');
  const subjectIdFromUrl = searchParams.get('subjectId');
  const { activeSemester, academicYear } = useSettings();

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setCurrentDate(`${yyyy}-${mm}-${dd}`);
    setEditDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesResponse, subjectsResponse] = await Promise.all([
          api.get('/classes?all=true'),
          api.get('/subjects?all=true')
        ]);

        const fetchedClasses = classesResponse.data.data || classesResponse.data;
        setClasses(fetchedClasses);

        const fetchedSubjects = subjectsResponse.data.data || subjectsResponse.data;
        setSubjects(fetchedSubjects);

        // Pre-select class and subject if provided in URL
        if (classIdFromUrl) {
          const preselectedClass = fetchedClasses.find(cls => cls.rombel === classIdFromUrl || cls.id == classIdFromUrl);
          if (preselectedClass) {
            setSelectedClass(preselectedClass.id);
            setEditSelectedClass(preselectedClass.id);
          }
        }
        if (subjectIdFromUrl) {
          const preselectedSubject = fetchedSubjects.find(sub => sub.name === subjectIdFromUrl || sub.id == subjectIdFromUrl);
          if (preselectedSubject) {
            setSelectedSubject(preselectedSubject.id);
            setEditSelectedSubject(preselectedSubject.id);
          }
        }

      } catch (error) {
        console.error("Error fetching initial data: ", error);
        toast.error('Gagal memuat data kelas atau mata pelajaran.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [classIdFromUrl, subjectIdFromUrl]);

  const fetchStudents = useCallback(async () => {
    if (!selectedClass) {
      setStudents([]);
      setGrades({});
      return;
    }
    setIsLoading(true);
    try {
      // Fetch students for the selected class
      const studentsResponse = await api.get(`/students`, {
        params: { class_id: selectedClass, all: true }
      });
      console.log('Students Response:', studentsResponse.data); // Debug

      const fetchedStudents = (studentsResponse.data.data || studentsResponse.data).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      setStudents(fetchedStudents);

      // Fetch existing grades for this class/subject/date/type
      // Only if we have all necessary filters?
      // Actually, for "Input" tab, we usually just show the student list and empty inputs 
      // UNLESS we are in a specific mode. 
      // But the original code didn't fetch grades here?
      // Wait, let's check the original code again.
      // Original code fetchStudents DID NOT fetch grades. It just set initialGrades to 0.

      const initialGrades = {};
      fetchedStudents.forEach(student => {
        initialGrades[student.id] = 0;
      });
      setGrades(initialGrades);

    } catch (error) {
      console.error("Error fetching students: ", error);
      toast.error('Gagal memuat data siswa.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    if (activeTab === 'input' && !showEditMode) {
      fetchStudents();
    }
  }, [fetchStudents, showEditMode, activeTab]);

  useEffect(() => {
    const fetchMaterials = async () => {
      if (!editSelectedClass || !editSelectedSubject || !editAssessmentType || !editDate) {
        setMaterialsForEdit([]);
        setEditSelectedMaterial('');
        return;
      }
      try {
        const response = await api.get('/grades/materials', {
          params: {
            class_id: editSelectedClass,
            subject_id: editSelectedSubject,
            type: editAssessmentType,
            semester: activeSemester,
          }
        });

        const uniqueMaterials = response.data;
        setMaterialsForEdit(uniqueMaterials);
        if (uniqueMaterials.length > 0 && !uniqueMaterials.includes(editSelectedMaterial)) {
          setEditSelectedMaterial('');
        }
      } catch (error) {
        console.error("Error fetching materials for edit: ", error);
        toast.error('Gagal memuat daftar materi.');
      }
    };
    if (activeTab === 'input' && showEditMode) {
      fetchMaterials();
    }
  }, [editDate, editSelectedClass, editSelectedSubject, editAssessmentType, showEditMode, editSelectedMaterial, activeTab, activeSemester, academicYear]);

  const fetchEditGrades = useCallback(async () => {
    if (!editDate || !editSelectedClass || !editSelectedSubject || !editAssessmentType || !editSelectedMaterial) {
      setEditStudents([]);
      setEditGrades({});
      return;
    }
    setIsFetchingEditData(true);
    try {
      // 1. Fetch Grades
      const gradesResponse = await api.get('/grades', {
        params: {
          date: editDate,
          class_id: editSelectedClass,
          subject_id: editSelectedSubject,
          type: editAssessmentType, // backend uses 'type'
          // semester/year handled by controller defaults if activeSemester/academicYear passed
          semester: activeSemester,
          academic_year: academicYear
        }
      });

      const allGrades = gradesResponse.data;
      // Filter by material/topic on client side if needed
      const filteredGrades = allGrades.filter(g => g.topic === editSelectedMaterial);

      if (filteredGrades.length === 0) {
        toast.error('Belum ada nilai untuk materi ini.');
        setEditStudents([]);
        setEditGrades({});
        return;
      }

      const fetchedGradesData = {};
      filteredGrades.forEach(g => {
        fetchedGradesData[g.student_id] = parseFloat(g.score);
      });
      setEditGrades(fetchedGradesData);

      // 2. Fetch Students
      const studentsResponse = await api.get('/students', {
        params: { class_id: editSelectedClass, all: true }
      });

      const fetchedStudents = (studentsResponse.data.data || studentsResponse.data).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );

      const finalStudents = fetchedStudents.map(student => ({
        ...student,
        score: fetchedGradesData[student.id] !== undefined ? fetchedGradesData[student.id] : 0
      }));
      setEditStudents(finalStudents);

    } catch (error) {
      console.error("Error fetching edit data: ", error);
      toast.error('Gagal memuat data nilai.');
    } finally {
      setIsFetchingEditData(false);
    }
  }, [editDate, editSelectedClass, editSelectedSubject, editAssessmentType, editSelectedMaterial, activeSemester, academicYear]);

  useEffect(() => {
    if (activeTab === 'input' && showEditMode) {
      fetchEditGrades();
    }
  }, [fetchEditGrades, showEditMode, activeTab]);

  const handleGradeChange = (studentId, score) => {
    setGrades(prevGrades => ({
      ...prevGrades,
      [studentId]: score,
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedClass || !selectedSubject || !material || !assessmentType) {
      toast.error('Harap lengkapi semua informasi penilaian.');
      return;
    }
    if (Object.keys(grades).length === 0) {
      toast.error('Tidak ada siswa untuk disimpan nilainya.');
      return;
    }
    // Auth check handled by backend

    const gradesToSave = [];
    for (const studentId in grades) {
      const score = grades[studentId];
      if (score !== '' && score !== null) {
        gradesToSave.push({
          student_id: studentId,
          score: parseFloat(score),
          notes: '' // Add notes input if needed later
        });
      }
    }

    if (gradesToSave.length === 0) {
      toast.error('Tidak ada nilai yang dimasukkan untuk disimpan.');
      return;
    }

    const promise = api.post('/grades/batch', {
      grades: gradesToSave,
      class_id: selectedClass,
      subject_id: selectedSubject,
      date: currentDate,
      type: assessmentType,
      topic: material,
      semester: activeSemester,
      academic_year: academicYear
    });

    toast.promise(promise, {
      loading: 'Menyimpan nilai...',
      success: () => {
        setSelectedClass('');
        setSelectedSubject('');
        setMaterial('');
        setAssessmentType('');
        setGrades({});
        setStudents([]);
        return 'Nilai berhasil disimpan!';
      },
      error: 'Gagal menyimpan nilai. Silakan coba lagi.',
    });
  };

  const handleSaveEditedGrades = async () => {
    if (!editSelectedClass || !editSelectedSubject || !editSelectedMaterial || !editAssessmentType || !editDate) {
      toast.error('Harap lengkapi semua informasi penilaian.');
      return;
    }
    if (Object.keys(editGrades).length === 0) {
      toast.error('Tidak ada siswa untuk disimpan nilainya.');
      return;
    }

    const gradesToSave = [];
    // We iterate over input fields or editGrades state
    for (const studentId in editGrades) {
      const score = editGrades[studentId];
      if (score !== '' && score !== null && score !== undefined) {
        gradesToSave.push({
          student_id: studentId,
          score: parseFloat(score),
          notes: ''
        });
      }
    }

    if (gradesToSave.length === 0) {
      toast.error('Tidak ada perubahan nilai yang dimasukkan untuk disimpan.');
      return;
    }

    const promise = api.post('/grades/batch', {
      grades: gradesToSave,
      class_id: editSelectedClass,
      subject_id: editSelectedSubject,
      date: editDate,
      type: editAssessmentType,
      topic: editSelectedMaterial,
      semester: activeSemester,
      academic_year: academicYear
    });

    toast.promise(promise, {
      loading: 'Menyimpan perubahan nilai...',
      success: () => {
        setEditDate('');
        setEditSelectedClass('');
        setEditSelectedSubject('');
        setEditAssessmentType('');
        setEditSelectedMaterial('');
        setMaterialsForEdit([]);
        setEditStudents([]);
        setEditGrades({});
        return 'Perubahan nilai berhasil disimpan!';
      },
      error: 'Gagal menyimpan perubahan nilai. Silakan coba lagi.',
    });
  };

  const handleToggleMode = () => {
    setShowEditMode(prev => !prev);
    setSelectedClass('');
    setSelectedSubject('');
    setMaterial('');
    setAssessmentType('');
    setGrades({});
    setStudents([]);
    setEditDate('');
    setEditSelectedClass('');
    setEditSelectedSubject('');
    setEditAssessmentType('');
    setEditSelectedMaterial('');
    setMaterialsForEdit([]);
    setEditStudents([]);
    setEditGrades({});
  };

  if (isLoading && students.length === 0 && editStudents.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Manajemen Nilai</h1>

      {/* Tab Navigator */}
      <div className="max-w-md mx-auto sm:mx-0 mb-6">
        <div className="flex space-x-1 p-1 bg-gray-200 dark:bg-gray-900 rounded-xl">
          <TabButton label="Input & Edit" isActive={activeTab === 'input'} onClick={() => setActiveTab('input')} />
          <TabButton label="Riwayat Nilai" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'input' && (
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-lg dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
              {showEditMode ? 'Edit Nilai' : 'Input Nilai'}
            </h2>
            <button
              onClick={handleToggleMode}
              className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
            >
              {showEditMode ? 'Kembali ke Input Nilai' : 'Edit Nilai'}
            </button>
          </div>

          {!showEditMode ? (
            // Input Nilai Form
            <>
              <div className="space-y-4 mb-6">
                <StyledInput type="date" label="Tanggal Penilaian" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} />
                <StyledSelect label="Kelas" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="">Pilih Kelas</option>
                  {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.rombel}</option>)}
                </StyledSelect>
                <StyledSelect label="Mata Pelajaran" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
                  <option value="">Pilih Mata Pelajaran</option>
                  {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </StyledSelect>
                <StyledInput type="text" label="Materi" placeholder="Contoh: Bab 1 - Pengenalan Aljabar" value={material} onChange={(e) => setMaterial(e.target.value)} voiceEnabled />
                <StyledSelect label="Jenis Penilaian" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
                  <option value="">Pilih Jenis Penilaian</option>
                  {assessmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </StyledSelect>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Daftar Siswa dan Nilai</h3>
              {students.length > 0 ? (
                <div className="overflow-x-auto">
                  <StyledTable headers={[{ label: 'No.', className: 'w-12 sm:w-16' }, { label: 'Nama Siswa', className: 'w-auto' }, { label: 'Nilai', className: 'w-24 sm:w-32' }]}>
                    {students.map((student, index) => (
                      <tr key={student.id}>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm font-medium text-text-light dark:text-text-dark">{index + 1}</td>
                        <td className="px-3 py-4 text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark">{student.name}</td>
                        <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm">
                          <StyledInput type="number" value={grades[student.id]} onChange={(e) => handleGradeChange(student.id, e.target.value)} className="!px-2.5" containerClassName="w-full" min="0" max="100" />
                        </td>
                      </tr>
                    ))}
                  </StyledTable>
                </div>
              ) : (
                <p className="text-text-muted-light dark:text-text-muted-dark">Pilih kelas untuk menampilkan daftar siswa.</p>
              )}
              <div className="mt-6 flex justify-end">
                <StyledButton onClick={handleSaveGrades}>Simpan Nilai</StyledButton>
              </div>
            </>
          ) : (
            // Edit Nilai Form
            <div className="space-y-4 mb-6">
              <StyledInput type="date" label="Tanggal Penilaian" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              <StyledSelect label="Kelas" value={editSelectedClass} onChange={(e) => setEditSelectedClass(e.target.value)}>
                <option value="">Pilih Kelas</option>
                {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.rombel}</option>)}
              </StyledSelect>
              <StyledSelect label="Mata Pelajaran" value={editSelectedSubject} onChange={(e) => setEditSelectedSubject(e.target.value)}>
                <option value="">Pilih Mata Pelajaran</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </StyledSelect>
              <StyledSelect label="Jenis Penilaian" value={editAssessmentType} onChange={(e) => setEditAssessmentType(e.target.value)}>
                <option value="">Pilih Jenis Penilaian</option>
                {assessmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </StyledSelect>
              <StyledSelect label="Materi" value={editSelectedMaterial} onChange={(e) => setEditSelectedMaterial(e.target.value)} disabled={materialsForEdit.length === 0}>
                <option value="">Pilih Materi</option>
                {materialsForEdit.map(mat => <option key={mat} value={mat}>{mat}</option>)}
              </StyledSelect>
              {isFetchingEditData ? (
                <div className="text-center text-text-muted-light dark:text-text-muted-dark">Memuat data nilai...</div>
              ) : editStudents.length > 0 ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Daftar Siswa dan Nilai</h3>
                  <div className="overflow-x-auto">
                    <StyledTable headers={[{ label: 'No.', className: 'w-12 sm:w-16' }, { label: 'Nama Siswa', className: 'w-auto' }, { label: 'Nilai', className: 'w-24 sm:w-32' }]}>
                      {editStudents.map((student, index) => (
                        <tr key={student.id}>
                          <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm font-medium text-text-light dark:text-text-dark">{index + 1}</td>
                          <td className="px-3 py-4 text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark">{student.name}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm">
                            <StyledInput type="number" value={editGrades[student.id]} onChange={(e) => setEditGrades(prev => ({ ...prev, [student.id]: e.target.value }))} className="!px-2.5" containerClassName="w-full" min="0" max="100" />
                          </td>
                        </tr>
                      ))}
                    </StyledTable>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <StyledButton onClick={handleSaveEditedGrades}>Simpan Perubahan</StyledButton>
                  </div>
                </>
              ) : (
                <p className="text-text-muted-light dark:text-text-muted-dark">Pilih kriteria di atas untuk menampilkan nilai.</p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <RiwayatNilai classes={classes} subjects={subjects} />
      )}
    </div>
  );
}
