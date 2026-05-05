import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  MonitorPlay, BookOpen, BarChart2, ClipboardList,
  LogOut, Menu, X, School, ChevronRight, User, Loader2,
  ShieldAlert, CalendarDays, Library
} from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StudentChatWidget from './StudentChatWidget';
import { useSettings } from '../utils/SettingsContext';

const NAV_ITEMS = [
  { path: '/siswa',               icon: MonitorPlay,    label: 'Pantau Belajar',  desc: 'Realtime & hari ini' },
  { path: '/siswa/jadwal',        icon: CalendarDays,   label: 'Jadwal',          desc: 'Jadwal Mingguan' },
  { path: '/siswa/kehadiran',     icon: BookOpen,        label: 'Presensi',        desc: 'Rekap presensi' },
  { path: '/siswa/nilai',         icon: BarChart2,       label: 'Nilai',           desc: 'Laporan nilai' },
  { path: '/siswa/tugas',         icon: ClipboardList,   label: 'Tugas',           desc: 'Tugas belum selesai', hideOnMobile: true },
  { path: '/siswa/pelanggaran',   icon: ShieldAlert,     label: 'Pelanggaran',     desc: 'Catatan poin tatib', hideOnMobile: true },
  { path: '/siswa/perpustakaan',  icon: Library,         label: 'Perpustakaan',    desc: 'Katalog buku digital', hideOnMobile: true },
];

export default function StudentLayout({ user, onLogout, children }) {
  const { userProfile } = useSettings();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [studentInfo, setStudentInfo] = useState(null);
  const [schoolName, setSchoolName]   = useState('Sekolah');
  const navigate = useNavigate();

  // Fetch student profile on mount
  useEffect(() => {
    api.get('/student/realtime')
      .then(res => {
        setStudentInfo(res.data?.student ?? null);
        if (res.data?.school_name) {
          setSchoolName(res.data.school_name);
        }
      })
      .catch(() => {/* silently fail — sidebar shows fallback */});
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
    navigate('/login');
  };

  const sidebar = (
    <aside className="flex flex-col h-full bg-gradient-to-b from-emerald-700 to-teal-800 text-white w-72 shrink-0">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2">
            <School size={22} />
          </div>
          <div className="flex flex-col min-w-0">
            <p className="text-[11px] font-black text-white/90 uppercase tracking-[0.2em] leading-none mb-1 truncate">{schoolName}</p>
            <p className="font-bold text-sm leading-tight text-white/60">Si Pesek Pintar</p>
          </div>
        </div>
      </div>

      {/* Student Card */}
      <div className="mx-4 mt-4 mb-2 bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <User size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{studentInfo?.name ?? user?.name}</p>
          {studentInfo ? (
            <>
              <p className="text-xs text-white/80 truncate font-medium">Kelas {studentInfo.class}</p>
              <p className="text-xs text-white/50 truncate">No. Absen {studentInfo.absen} · NISN {studentInfo.nisn}</p>
            </>
          ) : (
            <p className="text-xs text-white/50 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Memuat info kelas...
            </p>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/siswa'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-white text-emerald-700 shadow-md font-semibold'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} className={isActive ? 'text-emerald-600' : ''} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className={`text-xs truncate ${isActive ? 'text-emerald-500' : 'text-white/50'}`}>{item.desc}</p>
                </div>
                {isActive && <ChevronRight size={14} className="text-emerald-500 shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">Keluar</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        {sidebar}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="flex h-full">
            {sidebar}
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-emerald-700 text-white shadow-md shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-white/10">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1 px-2">
            {userProfile?.logoUrl ? (
              <img 
                src={userProfile.logoUrl} 
                alt="School Logo" 
                className="h-10 w-10 object-contain rounded-lg bg-white p-1 shadow-sm shrink-0" 
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0">
                <School size={20} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <p className="text-[10px] font-black text-white/90 uppercase tracking-[0.15em] leading-none mb-1 truncate">
                {userProfile?.school_name || schoolName}
              </p>
              <p className="font-bold text-sm leading-tight">Si Pesek Pintar</p>
              {studentInfo && <p className="text-[10px] text-white/60 mt-0.5">Kelas {studentInfo.class}</p>}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80"
            title="Keluar"
          >
            <LogOut size={20} />
          </button>
        </header>

        {/* Page content */}
        <main key={window.location.pathname} className="flex-1 overflow-y-auto p-4 md:p-6 pb-36 lg:pb-10 animate-fade-in-premium">
          {children}
        </main>

        {/* Global Floating Widgets (Fixed outside main scroll area) */}
        <StudentChatWidget />

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom,0px)]">
          {NAV_ITEMS.filter(item => !item.hideOnMobile).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/siswa'}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1.5 py-3 px-1 transition-all duration-500 group ${
                  isActive ? 'text-emerald-700 scale-110' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-2 rounded-2xl transition-all duration-500 ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                      : 'bg-transparent group-hover:bg-slate-100'
                  }`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[9px] font-black tracking-widest uppercase transition-all duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                  }`}>
                    {item.label.split(' ')[0]}
                  </span>
                  {isActive && (
                    <div className="absolute -top-[1px] w-10 h-[3px] bg-emerald-600 rounded-b-full shadow-[0_2px_10px_rgba(5,150,105,0.4)] animate-in slide-in-from-top-1" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
