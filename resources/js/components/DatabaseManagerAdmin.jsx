import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2, Download, Upload, AlertTriangle, Database, RefreshCw, Zap } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledButton from './StyledButton';
import Modal from './Modal';

const DatabaseManagerAdmin = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [confirmationText, setConfirmationText] = useState('');
  const [password, setPassword] = useState('');
  const restoreInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    requiresInput: false,
    confirmPhrase: 'HAPUS'
  });

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/database/tables');
      setTables(response.data.data || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error('Gagal memuat daftar tabel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const handleBackup = async () => {
    try {
      toast.loading('Menyiapkan backup...', { id: 'backup-loading' });
      const response = await api.get('/admin/database/backup', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = `backup-smart-school-${new Date().toISOString().split('T')[0]}.sql`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Backup database berhasil diunduh!', { id: 'backup-loading' });
    } catch (error) {
      console.error('Error backing up database:', error);
      toast.error('Gagal melakukan backup database.', { id: 'backup-loading' });
    }
  };

  const handleRestoreClick = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setConfirmationText('');
    setPassword('');
    setConfirmModal({
      isOpen: true,
      title: 'Pulihkan Database (SQL)',
      message: 'PERHATIAN: Memulihkan database akan mengganti data yang ada dengan data dari file cadangan. Pastikan file backup valid.',
      requiresInput: true,
      requiresPassword: true,
      confirmPhrase: 'PULIHKAN',
      onConfirm: async (currentPassword) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performRestore(file, currentPassword);
      }
    });
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const performRestore = async (file, currentPassword) => {
    const formData = new FormData();
    formData.append('backup_file', file);
    formData.append('password', currentPassword);

    toast.loading('Memulihkan database...', { id: 'restore-loading' });
    try {
      await api.post('/admin/database/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Database berhasil dipulihkan!', { id: 'restore-loading' });
      fetchTables();
    } catch (error) {
      console.error('Error restoring database:', error);
      toast.error(error.response?.data?.message || 'Gagal memulihkan database.', { id: 'restore-loading' });
    }
  };

  const handleTruncateTable = (table) => {
    setConfirmationText('');
    setPassword('');
    setConfirmModal({
      isOpen: true,
      title: `Kosongkan Tabel: ${table.label}`,
      message: `Tindakan ini akan menghapus SELURUH data (${table.count} baris) dalam tabel '${table.label}'. Data yang dihapus tidak dapat dikembalikan.`,
      requiresInput: true,
      requiresPassword: true,
      confirmPhrase: 'KOSONGKAN',
      onConfirm: async (currentPassword) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performTruncate(table.name, currentPassword);
      }
    });
  };

  const performTruncate = async (tableName, currentPassword) => {
    setActionLoading(prev => ({ ...prev, [tableName]: true }));
    try {
      await api.post('/admin/database/truncate', { 
        table: tableName,
        password: currentPassword
      });
      toast.success(`Tabel ${tableName} berhasil dikosongkan.`);
      fetchTables();
    } catch (error) {
      console.error(`Error truncating table ${tableName}:`, error);
      toast.error(error.response?.data?.message || `Gagal mengosongkan tabel ${tableName}.`);
    } finally {
      setActionLoading(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleWipeData = () => {
    setConfirmationText('');
    setPassword('');
    setConfirmModal({
      isOpen: true,
      title: 'DANGER: Reset Total Database',
      message: 'Anda akan menghapus SELURUH data aplikasi (Siswa, Jadwal, Nilai, dll). Akun admin tetap aman. Ketik "RESET TOTAL" untuk melanjutkan.',
      requiresInput: true,
      requiresPassword: true,
      confirmPhrase: 'RESET TOTAL',
      onConfirm: async (currentPassword) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performWipe(currentPassword);
      }
    });
  };

  const performWipe = async (currentPassword) => {
    setLoading(true);
    try {
      await api.post('/admin/database/wipe', {
        password: currentPassword
      });
      toast.success('Seluruh data aplikasi berhasil dihapus.');
      fetchTables();
    } catch (error) {
      console.error('Error wiping database:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus seluruh data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 dark:bg-black/20 p-6 rounded-[2rem] border border-white/40 dark:border-gray-800/40">
        <div>
          <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
            <Database className="text-blue-600" size={24} />
            Manajemen Basis Data (SQL)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Cadangkan, kosongkan, atau reset data aplikasi Anda secara aman.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <button 
            onClick={handleBackup} 
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all duration-300 active:scale-95 group"
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
              <Download size={20} />
            </div>
            <span className="tracking-tight">Backup Database (SQL)</span>
          </button>

          <button 
            onClick={() => restoreInputRef.current.click()} 
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 active:scale-95 group"
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
              <Upload size={20} />
            </div>
            <span className="tracking-tight">Restore Database (SQL)</span>
          </button>
          <input type="file" accept=".sql" className="hidden" ref={restoreInputRef} onChange={handleRestoreClick} />

          <button 
            onClick={handleWipeData} 
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-br from-rose-500 to-pink-600 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 hover:shadow-rose-500/40 hover:-translate-y-1 transition-all duration-300 active:scale-95 group"
          >
            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
              <Trash2 size={20} />
            </div>
            <span className="tracking-tight">Reset Total Data</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {loading && tables.length === 0 ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <div key={table.name} className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 flex flex-col hover:border-blue-300 dark:hover:border-blue-800 transition-all group relative overflow-hidden">
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Database size={20} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-800 dark:text-white leading-none">{table.count}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Data</p>
                </div>
              </div>

              <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 relative z-10">{table.label}</h4>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-6 font-mono opacity-60">Table: {table.name}</p>

              <button
                onClick={() => handleTruncateTable(table)}
                className="mt-auto w-full py-3 px-4 rounded-xl border-2 border-rose-50 dark:border-rose-900/20 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all active:scale-95 disabled:opacity-50 relative z-10 text-sm"
                disabled={actionLoading[table.name]}
              >
                {actionLoading[table.name] ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                {actionLoading[table.name] ? 'Memproses...' : 'Kosongkan'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="text-center p-6">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-rose-50 dark:bg-rose-900/20 mb-6">
              <AlertTriangle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
            </div>

            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 uppercase">{confirmModal.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed">
              {confirmModal.message}
            </p>

            {confirmModal.requiresInput && (
              <div className="mb-6">
                <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-3 text-left">1. Ketik Kalimat Konfirmasi:</p>
                <input
                  type="text"
                  placeholder={`Ketik: ${confirmModal.confirmPhrase}`}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-rose-100 dark:border-rose-900/20 bg-gray-50 dark:bg-gray-900/50 focus:border-rose-500 outline-none text-center font-black tracking-widest text-lg text-rose-600 uppercase transition-all"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {confirmModal.requiresPassword && (
              <div className="mb-8 text-left">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">2. Masukkan Password Akun Anda:</p>
                <input
                  type="password"
                  placeholder="Password Admin"
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none font-medium transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 transition-all flex-1"
              >
                Batal
              </button>
              <button
                onClick={() => confirmModal.onConfirm(password)}
                disabled={
                  (confirmModal.requiresInput && confirmationText.trim().toUpperCase() !== confirmModal.confirmPhrase) ||
                  (confirmModal.requiresPassword && !password)
                }
                className="px-6 py-3 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-200 dark:shadow-none transition-all flex-1 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DatabaseManagerAdmin;
