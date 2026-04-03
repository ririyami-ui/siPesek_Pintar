import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { runEarlyWarningAnalysis, getAllStudents } from '../utils/analysis';
import StyledSelect from '../components/StyledSelect';
import { useSettings } from '../utils/SettingsContext';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  ShieldAlert, TrendingUp, Users, AlertTriangle, BookOpen,
  Calendar, UserX, Eye
} from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

const EarlyWarningPage = () => {
  const navigate = useNavigate();
  const [flaggedStudents, setFlaggedStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const { activeSemester, academicYear, geminiModel } = useSettings();

  useEffect(() => {
    const performAnalysis = async () => {
      setIsLoading(true);
      try {
        const [flaggedResults, allStudentsData, classesRes, subjectsRes] = await Promise.all([
          runEarlyWarningAnalysis('me', activeSemester, academicYear, geminiModel),
          getAllStudents(),
          api.get('/classes?all=true'),
          api.get('/subjects')
        ]);
        setFlaggedStudents(flaggedResults);
        setAllStudents(allStudentsData);
        const classList = classesRes.data.data || classesRes.data || [];
        setClasses(classList.map(c => ({ id: String(c.id), ...c })).sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
        const subjectList = subjectsRes.data.data || subjectsRes.data || [];
        setSubjects(subjectList.map(s => ({ id: String(s.id), ...s })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } catch (err) {
        console.error("Early Warning Analysis Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    performAnalysis();
  }, [activeSemester, academicYear, geminiModel]);

  // Filter Logic
  const filteredFlaggedStudents = useMemo(() => {
    return flaggedStudents.filter(student => {
      const classMatch = selectedClass === '' || student.rombel === selectedClass;
      const subjectMatch = selectedSubject === '' ||
        (student.subjectsWithWarnings && student.subjectsWithWarnings.some(s => s.id === selectedSubject || s.name === selectedSubject));
      return classMatch && subjectMatch;
    });
  }, [flaggedStudents, selectedClass, selectedSubject]);

  // Unique Classes & Subjects
  const uniqueClassesFiltered = useMemo(() => {
    return classes;
  }, [classes]);

  const uniqueSubjectsFiltered = useMemo(() => {
    return subjects;
  }, [subjects]);

  // Statistics Calculations
  const stats = useMemo(() => {
    const total = filteredFlaggedStudents.length;

    // Most common warning type
    const warningTypes = {};
    filteredFlaggedStudents.forEach(student => {
      student.warnings.forEach(warning => {
        const type = warning.includes('Nilai') || warning.includes('akademik') ? 'Academic' :
          warning.includes('Alpha') || warning.includes('Kehadiran') ? 'Attendance' : 'Behavior';
        warningTypes[type] = (warningTypes[type] || 0) + 1;
      });
    });
    const mostCommon = Object.keys(warningTypes).reduce((a, b) =>
      warningTypes[a] > warningTypes[b] ? a : b, 'N/A'
    );

    // Class with most issues
    const classCount = {};
    filteredFlaggedStudents.forEach(s => {
      classCount[s.rombel] = (classCount[s.rombel] || 0) + 1;
    });
    const problematicClass = Object.keys(classCount).reduce((a, b) =>
      classCount[a] > classCount[b] ? a : b, 'N/A'
    );

    return { total, mostCommon, problematicClass };
  }, [filteredFlaggedStudents]);

  // Chart Data: Students per Class
  const classChartData = useMemo(() => {
    const classCount = {};
    filteredFlaggedStudents.forEach(s => {
      classCount[s.rombel] = (classCount[s.rombel] || 0) + 1;
    });
    return Object.keys(classCount).map(cls => ({
      class: cls,
      students: classCount[cls]
    })).sort((a, b) => b.students - a.students);
  }, [filteredFlaggedStudents]);

  // Chart Data: Warning Types Distribution
  const warningTypeData = useMemo(() => {
    const types = { Academic: 0, Attendance: 0, Behavior: 0 };
    filteredFlaggedStudents.forEach(student => {
      student.warnings.forEach(warning => {
        if (warning.includes('Nilai') || warning.includes('akademik')) types.Academic++;
        else if (warning.includes('Alpha') || warning.includes('Kehadiran')) types.Attendance++;
        else types.Behavior++;
      });
    });
    return [
      { name: 'Academic', value: types.Academic },
      { name: 'Attendance', value: types.Attendance },
      { name: 'Behavior', value: types.Behavior }
    ].filter(d => d.value > 0);
  }, [filteredFlaggedStudents]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-t-primary"></div>
        <p className="ml-4 text-lg">Menganalisis data siswa...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <ShieldAlert className="text-red-500" size={32} />
            Dashboard Monitoring Siswa
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Sistem peringatan dini & analisis komprehensif
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded border border-red-100 dark:border-red-800 w-fit">
            <ShieldAlert size={12} /> Intelligence Engine Integrated: BSKAP 2025
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StyledSelect
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">Semua Kelas</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.rombel}>
              {cls.rombel}
            </option>
          ))}
        </StyledSelect>
        <StyledSelect
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">Semua Mata Pelajaran</option>
          {subjects.map(sub => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </StyledSelect>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-semibold">Siswa Berisiko</p>
              <p className="text-4xl font-black mt-2">{stats.total}</p>
            </div>
            <UserX size={40} className="opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-semibold">Peringatan Terbanyak</p>
              <p className="text-2xl font-black mt-2">{stats.mostCommon}</p>
            </div>
            <AlertTriangle size={40} className="opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-semibold">Kelas Bermasalah</p>
              <p className="text-2xl font-black mt-2">{stats.problematicClass}</p>
            </div>
            <Users size={40} className="opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-semibold">Periode Aktif</p>
              <p className="text-lg font-bold mt-2">{activeSemester}</p>
              <p className="text-xs text-blue-100">{academicYear}</p>
            </div>
            <Calendar size={40} className="opacity-50" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Students per Class */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-blue-500" />
            Siswa Berisiko per Kelas
          </h3>
          {classChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-20">Tidak ada data</p>
          )}
        </div>

        {/* Pie Chart: Warning Types */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            Distribusi Tipe Peringatan
          </h3>
          {warningTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={warningTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {warningTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-20">Tidak ada data</p>
          )}
        </div>
      </div>

      {/* Quick Access Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
          <BookOpen size={20} className="text-green-500" />
          Daftar Siswa Memerlukan Perhatian ({filteredFlaggedStudents.length})
        </h3>
        {filteredFlaggedStudents.length > 0 ? (
          <div className="overflow-x-auto">
            {/* ... table content remains same ... */}
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="p-3 font-semibold">Nama</th>
                  <th className="p-3 font-semibold">Kelas</th>
                  <th className="p-3 font-semibold">Peringatan</th>
                  <th className="p-3 font-semibold">Poin</th>
                  <th className="p-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlaggedStudents
                  .sort((a, b) => {
                    // Sort by class first
                    if ((a.rombel || '') !== (b.rombel || '')) {
                      return (a.rombel || '').localeCompare(b.rombel || '');
                    }
                    // Then by name
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .map(student => (
                    <tr key={student.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="p-3 font-semibold text-gray-800 dark:text-white">{student.name}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{student.rombel}</td>
                      <td className="p-3">
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                          {student.warnings.slice(0, 2).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                          {student.warnings.length > 2 && (
                            <li className="text-xs text-gray-500">+{student.warnings.length - 2} lainnya</li>
                          )}
                        </ul>
                      </td>
                      <td className="p-3">
                        {student.totalPointsDeducted > 0 && (
                          <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full dark:bg-red-900/40 dark:text-red-400">
                            -{student.totalPointsDeducted}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => navigate('/rekap-individu', {
                            state: {
                              studentId: student.id,
                              classId: student.rombel,
                              subject: selectedSubject
                            }
                          })}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center gap-2 mx-auto"
                        >
                          <Eye size={16} />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            {selectedClass ? (
              <>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={48} className="text-green-500" />
                </div>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Semua siswa di kelas {selectedClass} dalam kondisi baik! 🎉
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Tidak ada siswa yang teridentifikasi memerlukan perhatian khusus saat ini.
                </p>
              </>
            ) : (
              <>
                <TrendingUp size={64} className="mx-auto text-green-500 mb-4" />
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Tidak ada siswa yang teridentifikasi memerlukan perhatian khusus! 🎉
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Semua siswa dalam kondisi baik sesuai kriteria peringatan dini.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EarlyWarningPage;