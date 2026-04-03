import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import BSKAP_DATA from '../utils/bskap_2025_intel.json';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { saveAs } from 'file-saver';
import { asBlob } from 'html-docx-js-typescript';
import { useSettings } from '../utils/SettingsContext';
import {
    Sparkles,
    Loader2,
    History,
    FileText,
    Download,
    ClipboardList,
    Search,
    BookOpen,
    Trash2,
    Save,
    Clock
} from 'lucide-react';
import Modal from '../components/Modal';

// Reusing Styled Components for consistency (Keep it simple with Tailwind)
const StyledSelect = ({ label, value, onChange, children, disabled }) => (
    <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">{label}</label>
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full p-3 pl-4 pr-10 appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {children}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
    </div>
);

const LkpdGeneratorPage = () => {
    const { geminiModel, activeSemester, academicYear } = useSettings();

    // Data States
    const [savedRPPs, setSavedRPPs] = useState([]);
    const [savedLKPDs, setSavedLKPDs] = useState([]); // New state for LKPD history
    const [classes, setClasses] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isSaving, setIsSaving] = useState(false); // New state for saving status
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    // Selection States
    const [selectedRPP, setSelectedRPP] = useState(null);
    const [selectedClass, setSelectedClass] = useState('');
    const [assessmentModel, setAssessmentModel] = useState('Rubrik'); // New State

    // Generation States
    const [isGenerating, setIsGenerating] = useState(false);
    const [lkpdContent, setLkpdContent] = useState('');

    // User Context
    const [userProfile, setUserProfile] = useState({ name: '', school: '', nip: '' });
    const [teacherProfile, setTeacherProfile] = useState(null);

    // Initial Data Load
    useEffect(() => {
        fetchInitialData();
    }, []);

    // Helper to normalize grade level for comparison
    const normalizeGrade = (grade) => {
        if (!grade) return '';
        // Extract numbers from string (e.g., "Kelas 7" -> "7")
        const match = String(grade).match(/\d+/);
        return match ? match[0] : String(grade).trim();
    };

    const fetchInitialData = async () => {
        setLoadingHistory(true);
        try {
            // Use separate try-catches or handled promises to ensure one failure doesn't block others
            const fetchRPPs = api.get('/ai/rpp-history').catch(e => { console.error("RPP History error", e); return { data: [] }; });
            const fetchLKPDs = api.get('/ai/worksheet-history').catch(e => { console.error("Worksheet History error", e); return { data: [] }; });
            const fetchClasses = api.get('/classes').catch(e => { console.error("Classes error", e); return { data: { data: [] } }; });
            const fetchUser = api.get('/me').catch(e => { console.error("User error", e); return { data: {} }; });
            const fetchTeacher = api.get('/teachers').catch(e => { console.error("Teacher error", e); return { data: { data: [] } }; });

            const [rppRes, lkpdRes, classesRes, userRes, teacherRes] = await Promise.all([
                fetchRPPs,
                fetchLKPDs,
                fetchClasses,
                fetchUser,
                fetchTeacher
            ]);

            const rppDataRaw = rppRes.data.data || rppRes.data || [];
            const safeRppList = Array.isArray(rppDataRaw) ? rppDataRaw : (Array.isArray(rppDataRaw.data) ? rppDataRaw.data : []);
            const rppData = safeRppList.map(item => ({
                ...item,
                gradeLevel: item.grade_level || item.gradeLevel // Ensure camelCase for filtering
            }));
            setSavedRPPs(rppData);

            // Format LKPD history
            const lkpdListRaw = lkpdRes.data.data || lkpdRes.data || [];
            const safeLkpdList = Array.isArray(lkpdListRaw) ? lkpdListRaw : (Array.isArray(lkpdListRaw.data) ? lkpdListRaw.data : []);
            const formattedLkpd = safeLkpdList.map(item => ({
                id: item.id,
                ...item,
                gradeLevel: item.grade_level,
                classRoom: item.class_room,
                rppTopic: item.rpp_topic,
                // Handle Laravel date format (string) instead of Firebase toDate()
                createdAt: item.created_at
            }));
            setSavedLKPDs(formattedLkpd);

            // Backend already filters classes for teachers
            const classDataRaw = classesRes.data.data || classesRes.data || [];
            const classData = Array.isArray(classDataRaw) ? classDataRaw : (Array.isArray(classDataRaw.data) ? classDataRaw.data : []);

            const userData = userRes.data;
            const teacherData = (teacherRes.data.data || teacherRes.data || [])[0] || null;

            setClasses(classData.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
            setUserProfile(userData);
            setTeacherProfile(teacherData);

        } catch (error) {
            console.error("Error in fetchInitialData:", error);
            toast.error("Gagal memuat data awal secara lengkap");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleGenerateLKPD = async () => {
        if (!selectedRPP) {
            toast.error("Pilih RPP terlebih dahulu");
            return;
        }
        if (!selectedClass) {
            toast.error("Pilih Kelas terlebih dahulu");
            return;
        }

        setIsGenerating(true);
        try {
            // 1. Fetch Students via API
            // Assuming /students endpoint accepts filtering or we filter manually
            const studentsRes = await api.get('/students');
            const studentList = studentsRes.data.data || studentsRes.data || [];
            const classObj = classes.find(c => c.id === selectedClass);

            // Filter students for the selected class
            let filteredStudents = studentList.filter(s => s.class_id == selectedClass);

            // Fallback filter by rombel if class_id mismatch or strict check needed
            if (filteredStudents.length === 0 && classObj) {
                filteredStudents = studentList.filter(s => s.rombel === classObj.rombel);
            }

            const studentNames = filteredStudents.map(s => s.name);

            // 2. Generate LKPD Content via Backend API
            const response = await api.post('/ai/generate-worksheet', {
                rppContent: selectedRPP.content,
                gradeLevel: selectedRPP.gradeLevel,
                subject: selectedRPP.subject,
                topic: selectedRPP.topic,
                assessmentModel: assessmentModel,
                studentNames: studentNames, // Pass student names to backend
                modelName: geminiModel
            });

            const lkpdResult = (response.data.data || response.data).content;
            setLkpdContent(lkpdResult);
            toast.success("LKPD Berhasil dibuat!");

        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.error || error.message;
            toast.error("Gagal membuat LKPD: " + msg);
        } finally {
            setIsGenerating(false);
        }
    };


    const handleDownloadDocx = async () => {
        const content = document.getElementById('lkpd-preview-content');
        if (!content) {
            toast.error("Belum ada konten LKPD untuk diunduh");
            return;
        }

        const contentHtml = content.innerHTML;

        const htmlString = `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
                    h1, h2, h3 { color: #000; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .page-break { page-break-before: always; }
                    table:last-of-type { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                ${contentHtml}
            </body>
            </html>
        `;

        try {
            const converted = await asBlob(htmlString);
            const fileName = `LKPD-${selectedRPP?.gradeLevel || 'Kelas'}-${selectedClass || 'General'}.docx`;
            saveAs(converted, fileName);
            toast.success("LKPD sedang didownload (.docx)");
        } catch (error) {
            console.error("Download error:", error);
            toast.error("Gagal membuat file Word");
        }
    };

    const handleSaveLKPD = async () => {
        if (!lkpdContent || !selectedRPP || !selectedClass) return;
        setIsSaving(true);
        try {
            const classObj = classes.find(c => c.id === selectedClass);

            await api.post('/ai/save-worksheet', {
                rppId: selectedRPP.id,
                rppTopic: selectedRPP.topic, // mapped to rpp_topic
                subject: selectedRPP.subject,
                gradeLevel: selectedRPP.gradeLevel,
                classId: selectedClass,
                classRoom: classObj?.rombel || selectedClass,
                content: lkpdContent
            });

            toast.success("LKPD berhasil disimpan!");
            fetchInitialData(); // Refresh history
        } catch (error) {
            console.error("Error saving LKPD:", error);
            const msg = error.response?.data?.error || "Gagal menyimpan LKPD";
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteLKPD = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Riwayat',
            message: 'Apakah Anda yakin ingin menghapus Riwayat LKPD ini?',
            onConfirm: async () => {
                try {
                    await api.delete(`/ai/worksheet-history/${id}`);
                    toast.success("Riwayat LKPD dihapus");
                    fetchInitialData(); // Refresh history
                } catch (error) {
                    console.error("Error deleting LKPD:", error);
                    toast.error("Gagal menghapus");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleLoadLKPD = (lkpd) => {
        setLkpdContent(lkpd.content);
        setSelectedClass(lkpd.classId || lkpd.classRoom);
        // We might not be able to set selectedRPP easily if it's not in the current rpp_history page 
        // but for display purposes, setting content is enough.
        // Optionally try to find the RPP object
        const rpp = savedRPPs.find(r => r.id === lkpd.rppId);
        if (rpp) setSelectedRPP(rpp);
    };

    return (
        <div className="max-w-[1500px] mx-auto px-4 py-4 lg:py-8 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 lg:mb-8 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold text-purple-800 dark:text-purple-100 flex items-center gap-3">
                        <ClipboardList className="text-purple-600 animate-pulse" />
                        Generator LKPD
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Buat Lembar Kerja Peserta Didik (LKPD) otomatis dari RPP yang sudah ada.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded border border-purple-100 dark:border-purple-800 w-fit">
                        <Sparkles size={12} /> Powered by BSKAP 2025 Intel Engine
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Controls */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8 h-fit">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Search size={20} className="text-purple-500" />
                            Konfigurasi
                        </h3>

                        {/* RPP Selection */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">Pilih RPP Sumber</label>
                            {loadingHistory ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="animate-spin" size={14} /> Memuat RPP...</div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto border dark:border-gray-600 rounded-xl divide-y dark:divide-gray-700">
                                    {savedRPPs.length > 0 ? (
                                        savedRPPs.map((rpp) => (
                                            <button
                                                key={rpp.id}
                                                onClick={() => {
                                                    setSelectedRPP(rpp);
                                                    setSelectedClass('');
                                                    if (rpp.assessmentModel) {
                                                        setAssessmentModel(rpp.assessmentModel);
                                                        toast.success(`Model KKTP terdeteksi: ${rpp.assessmentModel}`);
                                                    }
                                                }}
                                                className={`w-full text-left p-3 text-sm transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20 ${selectedRPP?.id === rpp.id ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold' : 'text-gray-600 dark:text-gray-400'}`}
                                            >
                                                <div className="font-bold">{rpp.gradeLevel} - {rpp.subject}</div>
                                                <div className="text-xs font-normal truncate">{rpp.topic}</div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-xs text-gray-400">Belum ada RPP tersimpan. Silakan buat RPP dulu.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Grade Level Display (Read Only) */}
                        {selectedRPP && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">Terpilih:</span>
                                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{selectedRPP.gradeLevel} - {selectedRPP.subject}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{selectedRPP.topic}</div>
                            </div>
                        )}

                        {/* Class Selection */}
                        <StyledSelect
                            label="Pilih Kelas (Target)"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            disabled={!selectedRPP}
                        >
                            <option value="">-- Pilih Kelas --</option>
                            {classes
                                .filter(c => {
                                    if (!selectedRPP) return true;
                                    
                                    // 1. Filter by Grade Level
                                    const rppGrade = normalizeGrade(selectedRPP.gradeLevel);
                                    const classGrade = normalizeGrade(c.level);
                                    const gradeMatch = rppGrade === classGrade;
                                    
                                    if (!gradeMatch) return false;

                                    // 2. Filter by Teacher Assignment (Subject & Class Match)
                                    // Only filter if user is a teacher and has assignments
                                    if (userProfile.role === 'teacher' && teacherProfile?.assignments?.length > 0) {
                                        const rppSubject = (selectedRPP.subject || '').toLowerCase().trim();
                                        
                                        return teacherProfile.assignments.some(a => {
                                            const assignmentSubject = (a.subject?.name || '').toLowerCase().trim();
                                            // Check if this class is assigned to teacher for this RPP's subject
                                            return a.class_id === c.id && (assignmentSubject === rppSubject || a.subject_id == selectedRPP.subject_id);
                                        });
                                    }

                                    return true;
                                })
                                .map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)
                            }
                        </StyledSelect>

                        <StyledSelect
                            label="Pendekatan Asesmen (KKTP)"
                            value={assessmentModel}
                            onChange={(e) => setAssessmentModel(e.target.value)}
                        >
                            {BSKAP_DATA.kktp_standards.methods.map(m => (
                                <option key={m.type} value={m.type}>{m.type}</option>
                            ))}
                        </StyledSelect>

                        <button
                            onClick={handleGenerateLKPD}
                            disabled={isGenerating || !selectedRPP || !selectedClass}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            {isGenerating ? 'Memproses...' : 'Buat LKPD'}
                        </button>

                    </div>

                    {/* History Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <History size={20} className="text-purple-500" />
                            Riwayat LKPD
                        </h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {loadingHistory ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-300" /></div>
                            ) : savedLKPDs.length > 0 ? (
                                savedLKPDs.map((item) => (
                                    <div key={item.id} className="group relative bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-800 transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="cursor-pointer flex-1" onClick={() => handleLoadLKPD(item)}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{item.gradeLevel} - {item.classRoom}</span>
                                                    <span className="text-[10px] text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : 'N/A'}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{item.rppTopic || 'Topik tidak tersedia'}</p>
                                            </div>
                                            <button onClick={() => handleDeleteLKPD(item.id)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-xs text-gray-400 py-4">Belum ada riwayat tersimpan.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-3">
                    {lkpdContent ? (
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col h-full min-h-[600px]">
                            <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center sticky top-0 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-600 rounded-lg">
                                        <FileText className="text-white" size={20} />
                                    </div>
                                    <span className="font-bold text-gray-800 dark:text-gray-200">Pratinjau LKPD</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveLKPD}
                                        disabled={isSaving}

                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        Simpan
                                    </button>
                                    <button
                                        onClick={handleDownloadDocx}
                                        className="px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                                    >
                                        <Download size={16} /> Word
                                    </button>
                                </div>
                            </div>
                            <div id="lkpd-preview-content" className="p-8 lg:p-12 overflow-y-auto flex-1 rpp-prose max-w-none custom-scrollbar">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                                >
                                    {lkpdContent}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
                            <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                                <ClipboardList className="text-purple-300 dark:text-purple-700" size={64} />
                            </div>
                            <div className="max-w-md">
                                <h3 className="text-lg font-bold text-gray-400">Belum ada konten</h3>
                                <p className="text-gray-400 text-sm">Pilih RPP dan Kelas di sebelah kiri, lalu klik "Buat LKPD" untuk memulai.</p>
                            </div>
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

export default LkpdGeneratorPage;
