import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Volume2, Sparkles } from 'lucide-react';
import { generateDailyBriefing } from '../utils/gemini';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';
import { generateDataHash } from '../utils/cacheUtils';

const AIBriefing = ({ user, schedules, tasks, missingJournalsCount }) => {
    const [briefingText, setBriefingText] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { geminiModel } = useSettings();
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    // Base cache key identifies the user and date
    const userIdentifier = user ? (user.uid || user.id || 'User') : 'Guest';
    const dateStr = moment().format('YYYY-MM-DD');

    useEffect(() => {
        const loadBriefing = async () => {
            // Deduce title based on gender if available
            let title = user.title || 'Bapak/Ibu';
            if (user.gender === 'Laki-laki') title = 'Bapak';
            if (user.gender === 'Perempuan') title = 'Ibu';

            // Prefer nickname, then first name, then full name
            const baseName = user.nickname || user.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Guru');
            const cleanName = baseName.replace(/^(Bapak|Ibu|Pak|Bu)\s+/i, '');

            // Use first name for friendlier briefing if no nickname
            const finalName = user.nickname ? cleanName : cleanName.split(' ')[0];
            const teacherName = title === 'Bapak/Ibu' ? finalName : `${title} ${finalName}`;

            const contextData = {
                teacherName: teacherName,
                schoolName: user.schoolName || '',
                mainSubject: user.subject || '',
                date: moment().format('dddd, DD MMMM YYYY'),
                schedules: schedules.slice(0, 3),
                tasks: tasks || [],
                missingJournalsCount: missingJournalsCount || 0,
                model: geminiModel
            };

            // Generate hash of context to detect meaningful changes
            const dataHash = generateDataHash(contextData);
            const briefingCacheKey = `briefing-${userIdentifier}-${dateStr}-${dataHash}`;

            const cached = localStorage.getItem(briefingCacheKey);
            if (cached) {
                console.log("Using cached briefing for:", userIdentifier);
                setBriefingText(cached);
                return;
            }

            setIsLoading(true);
            try {
                const text = await generateDailyBriefing(contextData, geminiModel);
                setBriefingText(text);
                localStorage.setItem(briefingCacheKey, text);
            } catch (error) {
                console.error("Failed to generate briefing:", error);
                setBriefingText("Maaf, gagal memuat briefing pagi ini.");
            } finally {
                setIsLoading(false);
            }
        };

        loadBriefing();
    }, [user, schedules, tasks, missingJournalsCount, geminiModel, dateStr, userIdentifier]);

    const [availableVoices, setAvailableVoices] = useState([]);

    useEffect(() => {
        const loadVoices = () => {
            const voices = synth.getVoices();
            if (voices.length > 0) {
                setAvailableVoices(voices);
            }
        };

        loadVoices();

        // Chrome/Android loads voices asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    useEffect(() => {
        // Cleanup speech on unmount
        return () => {
            if (synth.speaking) {
                synth.cancel();
            }
        };
    }, [synth]);

    const handlePlay = () => {
        if (!briefingText) return;

        if (isPlaying) {
            synth.pause();
            setIsPlaying(false);
        } else {
            if (synth.paused) {
                synth.resume();
                setIsPlaying(true);
            } else {
                // Determine the best voice
                const startPlayback = () => {
                    // Cancel any ongoing speech first (mobile fix)
                    synth.cancel();

                    const utterance = new SpeechSynthesisUtterance(briefingText);
                    utterance.lang = 'id-ID';

                    // FINE TUNING: 1.1 rate feels more natural for Indonesian than 1.0
                    utterance.rate = 1.08;
                    utterance.pitch = 1.02;
                    utterance.volume = 1;

                    // Optimized priority for Si Pintar's persona
                    const voices = availableVoices.length > 0 ? availableVoices : synth.getVoices();

                    // 1. Google/Natural/Premium voices
                    let selectedVoice = voices.find(v =>
                        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')) &&
                        (v.lang.includes('id-ID') || v.lang.includes('id_ID') || v.lang === 'id')
                    );

                    // 2. High-quality platform defaults (Microsoft/Apple)
                    if (!selectedVoice) {
                        selectedVoice = voices.find(v =>
                            (v.name.includes('Ardi') || v.name.includes('Gadis') || v.name.includes('Damayanti')) &&
                            v.lang.includes('id')
                        );
                    }

                    // 3. Generic Indonesian
                    if (!selectedVoice) {
                        selectedVoice = voices.find(v =>
                            v.lang.includes('id-ID') || v.lang === 'id_ID' || v.lang.includes('id')
                        );
                    }

                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                        console.log("Si Pintar optimized voice:", selectedVoice.name);
                    } else {
                        console.log("No Indonesian voice found for briefing.");
                    }

                    utterance.onend = () => {
                        setIsPlaying(false);
                    };

                    utterance.onerror = (e) => {
                        console.error("Speech error:", e);
                        setIsPlaying(false);
                    };

                    utteranceRef.current = utterance;
                    synth.speak(utterance);
                    setIsPlaying(true);
                };

                // If voices aren't loaded yet, try to load them one last time or just play
                if (availableVoices.length === 0) {
                    const voices = synth.getVoices();
                    if (voices.length > 0) {
                        setAvailableVoices(voices);
                        // Small timeout to let state update, then play (or just pass voices directly if refactored, but this is React)
                        // Actually, we can just use 'voices' local var here for immediate playback
                        setTimeout(startPlayback, 100);
                    } else {
                        // Fallback: browser might play default anyway
                        startPlayback();
                    }
                } else {
                    startPlayback();
                }
            }
        }
    };

    const handleRegenerate = async () => {
        setIsLoading(true);
        setBriefingText('');
        try {
            // Construct teacher name with title if available
            const title = user.title || 'Bapak/Ibu';
            const baseName = user.name || user.displayName || (user.email ? user.email.split('@')[0] : 'Guru');
            const cleanName = baseName.replace(/^(Bapak|Ibu|Pak|Bu)\s+/i, '');
            const finalName = user.nickname ? cleanName : cleanName.split(' ')[0];
            const teacherName = title === 'Bapak/Ibu' ? finalName : `${title} ${finalName}`;

            const contextData = {
                teacherName: teacherName,
                schoolName: user.schoolName || '',
                mainSubject: user.subject || '',
                date: moment().format('dddd, DD MMMM YYYY'),
                schedules: schedules.slice(0, 3),
                tasks: tasks || [],
                missingJournalsCount: missingJournalsCount || 0,
                model: geminiModel
            };

            const text = await generateDailyBriefing(contextData, geminiModel);
            setBriefingText(text);

            // Update cache as well
            const dataHash = generateDataHash(contextData);
            const briefingCacheKey = `briefing-${userIdentifier}-${dateStr}-${dataHash}`;
            localStorage.setItem(briefingCacheKey, text);

        } catch (error) {
            console.error("Failed to generate briefing:", error);
            setBriefingText("Maaf, gagal memuat briefing.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shadow-inner shrink-0">
                    {isPlaying ? (
                        <div className="flex gap-1 h-8 items-end justify-center">
                            <span className="w-1.5 h-3 bg-white animate-pulse"></span>
                            <span className="w-1.5 h-6 bg-white animate-pulse delay-75"></span>
                            <span className="w-1.5 h-8 bg-white animate-pulse delay-150"></span>
                            <span className="w-1.5 h-5 bg-white animate-pulse delay-100"></span>
                            <span className="w-1.5 h-3 bg-white animate-pulse delay-50"></span>
                        </div>
                    ) : (
                        <Sparkles size={32} className="text-yellow-300" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                        Morning Briefing
                        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest text-white/80">AI Assistant</span>
                    </h3>
                    {isLoading ? (
                        <div className="space-y-2 py-1">
                            <div className="h-4 w-full bg-white/20 rounded animate-pulse"></div>
                            <div className="h-4 w-2/3 bg-white/20 rounded animate-pulse"></div>
                        </div>
                    ) : (
                        <p className="text-sm md:text-base font-medium leading-relaxed opacity-95 italic text-blue-50">
                            {briefingText ? `"${briefingText}"` : "Menyiapkan catatan briefing pagi Anda..."}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={handleRegenerate}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                        title="Regenerate Briefing"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={handlePlay}
                        disabled={isLoading || !briefingText}
                        className="flex items-center gap-2 bg-white text-purple-700 hover:bg-purple-50 px-5 py-2.5 rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {isPlaying ? "Jeda" : "Dengarkan"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIBriefing;
