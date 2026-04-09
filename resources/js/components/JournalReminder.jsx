import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import { AlertTriangle, ChevronRight, BookX, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../utils/SettingsContext';
import moment from 'moment';

const simplify = (str) => String(str || '').toLowerCase().replace(/\s+/g, '');

const JournalReminder = ({ activeSemester, academicYear, onUpdateMissingCount }) => {
    const { userProfile } = useSettings();
    const [missingJournals, setMissingJournals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkMissingJournals = async () => {
            // Silent refresh (don't show spinner on subsequent poll calls)
            setIsLoading(true);
            try {
                // 1. Get Routine Schedules & Teachers (for assignments)
                const [scheduleRes, teachersRes] = await Promise.all([
                    api.get('/schedules'),
                    api.get('/teachers')
                ]);
                
                const schedules = scheduleRes.data.data || scheduleRes.data || [];
                const teacherList = teachersRes.data.data || teachersRes.data || [];
                
                // Get admins to check if a teacher_id is an admin
                // (Actually we just want the ACTUAL teacher assigned to class/subject)
                
                if (schedules.length === 0) {
                    setMissingJournals([]);
                    if (onUpdateMissingCount) onUpdateMissingCount(0);
                    setIsLoading(false);
                    return;
                }

                // 2. Get Journals
                const journalsRes = await api.get('/journals', {
                    params: { semester: activeSemester, academic_year: academicYear }
                });

                const journalList = journalsRes.data.data || journalsRes.data || [];

                const today = moment().endOf('day');
                const journalKeys = new Set(journalList.map(j => {
                    const date = j.date ? moment(j.date).format('YYYY-MM-DD') : '';
                    const className = simplify(j.class_name || (j.class ? j.class.rombel : ''));
                    const subjectName = simplify(j.subject_name || (j.subject ? j.subject.name : ''));
                    
                    // Jika is_assignment true, kunci ini PASTI dianggap ada
                    return `${date}_${className}_${subjectName}`;
                }));

                const missing = [];

                // 3. Iterate 7 days back
                for (let i = 0; i < 7; i++) {
                    const checkDate = moment().subtract(i, 'days');
                    if (checkDate.isAfter(today)) continue;

                    const dayNameIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][checkDate.day()];

                    const daySchedules = schedules.filter(s =>
                        s.day === dayNameIndo && (s.type === 'teaching' || !s.type)
                    );

                    for (const sched of daySchedules) {
                        const originalClassName = sched.class_name || (typeof sched.class === 'object' && sched.class !== null ? sched.class.rombel : sched.class);
                        const originalSubject = sched.subject_name || (typeof sched.subject === 'object' && sched.subject !== null ? sched.subject.name : sched.subject);

                        const normClassName = (originalClassName || '').toString().trim().toLowerCase();
                        const normSubject = (originalSubject || '').toString().trim().toLowerCase();
                        const dateStr = checkDate.format('YYYY-MM-DD');

                        const journalKey = `${dateStr}_${normClassName}_${normSubject}`;

                        if (!journalKeys.has(journalKey)) {
                            // Time check for Today: active as soon as class starts
                            const isToday = checkDate.isSame(moment(), 'day');
                            if (isToday && sched.start_time) {
                                const todayStr = moment().format('YYYY-MM-DD');
                                const classStartTime = moment(`${todayStr} ${sched.start_time}`, 'YYYY-MM-DD HH:mm');
                                const now = moment();
                                if (classStartTime.isValid() && now.isBefore(classStartTime)) continue;
                            }

                            // FIND ASSIGNED TEACHER AS FALLBACK
                            // If sched.teacher_id is an admin or we want the most accurate one
                            let displayTeacherName = sched.teacher?.name || '-';
                            let displayTeacherId = sched.teacher_id;

                            // Look in teacher assignments if it's a teaching schedule
                            const assignedTeacher = teacherList.find(t => 
                                t.assignments?.some(a => a.class_id == sched.class_id && a.subject_id == sched.subject_id)
                            );

                            if (assignedTeacher) {
                                displayTeacherName = assignedTeacher.name;
                                displayTeacherId = assignedTeacher.auth_user_id;
                            }

                            missing.push({
                                date: dateStr,
                                formattedDate: checkDate.format('dddd, DD MMM'),
                                className: originalClassName,
                                classId: sched.class_id,
                                subject: originalSubject,
                                subjectId: sched.subject_id,
                                teacherName: displayTeacherName,
                                teacherId: displayTeacherId,
                                time: sched.start_time || sched.startTime
                            });
                        }
                    }
                }

                missing.sort((a, b) => moment(b.date).diff(moment(a.date)));
                setMissingJournals(missing);
                if (onUpdateMissingCount) onUpdateMissingCount(missing.length);

            } catch (error) {
                console.error("Error checking missing journals:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkMissingJournals();

        // Auto-refresh every 5 minutes (300,000ms) without full re-render
        const interval = setInterval(checkMissingJournals, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [activeSemester, academicYear]);

    if (isLoading) return null;
    
    // Show a success message if everything is complete
    if (missingJournals.length === 0) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4 text-emerald-700 dark:text-emerald-400">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-800/30 rounded-xl shrink-0">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold mb-1">
                            {userProfile?.role?.toLowerCase() === 'admin' 
                                ? 'Hebat! Semua Jurnal Guru Terisi' 
                                : 'Luar Biasa! Administrasi Anda Tuntas'}
                        </h3>
                        <p className="text-sm opacity-80">
                            {userProfile?.role?.toLowerCase() === 'admin'
                                ? 'Monitoring kelengkapan jurnal hari ini menunjukkan 100% tuntas. Administrasi guru berjalan dengan sempurna!'
                                : 'Seluruh jurnal mengajar Anda dalam 7 hari terakhir telah terisi lengkap. Pertahankan kedisiplinan Anda!'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border mb-6 animate-in slide-in-from-top-4 duration-500 ${
            userProfile?.role?.toLowerCase() === 'admin' 
                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 p-4' 
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 p-5'
        }`}>
            <div className="flex items-start justify-between">
                <div className="flex gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${
                        userProfile?.role === 'admin'
                            ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-600 dark:text-blue-400'
                            : 'bg-amber-100 dark:bg-amber-800/30 text-amber-600 dark:text-amber-400'
                    }`}>
                        {userProfile?.role === 'admin' ? <BookX size={24} /> : <AlertTriangle size={24} />}
                    </div>
                    <div>
                        <h3 className={`font-bold mb-1 ${
                            userProfile?.role?.toLowerCase() === 'admin' 
                                ? 'text-lg text-blue-900 dark:text-blue-100' 
                                : 'text-lg text-gray-800 dark:text-gray-100'
                        }`}>
                            {userProfile?.role === 'admin' 
                                ? `Rekap: ${missingJournals.length} Jurnal Belum Terisi` 
                                : `Wah, ada ${missingJournals.length} Jurnal Belum Terisi!`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {userProfile?.role === 'admin'
                                ? "Pantau kelengkapan administrasi mengajar guru untuk rekapitulasi yang akurat."
                                : "Yuk lengkapi administrasi mengajar Anda agar rekapitulasi akhir semester aman."}
                        </p>

                        <div className="space-y-2">
                            {missingJournals.slice(0, 3).map((item, idx) => (
                                <Link 
                                    key={idx} 
                                    to={`/jurnal?date=${item.date}&classId=${item.classId}&subjectId=${item.subjectId}&teacherId=${item.teacherId}`}
                                    className={`flex flex-wrap items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-all group ${
                                        userProfile?.role === 'admin'
                                            ? 'text-blue-800 dark:text-blue-200 bg-white/50 dark:bg-black/20 border-blue-100 dark:border-blue-900/30 hover:bg-white dark:hover:bg-black/40'
                                            : 'text-amber-800 dark:text-amber-200 bg-white/50 dark:bg-black/20 border-amber-100 dark:border-amber-900/30 hover:bg-white dark:hover:bg-black/40'
                                    }`}
                                >
                                    <BookX size={14} className={`shrink-0 ${userProfile?.role === 'admin' ? 'text-blue-500' : 'text-amber-500'} group-hover:scale-120 transition-transform`} />
                                    <span className="font-bold">{item.formattedDate}</span>
                                    <span className="opacity-30">•</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                        userProfile?.role === 'admin'
                                            ? 'bg-blue-200/50 dark:bg-blue-900/50'
                                            : 'bg-amber-200/50 dark:bg-amber-900/50'
                                    }`}>{item.className}</span>
                                    <span className={`font-bold underline ${userProfile?.role === 'admin' ? 'decoration-blue-300' : 'decoration-amber-300'} decoration-2 underline-offset-2`}>{item.subject}</span>
                                    {userProfile?.role === 'admin' && (
                                        <>
                                            <span className="opacity-30">|</span>
                                            <span className="italic opacity-80 text-xs text-blue-900/70 dark:text-blue-100/70">Guru: {item.teacherName}</span>
                                        </>
                                    )}
                                    <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            ))}
                            {missingJournals.length > 3 && (
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 pl-1">
                                    ...dan {missingJournals.length - 3} lainnya.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <Link
                    to="/jurnal"
                    className="hidden sm:flex items-center gap-1 text-sm font-bold text-amber-700 hover:text-amber-800 hover:underline mt-1"
                >
                    {userProfile?.role === 'admin' ? "Lihat Detail Jurnal" : "Lengkapi Sekarang"} <ChevronRight size={16} />
                </Link>
            </div>
            <Link
                to="/jurnal"
                className="sm:hidden flex w-full justify-center items-center gap-2 mt-4 bg-amber-500 text-white py-2 rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform"
            >
                {userProfile?.role === 'admin' ? "Buka Daftar Jurnal" : "Lengkapi Jurnal"} <ChevronRight size={16} />
            </Link>
        </div>
    );
};

export default JournalReminder;
