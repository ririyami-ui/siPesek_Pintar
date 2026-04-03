import api from '../lib/axios';
import BSKAP_DATA from './bskap_2025_intel.json';

// --- Analysis Configuration (Sourced from BSKAP_DATA) ---
const { low_grade_threshold: LOW_GRADE_THRESHOLD, high_absence_threshold: HIGH_ABSENCE_THRESHOLD, infraction_score_threshold: INFRACTION_SCORE_THRESHOLD } = BSKAP_DATA.standards.early_warning_standards;

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
    return res.data.data || res.data || [];
  } catch (error) {
    console.error("Error fetching students:", error);
    return [];
  }
};

/**
 * Fetches all grades for a given user, optionally filtered by student.
 */
export const getAllGrades = async (userId = null, studentId = null, semester, academicYear) => {
  try {
    const res = await api.get('/grades', {
      params: {
        student_id: studentId,
        semester,
        academic_year: academicYear
      }
    });

    const gradeList = res.data.data || res.data || [];
    if (!Array.isArray(gradeList)) return [];

    return gradeList.map(g => ({
      ...g,
      studentId: g.student_id,
      assessmentType: g.type,
      subjectName: g.subject?.name
    }));
  } catch (error) {
    console.error("Error fetching grades:", error);
    return [];
  }
};

/**
 * Fetches all attendance records for a given user, optionally filtered by student.
 */
export const getAllAttendance = async (userId = null, studentId = null, semester, academicYear) => {
  try {
    const res = await api.get('/attendances', {
      params: {
        student_id: studentId,
        semester,
        academic_year: academicYear
      }
    });

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
export const getAllJournals = async (userId = null, semester, academicYear) => {
  try {
    const res = await api.get('/journals', {
      params: {
        semester,
        academic_year: academicYear,
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
 * Fetches all infraction records for a given user, optionally filtered by student.
 */
export const getAllInfractions = async (userId = null, studentId = null, semester, academicYear) => {
  try {
    const res = await api.get('/infractions', {
      params: {
        student_id: studentId,
        semester,
        academic_year: academicYear
      }
    });

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
export const runEarlyWarningAnalysis = async (userId = null, activeSemester, academicYear, modelName) => {
  try {
    // 1. Fetch all necessary data in parallel
    const [students, grades, attendance, journals, infractions] = await Promise.all([
      getAllStudents(userId),
      getAllGrades(userId, null, activeSemester, academicYear),
      getAllAttendance(userId, null, activeSemester, academicYear),
      getAllJournals(userId, activeSemester, academicYear),
      getAllInfractions(userId, null, activeSemester, academicYear),
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

    // Helper to add a warning and associate data with a student
    const addWarning = (studentId, reason, subject = null) => {
      if (!flaggedStudents[studentId]) {
        const studentInfo = students.find(s => s.id === studentId);
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
        if (subject && !flaggedStudents[studentId].subjectsWithWarnings.some(s => s.id === subject.id || s.name === subject.name)) {
          // Store both id and name for better filtering
          flaggedStudents[studentId].subjectsWithWarnings.push(subject);
        }
      }
    };

    // 2. Analyze Grades (Per Subject)
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

    for (const key in studentSubjectGrades) {
      const item = studentSubjectGrades[key];
      const studentId = item.studentId;
      const subjectName = item.subjectName;

      // Separate knowledge and practice scores for this subject
      const subjectGrades = grades.filter(g => g.studentId === studentId && g.subjectName === subjectName);
      const knowledgeTypes = ['Harian', 'Formatif', 'Sumatif', 'Ulangan', 'Tengah Semester', 'PTS', 'Akhir Semester', 'PAS'];

      const knowledgeScores = subjectGrades.filter(g => knowledgeTypes.includes(g.assessmentType)).map(g => parseFloat(g.score) || 0);
      const practiceScores = subjectGrades.filter(g => g.assessmentType === 'Praktik').map(g => parseFloat(g.score) || 0);

      const knowledgeAvg = knowledgeScores.length > 0 ? knowledgeScores.reduce((a, b) => a + b, 0) / knowledgeScores.length : 0;
      const practiceAvg = practiceScores.length > 0 ? practiceScores.reduce((a, b) => a + b, 0) / practiceScores.length : 0;

      let average = 0;
      if (knowledgeAvg > 0 && practiceAvg > 0) {
        average = (knowledgeAvg * 0.4) + (practiceAvg * 0.6);
      } else if (knowledgeAvg > 0) {
        average = knowledgeAvg;
      } else if (practiceAvg > 0) {
        average = practiceAvg;
      }

      if (average < LOW_GRADE_THRESHOLD && average > 0) {
        const gradeSample = subjectGrades[0];
        addWarning(studentId, `Rata-rata nilai rendah di mapel ${subjectName} (${average.toFixed(1)})`, { id: gradeSample?.subjectId || '', name: subjectName });
      }
    }

    // 3. Analyze Attendance
    const studentAbsences = {};
    attendance.forEach(att => {
      if (att.status === 'Alpha') {
        if (!studentAbsences[att.studentId]) {
          studentAbsences[att.studentId] = 0;
        }
        studentAbsences[att.studentId]++;
      }
    });

    for (const studentId in studentAbsences) {
      const alphaCount = studentAbsences[studentId];
      if (alphaCount >= HIGH_ABSENCE_THRESHOLD) {
        addWarning(studentId, `${alphaCount} kali absen tanpa keterangan (Alpha)`);
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

    return Object.values(flaggedStudents);

  } catch (error) {
    console.error("Error during early warning analysis:", error);
    return [];
  }
};
