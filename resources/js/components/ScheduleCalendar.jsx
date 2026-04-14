import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './ScheduleCalendar.css';
import 'moment/locale/id';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import Modal from './Modal';
import { Trash2, Edit, Calendar as CalendarIcon, X, Save, RefreshCw, Info, AlertTriangle, CheckCircle, Clock, Globe, Plus, Zap, Settings } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';
import { getHolidaysByYear } from '../utils/holidayData';
import TimeSlotModal from './TimeSlotModal';
import SchedulingReportModal from './SchedulingReportModal';
import SchedulingSyncModal from './SchedulingSyncModal';
import { Calculator as CalculatorIcon } from 'lucide-react';

// Set moment locale to Indonesian
moment.locale('id');
const localizer = momentLocalizer(moment);

const ScheduleCalendar = () => {
    const { activeSemester, academicYear, userProfile, refreshProfile } = useSettings();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [day, setDay] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isRecurring, setIsRecurring] = useState(true);
    const [scheduleType, setScheduleType] = useState('teaching'); // 'teaching' or 'non-teaching'
    const [tableTab, setTableTab] = useState('teaching'); // Added for the list tabs
    const [activityName, setActivityName] = useState('');
    const [startPeriod, setStartPeriod] = useState('');
    const [endPeriod, setEndPeriod] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // Data states
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [editingScheduleId, setEditingScheduleId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal states
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayForm, setHolidayForm] = useState({
        title: '',
        start_date: '',
        end_date: '',
        category: 'semester_ganjil'
    });
    const [editingHolidayId, setEditingHolidayId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
    const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportErrors, setReportErrors] = useState([]);
    const [reportMessage, setReportMessage] = useState('');
    const [showSyncModal, setShowSyncModal] = useState(false);

    const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const userRes = await api.get('/me');
                const userData = userRes.data;
                setUser(userData);
                
                await Promise.all([
                    fetchMasterData(userData),
                    fetchSchedules(userData),
                    fetchHolidays()
                ]);
            } catch (err) {
                console.error("Init error:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchMasterData = async (userData) => {
        try {
            const [subjectsRes, classesRes] = await Promise.all([
                api.get('/subjects'),
                api.get('/classes')
            ]);
            
            const fetchedSubjects = subjectsRes.data.data || subjectsRes.data || [];
            const fetchedClasses = classesRes.data.data || classesRes.data || [];
            
            if (userData.role === 'teacher') {
                const teacherRes = await api.get('/teachers');
                const teachers = teacherRes.data.data || teacherRes.data || [];
                const currentTeacher = teachers.find(t => t.auth_user_id === userData.id);
                
                if (currentTeacher && currentTeacher.assignments) {
                    setAssignments(currentTeacher.assignments);
                    
                    const assignedSubjectIds = new Set(currentTeacher.assignments.map(a => a.subject_id));
                    const assignedClassIds = new Set(currentTeacher.assignments.map(a => a.class_id));

                    setSubjects(fetchedSubjects.filter(s => assignedSubjectIds.has(s.id)));
                    setClasses(fetchedClasses.filter(c => assignedClassIds.has(c.id)).sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
                } else {
                    setAssignments([]);
                    setSubjects([]);
                    setClasses([]);
                }
            } else if (userData.role === 'admin') {
                // For admin, fetch all teachers and extract their assignments
                try {
                    const teacherRes = await api.get('/teachers');
                    const teachers = teacherRes.data.data || teacherRes.data || [];
                    // Flatten all assignments from all teachers
                    const allAssignments = teachers.reduce((acc, t) => {
                        if (t.assignments) {
                            return [...acc, ...t.assignments];
                        }
                        return acc;
                    }, []);
                    setAssignments(allAssignments);
                    setSubjects(fetchedSubjects);
                    setClasses(fetchedClasses.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
                } catch (err) {
                    console.error("Error fetching assignments:", err);
                }
            } else {
                setAssignments([]);
                setSubjects(fetchedSubjects);
                setClasses(fetchedClasses.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
            }
        } catch (error) {
            console.error('Error fetching master data:', error);
            toast.error('Gagal memuat data kelas/mata pelajaran.');
        }
    };

    const fetchSchedules = async (userData) => {
        try {
            const response = await api.get('/schedules');
            const scheduleData = response.data.data || response.data || [];
            setSchedules(scheduleData);
        } catch (error) {
            console.error('Error fetching schedules:', error);
            // Don't show toast if it's the auto-generate cleanup
            if (!isGeneratingAuto) toast.error('Gagal memuat jadwal.');
        }
    };

    const handleAutoGenerate = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Buat Jadwal Otomatis?',
            message: 'Seluruh jadwal KBM yang ada akan DIHAPUS dan diganti dengan susunan baru berdasarkan penugasan guru dan jam per pekan. Lanjutkan?',
            onConfirm: confirmAutoGenerate
        });
    };

    const confirmAutoGenerate = async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsGeneratingAuto(true);
        const toastId = toast.loading('Sedang menyusun jadwal cerdas...');

        try {
            const res = await api.post('/schedules/auto-generate');
            toast.success(res.data.message || 'Jadwal berhasil dibuat!', { id: toastId });
            await fetchSchedules(user);
        } catch (error) {
            console.error("Auto-generate error:", error);
            const data = error.response?.data;
            // Always open the report modal on failure to show the full message
            setReportMessage(data?.message || 'Gagal membuat jadwal otomatis.');
            setReportErrors(data?.errors || []);
            setShowReportModal(true);
            toast.dismiss(toastId);
        } finally {
            setIsGeneratingAuto(false);
        }
    };

    const fetchHolidays = async () => {
        try {
            const response = await api.get('/holidays');
            setHolidays(response.data.data || response.data || []);
        } catch (error) {
            console.error('Error fetching holidays:', error);
        }
    };

    const handleSaveHoliday = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...holidayForm,
                date: holidayForm.start_date
            };

            if (editingHolidayId) {
                await api.put(`/holidays/${editingHolidayId}`, payload);
                toast.success('Agenda diperbarui');
            } else {
                await api.post('/holidays', payload);
                toast.success('Agenda ditambahkan');
            }
            fetchHolidays();
            setEditingHolidayId(null);
            setHolidayForm({ title: '', start_date: '', end_date: '', category: 'semester_ganjil' });
        } catch (error) {
            console.error('Error saving holiday:', error);
            const errorData = error.response?.data;
            if (errorData?.errors) {
                const firstError = Object.values(errorData.errors)[0][0];
                toast.error(firstError);
            } else {
                toast.error(errorData?.message || 'Gagal menyimpan agenda');
            }
        }
    };

    const handleDeleteHoliday = async (id) => {
        if (window.confirm('Hapus agenda ini?')) {
            try {
                await api.delete(`/holidays/${id}`);
                toast.success('Agenda dihapus');
                fetchHolidays();
            } catch (error) {
                toast.error('Gagal menghapus agenda');
            }
        }
    };

    const calendarEvents = useMemo(() => {
        const events = [];

        holidays.forEach(holiday => {
            const hDate = moment(holiday.date || holiday.start_date);
            const hEnd = moment(holiday.end_date || holiday.date);

            events.push({
                id: `holiday-${holiday.id}`,
                title: holiday.title,
                start: hDate.startOf('day').toDate(),
                end: hEnd.endOf('day').toDate(),
                allDay: true,
                isHoliday: true,
                category: holiday.category,
                resource: holiday
            });
        });

        schedules.forEach(schedule => {
            const isNonTeaching = schedule.type === 'non-teaching';
            const classInfo = classes.find(c => c.id == schedule.class_id);
            const subjectInfo = subjects.find(s => s.id == schedule.subject_id);

            if (!schedule.start_date || !schedule.end_date) return;

            const startDateMoment = moment(schedule.start_date);
            const endDateMoment = moment(schedule.end_date);
            const dayMap = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };
            const targetDay = dayMap[schedule.day];

            const eventTitle = isNonTeaching
                ? (schedule.activity_name || 'Kegiatan')
                : `${classInfo?.rombel || 'Kelas'} - ${subjectInfo?.name || 'Mapel'}`;

            const generateEvent = (date) => {
                const isHoliday = holidays.some(h => {
                    const hStart = moment(h.start_date || h.date).startOf('day');
                    const hEnd = moment(h.end_date || h.date).endOf('day');
                    return date.isBetween(hStart, hEnd, null, '[]');
                });

                if (isHoliday && !isNonTeaching) return null;

                const [startHour, startMin] = schedule.start_time.split(':');
                const [endHour, endMin] = schedule.end_time.split(':');

                return {
                    id: `${schedule.id}-${date.format('YYYY-MM-DD')}`,
                    scheduleId: schedule.id,
                    title: eventTitle,
                    start: date.clone().hour(startHour).minute(startMin).toDate(),
                    end: date.clone().hour(endHour).minute(endMin).toDate(),
                    resource: { ...schedule, isNonTeaching }
                };
            };

            if (schedule.is_recurring) {
                let currentDate = startDateMoment.clone();
                while (currentDate.day() !== targetDay && currentDate.isSameOrBefore(endDateMoment)) {
                    currentDate.add(1, 'day');
                }
                while (currentDate.isSameOrBefore(endDateMoment)) {
                    const event = generateEvent(currentDate);
                    if (event) events.push(event);
                    currentDate.add(7, 'days');
                }
            } else {
                const event = generateEvent(startDateMoment);
                if (event) events.push(event);
            }
        });

        return events;
    }, [schedules, classes, subjects, holidays]);

    const resetForm = (keepDayAndClass = false) => {
        setEditingScheduleId(null);
        if (!keepDayAndClass) {
            setDay('');
            setSelectedClass('');
        }
        setStartTime('');
        setEndTime('');
        setSelectedSubject('');
        setStartDate('');
        setEndDate('');
        setIsRecurring(true);
        setScheduleType('teaching');
        setActivityName('');
        setStartPeriod('');
        setEndPeriod('');
    };

    // [NEW] Set initial active template
    useEffect(() => {
        if (userProfile?.teaching_time_slots?.profiles && !selectedTemplateId) {
            const active = userProfile.teaching_time_slots.profiles.find(p => p.is_active);
            if (active) setSelectedTemplateId(active.id);
            else if (userProfile.teaching_time_slots.profiles.length > 0) {
                setSelectedTemplateId(userProfile.teaching_time_slots.profiles[0].id);
            }
        }
    }, [userProfile, selectedTemplateId]);

    // [NEW] Auto-fill times from template (Teaching Hour Template - Multi Profile Support)
    useEffect(() => {
        if (scheduleType === 'teaching' && day && userProfile?.teaching_time_slots?.profiles && selectedTemplateId) {
            const profile = userProfile.teaching_time_slots.profiles.find(p => p.id === selectedTemplateId);
            const slots = profile?.slots?.[day] || [];
            
            // Auto-fill Start Time
            if (startPeriod && slots.length > 0) {
                const startMatch = slots.find(s => String(s.jam_ke) === String(startPeriod));
                if (startMatch && startMatch.mulai) {
                    setStartTime(startMatch.mulai);
                }
            }
            
            // Auto-fill End Time
            if (endPeriod && slots.length > 0) {
                const endMatch = slots.find(s => String(s.jam_ke) === String(endPeriod));
                if (endMatch && endMatch.selesai) {
                    setEndTime(endMatch.selesai);
                } else if (startPeriod) {
                    // Fallback to end of start period if only start period is provided
                    const startMatch = slots.find(s => String(s.jam_ke) === String(startPeriod));
                    if (startMatch && startMatch.selesai) {
                        setEndTime(startMatch.selesai);
                    }
                }
            }
        }
    }, [day, startPeriod, endPeriod, scheduleType, selectedTemplateId, userProfile?.teaching_time_slots]);

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        const isNonTeaching = scheduleType === 'non-teaching';

        if (!day || !startTime || !endTime) {
            toast.error('Mohon lengkapi field wajib (Hari, Jam Mulai, Jam Selesai).');
            return;
        }

        if (!isNonTeaching && (!selectedSubject || !selectedClass)) {
            toast.error('Pilih Kelas dan Mata Pelajaran untuk jadwal mengajar.');
            return;
        }

        setIsSubmitting(true);

        try {
            const finalStartDate = startDate || moment().format('YYYY-MM-DD');
            const finalEndDate = endDate || moment().endOf('year').format('YYYY-MM-DD');

            const scheduleData = {
                day,
                start_time: startTime,
                end_time: endTime,
                subject_id: isNonTeaching ? null : (selectedSubject || null),
                class_id: isNonTeaching ? null : (selectedClass || null),
                start_date: finalStartDate,
                end_date: finalEndDate,
                is_recurring: isRecurring,
                type: scheduleType,
                activity_name: isNonTeaching ? activityName : '',
                start_period: isNonTeaching ? 0 : (startPeriod || null),
                end_period: isNonTeaching ? 0 : (endPeriod || null),
            };

            if (editingScheduleId) {
                await api.put(`/schedules/${editingScheduleId}`, scheduleData);
                toast.success('Jadwal berhasil diperbarui!');
            } else {
                await api.post('/schedules', scheduleData);
                toast.success('Jadwal berhasil ditambahkan!');
            }

            // Reset form but keep Day and Class for easier bulk input
            resetForm(true);
            fetchSchedules(user);
        } catch (error) {
            console.error('Error saving schedule:', error);
            const errorData = error.response?.data;
            if (errorData?.errors) {
                // Get the first error message from the errors object
                // This will display the "Jadwal Bentrok" or "Jam selesai harus lebih akhir" messages
                const firstError = Object.values(errorData.errors)[0][0];
                toast.error(firstError);
                console.log('Validation Errors:', errorData.errors);
            } else {
                toast.error(errorData?.message || 'Gagal menyimpan jadwal.');
                console.log('Error Data:', errorData);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditSchedule = (schedule) => {
        resetForm();
        setEditingScheduleId(schedule.id);
        setDay(schedule.day);
        setStartTime(schedule.start_time);
        setEndTime(schedule.end_time);
        setSelectedSubject(schedule.subject_id || '');
        setSelectedClass(schedule.class_id || '');
        setStartDate(schedule.start_date || '');
        setEndDate(schedule.end_date || '');
        setIsRecurring(schedule.is_recurring ?? true);
        setScheduleType(schedule.type || 'teaching');
        setActivityName(schedule.activity_name || '');
        setStartPeriod(schedule.start_period || '');
        setEndPeriod(schedule.end_period || '');
    };

    const handleDeleteSchedule = (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Hapus Jadwal',
            message: 'Apakah Anda yakin ingin menghapus jadwal ini?',
            onConfirm: async () => {
                try {
                    await api.delete(`/schedules/${id}`);
                    toast.success('Jadwal berhasil dihapus!');
                    fetchSchedules(user);
                } catch (error) {
                    console.error('Error deleting schedule:', error);
                    toast.error('Gagal menghapus jadwal.');
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleSyncHolidays = async () => {
        try {
            const holidaysToSync = getHolidaysByYear(new Date().getFullYear());
            for (const h of holidaysToSync) {
                await api.post('/holidays', {
                    title: h.name,
                    date: h.date,
                    type: 'national_sync',
                    is_holiday: true
                });
            }
            toast.success('Berhasil sinkronisasi hari libur nasional!');
            fetchHolidays();
        } catch (error) {
            console.error('Error syncing holidays:', error);
            toast.error('Gagal sinkronisasi hari libur.');
        }
    };

    const handleSelectEvent = (event) => {
        if (event.isHoliday) return;
        const schedule = event.resource;
        handleEditSchedule(schedule);
    };

    const handleSelectSlot = ({ start }) => {
        const date = moment(start);
        const dayIndex = date.day();
        const idDayIndex = (dayIndex + 6) % 7;

        setDay(daysOfWeek[idDayIndex]);
        setStartDate(date.format('YYYY-MM-DD'));
        setEndDate(date.format('YYYY-MM-DD'));
        setStartTime(date.format('HH:mm'));
        setEndTime(date.add(45, 'minutes').format('HH:mm'));
        setScheduleType('teaching');
        setEditingScheduleId(null);
    };

    const eventStyleGetter = (event) => {
        let className = 'event-teaching';
        if (event.isHoliday) {
            className = 'event-holiday';
        } else if (event.resource?.isNonTeaching) {
            className = 'event-non-teaching';
        }

        return {
            className,
            style: {
                borderRadius: '8px',
                opacity: 0.9,
                color: event.resource?.isNonTeaching ? '#b91c4b' : 'white',
                border: event.resource?.isNonTeaching ? '1px dashed #ec4899' : '0px',
                display: 'block',
                fontSize: '11px',
                padding: '4px 8px'
            }
        };
    };

    const isAdmin = user?.role === 'admin';

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-600 border-gray-200"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">
                        {isAdmin ? 'Kelola Jadwal Sekolah' : 'Jadwal Mengajar Saya'}
                    </h2>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium">
                        Semester: {activeSemester} (TA {academicYear})
                    </p>
                </div>
                <div className="flex gap-2">
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                            <StyledButton
                                onClick={() => setShowSyncModal(true)}
                                variant="outline"
                                className="flex items-center gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                            >
                                <CalculatorIcon size={18} /> Cek Keselarasan
                            </StyledButton>
                            <StyledButton
                                onClick={handleAutoGenerate}
                                loading={isGeneratingAuto}
                                className="!bg-purple-600 hover:!bg-purple-700 !text-white flex items-center gap-2 group relative overflow-hidden"
                            >
                                <Zap size={18} className={isGeneratingAuto ? 'animate-pulse' : 'group-hover:animate-bounce'} />
                                <span className="relative z-10">Generate Otomatis</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
                            </StyledButton>
                            <StyledButton onClick={() => setShowTimeSlotModal(true)} variant="outline" className="flex items-center gap-2 border-purple-200 text-purple-600 hover:bg-purple-50">
                                <Settings size={18} /> Kelola Template Waktu
                            </StyledButton>
                            <StyledButton onClick={() => setShowHolidayModal(true)} variant="outline" className="flex items-center gap-2">
                                <CalendarIcon size={18} /> Kelola Agenda Sekolah
                            </StyledButton>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1">
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-3xl shadow-xl border border-purple-100 dark:border-purple-900/20 sticky top-4">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                <Plus size={20} />
                            </div>
                            <h3 className="text-lg font-black text-text-light dark:text-text-dark tracking-tight">
                                {editingScheduleId ? 'Edit Jadwal' : 'Tambah Jadwal'}
                            </h3>
                        </div>

                        <form onSubmit={handleAddSchedule} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 ml-1">Hari</label>
                                <StyledSelect value={day} onChange={(e) => setDay(e.target.value)} required>
                                    <option value="">Pilih Hari</option>
                                    {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                                </StyledSelect>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 ml-1">Tipe</label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setScheduleType('teaching')}
                                        className={`py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleType === 'teaching' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        KBM
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setScheduleType('non-teaching')}
                                        className={`py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleType === 'non-teaching' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                                    >
                                        Lainnya
                                    </button>
                                </div>
                            </div>

                            {scheduleType === 'non-teaching' ? (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Kegiatan</label>
                                    <StyledInput
                                        placeholder="Misal: Istirahat"
                                        value={activityName}
                                        onChange={(e) => setActivityName(e.target.value)}
                                        required
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 ml-1">Kelas</label>
                                        <StyledSelect value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required>
                                            <option value="">Pilih Kelas</option>
                                            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.rombel}</option>)}
                                        </StyledSelect>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 ml-1">Mata Pelajaran</label>
                                        <StyledSelect value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} required>
                                            <option value="">Pilih Mapel</option>
                                            {subjects
                                              .filter(sub => {
                                                // [FIX] Admins should see all subjects to allow initial setup
                                                if (!selectedClass || isAdmin) return true;
                                                // If no assignments exist at all, show all as fallback
                                                if (!assignments || assignments.length === 0) return true;
                                                // Robust ID comparison (string vs integer)
                                                return assignments.some(a => 
                                                    String(a.subject_id) === String(sub.id) && 
                                                    String(a.class_id) === String(selectedClass)
                                                );
                                              })
                                              .map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                        </StyledSelect>
                                    </div>

                                    {/* Template Selector Dropdown */}
                                    {userProfile?.teaching_time_slots?.profiles?.length > 0 && (
                                        <div className="space-y-1 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30">
                                            <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest ml-1">Template Waktu</label>
                                            <StyledSelect 
                                                value={selectedTemplateId} 
                                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                                className="!bg-white dark:!bg-gray-800"
                                            >
                                                {userProfile.teaching_time_slots.profiles.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} {p.is_active ? '(Aktif)' : ''}</option>
                                                ))}
                                            </StyledSelect>
                                        </div>
                                    )}
                                </>
                            )}

                            {scheduleType !== 'non-teaching' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 ml-1">Jam ke:</label>
                                        <StyledInput type="number" min="1" placeholder="Mulai" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 ml-1">Sampai jam ke:</label>
                                        <StyledInput type="number" min="1" placeholder="Akhir" value={endPeriod} onChange={(e) => setEndPeriod(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Mulai</label>
                                    <StyledInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 ml-1">Selesai</label>
                                    <StyledInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                                </div>
                            </div>

                            <StyledButton type="submit" disabled={isSubmitting} className="w-full !py-3.5 shadow-lg shadow-purple-200 dark:shadow-none">
                                {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : (editingScheduleId ? 'Update Jadwal' : 'Simpan Jadwal')}
                            </StyledButton>

                            {editingScheduleId && (
                                <button type="button" onClick={resetForm} className="w-full text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
                                    Batalkan Edit
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/40 dark:border-gray-800/40">
                    <div className="h-[700px] schedule-calendar">
                        <Calendar
                            localizer={localizer}
                            events={calendarEvents}
                            startAccessor="start"
                            endAccessor="end"
                            defaultView="week"
                            views={['month', 'week', 'day', 'agenda']}
                            step={30}
                            timeslots={2}
                            eventPropGetter={eventStyleGetter}
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            selectable
                            messages={{
                                next: "Lanjut",
                                previous: "Kembali",
                                today: "Hari Ini",
                                month: "Bulan",
                                week: "Minggu",
                                day: "Hari",
                                agenda: "Agenda"
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-3xl shadow-xl border border-purple-100 dark:border-purple-900/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">Daftar Jadwal Tersimpan</h3>
                        <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-3 py-1 rounded-full">
                            {schedules.filter(s => {
                                const isMatchTab = (s.type || 'teaching') === tableTab;
                                const filterDay = (day || '').trim();
                                const filterClass = String(selectedClass || '');
                                const scheduleDay = (s.day || '').trim();
                                const scheduleClass = String(s.class_id || '');
                                const matchDay = filterDay ? scheduleDay === filterDay : true;
                                const matchClass = filterClass ? scheduleClass === filterClass : true;
                                return isMatchTab && matchDay && matchClass;
                            }).length}
                        </span>
                        {(day || selectedClass) && (
                            <span className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded-md border border-blue-100 flex items-center gap-1 animate-pulse">
                                <Zap size={10} fill="currentColor" /> Terfilter: {day && `Hari ${day}`} {day && selectedClass && '&'} {selectedClass && `Kelas ${classes.find(c => String(c.id) === String(selectedClass))?.rombel || ''}`}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
                        <button
                            onClick={() => setTableTab('teaching')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${tableTab === 'teaching' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            KBM (Pelajaran)
                        </button>
                        <button
                            onClick={() => setTableTab('non-teaching')}
                            className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all ${tableTab === 'non-teaching' ? 'bg-white dark:bg-gray-700 text-purple-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Non-KBM (Umum)
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar rounded-2xl">
                    <table className="w-full text-left border-separate border-spacing-y-2 min-w-[600px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4 bg-white dark:bg-[#1a1a2e]">
                                <th className="pb-4 pl-4 pt-2">Hari</th>
                                {tableTab === 'teaching' ? (
                                    <>
                                        <th className="pb-4 pt-2">Kelas</th>
                                        <th className="pb-4 pt-2">Mata Pelajaran</th>
                                        <th className="pb-4 pt-2">Jam Ke</th>
                                    </>
                                ) : (
                                    <th className="pb-4 pt-2">Nama Kegiatan</th>
                                )}
                                <th className="pb-4 pt-2">Waktu</th>
                                <th className="pb-4 pr-4 text-right pt-2">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.filter(s => {
                                const isMatchTab = (s.type || 'teaching') === tableTab;
                                const filterDay = (day || '').trim();
                                const filterClass = String(selectedClass || '');
                                const scheduleDay = (s.day || '').trim();
                                const scheduleClass = String(s.class_id || '');
                                const matchDay = filterDay ? scheduleDay === filterDay : true;
                                const matchClass = filterClass ? scheduleClass === filterClass : true;
                                return isMatchTab && matchDay && matchClass;
                            }).length === 0 ? (
                                <tr>
                                    <td colSpan={tableTab === 'teaching' ? "6" : "4"} className="text-center py-12 text-gray-400 font-medium italic">Belum ada jadwal tersimpan.</td>
                                </tr>
                            ) : (
                                schedules.filter(s => {
                                    const isMatchTab = (s.type || 'teaching') === tableTab;
                                    const filterDay = (day || '').trim();
                                    const filterClass = String(selectedClass || '');
                                    const scheduleDay = (s.day || '').trim();
                                    const scheduleClass = String(s.class_id || '');
                                    const matchDay = filterDay ? scheduleDay === filterDay : true;
                                    const matchClass = filterClass ? scheduleClass === filterClass : true;
                                    return isMatchTab && matchDay && matchClass;
                                }).sort((a, b) => {
                                    // 1. Sort by Day
                                    const dayDiff = daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
                                    if (dayDiff !== 0) return dayDiff;
                                    
                                    // 2. Sort by Class Name (Rombel)
                                    const classA = classes.find(c => c.id == a.class_id)?.rombel || '';
                                    const classB = classes.find(c => c.id == b.class_id)?.rombel || '';
                                    const classDiff = classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
                                    if (classDiff !== 0) return classDiff;

                                    // 3. Sort by Start Period (Jam Ke-)
                                    const periodA = parseInt(a.start_period) || 0;
                                    const periodB = parseInt(b.start_period) || 0;
                                    if (periodA !== periodB) return periodA - periodB;

                                    // 4. Sort by Start Time (fallback)
                                    return (a.start_time || '').localeCompare(b.start_time || '');
                                }).map(schedule => {
                                    const classInfo = classes.find(c => c.id == schedule.class_id);
                                    const subjectInfo = subjects.find(s => s.id == schedule.subject_id);
                                    return (
                                        <tr key={schedule.id} className="bg-gray-50/50 dark:bg-gray-900/40 rounded-2xl overflow-hidden group">
                                            <td className="py-4 pl-4 font-black text-gray-800 dark:text-white rounded-l-2xl">{schedule.day}</td>
                                            
                                            {tableTab === 'teaching' ? (
                                                <>
                                                    <td className="py-4 font-bold text-gray-600 dark:text-gray-400">{classInfo?.rombel || '-'}</td>
                                                    <td className="py-4 font-bold text-gray-800 dark:text-gray-100">{subjectInfo?.name || '-'}</td>
                                                    <td className="py-4 font-bold text-gray-500">
                                                        {schedule.start_period && schedule.end_period ? (
                                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md text-xs">
                                                                {schedule.start_period} - {schedule.end_period}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                </>
                                            ) : (
                                                <td className="py-4 font-bold text-gray-800 dark:text-gray-100">{schedule.activity_name || '-'}</td>
                                            )}

                                            <td className="py-4 font-bold text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} className="text-purple-400" />
                                                    {schedule.start_time} - {schedule.end_time}
                                                </div>
                                            </td>
                                            <td className="py-4 pr-4 rounded-r-2xl text-right">
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditSchedule(schedule)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"><Edit size={16} /></button>
                                                    <button onClick={() => handleDeleteSchedule(schedule.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {confirmModal.isOpen && (
                <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                    <div className="text-center p-6">
                        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
                            <Trash2 className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">{confirmModal.message}</p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl">Batal</button>
                            <button onClick={confirmModal.onConfirm} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200 dark:shadow-none">Hapus</button>
                        </div>
                    </div>
                </Modal>
            )}

            {showHolidayModal && (
                <Modal onClose={() => setShowHolidayModal(false)} size="2xl">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <CalendarIcon size={24} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Kelola Agenda Sekolah</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm">Libur Nasional {new Date().getFullYear()}</h4>
                                    <p className="text-[10px] text-blue-700 dark:text-blue-400">Ambil data dari sistem pusat.</p>
                                </div>
                                <button onClick={handleSyncHolidays} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"><RefreshCw size={18} /></button>
                            </div>

                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-purple-900 dark:text-purple-200 text-sm">Sinkronisasi Online</h4>
                                    <p className="text-[10px] text-purple-700 dark:text-purple-400">Cari agenda via internet.</p>
                                </div>
                                <button className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-none transition-all active:scale-95"><Globe size={18} /></button>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                            <h4 className="font-black text-gray-800 dark:text-gray-100 mb-4">Tambah Agenda Manual</h4>
                            <form onSubmit={handleSaveHoliday} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Tanggal Mulai</label>
                                        <StyledInput type="date" value={holidayForm.start_date} onChange={(e) => setHolidayForm({ ...holidayForm, start_date: e.target.value })} required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 ml-1">Tanggal Selesai</label>
                                        <StyledInput type="date" value={holidayForm.end_date} onChange={(e) => setHolidayForm({ ...holidayForm, end_date: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Kategori</label>
                                    <StyledSelect value={holidayForm.category} onChange={(e) => setHolidayForm({ ...holidayForm, category: e.target.value })}>
                                        <option value="semester_ganjil">Libur Semester Ganjil</option>
                                        <option value="semester_genap">Libur Semester Genap</option>
                                        <option value="ujian">Ujian</option>
                                        <option value="keagamaan">Hari Besar Keagamaan</option>
                                        <option value="lainnya">Lainnya</option>
                                    </StyledSelect>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 ml-1">Nama Agenda</label>
                                    <StyledInput placeholder="Contoh: Libur Lebaran" value={holidayForm.title} onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })} required />
                                </div>
                                <button type="submit" className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={18} /> Simpan Agenda
                                </button>
                            </form>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <h4 className="font-black text-gray-800 dark:text-gray-100 mb-4">Agenda Terdaftar ({holidays.length})</h4>
                            <div className="space-y-2">
                                {holidays.length === 0 ? (
                                    <p className="text-center py-10 text-gray-400 italic">Belum ada agenda terdaftar.</p>
                                ) : (
                                    holidays.map(h => (
                                        <div key={h.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            <div>
                                                <h5 className="font-bold text-gray-800 dark:text-white">{h.title}</h5>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{moment(h.start_date || h.date).format('DD MMM YYYY')} {h.end_date && `- ${moment(h.end_date).format('DD MMM YYYY')}`}</p>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => { setEditingHolidayId(h.id); setHolidayForm({ title: h.title, start_date: (h.start_date || h.date || '').slice(0, 10), end_date: (h.end_date || '').slice(0, 10), category: h.category || 'lainnya' }); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit size={16} /></button>
                                                <button onClick={() => handleDeleteHoliday(h.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
            {showTimeSlotModal && (
                <TimeSlotModal 
                    isOpen={showTimeSlotModal} 
                    onClose={() => setShowTimeSlotModal(false)} 
                    onSaveSuccess={() => refreshProfile()} // Optional: ensure profile is reloaded
                />
            )}

            {showReportModal && (
                <SchedulingReportModal 
                    isOpen={showReportModal} 
                    onClose={() => setShowReportModal(false)}
                    errors={reportErrors}
                    message={reportMessage}
                />
            )}

            {showSyncModal && (
                <SchedulingSyncModal 
                    isOpen={showSyncModal} 
                    onClose={() => setShowSyncModal(false)}
                />
            )}
        </div>
    );
};

export default ScheduleCalendar;
