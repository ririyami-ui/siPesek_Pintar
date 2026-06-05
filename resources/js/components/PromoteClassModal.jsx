import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import StyledButton from './StyledButton';
import StyledSelect from './StyledSelect';
import { ArrowRight, GraduationCap, AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

export default function PromoteClassModal({ isOpen, onClose, classes, students, onSuccess }) {
  const [originClassId, setOriginClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [originStudents, setOriginStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When origin class changes, update students list
  useEffect(() => {
    if (originClassId) {
      const filtered = students.filter(s => s.class_id == originClassId);
      // Sort by absen or name
      filtered.sort((a, b) => {
        const absenA = parseInt(a.absen) || 999;
        const absenB = parseInt(b.absen) || 999;
        return absenA - absenB || a.name.localeCompare(b.name);
      });
      setOriginStudents(filtered);
      setSelectedStudentIds(filtered.map(s => s.id));
    } else {
      setOriginStudents([]);
      setSelectedStudentIds([]);
    }
  }, [originClassId, students]);

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedStudentIds.length === originStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(originStudents.map(s => s.id));
    }
  };

  const handleSubmit = async () => {
    if (!originClassId) return toast.error('Pilih Kelas Asal terlebih dahulu.');
    if (!targetClassId) return toast.error('Pilih Kelas Tujuan atau Kelulusan.');
    if (selectedStudentIds.length === 0) return toast.error('Pilih minimal satu siswa untuk diproses.');

    const isGraduating = targetClassId === 'graduate';

    setIsSubmitting(true);
    try {
      const response = await api.post('/admin/students/promote', {
        student_ids: selectedStudentIds,
        target_class_id: isGraduating ? null : targetClassId
      });
      
      toast.success(response.data.message || (isGraduating ? 'Siswa berhasil diluluskan dan diarsipkan.' : 'Siswa berhasil dinaikkan kelas.'));
      
      // Reset form
      setOriginClassId('');
      setTargetClassId('');
      
      onSuccess(); // Refresh student list
      onClose(); // Close modal
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat memproses kenaikan kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isGraduating = targetClassId === 'graduate';

  return (
    <Modal title="Proses Kenaikan Kelas & Kelulusan" onClose={onClose} size="lg">
      <div className="space-y-6">
        
        {/* Warning Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-bold mb-1">Perhatian!</p>
            <p>Fitur ini digunakan untuk memindahkan siswa secara massal ke kelas baru. Jika Anda memilih "Lulus", data siswa akan diarsipkan (Soft Delete) dan akun login mereka akan dinonaktifkan secara permanen.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end relative">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pilih Kelas Asal</label>
            <StyledSelect value={originClassId} onChange={(e) => setOriginClassId(e.target.value)}>
              <option value="">-- Pilih Kelas Saat Ini --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.rombel}</option>)}
            </StyledSelect>
          </div>

          <div className="hidden md:flex justify-center absolute left-1/2 -translate-x-1/2 bottom-2">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400 dark:text-gray-500">
              <ArrowRight size={20} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pilih Kelas Tujuan</label>
            <StyledSelect value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)}>
              <option value="">-- Pilih Kelas Berikutnya --</option>
              <optgroup label="Kelulusan">
                <option value="graduate">🎓 LULUS / ARSIPKAN SISWA</option>
              </optgroup>
              <optgroup label="Naik Kelas Ke">
                {classes.filter(c => c.id != originClassId).map(c => (
                  <option key={c.id} value={c.id}>{c.rombel}</option>
                ))}
              </optgroup>
            </StyledSelect>
          </div>
        </div>

        {originClassId && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-300">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <span className="font-bold text-sm text-gray-700 dark:text-gray-200">Daftar Siswa Kelas Asal</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-1 rounded-full shadow-sm">
                <span className="font-bold text-primary">{selectedStudentIds.length}</span> dari {originStudents.length} terpilih
              </div>
            </div>
            
            <div className="max-h-[300px] overflow-y-auto bg-white dark:bg-black/20 custom-scrollbar">
              {originStudents.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">Tidak ada siswa aktif di kelas ini.</p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/30 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedStudentIds.length === originStudents.length && originStudents.length > 0} 
                          onChange={toggleAll}
                          className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer border-gray-300"
                        />
                      </th>
                      <th className="p-3">No</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {originStudents.map((s, idx) => {
                      const isSelected = selectedStudentIds.includes(s.id);
                      return (
                        <tr 
                          key={s.id} 
                          className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 hover:bg-primary/5 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''}`} 
                          onClick={() => toggleStudent(s.id)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => toggleStudent(s.id)}
                              className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer border-gray-300"
                            />
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 font-medium">{s.absen || idx + 1}</td>
                          <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{s.name}</td>
                          <td className="p-3 text-right">
                            {isSelected ? (
                              <span className={`inline-block text-[10px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider ${isGraduating ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                                {isGraduating ? 'Akan Lulus' : 'Naik Kelas'}
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-extrabold px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 uppercase tracking-wider">
                                Tinggal Kelas
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              💡 <strong>Tips:</strong> Hilangkan centang pada nama siswa yang <strong>tinggal kelas</strong> agar mereka tetap berada di kelas asal.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <StyledButton variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</StyledButton>
          <StyledButton 
            onClick={handleSubmit} 
            disabled={isSubmitting || !originClassId || !targetClassId || selectedStudentIds.length === 0}
            className={isGraduating ? "!bg-emerald-600 hover:!bg-emerald-700 !shadow-emerald-200 dark:!shadow-none" : "shadow-lg shadow-primary/30"}
          >
            {isSubmitting ? 'Memproses...' : (isGraduating ? '🎓 Luluskan Siswa Terpilih' : '🚀 Proses Kenaikan Kelas')}
          </StyledButton>
        </div>
      </div>
    </Modal>
  );
}
