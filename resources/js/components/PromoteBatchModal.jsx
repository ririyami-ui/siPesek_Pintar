import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import StyledButton from './StyledButton';
import StyledSelect from './StyledSelect';
import { AlertTriangle, Users, ArrowRight, RefreshCw } from 'lucide-react';
import api from '../lib/axios';
import toast from 'react-hot-toast';

/**
 * PromoteBatchModal
 * Props:
 *   isOpen, onClose, classes, students, onSuccess
 *   // classes = all class objects {id, rombel}
 */
export default function PromoteBatchModal({ isOpen, onClose, classes, students, onSuccess }) {
  const [sourceClassIds, setSourceClassIds] = useState([]);
  const [targetClassIds, setTargetClassIds] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(true);

  // Build source student list based on selected source classes
  const sourceStudents = students.filter(s => sourceClassIds.includes(s.class_id));

  const toggleSourceClass = (id) => {
    setSourceClassIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleTargetClass = (id) => {
    setTargetClassIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handlePreview = async () => {
    if (sourceClassIds.length === 0) return toast.error('Pilih minimal satu kelas sumber.');
    if (targetClassIds.length === 0) return toast.error('Pilih minimal satu kelas tujuan.');
    try {
      const resp = await api.post('/admin/students/promote-distribution', {
        source_class_ids: sourceClassIds,
        target_class_ids: targetClassIds,
        preview: true,
      });
      setDistribution(resp.data);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Gagal preview distribusi.');
    }
  };

  const handleExecute = async () => {
    if (!distribution) return toast.error('Tidak ada distribusi untuk dijalankan.');
    setIsSubmitting(true);
    try {
      const resp = await api.post('/admin/students/promote-distribution', {
        source_class_ids: sourceClassIds,
        target_class_ids: targetClassIds,
        preview: false,
      });
      toast.success(resp.data.message);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Gagal eksekusi distribusi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title="Naik Kelas – Distribusi Merata" onClose={onClose} size="lg">
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-bold mb-1">Perhatian!</p>
            <p>Pilih satu atau lebih kelas asal, kemudian pilih satu atau lebih kelas tujuan. Sistem akan menyeimbangkan jumlah siswa, rasio gender, dan rata‑rata umur.</p>
          </div>
        </div>

        {/* Source classes */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas Sumber</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded">
            {classes.map(c => (
              <label key={c.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sourceClassIds.includes(c.id)}
                  onChange={() => toggleSourceClass(c.id)}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-sm">{c.rombel}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="text-gray-400" size={28} />
        </div>

        {/* Target classes */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Kelas Tujuan</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded">
            {classes.map(c => (
              <label key={c.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={targetClassIds.includes(c.id)}
                  onChange={() => toggleTargetClass(c.id)}
                  className="w-4 h-4 text-primary rounded"
                />
                <span className="text-sm">{c.rombel}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Preview button */}
        <div className="flex justify-between items-center mt-4">
          <StyledButton variant="outline" onClick={handlePreview} disabled={sourceClassIds.length===0||targetClassIds.length===0}>
            Preview Distribusi
          </StyledButton>
          {distribution && (
            <StyledButton variant="secondary" onClick={() => setDistribution(null)}>
              Reset Preview
            </StyledButton>
          )}
        </div>

        {/* Distribution preview */}
        {distribution && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-3 font-bold text-sm">Hasil Distribusi</div>
            <div className="p-3">
              {/* Summary table */}
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-800/30">
                  <tr>
                    <th className="p-2">Kelas Tujuan</th>
                    <th className="p-2">Jumlah Siswa</th>
                    <th className="p-2">Pria</th>
                    <th className="p-2">Wanita</th>
                    <th className="p-2">Rata‑Umur (th)</th>
                    <th className="p-2">Rasio Pria</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.distribution.map(d => (
                    <tr key={d.class_id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-2 font-medium">{classes.find(c=>c.id===d.class_id)?.rombel||d.class_id}</td>
                      <td className="p-2">{d.count}</td>
                      <td className="p-2">{d.male_count}</td>
                      <td className="p-2">{d.female_count}</td>
                      <td className="p-2">{d.average_age}</td>
                      <td className="p-2">{(d.gender_ratio*100).toFixed(1)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Fairness warnings */}
              {distribution.fairness && !distribution.fairness.valid && (
                <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded">
                  <p className="font-bold mb-1">Peringatan Distribusi</p>
                  <ul className="list-disc list-inside space-y-1">
                    {distribution.fairness.warnings.map((w,i)=> <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <StyledButton variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</StyledButton>
          <StyledButton
            onClick={handleExecute}
            disabled={isSubmitting || !distribution}
            className="!bg-primary hover:!bg-primary/80"
          >
            {isSubmitting ? 'Memproses...' : 'Eksekusi Naik Kelas'}
          </StyledButton>
        </div>
      </div>
    </Modal>
  );
}
