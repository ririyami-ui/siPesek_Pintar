// Forced refresh: 2026-01-26 14:05
import React from 'react';
const { useState, useEffect, useCallback, useRef } = React;
import { useSettings } from '../utils/SettingsContext';
import { generateATP } from '../utils/gemini';
import { BookOpen, Calendar, List, Clock, Save, ChevronDown, Check, Trash, Upload, Download, FileSpreadsheet, Plus, Zap, RefreshCw, MapPin, Loader2, Workflow, Lock, Unlock } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/id';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Printer, FileText } from 'lucide-react';
import { asBlob } from 'html-docx-js-typescript';
import BSKAP_DATA from '../utils/bskap_2025_intel.json';

// Utility for Month Mapping
const MONTH_MAP = {
    'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6,
    'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
};

// Utility for Docx Export
const exportToDocx = async (htmlContent, fileName, options = {}) => {
    const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
                h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; }
                .meta { margin-bottom: 15px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid black; padding: 4px 8px; font-size: 11pt; }
                th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
                .text-center { text-align: center; }
                .text-bold { font-weight: bold; }
                .signature-table { border: none; margin-top: 40px; width: 100%; }
                .signature-table td { border: none; text-align: center; vertical-align: top; padding: 0; }
                .signature-name { font-weight: bold; text-decoration: underline; margin-top: 60px; }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `;

    try {
        const blob = await asBlob(fullHtml, { orientation: options.orientation || 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } }); // ~1 inch margins
        saveAs(blob, fileName);
        toast.success(`Word ${fileName} berhasil diunduh!`);
    } catch (error) {
        console.error("Docx export error:", error);
        toast.error("Gagal mengekspor ke Word.");
    }
};

const ProgramMengajarPage = () => {
    const { activeSemester, academicYear } = useSettings();
    const [activeTab, setActiveTab] = useState('pekan-efektif');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [levels, setLevels] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [schedules, setSchedules] = useState([]);

    const [userProfile, setUserProfile] = useState(null);
    const [signingLocation, setSigningLocation] = useState('');
    const [detectingLocation, setDetectingLocation] = useState(false);

    const handleDetectLocation = useCallback((manual = true) => {
        if (!navigator.geolocation) {
            if (manual) toast.error("Browser tidak mendukung geolokasi.");
            return;
        }

        setDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();

                    let city = data.address.city || data.address.town || data.address.regency || data.address.county || data.address.state_district || 'Lokasi Terdeteksi';

                    // Cleanup common prefixes in Indonesia
                    city = city.replace(/^(Kabupaten|Kota|Kab\.|Kota\s)\s+/i, '');

                    // Race condition fix: If auto-detecting (manual=false), check if we already have a high-confidence location set (e.g. from School Name)
                    if (!manual) {
                        const currentParams = localStorage.getItem('QUIZ_SIGNING_LOCATION');
                        if (currentParams && currentParams !== 'Jakarta' && currentParams !== 'Lokasi Terdeteksi' && currentParams !== '') {
                            console.log("Skipping auto-location, existing value preferred:", currentParams);
                            setDetectingLocation(false);
                            return;
                        }
                    }

                    setSigningLocation(city);
                    localStorage.setItem('QUIZ_SIGNING_LOCATION', city);
                    if (manual) toast.success(`Lokasi terdeteksi: ${city}`);
                } catch (error) {
                    if (manual) {
                        console.error("Error detecting location:", error);
                        if (error.code === 1) toast.error("Izin lokasi ditolak.");
                        else toast.error("Gagal mendeteksi nama kota.");
                    }
                } finally {
                    setDetectingLocation(false);
                }
            },
            (error) => {
                if (manual) {
                    console.error("Geolocation error:", error);
                    if (error.code === 1) toast.error("Izin lokasi ditolak. Mohon izinkan browser.");
                    else toast.error("Gagal mendapatkan lokasi. Pastikan GPS aktif.");
                }
                setDetectingLocation(false);
            }
        );
    }, []);

    // Load saved location on mount or detect automatically
    useEffect(() => {
        const savedLoc = localStorage.getItem('QUIZ_SIGNING_LOCATION');
        if (savedLoc) {
            setSigningLocation(savedLoc);
        } else {
            handleDetectLocation(false); // Auto-detect, silent errors
        }
    }, [handleDetectLocation]);

    // Fetch unique levels and subjects from master data
    useEffect(() => {
        const fetchMasterData = async () => {
            setLoadingData(true);
            try {
                // Get user info to check role
                const userRes = await api.get('/me');
                const userData = userRes.data;

                // Fetch Levels and Subjects
                const [classesRes, subjectsRes] = await Promise.all([
                    api.get('/classes'),
                    api.get('/subjects')
                ]);

                const classData = classesRes.data.data || classesRes.data || [];
                const subjectData = subjectsRes.data.data || subjectsRes.data || [];

                // Backend already filters based on role and assignments
                const filteredLevels = [...new Set(classData.map(c => c.level))].sort();
                const filteredSubjects = subjectData
                    .map(s => ({ id: s.id, name: s.name }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                setLevels(filteredLevels);
                setSubjects(filteredSubjects);

                if (filteredLevels.length > 0) setSelectedGrade(filteredLevels[0]);
                if (filteredSubjects.length > 0) setSelectedSubject(filteredSubjects[0].name);

                // Fetch User Profile for signing location
                const profileRes = await api.get('/profile');
                const profile = profileRes.data.profile;
                setUserProfile(profile);

                if (profile?.school_name) {
                    const school = profile.school_name;
                    const parts = school.trim().split(' ');
                    if (parts.length > 1) {
                        const lastWord = parts[parts.length - 1];
                        const ignoreWords = ['negeri', 'swasta', 'pusat', 'terpadu', 'utara', 'selatan', 'barat', 'timur', 'tengah'];
                        if (lastWord.length > 2 && !ignoreWords.includes(lastWord.toLowerCase()) && isNaN(lastWord)) {
                            setSigningLocation(lastWord);
                            localStorage.setItem('QUIZ_SIGNING_LOCATION', lastWord);
                            return;
                        }
                    }
                }

                setSigningLocation(prev => {
                    if (prev && prev !== 'Jakarta') return prev;
                    const stored = localStorage.getItem('QUIZ_SIGNING_LOCATION');
                    return stored || 'Jakarta';
                });
            } catch (err) {
                console.error("Error fetching master data:", err);
                toast.error("Gagal memuat data master.");
            } finally {
                setLoadingData(false);
            }
        };

        fetchMasterData();
    }, []);

    // Fetch Teaching Schedules
    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                const res = await api.get('/schedules');
                setSchedules(res.data.data || res.data || []);
            } catch (error) {
                console.error("Error fetching schedules:", error);
            }
        };
        fetchSchedules();
    }, []);

    // Tabs configuration
    const tabs = [
        { id: 'pekan-efektif', label: 'Pekan Efektif', icon: <Clock size={18} /> },
        { id: 'atp', label: 'Alur Tujuan (ATP)', icon: <Workflow size={18} /> },
        { id: 'prota', label: 'Program Tahunan', icon: <List size={18} /> },
        { id: 'promes', label: 'Program Semester', icon: <Calendar size={18} /> },
    ];

    const [sharedEfektifData, setSharedEfektifData] = useState(null);

    // BREAK LOOP: Stable update function
    const handleUpdateGlobalEfektif = useCallback((newData) => {
        setSharedEfektifData(prev => {
            if (!newData) return null;
            // Deep compare to avoid unnecessary re-renders
            if (prev &&
                prev.jpPerWeek === newData.jpPerWeek &&
                prev.totalEffectiveWeeks === newData.totalEffectiveWeeks &&
                JSON.stringify(prev.pekanEfektif) === JSON.stringify(newData.pekanEfektif)) {
                return prev;
            }
            return newData;
        });
    }, []);

    // GLOBAL FETCH: Load Pekan Efektif & JP Context immediately on selection
    useEffect(() => {
        if (!selectedGrade || !selectedSubject) return;

        let ignore = false;
        const fetchGlobalEfektif = async () => {
            setSharedEfektifData(null);

            try {
                // Find subject ID
                const subjectObj = subjects.find(s => s.name === selectedSubject);
                if (!subjectObj) return;

                // Load Subject Program (Head)
                const progRes = await api.get('/teaching-programs', {
                    params: {
                        type: 'subject_program',
                        grade_level: selectedGrade,
                        subject_id: subjectObj.id,
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });

                // Load Calendar Structure
                const calRes = await api.get('/teaching-programs', {
                    params: {
                        type: 'calendar_structure',
                        grade_level: selectedGrade,
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });

                if (ignore) return;

                const progData = (progRes.data.data || progRes.data || [])[0] || {};
                const calData = (calRes.data.data || calRes.data || [])[0] || {};

                const effectiveMonths = calData.pekan_efektif || progData.pekan_efektif || [];
                const jpPerWeek = progData.jp_per_week || 0;

                if (effectiveMonths.length > 0) {
                    const totalWeeks = effectiveMonths.reduce((acc, curr) =>
                        acc + (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0)), 0);

                    setSharedEfektifData({
                        totalEffectiveWeeks: totalWeeks,
                        totalEffectiveHours: totalWeeks * parseInt(jpPerWeek),
                        jpPerWeek: parseInt(jpPerWeek),
                        pekanEfektif: effectiveMonths
                    });
                } else {
                    setSharedEfektifData({
                        totalEffectiveWeeks: 0,
                        totalEffectiveHours: 0,
                        jpPerWeek: parseInt(jpPerWeek),
                        pekanEfektif: []
                    });
                }
            } catch (error) {
                console.error("Error in Global Efektif Fetch:", error);
            }
        };

        fetchGlobalEfektif();
        return () => { ignore = true; };
    }, [selectedGrade, selectedSubject, activeSemester, academicYear, subjects]);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header ... (unchanged) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <BookOpen className="text-blue-600" />
                        Program Mengajar
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Tahun Ajaran {academicYear} • Semester {activeSemester}
                    </p>

                </div>
                {/* ... Rest of header code unused in this block, keeping context ... */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Location Selector */}
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <MapPin size={14} className="text-gray-500" />
                        <input
                            type="text"
                            className="bg-transparent font-semibold text-gray-800 dark:text-white focus:outline-none text-sm w-32"
                            value={signingLocation}
                            onChange={(e) => {
                                setSigningLocation(e.target.value);
                                localStorage.setItem('QUIZ_SIGNING_LOCATION', e.target.value);
                            }}
                            placeholder="Kota..."
                        />
                        <button
                            onClick={handleDetectLocation}
                            disabled={detectingLocation}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            title="Deteksi Lokasi"
                        >
                            {detectingLocation ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        </button>
                    </div>
                    {/* Subject Selector */}
                    <div className="flex flex-1 items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase px-2">Mapel:</span>
                        <select
                            value={selectedSubject}
                            onChange={(e) => {
                                setSelectedSubject(e.target.value);
                                setSharedEfektifData(null);
                            }}
                            className="flex-1 bg-transparent font-semibold text-gray-800 dark:text-white focus:outline-none cursor-pointer text-sm"
                            disabled={loadingData}
                        >
                            {loadingData ? (
                                <option>Memuat...</option>
                            ) : (
                                subjects.length > 0 ? (
                                    subjects.map((sub) => (
                                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                                    ))
                                ) : (
                                    <option disabled>Tidak ada mapel</option>
                                )
                            )}
                        </select>
                    </div>

                    {/* Grade Selector */}
                    <div className="flex flex-1 items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase px-2">Tingkat:</span>
                        <select
                            value={selectedGrade}
                            onChange={(e) => {
                                setSelectedGrade(e.target.value);
                                setSharedEfektifData(null);
                            }}
                            className="flex-1 bg-transparent font-semibold text-gray-800 dark:text-white focus:outline-none cursor-pointer text-sm"
                            disabled={loadingData}
                        >
                            {loadingData ? (
                                <option>Memuat...</option>
                            ) : (
                                levels.length > 0 ? (
                                    levels.map((lvl) => (
                                        <option key={lvl} value={lvl}>Kelas {lvl}</option>
                                    ))
                                ) : (
                                    <option disabled>Tidak ada tingkat</option>
                                )
                            )}
                        </select>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap flex-1 justify-center ${activeTab === tab.id
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div id="printable-area" className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[500px] p-6">
                {!selectedGrade || !selectedSubject ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400">
                        <BookOpen size={48} className="mb-4 opacity-20" />
                        <p>Silakan pilih mata pelajaran dan tingkat kelas terlebih dahulu</p>
                    </div>
                ) : (
                    <>
                        <>
                            {activeTab === 'atp' && (
                                <ATPView
                                    key={`atp_${selectedGrade}_${selectedSubject}_${activeSemester}_${academicYear}`}
                                    grade={selectedGrade}
                                    subject={selectedSubject}
                                    semester={activeSemester}
                                    year={academicYear}
                                    userProfile={userProfile}
                                    signingLocation={signingLocation}
                                    schedules={schedules}
                                    sharedEfektifData={sharedEfektifData} // Pass shared data
                                    subjects={subjects}
                                />
                            )}
                            {activeTab === 'pekan-efektif' && (
                                <PekanEfektifView
                                    key={`cal_${selectedGrade}_${selectedSubject}_${activeSemester}_${academicYear}`}
                                    grade={selectedGrade}
                                    subject={selectedSubject}
                                    semester={activeSemester}
                                    year={academicYear}
                                    schedules={schedules}
                                    activeTab={activeTab}
                                    userProfile={userProfile}
                                    signingLocation={signingLocation}
                                    onUpdateData={handleUpdateGlobalEfektif} // Use stable callback
                                    sharedEfektifData={sharedEfektifData}
                                    subjects={subjects}
                                    levels={levels}
                                />
                            )}
                            {activeTab === 'prota' && (
                                <ProtaView
                                    key={`prota_${selectedGrade}_${selectedSubject}_${activeSemester}_${academicYear}`}
                                    grade={selectedGrade}
                                    subject={selectedSubject}
                                    semester={activeSemester}
                                    year={academicYear}
                                    activeTab={activeTab}
                                    userProfile={userProfile}
                                    signingLocation={signingLocation}
                                    sharedEfektifData={sharedEfektifData}
                                    subjects={subjects}
                                />
                            )}
                            {activeTab === 'promes' && (
                                <PromesView
                                    key={`promes_${selectedGrade}_${selectedSubject}_${activeSemester}_${academicYear}`}
                                    grade={selectedGrade}
                                    subject={selectedSubject}
                                    semester={activeSemester}
                                    year={academicYear}
                                    schedules={schedules}
                                    activeTab={activeTab}
                                    userProfile={userProfile}
                                    signingLocation={signingLocation}
                                    sharedEfektifData={sharedEfektifData}
                                    subjects={subjects}
                                />
                            )}
                        </>
                    </>
                )}
            </div>
        </div>
    );
};




// --- Reusable Signature Section ---
const SignatureSection = ({ userProfile, signingLocation }) => {
    return (
        <div className="mt-12 mb-8 grid grid-cols-2 gap-8 text-center text-sm print:text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex flex-col items-center">
                <p>Mengetahui,</p>
                <p>Kepala Sekolah</p>
                <div className="h-24"></div>
                <p className="font-bold underline uppercase">{userProfile?.principalName || '.....................................'}</p>
                <p>NIP. {userProfile?.principalNip || '.....................................'}</p>
            </div>
            <div className="flex flex-col items-center">
                <p>{signingLocation || 'Jakarta'}, {moment().format('DD MMMM YYYY')}</p>
                <p>Guru Mata Pelajaran</p>
                <div className="h-24"></div>
                <p className="font-bold underline uppercase">{userProfile?.name || '.....................................'}</p>
                <p>NIP. {userProfile?.nip || '.....................................'}</p>
            </div>
        </div>
    );
};


const PekanEfektifView = ({ grade, subject, semester, year, schedules, activeTab, userProfile, signingLocation, onUpdateData, sharedEfektifData, subjects, levels }) => {
    // Point 4: Initialize with template to avoid "kosong" UI flash
    const getInitialTemplate = () => {
        const semesterMonths = semester === 'Ganjil'
            ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
            : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

        const years = year.split('/');

        return semesterMonths.map(m => {
            const mNum = MONTH_MAP[m];
            const actualYear = mNum >= 7 ? years[0] : years[1];
            // Logika: Jika hari > 28 (semua bulan kecuali Februari non-kabisat), maka 5 pekan (Kolom P1-P5)
            const daysInMonth = moment(`${actualYear}-${mNum}`, 'YYYY-M').daysInMonth();
            const totalWeeks = daysInMonth > 28 ? 5 : 4;

            return { name: m, totalWeeks: totalWeeks, nonEffectiveWeeks: 0, keterangan: '' };
        });
    };

    const [months, setMonths] = useState(getInitialTemplate());
    const [jpPerWeek, setJpPerWeek] = useState(0);
    const isInternalChange = React.useRef(false); // LOOP BREAKER

    // Live Sync to Parent
    useEffect(() => {
        if (onUpdateData && isInternalChange.current) {
            const totalEffectiveWeeks = months.reduce((acc, curr) => acc + (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0)), 0);
            const totalEffectiveHours = totalEffectiveWeeks * parseInt(jpPerWeek || 0);

            onUpdateData({
                jpPerWeek: parseInt(jpPerWeek || 0),
                totalEffectiveWeeks,
                totalEffectiveHours,
                pekanEfektif: months
            });
            isInternalChange.current = false; // Reset after sync
        }
    }, [months, jpPerWeek, onUpdateData]);

    // INITIAL SYNC FROM GLOBAL (Parent)
    useEffect(() => {
        if (sharedEfektifData && sharedEfektifData.pekanEfektif && sharedEfektifData.pekanEfektif.length > 0) {
            setMonths(sharedEfektifData.pekanEfektif);
            setJpPerWeek(sharedEfektifData.jpPerWeek || 0);
        }
    }, [sharedEfektifData]);
    const [loading, setLoading] = useState(false);
    const [programId, setProgramId] = useState(null);
    const [calendarId, setCalendarId] = useState(null);

    // POINT 9: Always calculate IDs based on props immediately to ensure buttons work 
    // even if fetching is skipped due to shared state.
    useEffect(() => {
        if (!userProfile) return;
        const userId = userProfile.user_id || userProfile.id;
        const cId = `calendar_${userId}_${grade}_${year.replace('/', '-')}_${semester}`;
        const pId = `${userId}_${subject}_${grade}_${year.replace('/', '-')}_${semester}`;
        setCalendarId(cId);
        setProgramId(pId);
    }, [grade, year, semester, subject, userProfile]);

    useEffect(() => {
        let ignore = false;
        const fetchData = async () => {
            if (!userProfile) return;

            // If we already have live shared data, don't fetch from DB again (avoid race/flicker)
            if (sharedEfektifData && sharedEfektifData.pekanEfektif && sharedEfektifData.pekanEfektif.length > 0) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const subjectObj = subjects.find(s => s.name === subject);
                if (!subjectObj) return;

                // Load Calendar Structure
                const calRes = await api.get('/teaching-programs', {
                    params: {
                        type: 'calendar_structure',
                        grade_level: grade,
                        semester: semester,
                        academic_year: year
                    }
                });

                // Load Subject Program (Head)
                const progRes = await api.get('/teaching-programs', {
                    params: {
                        type: 'subject_program',
                        grade_level: grade,
                        subject_id: subjectObj.id,
                        semester: semester,
                        academic_year: year
                    }
                });

                if (ignore) return;

                const calData = (calRes.data.data || calRes.data || [])[0] || {};
                const progData = (progRes.data.data || progRes.data || [])[0] || {};

                if (calData.pekan_efektif) {
                    setMonths(calData.pekan_efektif);
                } else if (progData.pekan_efektif) {
                    setMonths(progData.pekan_efektif);
                }

                if (progData.jp_per_week) {
                    setJpPerWeek(progData.jp_per_week);
                } else {
                    setJpPerWeek(0);
                }

                // --- NEW: AUTO-CALCULATE NON-EFFECTIVE WEEKS FROM HOLIDAYS ---
                const hRes = await api.get('/holidays');
                const allHolidays = hRes.data.data || hRes.data || [];

                setMonths(prevMonths => {
                    return prevMonths.map(m => {
                        // Calculate how many weeks in this month are affected by manual holidays
                        const mNum = MONTH_MAP[m.name];
                        const years = year.split('/');
                        const actualYear = mNum >= 7 ? years[0] : years[1];
                        const daysInMonth = moment(`${actualYear}-${mNum}`, 'YYYY-M').daysInMonth();

                        let calculatedNonEffective = 0;
                        let holidaynotes = [];

                        // Check each week
                        const totalWeeks = daysInMonth > 28 ? 5 : 4;
                        for (let w = 0; w < totalWeeks; w++) {
                            const weekStart = moment(`${actualYear}-${mNum}-${(w * 7) + 1}`, 'YYYY-MM-D').startOf('day');
                            const weekEnd = weekStart.clone().add(6, 'days').endOf('day');

                            const blockingHoliday = allHolidays.find(h => {
                                // Include all holidays (manual, national_sync, etc.)
                                const hStart = moment(h.startDate || h.start_date || h.date).startOf('day');
                                const hEnd = moment(h.endDate || h.end_date || h.date).startOf('day');

                                // Intersection
                                const overlapStart = moment.max(weekStart, hStart);
                                const overlapEnd = moment.min(weekEnd, hEnd);

                                if (overlapEnd.isBefore(overlapStart)) return false;

                                const overlapDays = overlapEnd.diff(overlapStart, 'days') + 1;
                                
                                // Threshold based on school days
                                // In Indonesia: 5 days school usually means 3 days holiday blocks a week (Majority of school week)
                                // 6 days school usually means 4 days holiday blocks a week
                                const schoolDaysCount = parseInt(userProfile?.school_days || userProfile?.schoolDays || 6);
                                const threshold = schoolDaysCount === 5 ? 3 : 4;

                                return overlapDays >= threshold;
                            });

                            if (blockingHoliday) {
                                calculatedNonEffective++;
                                const holidayTitle = blockingHoliday.title || blockingHoliday.name;
                                if (holidayTitle && !holidaynotes.includes(holidayTitle)) {
                                    holidaynotes.push(holidayTitle);
                                }
                            }
                        }

                        // Always update if we found holidays, or if it was previously auto-set
                        if (calculatedNonEffective > 0) {
                            return {
                                ...m,
                                nonEffectiveWeeks: calculatedNonEffective,
                                keterangan: holidaynotes.join(', '),
                                isAuto: true
                            };
                        }
                        return m;
                    });
                });

            } catch (error) {
                console.error("Error fetching Pekan Efektif:", error);
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        fetchData();
        return () => { ignore = true; };
    }, [grade, subject, semester, year, activeTab]);

    const handleSyncJP = () => {
        const targetSubjectObj = subjects.find(s => s.name === subject);

        // Helper to handle Roman/Arabic grade mapping
        const getAltGrade = (g) => {
            const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
            const rev = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
            return map[g] || rev[g] || g;
        };
        const altGrade = getAltGrade(grade);

        const matchingSchedules = (schedules || []).filter(s => {
            const className = typeof s.class === 'string' ? s.class : s.class?.rombel;

            // Precise Regex Matching (Handles "Kelas 1", "Kelas VII", etc. and avoids Grade 1 matching Class 11)
            const gradePattern = new RegExp(`^(?:KELAS\\s+)?(?:${grade}${altGrade ? '|' + altGrade : ''})(?![0-9])`, 'i');
            const isGradeMatch = className && gradePattern.test(className.trim());

            // 1. Try ID matching first (Most Robust)
            if (targetSubjectObj?.id && s.subjectId) {
                return s.subjectId === targetSubjectObj.id && isGradeMatch;
            }

            // 2. Fallback to name matching with trimming and lowercase
            const sSubject = (s.subject || '').trim().toLowerCase();
            const targetSubject = (subject || '').trim().toLowerCase();
            return sSubject === targetSubject && isGradeMatch;
        });

        if (matchingSchedules.length > 0) {
            const firstClassName = typeof matchingSchedules[0].class === 'string' ? matchingSchedules[0].class : matchingSchedules[0].class.rombel;
            const totalJP = matchingSchedules
                .filter(s => (typeof s.class === 'string' ? s.class : s.class.rombel) === firstClassName)
                .reduce((acc, s) => acc + (parseInt(s.endPeriod) - parseInt(s.startPeriod) + 1), 0);
            setJpPerWeek(totalJP);
            toast.success(`Berhasil sinkronisasi: ${totalJP} JP / Minggu (Diterapkan untuk seluruh Jenjang Kelas ${grade})`);
        } else {
            toast.error("Jadwal mengajar tidak ditemukan untuk kelas/mapel ini.");
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // 1. Save Calendar Structure (Grade-Level Specific)
            await api.post('/teaching-programs', {
                type: 'calendar_structure',
                academic_year: year,
                semester: semester,
                grade_level: grade,
                pekan_efektif: months
            });

            // 2. Save Subject Program Header
            const subjectObj = subjects.find(s => s.name === subject);
            if (subjectObj) {
                const totalEffectiveWeeks = months.reduce((acc, curr) => acc + (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0)), 0);
                const totalEffectiveHours = totalEffectiveWeeks * parseInt(jpPerWeek || 0);

                await api.post('/teaching-programs', {
                    type: 'subject_program',
                    subject_id: subjectObj.id,
                    grade_level: grade,
                    academic_year: year,
                    semester: semester,
                    jp_per_week: parseInt(jpPerWeek || 0),
                    total_effective_weeks: totalEffectiveWeeks,
                    total_effective_hours: totalEffectiveHours,
                    pekan_efektif: months // Also keep in header for individual subject overrides if needed
                });
            }

            toast.success(`Hore! Data Pekan Efektif berhasil disimpan untuk Kelas ${grade}.`);
        } catch (error) {
            console.error("Error saving Pekan Efektif:", error);
            toast.error("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };

    // Manual Sync Button Handler (Algorithm Refined - Curriculum Expert Style)
    const handleSyncWithCalendar = async () => {
        setLoading(true);
        try {
            const hRes = await api.get('/holidays');
            const allHolidays = (hRes.data.data || hRes.data || []).filter(h => h.is_holiday !== false || h.category?.includes('semester') || h.type === 'manual'); // Only count significant ones

            setMonths(prevMonths => {
                const updatedMonths = prevMonths.map(m => {
                    const mNum = MONTH_MAP[m.name];
                    const years = year.split('/');
                    const actualYear = mNum >= 7 ? years[0] : years[1];
                    
                    // --- REFINED ALGORITHM ---
                    const schoolDaysCount = parseInt(userProfile?.school_days || 6);
                    const threshold = schoolDaysCount === 5 ? 3 : 4;
                    
                    const startDate = moment([actualYear, mNum - 1]).startOf('month');
                    const endDate = moment(startDate).endOf('month');
                    
                    let totalWeeksCount = 0;
                    let nonEffectiveCount = 0;
                    let holidayNotes = [];

                    // Iterate through every possible week block that overlaps this month
                    let currentWeek = moment(startDate).startOf('isoWeek'); // Use ISO week (Monday-Sunday)
                    
                    while (currentWeek.isBefore(endDate)) {
                        const weekEnd = moment(currentWeek).endOf('isoWeek');
                        
                        // 1. Count school days of THIS WEEK that fall WITHIN THIS MONTH
                        let schoolDaysInMonth = 0;
                        let dayIter = moment(currentWeek);
                        while (dayIter.isSameOrBefore(weekEnd)) {
                            if (dayIter.month() === mNum - 1) {
                                const dIndex = dayIter.day(); // 0:Sun, 1:Mon... 6:Sat
                                if (schoolDaysCount === 5) {
                                    if (dIndex >= 1 && dIndex <= 5) schoolDaysInMonth++;
                                } else {
                                    if (dIndex >= 1 && dIndex <= 6) schoolDaysInMonth++;
                                }
                            }
                            dayIter.add(1, 'day');
                        }

                        // A week is only counted as a "Calendar Week" for this month if it has enough school days
                        if (schoolDaysInMonth >= threshold) {
                            totalWeeksCount++;

                            // 2. Check if this specific week is non-effective (Blocked by Agenda)
                            const blockingHoliday = allHolidays.find(h => {
                                const hStart = moment(h.startDate || h.start_date || h.date).startOf('day');
                                const hEnd = moment(h.endDate || h.end_date || h.date).startOf('day');
                                const overlapStart = moment.max(currentWeek, hStart);
                                const overlapEnd = moment.min(weekEnd, hEnd);
                                if (overlapEnd.isBefore(overlapStart)) return false;

                                const overlapDays = overlapEnd.diff(overlapStart, 'days') + 1;
                                return overlapDays >= threshold;
                            });

                            if (blockingHoliday) {
                                nonEffectiveCount++;
                                const title = blockingHoliday.name || blockingHoliday.title;
                                if (title && !holidayNotes.includes(title)) holidayNotes.push(title);
                            }
                        }
                        currentWeek.add(1, 'week');
                    }

                    return {
                        ...m,
                        totalWeeks: totalWeeksCount,
                        nonEffectiveWeeks: nonEffectiveCount,
                        keterangan: holidayNotes.join(', '),
                        isAuto: true
                    };
                });
                return updatedMonths;
            });
            isInternalChange.current = true;
            toast.success("Berhasil sinkronisasi sinkronisasi 'Pakar Kurikulum': Jumlah pekan dan libur telah diperbarui.");
        } catch (error) {
            console.error("Sync error:", error);
            toast.error("Gagal sinkronisasi kalender.");
        } finally {
            setLoading(false);
        }
    };

    // Apply to All Grades Handler
    const handleApplyToAllGrades = async () => {
        if (!levels || levels.length <= 1) {
            toast.error("Tidak ada tingkat kelas lain untuk disalin.");
            return;
        }

        if (!window.confirm(`Apakah Anda yakin ingin menyalin pengaturan Pekan Efektif ini ke SEMUA KELAS LAIN (${levels.filter(l => l !== grade).join(', ')})? \n\nTindakan ini akan menimpa data Pekan Efektif di kelas lain.`)) {
            return;
        }

        setLoading(true);
        try {
            const promises = levels.map(lvl => {
                if (lvl === grade) return Promise.resolve(); // Skip current

                return api.post('/teaching-programs', {
                    type: 'calendar_structure',
                    academic_year: year,
                    semester: semester,
                    grade_level: lvl,
                    pekan_efektif: months
                });
            });

            await Promise.all(promises);
            toast.success(`Berhasil menyalin data ke kelas: ${levels.filter(l => l !== grade).join(', ')}`);
        } catch (error) {
            console.error("Apply All error:", error);
            toast.error("Gagal menyalin data ke semua kelas.");
        } finally {
            setLoading(false);
        }
    };

    const handleSyncWeeksWithCalendar = () => {
        // This is now redundant as handleSyncWithCalendar handles both, 
        // but let's keep it as an alias or simplified version
        handleSyncWithCalendar();
    };


    const handleExportExcel = () => {
        try {
            // 1. Header & Metadata Section
            const header = [
                ['DISTRIBUSI ALOKASI WAKTU (PEKAN EFEKTIF)'],
                [`Satuan Pendidikan: ${userProfile?.school || userProfile?.schoolName || '-'}`],
                [`Mata Pelajaran: ${subject}`],
                [`Kelas: ${grade}`],
                [`Tahun Ajaran: ${year}`],
                [`Semester: ${semester}`],
                [], // Spacer
                ['Bulan', 'Jumlah Pekan', 'Pekan Tidak Efektif', 'Pekan Efektif', 'Keterangan']
            ];

            // 2. Table Data
            const tableData = months.map(m => [
                m.name,
                parseInt(m.totalWeeks || 0),
                parseInt(m.nonEffectiveWeeks || 0),
                (parseInt(m.totalWeeks || 0) - parseInt(m.nonEffectiveWeeks || 0)),
                m.keterangan
            ]);

            // 3. Summary Row
            const summaryRow = [
                'TOTAL',
                months.reduce((a, b) => a + parseInt(b.totalWeeks || 0), 0),
                months.reduce((a, b) => a + parseInt(b.nonEffectiveWeeks || 0), 0),
                totalEffectiveWeeks,
                `Total Jam Efektif: ${totalEffectiveHours} JP`
            ];

            const finalData = [...header, ...tableData, summaryRow];
            const ws = XLSX.utils.aoa_to_sheet(finalData);

            // 4. Set Column Widths (wch = characters)
            ws['!cols'] = [
                { wch: 15 }, // Bulan
                { wch: 15 }, // Jml Pekan
                { wch: 20 }, // Pekan Tidak Efektif
                { wch: 15 }, // Pekan Efektif
                { wch: 40 }, // Keterangan
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pekan Efektif");

            const fileName = `Pekan-Efektif-${subject}-${grade}-${year.replace('/', '-')}.xlsx`;
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, fileName);
            toast.success("Excel Pekan Efektif berhasil diunduh!");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Gagal mengekspor ke Excel.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margins = { top: 20, right: 20, bottom: 20, left: 25 }; // Requested margins

            // 1. Title & Metadata
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('DISTRIBUSI ALOKASI WAKTU (PEKAN EFEKTIF)', pageWidth / 2, margins.top, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            let yPos = margins.top + 10;
            const lineHeight = 5;

            doc.text(`Satuan Pendidikan: ${userProfile?.school || userProfile?.schoolName || '-'}`, margins.left, yPos); yPos += lineHeight;
            doc.text(`Mata Pelajaran: ${subject}`, margins.left, yPos); yPos += lineHeight;
            doc.text(`Kelas / Semester: ${grade} / ${semester}`, margins.left, yPos); yPos += lineHeight;
            doc.text(`Tahun Ajaran: ${year}`, margins.left, yPos); yPos += lineHeight + 5;

            // 2. Calculation Summary Box
            doc.setFillColor(240, 246, 255); // light blue
            doc.rect(margins.left, yPos, pageWidth - (margins.left + margins.right), 15, 'F');
            doc.setFont('helvetica', 'bold');
            doc.text(`KALKULASI JAM EFEKTIF:`, margins.left + 5, yPos + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(`${jpPerWeek} JP/Minggu  ×  ${totalEffectiveWeeks} Pekan Efektif  =  ${totalEffectiveHours} JP (Total Jam Efektif)`, margins.left + 5, yPos + 11);
            yPos += 20;

            // 3. Table
            const head = [['Bulan', 'Jml Pekan', 'Tdk Efektif', 'Efektif', 'Keterangan']];
            const body = months.map(m => [
                m.name,
                m.totalWeeks,
                m.nonEffectiveWeeks,
                (parseInt(m.totalWeeks || 0) - parseInt(m.nonEffectiveWeeks || 0)),
                m.keterangan || ''
            ]);

            // Add Summary Row
            body.push([
                { content: 'TOTAL', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: months.reduce((a, b) => a + parseInt(b.totalWeeks || 0), 0), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: months.reduce((a, b) => a + parseInt(b.nonEffectiveWeeks || 0), 0), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalEffectiveWeeks, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: `Total: ${totalEffectiveHours} JP`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            autoTable(doc, {
                startY: yPos,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235], halign: 'center' }, // blue-600
                styles: { fontSize: 9, cellPadding: 3 },
                margin: margins, // Apply Global Margins to Table
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: 25, halign: 'center' },
                    4: { cellWidth: 'auto' }
                }
            });

            // 4. Signature Section
            // Ensure signature doesn't break page weirdly
            let finalY = doc.lastAutoTable.finalY + 20;
            if (finalY > pageHeight - 50) {
                doc.addPage();
                finalY = margins.top;
            }

            const leftColX = margins.left + 15;
            const rightColX = pageWidth - margins.right - 50;

            doc.setFontSize(10);
            // Left Column (Principal)
            doc.text('Mengetahui,', leftColX, finalY, { align: 'center' });
            doc.text('Kepala Sekolah', leftColX, finalY + 5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.principalName || '( ..................................... )', leftColX, finalY + 30, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.principalNip || '.....................................'}`, leftColX, finalY + 35, { align: 'center' });

            // Right Column (Teacher)
            const location = signingLocation || 'Jakarta';
            doc.text(`${location}, ${moment().format('DD MMMM YYYY')}`, rightColX, finalY, { align: 'center' });
            doc.text('Guru Mata Pelajaran', rightColX, finalY + 5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.name || '( ..................................... )', rightColX, finalY + 30, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.nip || '.....................................'}`, rightColX, finalY + 35, { align: 'center' });

            const fileName = `Pekan-Efektif-${subject}-${grade}-${year.replace('/', '-')}.pdf`;
            doc.save(fileName);
            toast.success("PDF Pekan Efektif berhasil diunduh!");
        } catch (error) {
            console.error("PDF error:", error);
            toast.error("Gagal membuat PDF.");
        }
    };

    const handleExportWord = () => {
        const rows = months.map(m => `
            <tr>
                <td>${m.name}</td>
                <td class="text-center">${m.totalWeeks}</td>
                <td class="text-center">${m.nonEffectiveWeeks}</td>
                <td class="text-center">${parseInt(m.totalWeeks || 0) - parseInt(m.nonEffectiveWeeks || 0)}</td>
                <td>${m.keterangan || ''}</td>
            </tr>
        `).join('');

        // Summary Rows
        const totalWeeks = months.reduce((a, b) => a + parseInt(b.totalWeeks || 0), 0);
        const totalNon = months.reduce((a, b) => a + parseInt(b.nonEffectiveWeeks || 0), 0);

        const summaryRow = `
            <tr style="background-color: #f0f0f0; font-weight: bold;">
                <td>TOTAL</td>
                <td class="text-center">${totalWeeks}</td>
                <td class="text-center">${totalNon}</td>
                <td class="text-center">${totalEffectiveWeeks}</td>
                <td>Total: ${totalEffectiveHours} JP</td>
            </tr>
        `;

        const html = `
            <h1>DISTRIBUSI ALOKASI WAKTU (PEKAN EFEKTIF)</h1>
            <table style="border: none; width: 100%; margin-bottom: 20px;">
                <tr>
                    <td style="border: none; width: 150px;">Satuan Pendidikan</td>
                    <td style="border: none; width: 10px;">:</td>
                    <td style="border: none;">${userProfile?.school || userProfile?.schoolName || '-'}</td>
                </tr>
                <tr>
                    <td style="border: none;">Mata Pelajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${subject}</td>
                </tr>
                <tr>
                    <td style="border: none;">Kelas / Semester</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${grade} / ${semester}</td>
                </tr>
                 <tr>
                    <td style="border: none;">Tahun Ajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${year}</td>
                </tr>
            </table>
            
            <div style="background-color: #e6f3ff; padding: 10px; border: 1px solid #b3d7ff; margin-bottom: 20px;">
                <strong>KALKULASI JAM EFEKTIF:</strong><br>
                ${jpPerWeek} JP/Minggu × ${totalEffectiveWeeks} Pekan Efektif = ${totalEffectiveHours} JP (Total Jam Efektif)
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Bulan</th>
                        <th>Jml Pekan</th>
                        <th>Tdk Efektif</th>
                        <th>Efektif</th>
                        <th>Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    ${summaryRow}
                </tbody>
            </table>

            <table class="signature-table">
                <tr>
                    <td>
                        Mengetahui,<br>
                        Kepala Sekolah<br>
                        <div class="signature-name">${userProfile?.principalName || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.principalNip || '.....................................'}</div>
                    </td>
                    <td>
                        ${signingLocation || userProfile?.school?.split(' ')[1] || 'Indonesia'}, ${moment().format('DD MMMM YYYY')}<br>
                        Guru Mata Pelajaran<br>
                        <div class="signature-name">${userProfile?.name || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.nip || '.....................................'}</div>
                    </td>
                </tr>
            </table>
        `;

        const fileName = `Pekan-Efektif-${subject}-${grade}-${year.replace('/', '-')}.docx`;
        exportToDocx(html, fileName);
    };

    const updateMonth = (index, field, value) => {
        isInternalChange.current = true; // Mark as internal edit
        const newMonths = [...months];
        newMonths[index][field] = value;
        setMonths(newMonths);
    };

    const totalEffectiveWeeks = months.reduce((acc, curr) => acc + (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0)), 0);
    const totalEffectiveHours = totalEffectiveWeeks * jpPerWeek; // Calculate total effective hours

    return (
        <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="text-center md:text-left">
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-100">Kalkulasi Jam Efektif</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                        Pekan Efektif x JP per Minggu
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group flex flex-col items-center">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">JP / Minggu</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min="0"
                                value={jpPerWeek || 0}
                                onChange={(e) => {
                                    isInternalChange.current = true;
                                    setJpPerWeek(e.target.value);
                                }}
                                className="w-16 md:w-20 p-2 text-center text-lg font-bold text-blue-700 bg-white border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                                onClick={handleSyncJP}
                                title="Sinkronkan JP dari Jadwal Mengajar"
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 bg-white shadow-sm"
                            >
                                <RefreshCw size={16} />
                            </button>
                            <button
                                onClick={handleSyncWithCalendar}
                                title="Sinkronkan Pekan dengan Kalender Pendidikan (Agenda)"
                                className="flex items-center gap-2 px-3 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm ml-2"
                            >
                                <Calendar size={16} />
                                <span className="hidden sm:inline">Sinkron Kalender</span>
                            </button>
                            <button
                                onClick={handleApplyToAllGrades}
                                title="Salin pengaturan ini ke semua tingkat kelas lain"
                                className="flex items-center gap-2 px-3 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-sm ml-2"
                            >
                                <span className="hidden sm:inline font-semibold">Salin ke Semua Kelas</span>
                                <span className="sm:hidden font-bold">Salin</span>
                            </button>
                        </div>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-gray-400">×</div>
                    <div className="text-center">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Pekan Efektif</div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalEffectiveWeeks}</div>
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-gray-400">=</div>
                    <div className="text-center bg-white dark:bg-gray-700 px-3 py-1.5 md:px-4 md:py-1 rounded border border-blue-200 dark:border-blue-600 shadow-sm">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Total Jam Efektif</div>
                        <div className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">{totalEffectiveHours} JP</div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="px-3 md:px-6 py-3 border-r">Bulan</th>
                            <th className="px-3 md:px-6 py-3 border-r text-center">Jml Pekan</th>
                            <th className="px-3 md:px-6 py-3 border-r text-center">Pekan Tidak Efektif</th>
                            <th className="px-3 md:px-6 py-3 border-r text-center">Pekan Efektif</th>
                            <th className="px-3 md:px-6 py-3">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {months.map((month, index) => (
                            <tr key={month.name} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white border-r">
                                    {month.name}
                                </td>
                                <td className="px-4 py-2 border-r text-center">
                                    <input
                                        type="number"
                                        min="0"
                                        value={month.totalWeeks || 0}
                                        onChange={(e) => updateMonth(index, 'totalWeeks', e.target.value)}
                                        className="w-16 p-1 text-center border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </td>
                                <td className="px-4 py-2 border-r text-center">
                                    <input
                                        type="number"
                                        min="0"
                                        value={month.nonEffectiveWeeks || 0}
                                        onChange={(e) => updateMonth(index, 'nonEffectiveWeeks', e.target.value)}
                                        className={`w-16 p-1 text-center border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${month.isAuto ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : ''}`}
                                        title={month.isAuto ? "Terisi otomatis dari Kalender" : ""}
                                    />
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-blue-600 border-r">
                                    {(parseInt(month.totalWeeks || 0) - parseInt(month.nonEffectiveWeeks || 0))}
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="text"
                                        placeholder="Contoh: Libur Semester"
                                        value={month.keterangan || ''}
                                        onChange={(e) => updateMonth(index, 'keterangan', e.target.value)}
                                        className="w-full p-1 border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                            <td className="px-6 py-4 border-r">TOTAL</td>
                            <td className="px-6 py-4 border-r text-center">{months.reduce((a, b) => a + parseInt(b.totalWeeks || 0), 0)}</td>
                            <td className="px-6 py-4 border-r text-center">{months.reduce((a, b) => a + parseInt(b.nonEffectiveWeeks || 0), 0)}</td>
                            <td className="px-6 py-4 border-r text-center text-blue-700 dark:text-blue-400 text-lg">
                                {totalEffectiveWeeks}
                            </td>
                            <td className="px-6 py-4"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Info Kebijakan */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 border-dashed">
                <div className="flex items-center gap-3 text-blue-800 dark:text-blue-200">
                    <Workflow size={20} className="shrink-0" />
                    <div>
                        <p className="text-sm font-bold">Kebijakan Belajar: {userProfile?.school_days || 6} Hari Kerja</p>
                        <p className="text-xs opacity-80">
                            Pekan dianggap <b>Tidak Efektif</b> jika terdapat minimal <b>{parseInt(userProfile?.school_days || 6) === 5 ? '3' : '4'} hari</b> agenda/libur dalam sepekan.
                        </p>
                    </div>
                </div>
            </div>

            <SignatureSection userProfile={userProfile} signingLocation={signingLocation} />

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center no-print pt-4 border-t dark:border-gray-700 gap-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                        <FileSpreadsheet size={16} />
                        PDF
                    </button>
                    <button
                        onClick={handleExportWord}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                        <FileText size={16} />
                        Word
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                        <FileSpreadsheet size={16} />
                        Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition text-sm font-semibold"
                    >
                        <Printer size={16} />
                        Cetak
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 shadow-md font-bold"
                >
                    <Save size={18} />
                    {loading ? 'Menyimpan...' : 'Simpan Data'}
                </button>
            </div>
        </div>
    );
};

const ProtaView = ({ grade, subject, semester, year, activeTab, userProfile, signingLocation, sharedEfektifData, subjects }) => {
    const [protaData, setProtaData] = useState([]);
    const [targetJP, setTargetJP] = useState(0); // Total effective hours needed
    const [loading, setLoading] = useState(false);
    const [programId, setProgramId] = useState(null);
    const [isLocked, setIsLocked] = useState(true); // Default to locked for safety

    // Live Sync Target JP from Shared State
    useEffect(() => {
        if (sharedEfektifData && sharedEfektifData.totalEffectiveHours > 0) {
            setTargetJP(sharedEfektifData.totalEffectiveHours);
        }
    }, [sharedEfektifData]);

    useEffect(() => {
        let ignore = false;
        const fetchData = async () => {
            setLoading(true);
            try {
                const subjectObj = subjects.find(s => s.name === subject);
                if (!subjectObj) {
                    setProtaData([{ id: 1, elemen: '', materi: '', jp: 0 }]);
                    setLoading(false);
                    return;
                }

                const res = await api.get('/teaching-programs', {
                    params: {
                        type: 'subject_program',
                        grade_level: grade,
                        subject_id: subjectObj.id,
                        semester: semester,
                        academic_year: year
                    }
                });

                if (ignore) return;

                const programData = (res.data.data || res.data || [])[0] || {};

                // Load Prota Items
                if (programData.prota) {
                    setProtaData(programData.prota);
                } else {
                    setProtaData([{ id: 1, elemen: '', materi: '', jp: 0 }]);
                }

                // JP Target Resolution
                if (sharedEfektifData && sharedEfektifData.totalEffectiveHours > 0) {
                    setTargetJP(sharedEfektifData.totalEffectiveHours);
                } else if (programData.total_effective_hours) {
                    setTargetJP(Number(programData.total_effective_hours));
                } else {
                    setTargetJP(0);
                }
            } catch (error) {
                console.error("Error fetching Prota:", error);
                toast.error("Gagal memuat data Prota.");
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        fetchData();
        return () => { ignore = true; };
    }, [grade, subject, semester, year, activeTab, sharedEfektifData, subjects]);

    const addRow = () => {
        const newId = protaData.length > 0 ? Math.max(...protaData.map(d => d.id)) + 1 : 1;
        setProtaData([...protaData, { id: newId, elemen: '', materi: '', jp: 0 }]);
    };

    const deleteRow = (id) => {
        setProtaData(protaData.filter(d => d.id !== id));
    };

    const updateRow = (id, field, value) => {
        setProtaData(protaData.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleSyncFromATP = async () => {
        setLoading(true);
        try {
            const subjectObj = subjects.find(s => s.name === subject);
            if (!subjectObj) return;

            const atpRes = await api.get('/teaching-programs', {
                params: {
                    type: 'atp_document',
                    grade_level: grade,
                    subject_id: subjectObj.id,
                    semester: semester,
                    academic_year: year
                }
            });

            const atpData = (atpRes.data.data || atpRes.data || [])[0];

            if (atpData && atpData.atp_items) {
                const atpItems = atpData.atp_items;
                const mappedProta = atpItems.map((item, index) => ({
                    id: index + 1,
                    elemen: item.elemen || '',
                    materi: item.materi || '',
                    kd: item.tp || '',
                    jp: parseInt(item.jp || 0),
                    profilLulusan: item.profilLulusan || ''
                }));
                setProtaData(mappedProta);
                toast.success(`Berhasil sinkronisasi ${mappedProta.length} baris dari ATP!`);
            } else {
                toast.error("Data ATP tidak ditemukan. Silakan buat ATP terlebih dahulu.");
            }
        } catch (error) {
            console.error("Error syncing from ATP:", error);
            toast.error("Gagal sinkronisasi data dari ATP.");
        } finally {
            setLoading(false);
        }
    };

    const totalJP = protaData.reduce((acc, curr) => acc + parseInt(curr.jp || 0), 0);

    const handleSave = async () => {
        const subjectObj = subjects.find(s => s.name === subject);
        if (!subjectObj) return;

        // Validation with strict Number casting to avoid string vs number mismatch
        if (Number(totalJP) !== Number(targetJP)) {
            toast.error(`Validasi Gagal: Total JP(${totalJP}) harus sama dengan Jam Efektif(${targetJP}).`);
            return;
        }

        setLoading(true);
        try {
            await api.post('/teaching-programs', {
                type: 'subject_program',
                subject_id: subjectObj.id,
                grade_level: grade,
                academic_year: year,
                semester: semester,
                prota: protaData,
                total_effective_hours: targetJP
            });
            toast.success("Data Program Tahunan tersimpan!");
        } catch (error) {
            console.error("Error saving Prota:", error);
            toast.error("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };

    const handleExportWord = () => {
        const rows = protaData.map((row, index) => `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${row.elemen || '-'}</td>
                <td>${row.materi}</td>
                <td>${row.kd}</td>
                <td class="text-center">${row.jp}</td>
                <td>${row.profilLulusan || '-'}</td>
            </tr>
        `).join('');

        const html = `
            <h1>PROGRAM TAHUNAN (PROTA)</h1>
            <table style="border: none; width: 100%; margin-bottom: 20px;">
                <tr>
                    <td style="border: none; width: 150px;">Satuan Pendidikan</td>
                    <td style="border: none; width: 10px;">:</td>
                    <td style="border: none;">${userProfile?.school || userProfile?.schoolName || '-'}</td>
                </tr>
                <tr>
                    <td style="border: none;">Mata Pelajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${subject}</td>
                </tr>
                <tr>
                    <td style="border: none;">Kelas / Semester</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${grade} / ${semester}</td>
                </tr>
                 <tr>
                    <td style="border: none;">Tahun Ajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${year}</td>
                </tr>
            </table>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">No</th>
                        <th style="width: 150px;">Elemen</th>
                        <th style="width: 200px;">Lingkup Materi</th>
                        <th style="width: 300px;">Tujuan Pembelajaran</th>
                        <th style="width: 50px;">JP</th>
                        <th style="width: 150px;">Profil Lulusan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                    <tr style="font-weight: bold; background-color: #f0f0f0;">
                         <td colspan="4" class="text-center">TOTAL</td>
                         <td class="text-center">${totalJP}</td>
                         <td></td>
                    </tr>
                </tbody>
            </table>

            <table class="signature-table">
                <tr>
                    <td>
                        Mengetahui,<br>
                        Kepala Sekolah<br>
                        <div class="signature-name">${userProfile?.principalName || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.principalNip || '.....................................'}</div>
                    </td>
                    <td>
                        ${signingLocation || userProfile?.school?.split(' ')[1] || 'Jakarta'}, ${moment().format('DD MMMM YYYY')}<br>
                        Guru Mata Pelajaran<br>
                        <div class="signature-name">${userProfile?.name || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.nip || '.....................................'}</div>
                    </td>
                </tr>
            </table>
        `;

        const fileName = `Prota-${subject}-${grade}-${year.replace('/', '-')}.docx`;
        exportToDocx(html, fileName);
    };

    const handleExportExcel = () => {
        try {
            // 1. Header Section
            const header = [
                ['PROGRAM TAHUNAN (PROTA)'],
                ['No', 'Elemen', 'Lingkup Materi', 'Tujuan Pembelajaran', 'Alokasi Waktu (JP)', 'Profil Lulusan']
            ];

            // 2. Table Data
            const tableData = protaData.map((row, index) => [
                index + 1,
                row.elemen,
                row.materi,
                row.kd,
                parseInt(row.jp || 0),
                row.profilLulusan || '-'
            ]);

            // 3. Summary
            const summaryRow = ['TOTAL', '', '', '', totalJP, ''];

            const finalData = [...header, ...tableData, summaryRow];
            const ws = XLSX.utils.aoa_to_sheet(finalData);

            // 4. Formatting
            ws['!cols'] = [
                { wch: 5 },  // No
                { wch: 25 }, // Elemen
                { wch: 25 }, // Materi
                { wch: 40 }, // KD
                { wch: 10 }, // JP
                { wch: 25 }  // Profil Lulusan
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Program Tahunan");

            const fileName = `Prota - ${subject} -${grade} -${year.replace('/', '-')}.xlsx`;
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, fileName);
            toast.success("Excel Prota berhasil diunduh!");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Gagal mengekspor Prota.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();

            doc.setFontSize(14);
            doc.text('PROGRAM TAHUNAN (PROTA)', 105, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.text(`Satuan Pendidikan: ${userProfile?.school || userProfile?.schoolName || '-'}`, 14, 25);
            doc.text(`Mata Pelajaran: ${subject}`, 14, 30);
            doc.text(`Kelas: ${grade}`, 14, 35);
            doc.text(`Tahun Ajaran: ${year}`, 14, 40);

            const head = [['No', 'Elemen', 'Lingkup Materi', 'Tujuan Pembelajaran', 'JP', 'Profil Lulusan']];
            const body = protaData.map((row, index) => [
                index + 1,
                row.elemen,
                row.materi,
                row.kd,
                row.jp,
                row.profilLulusan || '-'
            ]);

            body.push([
                { content: 'TOTAL', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
                { content: totalJP, styles: { fontStyle: 'bold', halign: 'center' } },
                { content: '', styles: {} }
            ]);

            autoTable(doc, {
                startY: 40,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235] },
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 40 },
                    3: { cellWidth: 60 },
                    4: { cellWidth: 15, halign: 'center' },
                    5: { cellWidth: 35 }
                }
            });

            doc.save(`Prota-${subject}-${grade}-${year.replace('/', '-')}.pdf`);
            toast.success("PDF Prota berhasil diunduh!");
        } catch (error) {
            console.error("PDF error:", error);
            toast.error("Gagal membuat PDF Prota.");
        }
    };

    const isMatch = totalJP === targetJP;
    const isOver = totalJP > targetJP;



    return (
        <div className="space-y-6">
            <div className={`flex flex-col md:flex-row justify-between items-center gap-4 p-4 rounded-lg border ${targetJP === 0 ? 'bg-blue-50 border-blue-200' :
                isMatch ? 'bg-green-50 border-green-200' :
                    isOver ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Total Alokasi Waktu</p>
                    <div className="flex items-baseline gap-2">
                        <p className={`text-2xl font-bold ${targetJP === 0 ? 'text-blue-600' :
                            isMatch ? 'text-green-600' :
                                isOver ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                            {totalJP} JP
                        </p>
                        {targetJP > 0 && (
                            <span className="text-sm text-gray-500">
                                / {targetJP} JP (Target)
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${isLocked
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                            }`}
                        title={isLocked ? "Buka Kunci untuk Mengedit" : "Kunci Data Prota"}
                    >
                        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        {isLocked ? 'Buka Kunci' : 'Kunci Data'}
                    </button>
                    <button
                        onClick={handleSyncFromATP}
                        disabled={loading || isLocked}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:shadow-md transition shadow-sm ${isLocked ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                        <Zap size={16} />
                        Sinkronkan dari ATP
                    </button>
                    <button
                        onClick={addRow}
                        disabled={isLocked}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={16} />
                        Tambah Baris
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 border-b dark:border-gray-600">
                        <tr>
                            <th className="px-4 py-3 w-12">No</th>
                            <th className="px-4 py-3 w-1/4">Elemen</th>
                            <th className="px-4 py-3 w-1/4">Lingkup Materi</th>
                            <th className="px-4 py-3">Tujuan Pembelajaran</th>
                            <th className="px-4 py-3 w-28 text-center">Alokasi (JP)</th>
                            <th className="px-4 py-3 w-[15%]">Profil Lulusan</th>
                            <th className="px-4 py-3 w-20 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {protaData.map((row, index) => (
                            <tr key={row.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                <td className="px-4 py-3 text-center text-gray-400 font-medium">{index + 1}</td>
                                <td className="px-3 py-2 border-r dark:border-gray-700">
                                    <textarea
                                        rows="2"
                                        value={row.elemen || ''}
                                        placeholder={isLocked ? "" : "Elemen (CP)..."}
                                        readOnly={isLocked}
                                        onChange={(e) => updateRow(row.id, 'elemen', e.target.value)}
                                        className={`w-full p-2 text-sm border-none bg-transparent focus:ring-1 focus:ring-blue-500 rounded resize-none dark:text-white outline-none ${isLocked ? 'cursor-default' : ''}`}
                                    />
                                </td>
                                <td className="px-3 py-2 border-r dark:border-gray-700">
                                    <textarea
                                        rows="2"
                                        value={row.materi || ''}
                                        placeholder={isLocked ? "" : "Lingkup Materi..."}
                                        readOnly={isLocked}
                                        onChange={(e) => updateRow(row.id, 'materi', e.target.value)}
                                        className={`w-full p-2 text-sm border-none bg-transparent focus:ring-1 focus:ring-blue-500 rounded resize-none dark:text-white outline-none ${isLocked ? 'cursor-default' : ''}`}
                                    />
                                </td>
                                <td className="px-3 py-2 border-r dark:border-gray-700">
                                    <textarea
                                        rows="2"
                                        value={row.kd || ''}
                                        placeholder={isLocked ? "" : "Tujuan Pembelajaran (TP)..."}
                                        readOnly={isLocked}
                                        onChange={(e) => updateRow(row.id, 'kd', e.target.value)}
                                        className={`w-full p-2 text-sm border-none bg-transparent focus:ring-1 focus:ring-blue-500 rounded resize-none dark:text-white outline-none ${isLocked ? 'cursor-default' : ''}`}
                                    />
                                </td>
                                <td className="px-4 py-2">
                                    <input
                                        type="number"
                                        min="0"
                                        value={row.jp || 0}
                                        readOnly={isLocked}
                                        onChange={(e) => updateRow(row.id, 'jp', e.target.value)}
                                        className={`w-full p-2 text-center font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${isLocked ? 'cursor-default bg-transparent text-gray-500' : ''}`}
                                    />
                                </td>
                                <td className="px-3 py-2 border-l dark:border-gray-700">
                                    <textarea
                                        rows="2"
                                        value={row.profilLulusan || ''}
                                        placeholder={isLocked ? "" : "Dimensi Profil..."}
                                        readOnly={isLocked}
                                        onChange={(e) => updateRow(row.id, 'profilLulusan', e.target.value)}
                                        className={`w-full p-2 text-sm border-none bg-transparent focus:ring-1 focus:ring-blue-500 rounded resize-none dark:text-white outline-none ${isLocked ? 'cursor-default' : ''}`}
                                    />
                                </td>
                                <td className="px-4 py-2 text-center">
                                    <button
                                        onClick={() => deleteRow(row.id)}
                                        disabled={isLocked}
                                        className={`p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition ${isLocked ? 'opacity-0 pointer-events-none' : ''}`}
                                    >
                                        <Trash size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {protaData.length === 0 && (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                    Belum ada data. Klik tombol &quot;Tambah Baris&quot; untuk memulai.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <SignatureSection userProfile={userProfile} signingLocation={signingLocation} />

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center no-print pt-4 border-t dark:border-gray-700 gap-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                        <FileSpreadsheet size={16} />
                        PDF
                    </button>
                    <button
                        onClick={handleExportWord}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                        <FileText size={16} />
                        Word
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                        <FileSpreadsheet size={16} />
                        Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition text-sm font-semibold"
                    >
                        <Printer size={16} />
                        Cetak
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition disabled:bg-blue-300 transform active:scale-95"
                >
                    <Save size={18} />
                    {loading ? 'Menyimpan...' : 'Simpan Prota'}
                </button>
            </div>
        </div >
    );
};

const PromesView = ({ grade, subject, semester, year, schedules, activeTab, userProfile, signingLocation, sharedEfektifData, subjects }) => {
    const [protaSource, setProtaSource] = useState([]);
    // Point 7: Init with template to avoid empty view
    const getInitialTemplate = () => {
        const semesterMonths = semester === 'Ganjil'
            ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
            : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
        return semesterMonths.map(m => ({ name: m, totalWeeks: 4, nonEffectiveWeeks: 0, keterangan: '' }));
    };

    const [pekanEfektifSource, setPekanEfektifSource] = useState(getInitialTemplate());
    const [promesData, setPromesData] = useState({});
    const [userHolidays, setUserHolidays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [programId, setProgramId] = useState(null);

    // Sync from Shared Data (Parent) in real-time
    useEffect(() => {
        if (sharedEfektifData && sharedEfektifData.pekanEfektif && sharedEfektifData.pekanEfektif.length > 0) {
            setPekanEfektifSource(sharedEfektifData.pekanEfektif);
        }
    }, [sharedEfektifData]);

    useEffect(() => {
        let ignore = false;
        const fetchData = async () => {
            // Reset state to template instead of []
            setLoading(true);
            setProtaSource([]);
            setPekanEfektifSource(getInitialTemplate());
            setPromesData({});

            try {
                const subjectObj = subjects.find(s => s.name === subject);
                if (!subjectObj) return;

                // 1. Calendar Structure & Program Data (Prota & Promes)
                const [calRes, progRes, hRes] = await Promise.all([
                    api.get('/teaching-programs', {
                        params: {
                            type: 'calendar_structure',
                            grade_level: grade,
                            semester: semester,
                            academic_year: year
                        }
                    }),
                    api.get('/teaching-programs', {
                        params: {
                            type: 'subject_program',
                            grade_level: grade,
                            subject_id: subjectObj.id,
                            semester: semester,
                            academic_year: year
                        }
                    }),
                    api.get('/holidays')
                ]);

                if (ignore) return;

                const calData = (calRes.data.data || calRes.data || [])[0] || {};
                const progData = (progRes.data.data || progRes.data || [])[0] || {};

                // Calendar Structure (Shared -> Fallback to Doc -> Template)
                if (calData.pekan_efektif) {
                    setPekanEfektifSource(calData.pekan_efektif);
                } else if (progData.pekan_efektif) {
                    setPekanEfektifSource(progData.pekan_efektif);
                }

                // Program Data (Prota & Promes)
                if (progData.prota) setProtaSource(progData.prota);
                if (progData.promes) setPromesData(progData.promes);

                // Holidays (Store only MANUAL ones for highlighting/blocking in Promes)
                const allHolidays = hRes.data.data || hRes.data || [];
                const manualHolidays = allHolidays.filter(h => h.type === 'manual');
                setUserHolidays(manualHolidays);

            } catch (error) {
                console.error("Error fetching Promes data:", error);
                toast.error("Gagal memuat data Program Semester.");
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        fetchData();
        return () => { ignore = true; };
    }, [grade, subject, semester, year, activeTab, subjects]);

    const getHolidayForWeek = (monthName, wIndex) => {
        const monthNum = MONTH_MAP[monthName];
        if (!monthNum) return null;

        // Determine actual year for this month based on Academic Year (e.g., 2025/2026)
        const years = year.split('/');
        const actualYear = monthNum >= 7 ? years[0] : years[1];

        // Approximate week dates (Basic logic: 1-7, 8-14, 15-21, 22-end)
        const weekStart = moment(`${actualYear}-${monthNum}-${(wIndex * 7) + 1}`, 'YYYY-MM-D').startOf('day');
        const weekEnd = weekStart.clone().add(6, 'days').endOf('day');

        const holiday = (userHolidays || []).find(h => {
            // CRITICAL: Only include manual school agendas (semester breaks, exams, etc.)
            // as requested by the user. National/Public holidays are ignored in Promes.
            if (h.type !== 'manual') return false;

            const hStart = moment(h.startDate || h.date).startOf('day');
            const hEnd = moment(h.endDate || h.date).endOf('day');
            // Overlaps if hStart <= weekEnd AND hEnd >= weekStart
            return hStart.isSameOrBefore(weekEnd) && hEnd.isSameOrAfter(weekStart);
        });

        if (!holiday) return null;

        // Calculate overlap duration to determine if it should block the week
        const hStart = moment(holiday.startDate || holiday.date).startOf('day');
        const hEnd = moment(holiday.endDate || holiday.date).endOf('day');
        const overlapStart = moment.max(weekStart, hStart);
        const overlapEnd = moment.min(weekEnd, hEnd);
        const overlapDays = overlapEnd.diff(overlapStart, 'days') + 1;

        return {
            ...holiday,
            isBlocking: overlapDays >= (parseInt(userProfile?.school_days || 6) === 5 ? 3 : 4)
        };
    };

    const handleSave = async () => {
        const subjectObj = subjects.find(s => s.name === subject);
        if (!subjectObj) return;

        // Validation: Check if distributed JP matches Prota JP
        const errors = [];
        protaSource.forEach(row => {
            let distributedSum = 0;
            pekanEfektifSource.forEach((month, mIndex) => {
                const weekCount = parseInt(month.totalWeeks || 4);
                for (let w = 0; w < weekCount; w++) {
                    const key = `${row.id}_${mIndex}_${w}`;
                    const val = parseInt(promesData[key] || 0);
                    distributedSum += val;
                }
            });

            if (distributedSum !== parseInt(row.jp)) {
                errors.push(`KD ${row.kd.substring(0, 20)}... (Target: ${row.jp} JP, Terisi: ${distributedSum} JP)`);
            }
        });

        if (errors.length > 0) {
            toast.error("Validasi Gagal: Total distribusi JP harus sama dengan Alokasi Prota.");
            errors.slice(0, 3).forEach(err => toast.error(err));
            if (errors.length > 3) toast.error(`...dan ${errors.length - 3} lainnya.`);
            return;
        }

        setLoading(true);
        try {
            // Cleanup: remove values in blocked weeks (manual agendas) before saving
            const cleanedData = { ...promesData };
            protaSource.forEach(row => {
                pekanEfektifSource.forEach((month, mIndex) => {
                    const totalWeeks = parseInt(month.totalWeeks || 4);

                    for (let w = 0; w < totalWeeks; w++) {
                        const cellKey = `${row.id}_${mIndex}_${w}`;
                        const holiday = getHolidayForWeek(month.name, w);

                        // Blocking trigger: Only school agendas (holidays) that cover significant part of week
                        if (holiday?.isBlocking && cleanedData[cellKey]) {
                            delete cleanedData[cellKey];
                        }
                    }
                });
            });

            await api.post('/teaching-programs', {
                type: 'subject_program',
                subject_id: subjectObj.id,
                grade_level: grade,
                academic_year: year,
                semester: semester,
                promes: cleanedData
            });

            setPromesData(cleanedData); // Sync state with cleaned data
            toast.success("Hore! Data Program Semester berhasil disimpan dan dibersihkan.");
        } catch (error) {
            console.error("Error saving Promes:", error);
            toast.error("Gagal menyimpan data.");
        } finally {
            setLoading(false);
        }
    };


    const handleExportWord = () => {
        // Build Header for Months
        let monthHeader = '';
        let weekHeader = '';
        pekanEfektifSource.forEach(m => {
            monthHeader += `<th colspan="${m.totalWeeks || 4}" class="text-center">${m.name}</th>`;
            for (let w = 1; w <= (m.totalWeeks || 4); w++) {
                weekHeader += `<th class="text-center" style="min-width: 25px;">${w}</th>`;
            }
        });

        // Build Rows
        const rows = protaSource.map((row, index) => {
            let cells = '';
            pekanEfektifSource.forEach((m, mIndex) => {
                for (let w = 0; w < (m.totalWeeks || 4); w++) {
                    const cellKey = `${row.id}_${mIndex}_${w}`;
                    const holiday = getHolidayForWeek(m.name, w);
                    const val = promesData[cellKey];

                    let bgStyle = '';
                    let content = '';

                    if (holiday && holiday.isBlocking) {
                        bgStyle = 'background-color: #ffebee; color: #c62828; font-size: 8pt; writing-mode: vertical-rl; text-orientation: mixed;';
                        content = holiday.label; // Simpler for word
                    } else if (val) {
                        bgStyle = 'background-color: #e8f5e9; font-weight: bold;';
                        content = val;
                    }

                    cells += `<td style="${bgStyle} text-align: center;">${content || ''}</td>`;
                }
            });

            return `
                <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${row.elemen}</td>
                    <td>${row.materi}</td>
                    <td class="text-center">${row.jp}</td>
                    ${cells}
                </tr>
            `;
        }).join('');

        const html = `
            <h1>PROGRAM SEMESTER (PROMES)</h1>
            <table style="border: none; width: 100%; margin-bottom: 20px;">
                <tr>
                    <td style="border: none; width: 150px;">Satuan Pendidikan</td>
                    <td style="border: none; width: 10px;">:</td>
                    <td style="border: none;">${userProfile?.school || userProfile?.schoolName || '-'}</td>
                </tr>
                <tr>
                    <td style="border: none;">Mata Pelajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${subject}</td>
                </tr>
                <tr>
                    <td style="border: none;">Kelas / Semester</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${grade} / ${semester}</td>
                </tr>
                 <tr>
                    <td style="border: none;">Tahun Ajaran</td>
                    <td style="border: none;">:</td>
                    <td style="border: none;">${year}</td>
                </tr>
            </table>

            <table style="font-size: 9pt;">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 30px;">No</th>
                        <th rowspan="2" style="width: 150px;">Elemen</th>
                        <th rowspan="2" style="width: 250px;">Lingkup Materi</th>
                        <th rowspan="2" style="width: 40px;">JP</th>
                        ${monthHeader}
                    </tr>
                    <tr>
                        ${weekHeader}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <div style="margin-top: 20px; font-size: 9pt;">
                <strong>KETERANGAN PEKAN TIDAK EFEKTIF & HARI LIBUR:</strong>
                <table style="width: 100%; border: none; margin-top: 5px;">
                    ${pekanEfektifSource.map((month) => {
            const monthAgendas = [];
            const totalWeeks = parseInt(month.totalWeeks || 4);
            for (let w = 0; w < totalWeeks; w++) {
                const h = getHolidayForWeek(month.name, w);
                if (h && h.isBlocking) {
                    const label = h.name || h.title;
                    if (!monthAgendas.some(a => a.label === label)) {
                        monthAgendas.push({ week: w + 1, label });
                    }
                }
            }
            if (monthAgendas.length === 0) return '';
            return `
                            <tr>
                                <td style="border: none; width: 100px; font-weight: bold;">${month.name}</td>
                                <td style="border: none; width: 10px;">:</td>
                                <td style="border: none;">${monthAgendas.map(a => `P${a.week} (${a.label})`).join(', ')}</td>
                            </tr>
                        `;
        }).join('')}
                </table>
                <p style="font-size: 8pt; font-style: italic; margin-top: 10px;">* Berdasarkan kebijakan sekolah ${userProfile?.school_days || 6} hari kerja.</p>
            </div>

            <table class="signature-table">
                <tr>
                    <td>
                        Mengetahui,<br>
                        Kepala Sekolah<br>
                        <div class="signature-name">${userProfile?.principalName || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.principalNip || '.....................................'}</div>
                    </td>
                    <td>
                        ${signingLocation || userProfile?.school?.split(' ')[1] || 'Indonesia'}, ${moment().format('DD MMMM YYYY')}<br>
                        Guru Mata Pelajaran<br>
                        <div class="signature-name">${userProfile?.name || '( ..................................... )'}</div>
                        <div>NIP. ${userProfile?.nip || '.....................................'}</div>
                    </td>
                </tr>
            </table>
        `;

        const fileName = `Promes-${subject}-${grade}-${year.replace('/', '-')}.docx`;
        exportToDocx(html, fileName, { orientation: 'landscape' });
    };

    const handleExportExcel = () => {
        try {
            // 1. Header Section
            const headerInfo = [
                ['PROGRAM SEMESTER (PROMES)'],
                [`Satuan Pendidikan: ${userProfile?.school || userProfile?.schoolName || '-'}`],
                [`Mata Pelajaran: ${subject}`],
                [`Kelas: ${grade}`],
                [`Tahun Ajaran: ${year}`],
                [`Semester: ${semester}`],
                [] // Spacer
            ];

            // 2. Prepare Table Header (Months and Week Numbers)
            const headers1 = ['', '', '']; // Space for No, KD, Alokasi
            const headers2 = ['No', 'Tujuan Pembelajaran / Lingkup Materi', 'Alokasi (JP)'];

            pekanEfektifSource.forEach(month => {
                const weekCount = parseInt(month.totalWeeks || 4);
                headers1.push(month.name);
                for (let i = 1; i < weekCount; i++) headers1.push(''); // Span month cell
                for (let i = 1; i <= weekCount; i++) headers2.push(`P${i} `);
            });

            // 3. Rows
            const rows = protaSource.map((row, index) => {
                const excelRow = [index + 1, `${row.kd}\n${row.materi}`, parseInt(row.jp || 0)];
                pekanEfektifSource.forEach((month, mIndex) => {
                    const weekCount = parseInt(month.totalWeeks || 4);
                    for (let w = 0; w < weekCount; w++) {
                        const val = promesData[`${row.id}_${mIndex}_${w}`] || '';
                        const holiday = getHolidayForWeek(month.name, w);
                        excelRow.push(holiday?.isBlocking ? 'OFF' : val);
                    }
                });
                return excelRow;
            });

            const finalData = [...headerInfo, headers1, headers2, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(finalData);

            // 4. Merge monthly header cells (offset by headerInfo length)
            const offset = headerInfo.length;
            const merges = [];
            let currentCol = 3;
            pekanEfektifSource.forEach(month => {
                const weekCount = parseInt(month.totalWeeks || 4);
                if (weekCount > 1) {
                    merges.push({ s: { r: offset, c: currentCol }, e: { r: offset, c: currentCol + weekCount - 1 } });
                }
                currentCol += weekCount;
            });
            ws['!merges'] = merges;

            // 5. Formatting (wch = characters)
            const colWidths = [
                { wch: 5 },  // No
                { wch: 60 }, // KD / Materi
                { wch: 12 }, // JP
            ];
            // Add narrow widths for week columns
            for (let i = 0; i < 40; i++) colWidths.push({ wch: 5 });
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Program Semester");

            const fileName = `Promes-${subject}-${grade}-${semester}-${year.replace('/', '-')}.xlsx`;
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, fileName);
            toast.success("Excel Promes berhasil diunduh!");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Gagal mengekspor Promes.");
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margins = { top: 20, right: 10, bottom: 20, left: 15 };

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('PROGRAM SEMESTER (PROMES)', pageWidth / 2, margins.top, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            let yPos = margins.top + 10;
            const lineHeight = 5;

            doc.text(`Satuan Pendidikan: ${userProfile?.school || userProfile?.schoolName || '-'}`, margins.left, yPos);
            doc.text(`Mata Pelajaran: ${subject}`, margins.left, yPos + lineHeight);
            doc.text(`Kelas / Semester: ${grade} / ${semester}`, pageWidth / 2, yPos);
            doc.text(`Tahun Ajaran: ${year}`, pageWidth / 2, yPos + lineHeight);
            yPos += 15;

            // Prepare Headers
            const monthHeaders = [];
            const weekHeaders = [];

            // Base columns
            const baseHeader = [
                { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Tujuan Pembelajaran', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
                { content: 'Lingkup Materi', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
                { content: 'JP', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
            ];

            // Generated columns
            pekanEfektifSource.forEach(m => {
                monthHeaders.push({ content: m.name, colSpan: m.totalWeeks || 4, styles: { halign: 'center' } });
                for (let w = 1; w <= (m.totalWeeks || 4); w++) {
                    weekHeaders.push({ content: w.toString(), styles: { halign: 'center', cellWidth: 6 } });
                }
            });

            // Prepare Body
            const body = protaSource.map((row, index) => {
                const rowData = [
                    index + 1,
                    row.kd,
                    row.materi,
                    row.jp
                ];

                pekanEfektifSource.forEach((m, mIndex) => {
                    for (let w = 0; w < (m.totalWeeks || 4); w++) {
                        const cellKey = `${row.id}_${mIndex}_${w}`;
                        const holiday = getHolidayForWeek(m.name, w);
                        const val = promesData[cellKey];

                        let cellContent = '';
                        let cellStyle = { halign: 'center' };

                        if (holiday && holiday.isBlocking) {
                            cellContent = 'L'; // Libur
                            cellStyle = { fillColor: [255, 235, 238], textColor: [198, 40, 40] };
                        } else if (val) {
                            cellContent = 'X'; // Ada Jadwal
                            cellStyle = { fillColor: [232, 245, 233], fontStyle: 'bold' };
                        }

                        rowData.push({ content: cellContent, styles: cellStyle });
                    }
                });
                return rowData;
            });

            autoTable(doc, {
                startY: yPos,
                head: [
                    [...baseHeader, ...monthHeaders],
                    weekHeaders
                ],
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [37, 99, 235], halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
                styles: { fontSize: 7, cellPadding: 1, lineWidth: 0.1, lineColor: [200, 200, 200] },
                margin: margins,
                columnStyles: {
                    0: { cellWidth: 8 },
                    1: { cellWidth: 20 }, // KD
                    2: { cellWidth: 35 }, // Materi
                    3: { cellWidth: 8 }   // JP
                }
            });

            // Add Administrative Notes for PDF
            let currentY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('KETERANGAN PEKAN TIDAK EFEKTIF & HARI LIBUR:', margins.left, currentY);
            currentY += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            pekanEfektifSource.forEach((month) => {
                const monthAgendas = [];
                const totalWeeks = parseInt(month.totalWeeks || 4);
                for (let w = 0; w < totalWeeks; w++) {
                    const h = getHolidayForWeek(month.name, w);
                    if (h && h.isBlocking) {
                        const label = h.name || h.title;
                        if (!monthAgendas.some(a => a.label === label)) {
                            monthAgendas.push({ week: w + 1, label });
                        }
                    }
                }
                if (monthAgendas.length > 0) {
                    const text = `${month.name}: ${monthAgendas.map(a => `P${a.week} (${a.label})`).join(', ')}`;
                    doc.text(text, margins.left, currentY);
                    currentY += 4;
                }
            });
            doc.setFont('helvetica', 'italic');
            doc.text(`* Berdasarkan kebijakan sekolah ${userProfile?.school_days || 6} hari kerja.`, margins.left, currentY + 2);

            // Signature Section
            let finalY = doc.lastAutoTable.finalY + 20;
            if (finalY > pageHeight - 50) {
                doc.addPage();
                finalY = margins.top;
            }

            const leftColX = margins.left + 15;
            const rightColX = pageWidth - margins.right - 50;

            doc.setFontSize(10);
            doc.text('Mengetahui,', leftColX, finalY, { align: 'center' });
            doc.text('Kepala Sekolah', leftColX, finalY + 5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.principalName || '( ..................................... )', leftColX, finalY + 30, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.principalNip || '.....................................'}`, leftColX, finalY + 35, { align: 'center' });

            const location = signingLocation || userProfile?.school?.split(' ')[1] || 'Jakarta';
            doc.text(`${location}, ${moment().format('DD MMMM YYYY')}`, rightColX, finalY, { align: 'center' });
            doc.text('Guru Mata Pelajaran', rightColX, finalY + 5, { align: 'center' });
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.name || '( ..................................... )', rightColX, finalY + 30, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.nip || '.....................................'}`, rightColX, finalY + 35, { align: 'center' });


            const fileName = `Promes-${subject}-${grade}-${year.replace('/', '-')}.pdf`;
            doc.save(fileName);
            toast.success("PDF Promes berhasil diunduh!");
        } catch (error) {
            console.error("PDF error:", error);
            toast.error("Gagal membuat PDF.");
        }
    };


    const updateCell = (protaId, monthIndex, weekIndex, value) => {
        const key = `${protaId}_${monthIndex}_${weekIndex}`;
        setPromesData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleAutoDistribute = () => {
        if (!protaSource.length || !pekanEfektifSource.length) {
            toast.error("Lengkapi data Prota dan Pekan Efektif terlebih dahulu.");
            return;
        }

        // --- ENHANCED JP DETECTION ---
        let weeklyJP = 0;

        // 1. Try to use data from Pekan Efektif tab first (Most accurate if already filled)
        if (sharedEfektifData && sharedEfektifData.jpPerWeek > 0) {
            weeklyJP = sharedEfektifData.jpPerWeek;
        } else {
            const targetSubjectObj = subjects.find(s => s.name === subject);
            const getAltGrade = (g) => {
                const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
                const rev = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
                return map[g] || rev[g] || g;
            };
            const altGrade = getAltGrade(grade);

            const matchingSchedules = (schedules || []).filter(s => {
                const className = typeof s.class === 'string' ? s.class : s.class?.rombel;

                // Precise Regex Matching (Handles "Kelas 1", "Kelas VII", etc. and avoids Grade 1 matching Class 11)
                const gradePattern = new RegExp(`^(?:KELAS\\s+)?(?:${grade}${altGrade ? '|' + altGrade : ''})(?![0-9])`, 'i');
                const isGradeMatch = className && gradePattern.test(className.trim());

                // 1. Try ID matching first
                if (targetSubjectObj?.id && s.subjectId) {
                    return s.subjectId === targetSubjectObj.id && isGradeMatch;
                }

                // 2. Fallback to name matching
                const sSubject = (s.subject || '').trim().toLowerCase();
                const targetSubject = (subject || '').trim().toLowerCase();
                return sSubject === targetSubject && isGradeMatch;
            });

            if (matchingSchedules.length > 0) {
                const firstClassName = typeof matchingSchedules[0].class === 'string' ? matchingSchedules[0].class : matchingSchedules[0].class.rombel;
                weeklyJP = matchingSchedules
                    .filter(s => (typeof s.class === 'string' ? s.class : s.class.rombel) === firstClassName)
                    .reduce((acc, s) => acc + (parseInt(s.endPeriod) - parseInt(s.startPeriod) + 1), 0);
            }
        }

        if (weeklyJP === 0) {
            toast.error("Gagal mendeteksi JP per minggu dari jadwal. Silakan isi jadwal mengajar terlebih dahulu.");
            return;
        }

        const newPromesData = {};
        let currentM = 0;
        let currentW = 0;

        protaSource.forEach(row => {
            let remainingJP = parseInt(row.jp);
            while (remainingJP > 0) {
                // Find next effective month/week (Skip manual agendas)
                while (currentM < pekanEfektifSource.length) {
                    const month = pekanEfektifSource[currentM];
                    const totalWeeks = parseInt(month.totalWeeks || 4);
                    // Critical: Get the user-inputted non-effective count (or auto-calculated)
                    const allowedNonEffective = parseInt(month.nonEffectiveWeeks || 0);

                    // Check if this SPECIFIC week is a holiday
                    const holiday = getHolidayForWeek(month.name, currentW);
                    const isHolidayWeek = holiday && holiday.isBlocking;

                    // ADVANCED LOGIC:
                    // 1. If it's a specific holiday week -> SKIP IT (Primary Rule)
                    // 2. If we need to skip MORE weeks to match "allowedNonEffective" count (e.g. user manually added buffer),
                    //    we fall back to skipping from the end.

                    // But first, let's count how many specific holidays exist in this month
                    let specificHolidaysCount = 0;
                    for (let w = 0; w < totalWeeks; w++) {
                        if (getHolidayForWeek(month.name, w)?.isBlocking) specificHolidaysCount++;
                    }

                    // Determine if current week should be skipped
                    let shouldSkip = false;

                    if (isHolidayWeek) {
                        shouldSkip = true;
                    } else {
                        // If no specific holiday here, do we still need to skip to meet the quota?
                        // Only if we haven't found enough specific holidays to explain the "nonEffectiveWeeks" count
                        // We treat extra non-effective weeks as "End of Month" buffers (Cadangan/TryOut/Ujian)

                        // Example: User inputs 3 non-effective weeks. Calendar has 1 holiday.
                        // specificHolidaysCount = 1
                        // extraNonEffective = 3 - 1 = 2
                        // We need to skip 2 extra weeks from the end.

                        const extraNonEffective = Math.max(0, allowedNonEffective - specificHolidaysCount);

                        // Logic to skip from end:
                        // If totalWeeks = 5, extra = 2. We skip week 3 and 4 (indices 3, 4).
                        // wait, weeks are 0-indexed. Indices: 0, 1, 2, 3, 4.
                        // Target indices to skip: 3, 4.
                        // Condition: currentW >= (5 - 2) => currentW >= 3. Correct.

                        if (currentW >= (totalWeeks - extraNonEffective)) {
                            shouldSkip = true;
                        }
                    }

                    if (!shouldSkip) {
                        break; // Found a clean effective week
                    } else {
                        currentW++;
                        if (currentW >= totalWeeks) {
                            currentW = 0;
                            currentM++;
                            if (currentM >= pekanEfektifSource.length) break;
                        }
                    }
                }

                if (currentM >= pekanEfektifSource.length) break;

                const key = `${row.id}_${currentM}_${currentW}`;
                const fillValue = Math.min(remainingJP, weeklyJP);
                newPromesData[key] = fillValue.toString();
                remainingJP -= fillValue;

                // Move to next week
                currentW++;
                if (currentW >= parseInt(pekanEfektifSource[currentM].totalWeeks || 4)) {
                    currentW = 0;
                    currentM++;
                }
            }
        });

        setPromesData(newPromesData);
        toast.success(`Berhasil mendistribusikan JP secara otomatis (${weeklyJP} JP / minggu).`);
    };

    const handleKeyDown = (e, rIndex, mIndex, wIndex) => {
        const rowCount = protaSource.length;

        let nextR = rIndex;
        let nextM = mIndex;
        let nextW = wIndex;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            nextR = Math.max(0, rIndex - 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            nextR = Math.min(rowCount - 1, rIndex + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (wIndex > 0) {
                nextW = wIndex - 1;
            } else if (mIndex > 0) {
                nextM = mIndex - 1;
                nextW = parseInt(pekanEfektifSource[nextM].totalWeeks || 4) - 1;
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const currentMonthWeeks = parseInt(pekanEfektifSource[mIndex].totalWeeks || 4);
            if (wIndex < currentMonthWeeks - 1) {
                nextW = wIndex + 1;
            } else if (mIndex < pekanEfektifSource.length - 1) {
                nextM = mIndex + 1;
                nextW = 0;
            }
        } else {
            return;
        }

        const nextId = `promes-input-${nextR}-${nextM}-${nextW}`;
        const nextEl = document.getElementById(nextId);
        if (nextEl) nextEl.focus();
    };

    if (protaSource.length === 0 || pekanEfektifSource.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200">Data Belum Lengkap</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                    Untuk menyusun Program Semester, mohon lengkapi data <b>Pekan Efektif</b> dan <b>Program Tahunan (Prota)</b> terlebih dahulu.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 text-center md:text-left">
                    <Calendar className="text-blue-600 shrink-0" size={24} />
                    <div>
                        <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">Susun Program Semester</h3>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Distribusikan alokasi waktu tahunan ke dalam pekan efektif</p>
                    </div>
                </div>
                <button
                    onClick={handleAutoDistribute}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-bold transition-all shadow-sm"
                >
                    <Zap size={16} />
                    Auto-Distribusi
                </button>
            </div>

            <div className="relative overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                {/* Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/60 dark:bg-gray-800/60 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                            <span className="text-sm font-bold text-blue-900 dark:text-blue-100">Memuat Data...</span>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="bg-blue-600 text-white uppercase font-bold sticky top-0 z-30">
                            <tr>
                                <th rowSpan="2" className="px-2 py-3 border border-blue-500 w-10 md:w-12 min-w-[2.5rem] md:min-w-[3rem] sticky left-0 z-40 bg-blue-600 md:sticky">No</th>
                                <th rowSpan="2" className="px-2 md:px-4 py-3 border border-blue-500 min-w-[200px] md:min-w-[350px] text-left md:sticky md:left-12 z-40 bg-blue-600 md:shadow-md">Tujuan Pembelajaran / Lingkup Materi</th>
                                <th rowSpan="2" className="px-1 md:px-2 py-3 border border-blue-500 w-20 md:w-24 min-w-[5rem] md:min-w-[6rem] md:sticky md:left-[398px] z-40 bg-blue-600 md:shadow-md">
                                    Alokasi<br />(Target / Isi)
                                </th>
                                {pekanEfektifSource.map((month) => (
                                    <th key={month.name} colSpan={month.totalWeeks || 4} className="px-2 py-2 border border-blue-500 min-w-[120px]">
                                        {month.name}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                {pekanEfektifSource.map((month, mIndex) => {
                                    const weekCount = parseInt(month.totalWeeks || 4);
                                    return Array.from({ length: weekCount }).map((_, wIndex) => (
                                        <th key={`${mIndex}-${wIndex}`} className="px-1 py-1 border border-blue-500 w-8 bg-blue-700 min-w-[30px]">
                                            {wIndex + 1}
                                        </th>
                                    ));
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                            {!loading && protaSource.map((row, index) => {
                                // Calculate current sum for this row
                                let currentSum = 0;
                                pekanEfektifSource.forEach((month, mIndex) => {
                                    const count = parseInt(month.totalWeeks || 4);
                                    for (let w = 0; w < count; w++) {
                                        currentSum += parseInt(promesData[`${row.id}_${mIndex}_${w}`] || 0);
                                    }
                                });

                                const isMatch = currentSum === parseInt(row.jp);
                                const isOver = currentSum > parseInt(row.jp);

                                return (
                                    <tr key={row.id}>
                                        <td className="border border-gray-200 dark:border-gray-700 p-2 sticky left-0 bg-white dark:bg-gray-800 z-20 md:sticky">{index + 1}</td>
                                        <td className="border border-gray-200 dark:border-gray-700 p-2 text-left md:sticky md:left-12 bg-white dark:bg-gray-800 z-20 md:shadow-md min-w-[200px] md:min-w-[350px]">
                                            <div className="font-semibold text-sm">{row.kd}</div>
                                            <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">{row.materi}</div>
                                        </td>
                                        <td className={`border border-gray-200 dark:border-gray-700 p-2 font-bold md:sticky md:left-[398px] z-20 md:shadow-md ${isMatch ? 'bg-green-100 dark:bg-green-900/50 text-green-700' : isOver ? 'bg-red-100 dark:bg-red-900/50 text-red-700' : 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700'}`}>
                                            {row.jp} / {currentSum}
                                        </td>

                                        {pekanEfektifSource.map((month, mIndex) => {
                                            const weekCount = parseInt(month.totalWeeks || 4);
                                            return Array.from({ length: weekCount }).map((_, wIndex) => {
                                                const cellKey = `${row.id}_${mIndex}_${wIndex}`;
                                                const val = promesData[cellKey] || '';
                                                const hasValue = val !== '' && val !== '0';

                                                const monthData = pekanEfektifSource[mIndex];
                                                const totalWeeks = parseInt(monthData.totalWeeks || 4);
                                                const nonEffectiveWeeks = parseInt(monthData.nonEffectiveWeeks || 0);

                                                // Determine Holiday Status (Manual agendas only as per user request)
                                                const holiday = getHolidayForWeek(month.name, wIndex);
                                                const isHoliday = !!holiday;
                                                const isBlockingHoliday = isHoliday && holiday.isBlocking;

                                                // Determine if it's a non-effective week from the counter (Tab 1)
                                                const isManualNonEffective = !isHoliday && wIndex >= (totalWeeks - nonEffectiveWeeks);

                                                // Determine Background Color
                                                // Selective highlighting for school agendas (type: manual)
                                                let cellBg = '';

                                                if (hasValue) {
                                                    cellBg = 'bg-green-50 dark:bg-green-900/30';
                                                } else if (isHoliday) {
                                                    // Only school agendas (from dropdown categories) trigger OFF blocking
                                                    const holidayCat = holiday ? (holiday.category || '').toLowerCase() : '';
                                                    const holidayName = isHoliday ? (holiday.name || '').toLowerCase() : '';

                                                    if (holidayCat.includes('semester') || holidayName.includes('semester')) cellBg = 'bg-red-50 dark:bg-red-900/40 opacity-80';
                                                    else if (holidayCat.includes('ujian') || holidayName.includes('ujian')) cellBg = 'bg-orange-100 dark:bg-orange-900/40 opacity-80';
                                                    else if (holidayCat === 'tengah_semester' || holidayName.includes('tengah semester')) cellBg = 'bg-purple-50 dark:bg-purple-900/40 opacity-80';
                                                    else cellBg = 'bg-blue-50 dark:bg-blue-900/30 opacity-80'; // Default for other manual activities
                                                }

                                                return (
                                                    <td
                                                        key={cellKey}
                                                        title={holiday ? holiday.name : isManualNonEffective ? 'Pekan Tidak Efektif (Manual)' : ''}
                                                        className={`border border-gray-200 dark:border-gray-700 p-0 hover:bg-gray-50 group relative ${cellBg}`}
                                                    >
                                                        {!isBlockingHoliday ? (
                                                            <input
                                                                id={`promes-input-${index}-${mIndex}-${wIndex}`}
                                                                type="text"
                                                                value={val}
                                                                onChange={(e) => updateCell(row.id, mIndex, wIndex, e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, index, mIndex, wIndex)}
                                                                className="w-full h-8 text-center bg-transparent focus:ring-1 focus:ring-blue-500 outline-none font-medium text-[11px]"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-8 flex items-center justify-center font-bold text-[10px] text-gray-400">OFF</div>
                                                        )}
                                                        {/* Tooltip hint for all holidays (even short ones) is handled by the 'title' attribute on <td> */}
                                                    </td>
                                                );
                                            });
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Keterangan Kode Warna Pekan Tidak Efektif */}
            <div className="mt-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1">
                        <h4 className="font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wider">Legenda Warna & Status:</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-green-50 dark:bg-green-900/30 border border-green-200 rounded-md"></div>
                                <span className="text-gray-600 dark:text-gray-400">Belajar Efektif (Tatap Muka)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-red-50 dark:bg-red-900/40 border border-red-200 rounded-md opacity-80 flex items-center justify-center font-bold text-[10px] text-red-600">OFF</div>
                                <span className="text-gray-600 dark:text-gray-400">Pekan Tidak Efektif (Libur/Agenda)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-purple-50 dark:bg-purple-900/40 border border-purple-200 rounded-md opacity-80"></div>
                                <span className="text-gray-600 dark:text-gray-400">Penilaian Tengah Semester (PTS)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/40 border border-orange-200 rounded-md opacity-80"></div>
                                <span className="text-gray-600 dark:text-gray-400">Penilaian Akhir Semester (PAS/PAT)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 border-l border-gray-200 dark:border-gray-700 pl-6">
                        <h4 className="font-bold mb-3 text-gray-700 dark:text-gray-300 uppercase tracking-wider">Catatan Administrasi (Agenda Sekolah):</h4>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                            {pekanEfektifSource.some(m => m.keterangan || (userHolidays || []).some(h => getHolidayForWeek(m.name, 0)?.id === h.id)) ? (
                                pekanEfektifSource.map((month, mIdx) => {
                                    const monthAgendas = [];
                                    const totalWeeks = parseInt(month.totalWeeks || 4);
                                    for (let w = 0; w < totalWeeks; w++) {
                                        const h = getHolidayForWeek(month.name, w);
                                        if (h && h.isBlocking) {
                                            const label = h.name || h.title;
                                            if (!monthAgendas.some(a => a.label === label)) {
                                                monthAgendas.push({ week: w + 1, label });
                                            }
                                        }
                                    }

                                    if (monthAgendas.length === 0) return null;

                                    return (
                                        <div key={mIdx} className="flex gap-2 text-gray-600 dark:text-gray-400">
                                            <span className="font-bold min-w-[70px]">{month.name}:</span>
                                            <span>{monthAgendas.map(a => `P${a.week} (${a.label})`).join(', ')}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-gray-400 italic">Tidak ada agenda sekolah yang memblokir pekan efektif di semester ini.</p>
                            )}
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 italic">
                            * Berdasarkan kebijakan sekolah {userProfile?.school_days || 6} hari kerja.
                        </div>
                    </div>
                </div>
            </div>

            <SignatureSection userProfile={userProfile} signingLocation={signingLocation} />

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center no-print pt-4 border-t dark:border-gray-700 gap-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                    >
                        <FileText size={16} />
                        PDF
                    </button>
                    <button
                        onClick={handleExportWord}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                    >
                        <FileText size={16} />
                        Word
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                    >
                        <FileSpreadsheet size={16} />
                        Excel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition text-sm font-semibold"
                    >
                        <Printer size={16} />
                        Cetak
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 shadow-lg font-bold"
                >
                    <Save size={18} />
                    {loading ? 'Menyimpan...' : 'Simpan Promes'}
                </button>
            </div>
        </div>
    );
};


const ATPView = ({ grade, subject, semester, year, userProfile, signingLocation, schedules, sharedEfektifData, subjects }) => {
    const { geminiModel } = useSettings();
    const [atpItems, setAtpItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [docId, setDocId] = useState(null);
    const [generationProgress, setGenerationProgress] = useState({ stage: '', message: '', percentage: 0 });

    const [manualTotalJP, setManualTotalJP] = useState(0);
    const [manualJpPerWeek, setManualJpPerWeek] = useState(0);
    const [manualTotalWeeks, setManualTotalWeeks] = useState(0);

    // Sync from Shared Data (Parent)
    useEffect(() => {
        if (sharedEfektifData) {
            if (sharedEfektifData.totalEffectiveHours > 0) setManualTotalJP(sharedEfektifData.totalEffectiveHours);
            if (sharedEfektifData.jpPerWeek > 0) setManualJpPerWeek(sharedEfektifData.jpPerWeek);
            if (sharedEfektifData.totalEffectiveWeeks > 0) setManualTotalWeeks(sharedEfektifData.totalEffectiveWeeks);
        }
    }, [sharedEfektifData]);

    useEffect(() => {
        let isAborted = false;
        const fetchData = async () => {
            // POINT 21: Force high-priority sync from sharedEfektifData (Live calculated data)
            if (sharedEfektifData && sharedEfektifData.totalEffectiveHours > 0) {
                setManualTotalJP(sharedEfektifData.totalEffectiveHours);
                setManualJpPerWeek(sharedEfektifData.jpPerWeek);
                setManualTotalWeeks(sharedEfektifData.totalEffectiveWeeks);
            }

            setLoading(true);
            try {
                const subjectObj = subjects.find(s => s.name === subject);
                if (!subjectObj) {
                    setLoading(false);
                    return;
                }

                // Load ATP Document
                const atpRes = await api.get('/teaching-programs', {
                    params: {
                        type: 'atp_document',
                        grade_level: grade,
                        subject_id: subjectObj.id,
                        semester: semester,
                        academic_year: year
                    }
                });

                if (isAborted) return;

                const atpData = (atpRes.data.data || atpRes.data || [])[0] || {};
                if (atpData.atp_items) {
                    setAtpItems(atpData.atp_items);
                } else {
                    setAtpItems([]);
                }

                // If shared data is missing OR incomplete, only then fallback to DB for JP (from subject_program)
                if (!sharedEfektifData || !sharedEfektifData.totalEffectiveHours) {
                    const progRes = await api.get('/teaching-programs', {
                        params: {
                            type: 'subject_program',
                            grade_level: grade,
                            subject_id: subjectObj.id,
                            semester: semester,
                            academic_year: year
                        }
                    });

                    if (isAborted) return;

                    const programData = (progRes.data.data || progRes.data || [])[0] || {};
                    setManualTotalJP(programData.total_effective_hours || 0);
                    setManualJpPerWeek(programData.jp_per_week || 0);
                    setManualTotalWeeks(programData.total_effective_weeks || 0);
                }
            } catch (error) {
                console.error("Error loading ATP:", error);
                toast.error("Gagal memuat data ATP.");
            } finally {
                if (!isAborted) setLoading(false);
            }
        };
        fetchData();
        return () => { isAborted = true; };
    }, [grade, subject, semester, year, sharedEfektifData, subjects]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGenerationProgress({ stage: 'init', message: 'Memulai koneksi ke sistem pakar...', percentage: 5 });
        try {
            const subjectObj = subjects.find(s => s.name === subject);

            // 1. Fetch Existing RPPs for Context
            const rppRes = await api.get('/ai/rpp-history', {
                params: {
                    grade_level: grade,
                    subject_id: subjectObj?.id
                }
            });
            const rppList = rppRes.data.data || rppRes.data || [];
            const existingRPPs = Array.isArray(rppList) ? rppList.map(rpp => rpp.topic || rpp.materi).filter(Boolean) : [];

            const result = await generateATP({
                subject,
                gradeLevel: grade,
                semester,
                totalJP: manualTotalJP,
                jpPerWeek: manualJpPerWeek,
                totalWeeks: manualTotalWeeks,
                modelName: geminiModel,
                existingRPPs: existingRPPs,
                userProfile: userProfile,
                onProgress: (progress) => setGenerationProgress(progress)
            });

            if (Array.isArray(result)) {
                setAtpItems(result);

                // POST-GENERATION VALIDATION
                const totalAI = result.reduce((acc, cur) => acc + (Number(cur.jp) || 0), 0);
                if (totalAI !== Number(manualTotalJP)) {
                    toast.error(`Perhatian: Total JP AI (${totalAI}) tidak sesuai target (${manualTotalJP}). Mohon sesuaikan manual sebelum simpan.`, { duration: 6000 });
                } else {
                    toast.success(`ATP Disusun! (Sinkron dengan ${existingRPPs.length} RPP yang ada)`);
                }
            } else {
                toast.error("Gagal format output AI tidak sesuai.");
            }
        } catch (error) {
            toast.error("Gagal generate ATP: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        const subjectObj = subjects.find(s => s.name === subject);
        if (!subjectObj) return;

        setLoading(true);
        try {
            await api.post('/teaching-programs', {
                type: 'atp_document',
                subject_id: subjectObj.id,
                grade_level: grade,
                semester: semester,
                academic_year: year,
                atp_items: atpItems
            });
            toast.success("ATP Berhasil disimpan!");
        } catch (error) {
            console.error("Error saving ATP:", error);
            toast.error("Gagal menyimpan ATP.");
        } finally {
            setLoading(false);
        }
    };



    const updateItem = (index, field, value) => {
        const newItems = [...atpItems];
        newItems[index][field] = value;
        setAtpItems(newItems);
    };

    const addItem = () => {
        setAtpItems([...atpItems, { no: atpItems.length + 1, elemen: '', materi: '', tp: '', jp: 0, profilLulusan: '' }]);
    };

    const removeItem = (index) => {
        const newItems = atpItems.filter((_, i) => i !== index);
        setAtpItems(newItems.map((item, i) => ({ ...item, no: i + 1 })));
    };

    // Export PDF Logic for ATP
    const handleExportPDFATP = () => {
        try {
            const doc = new jsPDF({ orientation: 'landscape' });

            doc.setFontSize(14);
            doc.text('ALUR TUJUAN PEMBELAJARAN (ATP)', 148, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.text(`Satuan Pendidikan: ${userProfile?.school || '-'}`, 14, 25);
            doc.text(`Mata Pelajaran: ${subject}`, 14, 30);
            doc.text(`Kelas / Fase: ${grade}`, 14, 35);
            doc.text(`Tahun Ajaran: ${year}`, 14, 40);

            // Legal Foundations Section in PDF
            doc.setFont('helvetica', 'bold');
            doc.text('LANDASAN PENYUSUNAN ATP:', 14, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('- Permendikbudristek No. 12 Tahun 2024 (Kurikulum Nasional)', 14, 55);
            doc.text('- Permendikbudristek No. 16 Tahun 2022 (Standar Proses)', 14, 60);
            doc.text(`- ${BSKAP_DATA.standards.regulation} (Capaian Pembelajaran)`, 14, 65);
            doc.text('- Panduan Pembelajaran dan Asesmen (PPA) Edisi Revisi Terbaru', 14, 70);

            const head = [['No', 'Elemen', 'Materi', 'Tujuan Pembelajaran', 'JP', 'Profil Lulusan']];
            const body = atpItems.map(item => [
                item.no,
                item.elemen,
                item.materi || '-',
                item.tp,
                `${item.jp} JP`,
                item.profilLulusan || '-'
            ]);

            autoTable(doc, {
                startY: 75,
                head: head,
                body: body,
                theme: 'grid',
                headStyles: { fillColor: [126, 34, 206] }, // Purple-700
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 100 },
                    4: { cellWidth: 15, halign: 'center' },
                    5: { cellWidth: 60 }
                }
            });

            // Signatures
            const finalY = doc.lastAutoTable.finalY + 20;
            doc.text('Mengetahui,', 40, finalY);
            doc.text('Kepala Sekolah', 40, finalY + 5);
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.principalName || '................', 40, finalY + 25);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.principalNip || '.......'}`, 40, finalY + 30);

            const rightX = 220;
            doc.text(`${signingLocation}, ${new Date().toLocaleDateString('id-ID')}`, rightX, finalY);
            doc.text('Guru Mata Pelajaran', rightX, finalY + 5);
            doc.setFont('helvetica', 'bold');
            doc.text(userProfile?.name || '................', rightX, finalY + 25);
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${userProfile?.nip || '.......'}`, rightX, finalY + 30);

            doc.save(`ATP-${subject}-${grade}.pdf`);
            toast.success("PDF ATP berhasil diunduh!");
        } catch (error) {
            console.error("PDF error:", error);
            toast.error("Gagal membuat PDF ATP.");
        }
    };

    // Export Word Logic for ATP
    const handleExportWordATP = async () => {
        const rows = atpItems.map(item => `
            <tr>
                <td style="text-align:center">${item.no}</td>
                <td>${item.elemen}</td>
                <td>${item.materi || '-'}</td>
                <td>${item.tp}</td>
                <td style="text-align:center">${item.jp} JP</td>
                <td>${item.profilLulusan || '-'}</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif;">
                <h2 style="text-align: center;">ALUR TUJUAN PEMBELAJARAN (ATP)</h2>
                <h3 style="text-align: center;">SEMESTER ${semester.toUpperCase()}</h3>
                <div style="margin-bottom: 20px;">
                    <p><strong>Satuan Pendidikan:</strong> ${userProfile?.school || '-'}</p>
                    <p><strong>Mata Pelajaran:</strong> ${subject}</p>
                    <p><strong>Kelas / Fase:</strong> ${grade}</p>
                    <p><strong>Tahun Ajaran:</strong> ${year}</p>
                </div>
                
                <div style="margin-bottom: 20px; font-size: 10pt; border: 1px solid #ccc; padding: 10px; background-color: #fafafa;">
                    <strong>LANDASAN PENYUSUNAN ATP (DASAR HUKUM):</strong>
                    <ul style="margin: 5px 0;">
                        <li>Permendikbudristek No. 12 Tahun 2024 (Kurikulum Nasional)</li>
                        <li>Permendikbudristek No. 16 Tahun 2022 (Standar Proses)</li>
                        <li>${BSKAP_DATA.standards.regulation}</li>
                        <li>Panduan Pembelajaran dan Asesmen (PPA) Edisi Revisi Terbaru</li>
                    </ul>
                </div>

                <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f0f0f0;">
                            <th style="width: 5%;">No</th>
                            <th style="width: 15%;">Elemen</th>
                            <th style="width: 15%;">Materi</th>
                            <th style="width: 35%;">Tujuan Pembelajaran</th>
                            <th style="width: 10%;">JP</th>
                            <th style="width: 20%;">Profil Lulusan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                
                <table border="0" cellpadding="10" cellspacing="0" style="width: 100%; margin-top: 50px;">
                    <tr>
                        <td style="width: 50%; text-align: center; vertical-align: top;">
                            Mengetahui,<br>Kepala Sekolah<br><br><br><br>
                            <strong>${userProfile?.principalName || '................'}</strong><br>
                            NIP. ${userProfile?.principalNip || '.......'}
                        </td>
                        <td style="width: 50%; text-align: center; vertical-align: top;">
                            ${signingLocation}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br>Guru Mata Pelajaran<br><br><br><br>
                            <strong>${userProfile?.name || '................'}</strong><br>
                            NIP. ${userProfile?.nip || '.......'}
                        </td>
                    </tr>
                </table>
            </div>
        `;
        await exportToDocx(html, `ATP-${subject}-${grade}.docx`, { orientation: 'landscape' });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                    <h3 className="text-lg md:text-xl font-bold text-purple-800 dark:text-purple-100">Alur Tujuan Pembelajaran (ATP)</h3>
                    <p className="text-xs md:text-sm text-purple-600 dark:text-purple-300 max-w-2xl mt-1">
                        Pecah CP menjadi urutan tujuan yang logis. Gunakan AI untuk menyusun kerangka awal, lalu sesuaikan dengan kebutuhan kelas Anda.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full md:w-auto">
                    <div className="flex flex-col gap-1 flex-1 sm:flex-none">
                        <label className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Total JP (Semester Ini)</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg px-3 py-2 w-full sm:w-32 shadow-sm">
                            <input
                                type="number"
                                value={manualTotalJP || 0}
                                onChange={(e) => setManualTotalJP(parseInt(e.target.value) || 0)}
                                className="w-full bg-transparent font-bold text-center text-purple-800 dark:text-purple-100 outline-none text-sm"
                            />
                            <span className="text-xs font-bold text-gray-400">JP</span>
                        </div>
                    </div>

                    {isGenerating ? (
                        <div className="flex flex-col gap-1 w-full sm:w-64">
                            <div className="flex justify-between text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                                <span className="truncate max-w-[150px]">{generationProgress.message || 'Memproses...'}</span>
                                <span>{generationProgress.percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden border border-purple-100 dark:border-purple-900">
                                <div
                                    className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out relative"
                                    style={{ width: `${generationProgress.percentage}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 h-full min-h-[44px]"
                        >
                            <Zap size={18} />
                            <span className="text-sm md:text-base">Generate ATP Otomatis</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-sm">
                    <BookOpen size={18} />
                    LANDASAN PENYUSUNAN (DASAR HUKUM 2025)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span>Permendikbudristek No. 12 Tahun 2024 (Kurikulum Nasional)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span>Permendikbudristek No. 16 Tahun 2022 (Standar Proses)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span>{BSKAP_DATA.standards.regulation}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                        <span>Panduan Pembelajaran dan Asesmen (PPA) Edisi Revisi Terbaru</span>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">No</th>
                                <th className="px-4 py-3 w-[15%]">Elemen</th>
                                <th className="px-4 py-3 w-[15%]">Lingkup Materi</th>
                                <th className="px-4 py-3">Tujuan Pembelajaran (TP)</th>
                                <th className="px-4 py-3 w-24 text-center">JP</th>
                                <th className="px-4 py-3 w-[15%]">Profil Lulusan</th>
                                <th className="px-4 py-3 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atpItems.length > 0 ? (
                                atpItems.map((item, index) => (
                                    <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 text-center font-medium">{index + 1}</td>
                                        <td className="px-4 py-3 p-0 border-r dark:border-gray-700">
                                            <textarea
                                                value={item.elemen || ''}
                                                onChange={(e) => updateItem(index, 'elemen', e.target.value)}
                                                className="w-full bg-transparent border-none p-2 focus:ring-1 focus:ring-purple-500 rounded resize-none"
                                                rows={2}
                                                placeholder="Contoh: Bilangan"
                                            />
                                        </td>
                                        <td className="px-4 py-3 p-0 border-r dark:border-gray-700">
                                            <textarea
                                                value={item.materi || ''}
                                                onChange={(e) => updateItem(index, 'materi', e.target.value)}
                                                className="w-full bg-transparent border-none p-2 focus:ring-1 focus:ring-purple-500 rounded resize-none"
                                                rows={2}
                                                placeholder="Topik Pembahasan"
                                            />
                                        </td>
                                        <td className="px-4 py-3 p-0 border-r dark:border-gray-700">
                                            <textarea
                                                value={item.tp || ''}
                                                onChange={(e) => updateItem(index, 'tp', e.target.value)}
                                                className="w-full bg-transparent border-none p-2 focus:ring-1 focus:ring-purple-500 rounded resize-none h-full"
                                                rows={3}
                                                placeholder="Deskripsi tujuan pembelajaran..."
                                            />
                                        </td>
                                        <td className="px-4 py-3 p-0 border-r dark:border-gray-700">
                                            <input
                                                type="number"
                                                value={item.jp || 0}
                                                onChange={(e) => updateItem(index, 'jp', e.target.value)}
                                                className="w-full text-center bg-transparent border-none p-2 focus:ring-1 focus:ring-purple-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 p-0 border-r dark:border-gray-700">
                                            <textarea
                                                value={item.profilLulusan || ''}
                                                onChange={(e) => updateItem(index, 'profilLulusan', e.target.value)}
                                                className="w-full bg-transparent border-none p-2 focus:ring-1 focus:ring-purple-500 rounded resize-none"
                                                rows={2}
                                                placeholder="Dimensi..."
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition">
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">
                                        Belum ada data ATP. Klik tombol "Generate ATP Otomatis" di atas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                    <button onClick={addItem} className="text-purple-600 hover:text-purple-800 font-semibold text-sm flex items-center gap-1">
                        <Plus size={16} /> Tambah Baris Manual
                    </button>
                    <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
                        Total JP: {atpItems.reduce((acc, cur) => acc + parseInt(cur.jp || 0), 0)} JP
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t dark:border-gray-700 items-stretch sm:items-center">
                <button
                    onClick={handleExportPDFATP}
                    disabled={atpItems.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition font-semibold disabled:opacity-50"
                >
                    <Download size={18} /> Download PDF
                </button>
                <button
                    onClick={handleExportWordATP}
                    disabled={atpItems.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-semibold disabled:opacity-50"
                >
                    <Download size={18} /> Download Word
                </button>
                <button
                    onClick={handleSave}
                    disabled={loading || atpItems.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold shadow-md disabled:opacity-50"
                >
                    <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan ATP'}
                </button>
            </div>
        </div>
    );
};

export default ProgramMengajarPage;
