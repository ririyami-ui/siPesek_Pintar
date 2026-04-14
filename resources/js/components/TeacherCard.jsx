import React, { useState } from 'react';
import { Trash2, Pencil, ChevronDown, ChevronUp, User, Plus, X, GraduationCap, BookOpen, Clock } from 'lucide-react';
import StyledButton from './StyledButton';
import Select from 'react-select';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const TeacherCard = ({ teacher, allTeachers, subjects, classes, onEdit, onDelete, onRefresh, isAdmin, canManageAssignments }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [loading, setLoading] = useState(false);

    // Group assignments by subject
    const groupedAssignments = teacher.assignments?.reduce((acc, curr) => {
        const subjectId = curr.subject_id;
        if (!acc[subjectId]) {
            acc[subjectId] = {
                subject: curr.subject,
                classes: []
            };
        }
        acc[subjectId].classes.push(curr.school_class || { rombel: 'Unknown' });
        return acc;
    }, {}) || {};
    
    // Calculate total teaching burden (sum of weekly hours from all assignments)
    const totalBurden = teacher.assignments?.reduce((acc, curr) => {
        return acc + (parseInt(curr.subject?.weekly_hours) || 0);
    }, 0) || 0;

    const subjectOptions = subjects.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }));
    
    // Filter out classes already assigned to other teachers for the currently selected subject
    const availableClassOptions = React.useMemo(() => {
        const baseOptions = classes.map(c => ({ value: c.id, label: c.rombel }));
        if (!selectedSubject || !allTeachers) return baseOptions;

        const takenClassIds = new Set();
        allTeachers.forEach(t => {
            if (String(t.id) === String(teacher.id)) return; // Skip current teacher
            t.assignments?.forEach(a => {
                if (String(a.subject_id) === String(selectedSubject.value)) {
                    takenClassIds.add(String(a.class_id));
                }
            });
        });

        return baseOptions.filter(opt => !takenClassIds.has(String(opt.value)));
    }, [classes, selectedSubject, allTeachers, teacher.id]);

    const handleSaveAssignment = async () => {
        if (!selectedSubject || selectedClasses.length === 0) {
            toast.error('Pilih Mata Pelajaran dan minimal satu Rombel.');
            return;
        }

        setLoading(true);
        try {
            // Prepare current assignments
            const currentAssignments = Object.keys(groupedAssignments).map(subId => ({
                subject_id: parseInt(subId),
                class_ids: groupedAssignments[subId].classes.map(c => c.id).filter(id => id)
            }));

            // Check if subject already exists in assignments
            const existingIdx = currentAssignments.findIndex(a => a.subject_id === selectedSubject.value);

            if (existingIdx !== -1) {
                // Merge classes
                const newClassIds = selectedClasses.map(c => c.value);
                const combined = [...new Set([...currentAssignments[existingIdx].class_ids, ...newClassIds])];
                currentAssignments[existingIdx].class_ids = combined;
            } else {
                currentAssignments.push({
                    subject_id: selectedSubject.value,
                    class_ids: selectedClasses.map(c => c.value)
                });
            }

            await api.post(`/teachers/${teacher.id}/sync-assignments`, { assignments: currentAssignments });
            toast.success('Penugasan berhasil diperbarui!');
            setIsAssigning(false);
            setSelectedSubject(null);
            setSelectedClasses([]);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Error syncing assignments:", error);
            toast.error('Gagal menyimpan penugasan.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSubject = async (subjectId) => {
        const currentAssignments = Object.keys(groupedAssignments)
            .filter(id => parseInt(id) !== parseInt(subjectId))
            .map(id => ({
                subject_id: parseInt(id),
                class_ids: groupedAssignments[id].classes.map(c => c.id).filter(id => id)
            }));

        try {
            await api.post(`/teachers/${teacher.id}/sync-assignments`, { assignments: currentAssignments });
            toast.success('Mata Pelajaran berhasil dihapus dari penugasan.');
            if (onRefresh) onRefresh();
        } catch (error) {
            toast.error('Gagal menghapus penugasan.');
        }
    };

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-lg flex flex-col space-y-3 border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start">
                <div className="flex gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 h-fit">
                        <User size={20} />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-text-light dark:text-text-dark leading-tight">{teacher.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md">{teacher.code || '-'}</span>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md flex items-center gap-1" title="Total Beban Mengajar per Pekan">
                                <Clock size={12} /> {totalBurden} Jam
                            </span>
                            <span className="text-[10px] font-medium text-text-muted-light dark:text-text-muted-dark">NIP: {teacher.nip || '-'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex space-x-1">
                    <StyledButton onClick={() => onEdit(teacher)} variant="ghost" size="sm" className="!p-1.5 text-gray-400 hover:text-purple-600"><Pencil size={15} /></StyledButton>
                    {isAdmin && (
                        <StyledButton onClick={() => onDelete(teacher.id)} variant="ghost" size="sm" className="!p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></StyledButton>
                    )}
                </div>
            </div>

            {/* Assignments List */}
            <div className="space-y-2">
                {Object.keys(groupedAssignments).length > 0 ? (
                    Object.keys(groupedAssignments).map((subId) => (
                        <div key={subId} className="bg-gray-50 dark:bg-gray-900/40 p-2 rounded-xl border border-gray-100 dark:border-gray-800 group relative">
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <BookOpen size={12} className="text-purple-500 flex-shrink-0" />
                                    <p className="text-xs font-bold text-text-light dark:text-text-dark truncate">
                                        {groupedAssignments[subId].subject?.name || 'Unknown'}
                                    </p>
                                </div>
                                {canManageAssignments && (
                                    <button
                                        onClick={() => handleRemoveSubject(subId)}
                                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {groupedAssignments[subId].classes.map((c, idx) => (
                                    <span key={idx} className="text-[10px] font-bold bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                        {c.rombel}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-3 px-2 text-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                        <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark font-medium italic">Belum mengampu Mapel</p>
                    </div>
                )}
            </div>

            {/* Assignment Form */}
            {canManageAssignments && (
                isAssigning ? (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30 space-y-2 animate-in zoom-in-95 duration-200">
                        <div>
                            <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mb-1 block">Pilih Mapel</label>
                            <Select
                                options={subjectOptions}
                                value={selectedSubject}
                                onChange={setSelectedSubject}
                                placeholder="Cari Mapel..."
                                className="text-xs text-black"
                                isSearchable
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mb-1 block">Pilih Rombel (Bisa banyak)</label>
                            <Select
                                options={availableClassOptions}
                                value={selectedClasses}
                                onChange={setSelectedClasses}
                                placeholder="Pilih Rombel..."
                                className="text-xs text-black"
                                isMulti
                                isSearchable
                            />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <StyledButton onClick={() => setIsAssigning(false)} variant="outline" size="sm" className="flex-1 !py-1 text-[10px]">Batal</StyledButton>
                            <StyledButton onClick={handleSaveAssignment} size="sm" className="flex-1 !py-1 text-[10px]" disabled={loading}>
                                {loading ? '...' : 'Simpan'}
                            </StyledButton>
                        </div>
                    </div>
                ) : (
                    <StyledButton
                        onClick={() => setIsAssigning(true)}
                        variant="outline"
                        size="sm"
                        className="w-full !py-1.5 text-[10px] border-dashed border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-900/30 dark:hover:bg-purple-900/10"
                    >
                        <Plus size={14} className="mr-1" /> Tambah Mapel & Rombel
                    </StyledButton>
                )
            )}

            {showDetails && (
                <div className="text-[11px] text-text-muted-light dark:text-text-muted-dark border-t border-gray-100 dark:border-gray-800 pt-2 animate-in slide-in-from-top-1">
                    <div className="flex justify-between items-center py-1">
                        <span className="font-semibold">Username:</span>
                        <span className="font-bold text-text-light dark:text-text-dark">{teacher.username || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                        <span className="font-semibold">Password:</span>
                        <span className="font-bold text-text-light dark:text-text-dark">{teacher.password || '-'}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-center">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-[10px] font-bold text-gray-400 hover:text-purple-600 transition-colors flex items-center"
                >
                    {showDetails ? <><ChevronUp size={12} className="mr-1" /> Less</> : <><ChevronDown size={12} className="mr-1" /> Info Akun</>}
                </button>
            </div>
        </div>
    );
};

export default TeacherCard;
