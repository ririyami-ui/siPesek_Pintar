import api from '../lib/axios';
import BSKAP_DATA from './bskap_2025_intel.json';

// --- Analysis Configuration (Sourced from BSKAP_DATA) ---
const { low_grade_threshold: LOW_GRADE_THRESHOLD, high_absence_threshold: HIGH_ABSENCE_THRESHOLD, infraction_score_threshold: INFRACTION_SCORE_THRESHOLD } = BSKAP_DATA.standards.early_warning_standards;

// Convert semester + academic year (e.g. '2025/2026') to a date range.
// Same convention used by the backend (Ganjil: Jul 1 - Dec 31, Genap: Jan 1 - Jun 30).
export const getSemesterRange = (semester, academicYear) => {
  if (!semester) return null;
  const years = String(academicYear || '').split('/');
  const yearStart = parseInt(years[0], 10) || new Date().getFullYear();
  const yearEnd = years.length > 1 ? parseInt(years[1], 10) : yearStart + 1;
  const isGanjil = semester === 'Ganjil';
  return {
    date_start: isGanjil ? `${yearStart}-07-01` : `${yearEnd}-01-01`,
    date_end: isGanjil ? `${yearStart}-12-31` : `${yearEnd}-06-30`,
  };
};

/**
 * Fetches all students for a given user.
 * @param {string} userId - Not used in Laravel API as it's handled by auth middleware
 * @param {string|null} rombel - Optional. The rombel name to filter by.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of student objects.
 */
export const getAllStudents = async (userId = null, rombel = null) => {
  try {
    const res = await api.get('/students', {
      params: { all: true, rombel: rombel }
    });
    const list = res.data.data || res.data || [];
    return (Array.isArray(list) ? list : []).map(s => ({
      ...s,
      rombel: s.class?.rombel ?? s.rombel ?? null,
      classId: s.class_id ?? s.class?.id ?? null,
    }));
  } catch (error) {
    console.error("Error fetching students:", error);
    return [];
  }
};

/**
 * Fetches all grades for a given user, optionally filtered by student or class.
 */
export const getAllGrades = async (userId = null, studentId = null, semester, academicYear, classId = null) => {
  try {
    const res = await api.get('/grades', {
      params: {
        student_id: studentId,
        class_id: classId,
        semester,
        ...(academicYear ? { academic_year: academicYear } : {}),
      }
    });

    const gradeList = res.data.data || res.data || [];
    if (!Array.isArray(gradeList)) return [];

    return gradeList.map(g => ({
      ...g,
      studentId: g.student_id,
      subjectId: g.subject_id,
      assessmentType: g.type,
      subjectName: g.subject?.name
    }));
  } catch (error) {
    console.error("Error fetching grades:", error);
    return [];
  }
};

/**
 * Fetches all attendance records for a given user, optionally filtered by student or class.
 */
