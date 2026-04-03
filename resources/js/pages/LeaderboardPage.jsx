import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import { getAllStudents, getAllGrades, getAllInfractions } from '../utils/analysis';
import { Trophy, Medal, Star, Award, User, Search } from 'lucide-react';
import StyledSelect from '../components/StyledSelect';
import { useSettings } from '../utils/SettingsContext';

const LeaderboardPage = () => {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [studentsRank, setStudentsRank] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { activeSemester, academicYear } = useSettings();

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await api.get('/classes');
                const classData = res.data.data || res.data || [];
                setClasses(classData);
            } catch (error) {
                console.error("Error fetching classes:", error);
            }
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                const rombelFilter = selectedClass === 'all' ? null : selectedClass;
                const [studentsData, infractionsData, gradesData] = await Promise.all([
                    getAllStudents(null, rombelFilter),
                    getAllInfractions(null, null, activeSemester, academicYear),
                    getAllGrades(null, null, activeSemester, academicYear)
                ]);

                // Calculate scores
                const rankedStudents = studentsData.map(student => {
                    // Discipline Score
                    const studentInfractions = infractionsData.filter(inf => inf.studentId === student.id);
                    const totalPointsDeducted = studentInfractions.reduce((acc, curr) => acc + (curr.points || 0), 0);
                    const disciplineScore = 100 - totalPointsDeducted;

                    // Academic Score
                    const studentGrades = gradesData.filter(g => g.studentId === student.id);
                    let academicScore = 0;
                    if (studentGrades.length > 0) {
                        const totalGrades = studentGrades.reduce((sum, g) => sum + (parseFloat(g.score) || 0), 0);
                        academicScore = totalGrades / studentGrades.length;
                    } else {
                        academicScore = 0;
                    }

                    // Final Weighted Score (50% Discipline + 50% Academic)
                    let finalScore = (disciplineScore * 0.5) + (academicScore * 0.5);
                    finalScore = parseFloat(finalScore.toFixed(2));

                    let badge = null;
                    let badgeColor = "";
                    if (finalScore >= 95) {
                        badge = "Siswa Teladan";
                        badgeColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
                    } else if (finalScore >= 85) {
                        badge = "Berprestasi";
                        badgeColor = "bg-green-100 text-green-700 border-green-200";
                    } else if (finalScore >= 75) {
                        badge = "Baik";
                        badgeColor = "bg-blue-100 text-blue-700 border-blue-200";
                    }

                    return {
                        ...student,
                        score: finalScore,
                        disciplineScore,
                        academicScore: academicScore.toFixed(2),
                        badge,
                        badgeColor,
                        rombel: student.rombel || student.class?.rombel || '-'
                    };
                });

                // Sort by score (desc) and name (asc)
                rankedStudents.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.name.localeCompare(b.name);
                });

                // FILTER: Only show students who have actual grades entered
                const validRankedStudents = rankedStudents.filter(s => parseFloat(s.academicScore) > 0);

                setStudentsRank(validRankedStudents);
            } catch (error) {
                console.error("Error fetching leaderboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [selectedClass, activeSemester, academicYear]);

    const filteredStudents = studentsRank.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.rombel.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRankIcon = (index) => {
        if (index === 0) return <Trophy className="text-yellow-500" size={24} />;
        if (index === 1) return <Medal className="text-gray-400" size={24} />;
        if (index === 2) return <Award className="text-orange-500" size={24} />;
        return <span className="text-gray-500 font-bold ml-1">{index + 1}</span>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Trophy className="text-yellow-500" /> Leaderboard Akademik & Kedisiplinan
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Peringkat berdasarkan kombinasi nilai akademik (50%) dan kedisiplinan (50%).</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari nama atau kelas..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 outline-none transition-all dark:text-white w-full sm:w-64"
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <StyledSelect
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="all">Semua Kelas</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.rombel}>{c.rombel}</option>
                            ))}
                        </StyledSelect>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-yellow-500 border-gray-200"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top 3 Focus */}
                    <div className="lg:col-span-1 space-y-4">
                        <h3 className="font-semibold text-gray-700 dark:text-gray-300 ml-1">Para Teladan</h3>
                        <div className="space-y-4">
                            {filteredStudents.slice(0, 3).map((student, index) => (
                                <div key={student.id} className={`relative p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] ${index === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-900/30' :
                                    index === 1 ? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700' :
                                        'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-900/30'
                                    }`}>
                                    <div className="absolute -top-3 -right-3">
                                        {getRankIcon(index)}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                                            <User className="text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white truncate max-w-[150px]">{student.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{student.rombel}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-between items-end">
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${student.badgeColor}`}>
                                            {student.badge}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 uppercase font-semibold">Total Poin</p>
                                            <p className="text-2xl font-black text-gray-800 dark:text-white">{student.score}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredStudents.length === 0 && (
                                <div className="p-10 text-center bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <p className="text-gray-400">Data belum cukup untuk menampilkan peringkat.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Full List */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Siswa</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kelas</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Akademik</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Disiplin</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {filteredStudents.map((student, index) => (
                                            <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        {getRankIcon(index)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-semibold text-gray-800 dark:text-white whitespace-nowrap">{student.name}</p>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{student.rombel}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{student.academicScore}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{student.disciplineScore}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-bold ${student.score >= 90 ? 'text-green-500' : student.score >= 75 ? 'text-blue-500' : 'text-orange-500'}`}>
                                                        {student.score}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {student.badge ? (
                                                        <div className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-tighter whitespace-nowrap ${student.badgeColor}`}>
                                                            {student.badge}
                                                        </div>
                                                    ) : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredStudents.length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-gray-400 italic">Data Akademik & Kedisiplinan belum tersedia untuk periode ini.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaderboardPage;
