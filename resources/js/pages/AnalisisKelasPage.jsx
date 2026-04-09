import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Loader, FileText, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { generateClassAnalysisReport, generateConciseClassAnalysisReport } from '../utils/gemini';
import { useSettings } from '../utils/SettingsContext';
import { generateDataHash } from '../utils/cacheUtils';

import PieChart from '../components/PieChart';
import RadarChart from '../components/RadarChart';
import SummaryCard from '../components/SummaryCard';
import TopicMasteryHeatmap from '../components/TopicMasteryHeatmap';
import { getAllStudents, getAllGrades, getAllAttendance, getAllInfractions, getAllJournals } from '../utils/analysis';
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  ShieldAlert,
  TrendingUp,
  Award,
  Brain,
  ArrowLeft,
  Trophy,
  AlertTriangle,
  Lightbulb,
  Info,
  CheckCircle
} from 'lucide-react';

const AnalisisKelasPage = () => {
  const { rombel } = useParams();
  const navigate = useNavigate();
  const [userClasses, setUserClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [isConcise, setIsConcise] = useState(true);
  const [analysisData, setAnalysisData] = useState(null);
  const { activeSemester, academicYear, geminiModel, userProfile } = useSettings();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingClasses(true);
      try {
        const [classesRes, subjectsRes] = await Promise.all([
          api.get('/classes'),
          api.get('/subjects')
        ]);
        const classData = classesRes.data.data || classesRes.data || [];
        const classes = classData.map(c => ({ id: String(c.id), ...c, name: c.rombel }));
        setUserClasses(classes.sort((a, b) => a.name.localeCompare(b.name)));
        const subjectData = subjectsRes.data.data || subjectsRes.data || [];
        localStorage.setItem('cached-subjects', JSON.stringify(subjectData));
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
      setLoadingClasses(false);
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (rombel && userClasses.length > 0) {
      const targetClass = userClasses.find(c => c.name === rombel);
      if (targetClass) setSelectedClass(targetClass.id);
    }
  }, [rombel, userClasses]);

  const hasAutoRun = useRef(false);

  const generateReportForClass = async (classId) => {
    if (!classId) return;
    setLoading(true);
    setReport('');
    setAnalysisData(null);

    try {
      const classInfo = userClasses.find(c => String(c.id) === String(classId) || c.name === classId);
      if (!classInfo) {
        console.warn("Class lookup failed for ID/Name:", classId, "Available classes:", userClasses);
        setReport("⚠️ **Kelas tidak ditemukan.**");
        setLoading(false);
        return;
      }

      const [students, grades, attendance, infractions, journals] = await Promise.all([
        getAllStudents(null, classInfo.rombel),
        getAllGrades(null, null, activeSemester, academicYear, classId),
        getAllAttendance(null, null, activeSemester, academicYear, classId),
        getAllInfractions(null, null, activeSemester, academicYear, classId),
        getAllJournals(null, activeSemester, academicYear, classId)
      ]);

      if (students.length === 0) {
        setReport("⚠️ **Daftar Siswa Kosong.** Masukkan data siswa terlebih dahulu.");
        setLoading(false);
        return;
      }

      const studentIdToNameMap = students.reduce((acc, s) => { acc[String(s.id)] = s.name; return acc; }, {});
      const cachedSubjects = JSON.parse(localStorage.getItem('cached-subjects') || '[]');
      const subjectIdToNameMap = cachedSubjects.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});

      const mappedGrades = grades.map(g => ({
        ...g,
        studentName: studentIdToNameMap[g.studentId] || 'Siswa',
        subjectName: g.subjectName || subjectIdToNameMap[g.subjectId] || 'Mata Pelajaran'
      }));

      const mappedAttendance = attendance.map(a => ({ ...a, studentName: studentIdToNameMap[a.studentId] || 'Siswa' }));
      const mappedInfractions = infractions.map(i => ({ ...i, studentName: studentIdToNameMap[i.studentId] || 'Siswa' }));

      if (mappedGrades.length === 0 && mappedAttendance.length === 0 && mappedInfractions.length === 0 && journals.length === 0) {
        setReport("⚠️ **Data Analisis Kosong.** Belum ada nilai/absensi untuk dianalisis.");
        setLoading(false);
        return;
      }

      const stats = {
        academic: { avg: 0, highest: 0, lowest: 0, topPerformers: [], bottomPerformers: [] },
        attendance: { Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0, pct: 0 },
        infractions: { total: infractions.length, totalPoints: infractions.reduce((a, b) => a + (b.points || 0), 0) }
      };

      if (grades.length > 0) {
        const scores = grades.map(g => parseFloat(g.score)).filter(s => !isNaN(s));
        if (scores.length > 0) {
          stats.academic.avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
          stats.academic.highest = Math.max(...scores);
          stats.academic.lowest = Math.min(...scores);
          const studentPerformanceMap = {};
          mappedGrades.forEach(g => {
            if (!studentPerformanceMap[g.studentName]) studentPerformanceMap[g.studentName] = { t: 0, c: 0 };
            studentPerformanceMap[g.studentName].t += parseFloat(g.score);
            studentPerformanceMap[g.studentName].c++;
          });
          const ranked = Object.entries(studentPerformanceMap)
            .map(([name, d]) => ({ name, avg: parseFloat((d.t / d.c).toFixed(1)) }))
            .sort((a, b) => b.avg - a.avg);
          stats.academic.topPerformers = ranked.slice(0, 5);
          stats.academic.bottomPerformers = ranked.reverse().slice(0, 5).filter(s => s.avg < 75);
        }
      }

      if (attendance.length > 0) {
        attendance.forEach(a => { if (stats.attendance.hasOwnProperty(a.status)) stats.attendance[a.status]++; });
        stats.attendance.pct = ((stats.attendance.Hadir / attendance.length) * 100).toFixed(1);
      }

      const classData = {
        className: classInfo.name,
        students: students.map(s => ({ name: s.name })),
        grades: mappedGrades,
        attendance: mappedAttendance,
        infractions: mappedInfractions,
        journals: journals,
        stats: stats
      };

      setAnalysisData(classData);

      const cacheKey = `class-analysis-${classId}-${generateDataHash(classData)}-${isConcise ? 'c' : 'f'}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setReport(cached);
        setLoading(false);
        return;
      }

      const genReport = isConcise ? await generateConciseClassAnalysisReport(classData, geminiModel) : await generateClassAnalysisReport(classData, geminiModel);
      setReport(genReport);
      localStorage.setItem(cacheKey, genReport);

    } catch (error) {
      setReport("❌ Gagal membuat laporan AI. Silakan coba lagi.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass && rombel && !hasAutoRun.current && userClasses.length > 0) {
      hasAutoRun.current = true;
      generateReportForClass(selectedClass);
    }
  }, [selectedClass, rombel, userClasses]);

  return (
    <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">Laporan Analisis Kelas</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        {loadingClasses ? <Loader className="animate-spin" /> : (
          <div className="flex flex-col sm:flex-row gap-4">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="flex-1 p-2 border rounded-lg dark:bg-gray-700">
              <option value="">-- Pilih Kelas --</option>
              {userClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={isConcise} onChange={() => setIsConcise(!isConcise)} />
              <span>Mode Ringkas</span>
            </div>
            <button onClick={() => generateReportForClass(selectedClass)} disabled={!selectedClass || loading} className="px-6 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2">
              {loading ? <Loader className="animate-spin" size={20} /> : <Zap size={20} />}
              {loading ? 'Membuat...' : 'Buat Laporan'}
            </button>
          </div>
        )}
      </div>

      {report && !loading && (
        <div className="space-y-8 animate-fade-in-up">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border dark:border-gray-700">
            <h2 className="text-xl font-black flex items-center gap-3">
              <TrendingUp className="text-blue-600" />
              <span>Analisis Kelas: {analysisData?.className || 'Hasil'}</span>
            </h2>
            {analysisData && (
              <button 
                onClick={() => import('../utils/pdfGenerator').then(m => m.generateClassAnalysisPDF(analysisData, report, userProfile?.name || 'Guru', userProfile || {}))}
                className="px-4 py-2 bg-green-600 text-white rounded-xl flex items-center gap-2 text-sm"
              >
                <FileText size={18} /> PDF
              </button>
            )}
          </div>

          {analysisData && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Rata-rata" value={analysisData.stats.academic.avg} icon={<GraduationCap />} color="blue" subtitle={`Max: ${analysisData.stats.academic.highest}`} />
                <SummaryCard title="Kehadiran" value={`${analysisData.stats.attendance.pct}%`} icon={<ClipboardCheck />} color="green" subtitle={`${analysisData.stats.attendance.Hadir} Hadir`} />
                <SummaryCard title="Pelanggaran" value={analysisData.stats.infractions.total} icon={<ShieldAlert />} color="red" subtitle={`${analysisData.stats.infractions.totalPoints} Poin`} />
                <SummaryCard title="Siswa" value={analysisData.students.length} icon={<Users />} color="purple" subtitle="Aktif" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-6 rounded-3xl shadow-xl">
                 <div className="space-y-4">
                    <h3 className="text-sm font-bold text-green-600 flex items-center gap-2"><Award size={16} /> Top 5 Siswa</h3>
                    {analysisData.stats.academic.topPerformers.map((s, i) => (
                      <div key={i} className="flex justify-between p-2 bg-green-50 rounded-lg text-xs"><span>{s.name}</span><span className="font-bold">{s.avg}</span></div>
                    ))}
                 </div>
                 <div className="h-[300px] flex items-center justify-center">
                    <RadarChart 
                      data={{
                        "Kewargaan": analysisData.stats.attendance.pct || 80,
                        "Kritis": analysisData.stats.academic.avg || 75,
                        "Kreatif": analysisData.stats.academic.avg || 75,
                        "Mandiri": analysisData.stats.attendance.pct || 80,
                        "Komunikasi": 80
                      }}
                      size={250} 
                    />
                 </div>
                 <div className="lg:col-span-2">
                    <PieChart data={analysisData.stats.attendance} />
                 </div>
              </div>
            </>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex items-center gap-4">
              <Brain size={24} className="animate-pulse" />
              <h3 className="text-lg font-black uppercase">Rekomendasi AI</h3>
            </div>
            <div className="p-6">
              <div className="prose dark:prose-invert max-w-none prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                  {report}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center mt-10 text-blue-500">
          <Loader className="w-10 h-10 animate-spin" />
          <p className="mt-2 font-medium">Menganalisis data...</p>
        </div>
      )}
    </div>
  );
};

export default AnalisisKelasPage;