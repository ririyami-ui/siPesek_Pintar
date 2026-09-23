/**
 * analisisButir.js — Analisis butir ulangan harian (Teori Tes Klasik / CTT).
 *
 * Grounding riset (semua lokal, tanpa AI; AI hanya menyusun narasi):
 * - Kesukaran P = rerata skor butir / skor_maks butir (Arikunto 2012 tabel:
 *   0.00-0.30 sukar, 0.31-0.70 sedang, 0.71-1.00 mudah).
 * - Daya pembeda D: kelompok atas-bawah 27%; kriteria: D>=0.40 "Baik Sekali",
 *   D 0.30-0.39 "Baik", D 0.20-0.29 "Cukup", D 0.00-0.19 "Kurang Baik", D<0
 *   "Jelek".
 * - Validitas butir: point-biserial utk PG dikotomi; Pearson butir-total
 *   terkoreksi utk esai/PG berbobot. Dibanding dgn r-tabel (df=n-2, α=5%).
 * - Reliabilitas: Alpha Cronbach (normalisasi butir ÷ skor_maks utk campuran
 *   PG+Esai). Kategori: <0.50 rendah, 0.50-0.70 sedang, 0.70-0.90 tinggi,
 *   0.90-1.00 sangat tinggi.
 * - Skor akhir 0-100 berbobot per siswa: Σ(skor×bobot) / Σ(skor_maks×bobot) ×
 *   100 — identik dgn rumus syncToGrades di UlanganHarianController agar
 *   nilai analisis konsisten dgn nilai yg masuk tabel grades.
 * - Ketuntasan thd KKTP utk rekomendasi remedial/pengayaan.
 */

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Statistik deskriptif data tunggal (skor akhir 0-100).
 * @param {number[]} vals
 * @returns {{n,min,max,rerata,median,modus,modusList,standarDeviasi,varian,range}}
 */
export function statistikDeskriptif(vals) {
  const data = (vals || []).map(Number).filter(v => Number.isFinite(v));
  if (!data.length) {
    return {
      n: 0, min: 0, max: 0, rerata: 0, median: 0, modus: 0, modusList: [],
      standarDeviasi: 0, varian: 0, range: 0,
    };
  }
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const rerata = Number((data.reduce((a, b) => a + b, 0) / n).toFixed(2));

  // Median
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1
    ? sorted[mid]
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  // Modus (nilai paling sering muncul; "tidak ada modus" => 0)
  const freq = {};
  data.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
  const maxF = Math.max(0, ...Object.values(freq));
  const modusList = maxF > 1 ? Object.keys(freq).filter(k => freq[k] === maxF).map(Number).sort((a, b) => a - b) : [];
  const modus = modusList.length ? modusList[0] : 0;

  // Standar deviasi populasi & varian
  const varian = Number((data.reduce((s, v) => s + (v - rerata) ** 2, 0) / n).toFixed(2));
  const standarDeviasi = Number(Math.sqrt(varian).toFixed(2));
  const range = Number((max - min).toFixed(2));

  return { n, min, max, rerata, median, modus, modusList, standarDeviasi, varian, range };
}

