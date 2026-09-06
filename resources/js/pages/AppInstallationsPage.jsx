import React, { useState, useEffect, useMemo } from 'react';
import { Smartphone, Search, RefreshCw, Filter, CheckCircle2, XCircle, Trash2, FileText } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledSelect from '../components/StyledSelect';
import StyledInput from '../components/StyledInput';

export default function AppInstallationsPage() {
  const [data, setData] = useState({ stats: {}, students: { data: [] } });
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [installStatus, setInstallStatus] = useState('');
  const [pushStatus, setPushStatus] = useState('');
  const [page, setPage] = useState(1);

  // No longer generating URL directly. We'll fetch a ticket.
  // const pdfExportUrl = useMemo(() => {
  //   const params = new URLSearchParams();
  //   if (search) params.append('search', search);
  //   if (classId) params.append('class_id', classId);
  //   if (installStatus) params.append('installation_status', installStatus);
  //   if (pushStatus) params.append('push_status', pushStatus);
  //   return `/api/admin/app-installations/export-pdf?${params.toString()}`;
  // }, [search, classId, installStatus, pushStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/app-installations', {
        params: {
          search,
          class_id: classId,
          installation_status: installStatus,
          push_status: pushStatus,
          page
        }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Gagal memuat data instalasi aplikasi');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get('/classes');
      setClasses(response.data.data);
    } catch (error) {
      console.error('Failed to fetch classes', error);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchData();
  }, [search, classId, installStatus, pushStatus, page]);

  const handleResetDevice = async (studentId) => {
    if (!window.confirm('Yakin ingin mereset perangkat siswa ini? Siswa harus login ulang di perangkatnya.')) return;
    
    try {
      await api.post(`/admin/app-installations/${studentId}/reset-device`);
      toast.success('Perangkat berhasil direset');
      fetchData();
    } catch (error) {
      toast.error('Gagal mereset perangkat');
    }
  };

  const handleExportPdf = async () => {
    try {
      // First, get a ticket for the PDF export
      const response = await api.post('/admin/app-installations/generate-pdf-ticket', {
        search,
        class_id: classId,
        installation_status: installStatus,
        push_status: pushStatus,
      });
      const { ticket } = response.data;

      // Then, open the PDF URL with the ticket
      window.open(`/api/admin/app-installations/export-pdf?ticket=${ticket}`, '_blank');
    } catch (error) {
      toast.error('Gagal membuat tiket PDF: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Smartphone className="text-primary" />
            Monitoring Instalasi Aplikasi
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Lacak siswa dan walimurid yang sudah menginstal aplikasi (PWA).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportPdf}
            className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
            disabled={loading}
          >
            <FileText size={20} />
            <span>Rekap PDF</span>
          </button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Siswa</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
            {data.stats.total_students || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Terinstal Aplikasi</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
            {data.stats.installed_count || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Belum Instal</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
            {data.stats.not_installed_count || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Push Notif Aktif</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {data.stats.push_active_count || 0}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, NISN, atau email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        
        <StyledSelect
          value={classId}
          onChange={(e) => { setClassId(e.target.value); setPage(1); }}
          className="w-full md:w-48"
        >
          <option value="">Semua Kelas</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.rombel}</option>
          ))}
        </StyledSelect>
        
        <StyledSelect
          value={installStatus}
          onChange={(e) => { setInstallStatus(e.target.value); setPage(1); }}
          className="w-full md:w-48"
        >
          <option value="">Status Instalasi</option>
          <option value="installed">Terinstal</option>
          <option value="not_installed">Belum Instal</option>
        </StyledSelect>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Siswa</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kelas</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aplikasi (PWA)</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Push Notif</th>
                <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.students.data?.map(student => (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{student.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">NISN: {student.nisn}</p>
                  </td>
                  <td className="p-4 text-sm text-gray-600 dark:text-gray-300">
                    {student.class || '-'}
                  </td>
                  <td className="p-4">
                    {student.installation_status === 'installed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 size={14} /> Terinstal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <XCircle size={14} /> Belum
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {student.push_status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <CheckCircle2 size={14} /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <XCircle size={14} /> Tidak Aktif
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {student.installation_status === 'installed' && (
                      <button
                        onClick={() => handleResetDevice(student.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Reset Perangkat (Hapus device_id)"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              
              {data.students.data?.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Details (Basic next/prev for now) */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Sebelumnya
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Halaman {data.students.current_page || 1} dari {data.students.last_page || 1}
          </span>
          <button
            disabled={!data.students.next_page_url}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  );
}
