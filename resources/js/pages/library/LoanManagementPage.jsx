import React, { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { 
  Search, 
  Plus, 
  History, 
  User as UserIcon, 
  Book as BookIcon, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRightLeft,
  X,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import Select from 'react-select';
import toast from 'react-hot-toast';
import moment from 'moment';

const LoanManagementPage = () => {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total_books: 0, active_loans: 0, overdue_loans: 0 });
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  // Select Options
  const [studentOptions, setStudentOptions] = useState([]);
  const [bookOptions, setBookOptions] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    student_id: '',
    book_id: '',
    loan_date: moment().format('YYYY-MM-DD'),
    due_date: moment().add(7, 'days').format('YYYY-MM-DD')
  });

  useEffect(() => {
    fetchLoans();
    fetchStats();
  }, [pagination.current_page]);

  const fetchLoans = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/library/loans?page=${pagination.current_page}&search=${searchTerm}`);
      setLoans(response.data.data);
      setPagination({
        current_page: response.data.current_page,
        last_page: response.data.last_page
      });
    } catch (error) {
      toast.error('Gagal memuat data sirkulasi');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/library/loans/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const searchStudents = async (input) => {
    if (input.length < 2) return;
    setIsSearchingStudents(true);
    try {
      const response = await api.get(`/students?search=${input}`);
      const options = response.data.data.map(s => ({
        value: s.id,
        label: `${s.nis} - ${s.name} (${s.class?.name || 'N/A'})`
      }));
      setStudentOptions(options);
    } catch (error) {
      console.error('Student search failed');
    } finally {
      setIsSearchingStudents(false);
    }
  };

  const searchBooks = async (input) => {
    if (input.length < 2) return;
    setIsSearchingBooks(true);
    try {
      const response = await api.get(`/library/books?search=${input}`);
      const options = response.data.data.map(b => ({
        value: b.id,
        label: `${b.title} (${b.available_stock} tersedia)`,
        isDisabled: b.available_stock <= 0
      }));
      setBookOptions(options);
    } catch (error) {
      console.error('Book search failed');
    } finally {
      setIsSearchingBooks(false);
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    if (!formData.student_id || !formData.book_id) {
      toast.error('Pilih siswa dan buku terlebih dahulu');
      return;
    }

    try {
      await api.post('/library/loans', formData);
      toast.success('Peminjaman berhasil dicatat');
      setShowLoanModal(false);
      fetchLoans();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal memproses peminjaman');
    }
  };

  const handleReturn = async (loanId) => {
    if (!window.confirm('Proses pengembalian buku ini?')) return;
    
    try {
      await api.post(`/library/loans/${loanId}/return`);
      toast.success('Buku berhasil dikembalikan');
      fetchLoans();
      fetchStats();
    } catch (error) {
      toast.error('Gagal memproses pengembalian');
    }
  };

  const getStatusBadge = (status, dueDate) => {
    const isOverdue = moment().isAfter(moment(dueDate)) && status === 'dipinjam';
    
    if (status === 'kembali') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase rounded-full">
          <CheckCircle2 size={12} /> Kembali
        </span>
      );
    }
    
    if (isOverdue || status === 'terlambat') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase rounded-full animate-pulse">
          <AlertTriangle size={12} /> Terlambat
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase rounded-full">
        <Clock size={12} /> Dipinjam
      </span>
    );
  };

  const customSelectStyles = {
    control: (base) => ({
      ...base,
      backgroundColor: 'transparent',
      borderRadius: '1rem',
      padding: '4px',
      border: 'none',
      boxShadow: 'none',
    }),
    container: (base) => ({
      ...base,
      backgroundColor: 'var(--tw-bg-opacity)',
      borderRadius: '1rem',
      border: '1px solid #e5e7eb',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#3b82f6' : 'transparent',
      color: state.isFocused ? 'white' : 'inherit',
    })
  };

  // Quick Mode State
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [quickInput, setQuickInput] = useState({ step: 'student', student: null, book: null });

  const handleQuickScan = async (e) => {
    e.preventDefault();
    const value = e.target.quickValue.value.trim();
    if (!value) return;

    try {
      if (quickInput.step === 'student') {
        const res = await api.get(`/students?search=${value}`);
        const student = res.data.data.find(s => s.nis === value || s.name.toLowerCase() === value.toLowerCase());
        if (student) {
          setQuickInput({ ...quickInput, step: 'book', student });
          toast.success(`Siswa: ${student.name}`);
        } else {
          toast.error('Siswa tidak ditemukan');
        }
      } else {
        const res = await api.get(`/library/books?search=${value}`);
        const book = res.data.data.find(b => b.isbn === value || b.title.toLowerCase() === value.toLowerCase() || b.id.toString() === value);
        if (book) {
          if (book.available_stock <= 0) {
            toast.error('Stok buku kosong');
            return;
          }
          // Process Loan
          await api.post('/library/loans', {
            student_id: quickInput.student.id,
            book_id: book.id,
            loan_date: moment().format('YYYY-MM-DD'),
            due_date: moment().add(7, 'days').format('YYYY-MM-DD')
          });
          toast.success(`Berhasil meminjamkan: ${book.title}`);
          setQuickInput({ step: 'student', student: null, book: null });
          fetchLoans();
          fetchStats();
        } else {
          toast.error('Buku tidak ditemukan');
        }
      }
    } catch (err) {
      toast.error('Gagal memproses scan');
    }
    e.target.quickValue.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Quick Mode Toggle */}
      <div className="flex justify-end">
        <button 
          onClick={() => setIsQuickMode(!isQuickMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isQuickMode ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
        >
          <Zap size={16} />
          {isQuickMode ? 'Mode Cepat Aktif' : 'Aktifkan Mode Cepat (Scan)'}
        </button>
      </div>

      {isQuickMode && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border-2 border-dashed border-orange-200 dark:border-orange-800/50 p-8 rounded-[2.5rem] animate-fade-in">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              {quickInput.step === 'student' ? <UserIcon size={32} /> : <BookIcon size={32} />}
            </div>
            <h4 className="text-xl font-bold text-orange-800 dark:text-orange-300">
              {quickInput.step === 'student' ? 'Scan Kartu Siswa (NIS)' : `Pilih Buku untuk ${quickInput.student?.name}`}
            </h4>
            <form onSubmit={handleQuickScan} className="relative">
              <input 
                name="quickValue"
                autoFocus
                type="text" 
                placeholder={quickInput.step === 'student' ? "Scan NIS..." : "Scan Barcode Buku / ISBN..."}
                className="w-full px-6 py-5 bg-white dark:bg-gray-900 border-none rounded-2xl shadow-xl focus:ring-4 focus:ring-orange-500/20 dark:text-white text-center text-lg font-bold"
              />
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-orange-500 text-white rounded-lg">
                <ArrowRightLeft size={20} />
              </button>
            </form>
            {quickInput.step === 'book' && (
              <button 
                onClick={() => setQuickInput({ step: 'student', student: null, book: null })}
                className="text-xs font-bold text-orange-600 underline"
              >
                Batal / Ganti Siswa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Pinjaman Aktif</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.active_loans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Terlambat</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.overdue_loans}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600">
              <BookIcon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Koleksi</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total_books}</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowLoanModal(true)}
          className="bg-primary p-6 rounded-[2rem] shadow-lg shadow-primary/20 text-white flex items-center justify-center gap-4 transform active:scale-95 transition-all"
        >
          <Plus size={32} />
          <div className="text-left">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Sirkulasi Baru</p>
            <p className="text-lg font-bold">Catat Peminjaman</p>
          </div>
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <History className="text-primary" />
            Riwayat Sirkulasi
          </h3>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari siswa, NIS, atau judul buku..." 
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLoans()}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Siswa</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Buku</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waktu</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="5" className="px-8 py-8"><div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl w-full"></div></td>
                  </tr>
                ))
              ) : loans.length > 0 ? (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {loan.student?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-white">{loan.student?.name}</p>
                          <p className="text-xs text-gray-400">{loan.student?.nis}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        {loan.book?.cover_url ? (
                          <img src={loan.book.cover_url} className="h-10 w-8 object-cover rounded-md shadow-sm" alt="" />
                        ) : (
                          <div className="h-10 w-8 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-400">
                            <BookIcon size={14} />
                          </div>
                        )}
                        <p className="font-medium text-gray-700 dark:text-gray-200 text-sm max-w-[200px] truncate" title={loan.book?.title}>
                          {loan.book?.title}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          <span>{moment(loan.loan_date).format('DD MMM')} - {moment(loan.due_date).format('DD MMM YYYY')}</span>
                        </div>
                        {loan.return_date && (
                          <div className="flex items-center gap-2 text-[10px] text-green-500 font-bold uppercase">
                            <CheckCircle2 size={10} /> Kembali: {moment(loan.return_date).format('DD MMM')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {getStatusBadge(loan.status, loan.due_date)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {(loan.status === 'dipinjam' || loan.status === 'terlambat') && (
                        <button 
                          onClick={() => handleReturn(loan.id)}
                          className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary text-xs font-bold rounded-xl transition-all hover:text-white shadow-sm"
                        >
                          Proses Kembali
                        </button>
                      )}
                      {loan.status === 'kembali' && (
                        <span className="text-xs text-gray-300 font-medium">Tuntas</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <History className="mx-auto text-gray-200 mb-4" size={48} />
                    <p className="text-gray-400 font-medium">Belum ada data sirkulasi</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.last_page > 1 && (
          <div className="p-8 border-t border-gray-50 dark:border-gray-700 flex items-center justify-center gap-4">
            <button 
              disabled={pagination.current_page === 1}
              onClick={() => setPagination({ ...pagination, current_page: pagination.current_page - 1 })}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-gray-500">
              Halaman {pagination.current_page} dari {pagination.last_page}
            </span>
            <button 
              disabled={pagination.current_page === pagination.last_page}
              onClick={() => setPagination({ ...pagination, current_page: pagination.current_page + 1 })}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* New Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowLoanModal(false)} />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                  <ArrowRightLeft className="text-primary" />
                  Peminjaman Baru
                </h3>
                <p className="text-sm text-gray-500">Cari siswa dan buku untuk mencatat sirkulasi</p>
              </div>
              <button 
                onClick={() => setShowLoanModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleLoanSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Cari Siswa (Nama/NIS)</label>
                <Select 
                  onInputChange={(val) => searchStudents(val)}
                  isLoading={isSearchingStudents}
                  options={studentOptions}
                  styles={customSelectStyles}
                  placeholder="Ketik NIS atau Nama Siswa..."
                  onChange={(opt) => setFormData({ ...formData, student_id: opt.value })}
                  className="dark:text-black"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Cari Buku (Judul/ISBN)</label>
                <Select 
                  onInputChange={(val) => searchBooks(val)}
                  isLoading={isSearchingBooks}
                  options={bookOptions}
                  styles={customSelectStyles}
                  placeholder="Ketik Judul Buku..."
                  onChange={(opt) => setFormData({ ...formData, book_id: opt.value })}
                  className="dark:text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tanggal Pinjam</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.loan_date}
                    onChange={(e) => setFormData({ ...formData, loan_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tenggat Kembali</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanManagementPage;
