import React, { useState, useEffect } from 'react';
import StudentMasterData from '../components/StudentMasterData';
import ClassMasterData from '../components/ClassMasterData';
import ScheduleCalendar from '../components/ScheduleCalendar';
import ProfileEditor from '../components/ProfileEditor';
import SubjectMasterData from '../components/SubjectMasterData';
import TeacherMasterData from '../components/TeacherMasterData';
import AdminMasterData from '../components/AdminMasterData';
import DatabaseManagerAdmin from '../components/DatabaseManagerAdmin';
import api from '../lib/axios';
import {
  User,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Loader,
  Database
} from 'lucide-react';

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/me');
        setUser(response.data);
        if (response.data.role !== 'admin') {
          setActiveTab('teachers');
        }
      } catch (error) {
        console.error("Error fetching user in MasterData:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const adminTabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'admins', label: 'Admin', icon: ShieldCheck },
    { id: 'teachers', label: 'Guru', icon: UserCheck },
    { id: 'classes', label: 'Kelas', icon: Users },
    { id: 'students', label: 'Siswa', icon: GraduationCap },
    { id: 'subjects', label: 'Mata Pelajaran', icon: BookOpen },
    { id: 'scheduleInput', label: 'Jadwal Mengajar', icon: Calendar },
    { id: 'database', label: 'Kelola Database', icon: Database },
  ];

  const teacherTabs = [
    { id: 'teachers', label: 'Data Saya', icon: UserCheck },
    { id: 'profile', label: 'Pengaturan Profil & AI', icon: User },
    { id: 'classes', label: 'Kelas Diampu', icon: Users },
    { id: 'students', label: 'Daftar Siswa', icon: GraduationCap },
    { id: 'scheduleInput', label: 'Jadwal Mengajar', icon: Calendar },
  ];

  const tabs = user?.role === 'admin' ? adminTabs : teacherTabs;

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center p-8"><Loader className="animate-spin text-purple-600" /></div>;

    switch (activeTab) {
      case 'profile': return <ProfileEditor />;
      case 'admins': return <AdminMasterData />;
      case 'teachers': return <TeacherMasterData />;
      case 'classes': return <ClassMasterData />;
      case 'students': return <StudentMasterData />;
      case 'subjects': return <SubjectMasterData />;
      case 'scheduleInput': return <ScheduleCalendar />;
      case 'database': return <DatabaseManagerAdmin />;
      default: return user?.role === 'admin' ? <ProfileEditor /> : <TeacherMasterData />;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader className="animate-spin h-8 w-8 text-purple-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Master Data</h2>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium">Pengaturan dan manajemen basis data aplikasi</p>
        </div>
      </div>

      {/* Modern Glassmorphic Tab Navigation */}
      <div className="bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-md p-1.5 rounded-2xl inline-flex flex-wrap gap-1 border border-gray-200/50 dark:border-gray-800/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 relative
                ${isActive
                  ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5 scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/30'
                }
              `}
            >
              <Icon size={18} className={isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-purple-500 rounded-full blur-[2px] opacity-20 mt-1"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/40 dark:border-gray-800/40 p-6 rounded-3xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        {renderContent()}
      </div>
    </div>
  );
}