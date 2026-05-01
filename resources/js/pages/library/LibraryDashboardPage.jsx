import React, { useState, useEffect } from 'react';
import api from '../../lib/axios';
import { 
  Book as BookIcon, 
  ArrowRightLeft, 
  AlertTriangle, 
  Users, 
  History,
  TrendingUp,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

const LibraryDashboardPage = () => {
  const [stats, setStats] = useState({
    total_books: 0,
    active_loans: 0,
    total_students_borrowing: 0,
    overdue_loans: 0
  });
  const [recentLoans, setRecentLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, loansRes] = await Promise.all([
          api.get('/library/loans/stats'),
          api.get('/library/loans?per_page=5')
        ]);
        setStats(statsRes.data);
        setRecentLoans(loansRes.data.data);
      } catch (error) {
        console.error('Error fetching dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel }) => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-xl transition-all duration-500 group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-4 rounded-2xl ${color} bg-opacity-10 ${color.replace('bg-', 'text-')} transition-transform group-hover:scale-110`}>
          <Icon size={24} />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-black text-gray-800 dark:text-white mt-1">{value}</p>
        </div>
      </div>
      {subValue && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50">
          <span className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{subValue}</span>
          <span className="text-xs text-gray-400">{subLabel}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight">Dashboard Perpustakaan</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Pantau aktivitas literasi dan sirkulasi buku hari ini</p>
        </div>
        <div className="flex gap-3">
          <Link 
            to="/library/loans" 
            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <ArrowRightLeft size={20} />
            Sirkulasi Baru
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Koleksi" 
          value={stats.total_books} 
          icon={BookIcon} 
          color="bg-blue-500" 
          subValue="+12" 
          subLabel="Bulan ini"
        />
        <StatCard 
          title="Pinjaman Aktif" 
          value={stats.active_loans} 
          icon={ArrowRightLeft} 
          color="bg-emerald-500" 
          subValue={stats.total_students_borrowing} 
          subLabel="Siswa meminjam"
        />
        <StatCard 
          title="Buku Terlambat" 
          value={stats.overdue_loans} 
          icon={AlertTriangle} 
          color="bg-red-500" 
          subValue={stats.overdue_loans > 0 ? "Perlu Tindakan" : "Aman"} 
          subLabel=""
        />
        <StatCard 
          title="Tingkat Literasi" 
          value="84%" 
          icon={TrendingUp} 
          color="bg-purple-500" 
          subValue="+5%" 
          subLabel="Dari rata-rata"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
              <History className="text-primary" />
              Aktivitas Terbaru
            </h3>
            <Link to="/library/loans" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
              Lihat Semua <ChevronRight size={16} />
            </Link>
          </div>
          <div className="p-2">
            {isLoading ? (
              <div className="p-10 text-center text-gray-400">Memuat aktivitas...</div>
            ) : recentLoans.length > 0 ? (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {recentLoans.map((loan) => (
                  <div key={loan.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-2xl transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.status === 'kembali' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {loan.status === 'kembali' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-white text-sm">
                          {loan.student?.name} <span className="font-normal text-gray-500">meminjam</span> {loan.book?.title}
                        </p>
                        <p className="text-xs text-gray-400">{moment(loan.created_at).fromNow()}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${loan.status === 'kembali' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      {loan.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-gray-400">Belum ada aktivitas hari ini</div>
            )}
          </div>
        </div>

        {/* Quick Actions & Links */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
            <h3 className="text-xl font-bold mb-4">Akses Cepat</h3>
            <div className="grid grid-cols-1 gap-3">
              <Link to="/library/books" className="flex items-center gap-4 p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group">
                <div className="p-3 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                  <BookOpen size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Kelola Katalog</p>
                  <p className="text-[10px] opacity-70">Update koleksi buku</p>
                </div>
              </Link>
              <Link to="/library/loans" className="flex items-center gap-4 p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all group">
                <div className="p-3 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                  <ArrowRightLeft size={20} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Input Sirkulasi</p>
                  <p className="text-[10px] opacity-70">Catat pinjam/kembali</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-700/50 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="text-purple-500" size={18} />
              Tips Pustakawan
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">Gunakan fitur **Mode Scan** untuk mempercepat peminjaman massal di jam istirahat.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 shrink-0" />
                <p className="text-xs text-gray-500 leading-relaxed">Selalu update **Lokasi Rak** agar siswa lebih mudah mencari buku dari katalog digital mereka.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryDashboardPage;
