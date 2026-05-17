import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Zap, Bot, Sparkles, CheckCircle2, BookOpen, Volume2 } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/id';
import TeachingScheduleCard from '../components/TeachingScheduleCard';
import HolidayWidget from '../components/HolidayWidget';
import { useSettings } from '../utils/SettingsContext';
import JournalReminder from '../components/JournalReminder';
import TaskReminder from '../components/TaskReminder';
import ClockDisplay from '../components/ClockDisplay';
import MaterialCompletionChart from '../components/MaterialCompletionChart';
import AnalyticsOverview from '../components/AnalyticsOverview';
import AttendanceTrendChart from '../components/AttendanceTrendChart';
import GradeDistributionChart from '../components/GradeDistributionChart';
import AdminMonitoringDashboard from '../components/AdminMonitoringDashboard';
import api from '../lib/axios';

export default function DashboardPage() {
  const [teachingSchedules, setTeachingSchedules] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [todayHoliday, setTodayHoliday] = useState(null);
  const [studentStats, setStudentStats] = useState({
    totalStudents: 0,
    maleStudents: 0,
    femaleStudents: 0,
    studentsByRombel: {},
  });
  const [currentTime, setCurrentTime] = useState(moment());
  const [attendanceChartData, setAttendanceChartData] = useState([]);
  const [gradeChartData, setGradeChartData] = useState([]);
  const [topStudents, setTopStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [missingJournalsCount, setMissingJournalsCount] = useState(0);
  const [carryOverMap, setCarryOverMap] = useState({});
  const [journals, setJournals] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState([]);

  const { 
    activeSemester, 
    academicYear, 
    userProfile,
    monitoringData
  } = useSettings();
  const [activeSchedule, setActiveSchedule] = useState(null);

  // Dedicated function for schedule polling (runs every 1 minute)
  const fetchSchedules = React.useCallback(async () => {
    try {
      // Add timestamp to prevent caching
      const schedulesResponse = await api.get(`/schedules?t=${Date.now()}`);
      const fetchedSchedulesBase = schedulesResponse.data.data || schedulesResponse.data || [];
      const fetchedSchedules = fetchedSchedulesBase.map(s => ({
        ...s,
        startTime: s.start_time || s.startTime,
        endTime: s.end_time || s.endTime,
        activityName: s.activity_name || s.activityName,
        subject: s.subject_name || (typeof s.subject === 'object' && s.subject !== null ? s.subject.name : (s.subject || '-')),
        class: s.class_name || (typeof s.class === 'object' && s.class !== null ? s.class.rombel : (s.class || '-')),
      }));
      setTeachingSchedules(fetchedSchedules);

      const today = moment().startOf('day');
      // Force English locale for consistent mapping regardless of global moment locale
      const todayDayName = today.clone().locale('en').format('dddd');
      const dayMap = {
        'Sunday': 'Minggu', 'Monday': 'Senin', 'Tuesday': 'Selasa',
        'Wednesday': 'Rabu', 'Thursday': 'Kamis', 'Friday': 'Jumat', 'Saturday': 'Sabtu',
      };
      const currentDayIndonesian = dayMap[todayDayName];
      const filteredTodaySchedules = fetchedSchedules.filter(
        schedule => schedule.day === currentDayIndonesian
      ).sort((a, b) => {
        const timeA = moment(a.start_time || a.startTime, 'HH:mm');
        const timeB = moment(b.start_time || b.startTime, 'HH:mm');
        return timeA.diff(timeB);
      });
      setTodaySchedules(filteredTodaySchedules);
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  }, []);

  const fetchDashboardData = React.useCallback(async () => {
    try {
      // Fetch Holidays
      const holidaysResponse = await api.get('/holidays');
      const holidays = holidaysResponse.data.data || holidaysResponse.data || [];
      const today = moment().startOf('day');
      const activeHoliday = holidays.find(h => {
        if (h.start_date && h.end_date) {
          const start = moment(h.start_date).startOf('day');
          const end = moment(h.end_date).endOf('day');
          return today.isBetween(start, end, null, '[]');
        }
        return moment(h.date).isSame(today, 'day');
      });
      setTodayHoliday(activeHoliday || null);

      // Fetch Students & Stats
      let students = [];
      const studentsResponse = await api.get('/students');
      const fetchedStudentsRaw = studentsResponse.data.data || studentsResponse.data || [];

      // De-duplicate if needed
      const uniqueStudentsMap = new Map();
      fetchedStudentsRaw.forEach(student => {
        const key = student.id || JSON.stringify(student);
        uniqueStudentsMap.set(key, student);
      });
      students = Array.from(uniqueStudentsMap.values());

      let total = 0, male = 0, female = 0;
      const byRombel = {};

      students.forEach(student => {
        total++;
        const gender = student.gender?.toLowerCase() || '';
        const isMale = gender === 'laki-laki' || gender === 'l' || gender === 'pria';
        const isFemale = gender === 'perempuan' || gender === 'p' || gender === 'wanita';

        if (isMale) male++;
        else if (isFemale) female++;

        const rombel = student.rombel || student.class_name || student.class?.rombel || 'Tanpa Kelas';

        if (!byRombel[rombel]) {
          byRombel[rombel] = { total: 0, male: 0, female: 0, students: [] };
        }
        byRombel[rombel].total++;
        
        // Correct male/female count per rombel
        if (isMale) byRombel[rombel].male++;
        else if (isFemale) byRombel[rombel].female++;
        
        byRombel[rombel].students.push(student);
      });
      setStudentStats({ totalStudents: total, maleStudents: male, femaleStudents: female, studentsByRombel: byRombel });

      // Fetch Top Students (lowest infractions)
      const infractionsResponse = await api.get('/infractions', {
        params: { semester: activeSemester, academic_year: academicYear }
      });
      const infractions = infractionsResponse.data.data || infractionsResponse.data;

      const ranked = students.map(s => {
        const penalty = infractions
          ? infractions.filter(inf => inf.student_id === s.id).reduce((acc, curr) => acc + curr.points, 0)
          : 0;
        return { ...s, score: 100 - penalty };
      }).sort((a, b) => b.score - a.score).slice(0, 3);
      setTopStudents(ranked);

      // Fetch Programs & Classes
      const [programsRes, classesRes] = await Promise.all([
        api.get('/teaching-programs', { params: { semester: activeSemester, academic_year: academicYear } }),
        api.get('/classes')
      ]);
      setPrograms(programsRes.data.data || programsRes.data);
      setClasses(classesRes.data.data || classesRes.data);

      // Fetch Journals
      const journalsResponse = await api.get('/journals', {
        params: { semester: activeSemester, academic_year: academicYear }
      });
      const journalsData = journalsResponse.data.data || journalsResponse.data;
      setJournals(journalsData);

      const missedMap = {};
      journalsData.forEach(j => {
        if (j.is_implemented == 0 || j.is_implemented === false) {
          const key = `${j.class_name || j.className}-${j.subject_name || j.subjectName}`;
          if (!missedMap[key] || moment(j.date).isAfter(missedMap[key].date)) {
            missedMap[key] = {
              material: j.material,
              date: j.date
            };
          }
        }
      });
      setCarryOverMap(missedMap);

      const gradesRes = await api.get('/grades', {
        params: { semester: activeSemester, academic_year: academicYear }
      });
      const gradesData = gradesRes.data.data || gradesRes.data;
      setGrades(gradesData);

      const gradesByDate = {};
      gradesData.forEach(grade => {
        const date = moment(grade.date).format('YYYY-MM-DD');
        const score = parseFloat(grade.score);
        if (!isNaN(score)) {
          if (!gradesByDate[date]) gradesByDate[date] = { total: 0, count: 0 };
          gradesByDate[date].total += score;
          gradesByDate[date].count++;
        }
      });
      const gradeChart = Object.keys(gradesByDate).map(date => ({
        name: moment(date).format('DD MMM'),
        'Rata-rata Nilai': parseFloat((gradesByDate[date].total / gradesByDate[date].count).toFixed(2))
      })).sort((a, b) => new Date(a.name) - new Date(b.name));
      setGradeChartData(gradeChart);

      const attResponse = await api.get('/attendances', {
        params: { semester: activeSemester, academic_year: academicYear }
      });
      const attData = attResponse.data.data || attResponse.data;
      setAttendance(attData);

      const attCounts = { 'hadir': 0, 'sakit': 0, 'izin': 0, 'alpa': 0 };
      attData.forEach(a => {
        const status = a.status?.toLowerCase();
        if (attCounts[status] !== undefined) attCounts[status]++;
      });
      const attChart = [
        { name: 'Hadir', value: attCounts['hadir'] },
        { name: 'Sakit', value: attCounts['sakit'] },
        { name: 'Ijin', value: attCounts['izin'] },
        { name: 'Alpha', value: attCounts['alpa'] }
      ];
      setAttendanceChartData(attChart);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  }, [activeSemester, academicYear]);

  // Poll schedules every 1 minute for real-time status updates
  useEffect(() => {
    fetchSchedules();
    const scheduleInterval = setInterval(fetchSchedules, 60 * 1000);
    return () => clearInterval(scheduleInterval);
  }, [fetchSchedules]);

  // Poll dashboard data every 2 minutes
  useEffect(() => {
    fetchDashboardData();
    const dashboardInterval = setInterval(fetchDashboardData, 2 * 60 * 1000);
    return () => clearInterval(dashboardInterval);
  }, [fetchDashboardData]);

  // Update currentTime every minute and detect active schedule
  useEffect(() => {
    const timer = setInterval(() => {
      const now = moment();
      setCurrentTime(now);

      // Detect active schedule based on backend status for consistency
      const active = todaySchedules.find(s => {
        if (s.type === 'non-teaching') return false;
        
        // If backend provided status, trust it
        if (s.status === 'berlangsung' || s.status === 'menunggu_absen' || s.status === 'alfa' || s.status === 'assignment') {
            const start = moment(s.startTime || s.start_time, 'HH:mm');
            const end = moment(s.endTime || s.end_time, 'HH:mm');
            if (end.isBefore(start)) end.add(1, 'day');
            return now.isBetween(start, end, null, '[]');
        }
        return false;
      });
      setActiveSchedule(active);
    }, 1000);
    return () => clearInterval(timer);
  }, [todaySchedules]);

  const allTodayFinished = todaySchedules.length > 0 && todaySchedules.every(s => {
    if (s.type === 'non-teaching') return true;
    return s.status === 'selesai' || (s.status === 'alfa' && currentTime.isAfter(moment(s.endTime || s.end_time, 'HH:mm')));
  });

  return (
    <div className="space-y-4">
      {/* Welcome Message for Teacher */}
      {userProfile?.role?.toLowerCase() === 'teacher' && (
        <div className="bg-gradient-to-r from-primary/10 to-indigo-500/10 dark:from-primary/20 dark:to-indigo-500/20 p-6 rounded-3xl border border-primary/20 dark:border-primary/40 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
              <Zap size={24} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Dashboard Guru</h1>
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium">Selamat datang kembali, Bapak/Ibu Guru. Mari mulai hari ini dengan semangat!</p>
            </div>
          </div>
        </div>
      )}

      {/* All Schedules Finished Celebration & Reminder */}
      {userProfile?.role?.toLowerCase() === 'teacher' && allTodayFinished && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/20 mb-6 animate-in zoom-in-95 duration-700">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                <CheckCircle2 size={40} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 p-1 rounded-full animate-bounce">
                <Sparkles size={16} />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-black tracking-tighter mb-1 uppercase italic">Hebat! Tugas Mengajar Hari Ini Selesai</h2>
              <p className="text-white/80 font-medium mb-4 italic">Semua sesi kelas Anda telah tuntas. {missingJournalsCount > 0 ? `Ada ${missingJournalsCount} jurnal yang perlu Anda lengkapi.` : 'Administrasi hari ini sangat sempurna!'}</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/jurnal" className="px-6 py-2.5 bg-white text-emerald-600 rounded-2xl font-black text-sm shadow-xl hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                  <BookOpen size={18} />
                  {missingJournalsCount > 0 ? 'Lengkapi Jurnal Sekarang' : 'Cek Jurnal & Riwayat'}
                </Link>
                <div className="px-6 py-2.5 bg-white/10 border border-white/20 rounded-2xl font-bold text-sm backdrop-blur-sm flex items-center justify-center">
                  Total {todaySchedules.length} Sesi Terlaksana
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monitoring for Admin */}
      {userProfile?.role?.toLowerCase() === 'admin' && (
        <div className="mb-8">
          <AdminMonitoringDashboard holiday={todayHoliday} />
        </div>
      )}

      {/* Clock Display - Full width on mobile - Teacher Only */}
      {userProfile?.role?.toLowerCase() === 'teacher' && (
        <div className="block lg:hidden">
          <ClockDisplay showProgress={true} activeSchedule={activeSchedule} />
        </div>
      )}

      {/* Top Section: Clock and Schedule - Desktop only - Teacher Only */}
      {userProfile?.role?.toLowerCase() === 'teacher' && (
        <div className="hidden lg:grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ClockDisplay showProgress={true} activeSchedule={activeSchedule} />
          </div>
          <div className="lg:col-span-2">
            <TeachingScheduleCard
              schedules={todaySchedules}
              currentTime={currentTime}
              holiday={todayHoliday}
              programs={programs}
              classes={classes}
              carryOverMap={carryOverMap}
              activeSemester={activeSemester}
              academicYear={academicYear}
              userProfile={userProfile}
            />
          </div>
        </div>
      )}

      {/* Schedule Card - Mobile only - Teacher Only */}
      {userProfile?.role?.toLowerCase() === 'teacher' && (
        <div className="block lg:hidden">
          <TeachingScheduleCard
            schedules={todaySchedules}
            currentTime={currentTime}
            holiday={todayHoliday}
            programs={programs}
            classes={classes}
            carryOverMap={carryOverMap}
            activeSemester={activeSemester}
            academicYear={academicYear}
            userProfile={userProfile}
          />
        </div>
      )}

      {/* Reminders Section */}
      <TaskReminder
        activeSemester={activeSemester}
        academicYear={academicYear}
      />

      {userProfile?.role?.toLowerCase() !== 'admin' && (
        <JournalReminder
          activeSemester={activeSemester}
          academicYear={academicYear}
          onUpdateMissingCount={setMissingJournalsCount}
        />
      )}

      {/* Middle Section: Holiday Widget & Student Recap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Holiday Widget (1/3) */}
        <div className="lg:col-span-1 h-full">
          <HolidayWidget />
        </div>

        {/* Student Recap Section (2/3) */}
        <div className="lg:col-span-2 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-gray-800/40 p-6 rounded-3xl shadow-lg">
          <h2 className="text-2xl font-black mb-6 tracking-tight flex items-center gap-3">
            <Users size={24} className="text-primary" />
            <span className="bg-gradient-to-r from-blue-900 to-indigo-900 dark:from-blue-100 dark:to-indigo-200 bg-clip-text text-transparent">Rekap Siswa</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-2xl border border-green-200/50 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/20 text-green-800 dark:text-green-200 flex flex-col items-center justify-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">Total Siswa</p>
              <p className="text-4xl font-black">{studentStats.totalStudents}</p>
            </div>
            <div className="p-4 rounded-2xl border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 flex flex-col items-center justify-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">Laki-laki</p>
              <p className="text-4xl font-black">{studentStats.maleStudents}</p>
            </div>
            <div className="p-4 rounded-2xl border border-pink-200/50 dark:border-pink-800/50 bg-pink-50/50 dark:bg-pink-900/20 text-pink-800 dark:text-pink-200 flex flex-col items-center justify-center shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest opacity-70">Perempuan</p>
              <p className="text-4xl font-black">{studentStats.femaleStudents}</p>
            </div>
          </div>

          {/* Full Width Gender Ratio Bar for School */}
          <div className="mb-8 px-1">
             <div className="flex justify-between items-end mb-2 px-1">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none mb-1">Rasio Keseluruhan</span>
                   <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      <span className="text-xs font-black text-blue-700 dark:text-blue-300">L: {Math.round((studentStats.maleStudents / studentStats.totalStudents) * 100)}%</span>
                   </div>
                </div>
                <div className="flex items-center gap-1.5">
                   <span className="text-xs font-black text-pink-700 dark:text-pink-300">P: {Math.round((studentStats.femaleStudents / studentStats.totalStudents) * 100)}%</span>
                   <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                </div>
             </div>
             <div className="w-full h-3 bg-gray-100 dark:bg-gray-800/50 rounded-full overflow-hidden flex shadow-inner border border-gray-200 dark:border-gray-800">
                <div 
                   className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000" 
                   style={{ width: `${(studentStats.maleStudents / studentStats.totalStudents) * 100}%` }}
                />
                <div 
                   className="h-full bg-gradient-to-r from-pink-400 to-pink-600 shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all duration-1000" 
                   style={{ width: `${(studentStats.femaleStudents / studentStats.totalStudents) * 100}%` }}
                />
             </div>
          </div>

          {Object.keys(studentStats.studentsByRombel).length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-3 flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <span>Siswa per Rombel:</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* Adjusted grid layout for 2/3 width */}
                {Object.entries(studentStats.studentsByRombel).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([rombel, data]) => {
                  const classInfo = classes.find(c => c.rombel === rombel);
                  const waliName = classInfo?.wali?.name || 'Wali Belum Diatur';

                  return (
                  <Link to={`/analisis-rombel/${rombel}`} key={rombel} className="block p-4 rounded-[1.5rem] border border-blue-200/30 dark:border-blue-800/30 bg-white/40 dark:bg-black/40 backdrop-blur-sm text-blue-800 dark:text-blue-200 flex items-center space-x-4 hover:bg-blue-500 hover:text-white transition-all duration-500 group shadow-sm hover:shadow-blue-500/20 md:hover:scale-[1.03]">
                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900 group-hover:bg-white/20 transition-colors">
                      <Users size={20} className="flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-md font-black tracking-tight leading-none mb-1">{rombel}</p>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-white/80 transition-colors truncate mb-1.5">
                         {waliName}
                      </p>
                      <p className="text-[10px] font-bold uppercase opacity-60">Siswa: {data.total}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1 bg-blue-500/10 dark:bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/20">
                          <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase">L:</span>
                          <span className="text-[10px] font-black text-blue-700 dark:text-blue-300">{data.male}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-pink-500/10 dark:bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/20">
                          <span className="text-[8px] font-black text-pink-600 dark:text-pink-400 uppercase">P:</span>
                          <span className="text-[10px] font-black text-pink-700 dark:text-pink-300">{data.female}</span>
                        </div>
                      </div>
                    </div>
                    {/* Mini Gender Chart */}
                    <div className="w-24 flex flex-col gap-1 items-end ml-2">
                       <div className="flex justify-between w-full text-[8px] font-black tracking-tighter mb-0.5">
                          <span className="text-blue-600 dark:text-blue-400">{Math.round((data.male / data.total) * 100)}%</span>
                          <span className="text-pink-600 dark:text-pink-400">{Math.round((data.female / data.total) * 100)}%</span>
                       </div>
                       <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex shadow-inner border border-gray-300/20">
                          <div 
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                            style={{ width: `${(data.male / data.total) * 100}%` }}
                          />
                          <div 
                            className="h-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]" 
                            style={{ width: `${(data.female / data.total) * 100}%` }}
                          />
                       </div>
                       <span className="text-[7px] font-black opacity-40 uppercase tracking-widest">Rasio Gender</span>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Analytics Overview Section */}
      <AnalyticsOverview />

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttendanceTrendChart data={attendanceChartData} externalData={attendance} />
        <GradeDistributionChart data={gradeChartData} externalData={grades} />
      </div>

      {/* Bottom Section: Material Completion */}
      <div className="grid grid-cols-1 gap-6">
        <MaterialCompletionChart externalData={journals} />
      </div>
    </div>
  );
};