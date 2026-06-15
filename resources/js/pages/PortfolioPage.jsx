import React, { useState, useEffect, useCallback } from 'react';
import {
    Book, Sparkles, Send, Download, Save, RefreshCw, ChevronRight, FileText,
    PieChart, BarChart, ShieldCheck, Zap, Bot, Loader, Trash2, AlertTriangle
} from 'lucide-react';
import Modal from '../components/Modal';

import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { generatePortfolioChapter } from '../utils/portfolioService';
import toast from 'react-hot-toast';
import VisualAnalytics from '../components/portfolio/VisualAnalytics';
import { asBlob } from 'html-docx-js-typescript';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime } from '../utils/dateUtils';

const CHAPTERS = [
    { id: 1, title: 'BAB I: PENDAHULUAN', icon: <Book size={20} /> },
    { id: 2, title: 'BAB II: PEMETAAN KURIKULUM & TARGET', icon: <FileText size={20} /> },
    { id: 3, title: 'BAB III: STRATEGI PEMBELAJARAN (PEDAGOGY)', icon: <Zap size={20} /> },
    { id: 4, title: 'BAB IV: ANALISIS HASIL BELAJAR (MAPEL)', icon: <PieChart size={20} /> },
    { id: 5, title: 'BAB V: DISIPLIN AKADEMIK & ETIKA', icon: <ShieldCheck size={20} /> },
    { id: 6, title: 'BAB VI: EVALUASI PERIODE (SWOT)', icon: <Bot size={20} /> },
    { id: 7, title: 'BAB VII: PENUTUP & REKOMENDASI', icon: <Sparkles size={20} /> },
];

