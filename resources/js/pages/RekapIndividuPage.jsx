import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import moment from 'moment';
import 'moment/locale/id';
import StyledSelect from '../components/StyledSelect';
import StyledTable from '../components/StyledTable';
import PieChart from '../components/PieChart';
import SummaryCard from '../components/SummaryCard';
import RadarChart from '../components/RadarChart';
import {
    User,
    GraduationCap,
    FileText,
    Calendar,
    ShieldAlert,
    Download,
    Search,
    BookOpen,
    ClipboardList,
    Trophy,
    Zap,
    AlertTriangle,
    MessageCircle,
    Copy,
    Check,
    X,
    Share2,
    Filter,
    ChevronRight,
    TrendingUp,
    Brain,
    Scale,
    ArrowLeft,
    MapPin,
    RefreshCw,
    Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';
import { useSettings } from '../utils/SettingsContext';
import { generateStudentIndividualRecapPDF } from '../utils/pdfGenerator';
import { generateStudentNarrative, generateParentMessage } from '../utils/gemini';
import { runEarlyWarningAnalysis } from '../utils/analysis';

// Set global locale for moment
moment.locale('id');

// Helper function for attitude predicate
const getAttitudePredicate = (score) => {
    if (score >= 91) return 'Sangat Baik';
    if (score >= 81) return 'Baik';
    if (score >= 71) return 'Cukup';
    return 'Kurang';
};

const RekapIndividuPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(''); // New state for subject filter

    const [grades, setGrades] = useState([]); // Raw grades data needed for the detailed table and narrative AI
    const [gradesData, setGradesData] = useState(null); // The summary data from new API
    const [attendance, setAttendance] = useState([]);
    const [infractions, setInfractions] = useState([]);
    const [narrativeNote, setNarrativeNote] = useState('');
    const [parentMessage, setParentMessage] = useState(''); // New state for parent message

    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [flaggedStudents, setFlaggedStudents] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingMessage, setIsGeneratingMessage] = useState(false); // New state for parent message generation
    const [isCopied, setIsCopied] = useState(false); // New state for copy button
    const [flaggedClassFilter, setFlaggedClassFilter] = useState(''); // New state for flagged students filter
    const [classAgreement, setClassAgreement] = useState(null); // New state for dynamic weights

    const [signingLocation, setSigningLocation] = useState('Jakarta');
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    const { activeSemester, academicYear, userProfile, geminiModel, academicWeight, attitudeWeight } = useSettings();

    // State for calculated statistics, including radar data
    const [stats, setStats] = useState({
        academicAvg: 0,
        attitudeScore: 0,
        attitudePredicate: '-',
        totalInfractionPoints: 0,
        attendance: { Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0, schoolDays: 0, studentCount: 1 },
        finalScore: 0,
        academicWeight: 0,
        attitudeWeight: 0,
        knowledgeWeight: 0,
        practiceWeight: 0,
        studentName: '',
        subjectFilter: '',
        warnings: [],
        numDays: 0,
        radarData: {
            "Keimanan": 85,
            "Kewargaan": 85,
            "Penalaran Kritis": 85,
            "Kreativitas": 85,
            "Kolaborasi": 85,
            "Kemandirian": 85,
            "Kesehatan": 85,
            "Komunikasi": 85
        }
    });

    // Fetch Early Warning Students
    useEffect(() => {
        const fetchFlagged = async () => {
            setIsAnalyzing(true);
            try {
                const results = await runEarlyWarningAnalysis(null, activeSemester, academicYear, geminiModel);
                setFlaggedStudents(results);
            } catch (err) {
                console.error(err);
            } finally {
                setIsAnalyzing(false);
            }
        };
        fetchFlagged();

        // Load signing location
        const savedLoc = localStorage.getItem('QUIZ_SIGNING_LOCATION');
        if (savedLoc) setSigningLocation(savedLoc);
    }, [activeSemester, academicYear, geminiModel]);

    const handleDetectLocation = async () => {
        if (!navigator.geolocation) {
            toast.error("Browser tidak mendukung geolokasi.");
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();

                    const city = data.address.city || data.address.town || data.address.regency || data.address.county || 'Jakarta';
                    const cleanCity = city.replace(/^(Kabupaten|Kota|Kab\.|Kota\s)\s+/i, '');
                    setSigningLocation(cleanCity);
                    localStorage.setItem('QUIZ_SIGNING_LOCATION', cleanCity);
                    toast.success(`Lokasi terdeteksi: ${cleanCity}`);
                } catch (error) {
                    console.error("Error detecting location:", error);
                    toast.error("Gagal mendeteksi nama kota.");
                } finally {
                    setIsDetectingLocation(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                toast.error("Gagal mendapatkan lokasi.");
                setIsDetectingLocation(false);
            }
        );
    };

    // Unified effective auth state removed as Laravel handles auth via cookies/headers
    const currentUser = true;


    // Fetch classes
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const response = await api.get('/classes?all=true');
                const classData = response.data.data || response.data || [];
                setClasses([...classData].sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
            } catch (err) {
                console.error(err);
                toast.error('Gagal memuat data kelas');
            }
        };
        fetchClasses();
    }, []);

    // Fetch students when class or auth changes
    useEffect(() => {
        const fetchStudents = async () => {
            if (!selectedClass) {
                setStudents([]);
                return;
            }
            setIsFetchingStudents(true);
            try {
                const res = await api.get('/students', {
                    params: { rombel: selectedClass }
                });
                const studentData = res.data.data || res.data || [];
                setStudents([...studentData].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            } catch (err) {
                console.error(err);
                toast.error('Gagal memuat data siswa');
            } finally {
                setIsFetchingStudents(false);
            }
        };
        fetchStudents();
    }, [selectedClass]);

    // Fetch class agreement when class changes
    useEffect(() => {
        const fetchClassAgreement = async () => {
            if (!selectedClass) {
                setClassAgreement(null);
                return;
            }
            try {
                const targetClass = classes.find(c => c.rombel === selectedClass);
                if (targetClass) {
                    const response = await api.get(`/class-agreements/${targetClass.id}`);
                    setClassAgreement(response.data.data || response.data);
                }
            } catch (err) {
                console.warn("Failed to fetch class agreement:", err);
            }
        };
        fetchClassAgreement();
    }, [selectedClass, classes]);

    // Fetch all data for selected student
    useEffect(() => {
        const fetchAllData = async () => {
            if (!selectedStudentId) {
                setSelectedStudent(null);
                setGrades([]);
                setAttendance([]);
                setInfractions([]);
                setParentMessage(''); // Clear parent message
                return;
            }

            setIsLoading(true);
            try {
                // 1. Student Profile
                const studentDoc = students.find(s => s.id === selectedStudentId);
                setSelectedStudent(studentDoc);

                // 2. Fetch all academic data in parallel
                const [gradesRes, gradesSummaryRes, attendanceRes, infractionsRes, notesRes] = await Promise.all([
                    api.get('/grades', { params: { student_id: selectedStudentId, semester: activeSemester, academic_year: academicYear } }),
                    api.get(`/grades/summary/${selectedStudentId}`, { params: { semester: activeSemester, academic_year: academicYear } }),
                    api.get('/attendances', { params: { student_id: selectedStudentId, semester: activeSemester, academic_year: academicYear } }),
                    api.get('/infractions', { params: { student_id: selectedStudentId, semester: activeSemester, academic_year: academicYear } }),
                    api.get('/student-notes', { params: { student_id: selectedStudentId, semester: activeSemester, academic_year: academicYear } })
                ]);

                // Store single-source translation
                setGradesData(gradesSummaryRes.data);

                // Map data to match previous expectations if necessary
                const gradeList = gradesRes.data.data || gradesRes.data || [];
                const mappedGrades = gradeList.map(g => ({
                    ...g,
                    studentId: g.student_id,
                    assessmentType: g.type,
                    subjectName: g.subject?.name
                })).sort((a, b) => new Date(b.date) - new Date(a.date));

                const attendanceList = attendanceRes.data.data || attendanceRes.data || [];
                const mappedAttendance = attendanceList.map(a => ({
                    ...a,
                    studentId: a.student_id,
                    status: (a.status || '').charAt(0).toUpperCase() + (a.status || '').slice(1).replace('zin', 'jin').replace('lpa', 'lpha')
                })).sort((a, b) => new Date(b.date) - new Date(a.date));

                const infractionList = infractionsRes.data.data || infractionsRes.data || [];
                const mappedInfractions = infractionList.map(i => ({
                    ...i,
                    studentId: i.student_id
                })).sort((a, b) => new Date(b.date) - new Date(a.date));

                setGrades(mappedGrades);
                setAttendance(mappedAttendance);
                setInfractions(mappedInfractions);

                // 6. Narrative Note
                const noteList = notesRes.data.data || notesRes.data || [];
                const existingNote = noteList.length > 0 ? noteList[0].note : '';
                setNarrativeNote(existingNote);
                setParentMessage(''); // Clear parent message on student change

            } catch (err) {
                console.error("Critical Error in fetchAllData:", err);
                toast.error('Gagal memuat beberapa data siswa');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [selectedStudentId, activeSemester, academicYear, students]);

    // List of unique subjects from grades
    const availableSubjects = useMemo(() => {
        if (!gradesData || !gradesData.by_subject) return [];
        return gradesData.by_subject.map(g => g.subject_name).sort();
    }, [gradesData]);

    // Filtered data for display
    const filteredGrades = useMemo(() => {
        if (!gradesData || !gradesData.by_subject) return [];
        if (!selectedSubject) return gradesData.by_subject;
        return gradesData.by_subject.filter(g => g.subject_name === selectedSubject);
    }, [gradesData, selectedSubject]);

    // Handle Student Selection via URL/State (Direct link from Early Warning)

    useEffect(() => {
        if (location.state?.studentId && location.state?.classId && classes.length > 0) {
            const matchingClass = classes.find(c => c.id === location.state.classId);
            if (matchingClass) {
                setSelectedClass(matchingClass.rombel);
            } else {
                const classByName = classes.find(c => c.rombel === location.state.classId);
                if (classByName) setSelectedClass(location.state.classId);
            }
            if (students.length > 0) {
                const studentExists = students.find(s => s.id === location.state.studentId);
                if (studentExists) {
                    setSelectedStudentId(location.state.studentId);
                    if (location.state.subject) {
                        setSelectedSubject(location.state.subject);
                    }
                    window.history.replaceState({}, document.title);
                }
            }
        }
    }, [location.state, classes, students]);

    // Calculate stats and radar data whenever dependencies change
    useEffect(() => {
        if (!gradesData) return;

        setStats({
            academicAvg: gradesData.by_subject?.length > 0 ? (gradesData.by_subject.reduce((sum, g) => sum + g.nilai_akademik, 0) / gradesData.by_subject.length).toFixed(2) : 0,
            attitudeScore: gradesData.by_subject?.length > 0 ? Math.round(gradesData.by_subject.reduce((sum, g) => sum + g.nilai_sikap, 0) / gradesData.by_subject.length) : (100 - (gradesData.infraction_summary?.total_points || 0)),
            attitudePredicate: getAttitudePredicate(gradesData.by_subject?.length > 0 ? Math.round(gradesData.by_subject.reduce((sum, g) => sum + g.nilai_sikap, 0) / gradesData.by_subject.length) : (100 - (gradesData.infraction_summary?.total_points || 0))),
            totalInfractionPoints: gradesData.infraction_summary?.total_points || 0,
            attendance: {
                Hadir: gradesData.attendance_summary?.hadir || 0,
                Sakit: gradesData.attendance_summary?.sakit || 0,
                Ijin: gradesData.attendance_summary?.izin || 0,
                Alpha: gradesData.attendance_summary?.alpa || 0,
                schoolDays: gradesData.attendance_summary?.school_days || 0,
                studentCount: 1
            },
            finalScore: gradesData.overall_nilai_akhir || 0,
            academicWeight: gradesData.weights?.academic ?? 50,
            attitudeWeight: gradesData.weights?.attitude ?? 50,
            knowledgeWeight: gradesData.weights?.knowledge ?? 40,
            practiceWeight: gradesData.weights?.practice ?? 60,
            studentName: selectedStudent?.name || '',
            subjectFilter: selectedSubject,
            warnings: gradesData.warnings || [],
            numDays: gradesData.attendance_summary?.total || 0,
            radarData: gradesData.radar_data || {
                "Keimanan": 85,
                "Kewargaan": 85,
                "Penalaran Kritis": 85,
                "Kreativitas": 85,
                "Kolaborasi": 85,
                "Kemandirian": 85,
                "Kesehatan": 85,
                "Komunikasi": 85
            }
        });
    }, [gradesData, selectedStudent, selectedSubject]);

    const handleExportPDF = async () => {
        if (!selectedStudent) return;

        let radarChartImage = null;
        try {
            const chartElement = document.getElementById('radar-chart-container');
            if (chartElement) {
                const canvas = await html2canvas(chartElement, {
                    scale: 4, // Higher resolution for crisp PDF
                    backgroundColor: null, // Transparent background to blend
                    useCORS: true, // Handle any remote images if present
                    logging: false,
                    imageTimeout: 0,
                    onclone: (clonedDoc) => {
                        // Ensure cloned chart is visible and correctly sized
                        const clonedEl = clonedDoc.getElementById('radar-chart-container');
                        if (clonedEl) {
                            clonedEl.style.transform = 'none';
                            clonedEl.style.margin = '0';
                            // Force explicit width/height if needed, but scale handle resolution
                        }
                    }
                });
                radarChartImage = canvas.toDataURL('image/png');
            }
        } catch (error) {
            console.error("Failed to capture radar chart:", error);
        }

        generateStudentIndividualRecapPDF({
            student: selectedStudent,
            stats: stats,
            grades: filteredGrades, // Export only filtered grades
            attendance: attendance,
            infractions: infractions,
            narrative: narrativeNote,
            userProfile: userProfile,
            teacherName: userProfile?.name || 'Guru',
            selectedSubject: selectedSubject, // Pass context to PDF
            radarChartImage: radarChartImage,
            narrativeImage: await (async () => {
                const navElement = document.getElementById('narrative-preview-content');
                if (navElement) {
                    const canvas = await html2canvas(navElement, {
                        scale: 2,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    return canvas.toDataURL('image/png');
                }
                return null;
            })()
        });
    };

    const handleSaveNarrative = async () => {
        if (!selectedStudentId) return;
        setIsSaving(true);
        try {
            await api.post('/student-notes', {
                student_id: selectedStudentId,
                semester: activeSemester,
                academic_year: academicYear,
                note: narrativeNote
            });
            toast.success('Catatan narasi berhasil disimpan');
        } catch (err) {
            console.error(err);
            toast.error('Gagal menyimpan catatan');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateNarrative = useCallback(async (isAutoSave = false) => {
        if (!selectedStudentId) return;
        setIsGenerating(true);
        try {
            const result = await generateStudentNarrative({
                studentName: selectedStudent.name,
                grades: grades,
                attendance: attendance,
                infractions: infractions,
                stats: stats
            }, userProfile, geminiModel);
            setNarrativeNote(result);

            if (isAutoSave) {
                await api.post('/student-notes', {
                    student_id: selectedStudentId,
                    semester: activeSemester,
                    academic_year: academicYear,
                    note: result
                });
            }
        } catch (err) {
            console.error(err);
            toast.error('Gagal generate narasi');
        } finally {
            setIsGenerating(false);
        }
    }, [selectedStudentId, selectedStudent, grades, attendance, infractions, stats, userProfile, geminiModel, activeSemester, academicYear]);

    // Auto-generate narrative if empty after fetching
    useEffect(() => {
        if (!isLoading && selectedStudentId && !narrativeNote && !isGenerating && stats.studentName && stats.academicAvg !== 0) {
            handleGenerateNarrative(true);
        }
    }, [isLoading, selectedStudentId, narrativeNote, isGenerating, stats, handleGenerateNarrative]);

    const handleGenerateParentMessage = async () => {
        if (!selectedStudentId || !narrativeNote) return;
        setIsGeneratingMessage(true);
        setParentMessage(''); // Clear previous message
        try {
            const result = await generateParentMessage({
                studentName: selectedStudent.name,
                narrativeNote: narrativeNote,
                stats: stats,
                teacherName: userProfile?.name || 'Guru'
            }, geminiModel);
            setParentMessage(result);
            setIsCopied(false); // Reset copy status
        } catch (err) {
            console.error(err);
            toast.error('Gagal membuat pesan orang tua');
        } finally {
            setIsGeneratingMessage(false);
        }
    };

    const handleCopyMessage = () => {
        if (parentMessage) {
            navigator.clipboard.writeText(parentMessage).then(() => {
                setIsCopied(true);
                toast.success('Pesan berhasil disalin!');
                setTimeout(() => setIsCopied(false), 2000); // Reset copied state after 2 seconds
            }).catch(err => {
                console.error('Failed to copy message:', err);
                toast.error('Gagal menyalin pesan.');
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Selection Header */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-2xl transition-all active:scale-95"
                        >
                            <ArrowLeft className="text-gray-600 dark:text-gray-300" size={24} />
                        </button>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
                            <User className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 dark:text-white">Rekap Individu Siswa</h1>
                            <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg w-fit">
                                <MapPin size={12} className="text-blue-500" />
                                <span>Lokasi TTD:</span>
                                <input
                                    type="text"
                                    className="bg-transparent focus:outline-none min-w-[80px] normal-case"
                                    value={signingLocation}
                                    onChange={(e) => {
                                        setSigningLocation(e.target.value);
                                        localStorage.setItem('QUIZ_SIGNING_LOCATION', e.target.value);
                                    }}
                                    placeholder="Kota..."
                                />
                                <button
                                    onClick={handleDetectLocation}
                                    disabled={isDetectingLocation}
                                    className="hover:text-blue-500 transition-colors"
                                >
                                    {isDetectingLocation ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 min-w-[300px]">
                        <StyledSelect value={selectedClass} onChange={(e) => {
                            const val = e.target.value;
                            setSelectedClass(val);
                            setFlaggedClassFilter(val);
                            setSelectedStudentId('');
                        }}>
                            <option value="">Pilih Kelas</option>
                            {classes.map(c => <option key={c.id} value={c.rombel}>{c.rombel}</option>)}
                        </StyledSelect>
                        <StyledSelect
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            disabled={!selectedClass || isFetchingStudents}
                        >
                            <option value="">{isFetchingStudents ? 'Memuat siswa...' : 'Pilih Siswa'}</option>
                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </StyledSelect>
                    </div>
                </div>
            </div>

            {!selectedStudentId ? (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-gray-800/40 p-12 rounded-[3rem] text-center shadow-xl">
                        <Search size={64} className="text-blue-500/20 mx-auto mb-6" />
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2">
                            {selectedClass ? `Siswa Kelas ${selectedClass}` : 'Pilih Siswa untuk Rekap'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            {selectedClass ? 'Klik pada nama siswa di bawah untuk melihat rekap detail' : 'Pilih kelas dan nama siswa di atas untuk melihat rekap lengkap'}
                        </p>
                    </div>

                    {/* All Students Grid (shown when class selected) */}
                    {selectedClass && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600">
                                    <GraduationCap size={20} />
                                </div>
                                <h2 className="text-xl font-black text-gray-800 dark:text-white">
                                    {isFetchingStudents ? 'Memuat daftar siswa...' : `Daftar Siswa (${students.length})`}
                                </h2>
                            </div>

                            {isFetchingStudents ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-pulse">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
                                    ))}
                                </div>
                            ) : students.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {students.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedStudentId(s.id)}
                                            className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-2xl border border-transparent hover:border-blue-500 hover:scale-105 transition-all text-center shadow-md group"
                                        >
                                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <User size={20} />
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{s.name}</p>
                                            <p className="text-[10px] text-gray-500">{s.nis || 'No NIS'}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-10 bg-gray-50 dark:bg-gray-900/30 rounded-3xl text-center border-2 border-dashed border-gray-200 dark:border-gray-800">
                                    <p className="text-gray-500 font-medium">Tidak ada siswa yang ditemukan di kelas {selectedClass}.</p>
                                    <p className="text-xs text-gray-400 mt-1">Pastikan data rombel siswa di Master Data sudah sesuai.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Flagged Students Section */}
                    {flaggedStudents.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-800 dark:text-white">
                                        {selectedClass ? `Siswa Perlu Perhatian (Kelas ${selectedClass})` : 'Siswa Perlu Perhatian Segera'}
                                    </h2>
                                </div>
                                {!selectedClass && (
                                    <div className="w-full sm:w-48">
                                        <StyledSelect
                                            value={flaggedClassFilter}
                                            onChange={(e) => setFlaggedClassFilter(e.target.value)}
                                            className="!py-2 !text-xs"
                                        >
                                            <option value="">Semua Kelas</option>
                                            {classes.map(c => <option key={c.id} value={c.rombel}>{c.rombel}</option>)}
                                        </StyledSelect>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {flaggedStudents
                                    .filter(s => !flaggedClassFilter || s.rombel === flaggedClassFilter)
                                    .map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => {
                                                setSelectedClass(student.rombel);
                                                setSelectedStudentId(student.id);
                                            }}
                                            className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm p-5 rounded-3xl border-l-4 border-red-500 text-left hover:scale-[1.02] transition-all shadow-lg group"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-black text-gray-800 dark:text-white group-hover:text-red-500 transition-colors uppercase truncate mr-2">{student.name}</h3>
                                                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 uppercase">{student.rombel}</span>
                                            </div>
                                            <div className="space-y-1">
                                                {student.warnings.map((w, idx) => (
                                                    <p key={idx} className="text-[10px] text-red-500/80 font-medium flex items-center gap-1">
                                                        <span className="w-1 h-1 bg-red-400 rounded-full" /> {w}
                                                    </p>
                                                ))}
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Detail Rekap →</span>
                                                {student.totalPointsDeducted > 0 && (
                                                    <span className="text-[10px] font-bold text-gray-400">-{student.totalPointsDeducted} Poin Pelanggaran</span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-fade-in-up">
                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
                        {stats.warnings.length > 0 ? (
                            <div className="flex-1 w-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
                                <div className="p-2 bg-red-100 dark:bg-red-800 rounded-xl text-red-600 dark:text-red-400">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Peringatan Siswa Bermasalah</p>
                                    <p className="text-xs text-red-500 dark:text-red-400 opacity-80">{stats.warnings.join(' • ')}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 hidden md:block" />
                        )}
                        <div className="w-full md:w-64">
                            <StyledSelect
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                            >
                                <option value="">Semua Mata Pelajaran</option>
                                {availableSubjects.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </StyledSelect>
                        </div>
                    </div>

                    {/* Class Agreement Display */}
                    {classAgreement?.agreements && (
                        <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/20 p-5 rounded-3xl flex items-start gap-4 animate-in fade-in duration-700">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600">
                                <Scale size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Kesepakatan Kelas {selectedClass}</p>
                                <div className="text-xs text-purple-800 dark:text-purple-300 whitespace-pre-line leading-relaxed font-medium">
                                    {classAgreement.agreements}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                            title={selectedSubject ? `Rata-rata ${selectedSubject}` : "Rata-rata Akademik"}
                            value={stats.academicAvg}
                            icon={<GraduationCap className="w-8 h-8 text-blue-500" />}
                            color="blue"
                            subtitle={`Berdasarkan ${filteredGrades.length} penilaian`}
                        />
                        <SummaryCard
                            title={`Nilai Sikap (${stats.attitudePredicate})`}
                            value={stats.attitudeScore}
                            icon={<ShieldAlert className="w-8 h-8 text-emerald-500" />}
                            color="green"
                            subtitle={`Poin Pelanggaran: ${stats.totalInfractionPoints}`}
                        />
                        <SummaryCard
                            title={`Nilai Akhir (${stats.academicWeight}/${stats.attitudeWeight})`}
                            value={stats.finalScore}
                            icon={<Trophy className="w-8 h-8 text-purple-500" />}
                            color="purple"
                            subtitle={`(${stats.academicWeight}% Akad + ${stats.attitudeWeight}% Sikap)`}
                        />
                        <SummaryCard
                            title="Kehadiran"
                            value={stats.attendance.Hadir}
                            icon={<Calendar className="w-8 h-8 text-amber-500" />}
                            color="yellow"
                            subtitle={`S: ${stats.attendance.Sakit} | I: ${stats.attendance.Ijin} | A: ${stats.attendance.Alpha}`}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                        {/* Radar Chart Profil Lulusan */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Brain size={80} />
                            </div>
                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600">
                                    <Brain size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-white leading-tight">Profil Lulusan 2025</h2>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Holistic Competency Radar</p>
                                </div>
                            </div>

                            <div id="radar-chart-container" className="h-[400px] flex items-center justify-center p-8 mt-4">
                                <RadarChart
                                    data={stats.radarData}
                                    size={340}
                                    descriptions={{
                                        "Keimanan": "Log Pelanggaran & Catatan Wali Kelas",
                                        "Kewargaan": "Persentase Kehadiran & Kedisiplinan",
                                        "Penalaran Kritis": "Rata-rata Nilai Pengetahuan",
                                        "Kreativitas": "Rata-rata Nilai Keterampilan",
                                        "Kolaborasi": "Integrasi Nilai Keterampilan & Proyek",
                                        "Kemandirian": "Kemandirian Belajar & Absensi",
                                        "Kesehatan": "Data Sakit & Kebugaran Terlacak",
                                        "Komunikasi": "Presentasi & Kualitas Tugas Praktik"
                                    }}
                                />
                            </div>

                            <div className="mt-4 p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                                <p className="text-[10px] text-indigo-800 dark:text-indigo-400 font-medium italic text-center leading-relaxed">
                                    *Data dihasilkan secara cerdas melalui konvergensi capaian akademik, rekam kehadiran, dan profil perilaku selama satu semester.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Attendance Detail */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600">
                                            <Calendar size={20} />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Detail Kehadiran</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div className="w-full">
                                        <PieChart data={stats.attendance} numDays={stats.numDays} />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                        <table className="w-full text-left">
                                            <tbody className="text-xs divide-y dark:divide-gray-700">
                                                {attendance.length > 0 ? attendance.map((att, i) => (
                                                    <tr key={i}>
                                                        <td className="py-2 text-gray-500 text-[10px] font-medium">{moment(att.date).format('DD/MM/YY')}</td>
                                                        <td className="py-2 font-bold text-gray-800 dark:text-gray-200">
                                                            {new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(new Date(att.date))}
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${att.status === 'Hadir' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                                                                att.status === 'Alpha' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                                                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                                                }`}>
                                                                {att.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="3" className="py-10 text-center text-gray-400">Belum ada data absensi</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Infraction Detail */}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600">
                                            <ShieldAlert size={20} />
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Catatan Kedisiplinan</h2>
                                    </div>
                                </div>

                                <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                    <div className="space-y-4">
                                        {infractions.length > 0 ? infractions.map((inf, i) => (
                                            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                        {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(inf.date))}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 text-[10px] font-black rounded-md">+{inf.points} POIN</span>
                                                </div>
                                                <p className="font-bold text-gray-800 dark:text-gray-200">{inf.infractionType}</p>
                                                {inf.description && <p className="text-xs text-gray-500 mt-1 italic">{inf.description}</p>}
                                            </div>
                                        )) : (
                                            <div className="py-10 text-center text-gray-400">Tidak ada catatan pelanggaran</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Academic Detail */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600">
                                        <BookOpen size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Detail Akademik</h2>
                                </div>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white dark:bg-gray-800 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="pb-4">Tanggal</th>
                                            <th className="pb-4">Materi / Subjek</th>
                                            <th className="pb-4 text-right">Nilai</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y dark:divide-gray-700">
                                        {filteredGrades.length > 0 ? filteredGrades.map((g, i) => (
                                            <tr key={i} className="group">
                                                <td className="py-3 text-gray-500">{moment(g.date).format('DD/MM/YYYY')}</td>
                                                <td className="py-3">
                                                    <p className="font-bold text-gray-800 dark:text-gray-200">{g.material}</p>
                                                    <p className="text-[10px] text-gray-400 uppercase">{g.subjectName} • {g.assessmentType}</p>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <span className={`px-2.5 py-1 rounded-lg font-bold ${parseFloat(g.score) >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                                        {g.score}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="3" className="py-10 text-center text-gray-400">Belum ada data nilai</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Narrative Note */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600">
                                        <FileText size={20} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Catatan Guru Mapel</h2>
                                </div>
                                <button
                                    onClick={handleGenerateNarrative}
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-xl text-[10px] font-black hover:bg-purple-200 transition-all disabled:opacity-50"
                                >
                                    <Zap size={12} fill="currentColor" />
                                    {isGenerating ? 'AI Menganalisis...' : 'SMARTY AI'}
                                </button>
                            </div>

                            <textarea
                                value={narrativeNote}
                                onChange={(e) => setNarrativeNote(e.target.value)}
                                placeholder="Tuliskan catatan kemajuan belajar, saran, dan motivasi untuk siswa..."
                                className="w-full h-48 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-700 dark:text-gray-300 custom-scrollbar resize-none mb-4"
                            />

                            {/* Narrative Preview Area */}
                            {narrativeNote && (
                                <div className="mb-6 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        <Zap size={10} className="text-purple-500" />
                                        Pratinjau Tampilan (Rendered)
                                    </div>
                                    <div id="narrative-preview-content" className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-800/20 prose dark:prose-invert max-w-none text-sm">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkMath]}
                                            rehypePlugins={[rehypeRaw, rehypeKatex]}
                                        >
                                            {narrativeNote}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveNarrative}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                                >
                                    {isSaving ? 'Menyimpan...' : 'Simpan Note'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* Export Section - Refactored to full width since narrative moved */}
                        <div className="bg-gradient-to-br from-gray-800 to-black p-8 rounded-[2.5rem] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 border border-white/10">
                            <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shrink-0">
                                    <Download size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Cetak Rekap Portofolio</h3>
                                    <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                                        Generate laporan PDF resmi untuk dibagikan kepada orang tua siswa. Laporan mencakup nilai, absensi, dan perilaku.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <button
                                    onClick={handleExportPDF}
                                    className="bg-white text-black font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-95 transition-all shadow-lg text-xs uppercase tracking-widest"
                                >
                                    <FileText size={18} />
                                    EKSPOR PDF
                                </button>
                                <button
                                    onClick={handleGenerateParentMessage}
                                    disabled={isGeneratingMessage || !narrativeNote}
                                    className="bg-green-500 hover:bg-green-600 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg text-xs border-b-4 border-green-700 disabled:opacity-50 uppercase tracking-widest"
                                >
                                    <MessageCircle size={18} />
                                    {isGeneratingMessage ? 'Menciptakan...' : 'Pesan WA (AI)'}
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Modal for Parent Message */}
                    {parentMessage && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/20 rounded-xl">
                                            <MessageCircle size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black leading-tight">Pesan Orang Tua Cerdas</h3>
                                            <p className="text-[10px] opacity-80 font-bold uppercase tracking-wider">Siap kirim via WhatsApp</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setParentMessage('')} className="p-2 hover:bg-white/20 rounded-full transition-all">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-8 overflow-y-auto custom-scrollbar">
                                    <div className="bg-gray-50 dark:bg-black/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 relative group">
                                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                            {parentMessage}
                                        </pre>
                                    </div>
                                </div>
                                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                                    <button
                                        onClick={() => setParentMessage('')}
                                        className="flex-1 py-4 font-bold text-gray-500 hover:text-gray-700 transition-all"
                                    >
                                        Tutup
                                    </button>
                                    <button
                                        onClick={handleCopyMessage}
                                        className="flex-[2] bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-500/20"
                                    >
                                        {isCopied ? <Check size={20} /> : <Copy size={20} />}
                                        {isCopied ? 'TERSALIN!' : 'SALIN & KIRIM'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RekapIndividuPage;
