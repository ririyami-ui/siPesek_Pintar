import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../lib/axios';
import moment from 'moment';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        activeSemester: 'Ganjil',
        academicYear: '',
        geminiModel: 'gemini-3.1-flash-lite-preview',
        scheduleNotificationsEnabled: true,
        userProfile: null,
        loadingSettings: true,
        smartAudioEnabled: localStorage.getItem('smartAudioEnabled') !== 'false',
        audioLanguage: localStorage.getItem('audioLanguage') || 'id-ID', // Default to Indonesian
        isAudioUnlocked: false, // Must be re-unlocked every session due to browser policy
        monitoringData: JSON.parse(localStorage.getItem('monitoring_data_cache') || 'null')
    });

    // Audio Assistant Refs (Singleton)
    const audioContextRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isAnnouncingRef = useRef(false);
    const announcedIdsRef = useRef(new Set());
    const lastDateRef = useRef(new Date().toISOString().split('T')[0]);
    const fetchIntervalRef = useRef(null);
    const workerRef = useRef(null);

    // [NEW] Persistent Unlock Mechanism
    const unlockAudio = async () => {
        if (settings.isAudioUnlocked) return true;
        
        try {
            // 1. Initialize AudioContext
            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass && typeof AudioContextClass === 'function') {
                    audioContextRef.current = new AudioContextClass();
                }
            }
            
            // 2. Resume if suspended
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            
            // 3. Trigger a short silent sound to unlock Web Audio
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            oscillator.start();
            oscillator.stop(audioContextRef.current.currentTime + 0.001);

            // 4. Trigger Speech Synthesis (Safari/Chrome Mobile requirement)
            window.speechSynthesis.cancel();
            if (typeof window.SpeechSynthesisUtterance === 'function') {
                const silent = new window.SpeechSynthesisUtterance(" ");
                silent.volume = 0;
                window.speechSynthesis.speak(silent);
            }
            
            setSettings(prev => ({ ...prev, isAudioUnlocked: true }));
            console.log('Audio Assistant: System Fully Unlocked via Interaction');
            
            // Process any pending queue
            if (audioQueueRef.current.length > 0) processQueue();
            
            return true;
        } catch (err) {
            console.error('Audio Assistant: Unlock failed', err);
            return false;
        }
    };

    const testAudio = () => {
        if (!settings.isAudioUnlocked) {
            unlockAudio().then(success => {
                if (success) {
                    const texts = {
                        'id-ID': "Sistem audio berhasil diaktifkan. Pengeras suara sekolah siap digunakan.",
                        'en-US': "Audio system successfully activated. School speakers are ready for use."
                    };
                    audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
                    processQueue();
                }
            });
        } else {
            const texts = {
                'id-ID': "Uji coba audio. Sistem berfungsi dengan normal.",
                'en-US': "Audio test. The system is functioning normally."
            };
            audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
            processQueue();
        }
    };

    // Global Interaction Listener to auto-unlock as soon as the user clicks ANYTHING
    useEffect(() => {
        const handleInteraction = () => {
            if (!settings.isAudioUnlocked && settings.userProfile?.role?.toLowerCase() === 'admin') {
                unlockAudio();
            }
            // Remove listeners once unlocked
            if (settings.isAudioUnlocked) {
                ['click', 'mousedown', 'keydown', 'touchstart'].forEach(e => 
                    window.removeEventListener(e, handleInteraction)
                );
            }
        };

        if (!settings.isAudioUnlocked) {
            ['click', 'mousedown', 'keydown', 'touchstart'].forEach(e => 
                window.addEventListener(e, handleInteraction)
            );
        }

        return () => {
            ['click', 'mousedown', 'keydown', 'touchstart'].forEach(e => 
                window.removeEventListener(e, handleInteraction)
            );
        };
    }, [settings.isAudioUnlocked, settings.userProfile]);

    // Audio Helpers
    const normalizeForSpeech = (text) => {
        if (!text) return "";
        let t = text.toString();
        t = t.replace(/\b1([a-zA-Z])\b/g, "Satu $1");
        t = t.replace(/\b2([a-zA-Z])\b/g, "Dua $1");
        t = t.replace(/\b3([a-zA-Z])\b/g, "Tiga $1");
        t = t.replace(/\b4([a-zA-Z])\b/g, "Empat $1");
        t = t.replace(/\b5([a-zA-Z])\b/g, "Lima $1");
        t = t.replace(/\b6([a-zA-Z])\b/g, "Enam $1");
        t = t.replace(/\b7([a-zA-Z])\b/g, "Tujuh $1");
        t = t.replace(/\b8([a-zA-Z])\b/g, "Delapan $1");
        t = t.replace(/\b9([a-zA-Z])\b/g, "Sembilan $1");
        t = t.replace(/\b10([a-zA-Z])\b/g, "Sepuluh $1");
        t = t.replace(/\b11([a-zA-Z])\b/g, "Sebelas $1");
        t = t.replace(/\b12([a-zA-Z])\b/g, "Dua Belas $1");
        const map = { "1": "Satu", "2": "Dua", "3": "Tiga", "4": "Empat", "5": "Lima", "6": "Enam", "7": "Tujuh", "8": "Delapan", "9": "Sembilan", "10": "Sepuluh", "11": "Sebelas", "12": "Dua Belas", "KBM": "Kegiatan Belajar Mengajar" };
        Object.keys(map).forEach(k => { t = t.replace(new RegExp(`\\b${k}\\b`, 'gi'), map[k]); });
        return t;
    };

    const playChime = () => new Promise(res => {
        try {
            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass && typeof AudioContextClass === 'function') {
                    audioContextRef.current = new AudioContextClass();
                }
            }
            const ctx = audioContextRef.current;
            if (!ctx) { res(); return; }
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const n = [659.25, 523.25, 587.33, 392.00];
            const d = 0.4, g = 0.22;
            n.forEach((f, i) => {
                const o = ctx.createOscillator(), gain = ctx.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(f, ctx.currentTime);
                const s = ctx.currentTime + (i * g);
                gain.gain.setValueAtTime(0, s); gain.gain.linearRampToValueAtTime(0.4, s + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.01, s + d);
                o.connect(gain); gain.connect(ctx.destination);
                o.start(s); o.stop(s + d);
            });
            setTimeout(res, ((n.length * g) + d + 0.2) * 1000);
        } catch (e) { res(); }
    });

    const processQueue = async () => {
        if (isAnnouncingRef.current || audioQueueRef.current.length === 0 || !settings.smartAudioEnabled) return;
        isAnnouncingRef.current = true;
        const next = audioQueueRef.current.shift();
        try {
            await playChime();
            
            // Cancel any current speech to prevent queuing overlap or "stuck" speech
            window.speechSynthesis.cancel();
            
            if (typeof window.SpeechSynthesisUtterance !== 'function') {
                isAnnouncingRef.current = false;
                return;
            }
            
            const u = new window.SpeechSynthesisUtterance(next.text);
            u.lang = next.lang || 'id-ID'; // Use specified language or default to id-ID
            u.rate = 1.1; // Slightly faster for responsiveness
            u.onend = () => { isAnnouncingRef.current = false; setTimeout(processQueue, 300); };
            u.onerror = () => { isAnnouncingRef.current = false; setTimeout(processQueue, 300); };
            window.speechSynthesis.speak(u);
        } catch (e) { isAnnouncingRef.current = false; }
    };

    // Fetch profile and monitoring data
    const fetchProfile = async () => {
        try {
            const response = await api.get('/profile');
            const { profile, user } = response.data;
            setSettings(prev => ({
                ...prev,
                activeSemester: profile.active_semester || 'Ganjil',
                academicYear: profile.academic_year || '',
                geminiModel: profile.gemini_model || 'gemini-3.1-flash-lite-preview',
                scheduleNotificationsEnabled: profile.schedule_notifications_enabled ?? true,
                userProfile: { ...user, ...profile, logoUrl: response.data.logo_url },
                loadingSettings: false
            }));
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            setSettings(prev => ({ ...prev, loadingSettings: false }));
        }
    };

    const fetchMonitoringData = async (forcedProfile = null) => {
        const profile = forcedProfile || settings.userProfile;
        if (!profile || profile.role?.toLowerCase() !== 'admin') return;
        
        try {
            // Set header for active semester/year and add timestamp
            const res = await api.get(`/admin/dashboard/monitoring?t=${Date.now()}`, {
                headers: {
                    'X-Active-Semester': settings.activeSemester,
                    'X-Active-Year': settings.academicYear
                }
            });
            if (res.data) {
                setSettings(prev => ({ ...prev, monitoringData: res.data }));
                localStorage.setItem('monitoring_data_cache', JSON.stringify(res.data));
            }
        } catch (e) {
            console.error('Audio Assistant: Fetch failed', e);
        }
    };

    // Intervals
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchProfile();
        } else {
            setSettings(prev => ({ ...prev, userProfile: null, loadingSettings: false }));
        }
        
        // Auto-refresh monitoring data every 10 seconds to keep it near real-time
        const monitoringPoll = setInterval(() => {
            if (settings.userProfile?.role?.toLowerCase() === 'admin') {
                fetchMonitoringData();
            }
        }, 10 * 1000);

        return () => {
            if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
            clearInterval(monitoringPoll);
        };
    }, [settings.userProfile?.role]);

    // Reactive fetch: Trigger as soon as userProfile is loaded
    useEffect(() => {
        if (settings.userProfile?.role?.toLowerCase() === 'admin' && !settings.monitoringData) {
            console.log('Audio Assistant: Profile detected, triggering initial fetch.');
            fetchMonitoringData(settings.userProfile);
        }
    }, [settings.userProfile]);

    // [NEW] Precision Background Refresher
    // This ensures audio bells trigger exactly on time regardless of current page
    useEffect(() => {
        const precisionTimer = setInterval(() => {
            const now = moment();
            const data = monitoringDataRef.current;
            if (!data || settings.userProfile?.role?.toLowerCase() !== 'admin') return;
            
            const currentSecond = now.format('HH:mm:ss');
            const dateStr = now.format('YYYY-MM-DD');
            let shouldTriggerRefresh = false;

            // Trigger precisely at the 00 second mark of any activity change
            if (data.non_teaching_schedules) {
                data.non_teaching_schedules.forEach(act => {
                    if (currentSecond === `${act.start_time}:00` || currentSecond === `${act.end_time}:00`) {
                        shouldTriggerRefresh = true;
                    }
                });
            }
            
            if (data.data) {
                data.data.forEach(item => {
                    if (!item.time) return;
                    const times = item.time.split(' - ');
                    // [TRANSITION FIX] Trigger sync 2 seconds BEFORE and AT the boundary
                    [times[0], times[1]].forEach(t => {
                        const triggerTime = t?.length === 5 ? `${t}:00` : t;
                        const triggerMoment = moment(triggerTime, 'HH:mm:ss');
                        const diffSec = now.diff(triggerMoment, 'seconds');
                        
                        if (diffSec >= -2 && diffSec <= 0) {
                            shouldTriggerRefresh = true;
                        }
                    });
                });
            }

            if (shouldTriggerRefresh) {
                console.log('Audio Assistant: Precision sync triggered for global bell.');
                fetchMonitoringData();
            }
        }, 1000);

        return () => clearInterval(precisionTimer);
    }, [settings.userProfile?.role, settings.activeSemester, settings.academicYear]);

    // Ref to keep track of monitoring data without restarting the interval
    const monitoringDataRef = useRef(settings.monitoringData);
    useEffect(() => {
        monitoringDataRef.current = settings.monitoringData;
    }, [settings.monitoringData]);

    // 1-Second Audio Loop (Web Worker to avoid Throttling)
    useEffect(() => {
        if (!settings.smartAudioEnabled || !settings.userProfile) {
            if (workerRef.current) {
                workerRef.current.postMessage('stop');
                workerRef.current.terminate();
                workerRef.current = null;
            }
            return;
        }

        // Initialize Web Worker
        if (!workerRef.current && typeof window.Worker === 'function') {
            try {
                // Use a safe path or fallback to absolute
                workerRef.current = new window.Worker('/audio-timer-worker.js');
                workerRef.current.onmessage = (e) => {
                    if (e.data === 'tick') {
                        handleTick();
                    }
                };
                workerRef.current.postMessage('start');
            } catch (e) {
                console.error("Audio Assistant: Worker initialization failed, falling back to interval.", e);
                // Fallback can be implemented here if needed, but usually modern browsers support Worker
            }
        }

        const handleTick = () => {
            const now = new Date();
            const time = now.toTimeString().split(' ')[0]; // HH:mm:ss
            const date = now.toISOString().split('T')[0];
            const data = monitoringDataRef.current;
            if (!data) return;

            // [NEW] Clear announced IDs on new day
            if (lastDateRef.current !== date) {
                announcedIdsRef.current.clear();
                lastDateRef.current = date;
            }

            // [PRIORITY 1] Logic for Teaching Activities (KBM) - Moved up to prioritize teacher calls
            // Use full_data if available (contains all schedules), fallback to data.data (grouped by rombel)
            const kbmSource = data.full_data || data.data;

            if (kbmSource) {
                // Group by Subject, Start Time AND Teacher to ensure every teacher is called uniquely
                const startTriggers = {};
                
                kbmSource.forEach(item => {
                    const startRaw = item.time?.split(' - ')[0] || "";
                    if (!startRaw) return;
                    const startFull = startRaw.length === 5 ? `${startRaw}:00` : startRaw;
                    
                    const startMoment = moment(startFull, 'HH:mm:ss');
                    const currentMoment = moment(time, 'HH:mm:ss');
                    const diffSeconds = currentMoment.diff(startMoment, 'seconds');
                    
                    // Increased window to 15s to be more robust
                    if (diffSeconds >= 0 && diffSeconds <= 15 && item.status !== 'selesai') {
                        // Key includes Time, Subject, and Teacher for perfect uniqueness
                        const key = `${startFull}-${item.subject}-${item.teacher}`;
                        if (!startTriggers[key]) startTriggers[key] = { startFull, subject: item.subject, teacher: item.teacher, classes: [] };
                        if (!startTriggers[key].classes.includes(item.rombel)) {
                            startTriggers[key].classes.push(item.rombel);
                        }
                    }
                });

                // Process grouped triggers
                Object.values(startTriggers).forEach(trigger => {
                    const classList = trigger.classes.sort().join(', ');
                    // [ID FIX] Include startFull in ID to allow repeating subject/teacher at different times
                    const id = `kbm-${trigger.startFull}-${trigger.subject}-${trigger.teacher}-${date}`;
                    
                    if (!announcedIdsRef.current.has(id)) {
                        announcedIdsRef.current.add(id);
                        const texts = {
                            'id-ID': `Mohon perhatian. Pelajaran ${normalizeForSpeech(trigger.subject)} untuk Kelas ${normalizeForSpeech(classList)} segera dimulai. Kepada Bapak atau Ibu ${trigger.teacher} harap segera menuju kelas.`,
                            'en-US': `Attention please. The lesson for ${normalizeForSpeech(trigger.subject)} for Class ${normalizeForSpeech(classList)} will begin shortly. Teacher ${trigger.teacher} is requested to proceed to the class.`
                        };
                        audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
                        processQueue();
                    }
                });
            }

            // [NEW] Trigger for Teacher Preparation (5 Minutes Before) - General Announcement
            if (kbmSource) {
                const nowMoment = moment(time, 'HH:mm:ss');
                let hasUpcomingKBM = false;
                let targetStartTime = "";
                let targetPeriod = null;

                kbmSource.forEach(item => {
                    const startRaw = item.time?.split(' - ')[0] || "";
                    if (!startRaw) return;
                    const startFull = startRaw.length === 5 ? `${startRaw}:00` : startRaw;
                    
                    const startMoment = moment(startFull, 'HH:mm:ss');
                    const diffSeconds = startMoment.diff(nowMoment, 'seconds');
                    
                    // Trigger exactly 5 minutes (300 seconds) before
                    if (diffSeconds >= 295 && diffSeconds <= 300) {
                        hasUpcomingKBM = true;
                        targetStartTime = startFull;
                        if (item.start_period) targetPeriod = item.start_period;
                    }
                });

                if (hasUpcomingKBM) {
                    const id = `kbm-prep-5min-${targetStartTime}-${date}`;
                    if (!announcedIdsRef.current.has(id)) {
                        announcedIdsRef.current.add(id);
                        const periodText = targetPeriod ? `jam pelajaran ke ${normalizeForSpeech(targetPeriod)}` : 'jam pelajaran berikutnya';
                        const texts = {
                            'id-ID': `Mohon perhatian. ${periodText} akan dimulai dalam 5 menit lagi. Mohon Bapak dan Ibu Guru mempersiapkan diri. Terima kasih.`,
                            'en-US': `Attention please. ${targetPeriod ? `Period ${targetPeriod}` : 'The next period'} will begin in 5 minutes. Teachers are requested to prepare themselves. Thank you.`
                        };
                        audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
                        processQueue();
                    }
                }
            }

            // [PRIORITY 2] Logic for Non-Teaching Activities (Lower Priority than Teachers)
            if (data.non_teaching_schedules) {
                data.non_teaching_schedules.forEach(act => {
                    const startRaw = `${act.start_time}:00`;
                    const endRaw = `${act.end_time}:00`;
                    
                    [startRaw, endRaw].forEach((targetTime, i) => {
                        const targetMoment = moment(targetTime, 'HH:mm:ss');
                        const currentMoment = moment(time, 'HH:mm:ss');
                        const diffSeconds = currentMoment.diff(targetMoment, 'seconds');

                        // Within 15 seconds window
                        if (diffSeconds >= 0 && diffSeconds <= 15) {
                            const id = `act-${act.activity_name}-${i === 0 ? 'start' : 'end'}-${date}`;
                            if (!announcedIdsRef.current.has(id)) {
                                announcedIdsRef.current.add(id);
                                const isSholat = act.activity_name.toLowerCase().includes('sholat');
                                const isIstirahat = act.activity_name.toLowerCase().includes('istirahat') || act.activity_name.toLowerCase().includes('break');
                                
                                // Check if school ends exactly when this activity ends
                                const schoolEndsAtSameTime = i === 1 && data.max_end_time === act.end_time;

                                const texts = {
                                    'id-ID': i === 0 
                                        ? `Mohon perhatian, waktu ${normalizeForSpeech(act.activity_name)} telah tiba. ${isSholat ? 'Kepada seluruh warga sekolah beragama Islam diharap segera bersiap menuju tempat ibadah.' : (isIstirahat ? 'Selamat beristirahat.' : '')}`
                                        : (schoolEndsAtSameTime 
                                            ? `Mohon perhatian. Waktu ${normalizeForSpeech(act.activity_name)} telah usai.`
                                            : `Mohon perhatian. Waktu ${normalizeForSpeech(act.activity_name)} telah usai. Kepada seluruh siswa diharapkan segera kembali ke kelas masing-masing untuk melanjutkan kegiatan pembelajaran.`),
                                    'en-US': i === 0
                                        ? `Attention please, it's time for ${normalizeForSpeech(act.activity_name)}. ${isSholat ? 'All Muslim school members are requested to prepare for prayer.' : (isIstirahat ? 'Enjoy your break.' : '')}`
                                        : (schoolEndsAtSameTime
                                            ? `Attention please. The time for ${normalizeForSpeech(act.activity_name)} has ended.`
                                            : `Attention please. The time for ${normalizeForSpeech(act.activity_name)} has ended. All students are expected to return to their respective classes to continue learning activities.`)
                                };
                                audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
                                processQueue();
                            }
                        }
                    });
                });
            }

            // [NEW] Trigger for End of School Day (Lowest Priority)
            if (data.max_end_time) {
                const targetTime = `${data.max_end_time}:00`;
                const targetMoment = moment(targetTime, 'HH:mm:ss');
                const currentMoment = moment(time, 'HH:mm:ss');
                const diffSeconds = currentMoment.diff(targetMoment, 'seconds');

                // Trigger in 10s window
                if (diffSeconds >= 0 && diffSeconds <= 10) {
                    // Check if there are ANY activities (teaching or non-teaching) starting NOW or in the future
                    const anyMoreNonTeaching = data.non_teaching_schedules?.some(act => {
                        const actStart = moment(`${act.start_time}:00`, 'HH:mm:ss');
                        return actStart.isAfter(targetMoment);
                    });

                    const anyMoreTeaching = data.data?.some(item => {
                        const startRaw = item.time?.split(' - ')[0] || "";
                        const startFull = startRaw.length === 5 ? `${startRaw}:00` : startRaw;
                        const startMoment = moment(startFull, 'HH:mm:ss');
                        return startMoment.isAfter(targetMoment);
                    });

                    if (!anyMoreNonTeaching && !anyMoreTeaching) {
                        const id = `school-over-${date}`;
                        if (!announcedIdsRef.current.has(id)) {
                            announcedIdsRef.current.add(id);
                            const texts = {
                                'id-ID': `Mohon perhatian. Seluruh rangkaian kegiatan belajar mengajar hari ini telah selesai dilaksanakan. Kepada seluruh siswa diharapkan segera merapikan peralatan dan meninggalkan kelas dengan tertib. Sampai jumpa esok hari.`,
                                'en-US': `Attention please. All teaching and learning activities for today have concluded. All students are requested to tidy up their belongings and leave the classrooms in an orderly manner. See you tomorrow.`
                            };
                            audioQueueRef.current.push({ text: texts[settings.audioLanguage] || texts['id-ID'], lang: settings.audioLanguage });
                            processQueue();
                        }
                    }
                }
            }
        };

        return () => {
            if (workerRef.current) {
                workerRef.current.postMessage('stop');
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [settings.smartAudioEnabled, settings.userProfile]);

    const value = React.useMemo(() => ({
        ...settings,
        setSmartAudioEnabled: (val) => {
            setSettings(prev => ({ ...prev, smartAudioEnabled: val }));
            localStorage.setItem('smartAudioEnabled', val);
        },
        setAudioLanguage: (val) => {
            setSettings(prev => ({ ...prev, audioLanguage: val }));
            localStorage.setItem('audioLanguage', val);
        },
        refreshMonitoringData: fetchMonitoringData,
        unlockAudio,
        testAudio,
        updateProfile: async (updates) => {
            const res = await (updates instanceof FormData ? api.post('/profile', updates) : api.put('/profile', updates));
            await fetchProfile();
            return res.data;
        },
        refreshProfile: fetchProfile,
    }), [settings]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
