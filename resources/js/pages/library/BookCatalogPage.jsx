import React, { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { 
  Search, 
  Plus, 
  Book as BookIcon, 
  Trash2, 
  Edit, 
  RefreshCw, 
  BookOpen, 
  MapPin, 
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Camera,
  ScanBarcode,
  Printer,
  Square,
  CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import PrintBarcodeLabelModal from '../../components/PrintBarcodeLabelModal';
import { useSettings } from '../../utils/SettingsContext';

const BookCatalogPage = () => {
  const { userProfile } = useSettings();
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  // Print Label State
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editId, setEditId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'Fiksi',
    total_stock: 1,
    location: '',
    cover_url: ''
  });

  const categories = ['Fiksi', 'Sains', 'Sejarah', 'Religi', 'Bahasa', 'Seni', 'Lainnya'];

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
      toast.error('Gagal memuat data buku');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBookSelection = (book) => {
    if (selectedBooks.find(b => b.id === book.id)) {
      setSelectedBooks(selectedBooks.filter(b => b.id !== book.id));
    } else {
      setSelectedBooks([...selectedBooks, book]);
    }
  };

  const selectAllBooks = () => {
    if (selectedBooks.length === books.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks([...books]);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, current_page: 1 });
    fetchBooks();
  };

  const handleIsbnLookup = async (isbnOverride = null) => {
    // If the event is passed (e.g. from onClick), ignore it.
    const searchIsbn = typeof isbnOverride === 'string' ? isbnOverride : formData.isbn;
    
    if (!searchIsbn) {
      toast.error('Masukkan nomor ISBN terlebih dahulu');
      return;
    }

    setIsLookupLoading(true);
    try {
      const response = await api.get(`/library/books/lookup/${searchIsbn}`);
      const data = response.data;
      
      setFormData({
        ...formData,
        title: data.title || '',
        author: data.author || '',
        category: data.category || 'Lainnya',
        cover_url: data.cover_url || ''
      });
      toast.success('Data buku berhasil ditemukan!');
    } catch (error) {
      toast.error('Buku tidak ditemukan. Silakan isi manual.');
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleScanSuccess = (decodedText) => {
    setFormData(prev => ({ ...prev, isbn: decodedText }));
    toast.success(`Barcode terbaca: ${decodedText}`);
    // Otomatis lookup setelah scan berhasil
    handleIsbnLookup(decodedText);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/library/books/${editId}`, formData);
        toast.success('Buku berhasil diperbarui');
      } else {
        await api.post('/library/books', formData);
        toast.success('Buku berhasil ditambahkan');
      }
      
      setShowAddModal(false);
      setEditId(null);
      setFormData({
        title: '',
        author: '',
        isbn: '',
        category: 'Fiksi',
        total_stock: 1,
        location: '',
        cover_url: ''
      });
      fetchBooks();
    } catch (error) {
      const message = error.response?.data?.errors?.isbn ? 'ISBN sudah terdaftar' : 'Gagal menyimpan data';
      toast.error(message);
    }
  };

  const handleEditRequest = (book) => {
    setEditId(book.id);
    setFormData({
      title: book.title,
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || 'Fiksi',
      total_stock: book.total_stock || 1,
      location: book.location || '',
      cover_url: book.cover_url || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus buku ini?')) return;
    
    try {
      await api.delete(`/library/books/${id}`);
      toast.success('Buku dihapus');
      fetchBooks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menghapus buku');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Katalog Buku</h2>
          <p className="text-gray-500 dark:text-gray-400">Kelola koleksi literasi sekolah Anda</p>
        </div>
        <div className="flex gap-2">
          {selectedBooks.length > 0 && (
            <button 
              onClick={() => setShowPrintModal(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-2xl shadow-lg shadow-gray-800/20 hover:bg-gray-700 transition-all transform active:scale-95"
            >
              <Printer size={20} />
              <span className="hidden sm:inline">Cetak Label ({selectedBooks.length})</span>
            </button>
          )}
          <button 
            onClick={() => {
              setEditId(null);
              setFormData({
                title: '',
                author: '',
                isbn: '',
                category: 'Fiksi',
                total_stock: 1,
                location: '',
                cover_url: ''
              });
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all transform active:scale-95"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Tambah Buku</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Cari judul, penulis, atau ISBN..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
        <button 
          onClick={fetchBooks}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
        >
          Terapkan Filter
        </button>
        {books.length > 0 && (
          <button 
            onClick={selectAllBooks}
            className="px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all whitespace-nowrap"
          >
            {selectedBooks.length === books.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
          </button>
        )}
      </div>

      {/* Book Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="animate-spin text-primary" size={40} />
          <p className="text-gray-500 font-medium">Memuat koleksi buku...</p>
        </div>
      ) : books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {books.map((book) => (
            <div key={book.id} className="group bg-white dark:bg-gray-800 rounded-[2rem] overflow-hidden border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col">
              <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-900">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                    <BookIcon size={48} />
                    <span className="text-xs font-medium uppercase tracking-widest">No Cover</span>
                  </div>
                )}
                
                {/* Select Checkbox */}
                <div className="absolute top-4 left-4 z-10">
                  <button 
                    onClick={() => toggleBookSelection(book)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center backdrop-blur-md transition-all shadow-sm ${selectedBooks.find(b => b.id === book.id) ? 'bg-primary text-white border-none' : 'bg-white/90 dark:bg-black/60 text-gray-400 border border-gray-200 dark:border-gray-700 hover:text-primary'}`}
                  >
                    {selectedBooks.find(b => b.id === book.id) ? <Check size={14} strokeWidth={3} /> : <Square size={14} />}
                  </button>
                </div>

                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="px-3 py-1 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full text-[10px] font-bold text-primary shadow-sm border border-primary/10">
                    {book.category}
                  </div>
                </div>
              </div>
              
              <div className="p-3 flex-1 flex flex-col">
                <div className="mb-2">
                  <h3 className="font-bold text-gray-800 dark:text-white line-clamp-2 text-sm group-hover:text-primary transition-colors leading-tight" title={book.title}>
                    {book.title}
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{book.author || 'Penulis Anonim'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <Layers className="text-primary shrink-0" size={12} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] text-gray-400 uppercase font-bold leading-none">Stok</span>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate">{book.available_stock}/{book.total_stock}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <MapPin className="text-orange-500 shrink-0" size={12} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] text-gray-400 uppercase font-bold leading-none">Rak</span>
                      <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate">{book.location || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-1 border-t border-gray-50 dark:border-gray-700 pt-2">
                  <span className="text-[8px] font-mono text-gray-400 truncate max-w-[60%]">{book.isbn || 'Tanpa ISBN'}</span>
                  <div className="flex gap-0.5">
                    <button 
                      onClick={() => handleEditRequest(book)}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                    >
                      <Edit size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(book.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] py-20 flex flex-col items-center justify-center text-center px-4 border border-dashed border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="text-gray-300" size={40} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Belum ada koleksi buku</h3>
          <p className="text-gray-500 max-w-sm mb-8">Mulailah dengan menambahkan buku pertama Anda secara manual atau menggunakan ISBN lookup.</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
          >
            Tambah Buku Sekarang
          </button>
        </div>
      )}

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <button 
            disabled={pagination.current_page === 1}
            onClick={() => setPagination({ ...pagination, current_page: pagination.current_page - 1 })}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 disabled:opacity-50 shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
            Halaman {pagination.current_page} dari {pagination.last_page}
          </span>
          <button 
            disabled={pagination.current_page === pagination.last_page}
            onClick={() => setPagination({ ...pagination, current_page: pagination.current_page + 1 })}
            className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 disabled:opacity-50 shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddModal(false)} />
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-8 pb-0 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{editId ? 'Edit Koleksi' : 'Tambah Koleksi'}</h3>
                <p className="text-sm text-gray-500">{editId ? 'Perbarui data buku ini' : 'Scan ISBN untuk pengisian otomatis'}</p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditId(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Nomor ISBN</label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        placeholder="Contoh: 978602..." 
                        className="w-full pl-4 pr-12 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white font-mono"
                        value={formData.isbn}
                        onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      />
                      <button 
                        type="button"
                        onClick={() => handleIsbnLookup()}
                        disabled={isLookupLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all disabled:opacity-50"
                        title="Cari Otomatis"
                      >
                        {isLookupLoading ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      </button>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="px-4 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex items-center justify-center shadow-sm"
                      title="Scan Barcode via Kamera"
                    >
                      <ScanBarcode size={22} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Judul Buku</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Pengarang</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Kategori</label>
                  <select 
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Jumlah Stok</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.total_stock}
                    onChange={(e) => setFormData({ ...formData, total_stock: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Lokasi Rak</label>
                  <input 
                    type="text" 
                    placeholder="B-01-A"
                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-2 tracking-widest">Tautan Sampul Buku / Gambar (Opsional)</label>
                <input 
                  type="url" 
                  placeholder="https://... (Otomatis terisi jika pakai fitur Scan ISBN)"
                  className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all dark:text-white"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                />
              </div>

              {formData.cover_url && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center gap-4">
                  <img 
                    src={formData.cover_url} 
                    alt="Cover Preview" 
                    className="h-16 w-12 object-cover rounded-lg shadow-sm bg-gray-200" 
                    onError={(e) => { e.target.onerror = null; e.target.src = '/branding_logo.png'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Pratinjau Sampul</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70 truncate">{formData.cover_url}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, cover_url: '' })}
                    className="p-2 text-blue-400 hover:text-red-500 transition-colors shrink-0"
                    title="Hapus Gambar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditId(null);
                  }}
                  className="flex-1 px-4 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  {editId ? 'Simpan Perubahan' : 'Simpan Buku'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal 
        isOpen={showScanner} 
        onClose={() => setShowScanner(false)} 
        onScanSuccess={handleScanSuccess} 
      />
      {/* Modal Cetak Barcode Label */}
      <PrintBarcodeLabelModal 
        isOpen={showPrintModal} 
        onClose={() => setShowPrintModal(false)} 
        selectedBooks={selectedBooks} 
        logoUrl={userProfile?.logoUrl}
      />
    </div>
  );
};

export default BookCatalogPage;
