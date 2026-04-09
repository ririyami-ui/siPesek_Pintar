import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSettings } from '../utils/SettingsContext';
import StyledInput from './StyledInput';
import StyledSelect from './StyledSelect';
import StyledButton from './StyledButton';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function ProfileEditor() {
  const { userProfile, loadingSettings, updateProfile } = useSettings();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  const [formData, setFormData] = useState({
    school_name: '',
    school_level: 'SD',
    npsn: '',
    nss: '',
    address: '',
    principalName: '',
    principalNip: '',
    academic_year: '',
    active_semester: 'Ganjil',
    gemini_model: 'gemini-3.1-flash-lite-preview',
    google_ai_api_key: '',
    schedule_notifications_enabled: true,
    school_days: 6,
    audio_language: 'id-ID', // New: Audio language setting
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        school_name: userProfile.school_name || userProfile.schoolName || '',
        school_level: userProfile.school_level || userProfile.schoolLevel || 'SD',
        npsn: userProfile.npsn || '',
        nss: userProfile.nss || '',
        address: userProfile.address || '',
        principalName: userProfile.principalName || '',
        principalNip: userProfile.principalNip || '',
        academic_year: userProfile.academic_year || userProfile.academicYear || '',
        active_semester: userProfile.active_semester || userProfile.activeSemester || 'Ganjil',
        gemini_model: userProfile.gemini_model || userProfile.geminiModel || 'gemini-3.1-flash-lite-preview',
        google_ai_api_key: userProfile.google_ai_api_key || userProfile.googleAiApiKey || '',
        schedule_notifications_enabled: userProfile.schedule_notifications_enabled !== undefined ? !!userProfile.schedule_notifications_enabled : true,
        school_days: userProfile.school_days || 6,
        audio_language: userProfile.audio_language || 'id-ID',
      });
      
      if (userProfile.logoUrl) {
        setLogoPreview(userProfile.logoUrl);
      }
    }
  }, [userProfile]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 2MB.');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();
      
      // If admin, send all data. If teacher, only send AI settings
      if (isAdmin) {
        data.append('school_name', formData.school_name || '');
        data.append('school_level', formData.school_level || 'SD');
        data.append('npsn', formData.npsn || '');
        data.append('nss', formData.nss || '');
        data.append('address', formData.address || '');
        data.append('principalName', formData.principalName || '');
        data.append('principalNip', formData.principalNip || '');
        data.append('academic_year', formData.academic_year || '');
        data.append('active_semester', formData.active_semester || 'Ganjil');
        data.append('school_days', formData.school_days || 6);
        if (logoFile instanceof File) {
          data.append('logo', logoFile);
        }
      }
      
      data.append('gemini_model', formData.gemini_model || 'gemini-3.1-flash-lite-preview');
      data.append('google_ai_api_key', formData.google_ai_api_key || '');
      data.append('schedule_notifications_enabled', formData.schedule_notifications_enabled ? '1' : '0');
      data.append('audio_language', formData.audio_language || 'id-ID');
      
      // Use _method spoofing for multipart PUT
      data.append('_method', 'PUT');

      await updateProfile(data);
      
      // Sync with localStorage for compatibility
      localStorage.setItem('GEMINI_MODEL', formData.gemini_model);
      if (formData.google_ai_api_key) {
        localStorage.setItem('GEMINI_API_KEY', formData.google_ai_api_key);
      }

      toast.success('Profil berhasil diperbarui!');
    } catch (err) {
      console.error('Update profile error:', err);

      const errorMessage = err.response?.data?.message || 'Gagal memperbarui profil.';
      const validationErrors = err.response?.data?.errors;

      if (validationErrors) {
        Object.keys(validationErrors).forEach(field => {
          validationErrors[field].forEach(msg => {
            toast.error(`${field}: ${msg}`, { duration: 4000 });
          });
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!formData.google_ai_api_key.trim()) {
      toast.error('Masukkan API Key terlebih dahulu.');
      return;
    }

    setTestingKey(true);

    try {
      const genAI = new GoogleGenerativeAI(formData.google_ai_api_key.trim());
      const model = genAI.getGenerativeModel({ model: formData.gemini_model });
      const result = await model.generateContent("test");
      await result.response;
      toast.success('Koneksi berhasil! API Key Anda valid.');
    } catch (err) {
      console.error("Test connection failed:", err);
      if (err.message.includes("429") || err.message.toLowerCase().includes("quota")) {
        toast.error("Kuota API Key Anda habis atau mencapai batas limit. Disarankan menggunakan model 'Flash' untuk kuota yang lebih besar.");
      } else if (err.message.includes("API_KEY_INVALID") || err.message.toLowerCase().includes("invalid")) {
        toast.error("API Key tidak valid. Silakan periksa kembali.");
      } else {
        toast.error("Gagal tes koneksi: " + err.message);
      }
    } finally {
      setTestingKey(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
      <h3 className="text-xl font-bold mb-6 text-purple-800 dark:text-purple-300">Pengaturan Profil & AI</h3>
      <form onSubmit={handleUpdateProfile} className="space-y-6">
        <div className="space-y-6">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2">Informasi Sekolah</h4>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-1/3 space-y-2">
              <label className="text-xs font-semibold text-gray-500 ml-1">Logo Sekolah</label>
              <div className="relative group overflow-hidden rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-900/40">
                {logoPreview ? (
                  <img src={logoPreview} alt="School Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center p-4">
                    <svg className="mx-auto h-12 w-12 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-1 text-xs text-gray-500">Klik untuk upload logo</p>
                  </div>
                )}
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={!isAdmin}
                />
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <StyledInput
                type="text"
                placeholder="Nama Sekolah"
                value={formData.school_name}
                onChange={(e) => handleInputChange('school_name', e.target.value)}
                required
                disabled={!isAdmin}
              />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">Jenjang Sekolah Utama (Konteks AI)</label>
                <StyledSelect
                  value={formData.school_level}
                  onChange={(e) => handleInputChange('school_level', e.target.value)}
                  required
                  disabled={!isAdmin}
                >
                  <option value="SD">SD (Sekolah Dasar)</option>
                  <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                  <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                  <option value="SMK">SMK (Sekolah Menengah Kejuruan)</option>
                </StyledSelect>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StyledInput
                  type="text"
                  placeholder="NPSN"
                  value={formData.npsn}
                  onChange={(e) => handleInputChange('npsn', e.target.value)}
                  disabled={!isAdmin}
                />
                <StyledInput
                  type="text"
                  placeholder="NSS"
                  value={formData.nss}
                  onChange={(e) => handleInputChange('nss', e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <textarea
                placeholder="Alamat Sekolah"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-sm min-h-[100px]"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 dark:border-gray-700">
            <StyledInput
              type="text"
              placeholder="Nama Kepala Sekolah"
              value={formData.principalName}
              onChange={(e) => handleInputChange('principalName', e.target.value)}
              disabled={!isAdmin}
            />
            <StyledInput
              type="text"
              placeholder="NIP Kepala Sekolah"
              value={formData.principalNip}
              onChange={(e) => handleInputChange('principalNip', e.target.value)}
              disabled={!isAdmin}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 ml-1">Tahun Pelajaran</label>
              <StyledInput
                type="text"
                placeholder="Misal: 2025/2026"
                value={formData.academic_year}
                onChange={(e) => handleInputChange('academic_year', e.target.value)}
                required
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 ml-1">Semester Aktif</label>
              <StyledSelect
                value={formData.active_semester}
                onChange={(e) => handleInputChange('active_semester', e.target.value)}
                required
                disabled={!isAdmin}
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </StyledSelect>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 ml-1">Sistem Hari Sekolah</label>
            <StyledSelect
              value={formData.school_days}
              onChange={(e) => handleInputChange('school_days', e.target.value)}
              required
              disabled={!isAdmin}
            >
              <option value={5}>5 Hari Sekolah (Senin - Jumat)</option>
              <option value={6}>6 Hari Sekolah (Senin - Sabtu)</option>
            </StyledSelect>
            <p className="text-[10px] text-gray-400 ml-1 italic">
              * Pengaturan ini akan mempengaruhi perhitungan Pekan Efektif secara otomatis.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t dark:border-gray-700">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 flex items-center gap-2">
            Integrasi Google Gemini
            <span className="text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Personal Key</span>
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dapatkan API Key gratis di <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>. API Key ini akan tersimpan aman di profil Anda.
          </p>
          <div className="flex gap-2 relative">
            <div className="flex-1">
              <StyledInput
                type={showApiKey ? "text" : "password"}
                placeholder="Masukkan Gemini API Key Anda"
                value={formData.google_ai_api_key}
                onChange={(e) => handleInputChange('google_ai_api_key', e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-36 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showApiKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88L3 3" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /><path d="M14.2 14.2a3 3 0 1 1-4.4-4.4" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={testingKey || !formData.google_ai_api_key}
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 min-w-[120px] shadow-sm active:scale-95"
            >
              {testingKey ? 'Mencoba...' : 'Tes Koneksi'}
            </button>
          </div>
          <div className="space-y-1 mt-4">
            <label className="text-xs font-semibold text-gray-500 ml-1">Model AI</label>
            <StyledSelect
              value={formData.gemini_model}
              onChange={(e) => handleInputChange('gemini_model', e.target.value)}
            >
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (Lite & Fast)</option>
              <option value="gemini-3-flash-preview">Gemini 3 Flash (Tercepat & Terbaru)</option>
              <option value="gemini-3-pro-preview">Gemini 3 Pro (Paling Cerdas)</option>

              {![
                'gemini-3.1-flash-lite-preview',
                'gemini-3-flash-preview',
                'gemini-3-pro-preview'
              ].includes(formData.gemini_model) && (
                  <option value={formData.gemini_model}>{formData.gemini_model} (Aktif)</option>
                )}
            </StyledSelect>
            <p className="text-[10px] text-gray-400 mt-1 italic">
              *Model akan digunakan untuk semua fitur AI di aplikasi.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t dark:border-gray-700">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Notifikasi Jadwal</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dapatkan peringatan otomatis saat jam pelajaran akan dimulai.</p>
            </div>
            <button
              type="button"
              onClick={() => handleInputChange('schedule_notifications_enabled', !formData.schedule_notifications_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ring-transparent focus:ring-purple-500 ${formData.schedule_notifications_enabled ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.schedule_notifications_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex-1 pr-4">
              <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Bahasa Pengumuman Audio</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pilih bahasa yang digunakan untuk pengumuman suara otomatis.</p>
            </div>
            <StyledSelect
                value={formData.audio_language}
                onChange={(e) => handleInputChange('audio_language', e.target.value)}
                className="w-auto"
            >
                <option value="id-ID">Bahasa Indonesia</option>
                <option value="en-US">English (US)</option>
            </StyledSelect>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <StyledButton type="submit" disabled={saving} className="min-w-[150px]">
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span>Menyimpan...</span>
              </div>
            ) : 'Simpan Perubahan'}
          </StyledButton>
        </div>
      </form>
    </div>
  );
}
