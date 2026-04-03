import React, { useState } from 'react';
import api from '../lib/axios';
import StyledInput from '../components/StyledInput';
import StyledButton from '../components/StyledButton';

export default function CreateProfilePage({ onProfileCreated }) {
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [school, setSchool] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('SD');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!name || !nip || !school) {
      setError('Semua field wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profileData = {
        name, // Assuming backend will handle name update on User model if passed
        nip,
        school_name: school,
        school_level: schoolLevel,
      };

      await api.put('/profile', profileData);

      if (onProfileCreated) {
        onProfileCreated();
      }
    } catch (err) {
      console.error("Error creating profile: ", err);
      setError(err.response?.data?.message || 'Gagal membuat profil. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100">Buat Profil Anda</h2>
        <p className="text-center text-gray-600 dark:text-gray-300">
          Lengkapi informasi di bawah ini untuk melanjutkan.
        </p>
        <form onSubmit={handleCreateProfile} className="space-y-6">
          <StyledInput
            type="text"
            placeholder="Nama Lengkap"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <StyledInput
            type="text"
            placeholder="NIP (Nomor Induk Pegawai)"
            value={nip}
            onChange={(e) => setNip(e.target.value)}
            required
          />
          <StyledInput
            type="text"
            placeholder="Nama Sekolah"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 ml-1">Jenjang Sekolah (SD/SMP/SMA)</label>
            <select
              value={schoolLevel}
              onChange={(e) => setSchoolLevel(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white"
            >
              <option value="SD">SD (Sekolah Dasar)</option>
              <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
              <option value="SMA">SMA (Sekolah Menengah Atas)</option>
              <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <StyledButton type="submit" disabled={loading} className="w-full">
            {loading ? 'Menyimpan...' : 'Simpan Profil'}
          </StyledButton>
        </form>
      </div>
    </div>
  );
}
