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
  Zap,
  Trash2,
  Printer,
  Edit
} from 'lucide-react';
import Select from 'react-select';
import toast from 'react-hot-toast';
import moment from 'moment';
import PrintLibraryReceiptModal from '../../components/PrintLibraryReceiptModal';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import { ScanBarcode } from 'lucide-react';

const LoanManagementPage = () => {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total_books: 0, active_loans: 0, overdue_loans: 0 });
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  // Receipt State
  const [showReceipt, setShowReceipt] = useState(false);
  const [transactionData, setTransactionData] = useState(null);

  // Return Verification State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTransaction, setReturnTransaction] = useState(null);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ id: null, loan_date: '', due_date: '', student_name: '', book_title: '' });

  // Select Options
  const [studentOptions, setStudentOptions] = useState([]);
  const [bookOptions, setBookOptions] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);

  // Form State (Cart System)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [cart, setCart] = useState([]);
  const [loanDate, setLoanDate] = useState(moment().format('YYYY-MM-DD'));
  const [dueDate, setDueDate] = useState(moment().add(7, 'days').format('YYYY-MM-DD'));

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('student'); // 'student' or 'book'

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
        value: s, // Store whole object
        label: `${s.nis} - ${s.name} [${s.nisn || ''}] (${s.class?.rombel || 'N/A'})`
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
        value: b, // Store whole object
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

  const addToCart = (bookOption) => {
    if (!bookOption) return;
    const book = bookOption.value;
    
    // Check if already in cart
    if (cart.find(b => b.id === book.id)) {
      toast.error('Buku ini sudah ada di daftar pinjaman');
      return;
    }
    setCart([...cart, book]);
  };

  const removeFromCart = (bookId) => {
    setCart(cart.filter(b => b.id !== bookId));
  };

  const handleScanSuccess = async (decodedText) => {
    // If it's a transaction ID, try to open return verification directly
    if (decodedText.startsWith('TRX-') || decodedText.length > 10) {
        // Try to fetch transaction to verify it exists
        try {
            const res = await api.get(`/library/loans/transaction/${decodedText}`);
            if (res.data && res.data.length > 0) {
                setReturnTransaction(res.data);
                setShowReturnModal(true);
                setShowScanner(false);
                toast.success('Transaksi ditemukan');
                return;
            }
        } catch (err) {
            // If not a transaction ID, proceed to normal student/book scanning
        }
    }

    if (scannerTarget === 'student') {
        setIsSearchingStudents(true);
        try {
            const response = await api.get(`/students?search=${decodedText}`);
            // Try to find exact match by NIS or NISN
            const student = response.data.data.find(s => s.nis === decodedText || s.nisn === decodedText);
            if (student) {
                setSelectedStudent(student);
                toast.success(`Siswa: ${student.name}`);
            } else if (response.data.data.length > 0) {
                // If no exact match but results exist, take the first one
                setSelectedStudent(response.data.data[0]);
                toast.success(`Siswa: ${response.data.data[0].name}`);
            } else {
                toast.error('Siswa tidak ditemukan');
            }
        } catch (error) {
            toast.error('Gagal mencari siswa');
        } finally {
            setIsSearchingStudents(false);
        }
    } else {
        setIsSearchingBooks(true);
        try {
            const response = await api.get(`/library/books?search=${decodedText}`);
            // Try to find exact match by ISBN or ID
            const book = response.data.data.find(b => b.isbn === decodedText || b.id.toString() === decodedText);
            if (book) {
                if (book.available_stock <= 0) {
                    toast.error('Stok buku kosong');
                } else {
                    addToCart({ value: book });
                    toast.success(`Buku: ${book.title}`);
                }
            } else if (response.data.data.length > 0) {
                const firstBook = response.data.data[0];
                if (firstBook.available_stock <= 0) {
                    toast.error('Stok buku kosong');
                } else {
                    addToCart({ value: firstBook });
                    toast.success(`Buku: ${firstBook.title}`);
                }
            } else {
                toast.error('Buku tidak ditemukan');
            }
        } catch (error) {
            toast.error('Gagal mencari buku');
        } finally {
            setIsSearchingBooks(false);
        }
    }
  };

  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Pilih siswa terlebih dahulu');
      return;
    }
    if (cart.length === 0) {
      toast.error('Daftar buku masih kosong');
      return;
    }

    try {
      const response = await api.post('/library/loans', {
        student_id: selectedStudent.id,
        book_ids: cart.map(b => b.id),
        loan_date: loanDate,
        due_date: dueDate
      });
      
      toast.success('Peminjaman berhasil dicatat');
      
      const createdLoans = response.data.data;
      const transactionId = response.data.transaction_id;
      const librarianName = createdLoans[0]?.librarian?.name || 'Pustakawan';
      
      // Save data for receipt before clearing form
      setTransactionData({
        transaction_id: transactionId,
        student: selectedStudent,
        books: [...cart],
        loanDate,
        dueDate,
        librarianName
      });

      setShowLoanModal(false);
      setShowReceipt(true); // Open Receipt Modal

      // Clear Form
      setSelectedStudent(null);
      setCart([]);
      
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

  const handleReprint = async (loan) => {
    if (loan.transaction_id) {
        toast.loading('Memuat data transaksi...', { id: 'reprint-loading' });
        try {
            const res = await api.get(`/library/loans/transaction/${loan.transaction_id}`);
            const transactionLoans = res.data;
            setTransactionData({
                transaction_id: loan.transaction_id,
                student: transactionLoans[0].student,
                books: transactionLoans.map(l => l.book),
                loanDate: transactionLoans[0].loan_date,
                dueDate: transactionLoans[0].due_date,
                librarianName: transactionLoans[0].librarian?.name || 'Pustakawan'
            });
            setShowReceipt(true);
            toast.dismiss('reprint-loading');
        } catch (err) {
            toast.error('Gagal memuat data transaksi');
            toast.dismiss('reprint-loading');
        }
    } else {
        // Fallback for old data
        setTransactionData({
            transaction_id: null,
            student: loan.student,
            books: [loan.book],
            loanDate: loan.loan_date,
            dueDate: loan.due_date,
            librarianName: loan.librarian?.name || 'Pustakawan'
        });
        setShowReceipt(true);
    }
  };

  const handleEditClick = (loan) => {
    setEditData({
        id: loan.id,
        loan_date: moment(loan.loan_date).format('YYYY-MM-DD'),
        due_date: moment(loan.due_date).format('YYYY-MM-DD'),
        student_name: loan.student?.name,
        book_title: loan.book?.title
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
      e.preventDefault();
      try {
          await api.put(`/library/loans/${editData.id}`, {
              loan_date: editData.loan_date,
              due_date: editData.due_date
          });
          toast.success('Data sirkulasi berhasil diperbarui');
          setShowEditModal(false);
          fetchLoans();
      } catch (error) {
          toast.error(error.response?.data?.message || 'Gagal menyimpan perubahan');
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
  const [quickInput, setQuickInput] = useState({ step: 'student', student: null, cart: [] });

  const openReturnVerification = async (transactionId) => {
    try {
      const res = await api.get(`/library/loans/transaction/${transactionId}`);
      setReturnTransaction(res.data);
      setShowReturnModal(true);
      toast.success('Data transaksi ditemukan');
    } catch (err) {
      toast.error('Gagal memuat data transaksi');
    }
  };

  const handleQuickScan = async (e) => {
    e.preventDefault();
    const value = e.target.quickValue.value.trim();
    if (!value) return;

    // Detect Transaction Barcode
    if (value.startsWith('TRX-')) {
      await openReturnVerification(value);
      e.target.quickValue.value = '';
      return;
    }

    try {
      if (quickInput.step === 'student') {
        const res = await api.get(`/students?search=${value}`);
        const student = res.data.data.find(s => 
          s.nis === value || 
          s.nisn === value || 
          s.name.toLowerCase() === value.toLowerCase()
        );
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
          if (quickInput.cart.find(b => b.id === book.id)) {
            toast.error('Buku sudah discan');
            return;
          }
          setQuickInput({ ...quickInput, cart: [...quickInput.cart, book] });
          toast.success(`Ditambahkan: ${book.title}`);
        } else {
          toast.error('Buku tidak ditemukan');
        }
      }
    } catch (err) {
      toast.error('Gagal memproses scan');
    }
    e.target.quickValue.value = '';
  };

  const processQuickLoan = async () => {
      if (quickInput.cart.length === 0) return;
      try {
          const response = await api.post('/library/loans', {
            student_id: quickInput.student.id,
            book_ids: quickInput.cart.map(b => b.id),
            loan_date: moment().format('YYYY-MM-DD'),
            due_date: moment().add(7, 'days').format('YYYY-MM-DD')
          });

          toast.success(`Berhasil meminjamkan ${quickInput.cart.length} buku`);
          
          const createdLoans = response.data.data;
          const transactionId = response.data.transaction_id;
          const librarianName = createdLoans[0]?.librarian?.name || 'Pustakawan';
          
          setTransactionData({
              transaction_id: transactionId,
              student: quickInput.student,
              books: [...quickInput.cart],
              loanDate: moment().format('YYYY-MM-DD'),
              dueDate: moment().add(7, 'days').format('YYYY-MM-DD'),
              librarianName
          });
          
          setQuickInput({ step: 'student', student: null, cart: [] });
          setShowReceipt(true);
          fetchLoans();
          fetchStats();
      } catch (err) {
          toast.error(err.response?.data?.message || 'Gagal memproses sirkulasi');
      }
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
              {quickInput.step === 'student' ? 'Scan Kartu Siswa (NIS/NISN)' : `Scan Buku untuk ${quickInput.student?.name}`}
            </h4>
            <form onSubmit={handleQuickScan} className="relative">
              <input 
                name="quickValue"
                autoFocus
                type="text" 
                placeholder={quickInput.step === 'student' ? "Scan NIS atau NISN..." : "Scan Barcode Buku / ISBN..."}
                className="w-full px-6 py-5 bg-white dark:bg-gray-900 border-none rounded-2xl shadow-xl focus:ring-4 focus:ring-orange-500/20 dark:text-white text-center text-lg font-bold"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-orange-500 text-white rounded-lg">
                <ArrowRightLeft size={20} />
              </button>
            </form>
            
            {quickInput.step === 'book' && (
              <div className="mt-6 text-left">
                <p className="font-bold text-orange-800 mb-2">Keranjang ({quickInput.cart.length} Buku)</p>
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {quickInput.cart.map(b => (
                        <div key={b.id} className="bg-white p-2 rounded-lg text-sm shadow-sm font-medium flex justify-between">
                            <span>{b.title}</span>
                            <button onClick={() => setQuickInput({...quickInput, cart: quickInput.cart.filter(item => item.id !== b.id)})} className="text-red-500">X</button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setQuickInput({ step: 'student', student: null, cart: [] })}
                        className="flex-1 py-3 text-xs font-bold text-orange-600 bg-orange-100 rounded-xl"
                    >
                        Batal
                    </button>
                    {quickInput.cart.length > 0 && (
                        <button 
                            onClick={processQuickLoan}
                            className="flex-[2] py-3 text-xs font-bold text-white bg-orange-600 rounded-xl shadow-lg"
                        >
                            Proses & Cetak
                        </button>
                    )}
                </div>
              </div>
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
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari siswa, NIS, buku, atau Resi..." 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLoans()}
              />
            </div>
            <button 
              onClick={() => { setScannerTarget('student'); setShowScanner(true); }}
              className="p-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center"
              title="Scan Resi untuk Pengembalian"
            >
              <ScanBarcode size={20} />
            </button>
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
                (() => {
                  const processedTrx = new Set();
                  return loans.map((loan) => {
                    // If transaction_id exists and already processed, skip it to avoid duplicates in grouped view
                    if (loan.transaction_id) {
                      if (processedTrx.has(loan.transaction_id)) return null;
                      processedTrx.add(loan.transaction_id);
                      
                      // Count other books in this transaction (within the current page)
                      const siblings = loans.filter(l => l.transaction_id === loan.transaction_id);
                      const hasMulti = siblings.length > 1;

                      return (
                        <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all group border-b border-gray-50 dark:border-gray-700">
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
                              <div className="relative">
                                {loan.book?.cover_url ? (
                                  <img src={loan.book.cover_url} className="h-10 w-8 object-cover rounded-md shadow-sm" alt="" />
                                ) : (
                                  <div className="h-10 w-8 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-400">
                                    <BookIcon size={14} />
                                  </div>
                                )}
                                {hasMulti && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black shadow-sm">
                                    {siblings.length}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-700 dark:text-gray-200 text-sm max-w-[200px] truncate" title={loan.book?.title}>
                                  {loan.book?.title}
                                </p>
                                {hasMulti && (
                                  <p className="text-[10px] text-primary font-bold">+{siblings.length - 1} Buku Lainnya</p>
                                )}
                              </div>
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
                          <td className="px-8 py-5">
                            <div className="flex justify-end items-center gap-2">
                              <button 
                                onClick={() => handleReprint(loan)}
                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all shadow-sm"
                                title="Cetak Ulang Struk"
                              >
                                <Printer size={16} />
                              </button>
                              
                              {(loan.status === 'dipinjam' || loan.status === 'terlambat') && (
                                <>
                                  <button 
                                    onClick={() => handleEditClick(loan)}
                                    className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all shadow-sm"
                                    title="Edit Tanggal"
                                  >
                                    <Edit size={16} />
                                  </button>

                                  <button 
                                    onClick={() => openReturnVerification(loan.transaction_id || loan.id)}
                                    className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm"
                                  >
                                    Proses Kembali
                                  </button>
                                </>
                              )}
                              {loan.status === 'kembali' && (
                                <span className="text-xs text-gray-300 font-medium px-2">Tuntas</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Single loan row for old data
                    return (
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
                        <td className="px-8 py-5">
                          <div className="flex justify-end items-center gap-2">
                            <button 
                              onClick={() => handleReprint(loan)}
                              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all shadow-sm"
                              title="Cetak Ulang Struk"
                            >
                              <Printer size={16} />
                            </button>
                            
                            {(loan.status === 'dipinjam' || loan.status === 'terlambat') && (
                              <>
                                <button 
                                  onClick={() => handleEditClick(loan)}
                                  className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl transition-all shadow-sm"
                                  title="Edit Tanggal"
                                >
                                  <Edit size={16} />
                                </button>

                                <button 
                                  onClick={() => handleReturn(loan.id)}
                                  className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm"
                                >
                                  Proses Kembali
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                })()
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

      {/* POS Cart Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowLoanModal(false)} />
          
          <div className="relative w-full max-w-4xl bg-gray-50 dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in flex flex-col md:flex-row h-[85vh] md:h-auto max-h-[800px]">
            
            {/* Left Side: Form Input */}
            <div className="flex-1 p-8 bg-white dark:bg-gray-800 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <ArrowRightLeft className="text-primary" />
                        Transaksi Baru
                        </h3>
                        <p className="text-sm text-gray-500">Cari siswa dan tambahkan buku ke keranjang</p>
                    </div>
                    <button onClick={() => setShowLoanModal(false)} className="p-2 md:hidden hover:bg-gray-100 rounded-xl">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">1. Pilih Siswa (Wajib)</label>
                            <button 
                                type="button"
                                onClick={() => { setScannerTarget('student'); setShowScanner(true); }}
                                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                            >
                                <ScanBarcode size={16} />
                                <span className="text-[10px] font-bold">SCAN KARTU</span>
                            </button>
                        </div>
                        <Select 
                            onInputChange={(val, { action }) => { if (action === 'input-change') searchStudents(val); }}
                            isLoading={isSearchingStudents}
                            options={studentOptions}
                            styles={customSelectStyles}
                            placeholder="Ketik NIS / NISN atau Nama Siswa..."
                            onChange={(opt) => setSelectedStudent(opt ? opt.value : null)}
                            value={selectedStudent ? { value: selectedStudent, label: `${selectedStudent.nis} - ${selectedStudent.name}` } : null}
                            className="dark:text-black"
                            isClearable
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">2. Tambah Buku (Cari/Scan)</label>
                            <button 
                                type="button"
                                onClick={() => { setScannerTarget('book'); setShowScanner(true); }}
                                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                            >
                                <ScanBarcode size={16} />
                                <span className="text-[10px] font-bold">SCAN BUKU</span>
                            </button>
                        </div>
                        <Select 
                            onInputChange={(val, { action }) => { if (action === 'input-change') searchBooks(val); }}
                            isLoading={isSearchingBooks}
                            options={bookOptions}
                            styles={customSelectStyles}
                            placeholder="Ketik Judul atau ISBN..."
                            onChange={(opt) => addToCart(opt)}
                            value={null} // Reset after selection
                            className="dark:text-black"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tgl Pinjam</label>
                            <input 
                                type="date"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white text-sm"
                                value={loanDate}
                                onChange={(e) => setLoanDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tenggat Kembali</label>
                            <input 
                                type="date"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white text-sm"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Cart Summary */}
            <div className="w-full md:w-[400px] bg-gray-50 dark:bg-gray-900 p-8 flex flex-col border-l border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-gray-800 dark:text-white">Daftar Pinjaman</h4>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">
                        {cart.length} Buku
                    </span>
                    <button onClick={() => setShowLoanModal(false)} className="hidden md:block p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-3">
                            <BookIcon size={40} className="opacity-20" />
                            <p className="text-sm">Keranjang masih kosong.<br/>Silakan cari dan pilih buku.</p>
                        </div>
                    ) : (
                        cart.map((book, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-2xl flex gap-3 shadow-sm items-center border border-gray-100 dark:border-gray-700">
                                {book.cover_url ? (
                                    <img src={book.cover_url} className="w-10 h-14 object-cover rounded-lg" alt="" />
                                ) : (
                                    <div className="w-10 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                                        <BookIcon size={16} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{book.title}</p>
                                    <p className="text-[10px] text-gray-400 font-mono">{book.isbn || 'Tanpa ISBN'}</p>
                                </div>
                                <button 
                                    onClick={() => removeFromCart(book.id)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-auto space-y-3">
                    <button 
                        onClick={handleLoanSubmit}
                        disabled={cart.length === 0 || !selectedStudent}
                        className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={20} />
                        Simpan Transaksi
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      <PrintLibraryReceiptModal 
        isOpen={showReceipt} 
        onClose={() => setShowReceipt(false)} 
        transactionData={transactionData} 
      />

      {/* Edit Loan Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowEditModal(false)} />
          
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                  <Edit className="text-orange-500" />
                  Edit Sirkulasi
                </h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-8 space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 mb-4">
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">Data Siswa & Buku (Tidak Dapat Diubah)</p>
                  <p className="font-bold text-gray-800 dark:text-white">{editData.student_name}</p>
                  <p className="text-sm text-gray-500">{editData.book_title}</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tanggal Pinjam</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-orange-500/20 transition-all dark:text-white"
                    value={editData.loan_date}
                    onChange={(e) => setEditData({ ...editData, loan_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tenggat Kembali</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-orange-500/20 transition-all dark:text-white"
                    value={editData.due_date}
                    onChange={(e) => setEditData({ ...editData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Verification Modal */}
      {showReturnModal && returnTransaction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowReturnModal(false)} />
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8 pb-4 flex items-center justify-between border-b border-gray-50 dark:border-gray-800">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                  <ArrowRightLeft className="text-emerald-500" />
                  Verifikasi Pengembalian
                </h3>
                <p className="text-sm text-gray-500">Scan Barcode: <span className="font-mono font-bold text-emerald-600">{returnTransaction[0]?.transaction_id}</span></p>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl mb-8 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                      <UserIcon size={24} />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Peminjam</p>
                      <p className="font-bold text-gray-800 dark:text-white">{returnTransaction[0]?.student?.name} ({returnTransaction[0]?.student?.nis})</p>
                  </div>
              </div>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Daftar Buku dalam Transaksi ini:</p>
                {returnTransaction.map((loan) => (
                  <div 
                    key={loan.id} 
                    className={`p-4 rounded-[2rem] border transition-all flex items-center gap-4 ${
                      loan.status === 'kembali' 
                      ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60' 
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="w-10 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-400">
                      {loan.book?.cover_url ? (
                        <img src={loan.book.cover_url} className="w-full h-full object-cover rounded-lg" alt="" />
                      ) : (
                        <BookIcon size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${loan.status === 'kembali' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                        {loan.book?.title}
                      </p>
                      <p className="text-xs text-gray-500">Jatuh Tempo: {moment(loan.due_date).format('DD MMM YYYY')}</p>
                    </div>
                    {loan.status !== 'kembali' ? (
                      <button 
                        onClick={async () => {
                          try {
                            await api.post(`/library/loans/${loan.id}/return`);
                            toast.success(`'${loan.book.title}' dikembalikan`);
                            // Refresh specific loan in modal
                            const res = await api.get(`/library/loans/transaction/${loan.transaction_id}`);
                            setReturnTransaction(res.data);
                            fetchLoans();
                            fetchStats();
                          } catch (err) {
                            toast.error('Gagal memproses pengembalian');
                          }
                        }}
                        className="px-6 py-3 bg-emerald-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                      >
                        Konfirmasi Kembali
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-600 text-[10px] font-bold uppercase rounded-xl">
                        <CheckCircle2 size={12} /> Sudah Kembali
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowReturnModal(false)}
                  className="px-8 py-4 bg-gray-800 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onScanSuccess={handleScanSuccess} 
      />
    </div>
  );
};

export default LoanManagementPage;
