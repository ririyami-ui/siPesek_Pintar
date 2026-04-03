import React, { useState, useRef } from 'react';
import { collection, getDocs, writeBatch, query, limit, where, doc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Trash2, Upload, Download, AlertTriangle, Database, RefreshCw, Users, BookOpen, Calendar, ClipboardList, FileText, ShieldAlert, BadgeCheck, Sparkles, Zap, History, Layout, FileUp } from 'lucide-react';
import StyledButton from './StyledButton';
import Modal from './Modal';
import { generateCleanupReport, executeAutoCleanup } from '../utils/databaseCleaner';
import toast from 'react-hot-toast';

const DatabaseManager = () => {
  const [status, setStatus] = useState({}); // { collectionId: "Deleting..." }
  const [backupStatus, setBackupStatus] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [cleanupReport, setCleanupReport] = useState(null);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const restoreInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    requiresInput: false,
    confirmPhrase: 'HAPUS'
  });

  // List of collections to manage with labels and icons
  const collectionsToManage = [
    { id: 'students', label: 'Data Siswa', icon: <Users size={20} /> },
    { id: 'teachingSchedules', label: 'Jadwal Mengajar', icon: <Calendar size={20} /> },
    { id: 'subjects', label: 'Mata Pelajaran', icon: <BookOpen size={20} /> },
    { id: 'classes', label: 'Data Kelas', icon: <Database size={20} /> },
    { id: 'attendance', label: 'Presensi Siswa', icon: <BadgeCheck size={20} /> },
    { id: 'teachingJournals', label: 'Jurnal Mengajar', icon: <ClipboardList size={20} /> },
    { id: 'grades', label: 'Data Nilai', icon: <FileText size={20} /> },
    { id: 'lessonPlans', label: 'Riwayat RPP AI', icon: <Sparkles size={20} /> },
    { id: 'infractions', label: 'Pelanggaran Siswa', icon: <ShieldAlert size={20} /> },
    { id: 'holidays', label: 'Agenda & Libur', icon: <Calendar size={20} /> },
    { id: 'teachingPrograms', label: 'Program Mengajar', icon: <BookOpen size={20} /> },
    { id: 'kktpAssessments', label: 'Penilaian KKTP Digital', icon: <ClipboardList size={20} /> },
    { id: 'studentTasks', label: 'Penugasan Siswa', icon: <Layout size={20} /> },
    { id: 'class_agreements', label: 'Kesepakatan Kelas', icon: <FileText size={20} /> },
    { id: 'handouts', label: 'Bahan Ajar (Handout)', icon: <History size={20} /> },
    { id: 'lkpd_history', label: 'Riwayat LKPD', icon: <FileUp size={20} /> },
  ];

  // Helper to recursively restore Firestore Timestamps from JSON
  const convertTimestamps = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;

    // Check if it's a serialized Firestore Timestamp
    // JSON restoration sometimes results in objects with seconds/nanoseconds
    if (
      obj.seconds !== undefined &&
      obj.nanoseconds !== undefined
    ) {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }

    if (Array.isArray(obj)) {
      return obj.map(convertTimestamps);
    }

    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = convertTimestamps(obj[key]);
      }
    }
    return newObj;
  };

  const [confirmationText, setConfirmationText] = useState('');

  // Cleanup functions
  const handleGenerateCleanupReport = async () => {
    if (!auth.currentUser) return;

    setLoadingCleanup(true);
    try {
      const report = await generateCleanupReport(auth.currentUser.uid);
      setCleanupReport(report);
      toast.success('Laporan analisis database berhasil dibuat.');
    } catch (error) {
      console.error('Error generating cleanup report:', error);
      toast.error('Gagal membuat laporan: ' + error.message);
    } finally {
      setLoadingCleanup(false);
    }
  };

  const handleSmartCleanup = async () => {
    if (!cleanupReport) {
      toast.error('Silakan generate report terlebih dahulu');
      return;
    }

    setConfirmationText('');
    setConfirmModal({
      isOpen: true,
      title: 'Bersihkan Sampah Database',
      message: `Sistem akan menghapus:\n- ${Object.values(cleanupReport.duplicates).reduce((sum, d) => sum + (d.duplicates || 0), 0)} duplikat\n- ${cleanupReport.brokenReferences?.brokenClasses.length || 0} + ${cleanupReport.brokenReferences?.brokenSubjects.length || 0} referensi rusak\n\nKetik "BERSIHKAN" untuk konfirmasi.`,
      requiresInput: true,
      confirmPhrase: 'BERSIHKAN',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performSmartCleanup();
      }
    });
  };

  const performSmartCleanup = async () => {
    if (!auth.currentUser) return;

    setCleaningUp(true);
    try {
      const results = await executeAutoCleanup(auth.currentUser.uid, {
        removeDuplicates: true,
        removeOldData: false,
        fixBrokenReferences: true
      });

      toast.success(`Pembersihan selesai! Duplikat dihapus: ${results.duplicatesRemoved}, Referensi diperbaiki: ${results.brokenReferencesFixed}`);

      // Refresh report
      await handleGenerateCleanupReport();
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast.error('Gagal membersihkan database: ' + error.message);
    } finally {
      setCleaningUp(false);
    }
  };

  const handleDeleteCollection = (collection) => {
    setConfirmationText('');
    setConfirmModal({
      isOpen: true,
      title: `Hapus Data: ${collection.label}`,
      message: `Tindakan ini akan menghapus SELURUH data dalam koleksi '${collection.label}'. Ketik 'HAPUS' di bawah ini untuk mengonfirmasi.`,
      requiresInput: true,
      confirmPhrase: 'HAPUS',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performDeleteCollection(collection.id);
      }
    });
  };

  const handleWipeData = () => {
    setConfirmationText('');
    setConfirmModal({
      isOpen: true,
      title: 'DANGER: Wipe All Data',
      message: 'Anda akan menghapus SELURUH data aplikasi (Siswa, Jadwal, RPP, Jurnal, Nilai, dll). Profil pengguna akan tetap aman. Ketik "RESET TOTAL" untuk melanjutkan.',
      requiresInput: true,
      confirmPhrase: 'RESET TOTAL',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        for (const col of collectionsToManage) {
          await performDeleteCollection(col.id);
        }
      }
    });
  };

  const performDeleteCollection = async (collectionId) => {
    if (!auth.currentUser) {
      setStatus(prev => ({ ...prev, [collectionId]: 'Error: User not authenticated.' }));
      return;
    }

    setStatus(prev => ({ ...prev, [collectionId]: 'Deleting...' }));
    const collectionRef = collection(db, collectionId);
    let deletedCount = 0;
    const userId = auth.currentUser.uid;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const q = query(collectionRef, where('userId', '==', userId), limit(500));
        const snapshot = await getDocs(q);

        if (snapshot.size === 0) {
          break;
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        deletedCount += snapshot.size;
        setStatus(prev => ({ ...prev, [collectionId]: `Deleted ${deletedCount} documents...` }));

        if (snapshot.size < 500) {
          break;
        }
      }
      setStatus(prev => ({ ...prev, [collectionId]: `Selesai: ${deletedCount} data dihapus.` }));
    } catch (error) {
      console.error(`Error deleting documents from ${collectionId}:`, error);
      setStatus(prev => ({ ...prev, [collectionId]: `Gagal: ${error.message}` }));
    }
  };

  const handleBackup = async () => {
    if (!auth.currentUser) {
      setBackupStatus('Error: User not authenticated.');
      return;
    }

    setBackupStatus('Backing up...');
    const backupData = {};
    const userId = auth.currentUser.uid;

    try {
      for (const col of collectionsToManage) {
        const q = query(collection(db, col.id), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        backupData[col.id] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-teaching-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setBackupStatus('Backup berhasil diunduh!');
    } catch (error) {
      console.error('Error backing up data:', error);
      setBackupStatus(`Gagal: ${error.message}`);
    }
  };

  const handleRestore = async (event) => {
    if (!auth.currentUser) {
      setRestoreStatus('Error: User not authenticated.');
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    setConfirmModal({
      isOpen: true,
      title: 'Pulihkan Data (Restore)',
      message: 'PULIHKAN: Data saat ini akan digabung dengan data dari file cadangan. Pastikan file valid.',
      requiresInput: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await performRestore(file);
      }
    });
  };

  const performRestore = async (file) => {
    setRestoreStatus('Memulai pemulihan...');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        let restoredCount = 0;
        const idMap = {}; // { collectionId: { oldId: newId } }

        // Define tiers to respect dependencies
        const tiers = [
          ['classes', 'subjects', 'holidays', 'teachingPrograms', 'lessonPlans', 'quizzes'],
          ['students', 'teachingSchedules', 'handouts', 'lkpd_history'],
          ['attendance', 'teachingJournals', 'kktpAssessments', 'infractions', 'studentTasks', 'class_agreements'],
          ['grades']
        ];

        const refFieldMap = {
          classId: 'classes',
          subjectId: 'subjects',
          studentId: 'students',
          kktpAssessmentId: 'kktpAssessments',
          rppId: 'lessonPlans',
          teachingProgramId: 'teachingPrograms'
        };

        for (const tier of tiers) {
          for (const collectionId of tier) {
            if (!backupData[collectionId] || backupData[collectionId].length === 0) continue;

            const collectionData = backupData[collectionId];
            idMap[collectionId] = idMap[collectionId] || {};

            // Firebase limits batch to 500 operations
            for (let i = 0; i < collectionData.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = collectionData.slice(i, i + 500);

              chunk.forEach(docData => {
                const { id: oldId, ...rawData } = docData;

                // CRITICAL: Convert plain objects back to Timestamps
                const data = convertTimestamps(rawData);

                // 1. Update ownership
                data.userId = auth.currentUser.uid;

                // 2. Update references from previous tiers
                Object.keys(refFieldMap).forEach(field => {
                  const targetCollection = refFieldMap[field];
                  if (data[field] && idMap[targetCollection] && idMap[targetCollection][data[field]]) {
                    const oldVal = data[field];
                    data[field] = idMap[targetCollection][oldVal];

                    // Legacy support: update .class property if it was a string
                    if (field === 'classId' && (typeof data.class === 'string')) {
                      // We keep class name as is, but logic usually prefers classId
                    }
                  }
                });

                // 3. Determine New ID (Collision Prevention)
                let targetId;

                // Case A: teachingPrograms (UID-prefixed)
                if (collectionId === 'teachingPrograms') {
                  const subjectPart = oldId.includes('_') ? oldId.split('_').slice(1).join('_') : oldId;
                  targetId = `${auth.currentUser.uid}_${subjectPart}`;
                }
                // Case B: attendance (Composite key)
                else if (collectionId === 'attendance' && data.date && data.classId && data.studentId) {
                  targetId = `${data.date}-${data.classId}-${data.studentId}`;
                }
                // Case C: Standard (Generate new random ID to avoid cross-account collisions)
                else {
                  // We ALWAYS generate a new ID for cross-account safety in shared project
                  const newDocRef = doc(collection(db, collectionId));
                  targetId = newDocRef.id;
                }

                idMap[collectionId][oldId] = targetId;

                try {
                  const docRef = doc(db, collectionId, targetId);
                  batch.set(docRef, data, { merge: true });
                } catch (innerError) {
                  console.error(`Error adding to batch: ${collectionId}/${targetId}:`, innerError);
                  throw innerError;
                }
              });

              try {
                console.log(`Committing tier batch for ${collectionId} (${i} to ${Math.min(i + 500, collectionData.length)})...`);
                await batch.commit();
                restoredCount += chunk.length;
                setRestoreStatus(`Memulihkan ${collectionId}... (${restoredCount} data)`);
              } catch (commitError) {
                console.error(`FAILED to commit batch for ${collectionId}:`, commitError);
                throw commitError;
              }
            }
          }
        }

        setRestoreStatus('Pemulihan berhasil dilakukan!');
        toast.success('Data berhasil dipulihkan dengan ID baru.');
      } catch (error) {
        console.error('Error restoring data:', error);
        setRestoreStatus(`Gagal: ${error.message}`);
        toast.error('Gagal memulihkan data: ' + error.message);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b dark:border-gray-700 pb-8">
        <div>
          <h3 className="text-3xl font-extrabold text-blue-800 dark:text-blue-100 flex items-center gap-3">
            <Database className="text-blue-600 w-8 h-8" />
            Pusat Pengelolaan Data
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
            Kelola, cadangkan, dan bersihkan basis data aplikasi Anda.
          </p>
        </div>
        <button
          onClick={handleWipeData}
          className="px-6 py-3 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-bold flex items-center gap-2 shadow-sm active:scale-95 group"
        >
          <Trash2 size={20} className="group-hover:rotate-12 transition-transform" />
          Reset Semua Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collectionsToManage.map((col) => (
          <div key={col.id} className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] shadow-xl shadow-gray-100/50 dark:shadow-none border border-gray-100 dark:border-gray-700 flex flex-col hover:border-blue-300 dark:hover:border-blue-800 transition-all group relative overflow-hidden">
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-inner">
                {col.icon}
              </div>
              {status[col.id] && status[col.id] !== 'Deleting...' && (
                <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tighter ${status[col.id].startsWith('Gagal') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {status[col.id].startsWith('Gagal') ? 'Gagal' : 'Berhasil'}
                </div>
              )}
            </div>

            <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1 relative z-10">{col.label}</h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-8 font-mono opacity-60">Source: {col.id}</p>

            <button
              onClick={() => handleDeleteCollection(col)}
              className="mt-auto w-full py-4 px-6 rounded-2xl border-2 border-red-50 dark:border-red-900/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-3 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 disabled:opacity-50 relative z-10"
              disabled={status[col.id] === 'Deleting...'}
            >
              {status[col.id] === 'Deleting...' ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
              {status[col.id] === 'Deleting...' ? 'Memproses...' : 'Kosongkan'}
            </button>

            {status[col.id] && status[col.id] !== 'Deleting...' && (
              <p className="text-xs mt-4 text-center text-gray-500 dark:text-gray-400 italic font-medium px-2">
                {status[col.id]}
              </p>
            )}

            <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          </div>
        ))}
      </div>

      {/* Smart Cleanup Section */}
      <div className="mt-12 p-10 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-[3.5rem] shadow-2xl shadow-amber-200 dark:shadow-none text-white relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-6">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
              <Zap size={28} className="text-white" />
            </div>
            <div>
              <h4 className="text-3xl font-black tracking-tight">Smart Cleanup 🧹</h4>
              <p className="text-amber-100/80 text-lg mt-1 font-medium">Bersihkan duplikat dan referensi rusak secara otomatis</p>
            </div>
          </div>

          {!cleanupReport ? (
            <button
              onClick={handleGenerateCleanupReport}
              disabled={loadingCleanup}
              className="w-full flex items-center justify-center gap-3 py-5 px-8 bg-white text-orange-700 font-black rounded-2xl shadow-xl hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50 text-lg"
            >
              {loadingCleanup ? (
                <>
                  <RefreshCw size={24} className="animate-spin" />
                  Menganalisis Database...
                </>
              ) : (
                <>
                  <Database size={24} />
                  Analisis Database
                </>
              )}
            </button>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Total Dokumen</p>
                  <p className="text-4xl font-black">{cleanupReport.totalDocuments}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Duplikat</p>
                  <p className="text-4xl font-black text-yellow-200">
                    {Object.values(cleanupReport.duplicates).reduce((sum, d) => sum + (d.duplicates || 0), 0)}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                  <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Ref. Rusak</p>
                  <p className="text-4xl font-black text-red-200">
                    {(cleanupReport.brokenReferences?.brokenClasses?.length || 0) + (cleanupReport.brokenReferences?.brokenSubjects?.length || 0)}
                  </p>
                </div>
              </div>
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
                <h5 className="font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Rekomendasi:
                </h5>
                <ul className="space-y-2">
                  {cleanupReport.recommendations.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="text-sm text-white/90 flex items-start gap-2">
                      <span className="text-yellow-300 shrink-0">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleGenerateCleanupReport}
                  disabled={loadingCleanup}
                  className="flex items-center justify-center gap-2 py-4 px-6 bg-white/20 backdrop-blur-md text-white font-bold rounded-2xl border border-white/30 hover:bg-white/30 transition-all active:scale-95"
                >
                  <RefreshCw size={20} className={loadingCleanup ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={handleSmartCleanup}
                  disabled={cleaningUp}
                  className="flex items-center justify-center gap-2 py-4 px-6 bg-white text-orange-700 font-black rounded-2xl shadow-xl hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  {cleaningUp ? (
                    <>
                      <RefreshCw size={20} className="animate-spin" />
                      Membersihkan...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      Bersihkan Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-white/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-80 h-80 bg-black/10 rounded-full blur-[80px] pointer-events-none" />
      </div>

      <div className="mt-12 p-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3.5rem] shadow-2xl shadow-blue-200 dark:shadow-none text-white relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-10">
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
              <RefreshCw size={28} className="text-white" />
            </div>
            <div>
              <h4 className="text-3xl font-black tracking-tight">Migrasi & Backup</h4>
              <p className="text-blue-100/80 text-lg mt-1 font-medium">Cadangkan data Anda ke file lokal agar lebih aman.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={handleBackup}
              disabled={backupStatus === 'Backing up...'}
              className="flex items-center justify-center gap-3 py-5 px-8 bg-white text-blue-700 font-black rounded-2xl shadow-xl hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 text-lg"
            >
              <Download size={24} />
              {backupStatus === 'Backing up...' ? 'Proses...' : 'Unduh Backup (.json)'}
            </button>

            <button
              onClick={() => restoreInputRef.current.click()}
              disabled={restoreStatus === 'Restoring...'}
              className="flex items-center justify-center gap-3 py-5 px-8 bg-blue-500/30 backdrop-blur-md text-white font-black rounded-2xl border-2 border-white/40 shadow-xl hover:bg-blue-400/40 transition-all active:scale-95 disabled:opacity-50 text-lg"
            >
              <Upload size={24} />
              {restoreStatus === 'Restoring...' ? 'Proses...' : 'Unggah File Backup'}
            </button>
            <input id="restore-input" type="file" accept=".json" onChange={handleRestore} className="hidden" ref={restoreInputRef} />
          </div>

          {(backupStatus || restoreStatus) && (backupStatus !== 'Backing up...' && restoreStatus !== 'Restoring...') && (
            <div className="mt-8 p-4 bg-black/10 rounded-2xl border border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-2">
              <BadgeCheck className="text-green-300" />
              <p className="font-bold text-blue-50">{backupStatus || restoreStatus}</p>
            </div>
          )}
        </div>

        {/* Abstract decorations */}
        <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-white/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-100px] right-[-100px] w-80 h-80 bg-black/10 rounded-full blur-[80px] pointer-events-none" />
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <Modal onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="text-center p-6 sm:p-10">
            <div className="mx-auto flex items-center justify-center h-28 w-28 rounded-[2.5rem] bg-red-50 dark:bg-red-900/20 mb-10 relative shadow-inner">
              <AlertTriangle className="h-14 w-14 text-red-600 dark:text-red-400" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping" />
            </div>

            <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-4 tracking-tight leading-none uppercase">{confirmModal.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-xl font-medium max-w-lg mx-auto leading-relaxed">
              {confirmModal.message}
            </p>

            {confirmModal.requiresInput && (
              <div className="mb-10 max-w-sm mx-auto">
                <p className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-widest mb-3">Mohon Konfirmasi:</p>
                <input
                  type="text"
                  placeholder={`Ketik: ${confirmModal.confirmPhrase || 'HAPUS'}`}
                  className="w-full px-8 py-5 rounded-[2rem] border-4 border-red-50 dark:border-red-900/20 bg-gray-50 dark:bg-gray-900/50 focus:border-red-500 dark:focus:border-red-500 focus:ring-8 focus:ring-red-500/5 outline-none text-center font-black tracking-[0.2em] text-2xl text-red-600 uppercase shadow-xl transition-all"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-5 justify-center max-w-xl mx-auto">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-10 py-5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 font-black rounded-3xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-1 text-xl active:scale-95"
              >
                Batalkan
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.requiresInput && confirmationText.trim().toUpperCase() !== (confirmModal.confirmPhrase || 'HAPUS').toUpperCase()}
                className="px-10 py-5 bg-red-600 text-white font-black rounded-3xl hover:bg-red-700 shadow-2xl shadow-red-200 dark:shadow-none transition-all flex-1 text-xl active:scale-95 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DatabaseManager;