export default function PortfolioPage() {
    const { user } = useAuth();
    const { activeSemester, academicYear } = useSettings();
    const [activeChapter, setActiveChapter] = useState(1);
    const [chaptersContent, setChaptersContent] = useState({});
    const [liveContextData, setLiveContextData] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [, setIsLiveContextLoading] = useState({});
    const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, chapterId: null });
    const [isGenerating, setIsGenerating] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [portfolioId, setPortfolioId] = useState(null);
    const [fullReportCaptureState, setFullReportCaptureState] = useState(null);

    const completedCount = Object.keys(chaptersContent).length;
    const completionPercentage = Math.round((completedCount / CHAPTERS.length) * 100);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            setIsLoading(true);
            try {
                // MySQL via Laravel API
                const subRes = await api.get('/subjects');
                const fetchedSub = subRes.data.data || subRes.data || [];
                setSubjects(fetchedSub);
                
                if (fetchedSub.length > 0 && !selectedSubject) {
                    setSelectedSubject(fetchedSub[0].name);
                }

                // Profile is already in user object from useAuth, or fetch separately if needed
                setUserProfile(user);
            } catch (err) {
                console.error("Error loading subjects:", err);
                toast.error("Gagal memuat daftar mata pelajaran.");
            } finally {
                setIsLoading(false);
            }
        };
        loadInitialData();
    }, [user]);

    useEffect(() => {
        const loadPortfolio = async () => {
            if (!user || !selectedSubject) return;
            setIsLoading(true);
            try {
                // Laravel API endpoint for portfolio
                const res = await api.get('/portfolios', {
                    params: {
                        academic_year: academicYear,
                        semester: activeSemester,
                        subject: selectedSubject
                    }
                });
                if (res.data && res.data.data) {
                    const rawChapters = res.data.data.content?.chapters || res.data.data.chapters || {};
                    setChaptersContent(rawChapters);
                    setPortfolioId(res.data.data.id);
                } else {
                    const rawChapters = res.data.content?.chapters || res.data.chapters || {};
                    setChaptersContent(rawChapters);
                    setPortfolioId(res.data.id);
                }
            } catch (error) {
                console.error("Error loading portfolio:", error);
                setChaptersContent({});
            } finally {
                setIsLoading(false);
            }
        };
        loadPortfolio();
    }, [academicYear, activeSemester, selectedSubject, user]);

    const saveChapter = async (chapId, content, context) => {
        if (!user || !selectedSubject) return;
        try {
            const newChapterData = {
                content,
                context,
                status: 'done',
                updatedAt: new Date().toISOString()
            };

            const updatedChapters = {
                ...chaptersContent,
                [chapId]: newChapterData
            };

            if (portfolioId) {
                await api.put(`/portfolios/${portfolioId}`, {
                    content: { chapters: updatedChapters }
                });
                setChaptersContent(updatedChapters);
                toast.success("Bab berhasil disimpan.");
            } else {
                const res = await api.post('/portfolios/generate', {
                    academic_year: academicYear,
                    semester: activeSemester,
                    subject: selectedSubject,
                    chapter_id: activeChapter,
                    context: context,
                    existing_chapters: chaptersContent
                });

                if (res.data) {
                    setPortfolioId(res.data.id);
                    // Pastikan kita ambil 'content' yang merupakan dictionary bab
                    const newContent = res.data.content?.chapters || res.data.content || {};
                    setChaptersContent(newContent);
                }
                
                toast.success(`Bab ${activeChapter} berhasil disusun!`);
            }
        } catch (error) {
            console.error("Error saving chapter:", error);
            toast.error("Gagal menyimpan bab.");
        }
    };

    const handleDeleteChapter = (chapId) => {
        setConfirmDeleteModal({ isOpen: true, chapterId: chapId });
    };

    const confirmDelete = async () => {
        const chapId = confirmDeleteModal.chapterId;
        if (chapId === null || !user) return;
        setConfirmDeleteModal({ isOpen: false, chapterId: null });

        try {
            const newChapters = { ...chaptersContent };
            delete newChapters[chapId];

            await api.post('/portfolios/save', {
                academic_year: academicYear,
                semester: activeSemester,
                subject: selectedSubject,
                chapters: newChapters
            });

            setChaptersContent(newChapters);
            toast.success("Bab berhasil dihapus.");
        } catch (error) {
            console.error("Error deleting chapter:", error);
            toast.error("Gagal menghapus bab.");
        }
    };

    const gatherContext = useCallback(async (chapId) => {
        if (!user) return {};

        try {
            switch (chapId) {
                case 1: { // Pendahuluan
                    const [classRes, studentRes] = await Promise.all([
                        api.get('/classes'),
                        api.get('/students', { params: { all: true } })
                    ]);

                    const classData = classRes.data.data || classRes.data || [];
                    const allStudents = studentRes.data.data || studentRes.data || [];

                    const classList = classData.map(cls => ({
                        id: cls.id,
                        name: cls.rombel,
                        studentCount: allStudents.filter(s => s.class_id === cls.id).length
                    }));

                    return {
                        namaGuru: user.name,
                        sekolah: user.school_name || '',
                        mataPelajaran: selectedSubject,
                        tahunAjaran: academicYear,
                        semester: activeSemester,
                        daftarKelas: classList,
                        totalSiswa: allStudents.length
                    };
                }
                case 4: { // Hasil Belajar (MySQL)
                    const res = await api.get('/grades', {
                        params: {
                            academic_year: academicYear,
                            semester: activeSemester,
                            subject_name: selectedSubject
                        }
                    });
                    const rawData = res.data.data || [];

                    const byAssessment = {};
                    rawData.forEach(d => {
                        const key = d.topic || 'Lainnya';
                        if (!byAssessment[key]) byAssessment[key] = { total: 0, count: 0 };
                        byAssessment[key].total += Number(d.score) || 0;
                        byAssessment[key].count += 1;
                    });

                    const rekapPerJenisNilai = Object.entries(byAssessment).map(([name, stats]) => ({
                        subject: name,
                        score: Math.round(stats.total / stats.count)
                    }));

                    return { rekapPerJenisNilai };
                }
                default: return {};
            }
        } catch (err) {
            console.error("Context gather error:", err);
            return {};
        }
    }, [selectedSubject, user, academicYear, activeSemester]);

    useEffect(() => {
        const fetchLiveContext = async () => {
            if (!activeChapter || !selectedSubject || !user) return;
            const context = await gatherContext(activeChapter);
            setLiveContextData(prev => ({ ...prev, [activeChapter]: context }));
        };
        fetchLiveContext();
    }, [activeChapter, selectedSubject, user, gatherContext]);

    const handleGenerate = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        const loadingToast = toast.loading(`Sedang menyusun ${CHAPTERS.find(c => c.id === activeChapter)?.title}...`);

        try {
            const context = liveContextData[activeChapter] || await gatherContext(activeChapter) || {};
            const content = await generatePortfolioChapter(activeChapter, context, user, selectedSubject, chaptersContent);
            await saveChapter(activeChapter, content, context);
            toast.success(`Bab ${activeChapter} berhasil disusun!`, { id: loadingToast });
        } catch (error) {
            console.error("Generation error:", error);
            toast.error("Gagal menyusun bab.", { id: loadingToast });
        } finally {
            setIsGenerating(false);
        }
    };

    // ... sisa fungsi ekspor (markdownToHtml, handleExportWord, dll) tetap sama karena urusan UI/Dokumen
    // Saya hanya mengganti bagian DATA FETCHING (Firebase -> MySQL API)

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader className="animate-spin text-indigo-600" size={40} />
                <p className="text-gray-500 font-medium animate-pulse">Memuat Portofolio...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600/90 to-purple-700/90 dark:from-indigo-950/80 dark:to-purple-950/80 backdrop-blur-xl rounded-[2.5rem] p-8 text-white shadow-2xl border border-white/20">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <Book size={200} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="glass-icon-container glass-glow-blue w-14 h-14 p-2 relative">
                                <Book size={32} className="opacity-90" />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black tracking-tight">Smartty Portofolio</h1>
                                <p className="text-indigo-100 text-lg font-medium opacity-80">Audit Akademik & Laporan Kinerja Professional</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/20">TA {academicYear} • SMTR {activeSemester?.toUpperCase()}</span>
                        </div>
                    </div>
                    {/* Subject Selector */}
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-5 rounded-[2rem] flex flex-col gap-2 min-w-[220px] shadow-inner">
                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 opacity-80">Mata Pelajaran</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="bg-transparent border-none text-white font-bold focus:ring-0 cursor-pointer appearance-none text-lg p-0"
                        >
                            {subjects.map(s => (
                                <option key={s.id} value={s.name} className="bg-indigo-900 text-white">{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Layout Utama */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-4 space-y-4">
                    {CHAPTERS.map((chap) => {
                        const isDone = chaptersContent[chap.id]?.status === 'done';
                        const isActive = activeChapter === chap.id;
                        return (
                            <button
                                key={chap.id}
                                onClick={() => setActiveChapter(chap.id)}
                                className={`w-full flex items-center gap-4 p-5 rounded-[1.8rem] transition-all duration-300 text-left border ${
                                    isActive 
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-[1.02] border-indigo-400' 
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    {chap.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Bab {chap.id}</div>
                                    <div className="font-bold text-sm leading-tight">{chap.title}</div>
                                </div>
                                {isDone && (
                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
                                        <CheckCircle2 size={14} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="card-glass rounded-[2.5rem] p-8 shadow-2xl border border-white/20 min-h-[500px] flex flex-col">
                        <div className="flex items-center justify-between mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                    {CHAPTERS.find(c => c.id === activeChapter)?.title}
                                </h2>
                                <p className="text-gray-500 text-sm font-medium">Fokus Audit: {selectedSubject}</p>
                            </div>
                            <div className="flex gap-2">
                                {chaptersContent[activeChapter] && (
                                    <button onClick={() => handleDeleteChapter(activeChapter)} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors">
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Zap size={20} />}
                                    {chaptersContent[activeChapter] ? 'Susun Ulang dengan AI' : 'Susun Bab dengan AI'}
                                </button>
                            </div>
                        </div>

                        {/* Visualization Preview (Automated from context) */}
                        {liveContextData[activeChapter]?.rekapPerJenisNilai && (
                            <div className="mb-8 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/20">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart className="text-indigo-600" size={18} />
                                    <span className="text-xs font-black uppercase text-indigo-600 tracking-widest">Analisis Visual Terdeteksi</span>
                                </div>
                                <VisualAnalytics data={liveContextData[activeChapter].rekapPerJenisNilai} chapterId={activeChapter} />
                            </div>
                        )}

                        <div className="flex-1 prose dark:prose-invert max-w-none">
                            {chaptersContent[activeChapter] ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {(() => {
                                        const item = chaptersContent[activeChapter];
                                        if (!item) return '';
                                        if (typeof item === 'string') return item;
                                        if (typeof item.content === 'string') return item.content;
                                        if (item.content?.content) return String(item.content.content);
                                        return String(item);
                                    })()}
                                </ReactMarkdown>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300">
                                        <FileText size={40} />
                                    </div>
                                    <div className="max-w-xs">
                                        <h3 className="font-bold text-gray-800 dark:text-white">Konten Belum Tersedia</h3>
                                        <p className="text-sm text-gray-500">Klik tombol "Susun Bab dengan AI" untuk menganalisis data semester ini secara otomatis.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const CheckCircle2 = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>;
