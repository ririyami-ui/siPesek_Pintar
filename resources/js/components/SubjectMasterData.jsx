import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';
import { Plus, Trash2, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import bskapData from '../utils/bskap_2025_intel.json';
import { useSettings } from '../utils/SettingsContext';

export default function SubjectMasterData() {
  const { userProfile } = useSettings();
  const [user, setUser] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editedSubjectCode, setEditedSubjectCode] = useState('');
  const [editedSubjectName, setEditedSubjectName] = useState('');
  const [selectedSchoolLevel, setSelectedSchoolLevel] = useState(userProfile?.schoolLevel || 'SD');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [editedRegion, setEditedRegion] = useState('');
  const [customSubjectText, setCustomSubjectText] = useState('');
  const [editedCustomSubjectText, setEditedCustomSubjectText] = useState('');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (userProfile?.schoolLevel && !editingSubjectId) {
      setSelectedSchoolLevel(userProfile.schoolLevel);
    }
  }, [userProfile?.schoolLevel, editingSubjectId]);

  const fetchSubjects = async () => {
    try {
      const [subjectRes, userRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/me')
      ]);
      const subjectData = subjectRes.data.data || subjectRes.data || [];
      const userData = userRes.data;
      setUser(userData);

      setSubjects(subjectData);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Gagal memuat mata pelajaran.');
    }
  };

  const saveSubject = async () => {
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      toast.error('Kode dan Nama mata pelajaran wajib diisi.');
      return;
    }

    if (editingSubjectId) {
      // Update existing subject
      let baseFinalName = editedSubjectName === 'Lainnya' ? editedCustomSubjectText : editedSubjectName;
      if (editedSubjectCode.trim() && baseFinalName.trim()) {
        let finalName = baseFinalName.trim();
        if (editedSubjectName === 'Bahasa Daerah' && editedRegion) {
          finalName = `Bahasa Daerah (${editedRegion})`;
        }

        const isDuplicate = subjects.some(s => s.name.trim().toLowerCase() === finalName.toLowerCase() && s.id !== editingSubjectId);
        if (isDuplicate) {
          toast.error(`Mata pelajaran "${finalName}" sudah ada.`);
          return;
        }

        try {
          await api.put(`/subjects/${editingSubjectId}`, {
            code: editedSubjectCode.trim(),
            name: finalName,
            school_level: selectedSchoolLevel
          });
          toast.success('Mata pelajaran berhasil diperbarui!');
          setEditingSubjectId(null);
          setEditedSubjectCode('');
          setEditedSubjectName('');
          setEditedRegion('');
          setEditedCustomSubjectText('');
          fetchSubjects();
        } catch (error) {
          toast.error('Gagal memperbarui mata pelajaran.');
        }
      } else {
        toast.error('Kode dan Nama mata pelajaran wajib diisi.');
      }
    } else {
      // Add new subject
      let baseFinalName = newSubjectName === 'Lainnya' ? customSubjectText : newSubjectName;
      if (newSubjectCode.trim() && baseFinalName.trim()) {
        let finalName = baseFinalName.trim();
        if (newSubjectName === 'Bahasa Daerah' && selectedRegion) {
          finalName = `Bahasa Daerah (${selectedRegion})`;
        }

        const isDuplicate = subjects.some(s => s.name.trim().toLowerCase() === finalName.toLowerCase());
        if (isDuplicate) {
          toast.error(`Mata pelajaran "${finalName}" sudah ada.`);
          return;
        }

        try {
          await api.post('/subjects', {
            code: newSubjectCode.trim(),
            name: finalName,
            school_level: selectedSchoolLevel
          });
          toast.success('Mata pelajaran berhasil ditambahkan!');
          setNewSubjectCode('');
          setNewSubjectName('');
          setCustomSubjectText('');
          setSelectedRegion('');
          fetchSubjects();
        } catch (error) {
          toast.error('Gagal menambahkan mata pelajaran.');
        }
      } else {
        toast.error('Please enter both subject code and name.');
      }
    }
  };

  const deleteSubject = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Mata Pelajaran',
      message: 'Apakah Anda yakin ingin menghapus mata pelajaran ini? Data terkait (seperti rencana pembelajaran) mungkin akan terpengaruh.',
      onConfirm: async () => {
        try {
          await api.delete(`/subjects/${id}`);
          toast.success('Mata pelajaran berhasil dihapus!');
          fetchSubjects();
        } catch (error) {
          toast.error('Gagal menghapus mata pelajaran.');
          console.error("Error deleting subject: ", error);
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const startEditing = (subject) => {
    setEditingSubjectId(subject.id);
    setEditedSubjectCode(subject.code);

    // Parse Bahasa Daerah (Region)
    if (subject.name.startsWith('Bahasa Daerah (')) {
      const region = subject.name.match(/\(([^)]+)\)/)?.[1];
      setEditedSubjectName('Bahasa Daerah');
      setEditedRegion(region || '');
      setEditedCustomSubjectText('');
    } else {
      let level = subject.school_level || selectedSchoolLevel;
      if (level === 'SMK') level = 'SMA';
      const levelData = bskapData.subjects[level];
      const isInBskap = levelData && Object.values(levelData).some(grade => Object.keys(grade).includes(subject.name));
      
      if (isInBskap || subject.name === 'Bahasa Daerah') {
        setEditedSubjectName(subject.name);
        setEditedRegion('');
        setEditedCustomSubjectText('');
      } else {
        setEditedSubjectName('Lainnya');
        setEditedRegion('');
        setEditedCustomSubjectText(subject.name);
      }
    }

    if (subject.school_level) {
      setSelectedSchoolLevel(subject.school_level);
    }
  };

  const cancelEditing = () => {
    setEditingSubjectId(null);
    setEditedSubjectCode('');
    setEditedSubjectName('');
    setEditedCustomSubjectText('');
  };

  const tableHeaders = ['Jenjang', 'Kode', 'Nama', 'Aksi'];

  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
        <h3 className="text-lg font-bold mb-4 text-purple-600 dark:text-purple-400">
          {editingSubjectId ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
        </h3>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jenjang Sekolah</label>
          <select
            value={selectedSchoolLevel}
            onChange={(e) => setSelectedSchoolLevel(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white"
          >
            {['SD', 'SMP', 'SMA', 'SMK'].map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full">
            <StyledInput
              type="text"
              label="Kode Mata Pelajaran"
              placeholder="Contoh: MAT, IPA"
              value={editingSubjectId ? editedSubjectCode : newSubjectCode}
              onChange={(e) => (editingSubjectId ? setEditedSubjectCode(e.target.value) : setNewSubjectCode(e.target.value))}
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 mb-1.5">Nama Mata Pelajaran</label>
            <div className="flex flex-col gap-2">
              <select
                value={editingSubjectId ? editedSubjectName : newSubjectName}
                onChange={(e) => (editingSubjectId ? setEditedSubjectName(e.target.value) : setNewSubjectName(e.target.value))}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all dark:text-white"
              >
                <option value="">Pilih Mata Pelajaran</option>
                <option value="Lainnya" className="font-bold text-purple-600 bg-purple-50">++ Lainnya (Muatan Lokal) ++</option>
                {(() => {
                  const level = selectedSchoolLevel === 'SMK' ? 'SMA' : selectedSchoolLevel;
                  const levelData = bskapData.subjects[level];
                  const subjectsList = levelData
                    ? [...new Set(Object.values(levelData).flatMap(grade => Object.keys(grade)))].sort()
                    : [];
                  return subjectsList.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ));
                })()}
                {editingSubjectId && editedSubjectName && editedSubjectName !== 'Lainnya' &&
                  (!bskapData.subjects[selectedSchoolLevel === 'SMK' ? 'SMA' : selectedSchoolLevel] ||
                    !Object.values(bskapData.subjects[selectedSchoolLevel === 'SMK' ? 'SMA' : selectedSchoolLevel])
                      .some(grade => Object.keys(grade).includes(editedSubjectName))) && (
                    <option value={editedSubjectName}>{editedSubjectName}</option>
                  )}
              </select>

              {(editingSubjectId ? editedSubjectName === 'Lainnya' : newSubjectName === 'Lainnya') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <input
                    type="text"
                    placeholder="Ketik Mapel Custom (Contoh: BTQ, Pendidikan Aswaja, dll)"
                    value={editingSubjectId ? editedCustomSubjectText : customSubjectText}
                    onChange={(e) => (editingSubjectId ? setEditedCustomSubjectText(e.target.value) : setCustomSubjectText(e.target.value))}
                    className="w-full px-4 py-2 bg-purple-50 dark:bg-purple-900/10 border-2 border-purple-200 dark:border-purple-800/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white text-sm font-medium"
                  />
                </div>
              )}

              {(editingSubjectId ? editedSubjectName === 'Bahasa Daerah' : newSubjectName === 'Bahasa Daerah') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <select
                    value={editingSubjectId ? editedRegion : selectedRegion}
                    onChange={(e) => (editingSubjectId ? setEditedRegion(e.target.value) : setSelectedRegion(e.target.value))}
                    className="w-full px-4 py-2 bg-purple-50 dark:bg-purple-900/10 border-2 border-purple-200 dark:border-purple-800/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white text-sm font-medium"
                  >
                    <option value="">-- Pilih Daerah --</option>
                    {bskapData.standards.regional_languages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
          <StyledButton onClick={saveSubject} className="mb-0.5 h-[42px]">
            {editingSubjectId ? 'Perbarui' : 'Tambah'}
          </StyledButton>
          {editingSubjectId && (
            <StyledButton onClick={cancelEditing} variant="secondary" className="mb-0.5 h-[42px]">
              Batal
            </StyledButton>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark">Daftar Mata Pelajaran</h3>
          <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-3 py-1 rounded-full">{subjects.length} Mapel</span>
        </div>
        
        {subjects.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <p className="text-text-muted-light dark:text-text-muted-dark font-medium italic">Tidak ada mata pelajaran yang tersedia.</p>
          </div>
        ) : (
          <StyledTable headers={tableHeaders}>
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark">{subject.school_level || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600 dark:text-purple-400">{subject.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark font-medium">{subject.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <StyledButton onClick={() => startEditing(subject)} variant="primary" size="sm" className="!p-2"><Edit size={16} /></StyledButton>
                    <StyledButton onClick={() => deleteSubject(subject.id)} variant="danger" size="sm" className="!p-2"><Trash2 size={16} /></StyledButton>
                  </div>
                </td>
              </tr>
            ))}
          </StyledTable>
        )}
      </div>
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
