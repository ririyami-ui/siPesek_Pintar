import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Loader, FileText, Zap, Users, ClipboardCheck, GraduationCap, TrendingUp, TrendingDown, Award, AlertTriangle, Lightbulb, Plus, X, Save, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import moment from 'moment';
import { useSettings } from '../utils/SettingsContext';
import { analisisUlanganHarian, rekomendasiKetuntasan, rekomendasiLokal } from '../utils/analisisButir';

// Components for displaying data
import SummaryCard from '../components/SummaryCard';
import StyledSelect from '../components/StyledSelect';


const AnalisisUlanganHarianPage = () => {
  const navigate = useNavigate();
  const [userClasses, setUserClasses] = useState([]);
  const [userSubjects, setUserSubjects] = useState([]);
  const [ulanganHarianList, setUlanganHarianList] = useState([]);
  const [selectedUlanganHarian, setSelectedUlanganHarian] = useState('');
  const [analisisResult, setAnalisisResult] = useState(null);
  const [rekomendasiAI, setRekomendasiAI] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingUlanganHarian, setLoadingUlanganHarian] = useState(true);
  const [loadingClassesSubjects, setLoadingClassesSubjects] = useState(true);
  const [error, setError] = useState('');

  const { activeSemester, academicYear, userProfile } = useSettings();

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { id } saat mode edit
  const [editScoresSource, setEditScoresSource] = useState(null); // prefill skor saat edit
  const [editRemidiSource, setEditRemidiSource] = useState(null); // prefill remidi saat edit
  const [editItemMetaSource, setEditItemMetaSource] = useState(null); // prefill konfigurasi butir saat edit
  const [formClassId, setFormClassId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formKktp, setFormKktp] = useState(70);
  const [formTargetKlasikal, setFormTargetKlasikal] = useState(80);
  const [formNumItems, setFormNumItems] = useState(10);
  const [formItems, setFormItems] = useState([]);
  const [formStudents, setFormStudents] = useState([]);
  const [formScores, setFormScores] = useState({});
  const [formRemidi, setFormRemidi] = useState({});
  const [savingNew, setSavingNew] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [autoAnalyzeId, setAutoAnalyzeId] = useState(null);

  useEffect(() => {
    if (!formClassId) {
      setFormStudents([]);
      return;
    }
    const fetchFormStudents = async () => {
      setLoadingStudents(true);
      try {
        const res = await api.get('/students', { params: { class_id: formClassId, all: true } });
        const list = res.data.data || res.data || [];
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setFormStudents(list);

        const initialScores = {};
        list.forEach(s => {
          initialScores[s.id] = {};
          for (let i = 1; i <= formNumItems; i++) {
            initialScores[s.id][i] = 0;
          }
        });

        // Prefill saat mode edit (nilai yang sudah tersimpan)
        if (editScoresSource) {
          list.forEach(s => {
            const saved = editScoresSource[s.id] || {};
            initialScores[s.id] = { ...initialScores[s.id], ...saved };
          });
        }
        setFormScores(initialScores);
        setFormRemidi(editRemidiSource || {});
      } catch (err) {
        console.error("Error fetching students for create form:", err);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchFormStudents();
  }, [formClassId, formNumItems, editScoresSource, editRemidiSource]);

  useEffect(() => {
    if (editItemMetaSource && editItemMetaSource.length) {
      setFormItems(editItemMetaSource);
      return;
    }
    const items = [];
    for (let i = 1; i <= formNumItems; i++) {
      items.push({
        no: i,
        tipe: 'Esai',
        elemen: 'Pemahaman',
        materi: formTopic || 'Materi Utama',
        skor_maks: Math.round(100 / formNumItems),
        bobot: 1,
      });
    }
    setFormItems(items);
  }, [formNumItems, formTopic, editItemMetaSource]);

  const handleSaveNewAssessment = async (e) => {
    e.preventDefault();
    if (!formClassId || !formSubjectId || !formTopic) {
      alert("Harap lengkapi Kelas, Mata Pelajaran, dan Topik/Materi.");
      return;
    }

    setSavingNew(true);
    try {
      const selectedClassObj = userClasses.find(c => String(c.id) === String(formClassId));
      const selectedSubjectObj = userSubjects.find(s => String(s.id) === String(formSubjectId));

      const payload = {
        rpp_topic: formTopic,
        class_id: formClassId,
        class_name: selectedClassObj ? (selectedClassObj.rombel || selectedClassObj.name || selectedClassObj.class_name) : 'Kelas',
        subject_id: formSubjectId,
        subject_name: selectedSubjectObj ? selectedSubjectObj.name : 'Mapel',
        date: formDate,
        item_meta: formItems,
        scores: formScores,
        kktp_score: formKktp,
        target_klasikal: formTargetKlasikal,
        semester: activeSemester,
        academic_year: academicYear,
        sync_to_grades: true,
        assessment_type: 'Ulangan Harian'
      };
      if (editTarget) payload.remidi_scores = formRemidi;

      let res;
      if (editTarget) {
        res = await api.put(`/ulangan-harian/${editTarget.id}`, payload);
      } else {
        res = await api.post('/ulangan-harian', payload);
      }
      alert(editTarget
        ? "Analisis Ulangan Harian berhasil diperbarui dan disinkronkan ke nilai siswa!"
        : "Analisis Ulangan Harian berhasil disimpan dan disinkronkan ke nilai siswa!");
      setShowCreateModal(false);
      setEditTarget(null);
      setEditScoresSource(null);
      setEditRemidiSource(null);
      setEditItemMetaSource(null);
      setFormRemidi({});

      const listRes = await api.get('/ulangan-harian', { params: { semester: activeSemester, academic_year: academicYear } });
      setUlanganHarianList(listRes.data.data || listRes.data || []);
      if (res.data.data && res.data.data.id) {
        setSelectedUlanganHarian(res.data.data.id);
        setAutoAnalyzeId(res.data.data.id);
      }
    } catch (err) {
      console.error("Error saving ulangan harian:", err);
      alert("Gagal menyimpan analisis ulangan harian.");
    } finally {
      setSavingNew(false);
    }
  };

  // Fetch classes and subjects
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoadingClassesSubjects(true);
      try {
        const [classesRes, subjectsRes] = await Promise.all([
          api.get('/classes'),
          api.get('/subjects')
        ]);
        setUserClasses(classesRes.data.data || classesRes.data || []);
        setUserSubjects(subjectsRes.data.data || subjectsRes.data || []);
      } catch (err) {
        console.error("Error fetching classes/subjects:", err);
        setError("Gagal memuat daftar kelas dan mata pelajaran.");
      } finally {
        setLoadingClassesSubjects(false);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch Ulangan Harian items based on selected class/subject/semester/year
  useEffect(() => {
    const fetchUlanganHarian = async () => {
      if (!activeSemester || !academicYear) return;

      setLoadingUlanganHarian(true);
      setSelectedUlanganHarian('');
      setUlanganHarianList([]);
      setAnalisisResult(null);
      setRekomendasiAI(null);

      try {
        const params = {
          semester: activeSemester,
          academic_year: academicYear,
          // class_id: selectedClassId, // Add filters if needed
          // subject_id: selectedSubjectId,
        };
        const res = await api.get('/ulangan-harian', { params });
        const list = res.data.data || res.data || [];
        setUlanganHarianList(list);
      } catch (err) {
        console.error("Error fetching Ulangan Harian list:", err);
        setError("Gagal memuat daftar ulangan harian.");
      } finally {
        setLoadingUlanganHarian(false);
      }
    };

    fetchUlanganHarian();
  }, [activeSemester, academicYear]);

  const generateAnalysisAndRecommendation = useCallback(async () => {
    if (!selectedUlanganHarian) {
      setError("Pilih salah satu Ulangan Harian untuk dianalisis.");
      return;
    }

    setLoading(true);
    setAnalisisResult(null);
    setRekomendasiAI(null);
    setError('');

    try {
      const uhItem = ulanganHarianList.find(uh => String(uh.id) === String(selectedUlanganHarian));
      if (!uhItem) {
        setError("Data Ulangan Harian tidak ditemukan.");
        setLoading(false);
        return;
      }

      // 1. Lakukan analisis butir & siswa lokal (statistik murni)
      const hasilAnalisis = analisisUlanganHarian(uhItem);
      setAnalisisResult(hasilAnalisis);

      // 2. Buat rekomendasi ketuntasan lokal
      const rombelData = { kktp: uhItem.kktp_score || 70, students: [] };
      let studentsList = [];
      const classInfo = userClasses.find(c => String(c.id) === String(uhItem.class_id));
      if (classInfo && classInfo.students) {
        studentsList = classInfo.students;
      } else if (uhItem.class_id) {
        try {
          const res = await api.get('/students', { params: { class_id: uhItem.class_id, all: true } });
          studentsList = res.data.data || res.data || [];
        } catch (e) {
          console.error("Error fetching class students for analysis:", e);
        }
      }
      rombelData.students = studentsList.map(s => ({ id: s.id, name: s.name }));

      const rekomendasiLokalArr = rekomendasiKetuntasan(hasilAnalisis, rombelData).map(s => {
        const st = studentsList.find(st => String(st.id) === String(s.student_id));
        return {
          ...s,
          student_name: st ? st.name : `Siswa ID ${s.student_id}`,
          no_absen: st && st.absen != null && st.absen !== '' ? st.absen : s.student_id,
        };
      });
      hasilAnalisis.rekomendasi = rekomendasiLokalArr;

      // 3. Rekomendasi per siswa — MURNI STATISTIK (tanpa Gemini, tanpa halusinasi)
      const rekomendasiMurni = rekomendasiLokal(rekomendasiLokalArr);
      setRekomendasiAI(rekomendasiMurni);

    } catch (err) {
      console.error("Error generating analysis:", err);
      setError("Gagal membuat analisis dan rekomendasi.");
    } finally {
      setLoading(false);
    }
  }, [selectedUlanganHarian, ulanganHarianList, userClasses]);

  // Jalankan analisis ulang otomatis setelah simpan/perbarui nilai tersimpan
  useEffect(() => {
    if (autoAnalyzeId && ulanganHarianList.some(uh => String(uh.id) === String(autoAnalyzeId))) {
      setAutoAnalyzeId(null);
      generateAnalysisAndRecommendation();
    }
  }, [ulanganHarianList, autoAnalyzeId, generateAnalysisAndRecommendation]);

  const handleUlanganHarianChange = (e) => {
    setSelectedUlanganHarian(e.target.value);
    setAnalisisResult(null);
    setRekomendasiAI(null);
    setError('');
  };

  // Prepare data for PDF export (similar to AnalisisKelasPage)
  const handleExportPDF = async () => {
    if (!analisisResult || !rekomendasiAI) {
      setError("Analisis belum lengkap untuk diekspor.");
      return;
    }
    setLoading(true);
    try {
      const { generateUlanganHarianPDF } = await import('../utils/pdfGenerator');
      const uhItem = ulanganHarianList.find(uh => String(uh.id) === String(selectedUlanganHarian));
      await generateUlanganHarianPDF(uhItem, analisisResult, rekomendasiAI, userProfile || {}, academicYear, activeSemester);
    } catch (err) {
      console.error("Error generating PDF:", err);
      setError("Gagal membuat laporan PDF.");
    } finally {
      setLoading(false);
    }
  };

  // Prepare Word (.docx) export — mengikuti template 8 bagian (blanko terisi otomatis, nama siswa tampil)
  const handleExportWord = async () => {
    if (!analisisResult || !rekomendasiAI) {
      setError("Analisis belum lengkap untuk diekspor ke Word.");
      return;
    }
    setLoading(true);
    try {
      const [{ generateUlanganHarianWord }, { saveAs }] = await Promise.all([
        import('../utils/ulanganHarianDocx'),
        import('file-saver'),
      ]);
      const uhItem = ulanganHarianList.find(uh => String(uh.id) === String(selectedUlanganHarian));
      
      // Ambil data absensi kelas pada tanggal ulangan tersebut jika ada
      let attendanceMap = {};
      if (uhItem && uhItem.class_id && uhItem.date) {
        try {
          const res = await api.get('/attendances', {
            params: { class_id: uhItem.class_id, date: uhItem.date.slice(0, 10), all: true }
          });
          const attList = res.data.data || res.data || [];
          attList.forEach(a => {
            if (a.student_id) {
              attendanceMap[String(a.student_id)] = a.status; // 'hadir', 'sakit', 'izin', 'alpa'
            }
          });
        } catch (e) {
          console.warn("Gagal memuat data absensi untuk laporan:", e);
        }
      }
      uhItem.attendanceMap = attendanceMap;

      const blob = await generateUlanganHarianWord(uhItem, analisisResult, rekomendasiAI, userProfile || {}, academicYear, activeSemester);
      const topic = (uhItem?.rpp_topic || uhItem?.subject_name || 'Ulangan_Harian').replace(/\s+/g, '_');
      saveAs(blob, `Analisis_Ulangan_Harian_${topic}.docx`);
    } catch (err) {
      console.error("Error generating Word:", err);
      setError("Gagal membuat laporan Word.");
    } finally {
      setLoading(false);
    }
  };

  // Buka modal edit: prefill form dari data ulangan harian terpilih (nilai & remidi)
  const handleEditNilai = () => {
    if (!selectedUlanganHarian) {
      alert("Pilih ulangan harian terlebih dahulu.");
      return;
    }
    const uh = ulanganHarianList.find(u => String(u.id) === String(selectedUlanganHarian));
    if (!uh) {
      alert("Data ulangan harian tidak ditemukan.");
      return;
    }
    setEditTarget({ id: uh.id });
    setEditScoresSource(uh.scores || {});
    setEditRemidiSource(uh.remidi_scores || {});
    setEditItemMetaSource(Array.isArray(uh.item_meta) ? uh.item_meta : null);
    setFormClassId(uh.class_id ? String(uh.class_id) : '');
    setFormSubjectId(uh.subject_id ? String(uh.subject_id) : '');
    setFormTopic(uh.rpp_topic || '');
    setFormDate((uh.date || '').slice(0, 10));
    setFormKktp(Number(uh.kktp_score || 70));
    setFormTargetKlasikal(Number(uh.target_klasikal || 80));
    setFormNumItems((uh.item_meta || []).length || 10);
    setShowCreateModal(true);
  };

  // Data preparation for Tables/Charts
  const ButirAnalysisColumns = [
    { header: 'No', accessor: 'no' },
    { header: 'Tipe', accessor: 'tipe' },
    { header: 'Elemen', accessor: 'elemen' },
    { header: 'Materi', accessor: 'materi' },
    { header: 'Kesukaran (P)', accessor: 'kesukaran.p' },
    { header: 'Daya Pembeda (D)', accessor: 'dayaPembeda.d' },
    { header: 'Validitas (r)', accessor: 'validitas.r' },
    { header: 'Kategori Validitas', accessor: 'validitas.kategori' },
    { header: 'Rerata Skor', accessor: 'rerata' },
    { header: 'N Benar', accessor: 'nBenar' },
    { header: 'Daya Serap (%)', accessor: 'dayaSerap' },
  ];

  const SiswaAnalysisColumns = [
    { header: 'No. Absen', accessor: 'no_absen' },
    { header: 'Nama Siswa', accessor: 'student_name' },
    { header: 'Skor Total (Mentah)', accessor: 'skorTotal' },
    { header: 'Skor Akhir (0-100)', accessor: 'skorAkhir' },
    { header: 'Ketuntasan', accessor: 'status' },
    { header: 'Tindakan', accessor: 'tindakan' },
    { header: 'Butir Gagal', accessor: 'butirGagal' }, // Nomor butir dengan penguasaan < 60%
    { header: 'N Butir Gagal', accessor: 'nButirGagal' },
  ];

  // Ringkasan ketuntasan kelas (statistik murni dari tampilan analisis)
  const rekomendasiLok = (analisisResult?.rekomendasi || []).filter(r => r && r.tindakan);
  const tuntasCount = rekomendasiLok.filter(r => r.tindakan === 'Pengayaan').length;
  const belumCount = rekomendasiLok.filter(r => r.tindakan === 'Remedial').length;
  const totalSiswa = rekomendasiLok.length || analisisResult?.kelas?.nSiswa || 0;
  const persenKetuntasan = totalSiswa ? Number(((tuntasCount / totalSiswa) * 100).toFixed(2)) : 0;
  const butirLemahKelas = analisisResult?.kelas?.butirLemah || [];
  // Ketuntasan klasikal: minimal X% siswa mencapai KKTP (target_klasikal, default 80)
  const uhTerpilih = ulanganHarianList.find(uh => String(uh.id) === String(selectedUlanganHarian));
  const kktpKelas = Number(uhTerpilih?.kktp_score || analisisResult?.kelas?.kktp || 70);
  const targetKlasikal = Number(uhTerpilih?.target_klasikal || 80);
  const tuntasKlasikal = persenKetuntasan >= targetKlasikal;
  // Ketuntasan setelah remidi: skor terakhir siswa = nilai remidi (bila ada & ≥ 0), selain itu skor akhir
  const remidiScores = uhTerpilih?.remidi_scores || {};
  const skorTerakhirSiswa = (r) => {
    const v = remidiScores[String(r.student_id)];
    const after = v !== undefined && v !== null && v !== '' ? Number(v) : null;
    return (after !== null && !Number.isNaN(after) && after >= 0) ? after : Number(r.skorAkhir || 0);
  };
  const rekomLengkap = rekomendasiLok.map(r => ({ ...r, skorSetelahRemidi: skorTerakhirSiswa(r) }));
  const tuntasSetelahRemidi = rekomLengkap.filter(r => r.skorSetelahRemidi >= kktpKelas).length;
  const persenKetuntasanAfterRemidi = totalSiswa ? Number(((tuntasSetelahRemidi / totalSiswa) * 100).toFixed(2)) : 0;
  const tuntasKlasikalAfterRemidi = persenKetuntasanAfterRemidi >= targetKlasikal;

  return (
    <div className="p-3 sm:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <Zap size={24} />
          </button>
          <h1 className="text-2xl font-bold">Analisis Ulangan Harian</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 shadow-md transition text-sm font-semibold"
        >
          <Plus size={18} /> Buat Analisis Baru
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
        {loadingClassesSubjects || loadingUlanganHarian ? <Loader className="animate-spin" /> : (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <StyledSelect value={selectedUlanganHarian} onChange={handleUlanganHarianChange}>
                <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">-- Pilih Ulangan Harian --</option>
                {ulanganHarianList.map(uh => (
                  <option key={uh.id} value={uh.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                     {`[${moment(uh.date).format('YYYY-MM-DD')}] ${uh.rpp_topic} (${uh.class_name} - ${uh.subject_name})`}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <button onClick={generateAnalysisAndRecommendation} disabled={!selectedUlanganHarian || loading} className="px-6 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2">
              {loading ? <Loader className="animate-spin" size={20} /> : <Zap size={20} />}
              {loading ? 'Menganalisis...' : 'Mulai Analisis'}
            </button>
          </div>
        )}
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {analisisResult && !loading && (
        <div className="space-y-8 animate-fade-in-up">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border dark:border-gray-700">
            <h2 className="text-xl font-black flex items-center gap-3">
              <TrendingUp className="text-blue-600" />
              <span>Hasil Analisis Ulangan Harian</span>
            </h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleEditNilai}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-2 text-sm transition"
              >
                <Save size={18} /> Edit Nilai
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2 text-sm transition"
                disabled={!analisisResult}
              >
                <FileText size={18} /> PDF
              </button>
              <button
                onClick={handleExportWord}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 text-sm transition"
                disabled={!analisisResult}
              >
                <FileText size={18} /> Word
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="N Siswa" value={analisisResult.kelas.nSiswa} icon={<Users />} color="purple" />
            <SummaryCard title="N Butir" value={analisisResult.kelas.nButir} icon={<ClipboardCheck />} color="blue" />
            <SummaryCard title="Rerata Skor Akhir" value={analisisResult.kelas.rerataAkhir} icon={<GraduationCap />} color="green" />
            <SummaryCard title="Alpha Reliabilitas" value={analisisResult.kelas.alphaReliabilitas.alpha} icon={<Lightbulb />} color="yellow" subtitle={analisisResult.kelas.alphaReliabilitas.kategori} />
            <SummaryCard title="Nilai Terendah" value={analisisResult.kelas.statistik.min} icon={<TrendingDown />} color="red" />
            <SummaryCard title="Nilai Tertinggi" value={analisisResult.kelas.statistik.max} icon={<TrendingUp />} color="green" />
            <SummaryCard title="Median" value={analisisResult.kelas.statistik.median} icon={<Award />} color="indigo" />
            <SummaryCard title="Modus" value={analisisResult.kelas.statistik.modusList.length ? analisisResult.kelas.statistik.modusList.join(', ') : 'Tidak ada'} icon={<Lightbulb />} color="yellow" subtitle={`Rat. Penyimpangan (SD): ${analisisResult.kelas.statistik.standarDeviasi}`} />
            <SummaryCard title="Daya Serap (%)" value={analisisResult.kelas.dayaSerap} icon={<Target />} color="red" subtitle="Rata-rata skor akhir (penguasaan klasikal)" />
          </div>

          {/* Distribusi Skor */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-4">Distribusi Skor Akhir</h3>
            <div className="flex flex-col gap-2">
              {analisisResult.distribusi.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-24 text-sm text-gray-600 dark:text-gray-400">{d.interval}</span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-blue-500 rounded-full h-full text-xs text-white flex items-center justify-end pr-1"
                      style={{ width: `${(d.count / Math.max(...analisisResult.distribusi.map(item => item.count))) * 100}%` }}
                    >
                      {d.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Butir Analysis Table */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-lg font-bold mb-4">Analisis Butir Soal</h3>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {ButirAnalysisColumns.map((col, idx) => (
                    <th key={idx} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {analisisResult.items.map((item, rowIdx) => (
                  <tr key={rowIdx}>
                    {ButirAnalysisColumns.map((col, colIdx) => (
                      <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {col.accessor.includes('.') ? item[col.accessor.split('.')[0]][col.accessor.split('.')[1]] : item[col.accessor]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Soal yang Tidak Dikuasai Kelas */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-bold mb-2">Soal yang Tidak Dikuasai Kelas</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Butir dengan daya serap di bawah KKTP ({analisisResult.kelas?.kktpKelas ?? 70}%) — dasar remidi klasikal / penjelasan ulang materi.
            </p>
            {analisisResult.kelas?.butirLemah?.length ? (
              <ul className="space-y-2">
                {analisisResult.kelas.butirLemah.map((b) => (
                  <li key={b.no} className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    <span className="font-semibold">Soal No. {b.no}</span>
                    {b.materi ? <span className="text-gray-600 dark:text-gray-300"> — {b.elemen && b.elemen !== b.materi ? `${b.elemen} • ` : ''}{b.materi}</span> : null}
                    <span className="ml-auto font-medium text-red-600 dark:text-red-400">Daya serap {b.dayaSerap}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Semua butir dikuasai kelas (daya serap ≥ KKTP).</p>
            )}
          </div>

          {/* Siswa Analysis Table */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-lg font-bold mb-4">Analisis Per Siswa & Rekomendasi</h3>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {SiswaAnalysisColumns.map((col, idx) => (
                    <th key={idx} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {(analisisResult?.rekomendasi || []).map((item, rowIdx) => (
                  <tr key={rowIdx}>
                    {SiswaAnalysisColumns.map((col, colIdx) => (
                      <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {col.accessor === 'butirGagal' ? (item[col.accessor] || []).map(b => `No.${b.no ?? b}`).join(', ') : (item[col.accessor] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ringkasan Ketuntasan Kelas (dari analisis murni, bukan AI) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border dark:border-gray-700">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex items-center gap-4">
              <ClipboardCheck size={24} />
              <h3 className="text-lg font-black uppercase">Ringkasan Ketuntasan Kelas</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-green-600 dark:text-green-400">{tuntasCount}</p>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">Siswa Tuntas</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-red-600 dark:text-red-400">{belumCount}</p>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">Siswa Belum Tuntas</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-center">
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{persenKetuntasan}%</p>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mt-1">Persentase Ketuntasan</p>
                </div>
              </div>

              <div className={`rounded-2xl p-4 mb-6 border ${tuntasKlasikal
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center gap-3">
                  {tuntasKlasikal
                    ? <TrendingUp className="text-emerald-600 dark:text-emerald-400 shrink-0" size={28} />
                    : <TrendingDown className="text-amber-600 dark:text-amber-400 shrink-0" size={28} />}
                  <div>
                    <p className={`text-lg font-black ${tuntasKlasikal ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {tuntasKlasikal ? 'TUNTAS KLASIKAL' : 'BELUM TUNTAS KLASIKAL'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {persenKetuntasan}% siswa tuntas dari target klasikal {targetKlasikal}% (KKTP {kktpKelas})
                    </p>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-4 mb-6 border ${tuntasKlasikalAfterRemidi
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center gap-3">
                  {tuntasKlasikalAfterRemidi
                    ? <TrendingUp className="text-emerald-600 dark:text-emerald-400 shrink-0" size={28} />
                    : <TrendingDown className="text-amber-600 dark:text-amber-400 shrink-0" size={28} />}
                  <div>
                    <p className={`text-lg font-black ${tuntasKlasikalAfterRemidi ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {tuntasKlasikalAfterRemidi ? 'TUNTAS KLASIKAL (SETELAH REMIDI)' : 'BELUM TUNTAS KLASIKAL (SETELAH REMIDI)'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {persenKetuntasanAfterRemidi}% siswa tuntas setelah remidi dari target klasikal {targetKlasikal}% (KKTP {kktpKelas})
                    </p>
                  </div>
                </div>
              </div>

              {butirLemahKelas.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Butir yang belum dikuasai kelas (daya serap &lt; KKTP {analisisResult?.kelas?.kktpKelas ?? 70}%):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {butirLemahKelas.map(b => (
                      <span key={b.no} className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg px-3 py-1.5">
                        No.{b.no} — {b.dayaSerap}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Semua butir dikuasai kelas (daya serap ≥ KKTP).</p>
              )}

              {rekomendasiLok.some(r => r.tindakan === 'Remedial') && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Siswa yang Perlu Remedial ({rekomendasiLok.filter(r => r.tindakan === 'Remedial').length} siswa):
                  </p>
                  <div className="overflow-x-auto border rounded-xl dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nama Siswa</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Skor Akhir</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Skor Setelah Remidi</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Butir Gagal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {rekomendasiLok.filter(r => r.tindakan === 'Remedial').map((r, i) => {
                          const vRemidi = remidiScores[String(r.student_id)];
                          const adaRemidi = vRemidi !== undefined && vRemidi !== null && vRemidi !== '';
                          return (
                          <tr key={i}>
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{r.student_name}</td>
                            <td className="px-3 py-2 text-center text-red-600 dark:text-red-400 font-semibold">{Number(r.skorAkhir || 0)}</td>
                            <td className={`px-3 py-2 text-center font-semibold ${adaRemidi
                              ? (Number(vRemidi) >= kktpKelas ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')
                              : 'text-gray-400'}`}>
                              {adaRemidi ? Number(vRemidi) : '-'}
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                              {(r.butirGagal || []).map(b => `No.${b.no ?? b}`).join(', ') || '-'}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 py-6" ref={(el) => { if (el) el.scrollTop = 0; }}>
          <div className="min-h-full flex items-start justify-center px-4 pt-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-gray-700">
              <h2 className="text-xl font-bold">{editTarget ? 'Edit Nilai Ulangan Harian' : 'Buat Analisis Ulangan Harian Baru'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditTarget(null); setEditScoresSource(null); setEditRemidiSource(null); setEditItemMetaSource(null); }} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewAssessment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <StyledSelect
                    label="Kelas"
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    required
                  >
                    <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">-- Pilih Kelas --</option>
                    {userClasses.map(c => (
                      <option key={c.id} value={c.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{c.rombel || c.name || c.class_name}</option>
                    ))}
                  </StyledSelect>
                </div>

                <div>
                  <StyledSelect
                    label="Mata Pelajaran"
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    required
                  >
                    <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">-- Pilih Mata Pelajaran --</option>
                    {userSubjects.map(s => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">{s.name}</option>
                    ))}
                  </StyledSelect>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Topik / Materi (CP / RPP)</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="Contoh: Bilangan Bulat / Persamaan Kuadrat"
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tanggal Ulangan</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">KKTP / KKM (0-100)</label>
                  <input
                    type="number"
                    value={formKktp}
                    onChange={(e) => setFormKktp(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    min="0"
                    max="100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Target Ketuntasan Klasikal (%)</label>
                  <input
                    type="number"
                    value={formTargetKlasikal}
                    onChange={(e) => setFormTargetKlasikal(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Jumlah Butir Soal</label>
                  <input
                    type="number"
                    value={formNumItems}
                    onChange={(e) => setFormNumItems(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    min="1"
                    max="20"
                    required
                  />
                </div>
              </div>

              {/* Item Configuration Table */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-bold">Konfigurasi Skor Maksimal / Bobot Soal</h3>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-700 px-3 py-1 rounded-full">
                    Total Bobot / Skor Maks: {formItems.reduce((sum, item) => sum + (Number(item.skor_maks) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-700">
                  {formItems.map((item, idx) => (
                    <div key={item.no} className="flex flex-col gap-1.5 bg-white dark:bg-gray-800 p-2 rounded-lg border dark:border-gray-600">
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Soal {item.no}</span>
                        <select
                          value={item.tipe}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...formItems];
                            updated[idx].tipe = val;
                            setFormItems(updated);
                          }}
                          className="text-[10px] p-0.5 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:border-gray-600 font-semibold"
                        >
                          <option value="PG" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">PG</option>
                          <option value="Esai" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Esai</option>
                        </select>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={item.skor_maks}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          const updated = [...formItems];
                          updated[idx].skor_maks = val;
                          updated[idx].bobot = 1;
                          setFormItems(updated);
                        }}
                        className="w-full p-1 text-center border rounded dark:bg-gray-700 dark:border-gray-600 text-sm font-semibold"
                        title="Skor Maksimal / Bobot"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Matrix */}
              <div className="mt-6">
                <h3 className="text-md font-bold mb-2">Input Skor Siswa Per Butir Soal</h3>
                {loadingStudents ? (
                  <div className="flex items-center justify-center p-6"><Loader className="animate-spin" /></div>
                ) : formStudents.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">Pilih kelas terlebih dahulu untuk memuat daftar siswa.</p>
                ) : (
                  <div className="overflow-x-auto max-h-96 border rounded-lg dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Nama Siswa</th>
                          {formItems.map((item, idx) => (
                            <th key={idx} className="px-2 py-2 text-center min-w-[70px]">
                              <div>Soal {item.no}</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Maks: {item.skor_maks}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {formStudents.map(student => (
                          <tr key={student.id}>
                            <td className="px-3 py-2 font-medium whitespace-nowrap">{student.name}</td>
                            {formItems.map((item, idx) => {
                              const qNo = item.no;
                              return (
                                <td key={qNo} className="px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.skor_maks}
                                    step="0.5"
                                    value={formScores[student.id]?.[qNo] ?? 0}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      const maxVal = Number(item.skor_maks) || 1;
                                      setFormScores(prev => ({
                                        ...prev,
                                        [student.id]: {
                                          ...(prev[student.id] || {}),
                                          [qNo]: Math.min(val, maxVal)
                                        }
                                      }));
                                    }}
                                    className="w-16 p-1 text-center border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Nilai Setelah Perbaikan (Remidi) — opsional */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-md font-bold">Nilai Setelah Perbaikan (Remidi)</h3>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Wajib diisi hanya untuk siswa yang belum tuntas</span>
                </div>
                {loadingStudents ? (
                  <div className="flex items-center justify-center p-6"><Loader className="animate-spin" /></div>
                ) : formStudents.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">Pilih kelas terlebih dahulu untuk memuat daftar siswa.</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 border rounded-lg dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Nama Siswa</th>
                          <th className="px-3 py-2 text-center">Nilai Akhir</th>
                          <th className="px-3 py-2 text-center min-w-[110px]">Nilai Setelah Perbaikan</th>
                          <th className="px-3 py-2 text-left">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {formStudents.map(student => {
                          const skorAkhirSt = (() => {
                            const s = formScores[student.id] || {};
                            let num = 0, den = 0;
                            formItems.forEach(it => {
                              num += (Number(s[it.no]) || 0) * (Number(it.bobot) || 1);
                              den += (Number(it.skor_maks) || 0) * (Number(it.bobot) || 1);
                            });
                            return den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
                          })();
                          const tuntas = formKktp > 0 ? skorAkhirSt >= formKktp : true;
                          return (
                            <tr key={student.id}>
                              <td className="px-3 py-2 font-medium whitespace-nowrap">{student.name}</td>
                              <td className="px-3 py-2 text-center font-semibold">{skorAkhirSt}</td>
                              <td className="px-2 py-1 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.5"
                                  value={formRemidi[student.id] ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                    setFormRemidi(prev => ({ ...prev, [student.id]: val }));
                                  }}
                                  className="w-24 p-1 text-center border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                  placeholder={tuntas ? 'Tuntas' : 'Isi'}
                                />
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {tuntas
                                  ? <span className="text-green-600 dark:text-green-400 font-medium">Tuntas</span>
                                  : <span className="text-red-500 dark:text-red-400 font-medium">Perlu Perbaikan</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nilai remidi tersimpan & tampil di laporan Word/PDF pada bagian "Daftar Nilai Setelah Perbaikan (Remedial)".</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditTarget(null); setEditScoresSource(null); setEditRemidiSource(null); setEditItemMetaSource(null); }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingNew || formStudents.length === 0}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm font-semibold shadow"
                >
                  {savingNew ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                  {savingNew ? 'Menyimpan...' : (editTarget ? 'Perbarui Nilai' : 'Simpan & Analisis')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {loading && (
        <div className="flex flex-col items-center mt-10 text-blue-500">
          <Loader className="w-10 h-10 animate-spin" />
          <p className="mt-2 font-medium">Menganalisis data...</p>
        </div>
      )}
    </div>
  );
};

export default AnalisisUlanganHarianPage;
