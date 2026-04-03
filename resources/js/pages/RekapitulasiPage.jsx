import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Calendar, BookOpen, Award, AlertTriangle, Users, TrendingUp, FileDown, CheckCircle, XCircle, MapPin, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import StyledInput from '../components/StyledInput';
import StyledSelect from '../components/StyledSelect';
import StyledButton from '../components/StyledButton';
import StyledTable from '../components/StyledTable';
import PieChart from '../components/PieChart';
import SummaryCard from '../components/SummaryCard';
import BarChart from '../components/BarChart';
import EmptyState from '../components/EmptyState';
import QuickDateFilter from '../components/QuickDateFilter';
import LoadingSpinner from '../components/LoadingSpinner';
import { generateAttendanceRecapPDF, generateDetailedAttendanceRecapPDF, generateJurnalRecapPDF, generateNilaiRecapPDF, generateViolationRecapPDF } from '../utils/pdfGenerator';
import { getAllGrades, getAllAttendance, getAllInfractions } from '../utils/analysis';

const RekapitulasiPage = () => {
  const [activeTab, setActiveTab] = useState('kehadiran');
  const [dailyTab, setDailyTab] = useState('rangkuman'); // 'rangkuman' or 'harian'

  // General State
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [teacherName, setTeacherName] = useState('');

  // Loading States
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isLoadingJurnal, setIsLoadingJurnal] = useState(false);
  const [isLoadingNilai, setIsLoadingNilai] = useState(false);
  const [isLoadingViolation, setIsLoadingViolation] = useState(false);

  // Kehadiran State
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceDates, setAttendanceDates] = useState([]); // New state for detailed report
  const [chartData, setChartData] = useState({ Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0 });
  const [numDays, setNumDays] = useState(0);
  const [dailyAttendanceData, setDailyAttendanceData] = useState([]);

  // Jurnal State
  const [jurnalStartDate, setJurnalStartDate] = useState('');
  const [jurnalEndDate, setJurnalEndDate] = useState('');
  const [selectedJurnalClass, setSelectedJurnalClass] = useState('');
  const [selectedJurnalSubject, setSelectedJurnalSubject] = useState('');
  const [jurnalData, setJurnalData] = useState([]);
  const [jurnalSearchTerm, setJurnalSearchTerm] = useState('');

  // Nilai State
  const [nilaiStartDate, setNilaiStartDate] = useState('');
  const [nilaiEndDate, setNilaiEndDate] = useState('');
  const [selectedNilaiClass, setSelectedNilaiClass] = useState('');
  const [selectedNilaiSubject, setSelectedNilaiSubject] = useState('');
  const [nilaiData, setNilaiData] = useState([]);

  // Pelanggaran State
  const [violationStartDate, setViolationStartDate] = useState('');
  const [violationEndDate, setViolationEndDate] = useState('');
  const [selectedViolationClass, setSelectedViolationClass] = useState('');
  const [violationData, setViolationData] = useState([]);

  // Signing Location State
  const [signingLocation, setSigningLocation] = useState('Jakarta');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);



  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [profileRes, classesRes, subjectsRes] = await Promise.all([
          api.get('/profile'),
          api.get('/classes?all=true'),
          api.get('/subjects')
        ]);

        const { profile, user } = profileRes.data;
        setUserProfile({ ...user, ...profile });
        setSchoolName(profile.school_name || '');
        setTeacherName(user.name || '');

        // Try to set signing location from profile heuristic if not in localStorage
        const savedLoc = localStorage.getItem('QUIZ_SIGNING_LOCATION');
        if (savedLoc) {
          setSigningLocation(savedLoc);
        } else if (profile.school_name) {
          const school = profile.school_name;
          const parts = school.trim().split(' ');
          const last = parts[parts.length - 1];
          if (last.length > 2 && isNaN(last)) {
            setSigningLocation(last);
            localStorage.setItem('QUIZ_SIGNING_LOCATION', last);
          }
        }

        const classData = classesRes.data.data || classesRes.data || [];
        const fetchedClasses = [...classData].sort((a, b) => (a.rombel || '').localeCompare(b.rombel || ''));
        setClasses(fetchedClasses);

        const subjectData = subjectsRes.data.data || subjectsRes.data || [];
        const fetchedSubjects = [...subjectData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    fetchInitialData();
  }, []);

  const handleDetectLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung geolokasi.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();

          const city = data.address.city || data.address.town || data.address.regency || data.address.county || 'Jakarta';
          const cleanCity = city.replace(/^(Kabupaten|Kota|Kab\.|Kota\s)\s+/i, '');
          setSigningLocation(cleanCity);
          localStorage.setItem('QUIZ_SIGNING_LOCATION', cleanCity);
          toast.success(`Lokasi terdeteksi: ${cleanCity}`);
        } catch (error) {
          console.error("Error detecting location:", error);
          toast.error("Gagal mendeteksi nama kota.");
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Gagal mendapatkan lokasi.");
        setIsDetectingLocation(false);
      }
    );
  };

  useEffect(() => {
    const fetchStudents = async () => {
      const classToFetchId = selectedClass || selectedViolationClass;
      if (classToFetchId) {
        try {
          const res = await api.get('/students', {
            params: { class_id: classToFetchId }
          });
          const studentData = res.data.data || res.data || [];
          setStudents([...studentData].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (error) {
          console.error("Error fetching students:", error);
        }
      } else {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selectedClass, selectedViolationClass, classes]);

  const handleApplyFilter = async () => {
    if (!startDate || !endDate || !selectedClass) {
      alert('Silakan pilih rentang tanggal dan kelas.');
      return;
    }
    setIsLoadingAttendance(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      setNumDays(dayDiff);

      const response = await api.get('/attendance', {
        params: {
          class_id: selectedClass,
          date_start: startDate,
          date_end: endDate
        }
      });

      let attendanceList = response.data.data || response.data || [];
      if (!Array.isArray(attendanceList)) {
        attendanceList = [];
      }
      
      const rawDocs = attendanceList.map(item => ({
        ...item,
        studentId: item.student_id,
        status: (item.status || '').charAt(0).toUpperCase() + (item.status || '').slice(1) // Map 'hadir' to 'Hadir'
      }));

      let summary = {};
      students.forEach(student => {
        summary[student.id] = { absen: student.absen, nis: student.nis, name: student.name, Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0 };
      });

      rawDocs.forEach(record => {
        if (summary[record.studentId] && record.status) {
          const statusMap = { 'Hadir': 'Hadir', 'Sakit': 'Sakit', 'Izin': 'Ijin', 'Alpa': 'Alpha' };
          const mappedStatus = statusMap[record.status] || record.status;
          if (summary[record.studentId][mappedStatus] !== undefined) {
            summary[record.studentId][mappedStatus]++;
          }
          // Store daily status for detailed report
          summary[record.studentId][record.date] = mappedStatus;
        }
      });

      // Calculate unique active school days from data
      const uniqueDates = Array.from(new Set(rawDocs.map(doc => doc.date))).sort();
      const realSchoolDays = uniqueDates.length > 0 ? uniqueDates.length : dayDiff;
      setNumDays(realSchoolDays);
      setAttendanceDates(uniqueDates); // Save dates for PDF export

      const tableData = Object.values(summary);
      setAttendanceData(tableData);
      const totalSummary = tableData.reduce((acc, curr) => {
        acc.Hadir += curr.Hadir;
        acc.Sakit += curr.Sakit;
        acc.Ijin += curr.Ijin;
        acc.Alpha += curr.Alpha;
        return acc;
      }, { Hadir: 0, Sakit: 0, Ijin: 0, Alpha: 0 });
      setChartData({
        ...totalSummary,
        schoolDays: realSchoolDays,
        studentCount: students.length
      });

      // Process daily attendance data
      const dailyDataMap = {};
      rawDocs.forEach(record => {
        if (!dailyDataMap[record.date]) {
          dailyDataMap[record.date] = {
            date: record.date,
            hadir: 0,
            sakit: 0,
            ijin: 0,
            alpha: 0,
            total: 0,
            students: []
          };
        }

        const student = students.find(s => s.id === record.studentId);
        if (student) {
          dailyDataMap[record.date].total++;
          const statusMap = { 'Hadir': 'hadir', 'Sakit': 'sakit', 'Izin': 'ijin', 'Alpa': 'alpha' };
          const s = statusMap[record.status] || record.status.toLowerCase();
          if (dailyDataMap[record.date][s] !== undefined) dailyDataMap[record.date][s]++;

          dailyDataMap[record.date].students.push({
            name: student.name,
            absen: student.absen,
            status: record.status === 'Izin' ? 'Ijin' : (record.status === 'Alpa' ? 'Alpha' : record.status)
          });
        }
      });

      // Convert to array and sort by date (newest first)
      const dailyDataArray = Object.values(dailyDataMap).sort((a, b) => new Date(b.date) - new Date(a.date));

      // Sort students by absen number within each day
      dailyDataArray.forEach(day => {
        day.students.sort((a, b) => (a.absen || 0) - (b.absen || 0));
      });

      setDailyAttendanceData(dailyDataArray);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      alert("Gagal mengambil data kehadiran.");
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const handleKehadiranPDFExport = () => {
    if (attendanceData.length === 0) {
      alert('Tidak ada data kehadiran untuk diekspor ke PDF.');
      return;
    }
    const pdfData = attendanceData.map(item => ({
      absen: item.absen ? String(item.absen) : '',
      nis: item.nis || '',
      namaSiswa: item.name || '',
      gender: item.gender || '',
      hadir: item.Hadir || 0,
      sakit: item.Sakit || 0,
      ijin: item.Ijin || 0,
      alpa: item.Alpha || 0,
    }));
    const classObj = classes.find(c => c.id === selectedClass);
    // Use the new Detailed Generator
    generateDetailedAttendanceRecapPDF(attendanceData, attendanceDates, schoolName, startDate, endDate, teacherName, classObj?.rombel || selectedClass, userProfile);
  };

  const handleKehadiranExcelExport = () => {
    if (attendanceData.length === 0) {
      alert('Tidak ada data kehadiran untuk diekspor ke Excel.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(attendanceData.map(item => ({
      'No. Absen': item.absen || '',
      'NIS': item.nis || '',
      'Nama Siswa': item.name || '',
      'Hadir': item.Hadir || 0,
      'Sakit': item.Sakit || 0,
      'Ijin': item.Ijin || 0,
      'Alpha': item.Alpha || 0,
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kehadiran');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const classObj = classes.find(c => c.id === selectedClass);
    saveAs(data, `Rekapitulasi_Kehadiran_${classObj?.rombel || selectedClass}_${startDate}_${endDate}.xlsx`);
  };

  const handleShowJurnal = async () => {
    if (!jurnalStartDate || !jurnalEndDate) {
      alert('Silakan pilih rentang tanggal.');
      return;
    }
    setIsLoadingJurnal(true);
    try {
      const response = await api.get('/teaching-journals', {
        params: {
          date_start: jurnalStartDate,
          date_end: jurnalEndDate,
          all: true
        }
      });
      let journalList = response.data.data || response.data || [];
      if (!Array.isArray(journalList)) journalList = [];
      const fetchedJournals = journalList.map(item => ({
        ...item,
        className: item.class?.rombel || '',
        subjectName: item.subject?.name || '',
        material: item.topic || '',
        learningObjectives: item.notes || '', // Map notes to objectives if needed, or check model
        learningActivities: '', // These fields might be missing in new model
        reflection: '',
        isImplemented: true,
        followUp: ''
      })).sort((a, b) => new Date(b.date) - new Date(a.date));
      setJurnalData(fetchedJournals);
    } catch (error) {
      console.error("Error fetching journals:", error);
      alert("Gagal mengambil data jurnal.");
    } finally {
      setIsLoadingJurnal(false);
    }
  };

  const handleJurnalExport = () => {
    if (jurnalData.length === 0) {
      alert('Tidak ada data jurnal untuk diekspor ke PDF.');
      return;
    }
    generateJurnalRecapPDF(jurnalData, jurnalStartDate, jurnalEndDate, teacherName, userProfile);
  };

  const handleJurnalExcelExport = () => {
    if (jurnalData.length === 0) {
      alert('Tidak ada data jurnal untuk diekspor ke Excel.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(jurnalData.map(item => ({
      'Tanggal': item.date || '',
      'Kelas': item.className || '',
      'Mata Pelajaran': item.subjectName || '',
      'Materi': item.material || '',
      'Tujuan Pembelajaran': item.learningObjectives || '',
      'Kegiatan Pembelajaran': item.learningActivities || '',
      'Refleksi': item.reflection || '',
      'Keterlaksanaan': item.isImplemented !== false ? 'Terlaksana' : 'Tidak Terlaksana',
      'Tindak Lanjut': item.followUp || '',
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Jurnal');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `Rekapitulasi_Jurnal_${jurnalStartDate}_${jurnalEndDate}.xlsx`);
  };

  const handleApplyNilaiFilter = async () => {
    if (!nilaiStartDate || !nilaiEndDate || !selectedNilaiClass || !selectedNilaiSubject) {
      alert('Silakan pilih rentang tanggal, kelas, dan mata pelajaran.');
      return;
    }
    setIsLoadingNilai(true);
    try {
      const [studentsRes, gradesRes, agreementRes] = await Promise.all([
        api.get('/students', { params: { class_id: selectedNilaiClass } }),
        api.get('/grades', {
          params: {
            class_id: selectedNilaiClass,
            subject_id: selectedNilaiSubject,
            date_start: nilaiStartDate,
            date_end: nilaiEndDate
          }
        }),
        api.get(`/class-agreements/${selectedNilaiClass}`).catch(() => ({ data: { knowledge_weight: 40, practice_weight: 60 } }))
      ]);

      const fetchedStudents = studentsRes.data.data || studentsRes.data || [];
      let gradeList = gradesRes.data.data || gradesRes.data || [];
      if (!Array.isArray(gradeList)) gradeList = [];
      const rawGrades = gradeList.map(g => ({
        ...g,
        studentId: g.student_id,
        assessmentType: g.type
      }));

      const recapitulation = {};
      fetchedStudents.forEach(student => {
        recapitulation[student.id] = {
          absen: student.absen,
          nis: student.nis,
          name: student.name,
          NH: [],
          Formatif: [],
          Sumatif: [],
          Ulangan: [],
          PTS: [],
          PAS: [],
          Praktik: [],
        };
      });

      rawGrades.forEach(grade => {
        if (recapitulation[grade.studentId]) {
          const score = parseFloat(grade.score);
          if (!isNaN(score)) {
            const type = grade.assessmentType;
            if (['Harian', 'Tugas', 'Kuis', 'Pengetahuan', 'Homework'].includes(type)) recapitulation[grade.studentId].NH.push(score);
            else if (type === 'Formatif') recapitulation[grade.studentId].Formatif.push(score);
            else if (type === 'Sumatif') recapitulation[grade.studentId].Sumatif.push(score);
            else if (type === 'Ulangan') recapitulation[grade.studentId].Ulangan.push(score);
            else if (type === 'Tengah Semester' || type === 'PTS') recapitulation[grade.studentId].PTS.push(score);
            else if (type === 'Akhir Semester' || type === 'PAS') recapitulation[grade.studentId].PAS.push(score);
            else if (['Praktik', 'Proyek', 'Produk', 'Portofolio', 'Keterampilan', 'Unjuk Kerja', 'Praktikum', 'Project', 'Skill'].includes(type)) recapitulation[grade.studentId].Praktik.push(score);
          }
        }
      });

      const knowledgeW = (agreementRes.data.knowledge_weight ?? 40) / 100;
      const practiceW = (agreementRes.data.practice_weight ?? 60) / 100;

      const finalNilaiData = Object.values(recapitulation).map(studentData => {
        const pengetahuanScores = [
          ...studentData.NH,
          ...studentData.Formatif,
          ...studentData.Sumatif,
          ...studentData.Ulangan,
          ...studentData.PTS,
          ...studentData.PAS
        ];

        const NH_avg = studentData.NH.length > 0 ? studentData.NH.reduce((a, b) => a + b, 0) / studentData.NH.length : 0;
        const Formatif_avg = studentData.Formatif.length > 0 ? studentData.Formatif.reduce((a, b) => a + b, 0) / studentData.Formatif.length : 0;
        const Sumatif_avg = studentData.Sumatif.length > 0 ? studentData.Sumatif.reduce((a, b) => a + b, 0) / studentData.Sumatif.length : 0;
        const Praktik_avg = studentData.Praktik.length > 0 ? studentData.Praktik.reduce((a, b) => a + b, 0) / studentData.Praktik.length : 0;

        const Pengetahuan_avg = pengetahuanScores.length > 0 ? pengetahuanScores.reduce((a, b) => a + b, 0) / pengetahuanScores.length : 0;

        let NA = 0;
        if (Pengetahuan_avg > 0 && Praktik_avg > 0) {
          NA = (Pengetahuan_avg * knowledgeW) + (Praktik_avg * practiceW);
        } else if (Pengetahuan_avg > 0) {
          NA = Pengetahuan_avg;
        } else if (Praktik_avg > 0) {
          NA = Praktik_avg;
        }

        return {
          absen: studentData.absen,
          nis: studentData.nis,
          name: studentData.name,
          NH_avg: NH_avg.toFixed(2),
          Formatif_avg: Formatif_avg.toFixed(2),
          Sumatif_avg: Sumatif_avg.toFixed(2),
          Praktik_avg: Praktik_avg.toFixed(2),
          NA: NA.toFixed(2),
          knowledgeW: (knowledgeW * 100).toFixed(0),
          practiceW: (practiceW * 100).toFixed(0)
        };
      }).sort((a, b) => a.absen - b.absen);
      setNilaiData(finalNilaiData);
    } catch (error) {
      console.error("Error fetching grades:", error);
      alert("Gagal mengambil data nilai.");
    } finally {
      setIsLoadingNilai(false);
    }
  };

  const handleNilaiPDFExport = () => {
    if (nilaiData.length === 0) {
      alert('Tidak ada data nilai untuk diekspor ke PDF.');
      return;
    }
    const classObj = classes.find(c => c.id === selectedNilaiClass);
    const subjectObj = subjects.find(s => s.id === selectedNilaiSubject);
    generateNilaiRecapPDF(nilaiData, schoolName, nilaiStartDate, nilaiEndDate, teacherName, classObj?.rombel || selectedNilaiClass, subjectObj?.name || selectedNilaiSubject, userProfile);
  };

  const handleNilaiExcelExport = () => {
    if (nilaiData.length === 0) {
      alert('Tidak ada data nilai untuk diekspor ke Excel.');
      return;
    }
    const classObj = classes.find(c => c.id === selectedNilaiClass);
    const subjectObj = subjects.find(s => s.id === selectedNilaiSubject);
    const worksheet = XLSX.utils.json_to_sheet(nilaiData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nilai');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `Rekapitulasi_Nilai_${classObj?.rombel || selectedNilaiClass}_${subjectObj?.name || selectedNilaiSubject}_${nilaiStartDate}_${nilaiEndDate}.xlsx`);
  };

  const calculateNilaiSikap = (currentScore) => {
    if (currentScore > 90) return 'Sangat Baik';
    else if (currentScore >= 75) return 'Baik';
    else if (currentScore >= 60) return 'Cukup';
    else return 'Kurang';
  };

  const generateDeskripsi = (studentName, studentViolations, currentScore, nilaiSikap) => {
    if (studentViolations.length === 0) {
      return `Tidak ada catatan pelanggaran. Nilai Sikap: ${nilaiSikap} (Skor: ${currentScore})`;
    }

    const groupedViolations = studentViolations.reduce((acc, v) => {
      if (!acc[v.infractionType]) {
        acc[v.infractionType] = { count: 0, totalPoints: 0 };
      }
      acc[v.infractionType].count++;
      acc[v.infractionType].totalPoints += v.points;
      return acc;
    }, {});

    const violationDetails = Object.entries(groupedViolations).map(([type, data]) => {
      return `- ${type} (${data.count} kali, ${data.totalPoints} poin)`;
    }).join('\n');

    return `Memiliki catatan pelanggaran:\n${violationDetails}\nNilai Sikap: ${nilaiSikap} (Skor: ${currentScore})`;
  };

  const handleApplyViolationFilter = async () => {
    if (!violationStartDate || !violationEndDate || !selectedViolationClass) {
      alert('Silakan pilih rentang tanggal dan kelas.');
      return;
    }
    setIsLoadingViolation(true);
    try {
      const [studentsRes, violationsRes] = await Promise.all([
        api.get('/students', { params: { class_id: selectedViolationClass } }),
        api.get('/infractions', {
          params: {
            class_id: selectedViolationClass,
            date_start: violationStartDate,
            date_end: violationEndDate
          }
        })
      ]);

      const fetchedStudents = studentsRes.data.data || studentsRes.data || [];
      let violationList = violationsRes.data.data || violationsRes.data || [];
      if (!Array.isArray(violationList)) violationList = [];
      const rawViolations = violationList.map(v => ({
        ...v,
        studentId: v.student_id,
        infractionType: v.category || 'Lainnya'
      }));

      const studentViolationSummary = {};
      fetchedStudents.forEach(student => {
        studentViolationSummary[student.id] = {
          absen: student.absen,
          nis: student.nis,
          name: student.name,
          gender: student.gender,
          violationCount: 0,
          totalPointsDeducted: 0,
          violationsDetail: [],
          nilaiSikap: '',
          deskripsi: '',
        };
      });

      rawViolations.forEach(violation => {
        if (studentViolationSummary[violation.studentId]) {
          studentViolationSummary[violation.studentId].violationCount++;
          studentViolationSummary[violation.studentId].totalPointsDeducted += violation.points;
          studentViolationSummary[violation.studentId].violationsDetail.push(violation);
        }
      });

      const finalViolationData = Object.values(studentViolationSummary).map(studentData => {
        const currentScore = 100 - studentData.totalPointsDeducted;
        const nilaiSikap = calculateNilaiSikap(currentScore);
        const deskripsi = generateDeskripsi(studentData.name, studentData.violationsDetail, currentScore, nilaiSikap);
        return {
          ...studentData,
          nilaiSikap,
          deskripsi,
        };
      }).sort((a, b) => a.absen - b.absen);

      setViolationData(finalViolationData);
    } catch (error) {
      console.error("Error fetching violations:", error);
      alert("Gagal mengambil data pelanggaran.");
    } finally {
      setIsLoadingViolation(false);
    }
  };

  const handleViolationPDFExport = () => {
    if (violationData.length === 0) {
      alert('Tidak ada data pelanggaran untuk diekspor ke PDF.');
      return;
    }
    const classObj = classes.find(c => c.id === selectedViolationClass);
    generateViolationRecapPDF(violationData, schoolName, violationStartDate, violationEndDate, teacherName, classObj?.rombel || selectedViolationClass, userProfile);
  };

  const handleViolationExcelExport = () => {
    if (violationData.length === 0) {
      alert('Tidak ada data pelanggaran untuk diekspor ke Excel.');
      return;
    }
    const classObj = classes.find(c => c.id === selectedViolationClass);
    const worksheet = XLSX.utils.json_to_sheet(violationData.map(item => ({
      'No. Absen': item.absen || '',
      'NIS': item.nis || '',
      'Nama Siswa': item.name || '',
      'Jenis Kelamin': item.gender || '',
      'Total Poin Pelanggaran': item.totalPointsDeducted || 0,
      'Nilai Sikap': item.nilaiSikap || '',
      'Deskripsi': item.deskripsi || '',
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pelanggaran');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `Rekapitulasi_Pelanggaran_${classObj?.rombel || selectedViolationClass}_${violationStartDate}_${violationEndDate}.xlsx`);
  };



  const renderTabButton = (tabName, tabLabel, icon) => {
    const isActive = activeTab === tabName;
    return (
      <button
        className={`flex items-center gap-2 flex-shrink-0 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-300 ease-in-out focus:outline-none ${isActive ? 'bg-white dark:bg-surface-dark text-primary shadow-sm' : 'text-text-muted-light dark:text-text-muted-dark hover:bg-white/60 dark:hover:bg-surface-dark/60'}`}
        onClick={() => setActiveTab(tabName)}
      >
        {icon}
        {tabLabel}
      </button>
    );
  };

  const kehadiranColumns = [
    { header: { label: 'Nama Siswa' }, accessor: 'name' },
    { header: { label: 'Hadir' }, accessor: 'Hadir' },
    { header: { label: 'Sakit' }, accessor: 'Sakit' },
    { header: { label: 'Ijin' }, accessor: 'Ijin' },
    { header: { label: 'Alpha' }, accessor: 'Alpha' },
  ];

  const jurnalColumns = [
    { header: { label: 'Tanggal' }, accessor: 'date' },
    { header: { label: 'Kelas' }, accessor: 'className' },
    { header: { label: 'Mata Pelajaran' }, accessor: 'subjectName' },
    { header: { label: 'Materi' }, accessor: 'material' },
    { header: { label: 'Tujuan Pembelajaran' }, accessor: 'learningObjectives' },
    { header: { label: 'Kegiatan Pembelajaran' }, accessor: 'learningActivities' },
    { header: { label: 'Refleksi' }, accessor: 'reflection' },
    { header: { label: 'Hambatan' }, accessor: 'challenges' },
    { header: { label: 'Tindak Lanjut' }, accessor: 'followUp' },
  ];

  const nilaiColumns = [
    { header: { label: 'No. Absen' }, accessor: 'absen' },
    { header: { label: 'NIS' }, accessor: 'nis' },
    { header: { label: 'Nama Siswa' }, accessor: 'name' },
    { header: { label: 'Rata-rata NH' }, accessor: 'NH_avg' },
    { header: { label: 'Formatif' }, accessor: 'Formatif_avg' },
    { header: { label: 'Sumatif' }, accessor: 'Sumatif_avg' },
    {
      header: {
        label: nilaiData.length > 0 && nilaiData[0].practiceW
          ? `Praktik (${nilaiData[0].practiceW}%)`
          : 'Praktik'
      },
      accessor: 'Praktik_avg'
    },
    { header: { label: 'Nilai Akhir (NA)' }, accessor: 'NA' },
  ];

  const pelanggaranColumns = [
    { header: { label: 'No. Absen' }, accessor: 'absen' },
    { header: { label: 'NIS' }, accessor: 'nis' },
    { header: { label: 'Nama Siswa' }, accessor: 'name' },
    { header: { label: 'Jenis Kelamin' }, accessor: 'gender' },
    { header: { label: 'Total Poin Pelanggaran' }, accessor: 'totalPointsDeducted' },
    { header: { label: 'Nilai Sikap' }, accessor: 'nilaiSikap' },
    { header: { label: 'Deskripsi' }, accessor: 'deskripsi' },
  ];

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-primary" />
              Rekapitulasi
            </h1>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-surface-dark px-3 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 w-fit">
              <MapPin size={14} className="text-primary" />
              <span className="opacity-60 uppercase tracking-tighter">Lokasi TTD:</span>
              <input
                type="text"
                className="bg-transparent focus:outline-none min-w-[100px] text-gray-900 dark:text-gray-100"
                value={signingLocation}
                onChange={(e) => {
                  setSigningLocation(e.target.value);
                  localStorage.setItem('QUIZ_SIGNING_LOCATION', e.target.value);
                }}
                placeholder="Pilih Kota..."
              />
              <button
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="hover:text-primary transition-colors disabled:opacity-50"
                title="Deteksi Lokasi GPS"
              >
                {isDetectingLocation ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            </div>
          </div>

          <div className="flex bg-white dark:bg-surface-dark p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-x-auto no-scrollbar">
            {renderTabButton('kehadiran', 'Kehadiran', <Users className="w-4 h-4" />)}
            {renderTabButton('jurnal', 'Jurnal', <BookOpen className="w-4 h-4" />)}
            {renderTabButton('nilai', 'Nilai', <Award className="w-4 h-4" />)}
            {renderTabButton('pelanggaran', 'Pelanggaran', <AlertTriangle className="w-4 h-4" />)}
          </div>
        </header>

        <main>
          {/* Tab Kehadiran */}
          {activeTab === 'kehadiran' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                  <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pilih Kelas</label>
                      <StyledSelect value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
                      </StyledSelect>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rentang Tanggal</label>
                      <div className="flex items-center gap-2">
                        <StyledInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <span className="text-gray-400">-</span>
                        <StyledInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-4 flex gap-2">
                    <StyledButton onClick={handleApplyFilter} className="flex-1">
                      Terapkan Filter
                    </StyledButton>
                    {attendanceData.length > 0 && (
                      <div className="flex gap-2">
                        <StyledButton onClick={handleKehadiranPDFExport} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30">
                          <FileDown className="w-5 h-5" />
                        </StyledButton>
                        <StyledButton onClick={handleKehadiranExcelExport} className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-900/30">
                          <FileDown className="w-5 h-5" />
                        </StyledButton>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <QuickDateFilter onSelect={(start, end) => { setStartDate(start); setEndDate(end); }} />
                </div>
              </div>

              {isLoadingAttendance ? (
                <div className="py-20"><LoadingSpinner label="Memuat data kehadiran..." /></div>
              ) : attendanceData.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard title="Hadir" value={chartData.Hadir} icon={<CheckCircle className="w-8 h-8 text-green-500" />} color="green" />
                    <SummaryCard title="Sakit" value={chartData.Sakit} icon={<TrendingUp className="w-8 h-8 text-blue-500" />} color="blue" />
                    <SummaryCard title="Ijin" value={chartData.Ijin} icon={<Calendar className="w-8 h-8 text-yellow-500" />} color="yellow" />
                    <SummaryCard title="Alpha" value={chartData.Alpha} icon={<AlertTriangle className="w-8 h-8 text-red-500" />} color="red" />
                  </div>

                  {/* Sub-tabs untuk Rangkuman dan Harian */}
                  <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit mb-4">
                    <button
                      className={`py-2 px-4 rounded-md font-medium text-sm transition ${dailyTab === 'rangkuman'
                        ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      onClick={() => setDailyTab('rangkuman')}
                    >
                      Rangkuman
                    </button>
                    <button
                      className={`py-2 px-4 rounded-md font-medium text-sm transition ${dailyTab === 'harian'
                        ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      onClick={() => setDailyTab('harian')}
                    >
                      Rekap Harian
                    </button>
                  </div>

                  {dailyTab === 'rangkuman' ? (
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rangkuman Kehadiran per Siswa</h3>
                        <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">Total {numDays} Hari</span>
                      </div>
                      <div className="overflow-x-auto">
                        <StyledTable headers={kehadiranColumns.map(c => c.header)}>
                          {attendanceData.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              {kehadiranColumns.map(col => (
                                <td key={col.accessor} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800">
                                  {col.accessor === 'name' ? (
                                    <div className="font-semibold text-gray-900 dark:text-white">{row[col.accessor]}</div>
                                  ) : (
                                    <span className={row[col.accessor] > 0 ? (col.accessor === 'Hadir' ? 'text-green-600 font-bold' : 'text-red-500 font-medium') : ''}>
                                      {row[col.accessor]}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </StyledTable>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                      <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rekap Kehadiran per Tanggal</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Melihat kehadiran siswa setiap hari pada periode yang dipilih</p>
                      </div>
                      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        {dailyAttendanceData.length > 0 ? (
                          <div className="p-6 space-y-4">
                            {dailyAttendanceData.map((dayData, index) => (
                              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between">
                                  <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white">{dayData.date}</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Total: {dayData.total} siswa
                                    </p>
                                  </div>
                                  <div className="flex gap-4 text-sm">
                                    <span className="text-green-600 font-semibold">✓ {dayData.hadir}</span>
                                    <span className="text-blue-600">S {dayData.sakit}</span>
                                    <span className="text-yellow-600">I {dayData.ijin}</span>
                                    <span className="text-red-600">A {dayData.alpha}</span>
                                  </div>
                                </div>
                                <div className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {dayData.students.map((student, idx) => (
                                      <div
                                        key={idx}
                                        className={`p-3 rounded-lg border text-sm ${student.status === 'Hadir'
                                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                          : student.status === 'Sakit'
                                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                                            : student.status === 'Ijin'
                                              ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                          }`}
                                      >
                                        <div className="font-semibold text-gray-900 dark:text-white truncate">{student.name}</div>
                                        <div className="flex items-center justify-between mt-1">
                                          <span className="text-xs text-gray-600 dark:text-gray-400">Absen {student.absen}</span>
                                          <span
                                            className={`text-xs font-bold ${student.status === 'Hadir'
                                              ? 'text-green-600'
                                              : student.status === 'Sakit'
                                                ? 'text-blue-600'
                                                : student.status === 'Ijin'
                                                  ? 'text-yellow-600'
                                                  : 'text-red-600'
                                              }`}
                                          >
                                            {student.status}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                            Tidak ada data kehadiran harian.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState title="Belum ada data kehadiran" description="Silakan pilih kelas dan rentang tanggal lalu klik Terapkan Filter." icon={<Users className="w-16 h-16 text-gray-300" />} />
              )}
            </div>
          )}

          {/* Tab Jurnal */}
          {activeTab === 'jurnal' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                  {/* Rentang Tanggal */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rentang Tanggal</label>
                    <div className="grid grid-cols-2 gap-2">
                      <StyledInput type="date" value={jurnalStartDate} onChange={(e) => setJurnalStartDate(e.target.value)} className="w-full" />
                      <StyledInput type="date" value={jurnalEndDate} onChange={(e) => setJurnalEndDate(e.target.value)} className="w-full" />
                    </div>
                  </div>

                  {/* Mata Pelajaran */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mata Pelajaran</label>
                    <StyledSelect value={selectedJurnalSubject} onChange={(e) => setSelectedJurnalSubject(e.target.value)} className="w-full">
                      <option value="">-- Semua Mapel --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </StyledSelect>
                  </div>

                  {/* Kelas */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kelas</label>
                    <StyledSelect value={selectedJurnalClass} onChange={(e) => setSelectedJurnalClass(e.target.value)} className="w-full">
                      <option value="">-- Semua Kelas --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
                    </StyledSelect>
                  </div>

                  {/* Cari Materi */}
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cari Materi</label>
                    <StyledInput placeholder="Kata kunci..." value={jurnalSearchTerm} onChange={(e) => setJurnalSearchTerm(e.target.value)} className="w-full" />
                  </div>
                </div>

                {/* Buttons Row and Filters */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-between border-t border-gray-100 dark:border-gray-800 pt-4 items-center">
                  <div className="w-full sm:w-auto">
                    <QuickDateFilter onSelect={(start, end) => { setJurnalStartDate(start); setJurnalEndDate(end); }} />
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <StyledButton onClick={handleShowJurnal} className="px-6">
                      Tampilkan Data
                    </StyledButton>
                    {jurnalData.length > 0 && (
                      <>
                        <StyledButton onClick={handleJurnalExport} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 gap-2 px-3">
                          <FileDown className="w-4 h-4" /> PDF
                        </StyledButton>
                        <StyledButton onClick={handleJurnalExcelExport} className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 gap-2 px-3">
                          <FileDown className="w-4 h-4" /> Excel
                        </StyledButton>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {isLoadingJurnal ? (
                <div className="py-20"><LoadingSpinner label="Memuat jurnal mengajar..." /></div>
              ) : jurnalData.length > 0 ? (
                <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Daftar Jurnal Mengajar</h3>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <StyledTable headers={jurnalColumns.map(c => c.header)}>
                      {jurnalData
                        .filter(item => {
                          const searchTermMatch = !jurnalSearchTerm ||
                            item.material?.toLowerCase().includes(jurnalSearchTerm.toLowerCase()) ||
                            item.className?.toLowerCase().includes(jurnalSearchTerm.toLowerCase()) ||
                            item.subjectName?.toLowerCase().includes(jurnalSearchTerm.toLowerCase());

                          const classObj = classes.find(c => c.id === selectedJurnalClass);
                          const classMatch = !selectedJurnalClass || item.classId === selectedJurnalClass || item.className === classObj?.rombel;

                          const subjectObj = subjects.find(s => s.id === selectedJurnalSubject);
                          const subjectMatch = !selectedJurnalSubject || item.subjectId === selectedJurnalSubject || item.subjectName === subjectObj?.name;

                          return searchTermMatch && classMatch && subjectMatch;
                        })
                        .map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            {jurnalColumns.map(col => (
                              <td key={col.accessor} className="px-6 py-4 whitespace-normal text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800 min-w-[200px]">
                                {col.accessor === 'date' ? (
                                  <div className="font-medium whitespace-nowrap">{row[col.accessor]}</div>
                                ) : col.accessor === 'isImplemented' ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.isImplemented !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {row.isImplemented !== false ? 'Terlaksana' : 'Tidak Terlaksana'}
                                  </span>
                                ) : (
                                  row[col.accessor] || '-'
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </StyledTable>
                  </div>
                </div>
              ) : (
                <EmptyState title="Jurnal tidak ditemukan" description="Pilih rentang tanggal untuk melihat catatan jurnal mengajar Anda." icon={<BookOpen className="w-16 h-16 text-gray-300" />} />
              )}
            </div>
          )}

          {/* Tab Nilai */}
          {activeTab === 'nilai' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mata Pelajaran</label>
                    <StyledSelect value={selectedNilaiSubject} onChange={(e) => setSelectedNilaiSubject(e.target.value)}>
                      <option value="">-- Pilih Mapel --</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </StyledSelect>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kelas</label>
                    <StyledSelect value={selectedNilaiClass} onChange={(e) => setSelectedNilaiClass(e.target.value)}>
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
                    </StyledSelect>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mulai</label>
                    <StyledInput type="date" value={nilaiStartDate} onChange={(e) => setNilaiStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Akhir</label>
                    <StyledInput type="date" value={nilaiEndDate} onChange={(e) => setNilaiEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <StyledButton onClick={handleApplyNilaiFilter} className="flex-1">
                    Terapkan Filter
                  </StyledButton>
                  {nilaiData.length > 0 && (
                    <div className="flex gap-2">
                      <StyledButton onClick={handleNilaiPDFExport} className="bg-red-50 text-red-600 hover:bg-red-100">
                        <FileDown className="w-5 h-5" />
                      </StyledButton>
                      <StyledButton onClick={handleNilaiExcelExport} className="bg-green-50 text-green-600 hover:bg-green-100">
                        <FileDown className="w-5 h-5" />
                      </StyledButton>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <QuickDateFilter onSelect={(start, end) => { setNilaiStartDate(start); setNilaiEndDate(end); }} />
                </div>
              </div>

              {isLoadingNilai ? (
                <div className="py-20"><LoadingSpinner label="Memproses data nilai..." /></div>
              ) : nilaiData.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard
                      title="Rata-rata Kelas"
                      value={Math.round(nilaiData.reduce((acc, curr) => acc + parseFloat(curr.NA), 0) / nilaiData.length)}
                      icon={<Award className="w-8 h-8 text-primary" />}
                      color="primary"
                    />
                    <SummaryCard
                      title="Nilai Tertinggi"
                      value={Math.max(...nilaiData.map(d => parseFloat(d.NA)))}
                      icon={<TrendingUp className="w-8 h-8 text-green-500" />}
                      color="green"
                    />
                    <SummaryCard
                      title="Nilai Terendah"
                      value={Math.min(...nilaiData.map(d => parseFloat(d.NA)))}
                      icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
                      color="red"
                    />
                    <SummaryCard
                      title="Kelulusan"
                      value={`${Math.round((nilaiData.filter(d => parseFloat(d.NA) >= 75).length / nilaiData.length) * 100)}%`}
                      icon={<CheckCircle className="w-8 h-8 text-blue-500" />}
                      color="blue"
                    />
                  </div>

                  <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rekapitulasi Nilai Peserta Didik</h3>
                      <div className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {subjects.find(s => s.id === selectedNilaiSubject)?.name || selectedNilaiSubject}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <StyledTable headers={nilaiColumns.map(c => c.header)}>
                        {nilaiData.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            {nilaiColumns.map(col => (
                              <td key={col.accessor} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800">
                                {col.accessor === 'name' ? (
                                  <div className="font-semibold text-gray-900 dark:text-white">{row[col.accessor]}</div>
                                ) : col.accessor === 'NA' ? (
                                  <span className={`font-bold ${parseFloat(row[col.accessor]) >= 75 ? 'text-green-600' : 'text-red-500'}`}>
                                    {row[col.accessor]}
                                  </span>
                                ) : (
                                  row[col.accessor]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </StyledTable>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState title="Data nilai tidak tersedia" description="Pilih mata pelajaran, kelas, dan periode penilaian untuk melihat rekapitulasi." icon={<Award className="w-16 h-16 text-gray-300" />} />
              )}
            </div>
          )}

          {/* Tab Pelanggaran */}
          {activeTab === 'pelanggaran' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pilih Kelas</label>
                    <StyledSelect value={selectedViolationClass} onChange={(e) => setSelectedViolationClass(e.target.value)}>
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
                    </StyledSelect>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rentang Tanggal</label>
                    <div className="flex items-center gap-2">
                      <StyledInput type="date" value={violationStartDate} onChange={(e) => setViolationStartDate(e.target.value)} />
                      <span className="text-gray-400">-</span>
                      <StyledInput type="date" value={violationEndDate} onChange={(e) => setViolationEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <StyledButton onClick={handleApplyViolationFilter} className="flex-1">
                      Filter
                    </StyledButton>
                    {violationData.length > 0 && (
                      <div className="flex gap-2">
                        <StyledButton onClick={handleViolationPDFExport} className="bg-red-50 text-red-600 hover:bg-red-100">
                          <FileDown className="w-5 h-5" />
                        </StyledButton>
                        <StyledButton onClick={handleViolationExcelExport} className="bg-green-50 text-green-600 hover:bg-green-100">
                          <FileDown className="w-5 h-5" />
                        </StyledButton>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <QuickDateFilter onSelect={(start, end) => { setViolationStartDate(start); setViolationEndDate(end); }} />
                </div>
              </div>

              {isLoadingViolation ? (
                <div className="py-20"><LoadingSpinner label="Menganalisis data kedisiplinan..." /></div>
              ) : violationData.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <SummaryCard
                      title="Total Pelanggaran"
                      value={violationData.reduce((acc, curr) => acc + curr.violationCount, 0)}
                      icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
                      color="red"
                    />
                    <SummaryCard
                      title="Siswa Terlibat"
                      value={violationData.filter(v => v.violationCount > 0).length}
                      icon={<Users className="w-8 h-8 text-orange-500" />}
                      color="orange"
                    />
                    <SummaryCard
                      title="Rata-rata Poin"
                      value={Math.round(violationData.reduce((acc, curr) => acc + curr.totalPointsDeducted, 0) / violationData.length)}
                      icon={<TrendingUp className="w-8 h-8 text-yellow-500" />}
                      color="yellow"
                    />
                  </div>

                  <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Analisis Statistik Pelanggaran</h3>
                    <div className="h-[300px]">
                      <BarChart
                        data={violationData
                          .filter(v => v.violationCount > 0)
                          .map(v => ({ label: v.name, value: v.violationCount }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 10)
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detail Kedisiplinan Siswa</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <StyledTable headers={pelanggaranColumns.map(c => c.header)}>
                        {violationData.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            {pelanggaranColumns.map(col => (
                              <td key={col.accessor} className="px-6 py-4 whitespace-normal text-sm text-gray-600 dark:text-gray-300 border-b border-gray-50 dark:border-gray-800 min-w-[150px]">
                                {col.accessor === 'name' ? (
                                  <div className="font-semibold text-gray-900 dark:text-white">{row[col.accessor]}</div>
                                ) : col.accessor === 'totalPointsDeducted' ? (
                                  <span className={`font-bold ${row[col.accessor] > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    -{row[col.accessor]}
                                  </span>
                                ) : col.accessor === 'nilaiSikap' ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.nilaiSikap === 'Sangat Baik' ? 'bg-green-100 text-green-700' :
                                    row.nilaiSikap === 'Baik' ? 'bg-blue-100 text-blue-700' :
                                      row.nilaiSikap === 'Cukup' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {row.nilaiSikap}
                                  </span>
                                ) : (
                                  row[col.accessor]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </StyledTable>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState title="Data kedisiplinan kosong" description="Silakan pilih kelas dan periode untuk memantau kedisiplinan siswa." icon={<AlertTriangle className="w-16 h-16 text-gray-300" />} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default RekapitulasiPage;