function stdDev(arr) {
  const m = mean(arr);
  if (arr.length === 0) return 0;
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function pearson(xs, ys) {
  if (!xs || !ys || xs.length === 0 || xs.length !== ys.length) return 0;
  const n = xs.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxy += xs[i] * ys[i];
    sx2 += xs[i] ** 2; sy2 += ys[i] ** 2;
  }
  const denom = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Nilai kritis r (tabel distribusi r product-moment) pada taraf signifikansi
 * 5% (dua arah) untuk df = 1..40 — nilai baku yang dipakai uji validitas butir.
 * Untuk df > 40 memakai pendekatan normal 1.96/√df (mendekati tabel asli).
 * @param {number} df derajat kebebasan (n-2)
 * @returns {number}
 */
export function rtabel05(df) {
  const table = {
    1: 0.997, 2: 0.950, 3: 0.878, 4: 0.811, 5: 0.754,
    6: 0.707, 7: 0.666, 8: 0.632, 9: 0.602, 10: 0.576,
    11: 0.553, 12: 0.532, 13: 0.514, 14: 0.497, 15: 0.482,
    16: 0.468, 17: 0.456, 18: 0.444, 19: 0.433, 20: 0.423,
    21: 0.413, 22: 0.404, 23: 0.396, 24: 0.388, 25: 0.381,
    26: 0.374, 27: 0.367, 28: 0.361, 29: 0.355, 30: 0.349,
    31: 0.344, 32: 0.339, 33: 0.334, 34: 0.329, 35: 0.325,
    36: 0.320, 37: 0.316, 38: 0.312, 39: 0.308, 40: 0.304,
  };
  const d = Math.max(1, Math.round(Number(df) || 1));
  if (table[d]) return table[d];
  return Number((1.96 / Math.sqrt(d)).toFixed(3));
}

function pointBiserial(itemBinary, totalScores) {
  const mp = [], mq = [];
  itemBinary.forEach((b, i) => (b === 1 ? mp : mq).push(totalScores[i]));
  if (mp.length === 0 || mq.length === 0) return 0;
  const s = stdDev(totalScores);
  if (s === 0) return 0;
  return ((mean(mp) - mean(mq)) / s) *
    Math.sqrt((mp.length * mq.length) / (itemBinary.length ** 2));
}

/**
 * Kesukaran butir. Return { p, kategori }.
 * @param {number[]} itemScores skor per siswa utk butir ini
 * @param {number} skorMaks
 */
export function kesukaran(itemScores, skorMaks) {
  if (!skorMaks || skorMaks <= 0) return { p: 0, kategori: 'Tidak Sah' };
  const p = mean(itemScores || []) / skorMaks;
  let kategori;
  if (p <= 0.30) kategori = 'Sukar';
  else if (p <= 0.70) kategori = 'Sedang';
  else kategori = 'Mudah';
  return { p: Number(p.toFixed(2)), kategori };
}

/**
 * Daya pembeda (kelompok atas-bawah 27%). Return { d, kategori }.
 * @param {number[]} itemScores
 * @param {number[]} totalScores skor akhir per siswa
 * @param {number} skorMaks
 */
export function dayaPembeda(itemScores, totalScores, skorMaks) {
  if (!skorMaks || skorMaks <= 0 || itemScores.length < 4) {
    return { d: 0, kategori: 'Tidak Sah' };
  }
  const k = Math.max(1, Math.round(itemScores.length * 0.27));
  const idx = itemScores.map((_, i) => i).sort((a, b) => totalScores[b] - totalScores[a]);
  const atas = idx.slice(0, k).map(i => itemScores[i]);
  const bawah = idx.slice(-k).map(i => itemScores[i]);
  const d = (mean(atas) - mean(bawah)) / skorMaks;
  let kategori;
  if (d >= 0.40) kategori = 'Baik Sekali';
  else if (d >= 0.30) kategori = 'Baik';
  else if (d >= 0.20) kategori = 'Cukup';
  else if (d >= 0.00) kategori = 'Kurang Baik';
  else kategori = 'Jelek';
  return { d: Number(d.toFixed(2)), kategori };
}

/**
 * Validitas butir: point-biserial (PG) / Pearson butir-total terkoreksi (esai
 * & PG berbobot). Kategori Valid bila |r| >= r-tabel (df = n-2, α = 5%).
 * Return { r, kategori, rtabel }.
 */
export function validitas(itemScores, totalScores, tipe, skorMaks) {
  let r;
  let binary;
  if ((tipe || '').toUpperCase() === 'PG' && Number(skorMaks || 0) <= 1) {
    binary = itemScores.map(s => (Number(s) > 0 ? 1 : 0));
    r = pointBiserial(binary, totalScores);
  } else {
    const n = itemScores.length;
    // Butir-total terkoreksi: korelasi butir dgn skor total TANPA butir itu sendiri.
    const totalScoresMinusItem = totalScores.map((t, i) => t - itemScores[i]);
    r = pearson(itemScores, totalScoresMinusItem);
  }
  const n = itemScores.length;
  const df = Math.max(1, n - 2);
  const rtabel = rtabel05(df);
  const kategori = Math.abs(r) >= rtabel ? 'Valid' : 'Tidak Valid';
  return { r: Number(Math.abs(r).toFixed(2)), kategori, rtabel };
}

/**
 * Reliabilitas Alpha Cronbach (butir dinormalisasi ÷ skor_maks utk PG+Esai
 * campur). Kategori: <0.50 rendah, 0.50-0.70 sedang, 0.70-0.90 tinggi,
 * 0.90-1.00 sangat tinggi. Return { alpha, kategori, nItems }.
 * @param {Array<{skor_maks:number, skor:number[]}>} items
 */
export function reliabilitas(items) {
  const valid = (items || []).filter(it => Array.isArray(it.skor) && it.skor.length > 0);
  const k = valid.length;
  if (k < 2) return { alpha: 0, kategori: 'Tidak Dapat Dihitung', nItems: k };
  const n = valid[0].skor.length;
  const norm = valid.map(it => {
    const m = Number(it.skor_maks || 0);
    return m > 0 ? it.skor.map(s => Number(s) / m) : it.skor.map(Number);
  });
  const totals = Array.from({ length: n }, (_, i) =>
    norm.reduce((s, row) => s + row[i], 0));
  const varTotal = stdDev(totals) ** 2;
  const sumVarItem = norm.reduce((s, row) => s + stdDev(row) ** 2, 0);
  if (varTotal === 0) return { alpha: 0, kategori: 'Tidak Dapat Dihitung', nItems: k };
  const alpha = (k / (k - 1)) * (1 - sumVarItem / varTotal);
  let kategori;
  if (alpha < 0.50) kategori = 'Rendah';
  else if (alpha < 0.70) kategori = 'Sedang';
  else if (alpha < 0.90) kategori = 'Tinggi';
  else kategori = 'Sangat Tinggi';
  return { alpha: Number(alpha.toFixed(2)), kategori, nItems: k };
}

/**
 * Skor akhir 0-100 berbobot per siswa (identik rumus syncToGrades backend):
 * Σ(skor×bobot) / Σ(skor_maks×bobot) × 100.
 * Return { [studentId]: number }.
 */
export function skorAkhirBerbobot(scores, itemMeta) {
  const items = itemMeta || [];
  const denom = items.reduce((s, it) =>
    s + (Number(it.bobot ?? 1) * Number(it.skor_maks ?? 1)), 0);
  const out = {};
  Object.keys(scores || {}).forEach(sid => {
    const num = items.reduce((s, it) =>
      s + (Number(scores[sid]?.[it.no] || 0) * Number(it.bobot ?? 1)), 0);
    out[sid] = denom > 0 ? Number(((num / denom) * 100).toFixed(2)) : 0;
  });
  return out;
}

/** Distribusi frekuensi skor akhir utk histogram. Return [{ interval, count }]. */
export function distribusiSkor(skorList, bins = 8) {
  if (!Array.isArray(skorList) || skorList.length === 0) return [];
  const min = Math.min(...skorList);
  const max = Math.max(...skorList);
  const width = Math.max(1, Math.ceil((max - min + 1) / bins));
  const out = [];
  for (let lo = min; lo <= max; lo += width) {
    const hi = Math.min(lo + width - 1, max);
    out.push({ interval: `${lo}-${hi}`, count: skorList.filter(s => s >= lo && s <= hi).length });
  }
  return out;
}

/**
 * Analisis lengkap satu ulangan harian: statistik butir & per siswa.
 * @param {Object} data { item_meta: [{no,tipe,elemen,materi,skor_maks,bobot}], scores: {sid:{no:skor}} }
 * @returns {Object} { items, perSiswa, kelas, distribusi, skorAkhir, item_meta, scores }
 */
export function analisisUlanganHarian(data) {
  const items = (data && data.item_meta) || [];
  const scores = (data && data.scores) || {};
  const studentIds = Object.keys(scores);

  const skorAkhir = skorAkhirBerbobot(scores, items);

  const itemResults = items.map(it => {
    const skor = studentIds.map(sid => Number(scores[sid]?.[it.no] || 0));
    const totalArr = studentIds.map(sid => Number(skorAkhir[sid] || 0));
    const nBenar = skor.filter(s => s > 0).length;
    const k = kesukaran(skor, it.skor_maks);
    return {
      no: it.no, tipe: it.tipe, elemen: it.elemen, materi: it.materi,
      skor_maks: it.skor_maks, bobot: it.bobot,
      kesukaran: k,
      dayaPembeda: dayaPembeda(skor, totalArr, it.skor_maks),
      validitas: validitas(skor, totalArr, it.tipe, it.skor_maks),
      nBenar,
      // Daya serap butir = (rata2 skor ÷ skor maks) × 100% = kesukaran.p × 100,
      // menggambarkan % penguasaan materi per butir (bukan % siswa skor>0).
      dayaSerap: Number((k.p * 100).toFixed(2)),
      rerata: Number(mean(skor).toFixed(2)),
    };
  });

  const alpha = reliabilitas(items.map(it => ({
    skor_maks: it.skor_maks,
    skor: studentIds.map(sid => Number(scores[sid]?.[it.no] || 0)),
  })));

  // Butir GAGAL per siswa: penguasaan butir di bawah 60% skor_maks
  // (penguasaan = skor butir ÷ skor_maks × 100). Skor 0 otomatis termasuk.
  const BATAS_GAGAL = 0.60;
  const perSiswa = studentIds.map(sid => {
    const butirGagal = items.filter(it => {
      const max = Number(it.skor_maks) || 0;
      if (max <= 0) return false;
      return (Number(scores[sid]?.[it.no] || 0) / max) < BATAS_GAGAL;
    }).map(it => it.no);
    return {
      student_id: sid,
      skorTotal: Number(items.reduce((s, it) => s + Number(scores[sid]?.[it.no] || 0), 0).toFixed(2)),
      skorAkhir: skorAkhir[sid],
      butirGagal,
      nButirGagal: butirGagal.length,
      persenGagal: items.length ? Math.round((butirGagal.length / items.length) * 100) : 0,
    };
  });

  const skorAkhirNilai = Object.values(skorAkhir).map(Number);
  const statistik = statistikDeskriptif(skorAkhirNilai);
  // Daya serap keseluruhan = rata2 skor akhir seluruh peserta (skala 0-100).
  const dayaSerapKelas = studentIds.length
    ? Number(mean(skorAkhirNilai).toFixed(2))
    : 0;

  // Soal yang TIDAK dikuasai KELAS: daya serap butir di bawah KKTP (default 70).
  // Dipakai sebagai dasar remidi klasikal / penjelasan ulang materi.
  const kktpKelas = Number(data && data.kktp_score) || 70;
  const butirLemah = itemResults
    .filter(it => Number(it.dayaSerap) < kktpKelas)
    .map(it => ({ no: it.no, elemen: it.elemen, materi: it.materi, dayaSerap: it.dayaSerap }))
    .sort((a, b) => a.dayaSerap - b.dayaSerap);

  return {
    items: itemResults,
    perSiswa,
    kelas: {
      nSiswa: studentIds.length,
      nButir: items.length,
      rerataAkhir: Number(mean(skorAkhirNilai).toFixed(2)),
      alphaReliabilitas: alpha,
      dayaSerap: dayaSerapKelas, // % penguasaan keseluruhan = rata2 skor akhir
      statistik, // { n,min,max,rerata,median,modus,modusList,standarDeviasi,varian,range }
      butirLemah, // [{ no, elemen, materi, dayaSerap }] = soal yg tidak dikuasai kelas
      nButirLemah: butirLemah.length,
      kktpKelas, // ambang yang dipakai utk butirLemah
    },
    distribusi: distribusiSkor(skorAkhirNilai),
    item_meta: items,
    scores,
    skorAkhir,
  };
}

/**
 * Rekomendasi remedial/pengayaan per siswa (ketuntasan KKTP).
 * @param {Object} hasil hasil dari analisisUlanganHarian
 * @param {Object} rombelData { kktp: number }
 * @returns {Array} [{ ...perSiswa, status, tindakan, butirGagal:[{no,elemen,materi}] }]
 */
export function rekomendasiKetuntasan(hasil, rombelData) {
  // Default KKTP 70 (konsisten dgn ulanganHarianDocx.js) agar data lama tanpa
  // kktp_score tersimpan (null) tdk membuat semua siswa dianggap Tuntas.
  const kktp = Number(rombelData && rombelData.kktp) || 70;
  const items = (hasil && hasil.items) || [];
  return ((hasil && hasil.perSiswa) || []).map(s => {
    const tuntas = Number(s.skorAkhir) >= kktp;
    const butirGagal = (s.butirGagal || []).map(no => {
      const it = items.find(x => x.no === no);
      return it ? { no, elemen: it.elemen, materi: it.materi } : { no };
    });
    return {
      ...s,
      status: tuntas ? 'Tuntas' : 'Belum Tuntas',
      tindakan: tuntas ? 'Pengayaan' : 'Remedial',
      butirGagal,
    };
  });
}

/**
 * Rekomendasi murni/lokal per siswa (PENGGANTI rekomendasi AI/Gemini).
 * Narasi disusun deterministik dari statistik & butir gagal — tanpa halusinasi.
 * Output { student_id, student_name, rekomendasi } agar kompatibel dgn
 * argumen `rekomendasiAI` pada eksport PDF/Word.
 * @param {Array} rekomendasi hasil rekomendasiKetuntasan (dgn student_name)
 * @returns {Array} [{ student_id, student_name, rekomendasi }]
 */
export function rekomendasiLokal(rekomendasi) {
  return (rekomendasi || []).map(s => {
    if (s.tindakan === 'Remedial') {
      const detail = (s.butirGagal || [])
        .map(bg => {
          if (bg.elemen && bg.materi && bg.materi !== bg.elemen) return `${bg.elemen} (${bg.materi})`;
          return bg.materi || bg.elemen || `butir nomor ${bg.no}`;
        })
        .filter(Boolean)
        .join('; ');
      return {
        student_id: s.student_id,
        student_name: s.student_name,
        rekomendasi: `Belum tuntas (skor akhir ${Number(s.skorAkhir || 0).toFixed(2)}, KKTP belum tercapai). `
          + `Perlu mengikuti program perbaikan (remedial) pada: ${detail || 'materi yang belum dikuasai'}.`,
      };
    }
    return {
      student_id: s.student_id,
      student_name: s.student_name,
      rekomendasi: `Tuntas (skor akhir ${Number(s.skorAkhir || 0).toFixed(2)}). `
        + `Diberikan program pengayaan pada materi terkait ulangan harian.`,
    };
  });
}
