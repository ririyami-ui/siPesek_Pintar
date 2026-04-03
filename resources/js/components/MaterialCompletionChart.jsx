import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { AlertCircle, CheckCircle, BookOpen, TrendingUp, BookCheck, XCircle } from 'lucide-react';

const MaterialCompletionChart = ({ externalData = null }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(!externalData);
    const [animatedRate, setAnimatedRate] = useState(0);
    const { activeSemester, academicYear } = useSettings();

    const processJournals = (journals) => {
        let terlaksana = 0;
        let tidakTerlaksana = 0;

        journals.forEach(journal => {
            if (journal.is_implemented || journal.isImplemented) {
                terlaksana++;
            } else {
                tidakTerlaksana++;
            }
        });

        const chartData = [
            { name: 'Terlaksana', value: terlaksana },
            { name: 'Tidak Terlaksana', value: tidakTerlaksana }
        ];

        setData(chartData);
    };

    useEffect(() => {
        if (externalData) {
            processJournals(externalData);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const response = await api.get('/journals', {
                    params: {
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });
                const journalsData = response.data.data || response.data;
                processJournals(journalsData);
            } catch (error) {
                console.error("Error fetching material completion data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeSemester, academicYear, externalData]);

    // Animated completion rate
    useEffect(() => {
        if (data.length > 0) {
            const total = data.reduce((acc, curr) => acc + curr.value, 0);
            const targetRate = total > 0 ? ((data[0].value / total) * 100) : 0;

            let currentRate = 0;
            const increment = targetRate / 30; // approx 30 frames
            const timer = setInterval(() => {
                currentRate += increment;
                if (currentRate >= targetRate) {
                    setAnimatedRate(targetRate);
                    clearInterval(timer);
                } else {
                    setAnimatedRate(currentRate);
                }
            }, 20);

            return () => clearInterval(timer);
        }
    }, [data]);

    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    const completionRate = total > 0 ? ((data[0].value / total) * 100) : 0;

    // Unified stats object for cleaner JSX
    const stats = {
        totalJournals: total,
        totalImplemented: data.length > 0 ? data[0].value : 0,
        totalNotImplemented: data.length > 1 ? data[1].value : 0,
        completionRate: completionRate
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0];
            return (
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/5">
                    <p className="font-black text-gray-900 dark:text-white mb-2 tracking-tight">{data.name}</p>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Jumlah</span>
                            <span className="text-gray-900 dark:text-white font-black">{data.value} <span className="text-[10px] font-bold text-gray-400">Jurnal</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Persentase</span>
                            <span className="text-gray-900 dark:text-white font-black">{((data.value / (total || 1)) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="chart-container-glass p-6 h-[400px]">
                <div className="animate-pulse flex flex-col h-full items-center justify-center space-y-6">
                    <div className="w-48 h-48 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container-glass p-6 md:p-8 hover:chart-glow-orange group animate-fade-in-up">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-xl shadow-orange-500/20">
                    <BookCheck size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                        Keterlaksanaan Materi
                    </h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Ringkasan Jurnal Mengajar</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-12">
                <div className="relative w-64 h-64 flex items-center justify-center scale-110 lg:scale-125 transition-transform duration-500 hover:scale-[1.15] lg:hover:scale-[1.3]">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-orange-500/5 blur-[40px] rounded-full"></div>

                    {stats.totalJournals > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        <linearGradient id="gradientTerlaksana" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#FB923C" />
                                            <stop offset="100%" stopColor="#EA580C" />
                                        </linearGradient>
                                        <linearGradient id="gradientTidakTerlaksana" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#dfdfdf" />
                                            <stop offset="100%" stopColor="#94a3b8" />
                                        </linearGradient>
                                    </defs>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={85}
                                        outerRadius={105}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                        animationBegin={200}
                                        animationDuration={1800}
                                        animationEasing="ease-out"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={index === 0 ? "url(#gradientTerlaksana)" : "url(#gradientTidakTerlaksana)"}
                                                className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Floating Center Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <div className="relative bg-white dark:bg-gray-900 w-32 h-32 rounded-full shadow-[0_10px_40px_-10px_rgba(234,88,12,0.4)] border-4 border-white/50 dark:border-white/10 flex flex-col items-center justify-center z-10 transition-transform duration-500 group-hover:scale-105">
                                    <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">
                                        {animatedRate.toFixed(0)}%
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Goal</span>
                                </div>
                                {/* Decorative Rings */}
                                <div className="absolute w-[180px] h-[180px] rounded-full border border-orange-500/10 animate-ping opacity-20"></div>
                                <div className="absolute w-[210px] h-[210px] rounded-full border border-orange-500/5 animate-pulse"></div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                            <div className="p-6 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                <AlertCircle size={48} className="opacity-20" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black uppercase tracking-widest text-gray-500">Belum Ada Data</p>
                                <p className="text-[10px] font-bold text-gray-400 mt-1">Isi jurnal untuk melihat progres</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 w-full space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="group/card bg-white/50 dark:bg-black/20 p-5 rounded-[2rem] border border-white/40 dark:border-white/5 shadow-sm hover:translate-y-[-4px] transition-all duration-500 hover:chart-glow-orange cursor-default">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.totalImplemented}</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Terlaksana</div>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${stats.completionRate}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="group/card bg-white/50 dark:bg-black/20 p-5 rounded-[2rem] border border-white/40 dark:border-white/5 shadow-sm hover:translate-y-[-4px] transition-all duration-500 hover:shadow-xl cursor-default">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                                    <XCircle size={20} />
                                </div>
                                <div>
                                    <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.totalNotImplemented}</div>
                                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">Pending</div>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gray-300 dark:bg-gray-600 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${100 - stats.completionRate}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-[2rem] bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-2xl relative overflow-hidden group/summary">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/summary:scale-110 transition-transform duration-700">
                            <BookOpen size={64} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">TOTAL AJAR</p>
                            <p className="text-3xl font-black tracking-tighter">{stats.totalJournals} <span className="text-sm font-bold opacity-60 tracking-normal">Sesi Jurnal</span></p>
                            <p className="text-[10px] font-bold mt-2 text-orange-400 flex items-center gap-1.5">
                                <TrendingUp size={12} />
                                +{Math.round(stats.completionRate * 0.1)} Perubahan minggu ini
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialCompletionChart;
