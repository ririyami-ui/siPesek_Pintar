import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';
import { BarChart3, TrendingUp, AlertCircle } from 'lucide-react';

const GradeDistributionChart = ({ externalData = null }) => {
    const [data, setData] = useState([]);
    const [stats, setStats] = useState({ avg: 0, median: 0, total: 0 });
    const [loading, setLoading] = useState(!externalData);
    const { activeSemester, academicYear } = useSettings();

    const processGrades = (gradesData) => {
        const grades = [];
        gradesData.forEach(grade => {
            const score = parseFloat(grade.score);
            if (!isNaN(score) && score >= 0 && score <= 100) {
                grades.push(score);
            }
        });

        // Create distribution buckets
        const distribution = {
            'Sangat Rendah\n(0-50)': { count: 0, range: [0, 50], color: '#EF4444' },
            'Rendah\n(51-75)': { count: 0, range: [51, 75], color: '#F59E0B' },
            'Baik\n(76-85)': { count: 0, range: [76, 85], color: '#3B82F6' },
            'Sangat Baik\n(86-100)': { count: 0, range: [86, 100], color: '#10B981' }
        };

        grades.forEach(grade => {
            if (grade <= 50) distribution['Sangat Rendah\n(0-50)'].count++;
            else if (grade <= 75) distribution['Rendah\n(51-75)'].count++;
            else if (grade <= 85) distribution['Baik\n(76-85)'].count++;
            else distribution['Sangat Baik\n(86-100)'].count++;
        });

        const chartData = Object.entries(distribution).map(([name, data]) => ({
            name,
            Jumlah: data.count,
            color: data.color,
            percentage: grades.length > 0 ? ((data.count / grades.length) * 100).toFixed(1) : 0
        }));

        setData(chartData);

        if (grades.length > 0) {
            const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
            const sorted = [...grades].sort((a, b) => a - b);
            const median = sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];

            setStats({ avg, median, total: grades.length });
        } else {
            setStats({ avg: 0, median: 0, total: 0 });
        }
    };

    useEffect(() => {
        if (externalData) {
            processGrades(externalData);
            setLoading(false);
            return;
        }

        const fetchGradeDistribution = async () => {
            try {
                const response = await api.get('/grades', {
                    params: {
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });
                const gradesData = response.data.data || response.data;
                processGrades(gradesData);
            } catch (error) {
                console.error("Error fetching grade distribution:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGradeDistribution();
    }, [activeSemester, academicYear, externalData]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 ring-1 ring-black/5">
                    <p className="font-black text-gray-900 dark:text-white mb-2 tracking-tight">{data.name.replace('\n', ' ')}</p>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Jumlah</span>
                            <span className="text-gray-900 dark:text-white font-black">{data.Jumlah} <span className="text-[10px] font-bold text-gray-400">Siswa</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Persentase</span>
                            <span className="text-gray-900 dark:text-white font-black">{data.percentage}%</span>
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
                <div className="animate-pulse flex flex-col h-full space-y-6">
                    <div className="flex justify-between">
                        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/3"></div>
                        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/4"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                        <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                        <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                    </div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="chart-container-glass p-6 md:p-8 hover:chart-glow-purple group animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl shadow-purple-500/20">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent tracking-tight">
                            Distribusi Nilai
                        </h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            Semester {activeSemester} {academicYear}
                        </p>
                    </div>
                </div>

                {stats.total > 0 && (
                    <div className="bg-white/50 dark:bg-black/20 p-2 pl-4 pr-3 rounded-2xl border border-white/20 dark:border-white/5 backdrop-blur-md flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-1">RATA-RATA</div>
                            <div className={`text-2xl font-black tracking-tighter ${stats.avg >= 85 ? 'text-green-600' :
                                stats.avg >= 75 ? 'text-blue-600' :
                                    stats.avg >= 60 ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                {stats.avg.toFixed(1)}
                            </div>
                        </div>
                        <div className={`p-2 rounded-xl ${stats.avg >= 75 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            <TrendingUp size={20} className={stats.avg < 75 ? 'rotate-180' : ''} />
                        </div>
                    </div>
                )}
            </div>

            {stats.total > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-8">
                    <div className="bg-gradient-to-br from-blue-500/10 to-transparent p-4 rounded-[1.5rem] border border-blue-500/10 hover:bg-blue-500/20 transition-all duration-300">
                        <div className="text-[10px] text-blue-600/70 dark:text-blue-400 font-black uppercase tracking-widest mb-1">DATA</div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.total}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500/10 to-transparent p-4 rounded-[1.5rem] border border-purple-500/10 hover:bg-purple-500/20 transition-all duration-300">
                        <div className="text-[10px] text-purple-600/70 dark:text-purple-400 font-black uppercase tracking-widest mb-1">RATA</div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.avg.toFixed(1)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-500/10 to-transparent p-4 rounded-[1.5rem] border border-pink-500/10 hover:bg-pink-500/20 transition-all duration-300">
                        <div className="text-[10px] text-pink-600/70 dark:text-pink-400 font-black uppercase tracking-widest mb-1">MEDIAN</div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stats.median.toFixed(1)}</div>
                    </div>
                </div>
            )}

            <div className="h-80 w-full relative">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full pointer-events-none"></div>
                {stats.total > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="8 8" stroke="currentColor" className="text-gray-200 dark:text-gray-800" vertical={false} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={(props) => {
                                    const { x, y, payload } = props;
                                    const lines = payload.value.split('\n');
                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text x={0} y={15} textAnchor="middle" className="text-[10px] font-black fill-gray-400">
                                                {lines[0]}
                                            </text>
                                            <text x={0} y={30} textAnchor="middle" className="text-[9px] font-bold fill-gray-400 opacity-60">
                                                {lines[1]}
                                            </text>
                                        </g>
                                    );
                                }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139, 92, 246, 0.05)', radius: 12 }} />
                            <Bar dataKey="Jumlah" radius={[12, 12, 0, 0]} animationDuration={2000} barSize={40}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                        <div className="p-6 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                            <AlertCircle size={48} className="opacity-20" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-widest text-gray-500">Belum Ada Data Nilai</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-1">Input nilai siswa untuk melihat distribusi akademik</p>
                        </div>
                    </div>
                )}
            </div>

            {stats.total > 0 && (
                <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.map((category, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-white/40 dark:border-white/5 shadow-sm hover:translate-y-[-2px] transition-transform duration-300">
                            <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]" style={{ backgroundColor: category.color, boxShadow: `0 0 15px ${category.color}44` }}></div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-gray-900 dark:text-white tracking-tight">{category.percentage}%</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 truncate">{category.name.split('\n')[0]}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default GradeDistributionChart;
