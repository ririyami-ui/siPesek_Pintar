import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  LogOut,
  Menu,
  X,
  Library,
  User,
  Sun,
  Moon,
  ChevronRight,
  Zap,
  Bell,
  Settings
} from 'lucide-react';
import useDarkMode from '../hooks/useDarkMode';
import { Link, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useSettings } from '../utils/SettingsContext';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/library/dashboard' },
  { name: 'Katalog Buku', icon: BookOpen, path: '/library/books' },
  { name: 'Sirkulasi & Pinjaman', icon: BookMarked, path: '/library/loans' },
];

export default function LibrarianLayout({ children, user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [colorTheme, setTheme] = useDarkMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useSettings();

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('token');
      if (onLogout) onLogout();
      navigate('/login');
    } catch (error) {
      localStorage.removeItem('token');
      if (onLogout) onLogout();
      navigate('/login');
    }
  };

  const sidebar = (
    <aside className="flex flex-col h-full bg-slate-900 text-white w-72 shrink-0 border-r border-slate-800 shadow-2xl">
      {/* Brand */}
      <div className="px-8 py-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 p-3 rounded-2xl text-primary shadow-lg shadow-primary/10">
            <Library size={28} />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight leading-none mb-1">SI-PESEK</h1>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Library Hub</p>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="m-4 p-4 bg-white/5 rounded-3xl flex items-center gap-3 border border-white/5">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
          <User size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{userProfile?.name || user?.name}</p>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {user?.role === 'admin' || user?.role === 'adminer' ? 'Administrator' : 'Pustakawan'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${
                isActive
                  ? 'bg-primary text-white shadow-xl shadow-primary/20'
                  : 'text-white/50 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-bold text-sm">{item.name}</span>
          </NavLink>
        ))}

        {/* Back to Admin for Admins */}
        {(user?.role === 'admin' || user?.role === 'adminer') && (
          <div className="pt-4 mt-4 border-t border-white/5">
            <Link
              to="/"
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-orange-400 hover:bg-orange-500/10 transition-all group"
            >
              <LayoutDashboard size={20} />
              <span className="font-bold text-sm">Kembali ke Admin</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <button 
          onClick={() => setTheme(colorTheme)}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white/50 hover:bg-white/10 transition-all"
        >
          {colorTheme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
          <span className="font-bold text-sm">Mode {colorTheme === 'light' ? 'Terang' : 'Gelap'}</span>
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={20} />
          <span className="font-bold text-sm">Keluar</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        {sidebar}
      </div>

      {/* Mobile Menu Overlay */}
      {!isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="animate-slide-right h-full">
            {sidebar}
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(true)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              <Menu size={24} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div className="flex flex-col">
              <h2 className="font-black text-slate-800 dark:text-white text-xl tracking-tight leading-none">
                {NAV_ITEMS.find(i => i.path === location.pathname)?.name || 'Perpustakaan'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sistem Aktif</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right mr-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{userProfile?.school_name || 'Sekolah'}</p>
              <p className="text-[10px] text-slate-300">Workspace Terisolasi</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <Bell size={20} />
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
