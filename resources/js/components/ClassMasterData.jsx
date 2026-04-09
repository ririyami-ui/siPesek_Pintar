import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import api from '../lib/axios';

import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import ClassCard from './ClassCard';
import Modal from './Modal';
import { Plus, Upload, Download, Trash2, Scale, Users } from 'lucide-react';
import ClassAgreementModal from './ClassAgreementModal';

export default function ClassMasterData() {
  const [classes, setClasses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // State for new class form
  const [newCode, setNewCode] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [newRombel, setNewRombel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [teachers, setTeachers] = useState([]);
  // State for file import
  const [file, setFile] = useState(null);
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [currentClass, setCurrentClass] = useState(null);
  const [editData, setEditData] = useState({ code: '', level: '', rombel: '', description: '', user_id: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const getClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, userRes, teacherRes] = await Promise.all([
        api.get('/classes'),
        api.get('/me'),
        api.get('/teachers')
      ]);
      const classData = classRes.data.data || classRes.data || [];
      const teacherData = teacherRes.data.data || teacherRes.data || [];
      
      // Backend already filters based on role and assignments
      setClasses(classData.sort((a, b) => (a.rombel || '').localeCompare(b.rombel || '')));
      setUser(userRes.data);
      setTeachers(teacherData);
    } catch (error) {
      console.error("Error getting classes: ", error);
      toast.error('Gagal memuat data kelas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getClasses();
  }, [getClasses]);

  const addClass = async () => {
    if (!newCode || !newLevel || !newRombel) {
      toast.error('Kode Kelas, Tingkat, dan Rombel wajib diisi.');
      return;
    }

    const payload = {
      code: newCode,
      level: newLevel,
      rombel: newRombel,
      description: newDescription,
      user_id: newUserId || null
    };

    const promise = api.post('/classes', payload);

    toast.promise(promise, {
      loading: 'Menyimpan...',
      success: () => {
        setNewCode('');
        setNewLevel('');
        setNewRombel('');
        setNewDescription('');
        setNewUserId('');
        getClasses();
        return 'Kelas berhasil ditambahkan!';
      },
      error: (err) => {
        return err.response?.data?.message || 'Gagal menambah kelas.';
      },
    });
  };

  const deleteClass = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Kelas',
      message: 'Apakah Anda yakin ingin menghapus data kelas ini? Semua data terkait (seperti daftar siswa) mungkin akan terpengaruh atau kehilangan referensi.',
      onConfirm: async () => {
        const promise = api.delete(`/classes/${id}`);
        toast.promise(promise, {
          loading: 'Menghapus...',
          success: () => {
            getClasses();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            return 'Kelas berhasil dihapus!';
          },
          error: 'Gagal menghapus kelas.',
        });
      }
    });
  };

  const handleOpenEditModal = (classItem) => {
    setCurrentClass(classItem);
    setEditData({
      code: classItem.code || '',
      level: classItem.level || '',
      rombel: classItem.rombel || '',
      description: classItem.description || '',
      user_id: classItem.user_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAgreementModal = (classItem) => {
    setCurrentClass(classItem);
    setIsAgreementModalOpen(true);
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!currentClass) return;

    const payload = { ...editData };
    if (!payload.user_id) payload.user_id = null;

    const promise = api.put(`/classes/${currentClass.id}`, payload);

    toast.promise(promise, {
      loading: 'Memperbarui...',
      success: () => {
        setIsEditModalOpen(false);
        getClasses();
        return 'Data kelas berhasil diperbarui!';
      },
      error: (err) => err.response?.data?.message || 'Gagal memperbarui data.',
    });
  };

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    console.log('File selected:', selectedFile);
    setFile(selectedFile);
  };

  const importClasses = async () => {
    if (!file) {
      toast.error('Pilih file Excel untuk diimpor.');
      return;
    }

    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
      toast.error('Library XLSX tidak tersedia. Silakan refresh halaman.');
      console.error('XLSX library is not loaded');
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

        // We can fetch existing classes to minimize API calls or just let API handle validation errors
        // Ideally we should batch this but for now parallel requests or sequential
        // Let's use sequential to avoid rate limits or overwhelming server in this simple implementation

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of json) {
          const code = row['Kode Kelas'];
          if (code && row['Tingkat'] && row['Rombel']) {
            try {
              await api.post('/classes', {
                code: String(code),
                level: String(row['Tingkat']),
                rombel: String(row['Rombel']),
                description: row['Keterangan'] ? String(row['Keterangan']) : ''
              });
              importedCount++;
            } catch (err) {
              // Log the full error for debugging
              console.error('Error importing class:', {
                code,
                level: row['Tingkat'],
                rombel: row['Rombel'],
                error: err.response?.data
              });
              skippedCount++;
            }
          }
        }

        let message = `Impor selesai! ${importedCount} kelas berhasil ditambahkan.`;
        if (skippedCount > 0) {
          message += ` ${skippedCount} kelas dilewati (mungkin duplikat).`;
        }
        toast.success(message, { id: toastId, duration: 5000 });

        setFile(null);
        getClasses();
      } catch (error) {
        console.error("Error importing classes: ", error);
        toast.error(`Gagal mengimpor data: ${error.message}`, { id: toastId });
      }
    };

    reader.onerror = (error) => {
      console.error("FileReader error: ", error);
      toast.error('Gagal membaca file. Pastikan file adalah Excel yang valid.', { id: toastId });
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/template_data_kelas.xlsx';
    link.download = 'template_data_kelas.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <>
      <div className="space-y-6">
        {/* Add Class Form - Only for Admin */}
        {isAdmin && (
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
            <h3 className="text-lg font-bold mb-4 text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Plus size={20} /> Tambah Data Kelas Baru
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StyledInput type="text" placeholder="Kode Kelas" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
              <StyledInput type="text" placeholder="Tingkat (e.g., X, XI)" value={newLevel} onChange={(e) => setNewLevel(e.target.value)} />
              <StyledInput type="text" placeholder="Rombel (e.g., A, B, 1)" value={newRombel} onChange={(e) => setNewRombel(e.target.value)} />
              <StyledInput type="text" placeholder="Keterangan (Opsional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
              <select 
                value={newUserId} 
                onChange={(e) => setNewUserId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/20 border-2 border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-black/40 transition-all outline-none text-sm font-medium"
              >
                <option value="">-- Pilih Wali Kelas --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.auth_user_id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end">
              <StyledButton onClick={addClass}><Plus className="mr-2" size={16} />Tambah Data Kelas</StyledButton>
            </div>
          </div>
        )}

        {/* Import/Export Section - Only for Admin */}
        {isAdmin && (
          <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
            <h3 className="text-lg font-bold mb-4 text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Upload size={20} /> Impor/Ekspor Data Kelas
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <StyledInput type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="flex-1" />
              <div className="flex gap-2">
                <StyledButton onClick={importClasses} variant="secondary"><Upload className="mr-2" size={16} />Impor</StyledButton>
                <StyledButton onClick={downloadTemplate} variant="outline"><Download className="mr-2" size={16} />Unduh Template</StyledButton>
              </div>
            </div>
          </div>
        )}

        {/* Class List Table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
              <Users size={20} className="text-purple-600 dark:text-purple-400" /> 
              {isAdmin ? 'Daftar Semua Kelas' : 'Kelas Yang Diampu'}
            </h3>
            <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-3 py-1 rounded-full">{classes.length} Kelas</span>
          </div>

          {classes.length === 0 ? (
            <div className="text-center p-12 bg-gray-50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-text-muted-light dark:text-text-muted-dark font-medium italic">
                {isAdmin ? 'Tidak ada data kelas yang tersedia.' : 'Anda belum mengampu kelas apapun berdasarkan jadwal.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-[500px] overflow-y-auto p-2 scrollbar-hide">
              {classes.map((classItem) => (
                <ClassCard
                  key={classItem.id}
                  classItem={{ ...classItem, onAgreement: handleOpenAgreementModal }}
                  onEdit={isAdmin ? handleOpenEditModal : null}
                  onDelete={isAdmin ? deleteClass : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <Modal onClose={() => setIsEditModalOpen(false)}>
          <h3 className="text-lg font-semibold mb-4">Edit Data Kelas</h3>
          <form onSubmit={handleUpdateClass} className="space-y-4">
            <StyledInput
              type="text"
              placeholder="Kode Kelas"
              value={editData.code || ''}
              onChange={(e) => setEditData({ ...editData, code: e.target.value })}
            />
            <StyledInput
              type="text"
              placeholder="Tingkat"
              value={editData.level || ''}
              onChange={(e) => setEditData({ ...editData, level: e.target.value })}
            />
            <StyledInput
              type="text"
              placeholder="Rombel"
              value={editData.rombel || ''}
              onChange={(e) => setEditData({ ...editData, rombel: e.target.value })}
            />
            <StyledInput
              type="text"
              placeholder="Keterangan"
              value={editData.description || ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            />
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1 uppercase">Wali Kelas</label>
              <select 
                value={editData.user_id || ''} 
                onChange={(e) => setEditData({ ...editData, user_id: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/20 border-2 border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-black/40 transition-all outline-none text-sm font-medium"
              >
                <option value="">-- Pilih Wali Kelas --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.auth_user_id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <StyledButton type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</StyledButton>
              <StyledButton type="submit">Simpan Perubahan</StyledButton>
            </div>
          </form>
        </Modal>
      )}
      {/* Confirm Modal */}
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

      {/* Class Agreement Modal */}
      <ClassAgreementModal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        classId={currentClass?.id}
        rombel={currentClass?.rombel}
        level={currentClass?.level}
      />
    </>
  );
}
