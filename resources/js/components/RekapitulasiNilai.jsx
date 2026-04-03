import React, { useState } from 'react';
import api from '../lib/axios';
import moment from 'moment';

import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';

const RekapitulasiNilai = ({ classes, subjects }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [summaryData, setSummaryData] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  const handleShowSummary = async () => {
    if (!startDate || !endDate || !selectedClass || !selectedSubject) {
      alert('Silakan pilih rentang tanggal, kelas, dan mata pelajaran.');
      return;
    }
    setIsFetching(true);
    try {
      const classObj = classes.find(c => c.rombel === selectedClass);
      const subjectObj = subjects.find(s => s.name === selectedSubject);

      const [studentsRes, gradesRes] = await Promise.all([
        api.get('/students', { params: { rombel: selectedClass } }),
        api.get('/grades', {
          params: {
            class_id: classObj?.id,
            subject_id: subjectObj?.id,
            date_start: startDate,
            date_end: endDate
          }
        })
      ]);

      const allStudentsInClass = studentsRes.data;
      const submittedGrades = gradesRes.data;

      const studentScores = {};
      allStudentsInClass.forEach(student => {
        studentScores[student.id] = {
          name: student.name,
          scores: [],
          lowScores: 0,
        };
      });

      submittedGrades.forEach(grade => {
        const studentId = grade.student_id;
        if (studentScores[studentId]) {
          const score = parseFloat(grade.score);
          studentScores[studentId].scores.push(score);
          if (score < 70) { // Anggap KKM 70
            studentScores[studentId].lowScores++;
          }
        }
      });

      const summary = Object.values(studentScores).map(student => {
        const totalScore = student.scores.reduce((acc, score) => acc + score, 0);
        const averageScore = student.scores.length > 0 ? (totalScore / student.scores.length).toFixed(2) : 'N/A';
        return {
          name: student.name,
          average: averageScore,
          lowScoreCount: student.lowScores,
          testCount: student.scores.length,
        };
      });
      setSummaryData(summary);
    } catch (error) {
      console.error("Error fetching grade summary: ", error);
      alert("Gagal memuat rekapitulasi nilai.");
    } finally {
      setIsFetching(false);
    }
  };

  const summaryColumns = [
    { header: { label: 'Nama Siswa' } },
    { header: { label: 'Rata-rata Nilai' } },
    { header: { label: 'Jumlah Nilai di Bawah KKM' } },
    { header: { label: 'Jumlah Penilaian' } },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm">
        <StyledInput type="date" label="Tanggal Mulai" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <StyledInput type="date" label="Tanggal Akhir" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <StyledSelect label="Kelas" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">Pilih Kelas</option>
          {classes.map(c => <option key={c.id} value={c.rombel}>{c.rombel}</option>)}
        </StyledSelect>
        <StyledSelect label="Mata Pelajaran" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
          <option value="">Pilih Mata Pelajaran</option>
          {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </StyledSelect>
        <StyledButton onClick={handleShowSummary} disabled={isFetching}>
          {isFetching ? 'Mencari...' : 'Tampilkan Rekapitulasi'}
        </StyledButton>
      </div>

      {summaryData.length > 0 && (
        <div className="p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm">
          <div className="overflow-x-auto mt-4">
            <StyledTable headers={summaryColumns.map(c => c.header)}>
              {summaryData.map((student, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-700'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{student.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{student.average}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{student.lowScoreCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{student.testCount}</td>
                </tr>
              ))}
            </StyledTable>
          </div>
        </div>
      )}
    </div>
  );
};

export default RekapitulasiNilai;
