import api from '../lib/axios';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';
import StyledInput from './StyledInput';
import { useSettings } from '../utils/SettingsContext';
import toast from 'react-hot-toast';
import moment from 'moment';

const GradeDetailsModal = ({ date, assessmentType, material, selectedClass, selectedSubject, onClose, classes, subjects }) => {
  const [studentGrades, setStudentGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gradeStatus, setGradeStatus] = useState('');
  const { activeSemester, academicYear } = useSettings();

  useEffect(() => {
    const fetchGradeDetails = async () => {
      setLoading(true);
      try {
        const [studentsRes, gradesRes] = await Promise.all([
          api.get('/students', { params: { class_id: selectedClass, all: true } }),
          api.get('/grades', {
            params: {
              date,
              class_id: selectedClass,
              subject_id: selectedSubject,
              type: assessmentType,
              topic: material,
              semester: activeSemester,
              academic_year: academicYear
            }
          })
        ]);

        const fetchedStudents = studentsRes.data;
        const fetchedGrades = gradesRes.data;

        const gradesMap = new Map();
        fetchedGrades.forEach(grade => {
          gradesMap.set(grade.student_id, { score: grade.score, id: grade.id });
        });

        const combinedData = fetchedStudents.map(student => {
          const gradeData = gradesMap.get(student.id);
          return {
            id: student.id,
            name: student.name,
            nis: student.nis,
            gradeId: gradeData ? gradeData.id : null,
            score: gradeData ? gradeData.score : '',
            originalScore: gradeData ? gradeData.score : '',
          };
        });

        setStudentGrades(combinedData);

        const filledCount = combinedData.filter(s => s.score !== '' && s.score !== null).length;
        setGradeStatus(filledCount === combinedData.length ? 'Nilai terinput semua' : `Terisi ${filledCount} dari ${combinedData.length} siswa`);

      } catch (error) {
        console.error('Error fetching grade details:', error);
        toast.error("Gagal memuat detail nilai.");
      } finally {
        setLoading(false);
      }
    };

    if (date && selectedClass && selectedSubject) {
      fetchGradeDetails();
    }
  }, [date, assessmentType, material, selectedClass, selectedSubject, activeSemester, academicYear]);

  const handleScoreChange = (studentId, newScore) => {
    setStudentGrades(prev => prev.map(s =>
      s.id === studentId ? { ...s, score: newScore } : s
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = studentGrades.filter(s => s.score !== s.originalScore);

      if (changes.length === 0) {
        toast('Tidak ada perubahan nilai untuk disimpan.', { icon: 'ℹ️' });
        setSaving(false);
        return;
      }

      const payload = {
        class_id: selectedClass,
        subject_id: selectedSubject,
        date: date,
        type: assessmentType,
        topic: material,
        semester: activeSemester,
        academic_year: academicYear,
        grades: studentGrades.filter(s => s.score !== '').map(s => ({
          student_id: s.id,
          score: parseFloat(s.score) || 0
        }))
      };

      await api.post('/grades/batch', payload);
      toast.success("Perubahan nilai berhasil disimpan!");
      onClose();

    } catch (error) {
      console.error("Error saving grades:", error);
      toast.error("Gagal menyimpan perubahan nilai.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { header: { label: 'NIS' }, accessor: 'nis' },
    { header: { label: 'Nama Siswa' }, accessor: 'name' },
    { header: { label: 'Nilai' }, accessor: 'score' },
  ];

  if (!date || !selectedClass || !selectedSubject) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all scale-100">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📝 Edit Nilai
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {assessmentType} • {material} • {moment(date).format('DD MMMM YYYY')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30">
          <span className="font-medium">Status: {gradeStatus}</span>
          <span className="text-xs opacity-75">Kelas: {classes.find(c => c.id === selectedClass)?.rombel || selectedClass} • Total: {studentGrades.length} Siswa</span>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p>Memuat data nilai...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-0">
            <div className="min-w-full inline-block align-middle">
              <div>
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                    <tr>
                      <th className="hidden sm:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        NIS
                      </th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nama Siswa
                      </th>
                      <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nilai
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {studentGrades.map((row, index) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white w-24">
                          {row.nis}
                        </td>
                        <td className="px-3 sm:px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex flex-col">
                            <span className="font-medium whitespace-normal">{row.name}</span>
                            <span className="text-xs text-gray-400 sm:hidden">{row.nis}</span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 w-24 sm:w-32">
                          <StyledInput
                            type="number"
                            value={row.score}
                            onChange={(e) => handleScoreChange(row.id, e.target.value)}
                            className={`w-full text-center text-lg py-1.5 font-bold transition-all focus:ring-2 focus:ring-blue-500 !px-1 ${row.score !== row.originalScore ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10' : ''}`}
                            placeholder="-"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3 rounded-b-2xl">
          <StyledButton onClick={onClose} variant="secondary" disabled={saving}>
            Batal
          </StyledButton>
          <StyledButton onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? (
              <>
                <span className="opacity-75 mr-2">Menyimpan...</span>
                <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </StyledButton>
        </div>
      </div>
    </div>
  );
};

export default GradeDetailsModal;
