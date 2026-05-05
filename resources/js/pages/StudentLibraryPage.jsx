import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import { 
  Search, 
  Book as BookIcon, 
  BookOpen, 
  MapPin, 
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';
import moment from 'moment';
import 'moment/locale/id';

const StudentLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('catalog');

  // Catalog State
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  // Loans State
  const [loans, setLoans] = useState([]);
  const [isLoansLoading, setIsLoansLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchBooks();
    } else if (activeTab === 'loans' && loans.length === 0) {
      fetchLoans();
    }
  }, [pagination.current_page, activeTab]);

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/library/books?page=${pagination.current_page}&search=${searchTerm}`);
      setBooks(response.data.data);
      setPagination({
        current_page: response.data.current_page,
        last_page: response.data.last_page
      });
    } catch (error) {
      toast.error('Gagal memuat katalog buku');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLoans = async () => {
    setIsLoansLoading(true);
    try {
      const response = await api.get('/student/library/loans');
      setLoans(response.data.loans);
    } catch (error) {
      toast.error('Gagal memuat riwayat peminjaman');
    } finally {
      setIsLoansLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, current_page: 1 });
    fetchBooks();
  };

  const getStatusBadge = (status, dueDate) => {
    const isOverdue = moment().isAfter(moment(dueDate)) && status === 'dipinjam';
    
    if (isOverdue) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[10px] font-bold">
          <AlertTriangle size={12} />
          Terlambat
        </span>
      );
    }
    
    switch(status) {
      case 'kembali':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-[10px] font-bold">
            <CheckCircle2 size={12} />
            Dikembalikan
          </span>
        );
      case 'dipinjam':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-[10px] font-bold">
            <Clock size={12} />
            Sedang Dipinjam
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 md:p-6 rounded-3xl text-white shadow-lg shadow-blue-500/20">
        <h2 className="text-xl md:text-2xl font-extrabold mb-1">Perpustakaan Digital</h2>
        <p className="opacity-80 text-xs md:text-sm font-medium">Cari buku favoritmu dan cek riwayat peminjaman.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700 px-4">
        <button 
          onClick={() => setActiveTab('catalog')} 
          className={`pb-4 px-2 font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'catalog' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <BookOpen size={16} /> E-Katalog Buku
        </button>
        <button 
          onClick={() => setActiveTab('loans')} 
          className={`pb-4 px-2 font-bold transition-all text-sm flex items-center gap-2 ${activeTab === 'loans' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <Clock size={16} /> Riwayat Peminjaman
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Search Bar */}
          <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari judul, penulis, atau topik..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="aspect-[3/5] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : books.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {books.map((book) => (
            <div key={book.id} className="bg-white dark:bg-gray-800 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col group">
              <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-900">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <BookIcon size={32} />
                    <span className="text-[10px] font-bold mt-2">NO COVER</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm ${book.available_stock > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {book.available_stock > 0 ? 'Tersedia' : 'Kosong'}
                  </div>
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1 mb-1">{book.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-3">{book.author}</p>
                
                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <MapPin size={12} className="text-orange-500" />
                    <span>Rak: {book.location || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <Layers size={12} className="text-blue-500" />
                    <span>Stok: {book.available_stock}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <BookOpen className="mx-auto text-gray-200 mb-4" size={48} />
          <p className="text-gray-400 font-medium">Buku tidak ditemukan</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-center gap-4 py-6">
          <button 
            disabled={pagination.current_page === 1}
            onClick={() => setPagination({ ...pagination, current_page: pagination.current_page - 1 })}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-500">
            {pagination.current_page} / {pagination.last_page}
          </span>
          <button 
            disabled={pagination.current_page === pagination.last_page}
            onClick={() => setPagination({ ...pagination, current_page: pagination.current_page + 1 })}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

          <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl flex gap-4 border border-blue-100 dark:border-blue-800/30">
            <Info className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
              <strong>Tips:</strong> Jika buku tersedia, silakan datang ke perpustakaan dan scan kartu siswamu ke pustakawan untuk meminjam. Maksimal peminjaman adalah 7 hari.
            </p>
          </div>
        </>
      ) : (
        /* Loans Tab */
        <div className="space-y-4">
          {isLoansLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Clock className="animate-spin text-primary" size={32} />
              <p className="text-sm text-gray-500 font-medium">Memuat riwayat peminjaman...</p>
            </div>
          ) : loans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loans.map(loan => {
                const isOverdue = moment().isAfter(moment(loan.due_date)) && loan.status === 'dipinjam';
                return (
                  <div key={loan.id} className={`p-5 rounded-[2rem] border shadow-sm flex items-start gap-4 transition-all ${isOverdue ? 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700/50'}`}>
                    <div className="w-16 h-20 bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden shrink-0 shadow-sm">
                      {loan.book?.cover_url ? (
                        <img src={loan.book.cover_url} alt={loan.book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <BookIcon size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-2">{loan.book?.title}</h4>
                        {getStatusBadge(loan.status, loan.due_date)}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 truncate">{loan.book?.author || 'Penulis Anonim'}</p>
                      
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <CalendarDays size={12} className="text-blue-500" />
                          <span>Pinjam: {moment(loan.loan_date).format('DD MMM YYYY')}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                          <AlertTriangle size={12} className={isOverdue ? 'text-red-500' : 'text-orange-500'} />
                          <span>Tenggat: {moment(loan.due_date).format('DD MMM YYYY')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center">
              <BookOpen className="mx-auto text-gray-200 mb-4" size={48} />
              <p className="text-gray-400 font-medium">Belum ada riwayat peminjaman buku.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentLibraryPage;
