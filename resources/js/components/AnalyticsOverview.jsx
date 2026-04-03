import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { TrendingUp, TrendingDown, Minus, Calendar, BookOpen, ClipboardCheck } from 'lucide-react';
import moment from 'moment';

const TrendIndicator = ({ current, previous, suffix = '%', isInverted = false }) => {
    if (previous === 0 && current === 0) {
        return <span className="text-gray-400 text-xs flex items-center gap-1"><Minus size={14} /> Tidak ada data</span>;
    }

    const change = previous > 0 ? ((current - previous) / previous * 100) : 0;
    const isPositive = isInverted ? change < 0 : change > 0;

    if (Math.abs(change) < 0.1) {
        return <span className="text-gray-600 dark:text-gray-400 text-xs flex items-center gap-1"><Minus size={14} /> Stabil</span>;
    }

    return (
        <span className={`text-xs font-bold flex items-center gap-1 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change).toFixed(1)}{suffix}
        </span>
    );
};

const StatCard = ({ icon: Icon, title, value, suffix = '', trend, color, glowClass, index }) => (
    <div
        className={`chart-container-glass p-5 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 ${glowClass} animate-fade-in-up`}
        style={{ animationDelay: `${index * 150}ms` }}
    >
        <div className="flex items-start justify-between mb-3">
            <div className={`p-3 rounded-2xl bg-gradient-to-br ${color} shadow-lg ring-4 ring-white/10`}>
                <Icon size={24} className="text-white" />
            </div>
            <div className="flex items-center gap-1">
                {trend}
            </div>
        </div>
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 mb-1 opacity-70">{title}</p>
            <div className="flex items-baseline gap-1">
                <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{value}</p>
                <span className="text-sm font-bold text-gray-400">{suffix}</span>
            </div>
        </div>
    </div>
);

const AnalyticsOverview = () => {
    const [weeklyStats, setWeeklyStats] = useState({
        thisWeek: { attendance: 0, avgGrade: 0, journals: 0 },
        lastWeek: { attendance: 0, avgGrade: 0, journals: 0 }
    });
    const [loading, setLoading] = useState(true);
    const { activeSemester, academicYear } = useSettings();

    useEffect(() => {
        const fetchWeeklyStats = async () => {
            try {
                // Define date ranges
                const thisWeekStart = moment().startOf('week');
                const thisWeekEnd = moment().endOf('week');
                const lastWeekStart = moment().subtract(1, 'week').startOf('week');
                const lastWeekEnd = moment().subtract(1, 'week').endOf('week');

                // Using params for efficient filtering where possible
                // But since we need cross-aggregation of this week vs last week, fetching a larger dataset (or all active semester) might be easier if detailed filtering isn't available on API yet.
                // Assuming standard endpoints:
                const commonParams = { semester: activeSemester, academic_year: academicYear };

                const [attendanceRes, gradesRes, journalsRes] = await Promise.all([
                    api.get('/attendances', { params: commonParams }),
                    api.get('/grades', { params: commonParams }),
                    api.get('/journals', { params: { ...commonParams, is_implemented: true } })
                ]);

                // Process Attendance
                const processAttendance = (data, start, end) => {
                    // Handle both direct array and {data: []} structure
                    const items = Array.isArray(data) ? data : (data?.data || []);
                    let total = 0, present = 0;
                    items.forEach(item => {
                        const date = moment(item.date);
                        if (date.isBetween(start, end, null, '[]')) {
                            total++;
                            if (item.status === 'Hadir') present++;
                        }
                    });
                    return total > 0 ? (present / total * 100) : 0;
                };

                // Process Grades
                const processGrades = (data, start, end) => {
                    const items = Array.isArray(data) ? data : (data?.data || []);
                    let total = 0, count = 0;
                    items.forEach(item => {
                        const date = moment(item.date);
                        const score = parseFloat(item.score);
                        if (!isNaN(score) && date.isBetween(start, end, null, '[]')) {
                            total += score;
                            count++;
                        }
                    });
                    return count > 0 ? total / count : 0;
                };

                // Process Journals
                const processJournals = (data, start, end) => {
                    const items = Array.isArray(data) ? data : (data?.data || []);
                    let count = 0;
                    items.forEach(item => {
                        const date = moment(item.date);
                        if (date.isBetween(start, end, null, '[]')) {
                            count++;
                        }
                    });
                    return count;
                };

                setWeeklyStats({
                    thisWeek: {
                        attendance: processAttendance(attendanceRes.data, thisWeekStart, thisWeekEnd),
                        avgGrade: processGrades(gradesRes.data, thisWeekStart, thisWeekEnd),
                        journals: processJournals(journalsRes.data, thisWeekStart, thisWeekEnd)
                    },
                    lastWeek: {
                        attendance: processAttendance(attendanceRes.data, lastWeekStart, lastWeekEnd),
                        avgGrade: processGrades(gradesRes.data, lastWeekStart, lastWeekEnd),
                        journals: processJournals(journalsRes.data, lastWeekStart, lastWeekEnd)
                    }
                });

            } catch (error) {
                console.error("Error fetching weekly stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWeeklyStats();
    }, [activeSemester, academicYear]);

    if (loading) {
        return (
            <div className="chart-container-glass p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="h-36 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                        <div className="h-36 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                        <div className="h-36 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container-glass p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-colors duration-700"></div>

            <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/20 ring-4 ring-white/10">
                    <Calendar size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                        Ringkasan Performa
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Statistik Mingguan</p>
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-900/50">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-tighter">Live</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                <StatCard
                    index={0}
                    icon={ClipboardCheck}
                    title="Tingkat Kehadiran"
                    value={weeklyStats.thisWeek.attendance.toFixed(1)}
                    suffix="%"
                    trend={<TrendIndicator current={weeklyStats.thisWeek.attendance} previous={weeklyStats.lastWeek.attendance} suffix="%" />}
                    color="from-emerald-400 to-green-600"
                    glowClass="hover:chart-glow-green"
                />

                <StatCard
                    index={1}
                    icon={TrendingUp}
                    title="Rata-rata Nilai"
                    value={weeklyStats.thisWeek.avgGrade.toFixed(1)}
                    suffix="poin"
                    trend={<TrendIndicator current={weeklyStats.thisWeek.avgGrade} previous={weeklyStats.lastWeek.avgGrade} suffix="" />}
                    color="from-blue-400 to-indigo-600"
                    glowClass="hover:chart-glow-blue"
                />

                <StatCard
                    index={2}
                    icon={BookOpen}
                    title="Jurnal Terlaksana"
                    value={weeklyStats.thisWeek.journals}
                    suffix="sesi"
                    trend={<TrendIndicator current={weeklyStats.thisWeek.journals} previous={weeklyStats.lastWeek.journals} suffix="" />}
                    color="from-purple-400 to-pink-600"
                    glowClass="hover:chart-glow-purple"
                />
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 relative z-10">
                <div className="h-px bg-gray-200 dark:bg-gray-800 flex-1 opacity-50"></div>
                <div className="px-4 py-1.5 rounded-xl bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-sm border border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                    vs. {moment().subtract(1, 'week').format('DD MMM')} - {moment().subtract(1, 'week').endOf('week').format('DD MMM')}
                </div>
                <div className="h-px bg-gray-200 dark:bg-gray-800 flex-1 opacity-50"></div>
            </div>
        </div>
    );
};

export default AnalyticsOverview;
