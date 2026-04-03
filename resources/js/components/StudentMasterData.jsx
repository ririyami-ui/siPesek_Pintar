import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import api from '../lib/axios';

import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import StyledSelect from './StyledSelect';
import StyledTable from './StyledTable';
import { Plus, Upload, Download, Edit, Trash2, Sparkles } from 'lucide-react';
import Modal from './Modal';
import StudentEditor from './StudentEditor';

export default function StudentMasterData() {
  const [students, setStudents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newNIS, setNewNIS] = useState('');
  const [newNISN, setNewNISN] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newBirthPlace, setNewBirthPlace] = useState('');
  const [newBirthDate, setNewBirthDate] = useState('');
  const [newClassId, setNewClassId] = useState('');
  const [newAbsen, setNewAbsen] = useState('');
  const [file, setFile] = useState(null);
  const [rombels, setRombels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedRombelFilter, setSelectedRombelFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleSaveStudent = () => {
    getStudents(); // Refresh the list after saving
    handleCloseModal();
  };

  const getStudents = useCallback(async () => {
    setLoading(true);
    try {
      const [studentRes, userRes] = await Promise.all([
        api.get('/students'),
        api.get('/me')
      ]);
      let data = studentRes.data.data || studentRes.data || [];
      const userData = userRes.data;
      setUser(userData);

      // Map backend response 'class' relation to 'rombel' field for frontend compatibility
      data = data.map(s => ({
        ...s,
        rombel: s.class ? s.class.rombel : ''
      }));

      if (selectedRombelFilter) {
        data = data.filter(s => s.rombel === selectedRombelFilter);
      }

      // Sort by code or name
      data.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

      setStudents(data);
    } catch (error) {
      console.error("Error getting students: ", error);
      toast.error('Gagal memuat data siswa.');
    } finally {
      setLoading(false);
    }
  }, [selectedRombelFilter]);

  const getClasses = useCallback(async () => {
    try {
      const classRes = await api.get('/classes');
      const classData = classRes.data.data || classRes.data || [];
      
      // Backend already filters based on role and assignments
      const classList = classData.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || ''));
      setClasses(classList);
      const rombelNames = classList.map(c => c.rombel);
      setRombels(rombelNames);
    } catch (error) {
      console.error("Error getting classes: ", error);
      toast.error('Gagal memuat data kelas.');
    }
  }, []);

  useEffect(() => {
    getClasses();
    getStudents();
  }, [getClasses, getStudents]);

  const addStudent = async () => {
    if (!newStudentName || !newGender || !newClassId) {
      toast.error('Nama, Jenis Kelamin dan Kelas wajib diisi.');
      return;
    }

    const payload = {
      code: newStudentCode,
      nis: newNIS,
      nisn: newNISN,
      name: newStudentName,
      gender: newGender,
      birth_place: newBirthPlace,
      birth_date: newBirthDate,
      class_id: newClassId,
      absen: newAbsen,
    };

    const promise = api.post('/students', payload);

    toast.promise(promise, {
      loading: 'Menyimpan...',
      success: () => {
        setNewStudentCode('');
        setNewNIS('');
        setNewNISN('');
        setNewStudentName('');
        setNewGender('');
        setNewBirthPlace('');
        setNewBirthDate('');
        setNewClassId('');
        setNewAbsen('');
        getStudents();
        return 'Siswa berhasil ditambahkan!';
      },
      error: (err) => {
        return err.response?.data?.message || 'Gagal menambah siswa.';
      },
    });
  };

  const deleteStudent = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Siswa',
      message: 'Apakah Anda yakin ingin menghapus data siswa ini? Tindakan ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        const promise = api.delete(`/students/${id}`);
        toast.promise(promise, {
          loading: 'Menghapus...',
          success: () => {
            getStudents();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return 'Siswa berhasil dihapus!';
          },
          error: 'Gagal menghapus siswa.',
        });
      }
    });
  };

  const handleFileUpload = (event) => {
    setFile(event.target.files[0]);
  };

  // Smart Date Normalizer (Excel Serial, DD/MM/YYYY, or Indonesian Text)
  const normalizeImportDate = (input) => {
    if (!input) return null; // Return null instead of empty string for date field

    // 1. Handle Excel Serial (Number)
    if (typeof input === 'number') {
      const utc_days = Math.floor(input - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      const year = date_info.getFullYear();
      const month = String(date_info.getMonth() + 1).padStart(2, '0');
      const day = String(date_info.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2. Handle String Formats
    if (typeof input === 'string') {
      const str = input.trim();

      // Standard YYYY-MM-DD -> Return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      // DD Month YYYY (Indonesian e.g. "20 Januari 2010" or "20 Jan 2010")
      // ... (Same implementations as before) ...
      // Assuming same logic, skipping specific implementation detail for brevity if standard date parser works
      // But preserving specific Indonesian month map logic is good.
      const monthMap = {
        'januari': '01', 'jan': '01',
        'februari': '02', 'feb': '02', 'pebruari': '02',
        'maret': '03', 'mar': '03',
        'april': '04', 'apr': '04',
        'mei': '05', 'may': '05',
        'juni': '06', 'jun': '06',
        'juli': '07', 'jul': '07',
        'agustus': '08', 'ags': '08', 'aug': '08',
        'september': '09', 'sep': '09',
        'oktober': '10', 'okt': '10', 'oct': '10',
        'november': '11', 'nov': '11',
        'desember': '12', 'des': '12', 'dec': '12'
      };

      const textMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
      if (textMatch) {
        const day = textMatch[1].padStart(2, '0');
        const monthRaw = textMatch[2].toLowerCase();
        const year = textMatch[3];
        const month = monthMap[monthRaw];

        if (month) return `${year}-${month}-${day}`;
      }

      // Try Javascript Date Parser as fallback
      const dateObj = new Date(str);
      if (!isNaN(dateObj)) {
        return dateObj.toISOString().split('T')[0];
      }
    }

    return null;
  };

  const normalizeGender = (input) => {
    if (!input) return 'L'; // Default or error?
    const clean = String(input).trim().toUpperCase();
    if (clean === 'L' || clean === 'LAKI-LAKI' || clean === 'LAKI' || clean === 'PRIA') return 'L';
    if (clean === 'P' || clean === 'PEREMPUAN' || clean === 'WANITA' || clean === 'PEREMPUAN') return 'P';
    return 'L'; // Fallback
  };

  const importStudents = async () => {
    if (!file) {
      toast.error('Pilih file Excel untuk diimpor.');
      return;
    }

    const toastId = toast.loading('Mengimpor data...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;

        // We need classes to map rombel name to class_id
        // Ensure classes are loaded
        if (classes.length === 0) {
          await getClasses();
        }

        // Refetch classes to be sure (since getClasses is async and state updates might lag in this closure? No, if we await it logic should be fine but better use local var)
        const response = await api.get('/classes');
        const currentClasses = response.data.data;

        // Helper function for delay
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (const row of json) {
          if (!row['Nama Siswa']) continue;

          const rowRombel = row['Rombel'];
          const classObj = currentClasses.find(c => c.rombel === rowRombel);

          if (!classObj) {
            // Skip if class not found
            continue;
          }

          const finalGender = normalizeGender(row['Jenis Kelamin']);

          const studentData = {
            code: row['Kode Siswa'] ? String(row['Kode Siswa']).trim() : null,
            absen: row['No. Absen'] ? String(row['No. Absen']) : null,
            nis: row['NIS'] ? String(row['NIS']).trim() : null,
            nisn: row['NISN'] ? String(row['NISN']).trim() : null,
            name: row['Nama Siswa'],
            gender: finalGender,
            birth_place: row['Tempat Lahir'] || null,
            birth_date: normalizeImportDate(row['Tanggal Lahir']),
            class_id: classObj.id,
          };

          try {
            // We can check existence via API or just post and catch duplicate errors
            await api.post('/students', studentData);
            importedCount++;
            
            // Add a dynamic delay after each successful request
            // If we have many students, increase the delay slightly
            await delay(200); 
          } catch (err) {
            if (err.response?.status === 429) {
                // If rate limited, wait MUCH longer and retry
                toast.error('Server sibuk, menunggu 5 detik...', { duration: 3000 });
                await delay(5000);
                try {
                    await api.post('/students', studentData);
                    importedCount++;
                } catch (retryErr) {
                    console.error("Retry failed for row: ", row['Nama Siswa']);
                }
            }
            // Ignore other errors (like duplicate)
          }
        }

        toast.success(`${importedCount} siswa berhasil diimpor.`, { id: toastId });
        setFile(null);
        getStudents();
      } catch (error) {
        console.error("Error importing students: ", error);
        toast.error('Gagal mengimpor data.', { id: toastId });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template_data_siswa.xlsx';
    link.download = 'template_data_siswa.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-purple-600 border-gray-200"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Student Form - Only for Admin */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700/50 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Plus size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight">Tambah Data Siswa Baru</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Lengkapi form di bawah ini untuk menambahkan data siswa ke sistem.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 relative z-10">
            {/* Identity Group */}
            <div className="lg:col-span-12 space-y-4">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">Informasi Identitas</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StyledInput label="Kode Siswa" type="text" placeholder="Contoh: SIS-001" value={newStudentCode} onChange={(e) => setNewStudentCode(e.target.value)} />
                <StyledInput label="NIS" type="text" placeholder="Nomor Induk Siswa" value={newNIS} onChange={(e) => setNewNIS(e.target.value)} />
                <StyledInput label="NISN" type="text" placeholder="Nomor Induk Siswa Nasional" value={newNISN} onChange={(e) => setNewNISN(e.target.value)} />
                <StyledInput label="Nama Lengkap" type="text" placeholder="Nama lengkap siswa" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
              </div>
            </div>

            {/* Personal Data Group */}
            <div className="lg:col-span-12 space-y-4 mt-2">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-2">Data Pribadi & Akademik</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <StyledSelect label="Jenis Kelamin" value={newGender} onChange={(e) => setNewGender(e.target.value)}>
                  <option value="">Pilih Kelamin...</option>
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </StyledSelect>
                <StyledInput label="Tempat Lahir" type="text" placeholder="Kota kelahiran" value={newBirthPlace} onChange={(e) => setNewBirthPlace(e.target.value)} />
                <StyledInput label="Tanggal Lahir" type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} />
                <StyledSelect label="Rombel / Kelas" value={newClassId} onChange={(e) => setNewClassId(e.target.value)}>
                  <option value="">Pilih Kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
                </StyledSelect>
                <StyledInput label="No. Absen" type="number" placeholder="Nomor urut" value={newAbsen} onChange={(e) => setNewAbsen(e.target.value)} />
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700/50 relative z-10">
            <StyledButton onClick={() => {
              setNewStudentCode(''); setNewNIS(''); setNewNISN(''); setNewStudentName(''); 
              setNewGender(''); setNewBirthPlace(''); setNewBirthDate(''); setNewClassId(''); setNewAbsen('');
            }} variant="outline" className="!px-6">
              Reset Form
            </StyledButton>
            <StyledButton onClick={addStudent} className="!px-8 shadow-lg shadow-primary/30">
              <Sparkles className="mr-2" size={18} /> Simpan Data Siswa
            </StyledButton>
          </div>
        </div>
      )}

      {/* Import/Export Data - Only for Admin */}
      {isAdmin && (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
          <h3 className="text-lg font-bold mb-4 text-purple-600 dark:text-purple-400">Impor/Ekspor Data</h3>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <StyledInput type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="flex-1" />
            <div className="flex gap-2">
              <StyledButton onClick={importStudents} variant="secondary"><Upload className="mr-2" size={16} />Impor</StyledButton>
              <StyledButton onClick={downloadTemplate} variant="outline"><Download className="mr-2" size={16} />Unduh Template</StyledButton>
            </div>
          </div>
        </div>
      )}

      {/* Student List Table */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
            {isAdmin ? 'Daftar Semua Siswa' : 'Siswa di Mata Pelajaran Anda'}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400">Filter Rombel:</span>
            <StyledSelect
              className="!w-40"
              value={selectedRombelFilter}
              onChange={(e) => setSelectedRombelFilter(e.target.value)}
            >
              <option value="">Semua Rombel</option>
              {rombels.map(r => <option key={r} value={r}>{r}</option>)}
            </StyledSelect>
            <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-3 py-1 rounded-full">{students.length} Siswa</span>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-text-muted-light dark:text-text-muted-dark font-medium italic">Tidak ada data siswa yang tersedia.</p>
          </div>
        ) : (
          <StyledTable headers={[
            { label: 'No. Absen' },
            { label: 'Kode Siswa' },
            { label: 'NIS/NISN' },
            { label: 'Nama Lengkap' },
            { label: 'L/P' },
            { label: 'Rombel' },
            ...(isAdmin ? [{ label: 'Aksi' }] : [])
          ]}>
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm font-medium text-text-light dark:text-text-dark">{student.absen || '-'}</td>
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm"><span className="font-bold text-purple-600 dark:text-purple-400">{student.code || '-'}</span></td>
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm">
                  <div>{student.nis || '-'}</div>
                  <div className="text-gray-400">{student.nisn || '-'}</div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm font-bold text-text-light dark:text-text-dark">{student.name}</td>
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm text-text-muted-light dark:text-text-muted-dark">{student.gender}</td>
                <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-bold text-text-muted-light dark:text-text-muted-dark">{student.rombel}</span></td>
                {isAdmin && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs sm:px-6 sm:text-sm">
                    <div className="flex gap-2">
                      <button onClick={() => handleEditStudent(student)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Edit size={16} /></button>
                      <button onClick={() => deleteStudent(student.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </StyledTable>
        )}
      </div>

      {isModalOpen && (
        <Modal title="Edit Data Siswa" onClose={handleCloseModal}>
          <StudentEditor
            studentData={selectedStudent}
            onSave={handleSaveStudent}
            onClose={handleCloseModal}
            rombels={rombels}
            classes={classes}
          />
        </Modal>
      )}

      {confirmModal.isOpen && (
        <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}