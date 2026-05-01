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
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const StudentLibraryPage = () => {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });

  useEffect(() => {
    fetchBooks();
  }, [pagination.current_page]);

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

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, current_page: 1 });
    fetchBooks();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
        <h2 className="text-3xl font-extrabold mb-2">E-Katalog Perpustakaan</h2>
        <p className="opacity-80 text-sm font-medium">Cari buku favoritmu dan cek ketersediaannya sebelum ke perpustakaan.</p>
      </div>

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
    </div>
  );
};

export default StudentLibraryPage;
