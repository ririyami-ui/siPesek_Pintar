import api from '../lib/axios';
import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import toast from 'react-hot-toast';

export default function ScheduleEditor({ scheduleData, onSave, onClose, subjects, classes }) {
  const [day, setDay] = useState('');
  const [scheduleType, setScheduleType] = useState('teaching');
  const [selectedClass, setSelectedClass] = useState('');
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [activityName, setActivityName] = useState('');
  const [saving, setSaving] = useState(false);

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  useEffect(() => {
    if (scheduleData) {
      setDay(scheduleData.day || '');
      setScheduleType(scheduleData.type || 'teaching');

      const classId = scheduleData.class_id || (typeof scheduleData.class === 'object' ? scheduleData.classId : scheduleData.classId || scheduleData.class);
      setSelectedClass(classId || '');

      setStartPeriod(scheduleData.start_period || scheduleData.startPeriod || '');
      setEndPeriod(scheduleData.end_period || scheduleData.endPeriod || '');
      setStartTime(scheduleData.start_time || scheduleData.startTime || '');
      setEndTime(scheduleData.end_time || scheduleData.endTime || '');
      setSelectedSubject(scheduleData.subject_id || scheduleData.subjectId || '');
      setActivityName(scheduleData.activity_name || scheduleData.activityName || '');
    }
  }, [scheduleData]);

  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      day,
      start_time: startTime,
      end_time: endTime,
      type: scheduleType,
      start_period: scheduleType === 'teaching' ? parseInt(startPeriod) : 0,
      end_period: scheduleType === 'teaching' ? parseInt(endPeriod) : 0,
      class_id: selectedClass || null,
      subject_id: scheduleType === 'teaching' ? selectedSubject : null,
      activity_name: scheduleType === 'non-teaching' ? activityName : '',
    };

    try {
      await api.put(`/schedules/${scheduleData.id}`, payload);
      toast.success('Jadwal berhasil diperbarui!');
      onSave();
    } catch (error) {
      console.error("Error updating schedule: ", error);
      toast.error('Gagal memperbarui jadwal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleUpdateSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Type Toggle - Maybe read-only for edit? Or allow changing? Allowing change is fine but resets fields */}
      <div className="md:col-span-2 mb-2 p-1 bg-gray-100 rounded-lg flex">
        <button
          type="button"
          onClick={() => setScheduleType('teaching')}
          className={`flex-1 py-1 px-3 rounded text-sm font-medium transition ${scheduleType === 'teaching' ? 'bg-blue-600 text-white shadow' : 'text-gray-600'}`}
        >
          Mengajar
        </button>
        <button
          type="button"
          onClick={() => setScheduleType('non-teaching')}
          className={`flex-1 py-1 px-3 rounded text-sm font-medium transition ${scheduleType === 'non-teaching' ? 'bg-pink-500 text-white shadow' : 'text-gray-600'}`}
        >
          Non-KBM
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="day" className="block text-gray-700 text-sm font-bold mb-2">Hari:</label>
        <StyledSelect
          id="day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          required
        >
          <option value="">Pilih Hari</option>
          {daysOfWeek.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </StyledSelect>
      </div>

      {scheduleType === 'teaching' ? (
        <>
          <div className="mb-4">
            <label htmlFor="class" className="block text-gray-700 text-sm font-bold mb-2">Kelas:</label>
            <StyledSelect
              id="class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              required
            >
              <option value="">Pilih Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.rombel}</option>
              ))}
            </StyledSelect>
          </div>

          <div className="mb-4">
            <label htmlFor="startPeriod" className="block text-gray-700 text-sm font-bold mb-2">Jam ke:</label>
            <StyledInput
              type="number"
              id="startPeriod"
              value={startPeriod}
              onChange={(e) => setStartPeriod(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="endPeriod" className="block text-gray-700 text-sm font-bold mb-2">Sampai jam ke:</label>
            <StyledInput
              type="number"
              id="endPeriod"
              value={endPeriod}
              onChange={(e) => setEndPeriod(e.target.value)}
              required
            />
          </div>
        </>
      ) : (
        <div className="mb-4 md:col-span-2">
          <label htmlFor="activityName" className="block text-gray-700 text-sm font-bold mb-2">Nama Kegiatan:</label>
          <StyledInput
            type="text"
            id="activityName"
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            placeholder="Contoh: Istirahat, Upacara"
            required
          />
        </div>
      )}

      <div className="mb-4">
        <label htmlFor="startTime" className="block text-gray-700 text-sm font-bold mb-2">Waktu Mulai:</label>
        <StyledInput
          type="time"
          id="startTime"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="endTime" className="block text-gray-700 text-sm font-bold mb-2">Waktu Selesai:</label>
        <StyledInput
          type="time"
          id="endTime"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
      </div>

      {scheduleType === 'non-teaching' && (
        <div className="mb-4 md:col-span-2">
          <label htmlFor="classOptional" className="block text-gray-700 text-sm font-bold mb-2">Kelas (Opsional):</label>
          <StyledSelect
            id="classOptional"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Semua Kelas / Umum</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.rombel}</option>
            ))}
          </StyledSelect>
        </div>
      )}

      {scheduleType === 'teaching' && (
        <div className="mb-4 md:col-span-2">
          <label htmlFor="subject" className="block text-gray-700 text-sm font-bold mb-2">Mata Pelajaran:</label>
          <StyledSelect
            id="subject"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            required
          >
            <option value="">Pilih Mata Pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </StyledSelect>
        </div>
      )}

      <div className="md:col-span-2 flex justify-end space-x-2">
        <StyledButton type="button" variant="outline" onClick={onClose}>Batal</StyledButton>
        <StyledButton type="submit" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </StyledButton>
      </div>
    </form>
  );
}
