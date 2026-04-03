import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../utils/SettingsContext';
import api from '../lib/axios';
import {
    BrainCircuit, FileText, Save, Download, Sliders, RefreshCw,
    CheckSquare, List, Type, ToggleLeft, AlignLeft, Grid, Table, Upload, Image as ImageIcon,
    History, Trash2, ChevronRight, Loader2, MapPin, Sparkles, AlertTriangle, Key, ExternalLink,
    Hash, ArrowDownUp, ChevronUp, ChevronDown
} from 'lucide-react';
import StyledSelect from '../components/StyledSelect';
import BSKAP_DATA from '../utils/bskap_2025_intel.json';
import { asBlob } from 'html-docx-js-typescript';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';
import Modal from '../components/Modal';

const QuizGeneratorPage = () => {
    const { activeSemester, academicYear, geminiModel } = useSettings();
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ stage: '', message: '', percentage: 0 });

    // Context State
    const [sourceType, setSourceType] = useState('rpp'); // 'rpp', 'promes', 'manual', 'image'
    const [sourceData, setSourceData] = useState([]);
    const [selectedContextId, setSelectedContextId] = useState('');
    const [contextContent, setContextContent] = useState('');

    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const [subject, setSubject] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [topic, setTopic] = useState('');

    // Configuration State
    const [numQuestions, setNumQuestions] = useState(10);
    const [difficulty, setDifficulty] = useState(50); // 0-100
    // Determine HOTS/LOTS ration
    const cognitiveLevel = difficulty > 70
        ? `${BSKAP_DATA.standards.cognitive_levels[2].id}: ${BSKAP_DATA.standards.cognitive_levels[2].level} (${BSKAP_DATA.standards.cognitive_levels[2].description})`
        : difficulty > 30
            ? `${BSKAP_DATA.standards.cognitive_levels[1].id}: ${BSKAP_DATA.standards.cognitive_levels[1].level} (${BSKAP_DATA.standards.cognitive_levels[1].description})`
            : `${BSKAP_DATA.standards.cognitive_levels[0].id}: ${BSKAP_DATA.standards.cognitive_levels[0].level} (${BSKAP_DATA.standards.cognitive_levels[0].description})`;
    const [typeCounts, setTypeCounts] = useState({ pg: 10 }); // { pg: 10, true_false: 5, ... }

    // Result State
    const [quizResult, setQuizResult] = useState(null);
    const [savedQuizzes, setSavedQuizzes] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [userProfile, setUserProfile] = useState({ name: '', school: '', nip: '', principalName: '', principalNip: '' });
    const [signingLocation, setSigningLocation] = useState('Jakarta');
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', type: '' });


    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teacherProfile, setTeacherProfile] = useState(null);

    // Load saved location on mount
    useEffect(() => {
        const savedLoc = localStorage.getItem('QUIZ_SIGNING_LOCATION');
        if (savedLoc) setSigningLocation(savedLoc);

        const fetchMasters = async () => {
            try {
                const [classesRes, subjectsRes, userRes, teacherRes] = await Promise.all([
                    api.get('/classes'),
                    api.get('/subjects'),
                    api.get('/me'),
                    api.get('/teachers').catch(() => ({ data: { data: [] } }))
                ]);

                const classesData = classesRes.data.data || classesRes.data || [];
                const subjectsData = subjectsRes.data.data || subjectsRes.data || [];
                const userData = userRes.data;
                const teachers = teacherRes.data.data || teacherRes.data || [];
                const currentTeacher = teachers.find(t => t.auth_user_id === userData.id);

                // Backend already filters based on role and assignments
                const filteredClasses = classesData.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || ''));
                
                let finalSubjects = subjectsData;
                if (userData.role === 'teacher' && currentTeacher?.assignments?.length > 0) {
                    const assignedSubjectIds = new Set(currentTeacher.assignments.map(a => a.subject_id));
                    finalSubjects = subjectsData.filter(s => assignedSubjectIds.has(s.id));
                }

                const filteredSubjects = finalSubjects
                    .map(s => ({ id: String(s.id), ...s }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                setClasses(filteredClasses);
                setSubjects(filteredSubjects);
                setTeacherProfile(currentTeacher);
                setUserProfile({
                    name: userData.name || '',
                    school: userData.school || '',
                    nip: userData.nip || '',
                    principalName: userData.principal_name || '',
                    principalNip: userData.principal_nip || ''
                });

            } catch (error) {
                console.error("Error fetching masters:", error);
                toast.error("Gagal memuat data master");
            }
        };
        fetchMasters();
    }, []);

    // Helper to get filtered levels based on selected subject
    const availableLevels = useMemo(() => {
        if (!subject || !teacherProfile?.assignments) {
            return [...new Set(classes.map(c => c.level).filter(Boolean))].sort((a, b) => {
                const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
                const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
                return numA - numB;
            });
        }

        const selectedSubName = subject.trim().toLowerCase();
        const subjectObj = subjects.find(s => s.name.trim().toLowerCase() === selectedSubName);
        const subjectId = subjectObj?.id;

        const assignedClassIds = new Set(
            teacherProfile.assignments
                .filter(a => String(a.subject_id) === String(subjectId))
                .map(a => a.class_id)
        );

        const filtered = classes.filter(c => assignedClassIds.has(c.id));
        
        // If teacher teaches this subject but maybe classes list hasn't caught up, 
        // fallback to all levels teaching that subject
        if (filtered.length === 0) {
             return [...new Set(classes.map(c => c.level).filter(Boolean))].sort((a, b) => {
                const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
                const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
                return numA - numB;
            });
        }

        return [...new Set(filtered.map(c => c.level).filter(Boolean))].sort((a, b) => {
            const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    }, [classes, subject, teacherProfile, subjects]);

    const QUESTION_TYPES = [
        ...BSKAP_DATA.standards.assessment_item_types,
        { id: 'pg_matrix', name: 'PG Kompleks Tabel' },
        { id: 'sequencing', name: 'Urutan' }
    ].map(t => {
        const simplifiedDescriptions = {
            'pg': 'Pilihan ganda',
            'pg_complex': 'Pilihan ganda lebih dari 1',
            'pg_matrix': 'PG Kompleks (Tabel/Matrix)',
            'matching': 'Menjodohkan',
            'true_false': 'Benar salah',
            'short_answer': 'Isian singkat',
            'sequencing': 'Mengurutkan',
            'essay': 'Essay',
            'uraian': 'Uraian'
        };
        return {
            id: t.id,
            label: t.id === 'pg_matrix' ? 'PG Kompleks Tabel' : t.name,
            description: simplifiedDescriptions[t.id] || t.description,
            icon: t.id === 'pg' ? <List size={16} /> :
                t.id === 'pg_complex' ? <CheckSquare size={16} /> :
                    t.id === 'pg_matrix' ? <Table size={16} /> :
                        t.id === 'matching' ? <Grid size={16} /> :
                            t.id === 'true_false' ? <ToggleLeft size={16} /> :
                                t.id === 'short_answer' ? <Hash size={16} /> :
                                    t.id === 'sequencing' ? <ArrowDownUp size={16} /> :
                                        t.id === 'essay' ? <Type size={16} /> :
                                            t.id === 'uraian' ? <AlignLeft size={16} /> : <FileText size={16} />
        };
    });

    const formatAnswer = (q) => {
        if (!q) return '-';

        switch (q.type) {
            case 'pg':
                return q.answer || '-';
            case 'pg_complex':
                return Array.isArray(q.answer) ? q.answer.join(', ') : (q.answer || '-');
            case 'matching':
                if (q.pairs && q.pairs.length > 0) {
                    return q.pairs.map((p, i) => {
                        // Find index of right item to get B/C label
                        const rIdx = q.right_side ? q.right_side.indexOf(p.right) : -1;
                        const label = rIdx !== -1 ? String.fromCharCode(65 + rIdx) : p.right;
                        return `${i + 1}-${label}`;
                    }).join(', ');
                }
                return '-';
            case 'pg_matrix':
                if (Array.isArray(q.answer)) {
                    return q.answer.map(ans => `${ans.row}: ${ans.column}`).join('; ');
                }
                return '-';
            case 'true_false':
                if (q.statements && q.statements.length > 0) {
                    return q.statements.map((s, i) => `${i + 1}-${s.isCorrect ? 'B' : 'S'}`).join(', ');
                }
                return '-';
            case 'sequencing':
                if (q.correct_order && Array.isArray(q.correct_order)) {
                    return q.correct_order.join(' → ');
                }
                return '-';
            case 'short_answer':
                return q.answer || '-';
            default:
                return q.answer || '-';
        }
    };

    // Fetch Sources & Reset selection only for document-specific states
    useEffect(() => {
        // Only reset selection and specific content when Source Type changes
        // Keep subject, gradeLevel and topic to avoid losing context
        setSelectedContextId('');
        // Keep contextContent if it was manually entered
        if (sourceType !== 'manual') {
            setContextContent('');
        }

        const fetchSources = async () => {
            setLoading(true);
            try {
                // TODO: Add backend endpoints for fetching RPP/Promes specifically for source selection
                // For now we might need to rely on what endpoints we have
                let data = [];
                if (sourceType === 'rpp') {
                    const response = await api.get('/ai/rpp-history');
                    data = response.data.data || response.data || [];
                } else if (sourceType === 'promes') {
                    const response = await api.get('/teaching-programs'); // Need full list?
                    data = response.data.data || response.data || [];
                }

                if (data && data.length > 0) {
                    // Normalize data fields for frontend
                    const normalizedData = data.map(item => ({
                        ...item,
                        gradeLevel: item.grade_level || item.gradeLevel || item.grade || '',
                        topic: item.topic || item.materi || ''
                    }));

                    // Sort by gradeLevel then materi/subject
                    normalizedData.sort((a, b) => {
                        const gradeA = String(a.gradeLevel);
                        const gradeB = String(b.gradeLevel);
                        const gradeComp = gradeA.localeCompare(gradeB);
                        if (gradeComp !== 0) return gradeComp;

                        const labelA = String(a.topic || a.subject || '');
                        const labelB = String(b.topic || b.subject || '');
                        return labelA.localeCompare(labelB);
                    });
                    setSourceData(normalizedData);
                } else {
                    setSourceData([]);
                }
            } catch (error) {
                console.error("Error fetching sources:", error);
                toast.error("Gagal memuat sumber data");
            } finally {
                setLoading(false);
            }
        };
        fetchSources();
    }, [sourceType]);

    // Fetch Quiz History
    const fetchQuizHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await api.get('/ai/quiz-history');
            const quizzes = response.data.data || response.data || [];

            // Map backend fields to frontend expected fields if necessary
            // Backend returns: id, subject, grade_level, topic, quiz_data
            // Frontend expects: id, subject, gradeLevel, topic, quiz (inside it the content)

            const formattedQuizzes = quizzes.map(q => ({
                id: q.id,
                subject: q.subject,
                gradeLevel: q.grade_level,
                topic: q.topic,
                quiz: q.quiz_data || q.quiz,
                createdAt: q.created_at,
                // Add any other fields if needed
            }));

            setSavedQuizzes(formattedQuizzes);
        } catch (error) {
            console.error("Error fetching quiz history:", error);
            // toast.error("Gagal memuat riwayat kuis"); // Optional: don't spam if fails silently
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchQuizHistory();
    }, []);

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Browser tidak mendukung geolokasi.");
            return;
        }

        setDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();

                    const city = data.address.city || data.address.town || data.address.regency || data.address.county || 'Lokasi Terdeteksi';
                    setSigningLocation(city);
                    localStorage.setItem('QUIZ_SIGNING_LOCATION', city);
                    toast.success(`Lokasi terdeteksi: ${city}`);
                } catch (error) {
                    console.error("Error detecting location:", error);
                    toast.error("Gagal mendeteksi nama kota.");
                } finally {
                    setDetectingLocation(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                if (error.code === 1) {
                    toast.error("Izin lokasi ditolak. Mohon izinkan akses lokasi di pengaturan browser.");
                } else if (error.code === 2) {
                    toast.error("Posisi tidak tersedia. Pastikan GPS aktif.");
                } else if (error.code === 3) {
                    toast.error("Waktu permintaan habis. Coba lagi.");
                } else {
                    toast.error("Gagal mendapatkan lokasi. Terjadi kesalahan.");
                }
                setDetectingLocation(false);
            }
        );
    };

    // Helper to strip administrative boilerplate to save tokens
    const cleanAdministrativeBoilerplate = (text) => {
        if (!text) return "";
        let cleaned = text;

        // 1. Remove common administrative headers/metadata lines
        const patternsToStrip = [
            /NIP\s*:\s*.*/gi,
            /Nama Sekolah\s*:\s*.*/gi,
            /Alokasi Waktu\s*:\s*.*/gi,
            /Tahun Pelajaran\s*:\s*.*/gi,
            /Modul Ajar\s*:.*/gi,
            /Kurikulum\s*:.*/gi,
            /Semester\s*:.*/gi,
            /Model Pembelajaran\s*:.*/gi,
            /Metode Pembelajaran\s*:.*/gi,
            /Media Pembelajaran\s*:.*/gi,
            /Bahan\s*&\s*Alat\s*:.*/gi,
            /Sumber Belajar\s*:.*/gi,
            /Profil Pelajar Pancasila\s*:.*/gi,
            /Sarana\s*&\s*Prasarana\s*:.*/gi,
            /Target Peserta Didik\s*:.*/gi
        ];

        patternsToStrip.forEach(pattern => {
            cleaned = cleaned.replace(pattern, "");
        });

        // 2. Remove redundant whitespace and lines
        cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').trim();

        return cleaned;
    };

    // Handle Source Selection
    const handleSourceChange = (id) => {
        setSelectedContextId(id);
        const selected = sourceData.find(d => String(d.id) === String(id));
        if (selected) {
            setSubject(selected.subject || '');
            setGradeLevel(selected.grade_level || selected.gradeLevel || selected.grade || '');

            if (sourceType === 'rpp') {
                setTopic(selected.materi || selected.topic || '');

                // SMART PARSING: Extract specific "meat" sections based on standard RPP format
                const content = selected.content || '';
                let extractedText = "";

                // 2. Ambil Materi Ajar Mendetail (Biasanya di Lampiran) - PRIORITAS UTAMA
                const materialMatch = content.match(/(MATERI AJAR MENDETAIL|URAIAN MATERI|MATERI PEMBELAJARAN)[\s\S]*?(?=(##|###|GLOSARIUM))/i);
                if (materialMatch) {
                    let cleanMat = materialMatch[0].replace(/(MATERI AJAR MENDETAIL|URAIAN MATERI|MATERI PEMBELAJARAN)/i, "").trim();
                    extractedText += "1. RINGKASAN MATERI (SUMBER UTAMA SOAL):\n" + cleanMat + "\n\n";
                }

                // 3. Ambil Tujuan Pembelajaran (TP)
                const tpMatch = content.match(/Tujuan Pembelajaran[\s\S]*?(?=(##|\n\n\n))/i);
                if (tpMatch) extractedText += "2. TUJUAN PEMBELAJARAN:\n" + tpMatch[0].replace(/Tujuan Pembelajaran.*:/i, "").trim() + "\n\n";

                // 4. Ambil Langkah Pembelajaran HANYA jika Materi Ajar tidak ditemukan (sebagai fallback penunjang)
                if (!materialMatch) {
                    const stepsMatch = content.match(/(##|###)\s*III\.\s*LANGKAH-LANGKAH PEMBELAJARAN[\s\S]*?(?=(##\s*IV|##\s*V))/i);
                    if (stepsMatch) {
                        extractedText += "3. REFERENSI KEGIATAN (Hanya untuk inspirasi konteks):\n" + stepsMatch[0].replace(/##.*LANGKAH.*/i, "").trim() + "\n\n";
                    }
                }

                // Fallback jika regex gagal (misal format beda), ambil 2000 karakter tengah
                if (extractedText.length < 50) {
                    const startIdx = content.search(/##\s*COMPETENCY|##\s*KOMPETENSI|##\s*II/i);
                    if (startIdx !== -1) {
                        extractedText = content.substring(startIdx, startIdx + 2500) + "...";
                    } else {
                        extractedText = content.substring(0, 2000) + "..."; // Last resort
                    }
                }

                setContextContent(`(RANGKUMAN MATERI BERSIH)\n\n${cleanAdministrativeBoilerplate(extractedText).substring(0, 3000)}`); // Cleaned and Limited
            } else if (sourceType === 'promes') {
                setContextContent(JSON.stringify(selected.prota || []));
            }
        }
    };

    const updateTypeCount = (typeId, count) => {
        const numCount = parseInt(count) || 0;
        setTypeCounts(prev => {
            const updated = { ...prev };

            // Calculate total WITHOUT the current type being updated
            const otherTotal = Object.entries(prev)
                .filter(([id]) => id !== typeId)
                .reduce((sum, [_, c]) => sum + c, 0);

            if (numCount > 0) {
                // If adding this would exceed 20, cap it
                if (otherTotal + numCount > 20) {
                    const allowed = 20 - otherTotal;
                    if (allowed <= 0) {
                        toast.error("Batas maksimal adalah 20 soal.");
                        return prev;
                    }
                    toast.error(`Jumlah soal dibatasi maksimal 20. Otomatis disesuaikan ke ${allowed}.`);
                    updated[typeId] = allowed;
                } else {
                    updated[typeId] = numCount;
                }
            } else {
                delete updated[typeId];
            }
            return updated;
        });
    };

    const handleGenerate = async () => {
        if (!subject || !gradeLevel || !topic) {
            toast.error("Mohon lengkapi Data Mapel, Kelas, dan Topik");
            return;
        }

        const totalRequested = Object.values(typeCounts).reduce((sum, c) => sum + c, 0);
        if (sourceType !== 'image' && totalRequested === 0) {
            toast.error("Tentukan minimal 1 tipe soal dengan jumlah > 0");
            return;
        }

        if (totalRequested > 20) {
            toast.error("Maksimal pembuatan adalah 20 soal dalam satu kali proses.");
            return;
        }

        setGenerating(true);
        setGenerationProgress({ stage: 'starting', message: 'Memulai kuis generator...', percentage: 0 });
        setQuizResult(null);

        try {
            // --- BATCHING LOGIC ---
            // Create a flat list of all requested question types
            const flatRequestList = [];
            Object.entries(typeCounts).forEach(([type, count]) => {
                for (let i = 0; i < count; i++) {
                    flatRequestList.push(type);
                }
            });

            // Split into batches of 3
            const batchSize = 3;
            const batches = [];
            for (let i = 0; i < flatRequestList.length; i += batchSize) {
                batches.push(flatRequestList.slice(i, i + batchSize));
            }

            let allQuestions = [];
            const totalBatches = batches.length;

            for (let bIdx = 0; bIdx < totalBatches; bIdx++) {
                const currentBatchTypes = batches[bIdx];
                
                // Construct typeCounts for this specific batch
                const batchTypeCounts = {};
                currentBatchTypes.forEach(t => {
                    batchTypeCounts[t] = (batchTypeCounts[t] || 0) + 1;
                });

                const currentPercentage = Math.round((bIdx / totalBatches) * 100);
                setGenerationProgress({ 
                    stage: 'generating', 
                    message: `Memproses Batch ${bIdx + 1} dari ${totalBatches} (${currentBatchTypes.length} soal)...`, 
                    percentage: currentPercentage 
                });

                const response = await api.post('/ai/generate-quiz', {
                    topic,
                    context: contextContent,
                    gradeLevel,
                    subject,
                    typeCounts: batchTypeCounts,
                    difficulty,
                    modelName: geminiModel,
                    batchNum: bIdx + 1,
                    totalBatches: totalBatches,
                    allQuestions: allQuestions.map(q => ({ pedagogical_materi: q.pedagogical_materi })) // Context for AI to avoid duplicates
                });

                const rawData = response.data;
                let batchResult;
                
                if (rawData.data) {
                    batchResult = rawData.data;
                } else if (rawData.content && typeof rawData.content === 'object') {
                    batchResult = rawData.content;
                } else {
                    batchResult = rawData;
                }

                // Extract questions from this batch
                let batchQuestions = [];
                if (batchResult && Array.isArray(batchResult.questions)) {
                    batchQuestions = batchResult.questions;
                } else if (Array.isArray(batchResult)) {
                    batchQuestions = batchResult;
                }

                if (batchQuestions.length > 0) {
                    allQuestions = [...allQuestions, ...batchQuestions];
                } else {
                    console.warn(`Batch ${bIdx + 1} did not return questions:`, batchResult);
                }
            }

            if (allQuestions.length > 0) {
                setQuizResult({
                    title: topic,
                    questions: allQuestions
                });
                setGenerationProgress({ stage: 'complete', message: 'Kuis selesai dibuat!', percentage: 100 });
                toast.success(`Berhasil membuat ${allQuestions.length} soal!`);
            } else {
                throw new Error("Gagal mendapatkan soal dari semua batch.");
            }

        } catch (error) {
            console.error("Quiz generation failed:", error);
            const errorMsg = error.response?.data?.error || error.message || "";

            setErrorModal({
                isOpen: true,
                title: "Gagal Membuat Soal",
                message: errorMsg,
                type: 'generic'
            });
            toast.error("Gagal membuat soal.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveQuiz = async () => {
        if (!quizResult) return;
        setIsSaving(true);
        try {
            await api.post('/ai/save-quiz', {
                subject: subject || 'Umum',
                gradeLevel: gradeLevel || 'Umum',
                topic: topic || 'Kuis Baru',
                quiz: quizResult,
                academicYear: academicYear || '',
                context_semester: activeSemester || ''
            });

            toast.success("Kuis berhasil disimpan!");
            fetchQuizHistory();
        } catch (error) {
            console.error("Error saving quiz:", error);
            const msg = error.response?.data?.error || "Gagal menyimpan kuis";
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteQuiz = (e, id) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Kuis',
            message: 'Apakah Anda yakin ingin menghapus kuis ini dari riwayat?',
            onConfirm: async () => {
                try {
                    await api.delete(`/ai/quiz-history/${id}`);
                    toast.success("Kuis dihapus");
                    fetchQuizHistory();
                    if (quizResult?.id === id) setQuizResult(null);
                } catch (error) {
                    toast.error("Gagal menghapus kuis");
                    console.error(error);
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };



    const exportWord = async () => {
        if (!quizResult) return;

        let html = `
            <h1>${quizResult.title || 'Soal Ujian'}</h1>
            <p><strong>Mapel:</strong> ${subject || '-'} | <strong>Kelas:</strong> ${gradeLevel || '-'}</p>
            <p><strong>Topik:</strong> ${topic || '-'}</p>
            <hr/>
        `;

        quizResult.questions.forEach((q, idx) => {
            html += `<div style="margin-bottom: 20px;">`;

            // CONSOLIDATED STIMULUS & QUESTION (SINGLE PARAGRAPH)
            let combinedText = '';
            if (q.stimulus) {
                combinedText += `${q.stimulus.replace(/\n/g, '<br/>')}<br/><br/>`;
            }
            if (q.image_hint) {
                combinedText += `<div style="background-color: #f0f7ff; color: #1e40af; border: 1px dashed #34d399; padding: 10px; margin-bottom: 10px; text-align: center; font-style: italic;">${q.image_hint}</div>`;
            }
            combinedText += q.question;

            html += `<p><strong>${idx + 1}.</strong> ${combinedText}</p>`;

            if (q.type === 'pg' || q.type === 'pg_complex') {
                html += '<ul>';
                q.options.forEach((opt, oIdx) => {
                    html += `<li>${String.fromCharCode(65 + oIdx)}. ${opt}</li>`;
                });
                html += '</ul>';
            } else if (q.type === 'pg_matrix') {
                html += '<table border="1" style="border-collapse: collapse; width: 100%; margin-top: 10px;">';
                html += '<tr style="background-color: #f3f4f6;">';
                html += '<th style="border: 1px solid #000; padding: 5px;">Pernyataan</th>';
                q.columns.forEach(col => {
                    html += `<th style="border: 1px solid #000; padding: 5px; text-align: center;">${col}</th>`;
                });
                html += '</tr>';
                q.rows.forEach(row => {
                    html += '<tr>';
                    html += `<td style="border: 1px solid #000; padding: 5px;">${row}</td>`;
                    q.columns.forEach(() => {
                        html += '<td style="border: 1px solid #000; padding: 5px; text-align: center;">[ ]</td>';
                    });
                    html += '</tr>';
                });
                html += '</table>';
            } else if (q.type === 'matching') {
                html += `<table style="width:100%; border:none;"><tr>`;
                html += `<td style="vertical-align:top; width:45%;">`;
                q.left_side.forEach((l, i) => html += `<p>${i + 1}. ${l}</p>`);
                html += `</td><td style="width:10%;"></td><td style="vertical-align:top; width:45%;">`;
                q.right_side.forEach((r, i) => html += `<p>${String.fromCharCode(65 + i)}. ${r}</p>`);
                html += `</td></tr></table>`;
            } else if (q.type === 'true_false') {
                html += `<table border="1" style="border-collapse:collapse; width:100%;"><tr><th>Pernyataan</th><th>Benar</th><th>Salah</th></tr>`;
                q.statements.forEach(s => {
                    html += `<tr><td>${s.text}</td><td style="text-align:center;"></td><td style="text-align:center;"></td></tr>`;
                });
                html += `</table>`;
            } else if (q.type === 'short_answer') {
                html += `<p style="margin-left: 10px; border-bottom: 1px dotted #ccc; width: 300px; padding-bottom: 5px; color: #888;">Jawab: ............................................................</p>`;
            } else if (q.type === 'sequencing' && q.items) {
                html += `<ul style="list-style-type: decimal;">`;
                q.items.forEach(item => {
                    html += `<li style="margin-bottom: 5px;">${item}</li>`;
                });
                html += `</ul>`;
            }
            html += `</div>`;
        });

        html += `<br/><br/><hr/><h3>Kunci Jawaban</h3>`;
        quizResult.questions.forEach((q, idx) => {
            html += `<p><strong>${idx + 1}.</strong> ${formatAnswer(q)} (${q.type})</p>`;
        });

        try {
            const blob = await asBlob(html);
            saveAs(blob, `Soal-${topic}-${gradeLevel}.docx`);
            toast.success("Download Word Berhasil");
        } catch (e) {
            console.error(e);
            toast.error("Gagal export Word");
        }
    };

    const exportPDF = async () => {
        if (!quizResult) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPos = 20;

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(quizResult.title || 'Soal Ujian', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Mapel: ${subject || userProfile.school || '-'} | Kelas: ${gradeLevel || '-'} | Topik: ${topic || '-'}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 10;

        for (let idx = 0; idx < quizResult.questions.length; idx++) {
            const el = document.getElementById(`quiz-question-${idx}`);
            if (el) {
                try {
                    const canvas = await html2canvas(el, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = pageWidth - 40;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    if (yPos + imgHeight > pageHeight - 20) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.addImage(imgData, 'PNG', 20, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 10;
                } catch (e) {
                    console.error("Failed to capture question", idx, e);
                    // Fallback to text if capture fails (not ideal for math but better than nothing)
                    doc.text(`${idx + 1}. [Gagal memuat visual soal]`, 20, yPos);
                    yPos += 10;
                }
            }
        }

        doc.addPage();
        yPos = 20;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Kunci Jawaban', 20, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        quizResult.questions.forEach((q, idx) => {
            if (yPos > 280) { doc.addPage(); yPos = 20; }
            doc.text(`${idx + 1}. ${formatAnswer(q)} (${q.type})`, 20, yPos);
            yPos += 6;
        });

        doc.save(`Soal-${(topic || 'Kuis').replace(/\s+/g, '_')}-${gradeLevel || 'Global'}.pdf`);
        toast.success("Download PDF Berhasil");
    };

    const exportKartuSoalPDF = () => {
        if (!quizResult) return;

        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        quizResult.questions.forEach((q, idx) => {
            if (idx > 0) doc.addPage('a4', 'l');
            let currentY = 15;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("KARTU SOAL", pageWidth / 2, currentY, { align: 'center' });
            currentY += 10;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const schLabel = userProfile.school.includes('SMA') ? 'SMA' : userProfile.school.includes('SMP') ? 'SMP' : 'SD';
            const metadata = [
                [`Jenis Sekolah : ${schLabel}`, `Kurikulum : Merdeka`, `Nama Penyusun : ${userProfile.name || '-'}`],
                [`Bahan Kelas : ${gradeLevel || '-'}`, `Mata Pelajaran : ${subject || '-'}`, `Unit Kerja : ${userProfile.school || '-'}`],
                [`Program Studi : -`, ``, ``]
            ];
            const colW = (pageWidth - 30) / 3;
            metadata.forEach((row, rIdx) => {
                doc.text(row[0], 15, currentY + (rIdx * 5));
                doc.text(row[1], 15 + colW, currentY + (rIdx * 5));
                doc.text(row[2], 15 + (colW * 2), currentY + (rIdx * 5));
            });
            currentY += 18;

            const tableW = pageWidth - 30;

            // Build question content with stimulus and question (CONSOLIDATED)
            let questionContent = '';

            if (q.stimulus && q.stimulus.trim() !== '' && !q.stimulus.includes('Lihat stimulus')) {
                const cleanStimulus = q.stimulus.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                questionContent += `${cleanStimulus}\n\n`;
            }

            const cleanQuestion = q.question.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (q.image_hint) {
                questionContent += `\n[INSTRUKSI GAMBAR: ${q.image_hint}]\n\n`;
            }
            questionContent += cleanQuestion;

            // Add options for PG types
            if ((q.type === 'pg' || q.type === 'pg_complex') && q.options && q.options.length > 0) {
                questionContent += '\n\nOPSI JAWABAN:\n';
                q.options.forEach((opt, oIdx) => {
                    let cleanOpt = opt.replace(/<[^>]*>/g, ' ').trim();
                    // Remove existing label if present
                    const labelRegex = new RegExp(`^${String.fromCharCode(65 + oIdx)}[.\\)]\\s*`, 'i');
                    cleanOpt = cleanOpt.replace(labelRegex, '');
                    questionContent += `${String.fromCharCode(65 + oIdx)}. ${cleanOpt}\n`;
                });
            }

            // Add matching pairs
            if (q.type === 'matching' && q.left_side && q.right_side) {
                questionContent += '\n\nKOLOM KIRI:\n';
                q.left_side.forEach((l, i) => questionContent += `${i + 1}. ${l}\n`);
                questionContent += '\nKOLOM KANAN:\n';
                q.right_side.forEach((r, i) => questionContent += `${String.fromCharCode(65 + i)}. ${r}\n`);
            }

            // Add true/false statements
            if (q.type === 'true_false' && q.statements && q.statements.length > 0) {
                questionContent += '\n\nPERNYATAAN:\n';
                q.statements.forEach((s, i) => questionContent += `${i + 1}. ${s.text}\n`);
            }

            // Add pg_matrix (Table-based)
            if (q.type === 'pg_matrix' && q.rows && q.columns) {
                questionContent += '\n\nPERNYATAAN (TABEL):\n';
                q.rows.forEach((row, rIdx) => {
                    questionContent += `${rIdx + 1}. ${row}\n`;
                });
                questionContent += '\nOPSI KATEGORI:\n';
                q.columns.forEach((col, cIdx) => {
                    questionContent += `${String.fromCharCode(65 + cIdx)}. ${col}\n`;
                });
            }

            autoTable(doc, {
                startY: currentY,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 60 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 'auto' }
                },
                body: [
                    [
                        { content: 'Kompetensi yang diuji', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                        { content: 'Buku Sumber :', styles: { fontStyle: 'bold' } },
                        { content: 'DETAIL SOAL', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }
                    ],
                    [
                        { content: q.competency || '-', rowSpan: 2 },
                        { content: 'No. Soal', styles: { fillColor: [240, 240, 240], halign: 'center', fontStyle: 'bold' } },
                        { content: questionContent, rowSpan: 5, styles: { valign: 'top', fontSize: 9 } }
                    ],
                    [
                        { content: String(idx + 1), styles: { halign: 'center', fontSize: 13, fontStyle: 'bold', minCellHeight: 15 } }
                    ],
                    [
                        { content: 'Materi', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                        { content: 'Kunci Jawaban', styles: { fillColor: [240, 240, 240], halign: 'center', fontStyle: 'bold' } }
                    ],
                    [
                        { content: q.pedagogical_materi || topic || '-', minCellHeight: 10 },
                        { content: formatAnswer(q), styles: { halign: 'center', fontStyle: 'bold', fontSize: 10 } }
                    ],
                    [
                        { content: 'Indikator Soal', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }, colSpan: 2 }
                    ],
                    [
                        { content: q.indicator || '-', colSpan: 2, styles: { minCellHeight: 25, verticalAlign: 'top' } }
                    ]
                ],
                margin: { left: 15, right: 15, bottom: 10 },
                pageBreak: 'avoid'
            });
        });


        // Add Signature (Kartu Soal usually per page, but we add a summary signature at the end or on last page)
        // Since Kartu Soal is "one card per page", a signature might be redundant on every page, 
        // but often requested on the last page or a cover. Let's add it to the last page.

        const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // Check if enough space on current page, else add new
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 200;
        if (finalY > 150) doc.addPage();

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const sigY = finalY > 150 ? 30 : finalY + 20;

        doc.text(`Mengetahui,`, 20, sigY);
        doc.text(`Kepala Sekolah`, 20, sigY + 5);
        doc.text(`( ${userProfile.principalName || '.......................'} )`, 20, sigY + 25);
        doc.text(`NIP. ${userProfile.principalNip || '-'}`, 20, sigY + 30);

        doc.text(`${signingLocation || 'Jakarta'}, ${dateStr}`, pageWidth - 60, sigY);
        doc.text('Guru Mata Pelajaran', pageWidth - 60, sigY + 5);
        doc.text(`( ${userProfile.name || '.......................'} )`, pageWidth - 60, sigY + 25);
        doc.text(`NIP. ${userProfile.nip || '-'}`, pageWidth - 60, sigY + 30);

        doc.save(`Kartu_Soal-${(topic || 'Kuis').replace(/\s+/g, '_')}.pdf`);
        toast.success("Kartu Soal PDF Berhasil");
    };

    const exportKartuSoalWord = async () => {
        if (!quizResult) return;

        let html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        @page {size: A4 landscape; margin: 1cm; mso-page-orientation: landscape;}
                        body {font-family: 'Times New Roman', serif; font-size: 11pt; }
                        table {width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                        th, td {border: 1px solid black; padding: 10px; vertical-align: top; word-wrap: break-word; }
                        .no-border, .no-border td {border: none !important; }
                        .bg-gray {background-color: #f3f4f6; }
                    </style>
                </head>
                <body>
        `;

        quizResult.questions.forEach((q, idx) => {
            html += `
                <div style="page-break-after: always;">
                    <h3 style="text-align:center;">KARTU SOAL</h3>
                    <table class="no-border">
                        <tr>
                            <td>Jenis Sekolah: ${userProfile.school}</td>
                            <td>Kurikulum: Merdeka</td>
                            <td>Penyusun: ${userProfile.name}</td>
                        </tr>
                        <tr>
                            <td>Kelas: ${gradeLevel}</td>
                            <td>Mapel: ${subject}</td>
                            <td>Unit: ${userProfile.school}</td>
                        </tr>
                    </table>
                    <table>
                        <tr class="bg-gray">
                            <td width="25%"><strong>Deskripsi Pedagogis</strong></td>
                            <td width="20%"><strong>No. Soal & Kunci</strong></td>
                            <td><strong>Rumusan Butir Soal</strong></td>
                        </tr>
                        <tr>
                            <td rowspan="3">
                                <strong>Kompetensi:</strong><br/>${q.competency || '-'}<br/><br/>
                                <strong>Materi:</strong><br/>${q.pedagogical_materi || topic || '-'}<br/><br/>
                                <strong>Indikator:</strong><br/>${q.indicator || '-'}<br/><br/>
                                <strong>Level:</strong> ${q.cognitive_level || '-'}
                            </td>
                            <td align="center" style="font-size:24pt;"><strong>${idx + 1}</strong></td>
                            <td rowspan="3">
                                ${(() => {
                    let html = '';
                    if (q.stimulus && q.stimulus.trim() !== '' && !q.stimulus.includes('Lihat stimulus')) {
                        html += `<div style="margin-bottom:10px; font-style:italic;">${q.stimulus}</div>`;
                    }
                    if (q.image_hint) {
                        html += `<div style="margin-bottom:10px; text-align:center; border:1px dashed #666; padding:10px; background:#f9f9f9;">${q.image_hint}</div>`;
                    }
                    html += `<div style="margin-bottom:10px;"><strong>${q.question}</strong></div>`;
                    if ((q.type === 'pg' || q.type === 'pg_complex') && q.options && q.options.length > 0) {
                        html += '<div><strong>OPSI JAWABAN:</strong><br/>';
                        q.options.forEach((opt, oIdx) => { html += `${String.fromCharCode(65 + oIdx)}. ${opt}<br/>`; });
                        html += '</div>';
                    }
                    if (q.type === 'matching' && q.left_side && q.right_side) {
                        html += '<div style="margin-top:10px;"><strong>KOLOM KIRI:</strong><br/>';
                        q.left_side.forEach((l, i) => html += `${i + 1}. ${l}<br/>`);
                        html += '<br/><strong>KOLOM KANAN:</strong><br/>';
                        q.right_side.forEach((r, i) => html += `${String.fromCharCode(65 + i)}. ${r}<br/>`);
                        html += '</div>';
                    }
                    if (q.type === 'true_false' && q.statements && q.statements.length > 0) {
                        html += '<div style="margin-top:10px;"><strong>PERNYATAAN:</strong><br/>';
                        q.statements.forEach((s, i) => html += `${i + 1}. ${s.text}<br/>`);
                        html += '</div>';
                    }
                    return html;
                })()}
                            </td>
                        </tr>
                        <tr class="bg-gray"><td align="center"><strong>Kunci</strong></td></tr>
                        <tr><td align="center"><strong>${formatAnswer(q)}</strong></td></tr>
                    </table>
                </div>
            `;
        });


        const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        html += `
            <br/>
            <div style="page-break-inside: avoid; display: flex; justify-content: space-between; margin-top: 30px; font-family: 'Times New Roman', serif;">
                <div style="float: left; width: 40%; text-align: center;">
                    <p>Mengetahui,<br/>Kepala Sekolah</p>
                    <br/><br/><br/>
                    <p>( ${userProfile.principalName || '.......................'} )<br/>NIP. ${userProfile.principalNip || '-'}</p>
                </div>
                <div style="float: right; width: 40%; text-align: center;">
                    <p>${signingLocation || 'Jakarta'}, ${dateStr}<br/>Guru Mata Pelajaran</p>
                    <br/><br/><br/>
                    <p>( ${userProfile.name || '.......................'} )<br/>NIP. ${userProfile.nip || '-'}</p>
                </div>
                <div style="clear: both;"></div>
            </div>
        `;

        html += `</body></html>`;

        try {
            const blob = await asBlob(html);
            saveAs(blob, `Kartu_Soal-${topic.replace(/\s+/g, '_')}.docx`);
            toast.success("Kartu Soal Word Berhasil");
        } catch (e) {
            console.error("Gagal export Word:", e);
            toast.error("Gagal export Kartu Soal");
        }
    };

    const exportKisiKisiPDF = () => {
        if (!quizResult) return;
        const doc = new jsPDF('landscape', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('KISI-KISI PENULISAN SOAL', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const startY = 25;

        doc.text(`Satuan Pendidikan : ${userProfile.school || '-'}`, 15, startY);
        doc.text(`Mata Pelajaran : ${subject || '-'}`, 15, startY + 5);
        doc.text(`Kurikulum : Merdeka`, 15, startY + 10);

        doc.text(`Kelas/Semester : ${gradeLevel || '-'}/${quizResult?.context_semester || activeSemester || '-'}`, pageWidth - 80, startY);
        doc.text(`Jumlah Soal : ${quizResult.questions.length}`, pageWidth - 80, startY + 5);
        doc.text(`Penyusun : ${userProfile.name || '-'}`, pageWidth - 80, startY + 10);

        const tableBody = quizResult.questions.map((q, idx) => [
            idx + 1,
            q.competency || '-',
            q.pedagogical_materi || topic || '-',
            `${gradeLevel || '-'}/${quizResult?.context_semester || activeSemester || '-'}`,
            q.indicator || '-',
            q.cognitive_level || 'L1/L2/L3',
            q.type.toUpperCase().replace('_', ' '),
            idx + 1
        ]);

        autoTable(doc, {
            startY: startY + 18,
            head: [['No', 'Kompetensi Dasar / CP', 'Materi', 'Kls/Sem', 'Indikator Soal', 'Lvl Kognitif', 'Bentuk Soal', 'No Soal']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 70 },
                2: { cellWidth: 55 },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 80 },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 20, halign: 'center' },
                7: { cellWidth: 12, halign: 'center' }
            },
            margin: { left: 15, right: 15 }
        });

        // Footer
        const finalY = doc.lastAutoTable.finalY + 15;
        if (finalY < 180) {
            const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            doc.text(`${signingLocation || 'Jakarta'}, ${dateStr}`, pageWidth - 50, finalY, { align: 'center' });
            doc.text('Guru Mata Pelajaran', pageWidth - 50, finalY + 5, { align: 'center' });
            doc.text(`( ${userProfile.name || '.......................'} )`, pageWidth - 50, finalY + 25, { align: 'center' });
            doc.text(`NIP. ${userProfile.nip || '-'}`, pageWidth - 50, finalY + 30, { align: 'center' });
        }

        doc.save(`Kisi-Kisi_${(topic || 'Kuis').replace(/\s+/g, '_')}.pdf`);
        toast.success("Kisi-kisi PDF berhasil didownload!");
    };

    const exportKisiKisiWord = async () => {
        if (!quizResult) return;
        const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        let html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        @page {size: A4 landscape; margin: 1cm; mso-page-orientation: landscape;}
                        body {font-family: 'Times New Roman', serif; }
                        table {width: 100%; border-collapse: collapse; }
                        th, td {border: 1px solid black; padding: 5px; vertical-align: top; }
                        th {background-color: #f0f0f0; font-weight: bold; text-align: center; }
                    </style>
                </head>
                <body>
                    <h3 style="text-align:center;">KISI-KISI PENULISAN SOAL</h3>
                    <div style="margin-bottom:20px;">
                        <table style="border:none;">
                            <tr style="border:none;"><td style="border:none;">Satuan Pendidikan: ${userProfile.school}</td><td style="border:none;">Kelas/Semester: ${gradeLevel}/${quizResult?.context_semester || activeSemester}</td></tr>
                            <tr style="border:none;"><td style="border:none;">Mata Pelajaran: ${subject}</td><td style="border:none;">Jumlah Soal: ${quizResult.questions.length}</td></tr>
                            <tr style="border:none;"><td style="border:none;">Kurikulum: Merdeka</td><td style="border:none;">Penyusun: ${userProfile.name}</td></tr>
                        </table>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th width="5%">No</th>
                                <th width="20%">Kompetensi Dasar / CP</th>
                                <th width="15%">Materi</th>
                                <th width="10%">Kls/Sem</th>
                                <th width="25%">Indikator Soal</th>
                                <th width="10%">Level Kognitif</th>
                                <th width="10%">Bentuk Soal</th>
                                <th width="5%">No Soal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quizResult.questions.map((q, idx) => `
                            <tr>
                                <td align="center">${idx + 1}</td>
                                <td>${q.competency || '-'}</td>
                                <td>${q.pedagogical_materi || topic || '-'}</td>
                                <td align="center">${gradeLevel || '-'}/${quizResult?.context_semester || activeSemester || '-'}</td>
                                <td>${q.indicator || '-'}</td>
                                <td align="center">${q.cognitive_level || 'L1/L2/L3'}</td>
                                <td align="center">${q.type.toUpperCase().replace('_', ' ')}</td>
                                <td align="center">${idx + 1}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                     <div style="margin-top:20px; text-align:right;">
                        <p>${signingLocation || 'Jakarta'}, ${dateStr}</p>
                        <p>Guru Mata Pelajaran</p>
                        <br/><br/><br/>
                        <p>( ${userProfile.name || '.......................'} )</p>
                        <p>NIP. ${userProfile.nip || '-'}</p>
                    </div>
                </body>
            </html>
        `;

        try {
            const blob = await asBlob(html);
            saveAs(blob, `Kisi-Kisi_${(topic || 'Kuis').replace(/\s+/g, '_')}.docx`);
            toast.success("Kisi-kisi Word berhasil didownload!");
        } catch (error) {
            console.error(error);
            toast.error("Gagal export Kisi-kisi Word");
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                    <BrainCircuit className="text-blue-600" />
                    Generator Kuis AI <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200">Advanced</span>
                </h1>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-800 w-fit">
                    <Sparkles size={12} /> Powered by BSKAP 2025 Intel Engine
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* LEFT SIDEBAR: History */}
                <div className="lg:col-span-1 space-y-4 order-last lg:order-first">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-700 h-full flex flex-col">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                            <History size={18} className="text-purple-500" />
                            Riwayat Kuis
                        </h3>

                        <div className="flex-grow overflow-y-auto space-y-2 pr-1 max-h-[300px] lg:max-h-[600px]">
                            {loadingHistory ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>
                            ) : savedQuizzes.length > 0 ? (
                                savedQuizzes.map((q) => (
                                    <div
                                        key={q.id}
                                        onClick={() => {
                                            // Restore quiz with context_semester injected for exports
                                            setQuizResult({
                                                ...q.quiz,
                                                context_semester: q.context_semester || activeSemester
                                            });
                                            setSubject(q.subject || '');
                                            setGradeLevel(q.gradeLevel || '');
                                            setTopic(q.topic || '');
                                        }}
                                        className="group p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer relative"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">{q.subject} - {q.gradeLevel}</p>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{q.topic}</h4>
                                                <p className="text-[10px] text-gray-500 mt-1">{q.createdAt?.toDate ? new Date(q.createdAt.toDate()).toLocaleDateString('id-ID') : 'Baru saja'}</p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteQuiz(e, q.id)}
                                                className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-xs text-gray-400">Belum ada riwayat kuis.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT CONTENT: Generator & Results */}
                <div className="lg:col-span-3 space-y-6">
                    {/* CONFIGURATION CARD */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* LEFT: Context & Basics */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><FileText size={18} /> Konteks & Materi</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Sumber Data</label>
                                        <StyledSelect value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                                            <option value="rpp">Modul Ajar / RPP</option>
                                            <option value="promes">Program Semester</option>
                                            <option value="manual">Input Manual</option>
                                            <option value="image">Upload Gambar (Vision)</option>
                                        </StyledSelect>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Pilih Dokumen</label>
                                        <StyledSelect value={selectedContextId} onChange={(e) => handleSourceChange(e.target.value)} disabled={sourceType === 'manual' || sourceType === 'image'}>
                                            <option value="">{loading ? 'Memuat...' : '-- Pilih --'}</option>
                                            {sourceData
                                                .filter(d => !subject || (d.subject && d.subject.trim().toLowerCase() === subject.trim().toLowerCase()))
                                                .map(d => (
                                                    <option key={d.id} value={d.id}>
                                                        {sourceType === 'rpp'
                                                            ? `${d.gradeLevel || 'Kelas'} - ${d.materi || d.topic} (${d.academicYear || ''})`
                                                            : `${d.subject} - ${d.gradeLevel || d.grade} (${d.semester})`
                                                        }
                                                    </option>
                                                ))}
                                        </StyledSelect>
                                        {subject && sourceData.filter(d => d.subject && d.subject.trim().toLowerCase() === subject.trim().toLowerCase()).length === 0 && (
                                            <p className="text-[10px] text-amber-600 mt-1">Tidak ada {sourceType.toUpperCase()} untuk mapel ini.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mata Pelajaran</label>
                                        <StyledSelect
                                            value={subjects.find(s => s.name.trim().toLowerCase() === subject.trim().toLowerCase())?.id || ''}
                                            onChange={(e) => {
                                                const s = subjects.find(sub => String(sub.id) === String(e.target.value));
                                                const newSubjectName = s ? s.name : e.target.value;
                                                setSubject(newSubjectName);
                                                
                                                // Reset selected context if subject changes and it doesn't match
                                                if (selectedContextId) {
                                                    const currentContext = sourceData.find(d => String(d.id) === String(selectedContextId));
                                                    if (currentContext && (currentContext.subject || '').trim().toLowerCase() !== newSubjectName.trim().toLowerCase()) {
                                                        setSelectedContextId('');
                                                        setContextContent('');
                                                    }
                                                }
                                            }}
                                        >
                                            <option value="">Pilih Mapel</option>
                                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </StyledSelect>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Kelas (Level)</label>
                                        <StyledSelect
                                            value={gradeLevel}
                                            onChange={(e) => setGradeLevel(e.target.value)}
                                        >
                                            <option value="">Pilih Kelas</option>
                                            {availableLevels.map(level => <option key={level} value={level}>{level}</option>)}
                                        </StyledSelect>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Topik Spesifik / KD</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="Contoh: Ekosistem, Hukum Newton..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Kota / Tempat (Untuk Tanda Tangan)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                                            value={signingLocation}
                                            onChange={(e) => {
                                                setSigningLocation(e.target.value);
                                                localStorage.setItem('QUIZ_SIGNING_LOCATION', e.target.value);
                                            }}
                                            placeholder="Contoh: Jakarta, Bondowoso..."
                                        />
                                        <button
                                            onClick={handleDetectLocation}
                                            disabled={detectingLocation}
                                            title="Deteksi Lokasi Otomatis"
                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                                        >
                                            {detectingLocation ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {sourceType === 'image' ? (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Upload Gambar Referensi</label>
                                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                id="image-upload"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setImageFile(file);
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setPreviewUrl(reader.result);
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                            />
                                            <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2 w-full h-full">
                                                {previewUrl ? (
                                                    <div className="relative">
                                                        <img src={previewUrl} alt="Preview" className="h-32 object-contain rounded-md shadow-sm" />
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setImageFile(null);
                                                                setPreviewUrl(null);
                                                            }}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                                        >
                                                            <BrainCircuit size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="text-gray-400" size={32} />
                                                        <span className="text-sm text-gray-500">Klik untuk upload gambar (Diagram, Teks, dll)</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Konteks Tambahan (AI Reading)</label>
                                        <textarea
                                            className="w-full p-2 border rounded-lg h-24 text-sm dark:bg-gray-700 dark:border-gray-600"
                                            value={contextContent}
                                            onChange={(e) => setContextContent(e.target.value)}
                                            placeholder="Isi materi atau kopikan teks RPP di sini untuk referensi AI..."
                                        />
                                    </div>
                                )}
                            </div>

                            {/* RIGHT: Advanced Settings */}
                            <div className="space-y-4 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8 dark:border-gray-700">
                                <h3 className="font-semibold text-lg flex items-center gap-2"><Sliders size={18} /> Konfigurasi Soal</h3>

                                <div className="flex justify-between items-center">
                                    <label className="font-medium">Total Soal</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                            {Object.values(typeCounts).reduce((sum, c) => sum + c, 0)}
                                        </span>
                                        <span className="text-xs text-gray-500">butir</span>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="font-medium text-sm">Tingkat Kesulitan (HOTS Meter)</label>
                                        <span className={`text - xs font - bold px - 2 py - 0.5 rounded ${difficulty > 70 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {difficulty}% - {difficulty > 70 ? 'HOTS' : difficulty > 30 ? 'MOTS' : 'LOTS'}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0" max="100"
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value)}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>Mudah</span>
                                        <span>Menalar</span>
                                        <span>Kritis</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-3">Jumlah Soal per Tipe</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {QUESTION_TYPES.map(type => (
                                            <div
                                                key={type.id}
                                                title={type.description}
                                                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 shadow-sm hover:shadow-md transition-shadow cursor-help"
                                            >
                                                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 min-w-0 mr-3">
                                                    <div className="p-2 bg-white dark:bg-gray-600 rounded-md shadow-sm text-blue-500 shrink-0">
                                                        {type.icon}
                                                    </div>
                                                    <span className="leading-tight truncate">{type.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="50"
                                                        value={typeCounts[type.id] || ''}
                                                        onChange={(e) => updateTypeCount(type.id, e.target.value)}
                                                        placeholder="0"
                                                        className="w-20 px-3 py-2 text-center font-bold border rounded-lg dark:bg-gray-600 dark:border-gray-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={generating}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition transform active:scale-95 flex justify-center items-center gap-2 mt-4"
                                >
                                    {generating ? <RefreshCw className="animate-spin" /> : <BrainCircuit />}
                                    {generating ? 'Sedang Meracik Soal...' : 'GENERATE SOAL SEKARANG'}
                                </button>

                                {/* Improved Progress Indicator */}
                                {generating && (
                                    <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl animate-fade-in">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500 text-white rounded-lg shadow-sm">
                                                    <Sparkles size={20} className="animate-pulse" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
                                                        {generationProgress.stage === 'preparing' && 'Tahap 1: Persiapan'}
                                                        {generationProgress.stage === 'generating' && 'Tahap 2: AI Berpikir'}
                                                        {generationProgress.stage === 'parsing' && 'Tahap 3: Finalisasi'}
                                                        {generationProgress.stage === 'complete' && 'Tahap 4: Selesai'}
                                                        {generationProgress.stage === 'starting' && 'Memulai...'}
                                                    </p>
                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                                        {generationProgress.message}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                                                {generationProgress.percentage}%
                                            </span>
                                        </div>

                                        <div className="w-full h-3 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out relative"
                                                style={{ width: `${generationProgress.percentage}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                                            </div>
                                        </div>

                                        <div className="flex justify-between mt-3 text-[10px] font-medium text-blue-500 dark:text-blue-400 uppercase tracking-widest">
                                            <span className={generationProgress.percentage >= 10 ? 'opacity-100' : 'opacity-30'}>Persiapan</span>
                                            <span className={generationProgress.percentage >= 50 ? 'opacity-100' : 'opacity-30'}>Generasi</span>
                                            <span className={generationProgress.percentage >= 85 ? 'opacity-100' : 'opacity-30'}>Validasi</span>
                                            <span className={generationProgress.percentage >= 100 ? 'opacity-100' : 'opacity-30'}>Selesai</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RESULTS SECTION */}
                    {quizResult && (
                        <div className="animate-fade-in space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <h2 className="text-2xl font-bold dark:text-white shrink-0">Preview Hasil</h2>
                                <div className="flex flex-wrap gap-2 justify-start md:justify-end w-full">
                                    <button
                                        onClick={handleSaveQuiz}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold disabled:opacity-50 text-sm flex-1 md:flex-none min-w-[140px]"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                        Simpan Kuis
                                    </button>
                                    <button onClick={exportWord} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-semibold text-sm flex-1 md:flex-none min-w-[120px]">
                                        <FileText size={18} /> Word
                                    </button>
                                    <button onClick={exportPDF} className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold transition-colors text-sm flex-1 md:flex-none min-w-[120px]">
                                        <Download size={18} /> PDF
                                    </button>

                                    <button onClick={exportKartuSoalWord} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-semibold transition-colors text-sm flex-1 md:flex-none min-w-[150px]">
                                        <FileText size={18} /> Kartu Soal (Word)
                                    </button>
                                    <button onClick={exportKartuSoalPDF} className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-semibold transition-colors text-sm flex-1 md:flex-none min-w-[150px]">
                                        <ImageIcon size={18} /> Kartu Soal (PDF)
                                    </button>

                                    <button onClick={exportKisiKisiWord} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 font-semibold transition-colors text-sm flex-1 md:flex-none min-w-[150px]">
                                        <FileText size={18} /> Kisi-kisi (Word)
                                    </button>
                                    <button onClick={exportKisiKisiPDF} className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 font-semibold transition-colors text-sm flex-1 md:flex-none min-w-[150px]">
                                        <Grid size={18} /> Kisi-kisi (PDF)
                                    </button>
                                </div>
                            </div>

                            {/* TIP: Pedagogy Context */}
                            {!quizResult.questions[0].competency && (
                                <div className="mt-2 text-xs bg-blue-50 text-blue-600 p-2 rounded-lg border border-blue-100 flex items-start gap-2 italic">
                                    <BrainCircuit size={14} className="mt-0.5 shrink-0" />
                                    <span>Catatan: Kompetensi & Indikator otomatis hanya tersedia untuk kuis yang baru digenerate. Kuis lama mungkin menampilkan field ini sebagai kosong.</span>
                                </div>
                            )}

                            {/* QUESTIONS GRID */}
                            <div className="grid grid-cols-1 gap-6">
                                {quizResult && Array.isArray(quizResult.questions) && quizResult.questions.length > 0 ? (
                                    quizResult.questions.map((q, idx) => (
                                        <div key={idx} id={`quiz-question-${idx}`} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 relative">
                                            <span className="absolute top-4 right-4 text-xs font-bold text-gray-400 uppercase border px-2 py-1 rounded">{(q.type || 'pg').replace('_', ' ')}</span>
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-grow">
                                                    <div className="font-normal text-lg text-gray-800 dark:text-white prose dark:prose-invert max-w-none">
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm, remarkMath]}
                                                            rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                        >
                                                            {`${q.stimulus ? q.stimulus + '\n\n' : ''}${q.image_hint ? '> 🖼️ **INSTRUKSI GAMBAR:** ' + q.image_hint + '\n\n' : ''}${q.question || 'Petunjuk: Klik "Generate" untuk membuat soal.'}`}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="ml-0 md:ml-14 space-y-4">
                                                {/* PEDAGOGICAL METADATA (NEW) */}
                                                {(q.indicator || q.cognitive_level) && (
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {q.cognitive_level && (
                                                            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase border border-purple-200">
                                                                Level: {q.cognitive_level}
                                                            </span>
                                                        )}
                                                        {q.indicator && (
                                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 italic">
                                                                Indikator: {q.indicator}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* OPTION RENDERER */}
                                                {(q.type === 'pg' || q.type === 'pg_complex') && Array.isArray(q.options) && (
                                                    <div className="space-y-2 ml-2">
                                                        {q.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                                                <div className={`w-4 h-4 border rounded-full flex items-center justify-center ${q.type === 'pg_complex' ? 'rounded-md' : 'rounded-full'} border-gray-400`}></div>
                                                                <span className="text-gray-600 dark:text-gray-300">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {opt}
                                                                    </ReactMarkdown>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'matching' && Array.isArray(q.left_side) && Array.isArray(q.right_side) && (
                                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                                                        <div className="space-y-2">
                                                            {q.left_side.map((l, i) => (
                                                                <div key={i} className="p-2 border bg-white dark:bg-gray-800 rounded text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {l}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="space-y-2">
                                                            {q.right_side.map((r, i) => (
                                                                <div key={i} className="p-2 border bg-white dark:bg-gray-800 rounded text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {r}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {q.type === 'pg_matrix' && Array.isArray(q.rows) && Array.isArray(q.columns) && (
                                                    <div className="overflow-x-auto mt-2 border rounded-lg dark:border-gray-700">
                                                        <table className="w-full text-sm text-left border-collapse">
                                                            <thead className="bg-gray-100 dark:bg-gray-700">
                                                                <tr>
                                                                    <th className="p-2 border dark:border-gray-600 font-bold">Pernyataan</th>
                                                                    {q.columns.map((col, cIdx) => (
                                                                        <th key={cIdx} className="p-2 border dark:border-gray-600 text-center font-bold">
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                                {col}
                                                                            </ReactMarkdown>
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {q.rows.map((row, rIdx) => (
                                                                    <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                        <td className="p-2 border dark:border-gray-600">
                                                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                                {row}
                                                                            </ReactMarkdown>
                                                                        </td>
                                                                        {q.columns.map((col, cIdx) => (
                                                                            <td key={cIdx} className="p-2 border dark:border-gray-600 text-center">
                                                                                <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-500 rounded mx-auto"></div>
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}

                                                {q.type === 'true_false' && Array.isArray(q.statements) && (
                                                    <div className="space-y-1">
                                                        {q.statements.map((s, i) => (
                                                            <div key={i} className="flex justify-between items-center p-2 border-b last:border-0 border-dashed">
                                                                <span className="text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {s.text}
                                                                    </ReactMarkdown>
                                                                </span>
                                                                <div className="flex gap-2 text-xs font-bold text-gray-400">
                                                                    <span className="border px-2 py-1 rounded">B</span>
                                                                    <span className="border px-2 py-1 rounded">S</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {q.type === 'short_answer' && (
                                                    <div className="mt-2 p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                                                        <div className="flex items-center gap-2 text-gray-400 italic text-sm">
                                                            <Hash size={14} /> Jawab: ................................................................................
                                                        </div>
                                                    </div>
                                                )}

                                                {q.type === 'sequencing' && Array.isArray(q.items) && (
                                                    <div className="mt-2 space-y-2">
                                                        {q.items.map((item, i) => (
                                                            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm">
                                                                <div className="flex flex-col gap-1">
                                                                    <ChevronUp size={12} className="text-gray-400" />
                                                                    <ChevronDown size={12} className="text-gray-400" />
                                                                </div>
                                                                <div className="flex-grow text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {item}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <p className="text-[10px] text-gray-400 italic">Petunjuk: Urutkan langkah-langkah di atas dengan benar.</p>
                                                    </div>
                                                )}

                                                {/* ANSWER KEY REVEAL */}
                                                <div className="mt-6 pt-4 border-t border-dashed dark:border-gray-700">
                                                    <details className="group">
                                                        <summary className="cursor-pointer text-sm font-semibold text-green-600 flex items-center gap-2 selection:bg-none">
                                                            <span>Lihat Kunci & Pembahasan</span>
                                                        </summary>
                                                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-green-50 dark:bg-green-900/10 p-3 rounded">
                                                            <div className="flex gap-1">
                                                                <strong>Jawaban:</strong>
                                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                    {formatAnswer(q)}
                                                                </ReactMarkdown>
                                                            </div>
                                                            {q.explanation && (
                                                                <div className="mt-2">
                                                                    <strong>Pembahasan:</strong>
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                                        {q.explanation}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </details>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-200">
                                        <p className="text-gray-500 font-medium font-bold">Terjadi kesalahan teknis saat memproses soal.</p>
                                        <p className="text-sm text-gray-400 mt-2 italic">Format data dari AI tidak terbaca dengan benar. Mohon klik tombol Generate ulang untuk mendapatkan hasil yang utuh.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {
                confirmModal.isOpen && (
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
                )
            }

            {/* Troubleshooting Error Modal */}
            {
                errorModal.isOpen && (
                    <Modal onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}>
                        <div className="p-2">
                            <div className="flex flex-col items-center text-center">
                                <div className={`p-4 rounded-full mb-4 ${errorModal.type === 'quota' ? 'bg-orange-100 text-orange-600' :
                                    errorModal.type === 'apikey' ? 'bg-red-100 text-red-600' :
                                        errorModal.type === 'parse' ? 'bg-amber-100 text-amber-600' :
                                            errorModal.type === 'safety' ? 'bg-blue-100 text-blue-600' :
                                                'bg-gray-100 text-gray-600'
                                    }`}>
                                    {errorModal.type === 'quota' && <AlertTriangle size={32} />}
                                    {errorModal.type === 'apikey' && <Key size={32} />}
                                    {errorModal.type === 'parse' && <RefreshCw size={32} />}
                                    {errorModal.type === 'safety' && <AlertTriangle size={32} />}
                                    {errorModal.type === 'generic' && <BrainCircuit size={32} />}
                                </div>

                                <h3 className="text-xl font-bold dark:text-white mb-2">{errorModal.title}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-sm">
                                    {errorModal.message}
                                </p>

                                <div className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 text-left mb-6 border border-gray-100 dark:border-gray-800">
                                    <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest mb-2">Saran Pemecahan Masalah:</p>
                                    <ul className="text-xs space-y-2 text-gray-700 dark:text-gray-300">
                                        {errorModal.type === 'quota' && (
                                            <>
                                                <li className="flex gap-2"><span>1.</span> Tunggu sekitar 60 detik sebelum mencoba lagi.</li>
                                                <li className="flex gap-2"><span>2.</span> Gunakan model <b>Gemini 3.1 Flash Lite</b> yang lebih ringan di pengaturan.</li>
                                                <li className="flex gap-2"><span>3.</span> Ganti API Key di Master Data jika limit sudah benar-benar habis.</li>
                                            </>
                                        )}
                                        {errorModal.type === 'apikey' && (
                                            <>
                                                <li className="flex gap-2"><span>1.</span> Pergi ke menu <b>Data Guru/Master</b>.</li>
                                                <li className="flex gap-2"><span>2.</span> Masukkan API Key Gemini yang valid (dapat diambil di Google AI Studio).</li>
                                                <li className="flex gap-2"><span>3.</span> Pastikan tidak ada spasi di awal atau akhir kunci.</li>
                                            </>
                                        )}
                                        {errorModal.type === 'parse' && (
                                            <>
                                                <li className="flex gap-2"><span>1.</span> Kurangi jumlah soal dalam satu permintaan jika terlalu banyak.</li>
                                                <li className="flex gap-2"><span>2.</span> Klik tombol "Generate" lagi; kami telah mengaktifkan sistem perbaikan otomatis.</li>
                                                <li className="flex gap-2"><span>3.</span> Berikan konteks RPP yang lebih sederhana/jelas.</li>
                                            </>
                                        )}
                                        {errorModal.type === 'safety' && (
                                            <>
                                                <li className="flex gap-2"><span>1.</span> Periksa apakah ada kata-kata sensitif di RPP/Topik Anda.</li>
                                                <li className="flex gap-2"><span>2.</span> Ubah bahasa atau deskripsi materi menjadi lebih umum.</li>
                                                <li className="flex gap-2"><span>3.</span> Gunakan model AI yang berbeda di pengaturan.</li>
                                            </>
                                        )}
                                        {errorModal.type === 'generic' && (
                                            <>
                                                <li className="flex gap-2"><span>1.</span> Pastikan koneksi internet Anda stabil.</li>
                                                <li className="flex gap-2"><span>2.</span> Coba refresh halaman browser Anda.</li>
                                                <li className="flex gap-2"><span>3.</span> Jika berlanjut, hubungi admin sistem.</li>
                                            </>
                                        )}
                                    </ul>
                                </div>

                                <div className="flex flex-col w-full gap-2">
                                    <button
                                        onClick={() => handleGenerate()}
                                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={18} /> Coba Generate Lagi
                                    </button>
                                    <button
                                        onClick={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
                                        className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
};

export default QuizGeneratorPage;

