import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { Calendar, TrendingUp } from 'lucide-react';
import moment from 'moment';

const AttendanceTrendChart = ({ externalData = null }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(!externalData);
    const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
    const { activeSemester, academicYear } = useSettings();

    const processAttendance = (attendanceData) => {
        const attendanceByDate = {}; // { 'YYYY-MM-DD': { date, Hadir, Sakit, ... } }

        attendanceData.forEach(att => {
            const dateKey = moment(att.date).format('YYYY-MM-DD');

            if (!attendanceByDate[dateKey]) {
                attendanceByDate[dateKey] = {
                    date: dateKey,
                    Hadir: 0,
                    Sakit: 0,
                    Ijin: 0,
                    Alpha: 0,
                    total: 0
                };
            }

            const status = att.status?.toLowerCase();
            if (status === 'hadir') {
                attendanceByDate[dateKey].Hadir++;
                attendanceByDate[dateKey].total++;
            } else if (status === 'sakit') {
                attendanceByDate[dateKey].Sakit++;
                attendanceByDate[dateKey].total++;
            } else if (status === 'izin') {
                attendanceByDate[dateKey].Ijin++;
                attendanceByDate[dateKey].total++;
            } else if (status === 'alpa') {
                attendanceByDate[dateKey].Alpha++;
                attendanceByDate[dateKey].total++;
            }
        });

        // Convert to array and sort by date
        let chartData = Object.values(attendanceByDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Filter based on view mode
        if (viewMode === 'week') {
            const weekAgo = moment().subtract(7, 'days');
            chartData = chartData.filter(item => moment(item.date).isAfter(weekAgo));
        } else {
            const monthAgo = moment().subtract(30, 'days');
            chartData = chartData.filter(item => moment(item.date).isAfter(monthAgo));
        }

        // Format dates for display
        chartData = chartData.map(item => ({
            ...item,
            displayDate: moment(item.date).format('DD MMM'),
            // Calculate percentages for tooltip
            hadirPct: item.total > 0 ? ((item.Hadir / item.total) * 100).toFixed(1) : 0
        }));

        setData(chartData);
    };

    useEffect(() => {
        if (externalData) {
            processAttendance(externalData);
            setLoading(false);
            return;
        }

        const fetchAttendanceTrend = async () => {
            try {
                const response = await api.get('/attendances', {
                    params: {
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });
                const attendanceData = response.data.data || response.data;
                processAttendance(attendanceData);
            } catch (error) {
                console.error("Error fetching attendance trend:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendanceTrend();
    }, [activeSemester, academicYear, viewMode, externalData]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/5">
                    <p className="font-black text-gray-900 dark:text-white mb-2 tracking-tight">{data.displayDate}</p>
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                <span className="text-gray-600 dark:text-gray-400 font-bold">Hadir</span>
                            </div>
                            <span className="text-gray-900 dark:text-white font-black">{data.Hadir} <span className="text-[10px] font-bold text-gray-400">({data.hadirPct}%)</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                                <span className="text-gray-600 dark:text-gray-400 font-bold">Sakit</span>
                            </div>
                            <span className="text-gray-900 dark:text-white font-black">{data.Sakit}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                <span className="text-gray-600 dark:text-gray-400 font-bold">Ijin</span>
                            </div>
                            <span className="text-gray-900 dark:text-white font-black">{data.Ijin}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                                <span className="text-gray-600 dark:text-gray-400 font-bold">Alpha</span>
                            </div>
                            <span className="text-gray-900 dark:text-white font-black">{data.Alpha}</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <span>Total Siswa</span>
                        <span>{data.total}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="chart-container-glass p-6 h-[400px]">
                <div className="animate-pulse h-full flex flex-col">
                    <div className="flex justify-between mb-8">
                        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/3"></div>
                        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/4"></div>
                    </div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container-glass p-6 md:p-8 hover:chart-glow-blue group animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                            Tren Kehadiran
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                {viewMode === 'week' ? '7 Hari Terakhir' : '30 Hari Terakhir'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                    <button
                        onClick={() => setViewMode('week')}
                        className={`px-5 py-2 rounded-xl text-xs font-black tracking-tighter transition-all duration-300 ${viewMode === 'week'
                            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-white/5'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        MINGGUAN
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-5 py-2 rounded-xl text-xs font-black tracking-tighter transition-all duration-300 ${viewMode === 'month'
                            ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200/50 dark:border-white/5'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        BULANAN
                    </button>
                </div>
            </div>

            <div className="h-80 w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorSakit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorIjin" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorAlpha" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="8 8" stroke="currentColor" className="text-gray-200 dark:text-gray-800" vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Legend
                                verticalAlign="top"
                                align="right"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-2">{value}</span>}
                            />
                            <Area
                                type="monotone"
                                dataKey="Hadir"
                                stackId="1"
                                stroke="#10B981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorHadir)"
                                animationDuration={2000}
                            />
                            <Area
                                type="monotone"
                                dataKey="Sakit"
                                stackId="1"
                                stroke="#F59E0B"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSakit)"
                                animationDuration={2200}
                            />
                            <Area
                                type="monotone"
                                dataKey="Ijin"
                                stackId="1"
                                stroke="#3B82F6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorIjin)"
                                animationDuration={2400}
                            />
                            <Area
                                type="monotone"
                                dataKey="Alpha"
                                stackId="1"
                                stroke="#EF4444"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorAlpha)"
                                animationDuration={2600}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                        <div className="p-6 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                            <Calendar size={48} className="opacity-20" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-widest text-gray-500">Belum Ada Data</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">Lakukan absensi untuk melihat tren</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceTrendChart;
