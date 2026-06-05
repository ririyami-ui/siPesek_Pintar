// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { GraduationCap, Calculator } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // Math CAPTCHA State
  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  
  const navigate = useNavigate();

  const generateCaptcha = () => {
    setCaptchaNum1(Math.floor(Math.random() * 10) + 1); // 1-10
    setCaptchaNum2(Math.floor(Math.random() * 10) + 1); // 1-10
    setUserAnswer('');
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSigningIn) return;

    // Validate Math CAPTCHA
    const correctAnswer = captchaNum1 + captchaNum2;
    if (parseInt(userAnswer) !== correctAnswer) {
      toast.error('Jawaban verifikasi keamanan salah. Silakan coba lagi.');
      generateCaptcha();
      return;
    }

    setIsSigningIn(true);

    // [DEVICE LOCK] Generate or retrieve unique device ID for this browser/device
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'dev-' + Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('device_id', deviceId);
    }

    try {
      const response = await api.post('/login', {
        email,
        password,
        device_id: deviceId
      });

      const { access_token, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      toast.success('Berhasil masuk! Selamat datang kembali.');
      const baseUrl = window.Laravel?.baseUrl || '';
      const target = (baseUrl && baseUrl !== '/') ? (baseUrl + '/') : '/';
      window.location.href = target;
    } catch (error) {
      setIsSigningIn(false);
      console.error("Gagal masuk:", error);
      toast.error(error.response?.data?.message || 'Gagal masuk. Periksa email dan password Anda.');
      generateCaptcha(); // Regenerate CAPTCHA on failure
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 p-4 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-800 md:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={(window.Laravel?.basePath || "") + "/Logo Smart Teaching Baru_.png"} alt="Logo" className="mb-4 h-24" />
          <h1 className="font-sans text-4xl font-bold text-blue-600 drop-shadow-lg">Si Pesek Pintar</h1>
          <p className="text-sm font-bold text-blue-400 opacity-80 mt-1 uppercase tracking-widest">Sistem Pengelolaan Sekolah Pintar</p>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
            Masuk untuk melanjutkan
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email / Username</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Email atau Username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Local Math CAPTCHA Widget */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/20">
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-300">
              <Calculator size={16} />
              Verifikasi Keamanan (Bukan Robot)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center justify-center rounded-lg bg-white py-2 font-mono text-lg font-bold tracking-widest text-indigo-900 shadow-inner dark:bg-gray-800 dark:text-indigo-200">
                {captchaNum1} + {captchaNum2} = ?
              </div>
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-24 rounded-lg border border-indigo-200 px-4 py-2 text-center font-mono text-lg focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="..."
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningIn || !userAnswer}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-purple-600 p-4 text-white shadow-lg transition-all hover:scale-105 hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            <GraduationCap size={24} />
            <span className="text-lg font-semibold">{isSigningIn ? 'Memproses...' : 'Masuk'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}