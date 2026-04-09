import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { useSettings } from '../utils/SettingsContext';
import Modal from '../components/Modal';
import { Trash2, Settings2, Plus, Edit2, Save, X } from 'lucide-react';
import StyledInput from '../components/StyledInput';
import StyledButton from '../components/StyledButton';

const PelanggaranPage = () => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [infractionType, setInfractionType] = useState('');
  const [infractions, setInfractions] = useState([]);
  const [studentScore, setStudentScore] = useState(100);
  const [attitude, setAttitude] = useState('Sangat Baik');
  const [customInfraction, setCustomInfraction] = useState('');
  const [customPoints, setCustomPoints] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dynamicInfractionTypes, setDynamicInfractionTypes] = useState([]);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  // Management State
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePoints, setNewTypePoints] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [editingTypePoints, setEditingTypePoints] = useState('');

  const { activeSemester, academicYear } = useSettings();
  const location = useLocation();

  const DEFAULT_INFRACTION_TYPES = {
    'Tidur': { points: 5, sanction: 'Teguran lisan' },
    'Mengganggu teman': { points: 10, sanction: 'Teguran lisan & dicatat' },
    'Bertindak kurang sopan': { points: 15, sanction: 'Teguran keras & pemanggilan orang tua' },
    'Ramai di kelas': { points: 5, sanction: 'Teguran lisan' },
    'Tidak menghiraukan guru': { points: 10, sanction: 'Teguran lisan & dicatat' },
    'Terlambat masuk kelas': { points: 5, sanction: 'Teguran lisan' },
    'Sering ijin keluar': { points: 5, sanction: 'Pembatasan ijin keluar' },
    'Bolos pelajaran': { points: 15, sanction: 'Teguran keras & pemanggilan orang tua' },
    'Di luar kelas tanpa izin': { points: 5, sanction: 'Teguran lisan' },
    'Membuang sampah sembarangan': { points: 5, sanction: 'Teguran lisan' },
    'Mencontek': { points: 10, sanction: 'Teguran lisan & dicatat' },
    'Berbohong': { points: 10, sanction: 'Teguran lisan & dicatat' },
    'Perkelahian': { points: 20, sanction: 'Pemanggilan orang tua & skorsing' },
    'Membawa barang terlarang': { points: 25, sanction: 'Barang disita & pemanggilan orang tua' },
    'Membawa HP': { points: 10, sanction: 'HP disita & teguran lisan' },
    'Merokok': { points: 20, sanction: 'Pemanggilan orang tua & skorsing' },
    'Merusak fasilitas sekolah': { points: 25, sanction: 'Ganti rugi & pemanggilan orang tua' },
  };

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await api.get('/classes?all=true');
        const classData = response.data.data || response.data || [];
        setClasses([...classData].sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
      } catch (err) {
        console.error(err);
        toast.error('Gagal memuat data kelas');
      }
    };
    fetchClasses();
  }, []);

  // Fetch and Sync Dynamic Infraction Types
  const fetchDynamicTypes = async () => {
    setIsSettingsLoading(true);
    try {
      const response = await api.get('/infraction-types');
      const types = response.data.data || response.data || [];
      setDynamicInfractionTypes(types);
    } catch (error) {
      console.error("Error fetching types:", error);
      toast.error("Gagal memuat jenis pelanggaran");
    } finally {
      setIsSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicTypes();
  }, []);

  // Handle incoming navigation state for pre-selection
  useEffect(() => {
    if (location.state && location.state.classId) {
      setSelectedClass(location.state.classId);
      if (location.state.studentId) {
        setSelectedStudent(location.state.studentId);
      }
    }
  }, [location.state]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (selectedClass) {
        try {
          const res = await api.get('/students', {
            params: { rombel: selectedClass }
          });
          const studentData = res.data.data || res.data || [];
          setStudents([...studentData].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        } catch (err) {
          console.error(err);
          toast.error('Gagal memuat data siswa');
        }
      } else {
        setStudents([]);
      }
    };
    fetchStudents();
  }, [selectedClass]);

  const handleSaveInfraction = async () => {
    if (!selectedStudent || !infractionType) {
      toast.error('Silakan pilih siswa dan jenis pelanggaran.');
      return;
    }

    let infractionData = {
      student_id: selectedStudent,
      date: new Date().toISOString(),
      semester: activeSemester,
      academic_year: academicYear
    };

    if (infractionType === 'Lainnya') {
      if (!customInfraction || !customPoints) {
        toast.error('Untuk pelanggaran "Lainnya", detail dan poin harus diisi.');
        return;
      }
      infractionData = {
        ...infractionData,
        description: customInfraction,
        points: parseInt(customPoints, 10),
        category: 'Lainnya'
      };
    } else {
      const selectedType = dynamicInfractionTypes.find(t => t.name === infractionType);
      if (!selectedType) {
        toast.error('Jenis pelanggaran tidak ditemukan.');
        return;
      }
      infractionData = {
        ...infractionData,
        description: infractionType,
        points: selectedType.points,
        category: infractionType
      };
    }

    try {
      await api.post('/infractions', infractionData);
      toast.success('Pelanggaran berhasil dicatat.');
      fetchInfractions(selectedStudent);
      setCustomInfraction('');
      setCustomPoints('');
      setInfractionType('');
    } catch (error) {
      toast.error('Gagal menyimpan data.');
      console.error("Error adding document: ", error);
    }
  };

  const handleDeleteInfraction = (infractionId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pelanggaran',
      message: 'Apakah Anda yakin ingin menghapus catatan pelanggaran ini?',
      onConfirm: async () => {
        try {
          await api.delete(`/infractions/${infractionId}`);
          toast.success('Pelanggaran berhasil dihapus.');
          fetchInfractions(selectedStudent);
        } catch (error) {
          toast.error('Gagal menghapus pelanggaran.');
          console.error("Error removing document: ", error);
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const fetchInfractions = async (studentId) => {
    if (studentId) {
      try {
        const response = await api.get('/infractions', {
          params: {
            student_id: studentId,
            semester: activeSemester,
            academic_year: academicYear
          }
        });
        const infractionList = response.data.data || response.data || [];
        const fetchedInfractions = infractionList.map(i => ({
          ...i,
          infractionType: i.description || i.category,
          sanction: i.sanction || 'Teguran lisan'
        }));
        setInfractions(fetchedInfractions);
        calculateScore(fetchedInfractions);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const calculateScore = (infractions) => {
    const totalPointsDeducted = infractions.reduce((acc, curr) => acc + (curr.points || 0), 0);
    const currentScore = 100 - totalPointsDeducted;
    setStudentScore(currentScore);

    if (currentScore > 90) setAttitude('Sangat Baik');
    else if (currentScore >= 75) setAttitude('Baik');
    else if (currentScore >= 60) setAttitude('Cukup');
    else setAttitude('Kurang');
  };

  useEffect(() => {
    if (selectedStudent) {
      fetchInfractions(selectedStudent);
    } else {
      setInfractions([]);
      setStudentScore(100);
      setAttitude('Sangat Baik');
    }
  }, [selectedStudent, activeSemester, academicYear]);

  // --- Management Actions ---
  const handleAddType = async () => {
    if (!newTypeName.trim() || !newTypePoints) {
      toast.error("Nama dan Poin wajib diisi");
      return;
    }
    try {
      await api.post('/infraction-types', {
        name: newTypeName.trim(),
        points: parseInt(newTypePoints, 10),
        sanction: 'Teguran sesuai aturan'
      });
      toast.success("Jenis pelanggaran ditambahkan");
      setNewTypeName('');
      setNewTypePoints('');
      fetchDynamicTypes();
    } catch (e) {
      toast.error("Gagal menambah data");
    }
  };

  const handleSeedDefaultTypes = async () => {
    setIsSettingsLoading(true);
    try {
      const typesToSeed = Object.entries(DEFAULT_INFRACTION_TYPES).map(([name, data]) => ({
        name,
        points: data.points,
        sanction: data.sanction
      }));

      await api.post('/infraction-types/bulk', { types: typesToSeed });
      toast.success("Data awal berhasil dimuat");
      fetchDynamicTypes();
    } catch (error) {
      console.error("Error seeding types:", error);
      toast.error("Gagal memuat data awal");
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const handleUpdateType = async (id) => {
    if (!editingTypeName.trim() || !editingTypePoints) return;
    try {
      await api.put(`/infraction-types/${id}`, {
        name: editingTypeName.trim(),
        points: parseInt(editingTypePoints, 10)
      });
      toast.success("Berhasil diperbarui");
      setEditingTypeId(null);
      fetchDynamicTypes();
    } catch (e) {
      toast.error("Gagal memperbarui");
    }
  };

  const handleDeleteType = async (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Jenis Pelanggaran',
      message: 'Apakah Anda yakin ingin menghapus jenis pelanggaran ini? Data history siswa tidak akan terhapus.',
      onConfirm: async () => {
        try {
          await api.delete(`/infraction-types/${id}`);
          toast.success("Berhasil dihapus");
          fetchDynamicTypes();
        } catch (e) {
          toast.error("Gagal menghapus");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return (
    <div className="p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl transition-all border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl">
              <Trash2 className="text-red-600 dark:text-red-400" size={24} />
            </div>
            Pelanggaran Peserta Didik
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Catat dan pantau kedisiplinan secara real-time.</p>
        </div>
        <StyledButton
          onClick={() => setIsSettingsOpen(true)}
          variant="secondary"
          className="flex items-center gap-2 group whitespace-nowrap"
        >
          <Settings2 size={18} className="group-hover:rotate-90 transition-transform duration-500" />
          Atur Jenis Pelanggaran
        </StyledButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 ml-1 text-[10px]">Tanggal</label>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200 font-medium">
            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 ml-1 text-[10px]">Kelas</label>
          <select
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setSelectedStudent('');
            }}
            value={selectedClass}
            className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition-all dark:text-white font-medium"
          >
            <option value="">-- Pilih Kelas --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 ml-1 text-[10px]">Nama Peserta Didik</label>
          <select
            onChange={(e) => setSelectedStudent(e.target.value)}
            value={selectedStudent}
            className="w-full p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500 outline-none transition-all dark:text-white font-medium"
            disabled={!selectedClass}
          >
            <option value="">-- Cari atau Pilih Peserta Didik --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest flex items-center gap-2">
            Pilih Jenis Pelanggaran
          </h3>
          <span className="text-[10px] text-gray-400 italic">Klik tombol untuk memilih</span>
        </div>
        <div className="flex flex-wrap gap-2 p-3 md:p-5 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          {dynamicInfractionTypes.length === 0 && !isSettingsLoading && (
            <div className="w-full py-2 text-center">
              <p className="text-xs text-gray-500 italic mb-2">Daftar jenis pelanggaran belum diatur.</p>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Klik "Atur Jenis Pelanggaran" untuk memuat data awal.
              </button>
            </div>
          )}
          {dynamicInfractionTypes.map(type => (
            <button
              key={type.id}
              onClick={() => setInfractionType(type.name)}
              className={`px-3 py-2 rounded-xl text-[11px] md:text-sm font-bold transition-all transform active:scale-95 ${infractionType === type.name
                ? 'bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-none translate-y-[-2px]'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-red-400 hover:text-red-600'
                }`}
            >
              {type.name}
              <span className={`ml-1.5 text-[9px] md:text-[10px] px-1.5 py-0.5 rounded ${infractionType === type.name ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                {type.points} pts
              </span>
            </button>
          ))}
          <button
            onClick={() => setInfractionType('Lainnya')}
            className={`px-3 py-2 rounded-xl text-[11px] md:text-sm font-bold transition-all active:scale-95 ${infractionType === 'Lainnya'
              ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-800'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-gray-400'
              }`}
          >
            Lainnya...
          </button>
        </div>
      </div>

      {infractionType === 'Lainnya' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-5 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="md:col-span-2">
            <StyledInput
              label="Detail Pelanggaran Luar Daftar"
              value={customInfraction}
              onChange={(e) => setCustomInfraction(e.target.value)}
              placeholder="Contoh: Menggunakan seragam tidak sesuai aturan"
              voiceEnabled
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Poin (Angka)</label>
            <input
              type="number"
              value={customPoints}
              onChange={(e) => setCustomPoints(e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-900/30 rounded-xl focus:ring-2 focus:ring-red-500 outline-none dark:text-white"
              placeholder="Misal: 10"
            />
          </div>
        </div>
      )}

      <StyledButton
        onClick={handleSaveInfraction}
        className="w-full py-4 text-base font-bold shadow-lg shadow-red-100 dark:shadow-none"
        variant="danger"
        disabled={!selectedStudent || !infractionType}
      >
        <Save className="mr-2" size={20} />
        Simpan Pelanggaran
      </StyledButton>

      {selectedStudent && (
        <div className="mt-12 space-y-6 animate-in fade-in duration-700">
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            <div className="flex-1 p-5 bg-gray-50 dark:bg-gray-700/30 rounded-3xl border border-gray-100 dark:border-gray-700 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2">Poin Dasar</span>
              <span className="text-4xl font-black text-gray-800 dark:text-white">100</span>
            </div>
            <div className="flex-1 p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
              <span className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] mb-2 z-10">Poin Akhir</span>
              <span className="text-5xl font-black text-red-600 dark:text-red-400 z-10 drop-shadow-sm">{studentScore}</span>
            </div>
            <div className="flex-1 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20 flex flex-col justify-center items-center text-center relative group">
              <div className="absolute bottom-0 left-0 w-12 h-12 bg-blue-500/5 rounded-full -translate-x-1/2 translate-y-1/2 group-hover:scale-150 transition-transform duration-700"></div>
              <span className="text-[10px] font-black text-blue-500/60 uppercase tracking-[0.2em] mb-2">Predikat Sikap</span>
              <span className={`text-2xl font-black px-4 py-1.5 rounded-2xl ${studentScore > 90 ? 'bg-green-500 text-white' : studentScore >= 75 ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
                {attitude}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Daftar Pelanggaran
                <span className="bg-gray-200 dark:bg-gray-700 text-[10px] px-2 py-0.5 rounded-full">{infractions.length}</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/20">
                    <th className="py-4 px-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Waktu</th>
                    <th className="py-4 px-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Jenis Pelanggaran</th>
                    <th className="py-4 px-6 text-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Potongan</th>
                    <th className="py-4 px-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sanksi</th>
                    <th className="py-4 px-6 text-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {infractions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-gray-400 dark:text-gray-500 italic text-sm">Belum ada catatan pelanggaran untuk peserta didik ini di semester ini.</td>
                    </tr>
                  ) : (
                    infractions.map(inf => (
                      <tr key={inf.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/20 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                              {new Date(inf.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(inf.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white">{inf.infractionType}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="text-sm font-black text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">-{inf.points} pts</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-1">{inf.sanction}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleDeleteInfraction(inf.id)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RE-DESIGNED SETTINGS MODAL */}
      {isSettingsOpen && (
        <Modal onClose={() => {
          setIsSettingsOpen(false);
          setEditingTypeId(null);
        }}>
          <div className="max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                <Settings2 className="text-blue-500" />
                Daftar Jenis Pelanggaran
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDynamicTypes}
                  disabled={isSettingsLoading}
                  className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition flex items-center gap-2 text-xs font-bold"
                  title="Sinkronisasi Ulang / Muat Data Awal"
                >
                  <Settings2 size={16} className={isSettingsLoading ? 'animate-spin' : ''} />
                  Sinkronisasi
                </button>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800/20 mb-6">
              <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Plus size={14} />
                Tambah Jenis Pelanggaran Baru
              </h4>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-grow">
                  <input
                    type="text"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="Nama Pelanggaran (misal: Berkelahi)"
                    className="w-full p-2.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl outline-none dark:text-white text-sm"
                  />
                </div>
                <div className="w-full md:w-32">
                  <input
                    type="number"
                    value={newTypePoints}
                    onChange={(e) => setNewTypePoints(e.target.value)}
                    placeholder="Poin"
                    className="w-full p-2.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-xl outline-none dark:text-white text-sm"
                  />
                </div>
                <StyledButton variant="primary" onClick={handleAddType} className="h-[42px] px-6">
                  Tambah
                </StyledButton>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {isSettingsLoading ? (
                <div className="text-center py-10 text-gray-400">Memuat data...</div>
              ) : dynamicInfractionTypes.length === 0 ? (
                <div className="text-center py-10 px-6 bg-gray-50 dark:bg-gray-700/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 mb-4 font-medium italic">Belum ada jenis pelanggaran yang dikonfigurasi.</p>
                  <StyledButton
                    onClick={handleSeedDefaultTypes}
                    variant="primary"
                    className="flex items-center gap-2 mx-auto"
                  >
                    <Plus size={18} />
                    Muat Data Pelanggaran Default
                  </StyledButton>
                </div>
              ) : dynamicInfractionTypes.map(type => (
                <div key={type.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between group">
                  {editingTypeId === type.id ? (
                    <div className="flex flex-grow gap-2">
                      <input
                        autoFocus
                        value={editingTypeName}
                        onChange={(e) => setEditingTypeName(e.target.value)}
                        className="flex-grow p-1.5 border rounded-lg dark:bg-gray-800 text-sm dark:text-white"
                      />
                      <input
                        type="number"
                        value={editingTypePoints}
                        onChange={(e) => setEditingTypePoints(e.target.value)}
                        className="w-20 p-1.5 border rounded-lg dark:bg-gray-800 text-sm dark:text-white"
                      />
                      <button onClick={() => handleUpdateType(type.id)} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <Save size={16} />
                      </button>
                      <button onClick={() => setEditingTypeId(null)} className="p-2 bg-gray-400 text-white rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-xl font-black text-red-500 text-xs shadow-sm">
                          {type.points}
                        </div>
                        <span className="font-bold text-gray-700 dark:text-gray-200">{type.name}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingTypeId(type.id);
                            setEditingTypeName(type.name);
                            setEditingTypePoints(type.points);
                          }}
                          className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteType(type.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <Trash2 className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">{confirmModal.message}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-6 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl hover:bg-gray-200 transition active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 px-6 py-3.5 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-xl shadow-red-200 dark:shadow-none transition active:scale-95"
              >
                Hapus
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PelanggaranPage;
