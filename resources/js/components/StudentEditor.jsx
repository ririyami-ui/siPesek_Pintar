import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import StyledInput from './StyledInput';
import StyledButton from './StyledButton';
import StyledSelect from './StyledSelect';
import toast from 'react-hot-toast';

const normalizeGender = (input) => {
  if (!input) return '';
  const clean = String(input).trim().toUpperCase();
  if (clean === 'L' || clean === 'LAKI-LAKI' || clean === 'LAKI' || clean === 'PRIA' || clean === 'LAKI - LAKI') return 'L';
  if (clean === 'P' || clean === 'PEREMPUAN' || clean === 'WANITA') return 'P';
  return input === 'Laki-laki' ? 'L' : (input === 'Perempuan' ? 'P' : input);
};

export default function StudentEditor({ studentData, onSave, onClose, rombels, classes }) {
  const [code, setCode] = useState('');
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [classId, setClassId] = useState('');
  const [absen, setAbsen] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (studentData) {
      setCode(studentData.code || '');
      setNis(studentData.nis || '');
      setNisn(studentData.nisn || '');
      setName(studentData.name || '');
      setGender(normalizeGender(studentData.gender) || '');
      setBirthPlace(studentData.birthPlace || studentData.birth_place || '');

      if (studentData.birthDate || studentData.birth_date) {
        let date = new Date(studentData.birthDate || studentData.birth_date);
        if (isNaN(date.getTime())) {
          const parts = (studentData.birthDate || studentData.birth_date).split(' ');
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const monthNames = {
              'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
              'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
            };
            const month = monthNames[parts[1]];
            const year = parseInt(parts[2]);
            date = new Date(year, month, day);
          }
        }

        if (!isNaN(date.getTime())) {
          const formattedDate = date.toISOString().split('T')[0];
          setBirthDate(formattedDate);
        } else {
          setBirthDate('');
        }
      } else {
        setBirthDate('');
      }

      setClassId(studentData.classId || studentData.class_id || '');
      setAbsen(studentData.absen || '');
      setAddress(studentData.address || '');
    }
  }, [studentData]);

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      code,
      nis,
      nisn,
      name,
      gender,
      birth_place: birthPlace,
      birth_date: birthDate,
      class_id: classId,
      absen: absen,
      address,
    };

    try {
      await api.put(`/students/${studentData.id}`, payload);
      toast.success('Siswa berhasil diperbarui!');
      onSave();
    } catch (error) {
      console.error("Error updating student: ", error);
      toast.error('Gagal memperbarui siswa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleUpdateStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StyledInput
        type="text"
        placeholder="Kode Siswa"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <StyledInput
        type="number"
        placeholder="No. Absen"
        value={absen}
        onChange={(e) => setAbsen(e.target.value)}
        required
      />
      <StyledInput
        type="text"
        placeholder="NIS"
        value={nis}
        onChange={(e) => setNis(e.target.value)}
        required
      />
      <StyledInput
        type="text"
        placeholder="NISN"
        value={nisn}
        onChange={(e) => setNisn(e.target.value)}
        required
      />
      <div className="md:col-span-2">
        <StyledInput
          type="text"
          placeholder="Nama Siswa"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <StyledSelect value={gender} onChange={(e) => setGender(e.target.value)} required>
        <option value="">Pilih Jenis Kelamin</option>
        <option value="Laki-laki">Laki-laki</option>
        <option value="Perempuan">Perempuan</option>
      </StyledSelect>
      <StyledInput
        type="text"
        placeholder="Tempat Lahir"
        value={birthPlace}
        onChange={(e) => setBirthPlace(e.target.value)}
        required
      />
      <StyledInput
        type="date"
        placeholder="Tanggal Lahir"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        required
      />
      <StyledSelect value={classId} onChange={(e) => setClassId(e.target.value)} required>
        <option value="">Pilih Rombel (Kelas)</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.rombel}</option>
        ))}
      </StyledSelect>
      <div className="md:col-span-2">
        <StyledInput
          type="text"
          placeholder="Alamat Lengkap"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="md:col-span-2 flex justify-end space-x-2">
        <StyledButton type="button" variant="outline" onClick={onClose}>Batal</StyledButton>
        <StyledButton type="submit" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </StyledButton>
      </div>
    </form>
  );
}
