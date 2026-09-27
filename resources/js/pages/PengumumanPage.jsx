import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, RefreshCw, Trash2, Pencil, Pin, PinOff } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import StyledButton from '../components/StyledButton';
import StyledInput from '../components/StyledInput';
import StyledSelect from '../components/StyledSelect';
import Modal from '../components/Modal';
import moment from 'moment';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Semua (Siswa + Orang Tua + Guru)' },
  { value: 'student', label: 'Hanya Siswa' },
  { value: 'parent', label: 'Hanya Orang Tua' },
  { value: 'teacher', label: 'Hanya Guru' },
  { value: 'staff', label: 'Hanya Staf' },
  { value: 'admin', label: 'Hanya Admin' },
];

const AUDIENCE_COLOR = {
  all: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  teacher: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  student: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  parent: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  staff: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
};

const emptyForm = { title: '', content: '', audience: 'all', is_pinned: false };

export default function PengumumanPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data?.data ?? []);
    } catch (err) {
      toast.error('Gagal memuat pengumuman.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, audience: a.audience, is_pinned: !!a.is_pinned });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Judul dan isi pengumuman wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        audience: form.audience,
        is_pinned: form.is_pinned,
      };
      if (editing) {
        await api.put(`/announcements/${editing.id}`, payload);
        toast.success('Pengumuman berhasil diperbarui.');
      } else {
        await api.post('/announcements', payload);
        toast.success('Pengumuman berhasil dipublikasikan.');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error('Gagal menyimpan pengumuman.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Hapus pengumuman "${a.title}"?`)) return;
    try {
      await api.delete(`/announcements/${a.id}`);
      toast.success('Pengumuman dihapus.');
      fetchData();
    } catch (err) {
      toast.error('Gagal menghapus pengumuman.');
    }
  };

  const handleTogglePin = async (a) => {
    try {
      await api.put(`/announcements/${a.id}`, { is_pinned: !a.is_pinned });
      toast.success(a.is_pinned ? 'Tidak lagi disematkan.' : 'Disematkan sebagai penting.');
      fetchData();
    } catch (err) {
      toast.error('Gagal mengubah status sematan.');
    }
  };

  const countByAudience = (role) => announcements.filter(a => a.audience === role).length;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Megaphone className="text-primary" />
            Pengumuman Sekolah
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Kelola informasi yang ditampilkan di dashboard siswa & walimurid.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <StyledButton onClick={openCreate} variant="primary" size="sm">
            <Plus size={16} />
            Buat Pengumuman
          </StyledButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{announcements.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Disematkan</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {announcements.filter(a => a.is_pinned).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Untuk Siswa</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{countByAudience('student')}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Untuk Orang Tua</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{countByAudience('parent')}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Memuat data...</div>
        ) : announcements.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            Belum ada pengumuman. Klik "Buat Pengumuman" untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {announcements.map(a => (
              <div key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {a.is_pinned && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                        <Pin size={9} /> Penting
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${AUDIENCE_COLOR[a.audience] || AUDIENCE_COLOR.all}`}>
                      {AUDIENCE_OPTIONS.find(o => o.value === a.audience)?.label.split(' ')[0] || a.audience}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">
                      {moment(a.published_at || a.created_at).format('D MMM YYYY, HH:mm')}
                    </span>
                  </div>
                  <p className="font-bold text-gray-800 dark:text-white truncate">{a.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{a.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTogglePin(a)}
                    className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    title={a.is_pinned ? 'Lepas sematan' : 'Sematkan sebagai penting'}
                  >
                    {a.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Hapus"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} size="xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone size={20} className="text-primary" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                {editing ? 'Edit Pengumuman' : 'Buat Pengumuman'}
              </h3>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <StyledInput
                label="Judul"
                placeholder="Contoh: Libur Maulid Nabi"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                maxLength={255}
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1 mb-1.5">
                  Isi Pengumuman
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  placeholder="Tulis detail pengumuman..."
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white placeholder-gray-400 resize-y"
                />
              </div>

              <StyledSelect
                label="Audience"
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}
              >
                {AUDIENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StyledSelect>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_pinned}
                  onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Sematkan sebagai penting (tampil paling atas)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <StyledButton type="button" variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  Batal
                </StyledButton>
                <StyledButton type="submit" variant="primary" size="sm" loading={saving}>
                  {editing ? 'Simpan Perubahan' : 'Publikasikan'}
                </StyledButton>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}