// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSigningIn) {
      return;
    }
    setIsSigningIn(true);

    try {
      // CSRF cookie is handled by axios.js withCredentials in API requests usually,
      // but for Sanctum SPA auth, we might need to get CSRF cookie first.
      // However, with API Token auth (which we implemented in AuthController), we just need the token.
      // Wait, I implemented createToken in AuthController, so it returns a token.
      // I should just use that token.

      const response = await api.post('/login', { email, password });

      const { access_token, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      toast.success('Berhasil masuk! Selamat datang kembali.');
      // Force reload to update App state or just navigate and let App check
      // App.jsx checks token on mount.
      const baseUrl = window.Laravel?.baseUrl || '';
      const target = (baseUrl && baseUrl !== '/') ? (baseUrl + '/') : '/';
      window.location.href = target;
    } catch (error) {
      setIsSigningIn(false);
      console.error("Gagal masuk:", error);
      toast.error(error.response?.data?.message || 'Gagal masuk. Periksa email dan password Anda.');
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

        <form onSubmit={handleLogin} className="space-y-6">
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

          <button
            type="submit"
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-purple-600 p-4 text-white shadow-lg transition-transform hover:scale-105 hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-300 disabled:cursor-not-allowed disabled:bg-purple-400"
          >
            <GraduationCap size={24} />
            <span className="text-lg font-semibold">{isSigningIn ? 'Memproses...' : 'Masuk'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};