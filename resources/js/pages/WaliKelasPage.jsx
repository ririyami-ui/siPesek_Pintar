import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { 
  Users, 
  Calendar, 
  ShieldX, 
  Award, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  PieChart as PieIcon,
  Loader2,
  ChevronRight,
  Info
} from 'lucide-react';
import SummaryCard from '../components/SummaryCard';
import PieChart from '../components/PieChart';
import BarChart from '../components/BarChart';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';
import { useSettings } from '../utils/SettingsContext';

export default function WaliKelasPage() {
  const [myClass, setMyClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [dailyRecap, setDailyRecap] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [rawAttendanceLogs, setRawAttendanceLogs] = useState([]);
  const [infractions, setInfractions] = useState([]);
  const [grades, setGrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { activeSemester, academicYear } = useSettings();

  useEffect(() => {
    const fetchWaliData = async () => {
      setIsLoading(true);
      try {
        // 1. Get My Class Info
        const classRes = await api.get('/wali/my-class');
        const classData = classRes.data.data;
        setMyClass(classData);

        // 2. Get Students
        const studentsRes = await api.get('/students', { params: { class_id: classData.id } });
        const studentList = studentsRes.data.data || studentsRes.data || [];
        setStudents(studentList);

        // 3. Get Attendance for the last 30 days
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const attendanceRes = await api.get('/attendances', {
          params: {
            class_id: classData.id,
            date_start: thirtyDaysAgo.toISOString().split('T')[0],
            date_end: today.toISOString().split('T')[0]
          }
        });
        const attData = attendanceRes.data.data || attendanceRes.data || [];
        processAttendance(attData, studentList);

        // 4. Get Infractions
        const infractionRes = await api.get('/infractions', { params: { class_id: classData.id } });
        setInfractions(infractionRes.data.data || infractionRes.data || []);

        // 5. Get Grades Summary
        const gradesRes = await api.get('/grades', { params: { class_id: classData.id } });
        setGrades(gradesRes.data.data || gradesRes.data || []);

      } catch (error) {
        console.error("Error fetching Wali Kelas data:", error);
        if (error.response?.status === 404) {
          toast.error("Anda belum ditugaskan sebagai Wali Kelas.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchWaliData();
  }, []);

  const processAttendance = (rawDocs, studentList) => {
    if (!rawDocs.length) return;

    setRawAttendanceLogs(rawDocs);

    const dailyMap = {};
    const summary = { Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0 };
    
    // Group by date and student to find "Daily Presence" (Session 1)
    rawDocs.forEach(record => {
      const date = record.date;
      if (!dailyMap[date]) dailyMap[date] = { date, students: {} };
      
      if (!dailyMap[date].students[record.student_id]) {
        dailyMap[date].students[record.student_id] = [];
      }
      dailyMap[date].students[record.student_id].push(record);
    });

    // Calculate Daily Presence Logic: Hadir if ANY session that day is Hadir (or specifically session 1)
    // For this context, we'll use "Hadir in at least 1 session" as Daily presence
    const dailyStats = Object.values(dailyMap).map(day => {
      let presentCount = 0;
      Object.values(day.students).forEach(studentRecords => {
        // Logic: if present in the first recorded session of the day
        const sortedSessions = studentRecords.sort((a, b) => a.id - b.id);
        if (sortedSessions[0].status.toLowerCase() === 'hadir') presentCount++;
      });
      
      return {
        date: day.date,
        present: presentCount,
        total: studentList.length,
        percentage: ((presentCount / studentList.length) * 100).toFixed(1)
      };
    }).sort((a,b) => b.date.localeCompare(a.date));

    setDailyRecap(dailyStats);

    // Subject Summary (All sessions)
    rawDocs.forEach(record => {
      const s = record.status.toLowerCase();
      const status = (s === 'izin' || s === 'ijin') ? 'Ijin' : ((s === 'alpa' || s === 'alpha') ? 'Alpha' : (s === 'hadir' ? 'Hadir' : (s === 'sakit' ? 'Sakit' : record.status)));
      if (summary[status] !== undefined) summary[status]++;
    });
    setAttendanceStats(summary);

    // Group Today's (or latest date) sessions
    const dates = Object.keys(dailyMap).sort((a, b) => b.localeCompare(a));
    if (dates.length > 0) {
      const latestDate = dates[0];
      const sessionsMap = {};
      rawDocs.filter(r => r.date === latestDate).forEach(record => {
        const timeKey = record.time || 'Waktu Tidak Diketahui';
        const subjectName = record.subject?.name || 'Mata Pelajaran';
        const sessionKey = `${timeKey} - ${subjectName}`;
        if (!sessionsMap[sessionKey]) {
          sessionsMap[sessionKey] = {
             time: record.time || 'Waktu Tidak Diketahui',
             subject: subjectName,
             teacher: record.teacher?.name || record.teacher_name || '-',
             students: []
          };
        }
        sessionsMap[sessionKey].students.push(record);
      });
      const sessionsArray = Object.values(sessionsMap).sort((a,b) => a.time.localeCompare(b.time));
      setTodaySessions(sessionsArray);
    } else {
      setTodaySessions([]);
    }
  };

  const handleExportDailyExcel = () => {
    if (dailyRecap.length === 0) {
      alert("Tidak ada data kehadiran harian untuk diekspor.");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(dailyRecap.map(day => ({
      'Tanggal': new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      'Kapasitas': day.total,
      'Hadir Harian': day.present,
      'Persentase Hadir (%)': day.percentage
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Harian');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(dataBlob, `Rekap_Harian_${myClass?.rombel}_30HariTerakhir.xlsx`);
  };

  const handleExportSessionExcel = () => {
    if (rawAttendanceLogs.length === 0) {
      alert("Tidak ada log sesi kehadiran untuk diekspor.");
      return;
    }
    const sortedLogs = [...rawAttendanceLogs].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
    });
    const worksheet = XLSX.utils.json_to_sheet(sortedLogs.map(item => ({
       'Tanggal': item.date || '',
       'Jam Sesi': item.time ? item.time.split(' - ')[0] : '',
       'Mata Pelajaran': item.subject?.name || '',
       'NIS': item.student?.nis || '',
       'Nama Siswa': item.student?.name || 'Unknown',
       'Status': item.status || '',
       'Guru Mapel': item.teacher?.name || item.teacher_name || '-'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Log Sesi');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(dataBlob, `Log_Sesi_${myClass?.rombel}_30HariTerakhir.xlsx`);
  };

  const handleDownloadPdf = async () => {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const response = await api.get('/attendances/pdf', {
        params: {
          class_id: myClass.id,
          date_start: thirtyDaysAgo.toISOString().split('T')[0],
          date_end: today.toISOString().split('T')[0]
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rekap_Absensi_${myClass.rombel}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("PDF Download error:", error);
      toast.error("Gagal mengunduh PDF");
    }
  };

  if (isLoading) {

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-purple-600" />
        <p className="text-gray-500 font-medium animate-pulse">Menghimpun data perwalian...</p>
      </div>
    );
  }

  if (!myClass) {
    return (
      <EmptyState 
        icon={<Users size={48} />}
        title="Bukan Wali Kelas"
        description="Anda belum ditugaskan sebagai Wali Kelas di rombel manapun. Silakan hubungi Admin untuk penugasan."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2 tracking-tight">Monitoring Wali Kelas</h2>
          <p className="text-purple-100 font-medium opacity-90">
            Mengawasi perkembangan Kelas <span className="font-bold underline decoration-2 underline-offset-4">{myClass.rombel}</span> ({myClass.level})
          </p>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
            <Users size={120} />
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Presensi Harian" 
          value={dailyRecap[0]?.percentage ? `${dailyRecap[0].percentage}%` : '0%'} 
          icon={<CheckCircle />} 
          color="green" 
          subtitle="Rata-rata kehadiran hari ini"
        />
        <SummaryCard 
          title="Kehadiran Sesi" 
          value={attendanceStats ? `${((attendanceStats.Hadir / (attendanceStats.Hadir + attendanceStats.Sakit + attendanceStats.Ijin + attendanceStats.Alpha)) * 100 || 0).toFixed(1)}%` : '0%'} 
          icon={<TrendingUp />} 
          color="blue" 
          subtitle="Performa di seluruh mata pelajaran"
        />
        <SummaryCard 
          title="Pelanggaran" 
          value={infractions.length} 
          icon={<ShieldX />} 
          color="red" 
          subtitle="Catatan kedisiplinan bulan ini"
        />
        <SummaryCard 
          title="Kestabilan Nilai" 
          value={grades.length > 0 ? (grades.reduce((a,b) => a + (Number(b.score) || 0), 0) / grades.length).toFixed(1) : '-'} 
          icon={<Award />} 
          color="purple" 
          subtitle="Rata-rata nilai kelas"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Visual Analytics */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <PieIcon size={20} className="text-purple-600" /> Komposisi Kehadiran
            </h3>
            {attendanceStats ? (
              <PieChart data={attendanceStats} />
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 italic">Data belum tersedia</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle size={20} className="text-amber-500" /> Perhatian Khusus
              </h3>
            </div>
            <div className="space-y-3">
              {infractions.slice(0, 5).map((inf, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                    <ShieldX size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{inf.student?.name || 'Siswa'}</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 line-clamp-1">{inf.description}</p>
                  </div>
                </div>
              ))}
              {infractions.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-4 italic">Alhamdulillah, belum ada pelanggaran.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Recap */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Sessions Monitoring */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <CheckCircle size={20} className="text-purple-600" /> Monitoring Sesi Hari Ini
            </h3>
            {todaySessions.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-2">Menampilkan data presensi per sesi pada <b className="text-purple-600 dark:text-purple-400">{new Date(todaySessions[0]?.students[0]?.date || new Date()).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b></p>
                {todaySessions.map((session, idx) => {
                  const absentStudents = session.students.filter(s => s.status.toLowerCase() !== 'hadir');
                  const presentStudents = session.students.filter(s => s.status.toLowerCase() === 'hadir');
                  
                  return (
                  <div key={idx} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-4 bg-gray-50/50 dark:bg-gray-800/30">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200/60 dark:border-gray-700/60">
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200">{session.subject}</h4>
                        <p className="text-xs text-gray-500">{session.time} • Guru: <span className="font-medium">{session.teacher}</span></p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-purple-100 text-purple-700 rounded-full dark:bg-purple-900/30 dark:text-purple-400">
                        {presentStudents.length}/{session.students.length} Hadir
                      </span>
                    </div>
                    
                    {/* Absent Students Section */}
                    {absentStudents.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={12} /> Tidak Hadir ({absentStudents.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {absentStudents.map((student, sIdx) => {
                            const status = student.status.toLowerCase();
                            let colorClass = "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400";
                            let label = "Alpa";
                            
                            if (status === 'sakit') {
                              colorClass = "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400";
                              label = "Sakit";
                            } else if (status === 'izin' || status === 'ijin') {
                              colorClass = "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400";
                              label = "Izin";
                            }

                            return (
                              <span key={sIdx} className={`text-[11px] font-medium border px-2 py-1 rounded-md shadow-sm flex items-center gap-1 ${colorClass}`}>
                                {student.student?.name || 'Siswa'} <span className="opacity-70 text-[9px] font-black uppercase">({label})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Present Students Section */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                         <CheckCircle size={12} /> Hadir ({presentStudents.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {presentStudents.map((student, sIdx) => (
                          <span key={sIdx} className="text-[11px] font-medium bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600 px-2 py-1 rounded-md text-gray-600 dark:text-gray-300 shadow-sm">
                            {student.student?.name || 'Siswa'}
                          </span>
                        ))}
                        {presentStudents.length === 0 && (
                          <span className="text-xs text-gray-400 italic">Tidak ada siswa hadir.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 italic">Belum ada sesi tercatat hari ini.</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Calendar size={20} className="text-purple-600" /> Histori Kehadiran Harian
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportDailyExcel} 
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition shadow-sm dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400"
                >
                  Unduh Harian
                </button>
                <button 
                  onClick={handleExportSessionExcel} 
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition shadow-sm dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400"
                >
                  Unduh Log Sesi
                </button>
                <button 
                  onClick={handleDownloadPdf} 
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition shadow-sm dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400"
                >
                  Unduh PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-3 px-2">Tanggal</th>
                    <th className="pb-3 px-2">Kapasitas</th>
                    <th className="pb-3 px-2">Hadir Harian</th>
                    <th className="pb-3 px-2 text-right">Persentase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {dailyRecap.map((day, i) => (
                    <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 px-2 font-bold text-sm text-gray-700 dark:text-gray-300">
                        {new Date(day.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </td>
                      <td className="py-4 px-2 text-sm text-gray-500">{day.total} Siswa</td>
                      <td className="py-4 px-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
                          <CheckCircle size={12} /> {day.present} Siswa
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right font-black text-purple-600">{day.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dailyRecap.length === 0 && (
                <div className="py-8 text-center text-gray-400 italic">Belum ada data kehadiran bulan ini.</div>
              )}
            </div>
          </div>
          
          {/* Quick Info Alert */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-2xl p-4 flex gap-4">
            <Info className="text-blue-600 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-blue-900 dark:text-blue-100">Tips Wali Kelas</p>
              <p className="text-blue-700 dark:text-blue-400">
                Gunakan menu <b>Rekap Individu</b> jika Anda ingin memantau profil lengkap satu siswa secara mendalam termasuk catatan wali murid.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
