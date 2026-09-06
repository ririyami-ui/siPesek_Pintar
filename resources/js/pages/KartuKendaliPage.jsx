import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCheck, Users, CheckCircle2, XCircle, Printer, Loader, FileText, Search, BarChart3, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import StyledSelect from '../components/StyledSelect';
import toast from 'react-hot-toast';

const KartuKendaliPage = () => {
  const { activeSemester, academicYear } = useSettings();

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('matrix');
  const [activeStudent, setActiveStudent] = useState(null);
  const [savingTask, setSavingTask] = useState({});

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [clsRes, subRes] = await Promise.all([
          api.get('/classes'),
          api.get('/subjects')
        ]);
        setClasses(clsRes.data.data || []);
        setSubjects(subRes.data.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMeta();
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!selectedClass) {
      setStudents([]);
      setTasks([]);
      setSubmissions({});
      return;
    }
    setLoadingData(true);
    try {
      const studentRes = await api.get('/students', { params: { class_id: selectedClass, all: true } });
      const studentList = (studentRes.data.data || studentRes.data || [])
        .sort((a, b) => (parseInt(a.absen) || 0) - (parseInt(b.absen) || 0));
      setStudents(studentList);

      const params = {
        class_id: selectedClass,
        semester: activeSemester,
        academic_year: academicYear
      };
      if (selectedSubject) params.subject_id = selectedSubject;

      const gradesRes = await api.get('/grades', { params });
      const allGrades = gradesRes.data.data || [];

      // Derive tasks from unique topics
      const uniqueMaterials = [...new Set(allGrades.map(g => String(g.topic || '').trim()))].filter(Boolean);
      
      const finalTaskList = uniqueMaterials.map(mat => {
        const materialGrades = allGrades.filter(g => String(g.topic || '').trim() === mat);
        const refDate = materialGrades[0]?.date || '';
        const sub = subjects.find(s => s.id === materialGrades[0]?.subject_id);
        return {
          id: mat,
          title: mat,
          deadline: refDate,
          subjectName: sub?.name || 'Mata Pelajaran',
          subjectId: sub?.id,
          type: materialGrades[0]?.type || 'Tugas'
        };
      });
      setTasks(finalTaskList);

      const subMap = {};
      finalTaskList.forEach(task => {
        subMap[task.id] = allGrades
          .filter(g => String(g.topic || '').trim() === task.id && (parseFloat(g.score) || 0) > 0)
          .map(g => String(g.student_id));
      });
      setSubmissions(subMap);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data');
    } finally {
      setLoadingData(false);
    }
  }, [selectedClass, selectedSubject, activeSemester, academicYear, subjects]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const studentStats = useMemo(() => {
    return students.map(s => {
      const submittedCount = tasks.filter(t => submissions[t.id]?.includes(String(s.id))).length;
      return { ...s, submitted: submittedCount, pending: Math.max(0, tasks.length - submittedCount) };
    });
  }, [students, tasks, submissions]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentStats;
    const q = searchQuery.toLowerCase();
    return studentStats.filter(s => s.name.toLowerCase().includes(q));
  }, [studentStats, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const selectedClassName = classes.find(c => String(c.id) === String(selectedClass))?.rombel || '';
  const selectedSubjectName = subjects.find(s => String(s.id) === String(selectedSubject))?.name || 'Semua Mapel';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
            <ClipboardCheck size={28} className="text-indigo-600" />
            Kartu Kendali Tugas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor tugas siswa yang belum terkumpul berdasarkan riwayat nilai
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!selectedClass || tasks.length === 0}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Printer size={16} />
            Cetak Kartu (A4)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <StyledSelect
          label="Pilih Kelas"
          value={selectedClass}
          onChange={(e) => { setSelectedClass(e.target.value); setSelectedSubject(''); }}
        >
          <option value="">— Pilih Kelas —</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.rombel}</option>
          ))}
        </StyledSelect>

        <StyledSelect
          label="Filter Mata Pelajaran"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">Semua Mata Pelajaran</option>
          {subjects.map(sub => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </StyledSelect>

        <div className="flex items-end">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center print:hidden">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mb-4">
            <ClipboardCheck size={40} className="text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Pilih Kelas Terlebih Dahulu</h2>
        </div>
      ) : loadingData ? (
        <div className="flex min-h-[40vh] items-center justify-center print:hidden">
          <Loader className="animate-spin h-8 w-8 text-indigo-600" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center print:hidden">
          <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/20 rounded-3xl flex items-center justify-center mb-4">
            <FileText size={40} className="text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Belum Ada Data Tugas</h2>
          <p className="text-sm text-gray-500">Data tugas diambil otomatis dari riwayat nilai yang Anda masukkan.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'matrix' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
            >
              <BarChart3 size={14} className="inline mr-1.5" /> Matriks
            </button>
            <button
              onClick={() => setViewMode('perStudent')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'perStudent' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
            >
              <Users size={14} className="inline mr-1.5" /> Per Siswa
            </button>
            <button onClick={fetchAllData} className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 ml-auto">
              <RefreshCw size={14} className="inline mr-1.5" /> Refresh
            </button>
          </div>

          {viewMode === 'matrix' && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 print:hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-gray-800/50">
                      <th className="p-3 text-xs font-black uppercase text-gray-500 sticky left-0 z-10 bg-gray-50">Siswa</th>
                      {tasks.map(task => (
                        <th key={task.id} className="p-3 text-center text-[10px] font-black uppercase text-gray-500 min-w-[120px]">{task.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-t border-gray-50 dark:border-gray-800 hover:bg-indigo-50/30 transition-colors">
                        <td className="p-3 sticky left-0 z-10 bg-white dark:bg-gray-900 border-r text-sm font-bold">{student.name}</td>
                        {tasks.map(task => {
                          const isSubmitted = submissions[task.id]?.includes(String(student.id));
                          return (
                            <td key={task.id} className="p-2 text-center">
                              {isSubmitted ? (
                                <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle size={16} className="text-rose-400 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'perStudent' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 print:hidden">
              {filteredStudents.map(student => {
                const pendingTasks = tasks.filter(t => !submissions[t.id]?.includes(String(student.id)));
                const pendingCount = pendingTasks.length;
                return (
                  <div key={student.id} 
                    className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => pendingCount > 0 && setActiveStudent({...student, pendingTasks})}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-sm text-gray-800 dark:text-white truncate pr-2">{student.absen}. {student.name}</h4>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${pendingCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {pendingCount === 0 ? 'LUNAS' : `${pendingCount} TERTUNDA`}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                      {tasks.map(task => {
                        const submitted = submissions[task.id]?.includes(String(student.id));
                        return (
                          <div key={task.id} className="flex items-center gap-2 text-[11px]">
                            {submitted ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-gray-300" />}
                            <span className={submitted ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}>{task.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PRINT VIEW */}
      <div className="hidden print:block">
        <style dangerouslySetInnerHTML={{ __html: `
          @page { size: A4; margin: 1cm; }
          @media print {
            body { margin: 0 !important; padding: 0 !important; background: white !important; }
            .print-area { width: 100%; color: black !important; }
            .print-page { page-break-after: always; display: block; width: 100%; }
            .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .print-card { 
              border: 1.5px solid black; 
              padding: 12px; 
              height: 320px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              position: relative;
              background: white;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-30deg);
              font-size: 32px;
              font-weight: 900;
              color: rgba(0, 0, 0, 0.03) !important;
              z-index: 0;
              white-space: nowrap;
            }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
          }
        `}} />
        <div className="print-area">
          {(() => {
            const debtorStudents = filteredStudents.filter(s => tasks.filter(t => !submissions[t.id]?.includes(String(s.id))).length > 0);
            const chunks = [];
            for (let i = 0; i < debtorStudents.length; i += 6) {
              chunks.push(debtorStudents.slice(i, i + 6));
            }

            return chunks.map((chunk, pageIndex) => (
              <div key={pageIndex} className="print-page">
                <div className="print-grid">
                  {chunk.map((student) => {
                    const pendingTasks = tasks.filter(t => !submissions[t.id]?.includes(String(student.id)));
                    return (
                      <div key={student.id} className="print-card">
                        <div className="watermark">SI PESEK PINTAR</div>
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-2">
                            <div>
                              <h2 className="text-[11px] font-black uppercase">KARTU KENDALI TUGAS</h2>
                              <p className="text-[10px] font-bold truncate max-w-[140px]">{student.name}</p>
                              <p className="text-[8px] font-medium">
                                {selectedSubjectName} | {selectedClassName} | {activeSemester}
                              </p>
                            </div>
                            <div className="text-[10px] font-black border-2 border-black px-1.5 min-w-[24px] text-center">
                              {student.absen || '-'}
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[9px] font-black uppercase mb-1.5">DAFTAR TANGGUNGAN:</p>
                            <div className="space-y-1.5">
                              {pendingTasks.slice(0, 8).map((t, idx) => (
                                <div key={t.id} className="text-[10px] flex items-start gap-2">
                                  <div className="w-3.5 h-3.5 border border-black shrink-0 mt-0.5" />
                                  <span className="truncate leading-tight">{idx + 1}. {t.title}</span>
                                </div>
                              ))}
                              {pendingTasks.length > 8 && <p className="text-[8px] italic">+ {pendingTasks.length - 8} lainnya...</p>}
                            </div>
                          </div>
                          <div className="mt-3 pt-2 border-t border-black">
                            <div className="flex justify-between px-4 mb-2">
                              <div className="text-center">
                                <div className="w-16 h-[1px] bg-black mb-1 mx-auto"></div>
                                <p className="text-[7px] font-black uppercase">GURU MAPEL</p>
                              </div>
                              <div className="text-center">
                                <div className="w-16 h-[1px] bg-black mb-1 mx-auto"></div>
                                <p className="text-[7px] font-black uppercase">ORTU / WALI</p>
                              </div>
                            </div>
                            <p className="text-[7px] italic text-center text-gray-500">
                              Bukti kendali pengumpulan tugas mandiri siswa.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
      {/* Modal Input Nilai */}
      {activeStudent && createPortal(
        <TaskInputModal
          student={activeStudent}
          selectedClass={selectedClass}
          activeSemester={activeSemester}
          academicYear={academicYear}
          onClose={() => setActiveStudent(null)}
          onSave={fetchAllData}
        />,
        document.body
      )}
    </div>
  );
};

// New Modal Component
const TaskInputModal = ({ student, selectedClass, activeSemester, academicYear, onClose, onSave }) => {
  const [savingTask, setSavingTask] = useState({});

  const handleSaveScore = async (task) => {
    const score = savingTask[task.id];
    if (!score) return toast.error('Masukkan nilai!');
    
    try {
      await api.post('/grades', {
        student_id: student.id,
        subject_id: task.subjectId,
        class_id: selectedClass,
        score: score,
        type: task.type,
        date: task.deadline,
        semester: activeSemester,
        academic_year: academicYear,
        topic: task.title
      });
      toast.success('Nilai tersimpan!');
      onSave(); // Refresh parent data
      onClose(); // Close modal after saving
    } catch (err) {
      toast.error('Gagal menyimpan nilai');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 min-h-screen">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg p-6 relative z-10 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[85dvh] flex flex-col">
        <button 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          onClick={onClose}
        >
          <XCircle size={20} />
        </button>
        <h3 className="text-lg font-black text-gray-800 dark:text-white mb-1">Input Nilai</h3>
        <p className="text-xs text-gray-500 mb-4">{student.name} - Absen {student.absen}</p>
        
        <div className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin">
          {student.pendingTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs truncate text-gray-800 dark:text-gray-200">{task.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{task.subjectName}</p>
                  <span className="text-[9px] text-gray-400 font-medium bg-gray-200 dark:bg-gray-800 px-1 rounded-sm">{task.deadline}</span>
                </div>
              </div>
              <input 
                type="number"
                min="0"
                max="100"
                className="w-16 p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-center text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="0"
                onChange={(e) => {
                  const val = e.target.value;
                  setSavingTask(prev => ({ ...prev, [task.id]: val }));
                }}
              />
              <button 
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shrink-0"
                onClick={() => handleSaveScore(task)}
              >
                <CheckCircle2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KartuKendaliPage;