export const getAllAttendance = async (userId = null, studentId = null, semester, academicYear, classId = null) => {
  try {
    const params = {};
    if (studentId) params.student_id = studentId;
    if (classId) params.class_id = classId;
    if (semester) params.semester = semester;
    if (academicYear) params.academic_year = academicYear;

    // Backend filters attendance by date range, not by semester column.
    // Convert semester + year to a date range so warnings only count the active period.
    const range = getSemesterRange(semester, academicYear);
    if (range) {
      params.date_start = range.date_start;
      params.date_end = range.date_end;
    }

    const res = await api.get('/attendances', { params });

    const attendanceList = res.data.data || res.data || [];
    if (!Array.isArray(attendanceList)) return [];

    return attendanceList.map(a => ({
      ...a,
      studentId: a.student_id,
      status: a.status ? (a.status.charAt(0).toUpperCase() + a.status.slice(1).replace('zin', 'jin').replace('lpa', 'lpha')) : 'Hadir'
    }));
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
};

/**
 * Fetches all teaching journals for a given user.
 */
export const getAllJournals = async (userId = null, semester, academicYear, classId = null) => {
  try {
    const res = await api.get('/journals', {
      params: {
        semester,
        academic_year: academicYear,
        class_id: classId,
        all: true
      }
    });

    const journalList = res.data.data || res.data || [];
    if (!Array.isArray(journalList)) return [];

    return journalList.map(j => ({
      ...j,
      material: j.topic
    }));
  } catch (error) {
    console.error("Error fetching journals:", error);
    return [];
  }
};

/**
 * Fetches all infraction records for a given user, optionally filtered by student or class.
 */
export const getAllInfractions = async (userId = null, studentId = null, semester, academicYear, classId = null) => {
  try {
    const params = {};
    if (studentId) params.student_id = studentId;
    if (classId) params.class_id = classId;
    if (semester) params.semester = semester;
    if (academicYear) params.academic_year = academicYear;

    const res = await api.get('/infractions', { params });

    const infractionList = res.data.data || res.data || [];
    if (!Array.isArray(infractionList)) return [];

    return infractionList.map(i => ({
      ...i,
      studentId: i.student_id
    }));
  } catch (error) {
    console.error("Error fetching infractions:", error);
    return [];
  }
};


/**
 * Runs the early warning system analysis.
 * This is the main function that will orchestrate the data fetching and analysis.
 */
export const runEarlyWarningAnalysis = async (userId = null, activeSemester, academicYear, modelName, classId = null) => {
  try {
    // 1. Fetch all necessary data in parallel
    const [students, grades, attendance, journals, infractions] = await Promise.all([
      getAllStudents(userId),
      getAllGrades(userId, null, activeSemester, academicYear, classId),
      getAllAttendance(userId, null, activeSemester, academicYear, classId),
      getAllJournals(userId, activeSemester, academicYear, classId),
      getAllInfractions(userId, null, activeSemester, academicYear, classId),
    ]);

    const flaggedStudents = {};

    // Map infractions to students early for easy access
    const studentInfractions = {};
    infractions.forEach(infraction => {
      if (!studentInfractions[infraction.studentId]) {
        studentInfractions[infraction.studentId] = {
          totalPointsDeducted: 0,
          records: []
        };
      }
      studentInfractions[infraction.studentId].totalPointsDeducted += (infraction.points || 0);
      studentInfractions[infraction.studentId].records.push(infraction);
    });

    // Helper to normalize id across sources (localhost serializes int, cPanel may string)
    const normId = (id) => Number(id);

    // Helper to add a warning and associate data with a student
    const addWarning = (studentId, reason, subject = null) => {
      if (!flaggedStudents[studentId]) {
        const studentInfo = students.find(s => normId(s.id) === normId(studentId));
        if (studentInfo) {
          flaggedStudents[studentId] = {
            ...studentInfo,
            warnings: [],
            subjectsWithWarnings: [],
            infractions: studentInfractions[studentId]?.records || [], // Always attach infractions if they exist
            totalPointsDeducted: studentInfractions[studentId]?.totalPointsDeducted || 0,
          };
        }
      }
      if (flaggedStudents[studentId]) {
        if (!flaggedStudents[studentId].warnings.includes(reason)) {
          flaggedStudents[studentId].warnings.push(reason);
        }
        if (subject && !flaggedStudents[studentId].subjectsWithWarnings.some(s => normId(s.id) === normId(subject.id) || s.name === subject.name)) {
          // Store both id and name for better filtering
          flaggedStudents[studentId].subjectsWithWarnings.push(subject);
        }
      }
    };

    // 2. Analyze Grades (Per Subject) with Academic/Attitude Split
    const studentSubjectGrades = {};
    grades.forEach(grade => {
      const key = `${grade.studentId}-${grade.subjectName}`;
      if (!studentSubjectGrades[key]) {
        studentSubjectGrades[key] = {
          studentId: grade.studentId,
          subjectName: grade.subjectName,
          scores: []
        };
      }
      studentSubjectGrades[key].scores.push(parseFloat(grade.score) || 0);
    });

    // Fetch class agreements for weight information
    let classAgreements = {};
    try {
      const allClasses = await getAllStudents();
      // Get unique class IDs from students
      const classIds = [...new Set(allClasses.map(s => s.class_id).filter(Boolean))];
      for (const classId of classIds) {
        try {
          const res = await api.get(`/class-agreements/${classId}`);
          classAgreements[classId] = res.data;
        } catch (e) {
          classAgreements[classId] = { knowledge_weight: 40, practice_weight: 60, academic_weight: 50, attitude_weight: 50 };
        }
      }
    } catch (e) {
      console.warn("Could not fetch class agreements, using defaults", e);
    }

    for (const key in studentSubjectGrades) {
      const item = studentSubjectGrades[key];
      const studentId = item.studentId;
      const subjectName = item.subjectName;

      // Find student's class
      const studentInfo = students.find(s => normId(s.id) === normId(studentId));
      const classId = studentInfo?.class_id;
      const agreement = classAgreements[classId] || {};
      const wa = (agreement.academic_weight ?? 50) / 100;
      const ws = (agreement.attitude_weight ?? 50) / 100;
      const wk = (agreement.knowledge_weight ?? 40) / 100;
      const wp = (agreement.practice_weight ?? 60) / 100;

      // Separate knowledge, practice, and attitude scores
      const subjectGrades = grades.filter(g => normId(g.studentId) === normId(studentId) && g.subjectName === subjectName);
      const knowledgeTypes = ['Harian', 'Formatif', 'Sumatif', 'Ulangan', 'Tengah Semester', 'PTS', 'Akhir Semester', 'PAS'];

      const knowledgeScores = subjectGrades.filter(g => knowledgeTypes.includes(g.assessmentType)).map(g => parseFloat(g.score) || 0);
      const practiceScores = subjectGrades.filter(g => g.assessmentType === 'Praktik').map(g => parseFloat(g.score) || 0);
      const attitudeScores = subjectGrades.filter(g => ['Sikap', 'Afektif', 'Attitude', 'Observasi'].includes(g.assessmentType)).map(g => parseFloat(g.score) || 0);

      const knowledgeAvg = knowledgeScores.length > 0 ? knowledgeScores.reduce((a, b) => a + b, 0) / knowledgeScores.length : 0;
      const practiceAvg = practiceScores.length > 0 ? practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length : 0;
      const attitudeAvg = attitudeScores.length > 0 ? attitudeScores.reduce((a, b) => a + b, 0) / attitudeScores.length : 0;

      // Academic score (knowledge + practice)
      let akademikAvg = 0;
      if (knowledgeAvg > 0 && practiceAvg > 0) {
        akademikAvg = (knowledgeAvg * wk) + (practiceAvg * wp);
      } else if (knowledgeAvg > 0) {
        akademikAvg = knowledgeAvg;
      } else if (practiceAvg > 0) {
        akademikAvg = practiceAvg;
      }

      // Final combined score (academic + attitude)
      let average = 0;
      if (akademikAvg > 0 && attitudeAvg > 0) {
        average = (akademikAvg * wa) + (attitudeAvg * ws);
      } else if (akademikAvg > 0) {
        average = akademikAvg;
      } else if (attitudeAvg > 0) {
        average = attitudeAvg;
      }

      if (average < LOW_GRADE_THRESHOLD && average > 0) {
        const gradeSample = subjectGrades[0];
        addWarning(studentId, `Rata-rata nilai rendah di mapel ${subjectName} (${average.toFixed(1)})`, { id: gradeSample?.subjectId ?? gradeSample?.subject_id ?? '', name: subjectName });
      }
    }

    // 3. Analyze Attendance — includes Alpha, Sakit, Izin
    const studentAbsences = {};
    attendance.forEach(att => {
      if (!studentAbsences[att.studentId]) {
        studentAbsences[att.studentId] = { alpha: 0, sakit: 0, izin: 0 };
      }
      if (att.status === 'Alpha') studentAbsences[att.studentId].alpha++;
      if (att.status === 'Sakit') studentAbsences[att.studentId].sakit++;
      if (att.status === 'Ijin') studentAbsences[att.studentId].izin++;
    });

    for (const studentId in studentAbsences) {
      const a = studentAbsences[studentId];
      const warnings = [];
      if (a.alpha >= HIGH_ABSENCE_THRESHOLD) warnings.push(`${a.alpha}x Alpha`);
      if (a.sakit >= HIGH_ABSENCE_THRESHOLD) warnings.push(`${a.sakit}x Sakit`);
      if (a.izin >= HIGH_ABSENCE_THRESHOLD) warnings.push(`${a.izin}x Izin`);
      if (warnings.length > 0) {
        addWarning(studentId, warnings.join(', '));
      }
    }

    // 4. Analyze Infractions
    for (const studentId in studentInfractions) {
      const infractionData = studentInfractions[studentId];
      const currentScore = 100 - infractionData.totalPointsDeducted;
      if (currentScore < INFRACTION_SCORE_THRESHOLD) {
        addWarning(
          studentId,
          `Skor sikap di bawah standar (${currentScore})`
        );
      }
    }


    // 5. Analyze Journals with AI - DISABLED to save quota
    // if (journals.length > 0 && students.length > 0) {
    //   ...
    // }

    // Sort by severity: more warnings first, then infraction score
    return Object.values(flaggedStudents).sort((a, b) => {
      if (b.warnings.length !== a.warnings.length) return b.warnings.length - a.warnings.length;
      return (b.totalPointsDeducted || 0) - (a.totalPointsDeducted || 0);
    });

  } catch (error) {
    console.error("Error during early warning analysis:", error);
    return [];
  }
};
