import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import CreateProfilePage from '../pages/CreateProfilePage';
import {
  Bell,
  Calendar,
  ClipboardList,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
  FileText,
  User,
  Sun,
  Moon,
  Archive,
  Loader,
  Info,
  BarChart,
  Bot,
  ShieldAlert,
  ShieldX,
  Trophy,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Zap,
  Edit3,
  ShieldCheck,
  PieChart,
  Settings2,
  Sparkles,
  BrainCircuit,
  ListTodo,
  WifiOff,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import useDarkMode from '../hooks/useDarkMode';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import OfflineIndicator from './OfflineIndicator';
import { LocalNotifications } from '@capacitor/local-notifications';
import useTaskNotifications from '../hooks/useTaskNotifications';
import useScheduleNotifications from '../hooks/useScheduleNotifications';
import { useSettings } from '../utils/SettingsContext';

const NAV_CATEGORIES = [
  {
    title: 'Utama',
    icon: <Zap size={14} />,
    items: [
      { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
      { name: 'Asisten Guru', icon: <Bot size={20} />, path: '/asisten-guru' },
    ]
  },
  {
    title: 'Perencanaan',
    icon: <Edit3 size={14} />,
    items: [
      { name: 'Jadwal Mengajar', icon: <Calendar size={20} />, path: '/jadwal' },
      { name: 'Program Mengajar', icon: <BookOpen size={20} />, path: '/program-mengajar' },
      { name: 'Penyusunan RPP', icon: <Sparkles size={20} />, path: '/rpp' },
      { name: 'Generator LKPD', icon: <ClipboardList size={20} />, path: '/lkpd-generator' },
      { name: 'Generator Bahan Ajar', icon: <BookOpen size={20} />, path: '/handout-generator' },
      { name: 'Generator Soal', icon: <BrainCircuit size={20} />, path: '/quiz-generator' },
    ]
  },
  {
    title: 'Akademik',
    icon: <BookOpen size={14} />,
    items: [
      { name: 'Monitoring Absensi', icon: <Users size={20} />, path: '/monitoring-absensi' },
      { name: 'Jurnal Mengajar', icon: <FileText size={20} />, path: '/jurnal' },
      { name: 'Monitoring Nilai', icon: <GraduationCap size={20} />, path: '/monitoring-nilai' },
    ]
  },
  {
    title: 'Kedisiplinan',
    icon: <ShieldCheck size={14} />,
    items: [
      { name: 'Catatan Pelanggaran', icon: <ShieldX size={20} />, path: '/pelanggaran' },
      { name: 'Leaderboard', icon: <Trophy size={20} />, path: '/leaderboard' },
    ]
  },
  {
    title: 'Analisis & Rekap',
    icon: <PieChart size={14} />,
    items: [
      { name: 'Rekapitulasi', icon: <Archive size={20} />, path: '/rekapitulasi' },
      { name: 'Rekap Individu', icon: <User size={20} />, path: '/rekap-individu' },
      { name: 'Analisis Kelas', icon: <ClipboardCheck size={20} />, path: '/analisis-kelas' },
      { name: 'Sistem Peringatan Dini', icon: <ShieldAlert size={20} />, path: '/sistem-peringatan' },
    ]
  },
  {
    title: 'Sistem',
    icon: <Settings2 size={14} />,
    items: [
      { name: 'Master Data', icon: <Settings size={20} />, path: '/master-data' },
      { name: 'Tentang Aplikasi', icon: <Info size={20} />, path: '/about' },
    ]
  }
];

const TEACHER_NAV_CATEGORIES = [
  {
    title: 'Dashboard Guru',
    icon: <Zap size={14} />,
    items: [
      { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/' },
      { name: 'Asisten Guru', icon: <Bot size={20} />, path: '/asisten-guru' },
    ]
  },
  {
    title: 'Perencanaan',
    icon: <Edit3 size={14} />,
    items: [
      { name: 'Jadwal Mengajar', icon: <Calendar size={20} />, path: '/jadwal' },
      { name: 'Program Mengajar', icon: <BookOpen size={20} />, path: '/program-mengajar' },
      { name: 'Penyusunan RPP', icon: <Sparkles size={20} />, path: '/rpp' },
      { name: 'Generator LKPD', icon: <ClipboardList size={20} />, path: '/lkpd-generator' },
      { name: 'Generator Bahan Ajar', icon: <BookOpen size={20} />, path: '/handout-generator' },
      { name: 'Generator Soal', icon: <BrainCircuit size={20} />, path: '/quiz-generator' },
    ]
  },
  {
    title: 'Akademik',
    icon: <BookOpen size={14} />,
    items: [
      { name: 'Absensi Siswa', icon: <ClipboardList size={20} />, path: '/absensi' },
      { name: 'Jurnal Mengajar', icon: <FileText size={20} />, path: '/jurnal' },
      { name: 'Input Nilai', icon: <GraduationCap size={20} />, path: '/nilai' },
      { name: 'Penilaian KKTP', icon: <ClipboardCheck size={20} />, path: '/penilaian-kktp' },
      { name: 'Penugasan Siswa', icon: <ListTodo size={20} />, path: '/penugasan' },
    ]
  },
  {
    title: 'Kedisiplinan',
    icon: <ShieldCheck size={14} />,
    items: [
      { name: 'Catatan Pelanggaran', icon: <ShieldX size={20} />, path: '/pelanggaran' },
      { name: 'Leaderboard', icon: <Trophy size={20} />, path: '/leaderboard' },
    ]
  },
  {
    title: 'Analisis & Rekap',
    icon: <PieChart size={14} />,
    items: [
      { name: 'Rekapitulasi', icon: <Archive size={20} />, path: '/rekapitulasi' },
      { name: 'Rekap Individu', icon: <User size={20} />, path: '/rekap-individu' },
      { name: 'Analisis Kelas', icon: <ClipboardCheck size={20} />, path: '/analisis-kelas' },
      { name: 'Sistem Peringatan Dini', icon: <ShieldAlert size={20} />, path: '/sistem-peringatan' },
    ]
  },
  {
    title: 'Master Data',
    icon: <Settings2 size={14} />,
    items: [
      { name: 'Data Saya', icon: <User size={20} />, path: '/master-data' },
    ]
  }
];

export default function DashboardLayout({ children, user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarOpen');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [colorTheme, setTheme] = useDarkMode();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState([]);
  const [unseenNotificationsCount, setUnseenNotificationsCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeSemester, academicYear, userProfile, loadingSettings } = useSettings();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const categories = user?.role?.toLowerCase() === 'admin' ? NAV_CATEGORIES : TEACHER_NAV_CATEGORIES;

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useTaskNotifications(activeSemester, academicYear);
  useScheduleNotifications();
  const { 
    smartAudioEnabled: isAudioEnabled, 
    setSmartAudioEnabled: setIsAudioEnabled, 
    isAudioUnlocked 
  } = useSettings();

  // State for expanded categories
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const activeCategory = categories.find(cat =>
      cat.items.some(item => item.path === location.pathname)
    );
    return activeCategory ? { [activeCategory.title]: true } : { [categories[0].title]: true };
  });

  const toggleCategory = (title) => {
    setExpandedCategories(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  useEffect(() => {
    localStorage.setItem('sidebarOpen', isSidebarOpen);
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('token');
      if (onLogout) onLogout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      // Force logout even if API fails
      localStorage.removeItem('token');
      if (onLogout) onLogout();
      navigate('/login');
    }
  };

  useEffect(() => {
    const fetchAndSetUnseenNotifications = async () => {
      try {
        const { notifications } = await LocalNotifications.getPending();
        const seenNotificationIds = JSON.parse(localStorage.getItem('seenNotifications')) || [];
        const newUnseenNotifications = notifications.filter(n => !seenNotificationIds.includes(n.id.toString()));
        setUnseenNotificationsCount(newUnseenNotifications.length);
      } catch (error) {
        console.error("Error fetching notifications for unseen count:", error);
      }
    };

    fetchAndSetUnseenNotifications();
  }, []);

  const NavItem = ({ item, isMobile }) => {
    const isActive = location.pathname === item.path;

    return (
      <Link
        to={item.path}
        onClick={() => {
          if (isMobile) setIsSidebarOpen(false);
        }}
        className={`flex items-center w-full gap-3 p-2.5 rounded-xl transition-all duration-500 group relative overflow-hidden ${isActive
          ? 'text-white scale-[1.02]'
          : 'text-text-muted-light dark:text-text-muted-dark md:hover:bg-primary/5 dark:md:hover:bg-primary/10 md:hover:text-primary'
          }`}
      >
        {/* Active Background Pill */}
        {isActive && (
          <div className="absolute inset-0 bg-primary shadow-lg shadow-primary/20 animate-fade-in-up" />
        )}

        {/* Content */}
        <span className={`relative z-10 ${isActive ? 'text-white' : 'text-primary'} transition-transform duration-500 group-hover:scale-110`}>
          {item.icon}
        </span>
        <span className="relative z-10 text-sm font-bold tracking-tight">{item.name}</span>

        {/* Glow effect for active item */}
        {isActive && (
          <div className="absolute -inset-1 bg-white/20 blur-xl rounded-full opacity-50 z-0 pointer-events-none" />
        )}
      </Link>
    );
  };

  const footerNavItems = [
    { ...categories[0].items[0], shortName: 'Dashboard' },
    { ...categories[2].items[0], shortName: 'Absen' },
    { ...categories[2].items[2], shortName: 'Nilai' },
    { ...categories[2].items[1], shortName: 'Jurnal' },
    { ...categories[0].items[1], shortName: 'Si Pintar' }
  ].filter(Boolean);

  // Show loading while fetching settings
  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <Loader className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  // Show create profile page if user doesn't have profile yet
  if (!userProfile) {
    return <CreateProfilePage onProfileCreated={() => window.location.reload()} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 flex-col bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-r border-gray-100 dark:border-gray-800/50 p-4 shadow-2xl transition-transform duration-300 ease-in-out hidden md:flex ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between gap-3 px-4 py-2 h-20 border-b border-gray-100 dark:border-gray-800/50">
          <div className="flex items-center gap-3">
            <img src={(window.Laravel?.baseUrl || "") + "/Logo Smart Teaching Baru_.png"} alt="Si Pesek Pintar Logo" className="h-10 w-auto" />
            <div className="flex flex-col">
              <h1 className="font-sans text-lg font-extrabold text-blue-600 dark:text-blue-500 tracking-tight leading-tight">Si Pesek</h1>
              <h1 className="font-sans text-lg font-extrabold text-gray-800 dark:text-white tracking-tight leading-tight -mt-1">Pintar</h1>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400"
          >
            <ChevronRight className="rotate-180" size={18} />
          </button>
        </div>
        <nav className="flex-1 h-full overflow-y-auto pr-2 custom-scrollbar">
          {categories.map((category, idx) => {
            const isExpanded = expandedCategories[category.title];
            const hasActiveItem = category.items.some(item => item.path === location.pathname);

            return (
              <div key={category.title} className={idx > 0 ? 'mt-4' : ''}>
                <button
                  onClick={() => toggleCategory(category.title)}
                  className={`flex items-center justify-between w-full px-4 py-3 mb-1 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 group ${hasActiveItem
                    ? 'text-primary bg-primary/10 dark:bg-primary/20 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`transition-transform duration-300 ${isExpanded ? 'scale-110' : 'opacity-70'}`}>
                      {category.icon}
                    </span>
                    <span>{category.title}</span>
                  </div>
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <ul className="space-y-1.5 ml-2.5 pl-2 border-l-2 border-primary/10 dark:border-primary/5">
                    {category.items
                      .filter(item => !item.roles || item.roles.includes(user?.role))
                      .map((item) => (
                        <li key={item.path}>
                          <NavItem item={item} isMobile={false} />
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
              <User size={20} className="text-primary dark:text-primary-300" />
            </div>
            <p className="truncate text-sm font-medium text-text-light dark:text-text-dark">{userProfile?.name || user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-red-500 transition-colors duration-200 hover:bg-red-100 dark:hover:bg-red-900/50 dark:hover:text-white"
          >
            <LogOut size={20} />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-lg p-3 md:p-4 shadow-sm transition-all duration-300 ${isSidebarOpen ? 'md:left-64' : 'md:left-0'}`}>
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1 mr-2">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 flex-shrink-0">
            <Menu size={24} />
          </button>
          <div className="flex flex-col md:flex-row md:items-baseline md:gap-2 min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-2 md:line-clamp-none leading-tight md:leading-normal">
              {categories.flatMap(c => c.items).find((item) => item.path === location.pathname)?.name || 'Dashboard'}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {isOffline && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 dark:bg-red-500/20 text-red-500 rounded-lg animate-pulse">
              <WifiOff size={16} />
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Offline</span>
            </div>
          )}
          <button onClick={() => setTheme(colorTheme)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            {colorTheme === 'light' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
          <div className="relative">
            <button
              onClick={async () => {
                if (showNotificationsDropdown) {
                  setShowNotificationsDropdown(false);
                  if (pendingNotifications.length > 0) {
                    await LocalNotifications.cancel({ notifications: pendingNotifications.map(n => ({ id: n.id })) });
                  }
                  setPendingNotifications([]);
                } else {
                  try {
                    const { notifications } = await LocalNotifications.getPending();
                    setPendingNotifications(notifications);
                    const notificationIds = notifications.map(n => n.id.toString());
                    localStorage.setItem('seenNotifications', JSON.stringify(notificationIds));
                    setUnseenNotificationsCount(0);
                    setShowNotificationsDropdown(true);
                  } catch (error) {
                    console.error("Error handling notifications:", error);
                  }
                }
              }}
              className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Bell size={24} />
              {unseenNotificationsCount > 0 && (
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
              )}
            </button>
            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-72 rounded-md bg-surface-light dark:bg-surface-dark shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1">
                  <h3 className="px-4 py-2 text-sm font-semibold text-text-light dark:text-text-dark border-b border-gray-200 dark:border-gray-700">Notifikasi</h3>
                  {pendingNotifications.length > 0 ? (
                    pendingNotifications.map((notification, index) => (
                      <div key={notification.id || index} className="px-4 py-2 text-sm text-text-muted-light dark:text-text-muted-dark border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                        <p className="font-medium text-text-light dark:text-text-dark">{notification.title}</p>
                        <p>{notification.body}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(notification.schedule.at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-2 text-sm text-text-muted-light dark:text-text-muted-dark">Tidak ada notifikasi tertunda.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Smart Audio Assistant Global Toggle */}
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              title={isAudioEnabled ? "Matikan Asisten Suara" : "Aktifkan Asisten Suara"}
              className={`p-2 rounded-full transition-all duration-300 ${isAudioEnabled 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200'}`}
            >
              <div className="relative">
                {isAudioEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                {isAudioEnabled && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                )}
              </div>
            </button>
          )}

          {/* User Profile and Dropdown */}
          <div className="relative flex items-center gap-3">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 focus:outline-none"
            >
              <p className="hidden sm:block truncate text-sm font-semibold text-text-light dark:text-text-dark">{userProfile?.name || user?.email}</p>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                <User size={20} className="text-primary dark:text-primary-300" />
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-md bg-surface-light dark:bg-surface-dark shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu-button">
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsDropdownOpen(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 dark:hover:text-white"
                    role="menuitem"
                  >
                    <LogOut size={16} className="mr-2" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`pt-20 ${location.pathname === '/asisten-guru' ? 'pb-16 md:pb-0' : 'pb-24 md:pb-6'} flex-1 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-0'} ${location.pathname === '/asisten-guru' ? '' : 'overflow-y-auto'}`}>
        <div key={location.pathname} className={`w-full animate-fade-in-up ${location.pathname === '/asisten-guru' ? '' : 'p-4 md:p-8'}`}>
          <div className={location.pathname === '/asisten-guru' ? '' : `${isSidebarOpen ? 'max-w-7xl' : 'max-w-full'} mx-auto w-full transition-all duration-500`}>
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center justify-around h-16 px-2">
          {footerNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex-1 flex flex-col items-center justify-center h-full transition-all duration-300 group ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-b-full animate-in slide-in-from-top duration-300"></div>
                )}

                <div className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive ? 'scale-105' : 'group-active:scale-95'
                  }`}>
                  <div className={`p-2 rounded-xl transition-all duration-300 ${isActive
                    ? 'bg-primary/10 dark:bg-primary/20'
                    : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                    }`}>
                    {React.cloneElement(item.icon, {
                      size: 22,
                      strokeWidth: isActive ? 2.5 : 2,
                      className: "transition-transform duration-300"
                    })}
                  </div>
                  <span className={`text-[9px] font-bold tracking-tight text-center transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'
                    }`}>
                    {item.shortName || item.name}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-light dark:bg-surface-dark p-4 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="mb-6 flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/50">
          <div className="flex items-center gap-3">
            <img src={(window.Laravel?.baseUrl || "") + "/Logo Smart Teaching Baru_.png"} alt="Si Pesek Pintar Logo" className="h-8 w-auto" />
            <h1 className="font-sans text-lg font-extrabold text-blue-600 dark:text-blue-500 tracking-tight leading-none">Si Pesek Pintar</h1>
            <p className="text-[8px] font-black text-blue-400 opacity-60 uppercase tracking-tighter leading-none">Sistem Pengelolaan Sekolah Pintar</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {categories.map((category, idx) => {
            const isExpanded = expandedCategories[category.title];
            const hasActiveItem = category.items.some(item => item.path === location.pathname);

            return (
              <div key={category.title} className={idx > 0 ? 'mt-4' : ''}>
                <button
                  onClick={() => toggleCategory(category.title)}
                  className={`flex items-center justify-between w-full px-4 py-2.5 mb-1 text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 group ${hasActiveItem ? 'text-primary bg-primary/5 dark:bg-primary/10' : 'text-gray-400 dark:text-gray-500'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`transition-transform duration-300 ${isExpanded ? 'scale-110' : 'opacity-70'}`}>
                      {category.icon}
                    </span>
                    <span>{category.title}</span>
                  </div>
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <ul className="space-y-1.5 ml-2.5 pl-2 border-l-2 border-primary/10 dark:border-primary/5">
                    {category.items
                      .filter(item => !item.roles || item.roles.includes(user?.role))
                      .map((item) => (
                        <li key={item.path}>
                          <NavItem item={item} isMobile />
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
      </div>
      <OfflineIndicator />
    </div>
  );
}
