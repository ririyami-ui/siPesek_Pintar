import { getAllGrades, getAllAttendance, getAllInfractions } from '../utils/analysis';
import { useNavigate, Link } from 'react-router-dom';
import { Loader, AlertCircle, CheckCircle, XCircle, BookOpen, ShieldX, FileText } from 'lucide-react';

const StudentWarningDetails = ({ student, activeSemester, academicYear }) => {
  const navigate = useNavigate();
  const [details, setDetails] = useState({ grades: [], attendance: [], infractions: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!student) return;

      setIsLoading(true);
      try {
        const [grades, attendance, infractions] = await Promise.all([
          getAllGrades(null, student.id, activeSemester, academicYear),
          getAllAttendance(null, student.id, activeSemester, academicYear),
          getAllInfractions(null, student.id, activeSemester, academicYear)
        ]);

        setDetails({ grades, attendance, infractions });
      } catch (error) {
        console.error("Error fetching student details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [student, activeSemester, academicYear]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader className="animate-spin mr-2" />
        <span>Memuat detail...</span>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Hadir': return <CheckCircle className="text-green-500" />;
      case 'Sakit':
      case 'Ijin': return <AlertCircle className="text-yellow-500" />;
      case 'Alpha': return <XCircle className="text-red-500" />;
      default: return null;
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Detail Peringatan: {student.name}</h2>
      <p className="text-sm text-gray-500 mb-4">Kelas: {student.rombel}</p>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
        <p className="w-full text-xs font-bold text-primary uppercase tracking-wider mb-1">Tindakan Cepat:</p>
        <Link
          to={`/nilai?classId=${encodeURIComponent(student.rombel)}`}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-gray-800 text-primary border border-primary/30 rounded-lg hover:bg-primary hover:text-white transition-all text-sm font-semibold shadow-sm"
        >
          <BookOpen size={16} /> Input Nilai
        </Link>
        <button
          onClick={() => navigate('/pelanggaran', { state: { studentId: student.id, classId: student.rombel } })}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-gray-800 text-red-500 border border-red-200 rounded-lg hover:bg-red-500 hover:text-white transition-all text-sm font-semibold shadow-sm"
        >
          <ShieldX size={16} /> Catat Pelanggaran
        </button>
        <button
          onClick={() => navigate('/rekap-individu', { state: { studentId: student.id, classId: student.rombel } })}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all text-sm font-bold shadow-lg shadow-blue-500/20"
        >
          <FileText size={16} /> Rekap Lengkap & AI
        </button>
      </div>

      <div className="space-y-6">
        {/* Grades Section */}
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center"><BookOpen className="mr-2" />Nilai</h3>
          {details.grades.length > 0 ? (
            <ul className="space-y-2">
              {details.grades.map(grade => (
                <li key={grade.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{grade.assessmentType}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{grade.material || '-'}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(grade.date).toLocaleDateString('id-ID')}</p>
                    </div>
                    <span className={`text-lg font-bold ${grade.score < 65 ? 'text-red-500' : 'text-green-500'}`}>{grade.score}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">Tidak ada data nilai.</p>}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center"><ShieldX className="mr-2" />Pelanggaran</h3>
          {details.infractions.length > 0 ? (
            <ul className="space-y-2">
              {details.infractions.map(infraction => (
                <li key={infraction.id} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <p className="font-semibold">{infraction.infractionType} <span className="font-normal text-sm">({new Date(infraction.date).toLocaleDateString('id-ID')})</span></p>
                  <p className="text-sm text-red-600 dark:text-red-400">Poin: -{infraction.points} | Sanksi: {infraction.sanction}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">Tidak ada catatan pelanggaran.</p>}
        </div>

        {/* Attendance Section */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Absensi</h3>
          {details.attendance.length > 0 ? (
            <ul className="space-y-2">
              {details.attendance.map(att => (
                <li key={att.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <span>{new Date(att.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(att.status)}
                    <span>{att.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-gray-500">Tidak ada data absensi.</p>}
        </div>

      </div>
    </div>
  );
};

export default StudentWarningDetails;
