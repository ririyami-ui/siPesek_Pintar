import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../lib/axios';

import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import TeacherCard from './TeacherCard';
import Modal from './Modal';
import { Plus, Trash2, UserPlus, Pencil, Upload, Download, UserCheck } from 'lucide-react';

export default function TeacherMasterData() {
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [user, setUser] = useState(null);

    // State for new teacher form
    const [newTeacher, setNewTeacher] = useState({
        code: '',
        name: '',
        nip: '',
        username: '',
        password: ''
    });

    // State for edit modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentTeacher, setCurrentTeacher] = useState(null);
    const [editData, setEditData] = useState({
        code: '',
        name: '',
        nip: '',
        username: '',
        password: ''
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        id: null
    });

    const getTeachers = useCallback(async () => {
        setLoading(true);
        try {
            const [teachersRes, userRes] = await Promise.all([
                api.get('/teachers'),
                api.get('/me')
            ]);
            setTeachers(teachersRes.data.data || teachersRes.data || []);
            setUser(userRes.data);
        } catch (error) {
            console.error("Error getting teachers: ", error);
            toast.error('Gagal memuat data guru.');
        } finally {
            setLoading(false);
        }
    }, []);

    const getSubjects = useCallback(async () => {
        try {
            const response = await api.get('/subjects');
            setSubjects(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error getting subjects: ", error);
        }
    }, []);

    const getClasses = useCallback(async () => {
        try {
            const response = await api.get('/classes');
            setClasses(response.data.data || response.data || []);
        } catch (error) {
            console.error("Error getting classes: ", error);
        }
    }, []);

    useEffect(() => {
        getTeachers();
        getSubjects();
        getClasses();
    }, [getTeachers, getSubjects, getClasses]);

    const handleAddTeacher = async () => {
        if (!newTeacher.name) {
            toast.error('Nama Guru wajib diisi.');
            return;
        }

        const promise = api.post('/teachers', newTeacher);

        toast.promise(promise, {
            loading: 'Menyimpan...',
            success: () => {
                setNewTeacher({ code: '', name: '', nip: '', username: '', password: '' });
                getTeachers();
                return 'Guru berhasil ditambahkan!';
            },
            error: (err) => err.response?.data?.message || 'Gagal menambah guru.',
        });
    };

    const handleDeleteTeacher = (id) => {
        setConfirmModal({
            isOpen: true,
            id: id
        });
    };

    const confirmDelete = async () => {
        if (!confirmModal.id) return;

        const promise = api.delete(`/teachers/${confirmModal.id}`);
        toast.promise(promise, {
            loading: 'Menghapus...',
            success: () => {
                getTeachers();
                setConfirmModal({ isOpen: false, id: null });
                return 'Data guru berhasil dihapus!';
            },
            error: 'Gagal menghapus data guru.',
        });
    };

    const handleOpenEditModal = (teacher) => {
        setCurrentTeacher(teacher);
        setEditData({
            code: teacher.code || '',
            name: teacher.name || '',
            nip: teacher.nip || '',
            username: teacher.username || '',
            password: ''
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateTeacher = async (e) => {
        e.preventDefault();
        if (!currentTeacher) return;

        const promise = api.put(`/teachers/${currentTeacher.id}`, editData);

        toast.promise(promise, {
            loading: 'Memperbarui...',
            success: () => {
                setIsEditModalOpen(false);
                getTeachers();
                return 'Data guru berhasil diperbarui!';
            },
            error: (err) => err.response?.data?.message || 'Gagal memperbarui data.',
        });
    };

    const handleFileUpload = (event) => {
        setFile(event.target.files[0]);
    };

    const importTeachers = async () => {
        if (!file) {
            toast.error('Pilih file Excel untuk diimpor.');
            return;
        }

        const toastId = toast.loading('Mengimpor data guru...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                let importedCount = 0;
                let errorCount = 0;

                const normalizeRow = (row) => {
                    const normalized = {};
                    for (const key in row) {
                        if (row.hasOwnProperty(key)) {
                            normalized[key.trim().toLowerCase()] = row[key];
                        }
                    }
                    return normalized;
                };

                for (const rawRow of json) {
                    const row = normalizeRow(rawRow);
                    if (!row['nama guru'] && !row['nama']) continue;

                    const teacherName = String(row['nama guru'] || row['nama']).trim();
                    const rawUsername = row['username'] || row['user name'] || row['user'] || row['email'];
                    const rawPassword = row['password'] || row['sandi'] || row['kata sandi'];

                    const teacherData = {
                        code: row['kode guru'] || row['kode'] ? String(row['kode guru'] || row['kode']).trim() : null,
                        name: teacherName,
                        nip: row['nip'] ? String(row['nip']).trim() : null,
                        username: rawUsername ? String(rawUsername).trim() : null,
                        password: rawPassword ? String(rawPassword).trim() : 'password123',
                    };

                    try {
                        await api.post('/teachers', teacherData);
                        importedCount++;
                    } catch (err) {
                        console.error("Error importing row: ", err);
                        errorCount++;
                    }
                }

                if (errorCount > 0) {
                    toast.success(`${importedCount} guru berhasil diimpor, ${errorCount} gagal (mungkin sudah ada).`, { id: toastId });
                } else {
                    toast.success(`${importedCount} guru berhasil diimpor.`, { id: toastId });
                }

                setFile(null);
                getTeachers();
            } catch (error) {
                console.error("Error reading file: ", error);
                toast.error('Gagal membaca file Excel.', { id: toastId });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const downloadTemplate = () => {
        const link = document.createElement('a');
        link.href = '/template_Guru.xlsx';
        link.download = 'template_Guru.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isAdmin = user?.role === 'admin';

    return (
        <div className="space-y-6">
            {isAdmin && (
                <>
                    {/* Add Teacher Form */}
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus size={20} className="text-purple-600 dark:text-purple-400" />
                            <h3 className="text-lg font-bold text-text-light dark:text-text-dark text-purple-600 dark:text-purple-400">Input Data Guru</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <StyledInput
                                type="text"
                                placeholder="Kode Guru"
                                value={newTeacher.code}
                                onChange={(e) => setNewTeacher({ ...newTeacher, code: e.target.value })}
                            />
                            <StyledInput
                                type="text"
                                placeholder="Nama Guru"
                                value={newTeacher.name}
                                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                            />
                            <StyledInput
                                type="text"
                                placeholder="NIP"
                                value={newTeacher.nip}
                                onChange={(e) => setNewTeacher({ ...newTeacher, nip: e.target.value })}
                            />
                            <StyledInput
                                type="text"
                                placeholder="User / Username"
                                value={newTeacher.username}
                                onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
                            />
                            <StyledInput
                                type="text"
                                placeholder="Password"
                                value={newTeacher.password}
                                onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                            />
                        </div>

                        <div className="mt-4 flex justify-end">
                            <StyledButton onClick={handleAddTeacher}>
                                <Plus className="mr-2" size={16} /> Tambah Data Guru
                            </StyledButton>
                        </div>
                    </div>

                    {/* Import/Export Data */}
                    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-purple-900/20">
                        <div className="flex items-center gap-2 mb-4">
                            <Upload size={20} className="text-purple-600 dark:text-purple-400" />
                            <h3 className="text-lg font-bold text-text-light dark:text-text-dark text-purple-600 dark:text-purple-400">Impor Data Guru Dari Excel</h3>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <StyledInput
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                className="flex-1"
                            />
                            <div className="flex gap-2">
                                <StyledButton onClick={importTeachers} variant="secondary">
                                    <Upload className="mr-2" size={16} /> Impor
                                </StyledButton>
                                <StyledButton onClick={downloadTemplate} variant="outline">
                                    <Download className="mr-2" size={16} /> Unduh Template
                                </StyledButton>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 italic">*Gunakan template yang disediakan untuk menghindari kesalahan format.</p>
                    </div>
                </>
            )}

            {/* Teacher List */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <UserCheck size={20} className="text-purple-600 dark:text-purple-400" />
                        <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                            {isAdmin ? 'Daftar Guru' : 'Profil Saya'}
                        </h3>
                    </div>
                    {isAdmin && (
                        <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-3 py-1 rounded-full">{teachers.length} Guru</span>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="text-center p-12 bg-gray-50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <p className="text-text-muted-light dark:text-text-muted-dark font-medium">Belum ada data guru.</p>
                    </div>
                ) : (
                    <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'max-w-2xl mx-auto'} gap-4 max-h-[600px] overflow-y-auto p-2 scrollbar-hide`}>
                        {teachers.map((teacher) => (
                            <TeacherCard
                                key={teacher.id}
                                teacher={teacher}
                                allTeachers={teachers}
                                subjects={subjects}
                                classes={classes}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteTeacher}
                                onRefresh={getTeachers}
                                isAdmin={isAdmin}
                                canManageAssignments={isAdmin || (user?.role === 'teacher' && teacher.auth_user_id === user?.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <Modal onClose={() => setIsEditModalOpen(false)}>
                    <div className="flex items-center gap-2 mb-6">
                        <Pencil size={20} className="text-purple-600" />
                        <h3 className="text-xl font-bold">Edit Data Guru</h3>
                    </div>

                    <form onSubmit={handleUpdateTeacher} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Kode Guru</label>
                            <StyledInput
                                type="text"
                                placeholder="Kode Guru"
                                value={editData.code}
                                onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Nama Guru</label>
                            <StyledInput
                                type="text"
                                placeholder="Nama Guru"
                                value={editData.name}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">NIP</label>
                            <StyledInput
                                type="text"
                                placeholder="NIP"
                                value={editData.nip}
                                onChange={(e) => setEditData({ ...editData, nip: e.target.value })}
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Username</label>
                            <StyledInput
                                type="text"
                                placeholder="Username"
                                value={editData.username}
                                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                disabled={!isAdmin}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 ml-1">Password <span className="text-[10px] font-medium text-purple-500 ml-1">(Kosongkan jika tidak ingin mengubah password)</span></label>
                            <StyledInput
                                type="text"
                                placeholder="Password"
                                value={editData.password}
                                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <StyledButton type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</StyledButton>
                            <StyledButton type="submit">Simpan Perubahan</StyledButton>
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
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">Hapus Data Guru?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto text-sm font-medium">Apakah Anda yakin ingin menghapus data guru ini? Tindakan ini tidak dapat dibatalkan.</p>
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
