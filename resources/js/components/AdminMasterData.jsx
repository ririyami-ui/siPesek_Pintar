import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import StyledTable from './StyledTable';
import Modal from './Modal';
import { Plus, Trash2, ShieldCheck, Pencil, CheckCircle } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';

export default function AdminMasterData() {
    const { userProfile } = useSettings();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);

    // State for new admin form
    const [newAdmin, setNewAdmin] = useState({
        code: '',
        name: '',
        nip: '',
        username: '',
        password: '',
        role: 'admin'
    });

    // State for edit modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentAdmin, setCurrentAdmin] = useState(null);
    const [editData, setEditData] = useState({
        code: '',
        name: '',
        nip: '',
        username: '',
        password: '',
        role: 'admin'
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        id: null
    });

    const getAdmins = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/admins');
            const adminData = response.data.data || response.data || [];
            setAdmins(adminData);
        } catch (error) {
            console.error("Error getting admins: ", error);
            toast.error('Gagal memuat data admin.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        getAdmins();
    }, [getAdmins]);

    const handleAddAdmin = async () => {
        if (!newAdmin.name) {
            toast.error('Nama Admin wajib diisi.');
            return;
        }

        const promise = api.post('/admins', newAdmin);

        toast.promise(promise, {
            loading: 'Menyimpan...',
            success: () => {
                setNewAdmin({ code: '', name: '', nip: '', username: '', password: '', role: 'admin' });
                getAdmins();
                return 'Admin berhasil ditambahkan!';
            },
            error: (err) => err.response?.data?.message || 'Gagal menambah admin.',
        });
    };

    const handleDeleteAdmin = (id) => {
        setConfirmModal({
            isOpen: true,
            id: id
        });
    };

    const confirmDelete = async () => {
        if (!confirmModal.id) return;

        const promise = api.delete(`/admins/${confirmModal.id}`);
        toast.promise(promise, {
            loading: 'Menghapus...',
            success: () => {
                getAdmins();
                setConfirmModal({ isOpen: false, id: null });
                return 'Data admin berhasil dihapus!';
            },
            error: 'Gagal menghapus data admin.',
        });
    };

    const handleOpenEditModal = (admin) => {
        setCurrentAdmin(admin);
        setEditData({
            code: admin.code || '',
            name: admin.name || '',
            nip: admin.nip || '',
            username: admin.auth_user?.username || admin.username || '',
            password: '',
            role: admin.auth_user?.role || 'admin'
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateAdmin = async (e) => {
        e.preventDefault();
        if (!currentAdmin) return;

        const promise = api.put(`/admins/${currentAdmin.id}`, editData);

        toast.promise(promise, {
            loading: 'Memperbarui...',
            success: () => {
                setIsEditModalOpen(false);
                getAdmins();
                return 'Data admin berhasil diperbarui!';
            },
            error: (err) => err.response?.data?.message || 'Gagal memperbarui data.',
        });
    };

    return (
        <div className="space-y-6">
            {/* Add Admin Form */}
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-blue-100 dark:border-blue-900/20">
                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={20} className="text-blue-600 dark:text-blue-400" />
                    <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">Input Data Admin</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <StyledInput
                        type="text"
                        placeholder="Kode Admin"
                        value={newAdmin.code}
                        onChange={(e) => setNewAdmin({ ...newAdmin, code: e.target.value })}
                    />
                    <StyledInput
                        type="text"
                        placeholder="Nama Admin"
                        value={newAdmin.name}
                        onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                    />
                    <StyledInput
                        type="text"
                        placeholder="NIP"
                        value={newAdmin.nip}
                        onChange={(e) => setNewAdmin({ ...newAdmin, nip: e.target.value })}
                    />
                    <StyledInput
                        type="text"
                        placeholder="User / Username"
                        value={newAdmin.username}
                        onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                    />
                    <StyledInput
                        type="text"
                        placeholder="Password"
                        value={newAdmin.password}
                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    />
                    <div className="flex flex-col">
                        <select
                            value={newAdmin.role}
                            onChange={(e) => setNewAdmin({ ...newAdmin, role: e.target.value })}
                            className="h-[46px] px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white appearance-none cursor-pointer"
                        >
                            <option value="admin">Administrator (Akses Penuh)</option>
                            <option value="librarian">Pustakawan (Akses Terbatas)</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <StyledButton onClick={handleAddAdmin} variant="secondary" size="lg" className="shadow-blue-200/50 dark:shadow-none">
                        <Plus className="mr-2" size={20} /> Tambah Data Admin
                    </StyledButton>
                </div>
            </div>

            {/* Admin List Table */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark">Daftar Admin</h3>
                    <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-3 py-1 rounded-full">{admins.length} Admin</span>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : admins.length === 0 ? (
                    <div className="text-center p-12 bg-gray-50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-text-muted-light dark:text-text-muted-dark font-medium">Belum ada data admin.</p>
                    </div>
                ) : (
                    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                        <StyledTable headers={['Kode', 'Nama / Peran', 'NIP', 'Username', 'Password', 'Aksi']}>
                            {admins.map((admin) => {
                                const isCurrentUser = userProfile && (
                                    admin.auth_user_id === userProfile.id ||
                                    (admin.username && admin.username === userProfile.username)
                                );

                                return (
                                    <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 dark:text-blue-400">{admin.code || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-light dark:text-text-dark">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    {admin.name}
                                                    {isCurrentUser && (
                                                        <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full animate-pulse">
                                                            Aktif
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${admin.auth_user?.role === 'librarian' ? 'text-orange-500' : 'text-blue-500'}`}>
                                                    {admin.auth_user?.role === 'librarian' ? 'Pustakawan' : 'Administrator'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark font-medium">{admin.nip || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark font-medium">{admin.auth_user?.username || admin.username || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted-light dark:text-text-muted-dark font-medium font-mono">********</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex gap-2">
                                                <StyledButton onClick={() => handleOpenEditModal(admin)} variant="ghost" size="sm" className="!p-2 text-gray-400 hover:text-blue-600">
                                                    <Pencil size={18} />
                                                </StyledButton>
                                                {isCurrentUser ? (
                                                    <div className="p-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center" title="Akun Sedang Digunakan">
                                                        <CheckCircle size={18} />
                                                    </div>
                                                ) : (
                                                    <StyledButton onClick={() => handleDeleteAdmin(admin.id)} variant="ghost" size="sm" className="!p-2 text-gray-400 hover:text-red-600">
                                                        <Trash2 size={18} />
                                                    </StyledButton>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </StyledTable>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <Modal onClose={() => setIsEditModalOpen(false)}>
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck size={20} className="text-blue-600" />
                        <h3 className="text-xl font-bold">Edit Data Admin</h3>
                    </div>

                    <form onSubmit={handleUpdateAdmin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Kode Admin</label>
                            <StyledInput
                                type="text"
                                placeholder="Kode Admin"
                                value={editData.code}
                                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Nama Admin</label>
                            <StyledInput
                                type="text"
                                placeholder="Nama Admin"
                                value={editData.name}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">NIP</label>
                            <StyledInput
                                type="text"
                                placeholder="NIP"
                                value={editData.nip}
                                onChange={(e) => setEditData({ ...editData, nip: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Username</label>
                            <StyledInput
                                type="text"
                                placeholder="Username"
                                value={editData.username}
                                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Password <span className="text-[10px] font-medium text-blue-500 ml-1">(Kosongkan jika tidak ingin mengubah password)</span></label>
                            <StyledInput
                                type="text"
                                placeholder="Password"
                                value={editData.password}
                                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Peran / Hak Akses</label>
                            <select
                                value={editData.role}
                                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                                className="w-full h-[46px] px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white appearance-none cursor-pointer"
                            >
                                <option value="admin">Administrator (Akses Penuh)</option>
                                <option value="librarian">Pustakawan (Akses Terbatas)</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <StyledButton type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</StyledButton>
                            <StyledButton type="submit" className="bg-blue-600 hover:bg-blue-700">Simpan Perubahan</StyledButton>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Confirm Delete Modal */}
            {confirmModal.isOpen && (
                <Modal onClose={() => setConfirmModal({ isOpen: false, id: null })}>
                    <div className="text-center p-4">
                        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
                            <Trash2 className="h-10 w-10 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Hapus Data Admin?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto text-sm font-medium">Apakah Anda yakin ingin menghapus data admin ini? Tindakan ini tidak dapat dibatalkan.</p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => setConfirmModal({ isOpen: false, id: null })}
                                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 shadow-xl shadow-red-200 dark:shadow-none transition-all duration-300 active:scale-95"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
