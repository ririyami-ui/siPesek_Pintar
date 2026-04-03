import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { parseKKTP } from '../utils/kktpParser';
import StyledSelect from '../components/StyledSelect';
import StyledButton from '../components/StyledButton';
import StyledTable from '../components/StyledTable';
import StyledInput from '../components/StyledInput';
import toast from 'react-hot-toast';
import { generateKktpAssessmentPDF } from '../utils/pdfGenerator';
import {
    ClipboardCheck,
    FileText,
    Users,
    Save,
    RefreshCw,
    Search,
    ChevronLeft,
    CheckCircle2,
    Calendar,
    BookOpen,
    Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PenilaianKktpPage = () => {
    const { activeSemester, academicYear, userProfile } = useSettings();
    const navigate = useNavigate();

    // Selection States
    const [rpps, setRpps] = useState([]);
    const [selectedRpp, setSelectedRpp] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');

    // Data States
    const [students, setStudents] = useState([]);
    const [kktpData, setKktpData] = useState(null);
    const [manualCriteria, setManualCriteria] = useState([]); // [{ name: '' }]
    const [isManualMode, setIsManualMode] = useState(false);
    const [assessmentScores, setAssessmentScores] = useState({}); // { studentId: { aspectIndex: score } }

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);

    // Sync Prompt State
    const [showSyncPrompt, setShowSyncPrompt] = useState(false);
    const [syncType, setSyncType] = useState('Harian');

    // Fetch Initial Data
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [rppRes, classRes, subjectRes] = await Promise.all([
                    api.get('/ai/rpp-history'),
                    api.get('/classes?all=true'),
                    api.get('/subjects?all=true')
                ]);

                setRpps(rppRes.data || []);
                setClasses(classRes.data.data || classRes.data || []);
                setSubjects(subjectRes.data.data || subjectRes.data || []);
            } catch (error) {
                console.error("Error fetching assessment data:", error);
                toast.error("Gagal memuat data awal");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Handle RPP Selection
    useEffect(() => {
        if (selectedRpp) {
            const rpp = rpps.find(r => r.id == selectedRpp);
            if (rpp) {
                let content = rpp.content;
                let parsed = null;
                if (typeof content === 'string') {
                    parsed = parseKKTP(content);
                } else if (content && content.content) {
                    parsed = parseKKTP(content.content);
                }
                setKktpData(parsed);

                if (rpp.subject_id) setSelectedSubject(rpp.subject_id);
                else if (rpp.subjectId) setSelectedSubject(rpp.subjectId);

                if (parsed && parsed.criteria && parsed.criteria.length > 0) {
                    setIsManualMode(false);
                    setManualCriteria([]);
                }
                setAssessmentScores({});
            }
        } else {
            setKktpData(null);
            setIsManualMode(false);
            setManualCriteria([]);
        }
    }, [selectedRpp, rpps]);

    // Handle Class Selection
    const fetchStudents = useCallback(async () => {
        if (!selectedClass) {
            setStudents([]);
            return;
        }
        try {
            const response = await api.get('/students', {
                params: { class_id: selectedClass, all: true }
            });
            const studentData = response.data.data || response.data;
            studentData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setStudents(studentData);
        } catch (error) {
            console.error("Error fetching students:", error);
            toast.error("Gagal memuat daftar siswa");
        }
    }, [selectedClass]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    // Fetch Existing Assessment Data
    useEffect(() => {
        const fetchExistingAssessment = async () => {
            if (!selectedRpp || !selectedClass) return;

            try {
                const response = await api.get('/kktp-assessments', {
                    params: {
                        rpp_id: selectedRpp,
                        class_id: selectedClass,
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });

                const dataList = response.data;
                if (dataList && dataList.length > 0) {
                    const data = dataList[0];
                    setAssessmentScores(data.scores || {});

                    if (data.kktp_type === 'Manual Rubrik') {
                        setIsManualMode(true);
                        setManualCriteria(data.manual_criteria || []);
                    } else if (data.scores) {
                        setIsManualMode(false);
                    }
                } else {
                    setAssessmentScores({});
                }
            } catch (error) {
                console.error("Error fetching existing assessment:", error);
            }
        };

        fetchExistingAssessment();
    }, [selectedRpp, selectedClass, activeSemester, academicYear]);

    // Scoring Logic
    const handleScoreChange = (studentId, aspectIndex, score) => {
        setAssessmentScores(prev => ({
            ...prev,
            [studentId]: {
                ...(prev[studentId] || {}),
                [aspectIndex]: score
            }
        }));
    };

    const addManualCriterion = () => {
        setManualCriteria(prev => [...prev, { name: '' }]);
    };

    const removeManualCriterion = (index) => {
        setManualCriteria(prev => prev.filter((_, i) => i !== index));
        setAssessmentScores(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(sid => {
                const studentData = { ...next[sid] };
                delete studentData[index];
                next[sid] = studentData;
            });
            return next;
        });
    };

    const updateManualCriterion = (index, value) => {
        const next = [...manualCriteria];
        next[index].name = value;
        setManualCriteria(next);
    };

    const calculateFinalScore = (studentId) => {
        const studentScores = assessmentScores[studentId];
        const activeCriteria = isManualMode ? manualCriteria : (kktpData?.criteria || []);
        if (!studentScores || activeCriteria.length === 0) return 0;

        if (isManualMode || (kktpData && kktpData.type === 'Rubrik')) {
            let sum = 0;
            activeCriteria.forEach((_, i) => {
                sum += (studentScores[i] || 0);
            });
            const max = activeCriteria.length * 4;
            return max > 0 ? Math.round((sum / max) * 100) : 0;
        } else if (kktpData && kktpData.type === 'Deskripsi Kriteria') {
            let checkedCount = 0;
            activeCriteria.forEach((_, i) => {
                if (studentScores[i] === 1) checkedCount++;
            });
            return Math.round((checkedCount / activeCriteria.length) * 100);
        } else if (kktpData && kktpData.type === 'Interval Nilai') {
            let sum = 0;
            let count = 0;
            activeCriteria.forEach((_, i) => {
                const val = studentScores[i];
                if (val !== undefined && val !== null) {
                    sum += val;
                    count++;
                }
            });
            return count > 0 ? Math.round(sum / count) : 0;
        }
        return 0;
    };

    const handleDownloadPDF = () => {
        if (!selectedRpp || !selectedClass) {
            toast.error("Pilih RPP dan Kelas terlebih dahulu");
            return;
        }

        const rpp = rpps.find(r => r.id == selectedRpp);
        const classData = classes.find(c => c.id == selectedClass);
        const subjectData = subjects.find(s => s.id == (selectedSubject || rpp?.subject_id));

        generateKktpAssessmentPDF({
            students,
            kktpData,
            assessmentScores,
            teacherName: userProfile?.name || 'Guru',
            userProfile,
            selectedClass: classData?.rombel,
            selectedSubject: subjectData?.name || rpp?.subject,
            topic: rpp?.topic,
            assessmentDate,
            isManualMode,
            manualCriteria
        });

        toast.success("PDF berhasil dibuat!");
    };

    const handleSave = async (syncToGrades = false, confirmedType = null) => {
        if (!selectedRpp || !selectedClass) {
            toast.error("Lengkapi data penilaian terlebih dahulu");
            return;
        }

        if (isManualMode && manualCriteria.length === 0) {
            toast.error("Tambahkan minimal satu kriteria penilaian manual");
            return;
        }

        if (Object.keys(assessmentScores).length === 0) {
            toast.error("Berikan nilai untuk setidaknya satu siswa");
            return;
        }

        if (syncToGrades && !confirmedType) {
            const rpp = rpps.find(r => r.id == selectedRpp);
            const defaultType = rpp?.topic.toLowerCase().includes('praktik') ? 'Praktik' : 'Harian';
            setSyncType(defaultType);
            setShowSyncPrompt(true);
            return;
        }

        setIsSaving(true);
        try {
            const rpp = rpps.find(r => r.id == selectedRpp);
            const classData = classes.find(c => c.id == selectedClass);
            const subjectData = subjects.find(s => s.id == (selectedSubject || rpp?.subject_id));

            const assessmentData = {
                rpp_id: selectedRpp,
                rpp_topic: rpp.topic || 'Materi RPP',
                class_id: selectedClass,
                class_name: classData?.rombel || 'Kelas',
                subject_id: selectedSubject || rpp?.subject_id || 0,
                subject_name: subjectData?.name || 'Mata Pelajaran',
                date: assessmentDate,
                scores: assessmentScores,
                kktp_type: isManualMode ? 'Manual Rubrik' : (kktpData?.type || 'Rubrik'),
                manual_criteria: isManualMode ? manualCriteria : null,
                academic_year: academicYear,
                semester: activeSemester,
                sync_to_grades: syncToGrades,
                assessment_type: confirmedType || 'Harian'
            };

            await api.post('/kktp-assessments', assessmentData);

            if (syncToGrades) {
                toast.success(`Nilai sudah dikirim, silahkan cek di riwayat nilai!`, { duration: 4000 });
            } else {
                toast.success("Penilaian berhasil disimpan (Draft)!");
            }
        } catch (error) {
            console.error("Error saving assessment:", error);
            toast.error(error.response?.data?.error || "Gagal menyimpan penilaian");
        } finally {
            setIsSaving(false);
            setShowSyncPrompt(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <RefreshCw className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                        <ClipboardCheck size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Penilaian Digital KKTP</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Gunakan kriteria dari RPP untuk menilai siswa secara langsung.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <StyledButton variant="outline" onClick={() => navigate('/rpp')} className="flex items-center gap-2">
                        <ChevronLeft size={18} />
                        Kembali ke RPP
                    </StyledButton>
                </div>
            </div>

            {/* Config Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                        <Search size={18} />
                        <span>1. Filter & Pilih RPP ({rpps.length} Total)</span>
                    </div>
                    <StyledSelect
                        label="Filter Mata Pelajaran"
                        value={subjectFilter}
                        onChange={(e) => {
                            setSubjectFilter(e.target.value);
                            setSelectedRpp('');
                        }}
                    >
                        <option value="">-- Semua Mapel --</option>
                        {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </StyledSelect>
                    <StyledSelect
                        label="Filter Kelas/Jenjang"
                        value={gradeFilter}
                        onChange={(e) => {
                            setGradeFilter(e.target.value);
                            setSelectedRpp('');
                            setSelectedClass('');
                        }}
                    >
                        <option value="">-- Semua Kelas --</option>
                        {userProfile?.schoolLevel === 'SD' && ['1', '2', '3', '4', '5', '6'].map(g => <option key={g} value={g}>Kelas {g}</option>)}
                        {userProfile?.schoolLevel === 'SMP' && ['7', '8', '9'].map(g => <option key={g} value={g}>Kelas {g}</option>)}
                        {userProfile?.schoolLevel === 'SMA' && ['10', '11', '12'].map(g => <option key={g} value={g}>Kelas {g}</option>)}
                        {userProfile?.schoolLevel === 'SMK' && ['10', '11', '12'].map(g => <option key={g} value={g}>Kelas {g}</option>)}
                    </StyledSelect>
                    <StyledSelect
                        label="Pilih RPP (Materi)"
                        value={selectedRpp}
                        onChange={(e) => setSelectedRpp(e.target.value)}
                    >
                        <option value="">-- Pilih RPP --</option>
                        {rpps
                            .filter(r => {
                                const subjectMatch = !subjectFilter || r.subject_id === parseInt(subjectFilter) || r.subjectId === subjectFilter || r.subject === subjects.find(s => s.id == subjectFilter)?.name;
                                const gradeMatch = !gradeFilter || String(r.gradeLevel || '').includes(gradeFilter);
                                return subjectMatch && gradeMatch;
                            })
                            .map(rpp => (
                                <option key={rpp.id} value={rpp.id}>{rpp.topic} ({rpp.gradeLevel} - {rpp.subject})</option>
                            ))}
                    </StyledSelect>
                    <StyledInput
                        type="date"
                        label="Tanggal Penilaian"
                        value={assessmentDate}
                        onChange={(e) => setAssessmentDate(e.target.value)}
                    />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                        <Users size={18} />
                        <span>2. Pilih Kelas</span>
                    </div>
                    <StyledSelect
                        label="Pilih Kelas (Rombel)"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">-- Pilih Kelas --</option>
                        {classes
                            .filter(c => {
                                if (!gradeFilter) return true;
                                const level = String(c.level || c.grade || '').toLowerCase();
                                const filter = String(gradeFilter).toLowerCase();
                                return level === filter || level.includes(filter);
                            })
                            .map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.rombel}</option>
                            ))}
                    </StyledSelect>
                    {students.length > 0 && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed dark:border-gray-700">
                            <p className="text-xs text-center text-gray-500 font-medium">Terdeteksi {students.length} siswa siap dinilai.</p>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
                        <CheckCircle2 size={18} />
                        <span>3. Info Kriteria (KKTP)</span>
                    </div>
                    {(kktpData && kktpData.criteria && kktpData.criteria.length > 0) || isManualMode ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <span className="text-xs font-bold text-blue-700">Metode:</span>
                                <span className="text-xs font-black uppercase text-blue-600">{isManualMode ? 'Manual Rubrik (1-4)' : kktpData.type}</span>
                            </div>
                            <div className="text-xs space-y-2">
                                <p className="font-bold text-gray-600 dark:text-gray-400 flex justify-between items-center">
                                    <span>Daftar Aspek:</span>
                                    {isManualMode && (
                                        <button onClick={addManualCriterion} className="text-blue-600 hover:underline">
                                            + Tambah Aspek
                                        </button>
                                    )}
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-gray-500 max-h-40 overflow-y-auto">
                                    {isManualMode ? (
                                        manualCriteria.map((c, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <input
                                                    className="bg-transparent border-b border-gray-200 outline-none w-full"
                                                    value={c.name}
                                                    onChange={(e) => updateManualCriterion(i, e.target.value)}
                                                    placeholder={`Nama aspek ${i + 1}...`}
                                                />
                                                <button onClick={() => removeManualCriterion(i)} className="text-red-400 hover:text-red-600">
                                                    ×
                                                </button>
                                            </li>
                                        ))
                                    ) : (
                                        kktpData.criteria.map((c, i) => (
                                            <li key={i}>{c.aspect || c.indicator || `Kriteria ${i + 1}`}</li>
                                        ))
                                    )}
                                </ul>
                                {isManualMode && manualCriteria.length === 0 && (
                                    <p className="text-[10px] text-gray-400 italic">Klik tombol di atas untuk menambah kriteria.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
                            <p className="text-xs text-gray-400 mb-3">Tidak terdeteksi KKTP otomatis.</p>
                            <StyledButton
                                size="sm"
                                variant="outline"
                                className="text-[10px]"
                                onClick={() => {
                                    setIsManualMode(true);
                                    setManualCriteria([{ name: 'Kualitas Hasil' }, { name: 'Kerapihan' }]);
                                }}
                            >
                                Gunakan Mode Manual
                            </StyledButton>
                        </div>
                    )}
                </div>
            </div>

            {/* Assessment Table */}
            {(students.length > 0 || selectedClass) && (kktpData || isManualMode) && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in-up">
                    <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
                        <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <BookOpen size={18} className="text-blue-500" />
                            Tabel Penilaian Peserta Didik
                        </h3>
                        {students.length > 0 && (
                            <div className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 px-3 py-1 rounded-full font-bold animate-pulse">
                                Klik level/opsi untuk memberi nilai
                            </div>
                        )}
                    </div>

                    <div className="max-h-[calc(100vh-320px)] overflow-auto relative">
                        <table className="w-full text-sm text-left border-separate border-spacing-0">
                            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-bold border-b dark:border-gray-700">No.</th>
                                    <th className="px-4 py-3 font-bold border-b dark:border-gray-700 min-w-[200px]">Nama Peserta Didik</th>
                                    {isManualMode ? (
                                        manualCriteria.map((c, i) => (
                                            <th key={i} className="px-4 py-3 font-bold border-b dark:border-gray-700 text-center">
                                                {c.name || `Aspek ${i + 1}`}
                                            </th>
                                        ))
                                    ) : (
                                        (kktpData?.criteria || []).map((c, i) => (
                                            <th key={i} className="px-4 py-3 font-bold border-b dark:border-gray-700 text-center">
                                                {c.aspect || c.indicator || `Kriteria ${i + 1}`}
                                            </th>
                                        ))
                                    )}
                                    <th className="px-4 py-3 font-bold border-b dark:border-gray-700 text-right">Nilai Akhir</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-gray-700">
                                {students.length > 0 ? (
                                    students.map((student, idx) => (
                                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                                            <td className="px-4 py-4">{idx + 1}</td>
                                            <td className="px-4 py-4 font-semibold text-gray-700 dark:text-gray-200">{student.name}</td>
                                            {(isManualMode ? manualCriteria : (kktpData?.criteria || [])).map((c, i) => (
                                                <td key={i} className="px-4 py-4 text-center">
                                                    {(isManualMode || (kktpData && kktpData.type === 'Rubrik')) && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            {[1, 2, 3, 4].map(level => (
                                                                <button
                                                                    key={level}
                                                                    onClick={() => handleScoreChange(student.id, i, level)}
                                                                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${assessmentScores[student.id]?.[i] === level ? 'bg-blue-600 text-white shadow-md scale-110' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                                    title={!isManualMode ? c.levels?.[level - 1]?.desc : `Level ${level}`}
                                                                >
                                                                    {level}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {!isManualMode && kktpData.type === 'Deskripsi Kriteria' && (
                                                        <button
                                                            onClick={() => handleScoreChange(student.id, i, assessmentScores[student.id]?.[i] === 1 ? 0 : 1)}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${assessmentScores[student.id]?.[i] === 1 ? 'bg-green-100 dark:bg-green-900/30 text-green-600 scale-105 border-2 border-green-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-300 border-2 border-transparent'}`}
                                                        >
                                                            <CheckCircle2 size={24} />
                                                        </button>
                                                    )}
                                                    {!isManualMode && kktpData.type === 'Interval Nilai' && (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={assessmentScores[student.id]?.[i] || ''}
                                                            onChange={(e) => handleScoreChange(student.id, i, parseInt(e.target.value))}
                                                            className="w-16 p-2 text-center rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-4 py-4 text-right">
                                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-black text-lg border border-blue-100 dark:border-blue-800">
                                                    {calculateFinalScore(student.id)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full text-red-500">
                                                    <Users size={24} />
                                                </div>
                                                <p className="font-bold">Kelas {classes.find(c => c.id == selectedClass)?.rombel || ''} belum memiliki data siswa.</p>
                                                <p className="text-xs">Silakan tambahkan siswa di menu Master Data.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-gray-50/50 dark:bg-gray-900/20 border-t dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-gray-500 italic">
                            {students.length > 0 ? (
                                <>* Nilai akhir dihitung otomatis. <span className="font-bold">Total Siswa: {students.length}</span></>
                            ) : (
                                "Tambahkan siswa untuk memulai penilaian."
                            )}
                        </div>
                        <StyledButton
                            onClick={handleDownloadPDF}
                            disabled={students.length === 0}
                            variant="outline"
                            className="flex items-center gap-2 px-6 py-3 border-2 border-green-600 text-green-600 font-bold rounded-2xl hover:bg-green-50 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            <Download size={20} />
                            Cetak PDF
                        </StyledButton>
                        <StyledButton
                            onClick={() => handleSave(false)}
                            disabled={isSaving || students.length === 0}
                            variant="secondary"
                            className="flex items-center gap-2 px-6 py-3 border-2 border-blue-600 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            <Save size={20} />
                            {isSaving ? 'Menyimpan...' : 'Simpan (Draft)'}
                        </StyledButton>
                        <StyledButton
                            onClick={() => handleSave(true)}
                            disabled={isSaving || students.length === 0}
                            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                            {isSaving ? 'Proses...' : 'Sinkron ke Nilai'}
                        </StyledButton>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {(!selectedRpp || !selectedClass) && (
                <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-full text-blue-500">
                        <Users size={64} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Siap untuk Menilai?</h2>
                    <p className="text-gray-500 max-w-sm">Pilih RPP dan Kelas di atas untuk memunculkan tabel penilaian digital bagi peserta didik Anda.</p>
                </div>
            )}

            {/* Sync Type Prompt Modal */}
            {showSyncPrompt && createPortal(
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-scale-up mx-4">
                        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Konfirmasi Sinkronisasi Nilai</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            Anda akan menyimpan penilaian ini ke <strong>Buku Nilai</strong>. Mohon tentukan jenis penilaiannya:
                        </p>

                        <div className="space-y-4 mb-8">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Jenis Penilaian
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setSyncType('Harian')}
                                    className={`p-3 rounded-xl border-2 font-bold transition-all ${syncType === 'Harian'
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}
                                >
                                    Harian
                                </button>
                                <button
                                    onClick={() => setSyncType('Praktik')}
                                    className={`p-3 rounded-xl border-2 font-bold transition-all ${syncType === 'Praktik'
                                        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300'}`}
                                >
                                    Praktik
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <StyledButton
                                variant="secondary"
                                onClick={() => setShowSyncPrompt(false)}
                            >
                                Batal
                            </StyledButton>
                            <StyledButton
                                onClick={() => handleSave(true, syncType)}
                                className="bg-blue-600 text-white"
                            >
                                Simpan & Sinkronkan
                            </StyledButton>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default PenilaianKktpPage;
