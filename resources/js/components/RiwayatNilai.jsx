import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import moment from 'moment';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';
import GradeDetailsModal from './GradeDetailsModal';
import { useSettings } from '../utils/SettingsContext';

// Komponen baru ini menerima daftar kelas dan mapel sebagai props
const RiwayatNilai = ({ classes, subjects }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [riwayatData, setRiwayatData] = useState([]);
  const [isFetching, setIsFetching] = useState(false);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { activeSemester, academicYear } = useSettings();

  const handleShowHistory = async () => {
    if (!startDate || !endDate || !selectedClass || !selectedSubject) {
      alert('Silakan pilih rentang tanggal, kelas, dan mata pelajaran.');
      return;
    }
    setIsFetching(true);
    try {
      // 1. Fetch Students to check completion status
      const studentsResponse = await api.get('/students', {
        params: { class_id: selectedClass, all: true }
      });
      const allStudentsInClass = studentsResponse.data.data || studentsResponse.data;

      // 2. Fetch Grades
      const gradesResponse = await api.get('/grades', {
        params: {
          class_id: selectedClass,
          subject_id: selectedSubject,
          date_start: startDate,
          date_end: endDate,
          semester: activeSemester,
          academic_year: academicYear
        }
      });

      const submittedGrades = gradesResponse.data;

      const gradesBySession = submittedGrades.reduce((acc, grade) => {
        const key = `${grade.date}-${grade.type}-${grade.topic}`;
        if (!acc[key]) {
          acc[key] = {
            date: grade.date,
            assessmentType: grade.type,
            material: grade.topic,
            grades: []
          };
        }
        acc[key].grades.push(grade);
        return acc;
      }, {});

      const sessionList = Object.values(gradesBySession).map(session => {
        let allGradesSubmitted = true;
        allStudentsInClass.forEach(student => {
          const studentGrade = session.grades.find(grade => grade.student_id === student.id);
          if (!studentGrade || parseFloat(studentGrade.score) === 0) {
            allGradesSubmitted = false;
          }
        });

        const status = allGradesSubmitted ? 'Semua nilai terinput' : 'Sebagian nilai kosong';

        return {
          date: session.date,
          assessmentType: session.assessmentType,
          material: session.material,
          status,
          details: `${session.assessmentType} - ${session.material}`
        };
      });

      setRiwayatData(sessionList.sort((a, b) => new Date(b.date) - new Date(a.date))); // Sort descending
    } catch (error) {
      console.error("Error fetching grade history: ", error);
      alert("Gagal memuat riwayat nilai.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleShowDetails = (item) => {
    setSelectedDate(item.date);
    setSelectedAssessmentType(item.assessmentType);
    setSelectedMaterial(item.material);
    setShowDetailsModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await api.delete('/grades/batch', {
        data: {
          class_id: selectedClass,
          subject_id: selectedSubject,
          date: itemToDelete.date,
          type: itemToDelete.assessmentType,
          topic: itemToDelete.material
        }
      });

      toast.success("Data nilai berhasil dihapus.");
      handleShowHistory(); // Refresh list
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("Gagal menghapus data.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const riwayatNilaiColumns = [
    { header: { label: 'Tanggal' }, accessor: 'date' },
    { header: { label: 'Status' }, accessor: 'status' },
    { header: { label: 'Keterangan' }, accessor: 'details' },
    { header: { label: 'Aksi' }, accessor: 'actions' },
  ];


  const handleQuickFilter = (range) => {
    let start, end;
    const today = moment();

    switch (range) {
      case 'today':
        start = today.format('YYYY-MM-DD');
        end = today.format('YYYY-MM-DD');
        break;
      case 'week':
        start = today.clone().startOf('week').format('YYYY-MM-DD');
        end = today.clone().endOf('week').format('YYYY-MM-DD');
        break;
      case 'month':
        start = today.clone().startOf('month').format('YYYY-MM-DD');
        end = today.clone().endOf('month').format('YYYY-MM-DD');
        break;
      case 'semester':
        // Rough estimate for semester: 6 months back from today or based on current month
        const currentMonth = today.month();
        if (currentMonth >= 6) { // July onwards (Sem 1)
          start = today.clone().month(6).startOf('month').format('YYYY-MM-DD'); // July 1st
          end = today.clone().month(11).endOf('month').format('YYYY-MM-DD'); // Dec 31st
        } else { // Jan - June (Sem 2)
          start = today.clone().month(0).startOf('month').format('YYYY-MM-DD'); // Jan 1st
          end = today.clone().month(5).endOf('month').format('YYYY-MM-DD'); // June 30th
        }
        break;
      default:
        return;
    }
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <StyledButton onClick={() => handleQuickFilter('today')} variant="outline" size="sm">Hari Ini</StyledButton>
          <StyledButton onClick={() => handleQuickFilter('week')} variant="outline" size="sm">Minggu Ini</StyledButton>
          <StyledButton onClick={() => handleQuickFilter('month')} variant="outline" size="sm">Bulan Ini</StyledButton>
          <StyledButton onClick={() => handleQuickFilter('semester')} variant="outline" size="sm">Semester Ini</StyledButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm">
          <StyledInput type="date" label="Tanggal Mulai" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <StyledInput type="date" label="Tanggal Akhir" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <StyledSelect label="Kelas" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">Pilih Kelas</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
          </StyledSelect>
          <StyledSelect label="Mata Pelajaran" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
            <option value="">Pilih Mata Pelajaran</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </StyledSelect>
          <StyledButton onClick={handleShowHistory} disabled={isFetching}>
            {isFetching ? 'Mencari...' : 'Tampilkan Riwayat'}
          </StyledButton>
        </div>

        {riwayatData.length > 0 && (
          <div className="p-4 bg-white dark:bg-surface-dark rounded-xl shadow-sm">
            <div className="overflow-x-auto mt-4">
              <StyledTable headers={riwayatNilaiColumns.map(c => c.header)}>
                {riwayatData.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-700'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{moment(row.date).format('DD MMMM YYYY')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.status.includes('Semua') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-800 dark:text-gray-200">{row.details}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <StyledButton onClick={() => handleShowDetails(row)} size="sm">Detail</StyledButton>
                        <StyledButton onClick={() => handleDeleteClick(row)} variant="danger" size="sm" className="bg-red-100 text-red-600 hover:bg-red-200 border-red-200">
                          <Trash2 size={16} />
                        </StyledButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </StyledTable>
            </div>
          </div>
        )}
      </div>

      {showDetailsModal && (
        <GradeDetailsModal
          date={selectedDate}
          assessmentType={selectedAssessmentType}
          material={selectedMaterial}
          selectedClass={selectedClass}
          selectedSubject={selectedSubject}
          onClose={() => setShowDetailsModal(false)}
          classes={classes}
          subjects={subjects}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Hapus Data Nilai?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Anda akan menghapus nilai untuk materi <br />
                  <span className="font-bold text-gray-700 dark:text-gray-300">"{itemToDelete?.material}"</span>.
                </p>
                <p className="text-xs text-red-500 mt-2 font-medium">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-200 dark:shadow-none flex justify-center items-center gap-2"
                >
                  {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RiwayatNilai;
