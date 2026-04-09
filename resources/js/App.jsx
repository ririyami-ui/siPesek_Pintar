import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout.jsx';
import StudentLayout from './components/StudentLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import JadwalPage from './pages/JadwalPage.jsx';
import AbsensiPage from './pages/AbsensiPage.jsx';
import NilaiPage from './pages/NilaiPage.jsx';
import JurnalPage from './pages/JurnalPage.jsx';
import MasterDataPage from './pages/MasterDataPage.jsx';
import RekapitulasiPage from './pages/RekapitulasiPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import AsistenGuruPage from './pages/AsistenGuruPage.jsx';
import EarlyWarningPage from './pages/EarlyWarningPage.jsx';
import PelanggaranPage from './pages/PelanggaranPage.jsx';
import AnalisisKelasPage from './pages/AnalisisKelasPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import ProgramMengajarPage from './pages/ProgramMengajarPage.jsx';
import LessonPlanPage from './pages/LessonPlanPage.jsx';
import LkpdGeneratorPage from './pages/LkpdGeneratorPage.jsx';
import QuizGeneratorPage from './pages/QuizGeneratorPage.jsx';
import PenugasanPage from './pages/PenugasanPage.jsx';
import RekapIndividuPage from './pages/RekapIndividuPage.jsx';
import HandoutGeneratorPage from './pages/HandoutGeneratorPage.jsx';
import AssessmentKktpPage from './pages/PenilaianKktpPage.jsx';
import MonitoringAbsensiPage from './pages/MonitoringAbsensiPage.jsx';
import MonitoringNilaiPage from './pages/MonitoringNilaiPage.jsx';
import AbsensiTerlewatPage from './pages/AbsensiTerlewatPage.jsx';
import WaliKelasPage from './pages/WaliKelasPage.jsx';
// Student (Parent) portal pages
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudentAttendance from './pages/StudentAttendance.jsx';
import StudentGrades from './pages/StudentGrades.jsx';
import StudentTasks from './pages/StudentTasks.jsx';
import StudentInfractions from './pages/StudentInfractions.jsx';
import StudentSchedule from './pages/StudentSchedule.jsx';
import { ChatProvider } from './utils/ChatContext.jsx';
import { SettingsProvider } from './utils/SettingsContext.jsx';
import InstallPwaCard from './components/InstallPwaCard.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';

import './index.css';

