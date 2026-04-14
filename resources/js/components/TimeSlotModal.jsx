import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, Save, RefreshCw, Layers, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import Modal from './Modal';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useSettings } from '../utils/SettingsContext';

const TimeSlotModal = ({ isOpen, onClose, onSaveSuccess }) => {
    const { userProfile, updateProfile } = useSettings();
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeDay, setActiveDay] = useState('Senin');
    
    // Day options
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    
    // Multi-profile state
    const [profiles, setProfiles] = useState([]);
    const [activeProfileId, setActiveProfileId] = useState('');
    const [editingProfileId, setEditingProfileId] = useState('');
    const [isAddingProfile, setIsAddingProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');

    useEffect(() => {
        if (isOpen && userProfile?.teaching_time_slots) {
            const data = userProfile.teaching_time_slots;
            const fetchedProfiles = data.profiles || [];
            
            setProfiles(fetchedProfiles);
            
            // Find active profile or default to first one
            const active = fetchedProfiles.find(p => p.is_active) || fetchedProfiles[0];
            if (active) {
                setEditingProfileId(active.id);
                setActiveProfileId(active.id);
            }
        } else if (isOpen) {
            // Default initialization if totally empty
            const defaultProfile = {
                id: 'default',
                name: 'Default',
                is_active: true,
                slots: days.reduce((acc, d) => ({ ...acc, [d]: [] }), {})
            };
            setProfiles([defaultProfile]);
            setEditingProfileId('default');
            setActiveProfileId('default');
        }
    }, [isOpen, userProfile]);

    const currentProfile = profiles.find(p => p.id === editingProfileId) || null;
    const timeSlots = currentProfile?.slots || days.reduce((acc, d) => ({ ...acc, [d]: [] }), {});

    const handleAddSlot = () => {
        if (!editingProfileId) return;
        
        const currentSlots = timeSlots[activeDay] || [];
        const lastPeriod = currentSlots.length > 0 
            ? Math.max(...currentSlots.map(s => parseInt(s.jam_ke) || 0)) 
            : 0;
            
        const newSlot = {
            jam_ke: lastPeriod + 1,
            mulai: '',
            selesai: ''
        };
        
        const updatedProfiles = profiles.map(p => {
            if (p.id === editingProfileId) {
                return {
                    ...p,
                    slots: {
                        ...p.slots,
                        [activeDay]: [...currentSlots, newSlot]
                    }
                };
            }
            return p;
        });
        
        setProfiles(updatedProfiles);
    };

    const handleRemoveSlot = (index) => {
        const currentSlots = [...(timeSlots[activeDay] || [])];
        currentSlots.splice(index, 1);
        
        const updatedProfiles = profiles.map(p => {
            if (p.id === editingProfileId) {
                return {
                    ...p,
                    slots: {
                        ...p.slots,
                        [activeDay]: currentSlots
                    }
                };
            }
            return p;
        });
        
        setProfiles(updatedProfiles);
    };

    const handleUpdateSlot = (index, field, value) => {
        const currentSlots = [...(timeSlots[activeDay] || [])];
        currentSlots[index] = { ...currentSlots[index], [field]: value };
        
        const updatedProfiles = profiles.map(p => {
            if (p.id === editingProfileId) {
                return {
                    ...p,
                    slots: {
                        ...p.slots,
                        [activeDay]: currentSlots
                    }
                };
            }
            return p;
        });
        
        setProfiles(updatedProfiles);
    };

    const handleCopyFromMonday = () => {
        const mondaySlots = timeSlots['Senin'] || [];
        if (mondaySlots.length === 0) {
            toast.error('Template hari Senin masih kosong.');
            return;
        }
        
        const newSlots = { ...timeSlots };
        days.forEach(d => {
            if (d !== 'Senin') {
                newSlots[d] = JSON.parse(JSON.stringify(mondaySlots));
            }
        });
        
        const updatedProfiles = profiles.map(p => {
            if (p.id === editingProfileId) {
                return { ...p, slots: newSlots };
            }
            return p;
        });
        
        setProfiles(updatedProfiles);
        toast.success('Berhasil menyalin template Senin ke semua hari!');
    };

    const handleAddProfile = () => {
        if (!newProfileName.trim()) {
            toast.error('Nama profil tidak boleh kosong.');
            return;
        }
        
        const newId = newProfileName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
        const newProfile = {
            id: newId,
            name: newProfileName,
            is_active: false,
            slots: days.reduce((acc, d) => ({ ...acc, [d]: [] }), {})
        };
        
        setProfiles([...profiles, newProfile]);
        setEditingProfileId(newId);
        setIsAddingProfile(false);
        setNewProfileName('');
        toast.success(`Profil "${newProfileName}" telah dibuat.`);
    };

    const handleDeleteProfile = (id) => {
        if (profiles.length <= 1) {
            toast.error('Tidak bisa menghapus profil terakhir.');
            return;
        }
        
        const profileToDelete = profiles.find(p => p.id === id);
        if (profileToDelete.is_active) {
            toast.error('Ganti profil aktif terlebih dahulu sebelum menghapus profil ini.');
            return;
        }

        if (confirm(`Hapus profil "${profileToDelete.name}"? Semua template di dalamnya akan hilang.`)) {
            const updated = profiles.filter(p => p.id !== id);
            setProfiles(updated);
            if (editingProfileId === id) {
                setEditingProfileId(updated[0].id);
            }
            toast.success('Profil dihapus.');
        }
    };

    const handleSetActive = (id) => {
        const updated = profiles.map(p => ({
            ...p,
            is_active: p.id === id
        }));
        setProfiles(updated);
        setActiveProfileId(id);
        toast.success('Profil aktif diperbarui.');
    };

// --- [NEW: SYNC LOGIC] ---
    const handleSyncWithExisting = async () => {
        if (!editingProfileId) return;
        const profile = profiles.find(p => p.id === editingProfileId);
        
        if (!confirm(`Sinkronkan semua jadwal KBM (Mengajar) ke profil "${profile.name}"? Ini akan mengubah jam mulai/selesai semua jadwal yang sudah tersimpan agar sesuai dengan template ini.`)) {
            return;
        }

        setIsSyncing(true);
        try {
            const response = await api.post('/schedules/sync-template', {
                profile_id: editingProfileId
            });
            
            toast.success(`Berhasil! ${response.data.updated} jadwal diperbarui.`);
            if (onSaveSuccess) onSaveSuccess();
        } catch (error) {
            console.error('Error syncing:', error);
            toast.error(error.response?.data?.message || 'Gagal melakukan sinkronisasi massal.');
        } finally {
            setIsSyncing(false);
        }
    };
// -------------------------

    const handleSave = async () => {
        setLoading(true);
        try {
            // Clean structure for all profiles
            const cleanedProfiles = profiles.map(p => {
                const cleanedSlots = {};
                days.forEach(day => {
                    cleanedSlots[day] = (p.slots[day] || [])
                        .filter(s => s.jam_ke && s.mulai && s.selesai)
                        .sort((a, b) => (parseInt(a.jam_ke) || 0) - (parseInt(b.jam_ke) || 0));
                });
                return { ...p, slots: cleanedSlots };
            });

            const payload = {
                profiles: cleanedProfiles
            };

            await updateProfile({ teaching_time_slots: payload });
            toast.success('Semua template berhasil disimpan!');
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving time slots:', error);
            toast.error('Gagal menyimpan template jam mengajar.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="4xl">
            <div className="space-y-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Kelola Template Waktu</h3>
                        <p className="text-sm text-gray-500 font-medium">Buat template berbeda untuk hari biasa, Ramadan, atau ujian.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Profile Manager Section */}
                <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-3xl border border-purple-100 dark:border-purple-800/30">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-black text-xs uppercase tracking-widest">
                            <Layers size={16} /> Daftar Profil Template
                        </div>
                        
                        {!isAddingProfile ? (
                            <button 
                                onClick={() => setIsAddingProfile(true)}
                                className="flex items-center gap-1 text-[10px] font-black text-purple-600 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700 hover:shadow-md transition-all ml-auto"
                            >
                                <Plus size={12} /> Tambah Profil Baru
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 ml-auto animate-in slide-in-from-right-2">
                                <StyledInput 
                                    placeholder="Nama Profil (misal: Ramadan)" 
                                    className="!py-1.5 !px-3 !text-xs w-48"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleAddProfile} className="p-1.5 bg-purple-600 text-white rounded-lg"><CheckCircle size={16} /></button>
                                <button onClick={() => setIsAddingProfile(false)} className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-lg"><X size={16} /></button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {profiles.map(profile => (
                            <div 
                                key={profile.id}
                                onClick={() => setEditingProfileId(profile.id)}
                                className={`
                                    relative p-4 rounded-2xl border cursor-pointer transition-all group
                                    ${editingProfileId === profile.id 
                                        ? 'bg-white dark:bg-gray-800 border-purple-400 shadow-lg ring-2 ring-purple-500/10' 
                                        : 'bg-white/50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 opacity-70 hover:opacity-100 hover:bg-white dark:hover:bg-gray-800'
                                    }
                                `}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-sm font-bold ${editingProfileId === profile.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {profile.name}
                                    </span>
                                    {profile.is_active && (
                                        <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">AKTIF</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium">
                                    {Object.values(profile.slots).flat().length} entri waktu tersimpan
                                </div>

                                <div className={`absolute bottom-2 right-2 flex gap-1 transition-opacity ${editingProfileId === profile.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {!profile.is_active && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleSetActive(profile.id); }}
                                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                            title="Atur sebagai default"
                                        >
                                            <CheckCircle size={14} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Hapus profil"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    {/* Day Selection Sidebar */}
                    <div className="w-full md:w-32 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
                        {days.map(d => (
                            <button
                                key={d}
                                onClick={() => setActiveDay(d)}
                                className={`px-4 py-3 rounded-xl text-sm font-bold transition-all text-left whitespace-nowrap ${
                                    activeDay === d 
                                        ? 'bg-gray-800 dark:bg-white text-white dark:text-gray-800 shadow-md scale-[1.02]' 
                                        : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-5">
                        <div className="flex justify-between items-center px-1">
                            <div>
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">Editting:</span>
                                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                    {currentProfile?.name} &rsaquo; {activeDay}
                                </span>
                            </div>
                            {activeDay === 'Senin' && (
                                <button 
                                    onClick={handleCopyFromMonday}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-blue-100 dark:border-gray-700 hover:shadow-md transition-all shadow-sm"
                                >
                                    <Copy size={12} /> Salin Senin ke Semua Hari
                                </button>
                            )}
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(timeSlots[activeDay] || []).length === 0 ? (
                                <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-3">
                                        <Plus className="text-gray-400" size={24} />
                                    </div>
                                    <p className="text-gray-500 text-sm font-bold">Belum ada template untuk {activeDay}.</p>
                                    <p className="text-xs text-gray-400 mb-4">Mulai tambahkan jam pelajaran untuk profil {currentProfile?.name}</p>
                                    <StyledButton 
                                        variant="outline"
                                        onClick={handleAddSlot}
                                        className="!py-2 !text-xs"
                                    >
                                        + Tambah Jam Pertama
                                    </StyledButton>
                                </div>
                            ) : (
                                timeSlots[activeDay].map((slot, idx) => (
                                    <div key={idx} className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:ring-2 hover:ring-purple-500/20 transition-all">
                                        <div className="w-20 space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Jam Ke</label>
                                            <StyledInput 
                                                type="number" 
                                                className="!py-2 !text-center font-bold"
                                                value={slot.jam_ke}
                                                onChange={(e) => handleUpdateSlot(idx, 'jam_ke', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Jam Mulai</label>
                                            <StyledInput 
                                                type="time" 
                                                className="!py-2 font-medium"
                                                value={slot.mulai}
                                                onChange={(e) => handleUpdateSlot(idx, 'mulai', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Jam Selesai</label>
                                            <StyledInput 
                                                type="time" 
                                                className="!py-2 font-medium"
                                                value={slot.selesai}
                                                onChange={(e) => handleUpdateSlot(idx, 'selesai', e.target.value)}
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveSlot(idx)}
                                            className="mt-6 p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <button 
                            onClick={handleAddSlot}
                            className="w-full py-4 border-2 border-dashed border-purple-200 dark:border-purple-900/30 rounded-3xl text-purple-600 dark:text-purple-400 font-black text-sm hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all flex items-center justify-center gap-2 group"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Tambah Baris Jam Pelajaran
                        </button>
                    </div>
                </div>

                {/* [NEW] Bulk Sync Context Header */}
                {currentProfile && Object.values(currentProfile.slots).flat().length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-3xl border border-amber-100 dark:border-amber-800/30 flex flex-col md:flex-row items-center gap-4">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl text-amber-600 shadow-sm">
                            <Zap size={24} />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="text-sm font-black text-amber-800 dark:text-amber-400">Sinkronisasi Massal</h4>
                            <p className="text-xs text-amber-700/70 dark:text-amber-400/60 font-medium">
                                Ubah semua jam pada jadwal KBM yang sudah tersimpan agar mengikuti template <strong>{currentProfile.name}</strong> ini.
                            </p>
                        </div>
                        <StyledButton 
                            onClick={handleSyncWithExisting}
                            disabled={isSyncing}
                            className="!bg-amber-600 hover:!bg-amber-700 !border-none !text-xs w-full md:w-auto"
                        >
                            {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : "Sinkronkan Sekarang"}
                        </StyledButton>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 italic">
                        <RefreshCw size={14} /> Perubahan akan tersimpan secara global.
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <StyledButton variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Batal</StyledButton>
                        <StyledButton 
                            onClick={handleSave} 
                            disabled={loading}
                            className="flex-1 sm:flex-none min-w-[180px]"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                                <div className="flex items-center gap-2">
                                    <Save size={20} /> Simpan Semua Profil
                                </div>
                            )}
                        </StyledButton>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TimeSlotModal;
