import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import Modal from './Modal';
import StyledButton from './StyledButton';
import toast from 'react-hot-toast';
import { Scale, BookOpen, ShieldAlert, FileText, Save, Download } from 'lucide-react';
import { useSettings } from '../utils/SettingsContext';
import { generateClassAgreementPDF } from '../utils/pdfGenerator';

export default function ClassAgreementModal({ isOpen, onClose, classId, rombel, level }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [knowledgeWeight, setKnowledgeWeight] = useState(40);
    const [practiceWeight, setPracticeWeight] = useState(60);
    const [academicWeight, setAcademicWeight] = useState(50);
    const [attitudeWeight, setAttitudeWeight] = useState(50);
    const [agreements, setAgreements] = useState('');
    const [students, setStudents] = useState([]);
    const { userProfile } = useSettings();

    useEffect(() => {
        const fetchData = async () => {
            if (!isOpen || !classId) return;
            setLoading(true);
            try {
                // Fetch Agreement
                const agreementRes = await api.get(`/class-agreements/${classId}`);
                const data = agreementRes.data;

                // If data is empty (default/404 handled in controller returning defaults), set values
                if (data) {
                    setKnowledgeWeight(data.knowledge_weight ?? 40);
                    setPracticeWeight(data.practice_weight ?? 60);
                    setAcademicWeight(data.academic_weight ?? 50);
                    setAttitudeWeight(data.attitude_weight ?? 50);
                    setAgreements(data.agreements ?? '');
                }

                // Fetch Students for Appendix
                // We can use the students API and filter by classId
                // Or if we have a direct endpoint for class students.
                // Using general students endpoint with query param logic handled in backend or frontend filtering
                // Ideally backend should support filtering by class_id directly in GET /students
                // Currently StudentController returns based on user_id, we can filter in frontend
                const studentsRes = await api.get('/students');
                let fetchedStudents = studentsRes.data.data.filter(s => s.class_id == classId || (s.class && s.class.id == classId));

                // Sort by attendance number (absen)
                fetchedStudents.sort((a, b) => (parseInt(a.absen) || 0) - (parseInt(b.absen) || 0));

                setStudents(fetchedStudents);
            } catch (error) {
                console.error("Error fetching data:", error);
                toast.error('Gagal memuat data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [isOpen, classId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/class-agreements', {
                class_id: classId,
                knowledge_weight: knowledgeWeight,
                practice_weight: practiceWeight,
                academic_weight: academicWeight,
                attitude_weight: attitudeWeight,
                agreements: agreements
            });
            toast.success(`Kesepakatan kelas ${rombel} berhasil disimpan!`);
            onClose();
        } catch (error) {
            console.error("Error saving agreement:", error);
            toast.error('Gagal menyimpan kesepakatan');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar p-1">
                <header className="flex items-center gap-3 border-b dark:border-gray-700 pb-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <Scale className="text-purple-600 dark:text-purple-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Kesepakatan Kelas {rombel}</h2>
                        <p className="text-xs text-gray-500">Atur bobot nilai dan aturan main di kelas ini</p>
                    </div>
                    <div className="ml-auto">
                        <StyledButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (students.length === 0) {
                                    toast.error('Daftar siswa kosong! Lampiran tanda tangan tidak akan muncul.');
                                }
                                generateClassAgreementPDF({
                                    classData: { level, rombel },
                                    agreementData: { knowledgeWeight, practiceWeight, academicWeight, attitudeWeight, agreements },
                                    userProfile,
                                    teacherName: userProfile?.name || 'Guru',
                                    students: students
                                });
                            }}
                            className="text-blue-600 border-blue-200"
                            disabled={loading}
                        >
                            <Download size={16} className="mr-2" /> Cetak PDF
                        </StyledButton>
                    </div>
                </header>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Bobot Nilai Akademik */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                                <BookOpen size={16} className="text-blue-500" />
                                <span>Bobot Nilai Akademik</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-blue-600">Pengetahuan: {knowledgeWeight}%</span>
                                    <span className="text-xs font-bold text-emerald-600">Praktik: {practiceWeight}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={knowledgeWeight}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setKnowledgeWeight(val);
                                        setPracticeWeight(100 - val);
                                    }}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                                />
                                <p className="text-[10px] text-gray-400 italic text-center">
                                    *Akan digunakan sebagai rumus Nilai Akhir (NA) untuk kelas {rombel}.
                                </p>
                            </div>
                        </section>

                        {/* Bobot Rekap Akhir */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                                <ShieldAlert size={16} className="text-purple-500" />
                                <span>Bobot Rekap Akhir</span>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-bold text-blue-600">Akademik: {academicWeight}%</span>
                                    <span className="text-xs font-bold text-purple-600">Sikap: {attitudeWeight}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={academicWeight}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setAcademicWeight(val);
                                        setAttitudeWeight(100 - val);
                                    }}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:bg-gray-700"
                                />
                            </div>
                        </section>

                        {/* Teks Kesepakatan */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                                <FileText size={16} className="text-amber-500" />
                                <span>Poin Kesepakatan (Tata Tertib)</span>
                            </div>
                            <textarea
                                value={agreements}
                                onChange={(e) => setAgreements(e.target.value)}
                                placeholder="Contoh: &#10;1. Masuk kelas tepat waktu &#10;2. Menghargai teman saat presentasi &#10;3. Kumpul tugas maksimal H+3..."
                                className="w-full h-40 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-sm text-gray-700 dark:text-gray-300 custom-scrollbar resize-none font-medium"
                            />
                        </section>

                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                            <StyledButton variant="outline" onClick={onClose} disabled={saving}>Batal</StyledButton>
                            <StyledButton onClick={handleSave} disabled={saving}>
                                {saving ? 'Menyimpan...' : 'Simpan Kesepakatan'}
                                {!saving && <Save className="ml-2" size={16} />}
                            </StyledButton>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