import api from './lib/axios';

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true); // Always show for 3s (Branding)
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  // Check if PWA is already installed
  useEffect(() => {
    const checkPwaInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPwaInstalled(isStandalone);
    };
    checkPwaInstalled();
  }, []);

  // [PWA] Hide global shell splash when React is ready
  useEffect(() => {
    if (!isLoading) {
      const splash = document.getElementById('pwa-shell-splash');
      if (splash) splash.classList.add('hidden');
    }
  }, [isLoading]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await api.get('/me');
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          setUser(null);
          setIsWelcomeVisible(true); // Show welcome screen if token is invalid/expired
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    checkAuth();

    // [PUSH NOTIFICATION] Register Service Worker for PWA
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    }

    // [PUSH NOTIFICATION] Subscribe user when logged in as student/parent
    const subscribeToPush = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BD4c8mBny9f3D_2_x0j-9H3NnWjP_-p906Wn9vNwJ905sWn9vNwJ905sWn9vNwJ905sWn9vNwJ905s-w' // VAPID Public Key
        });
        
        await api.post('/save-push-subscription', { subscription });
        console.log('Push Subscription saved.');
      } catch (error) {
        console.error('Push Subscription failed:', error);
      }
    };

    if (user && user.role === 'student') {
      subscribeToPush();
    }

    // Show welcome screen for 3s only if it's visible
    let timer;
    if (isWelcomeVisible) {
      timer = setTimeout(() => {
        setIsWelcomeVisible(false);
      }, 3000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the browser's default prompt
      e.preventDefault();

      // Store the event for later use
      setInstallPrompt(e);

      // Check if user already dismissed it this session using session storage
      const isDismissed = sessionStorage.getItem('pwa_dismissed') === 'true';
      if (!isDismissed) {
        setShowInstallCard(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = () => {
    if (!installPrompt) {
      return;
    }
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      setShowInstallCard(false);
      setInstallPrompt(null);
    });
  };

  const handleDismiss = () => {
    setShowInstallCard(false);
    sessionStorage.setItem('pwa_dismissed', 'true');
  };

  // Only show the 3-second WelcomeScreen for branding at every session start
  if (isWelcomeVisible) {
    return (
      <div className="animate-welcome-fade-in">
        <WelcomeScreen />
      </div>
    );
  }

  // If we are still checking auth, show nothing (this lets the server-side Shell Splash 
  // from index.blade.php stay visible instead of flickering a white screen or login page)
  if (isLoading) {
    return null;
  }

  const basename = window.Laravel?.basePath || '/';
  console.log('App using basename:', basename);

  return (
    <Router basename={basename}>
      <Toaster position="bottom-center" reverseOrder={false} />
      <SettingsProvider>
        <ChatProvider>
          <div className="min-h-screen bg-background-light dark:bg-background-dark font-sans transition-colors duration-200">
            {user ? (
              user.role === 'student' ? (
                /* ── STUDENT / PARENT PORTAL ── */
                <StudentLayout user={user} student={null} onLogout={() => setUser(null)}>
                  <Routes>
                    <Route path="/siswa"           element={<StudentDashboard />} />
                    <Route path="/siswa/jadwal"    element={<StudentSchedule />} />
                    <Route path="/siswa/kehadiran" element={<StudentAttendance />} />
                    <Route path="/siswa/nilai"     element={<StudentGrades />} />
                    <Route path="/siswa/tugas"     element={<StudentTasks />} />
                    <Route path="/siswa/pelanggaran" element={<StudentInfractions />} />
                    <Route path="*"                element={<Navigate to="/siswa" replace />} />
                  </Routes>
                </StudentLayout>
              ) : (
                /* ── TEACHER / ADMIN DASHBOARD ── */
                <DashboardLayout user={user} onLogout={() => setUser(null)}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/jadwal" element={<JadwalPage />} />
                    <Route path="/absensi" element={<AbsensiPage />} />
                    <Route path="/absensi-terlewat" element={<AbsensiTerlewatPage />} />
                    <Route path="/nilai" element={<NilaiPage />} />
                    <Route path="/jurnal" element={<JurnalPage />} />
                    <Route path="/rekapitulasi" element={<RekapitulasiPage />} />
                    <Route path="/rekap-individu" element={<RekapIndividuPage />} />
                    <Route path="/master-data" element={<MasterDataPage />} />
                    <Route path="/about" element={<AboutPage installPrompt={installPrompt} onInstall={handleInstall} isPwaInstalled={isPwaInstalled} />} />
                    <Route path="/analisis-kelas" element={<AnalisisKelasPage />} />
                    <Route path="/sistem-peringatan" element={<EarlyWarningPage />} />
                    <Route path="/asisten-guru" element={<AsistenGuruPage />} />
                    <Route path="/analisis-rombel/:rombel" element={<AnalisisKelasPage />} />
                    <Route path="/pelanggaran" element={<PelanggaranPage />} />
                    <Route path="/leaderboard" element={<LeaderboardPage />} />
                    <Route path="/program-mengajar" element={<ProgramMengajarPage />} />
                    <Route path="/rpp" element={<LessonPlanPage />} />
                    <Route path="/lkpd-generator" element={<LkpdGeneratorPage />} />
                    <Route path="/handout-generator" element={<HandoutGeneratorPage />} />
                    <Route path="/quiz-generator" element={<QuizGeneratorPage />} />
                    <Route path="/penugasan" element={<PenugasanPage />} />
                    <Route path="/penilaian-kktp" element={<AssessmentKktpPage />} />
                    <Route path="/monitoring-absensi" element={<MonitoringAbsensiPage />} />
                    <Route path="/monitoring-nilai" element={<MonitoringNilaiPage />} />
                    <Route path="/wali-kelas" element={<WaliKelasPage />} />
                  </Routes>
                </DashboardLayout>
              )
            ) : (
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            )}
          </div>
        </ChatProvider>
      </SettingsProvider>
      {showInstallCard && (
        <InstallPwaCard
          role={user?.role}
          onInstall={handleInstall}
          onDismiss={handleDismiss}
        />
      )}
    </Router>
  );
}

export default App;
