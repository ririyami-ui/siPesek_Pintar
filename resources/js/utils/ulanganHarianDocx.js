import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
    TableBorders, HeightRule, PageNumber, TableLayoutType,
} from 'docx';

// --- Konstanta Format Kop Utama (mengikuti template "02_ANALISIS ULANGAN HARIAN ... - KOSONG.xlsx") ---
const LINE = { line: 280, lineRule: 'auto' };
const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
const thinBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};

const fmtDate = (d) => {
    if (!d) return '....................';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtShortDate = (d) => {
    if (!d) return '....................';
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const blank = (v, fallback = '......................................................') =>
    (String(v || '').trim() ? String(v).trim() : fallback);

/** Tampilkan angka apa adanya (termasuk 0); hanya fallback bila null/undefined/kosong. */
const num0 = (v, d = 0) => (v === null || v === undefined || v === '' ? d : v);

/** Baris tabel seragam: teks normal dgn padding kecil. */
const cellPara = (text, { bold = false, center = false, size = 10 } = {}) =>
    new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: 30, after: 30 },
        children: [new TextRun({ text: String(text ?? ''), bold, size: (size || 10) * 2, font: 'Calibri' })],
    });

const emptyCell = () =>
    new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [] })],
        borders: noBorders,
        margins: { top: 30, bottom: 30, left: 60, right: 60 },
    });

/** Pair identitas "Label : isi" tanpa garis tabel (tabel 2 kolom borderless). */
const identitasCell = (label, value) =>
    new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        margins: { top: 20, bottom: 20, left: 0, right: 60 },
        children: [
            new Paragraph({
                spacing: { after: 0 },
                children: [
                    new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' }),
                    new TextRun({ text: ` : ${String(value ?? '')}`, size: 20, font: 'Calibri' }),
                ],
            }),
        ],
    });

function identitasGrid(rows) {
    return makeTable(rows.map(row => new TableRow({
        children: (
            row[0] && !Array.isArray(row[0])
                ? [row]                  // baris tunggal [label, value]
                : row                    // baris berisi pasangan [label, value], ...
        ).map(cell => {
            if (cell instanceof TableCell) return cell;
            const [label, value] = cell;
            return identitasCell(label, value);
        }),
    })), [3000, PAGE_W - 3000], noBorders);
}

/** Lebar teks area A4 portrait dgn margin L=1100/R=800 (twips). */
const PAGE_W = 11906 - 1100 - 800;

/**
 * Tabel dgn lebar kolom eksplisit (twips relatif) + fixed layout.
 * Tanpa ini, Word memberi gridCol ~100 twips ke semua kolom → tabel runtuh
 * menjadi 1-2 karakter per kolom ("N : a", "2 : 9"). Skala proporsional ke PAGE_W.
 */
function makeTable(rows, widths, borders = thinBorders) {
    const sum = widths.reduce((a, b) => a + b, 0) || widths.length || 1;
    const scaled = widths.map(w => Math.round((w / sum) * PAGE_W));
    let acc = 0;
    const out = scaled.map(w => { acc += w; return Math.max(w, 1); });
    out[out.length - 1] += PAGE_W - acc;
    return new Table({
        width: { size: PAGE_W, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: out,
        borders,
        rows,
    });
}

const sectionTitle = (text) =>
    new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: String(text), bold: true, size: 24, font: 'Calibri' })],
    });

const subTitle = (text) =>
    new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: String(text), bold: true, size: 22, font: 'Calibri' })],
    });

const bodyText = (text, { bold = false, italic = false } = {}) =>
    new Paragraph({
        spacing: { before: 30, after: 30, ...LINE },
        children: [new TextRun({ text: String(text ?? ''), bold, italics: italic, size: 20, font: 'Calibri' })],
    });

/** Kepala tabel: 1 sel tebal berisi konten (bisa multiline "A\nB"). */
const headCell = (text) =>
    new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: thinBorders,
        margins: { top: 30, bottom: 30, left: 50, right: 50 },
        children: String(text || '')
            .split('\n')
            .map(part => new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 10, after: 10 },
                children: [new TextRun({ text: part, bold: true, size: 18, font: 'Calibri' })],
            })),
    });

const dataCell = (text, { center = true, bold = false } = {}) =>
    new TableCell({
        verticalAlign: VerticalAlign.CENTER,
        borders: thinBorders,
        margins: { top: 20, bottom: 20, left: 50, right: 50 },
        children: [cellPara(text, { bold, center, size: 9 })],
    });

/* =====================================================================
 * Helpers Analisis Butir (sama keluarga analisisButir.js)
 * ===================================================================== */
function rerata(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length;
}

function kesukaran(skor, skorMaks) {
    const p = skorMaks > 0 ? rerata(skor) / skorMaks : 0;
    const kategori = p <= 0.30 ? 'Sukar' : p <= 0.70 ? 'Sedang' : 'Mudah';
    return { p: Number(p.toFixed(2)), kategori };
}

function dayapembeda(skorButir, skorTotalArr, skorMaks) {
    if (!skorMaks || skorMaks <= 0 || skorButir.length < 4) return { d: 0, kategori: 'Tidak Sah' };
    const k = Math.max(1, Math.round(skorButir.length * 0.27));
    const idx = skorButir.map((_, i) => i).sort((a, b) => skorTotalArr[b] - skorTotalArr[a]);
    const atas = idx.slice(0, k).map(i => skorButir[i]);
    const bawah = idx.slice(-k).map(i => skorButir[i]);
    const d = (rerata(atas) - rerata(bawah)) / skorMaks;
    const kategori = d >= 0.40 ? 'Baik Sekali' : d >= 0.30 ? 'Baik' : d >= 0.20 ? 'Cukup' : d >= 0 ? 'Kurang Baik' : 'Jelek';
    return { d: Number(d.toFixed(2)), kategori };
}

function validitas(itemScores, totalScores, tipe, skorMaksLihat) {
    const r = korelasi(itemScores, totalScores);
    const n = itemScores.length;
    const df = Math.max(1, n - 2);
    const rtabel = Number(Math.min(0.444, Number(1.96 / Math.sqrt(df)).toFixed(2)));
    const kategori = Math.abs(r) >= rtabel ? 'Valid' : 'Tidak Valid';
    return { r: Number(Math.abs(r).toFixed(2)), kategori, rtabel };
}

function korelasi(xs, ys) {
    if (!xs || !ys || xs.length === 0 || xs.length !== ys.length) return 0;
    const n = xs.length;
    const mx = rerata(xs), my = rerata(ys);
    let num = 0, dx2 = 0, dy2 = 0;
    for (let i = 0; i < n; i++) {
        const dx = Number(xs[i]) - mx, dy = Number(ys[i]) - my;
        num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
    }
    if (dx2 === 0 || dy2 === 0) return 0;
    return num / Math.sqrt(dx2 * dy2);
}

function meanSkorAkhir(skorAkhir) {
    const vals = Object.values(skorAkhir || {}).map(Number);
    if (!vals.length) return 0;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
}

const toVals = (skorAkhir) => Object.values(skorAkhir || {}).map(Number).filter(Number.isFinite);

function extractMin(skorAkhir) {
    const vals = toVals(skorAkhir);
    return vals.length ? Math.min(...vals) : 0;
}

function extractMax(skorAkhir) {
    const vals = toVals(skorAkhir);
    return vals.length ? Math.max(...vals) : 0;
}

function median(valsObj) {
    const vals = toVals(valsObj).sort((a, b) => a - b);
    if (!vals.length) return 0;
    const mid = Math.floor(vals.length / 2);
    if (vals.length % 2 === 1) return vals[mid];
    return Number(((vals[mid - 1] + vals[mid]) / 2).toFixed(2));
}

function standarDeviasi(valsObj) {
    const vals = toVals(valsObj);
    if (!vals.length) return 0;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((s, x) => s + (x - m) ** 2, 0) / vals.length;
    return Number(Math.sqrt(v).toFixed(2));
}

/** Hitung jumlah tuntas/belum tuntas + persentase dari rekomendasi ketuntasan. */
function belumTuntasCount(analisis) {
    const rekom = analisis?.rekomendasi || [];
    const tuntas = rekom.filter(r => r.tindakan === 'Pengayaan').length;
    const belum = rekom.filter(r => r.tindakan === 'Remedial').length;
    const total = rekom.length || analisis?.kelas?.nSiswa || 0;
    const persen = total ? Number(((tuntas / total) * 100).toFixed(2)) : 0;
    return { tuntas, belum, total, persen };
}

/* =====================================================================
 * Pembangun Dokumen Word — 8 Bagian (mengikuti template KOSONG.xlsx)
 * ===================================================================== */
export async function generateUlanganHarianWord(uhItem, analisisResult, rekomendasiAI, userProfile = {}, academicYear = '', activeSemester = '') {
    const uh = uhItem || {};
    const analisis = analisisResult || {};
    const ai = rekomendasiAI && typeof rekomendasiAI === 'object' && !Array.isArray(rekomendasiAI)
        ? (rekomendasiAI.rekomendasi || rekomendasiAI.rekomendasi_per_siswa || rekomendasiAI)
        : rekomendasiAI;
    const aiList = Array.isArray(ai) ? ai : Array.isArray(ai?.rekomendasi) ? ai.rekomendasi : [];
    const isiNarasi = ai?.narasi || ai?.ringkasan || ai?.rekomendasi_umum || '';

    const items = (analisis.items || analisis.item_meta || []).map((it, i) => ({
        no: it.no ?? i + 1,
        tipe: it.tipe || it.type || 'PG',
        elemen: it.elemen || it.element || '-',
        materi: it.materi || it.materi_pokok || '-',
        skor_maks: Number(it.skor_maks || 0),
        bobot: Number(it.bobot || 1),
        kesukaran: it.kesukaran || kesukaran([], it.skor_maks),
        dayaPembeda: it.dayaPembeda || { d: 0, kategori: '-' },
        validitas: it.validitas || { r: 0, kategori: '-' },
        rerata: Number(it.rerata || 0),
        dayaSerap: it.dayaSerap ?? (it.nBenar != null && analisis.kelas?.nSiswa
            ? Number(((it.nBenar / analisis.kelas.nSiswa) * 100).toFixed(2))
            : 0),
    }));

    const scores = analisis.scores || uh.scores || {};
    const studentIds = Object.keys(scores || {});
    const skorAkhir = analisis.skorAkhir || (() => {
        const out = {};
        studentIds.forEach(sid => {
            let num = 0, den = 0;
            items.forEach(it => {
                num += Number(scores[sid]?.[it.no] || 0) * it.bobot;
                den += Number(it.skor_maks || 1) * it.bobot;
            });
            out[sid] = den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
        });
        return out;
    })();

    const rombel = analisis.kelas || {};
    const distribusi = analisis.distribusi || [];

    // Daftar siswa dengan nama (urutan sesuai skor akhir, ganjil=>genap tidak diperlukan utk Word)
    const perSiswa = (analisis.perSiswa || [])
        .map(s => {
            const st = studentIds.find(sid => String(sid) === String(s.student_id));
            return { ...s, student_id: s.student_id ?? st, nol: s.butirGagal || [] };
        })
        .sort((a, b) => Number(b.skorAkhir || 0) - Number(a.skorAkhir || 0));

    // Sumber nama siswa: 1) rekomendasi/analisis (student_id => student_name),
    // 2) userProfile.students, 3) fallback "Siswa <id>"
    const namaMap = {};
    const absenMap = {};
    (analisis.rekomendasi || []).forEach(r => {
        if (r && r.student_id != null && r.student_name) namaMap[String(r.student_id)] = r.student_name;
        if (r && r.student_id != null && r.no_absen != null && r.no_absen !== '') absenMap[String(r.student_id)] = r.no_absen;
    });
    (userProfile?.students || []).forEach(s => {
        if (s && s.id != null && s.name) namaMap[String(s.id)] = s.name;
        if (s && s.id != null && s.absen != null && s.absen !== '') absenMap[String(s.id)] = s.absen;
    });

    const namaSiswa = (sid) => namaMap[String(sid)] || `Siswa ${sid}`;
    const noAbsen = (sid, fallback) => absenMap[String(sid)] ?? fallback;

    // --- SECTION ORDER sesuai template ---
    const children = [];

    /* ============ 1. KOP & IDENTITAS ============ */
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new TextRun({ text: 'ANALISIS ULANGAN HARIAN', bold: true, size: 32, font: 'Calibri' })],
    }));
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: blank(userProfile?.school || userProfile?.nama_sekolah || userProfile?.school_name || uh.school || '-').toUpperCase(), size: 22, font: 'Calibri' })],
    }));

    // Garis pembatas kop
    children.push(new Paragraph({
        border: {
            top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        },
        spacing: { after: 20 },
        children: [],
    }));

    children.push(identitasGrid([
        ['Nama Sekolah', blank(userProfile?.school || userProfile?.nama_sekolah || userProfile?.school_name || uh.school || '-')],
        ['Mata Pelajaran', blank(uh.subject_name || '-')],
        ['Kelas / Semester', `${blank(uh.class_name || '-')} / ${blank(userProfile?.activeSemester || uh.semester || '-')}`],
        ['Tahun Pelajaran', blank(academicYear || '-')],
        ['Pokok Bahasan', blank(uh.rpp_topic || '-')],
        ['Tanggal Pelaksanaan', blank(fmtDate(uh.date))],
        ['KKTP / KKM', blank(uh.kktp_score || rombel.kktp || '70')],
        ['Jumlah Siswa', blank(analisis.kelas?.nSiswa || studentIds.length || rombel.nSiswa || '0')],
        ['Jumlah Butir Soal', blank(items.length || rombel.nButir || '0')],
    ]));

    /* ============ 2. TABEL SKOR SISWA (Tampilkan Nama Siswa) ============ */
    children.push(sectionTitle('DAFTAR SKOR SISWA PER BUTIR SOAL'));

    const headRowCells = [
        headCell('No.\nAbsen'),
        headCell('Nama\nSiswa'),
        ...items.map(it => headCell(`B${it.no}`)),
        headCell('Jml\nSkor'),
        headCell('Skor\nAkhir'),
        headCell('Ketuntasan\nKKTP'),
    ];

    const bodyRows = studentIds.map((sid, idx) => {
        const totalSkor = Number((items.reduce((s, it) => s + Number(scores[sid]?.[it.no] || 0), 0)).toFixed(2));
        const akhir = Number(skorAkhir[sid] || 0);
        const kktp = Number(uh.kktp_score || rombel.kktp || 70);
        const tuntas = kktp > 0 ? akhir >= kktp : true;
        return new TableRow({
            children: [
                dataCell(noAbsen(sid, idx + 1)),
                dataCell(namaSiswa(sid), { center: false }),
                ...items.map(it => dataCell(Number(scores[sid]?.[it.no] || 0))),
                dataCell(totalSkor),
                dataCell(akhir),
                dataCell(tuntas ? 'Tuntas' : 'Belum'),
            ],
        });
    });

    const itemColW = Math.max(420, Math.floor((PAGE_W - 500 - 2000 - 700 - 800 - 900) / Math.max(items.length, 1)));
    const skorWidths = [500, 2000, ...items.map(() => itemColW), 700, 800, 900];
    children.push(makeTable([
        new TableRow({ children: headRowCells, tableHeader: true }),
        ...bodyRows,
    ], skorWidths));

    /* ============ 3. HASIL ANALISIS / RINGKASAN ============ */
    const st = analisis.kelas?.statistik || {};
    const targetKlasikal = Number(uh.target_klasikal || 80);
    const perTuntas = belumTuntasCount(analisis, st);
    const kktpVal = Number(uh.kktp_score || rombel.kktp || 70);

    children.push(sectionTitle('HASIL ANALISIS'));
    children.push(subTitle('1. Ketentuan Belajar'));
    children.push(bodyText(`a. Klasikal`));
    children.push(bodyText(`   - Seorang siswa dinyatakan telah tuntas belajar apabila ia telah mencapai skor minimal ${kktpVal}% atau nilai ${kktpVal} (daya serap perorangan).`));
    children.push(bodyText(`   - Suatu kelas dinyatakan telah tuntas belajar bila di kelas tersebut telah terdapat minimal ${targetKlasikal}% siswa yang telah mencapai daya serap ${kktpVal}% (daya serap klasikal).`));
    const tuntasPersen = perTuntas.persen;
    const kelasTuntas = tuntasPersen >= targetKlasikal;
    children.push(bodyText(`b. Kesimpulan : ${kelasTuntas ? 'Tuntas' : 'Belum Tuntas'} (${tuntasPersen}% siswa tuntas)`));

    children.push(subTitle('2. Rekapitulasi Hasil & Statistik'));
    children.push(identitasGrid([
        ['Jumlah Peserta', blank(analisis.kelas?.nSiswa || studentIds.length || '0', '0')],
        ['Jumlah Butir Soal', blank(items.length || rombel.nButir || '0', '0')],
        ['Rerata Skor Akhir', blank(num0(st.rerata ?? rombel.rerataAkhir ?? meanSkorAkhir(skorAkhir)))],
        ['Nilai Terendah', blank(num0(st.min ?? extractMin(skorAkhir)))],
        ['Nilai Tertinggi', blank(num0(st.max ?? extractMax(skorAkhir)))],
        ['Median', blank(num0(st.median ?? median(skorAkhir)))],
        ['Modus', blank(st.modusList && st.modusList.length ? st.modusList.join(', ') : 'Tidak ada')],
        ['Standar Deviasi', blank(num0(st.standarDeviasi ?? standarDeviasi(skorAkhir)))],
        ['Daya Serap', `${num0(rombel.dayaSerap)}%`],
        ['Reliabilitas (Alpha)', `${blank(rombel.alphaReliabilitas?.alpha)} (${blank(rombel.alphaReliabilitas?.kategori)})`],
        ['Jumlah Siswa Tuntas', blank(num0(perTuntas.tuntas))],
        ['Jumlah Siswa Belum Tuntas', blank(num0(perTuntas.belum))],
        ['Persentase Ketuntasan', `${num0(perTuntas.persen)}%`]],
    ));
    if (st.n) {
        children.push(bodyText('Statistik dihitung dari skor akhir seluruh peserta (data tunggal): mean = Σx/n, median = nilai tengah data terurut, modus = nilai paling sering muncul, standar deviasi = √(Σ(xi−mean)²/n).'));
    }

    // Distribusi
    if (distribusi.length) {
        children.push(subTitle('Distribusi Skor Akhir Siswa'));
        const distRows = [
            new TableRow({
                tableHeader: true,
                children: [headCell('Interval'), headCell('Jumlah Siswa')],
            }),
            ...distribusi.map(d => new TableRow({
                children: [dataCell(d.interval || d.label || '-'), dataCell(d.count ?? d.nSiswa ?? 0)],
            })),
        ];
        children.push(makeTable(distRows, [5600, PAGE_W - 5600]));
    }
    children.push(new Paragraph({ children: [], spacing: { after: 40 } }));

    /* ============ 4. ANALISIS BUTIR SOAL ============ */
    children.push(sectionTitle('ANALISIS BUTIR SOAL'));
    const butirRows = [
        new TableRow({
            tableHeader: true,
            children: [
                headCell('No'), headCell('Tipe'), headCell('Elemen'), headCell('Materi'),
                headCell('Kesukaran'), headCell('Daya Beda'), headCell('Validitas'),
                headCell('Daya\nSerap (%)'),
            ],
        }),
        ...items.map(it => new TableRow({
            children: [
                dataCell(it.no), dataCell(it.tipe), dataCell(it.elemen),
                dataCell(it.materi, { center: false }),
                dataCell(`${it.kesukaran.p} (${it.kesukaran.kategori})`),
                dataCell(`${it.dayaPembeda.d} (${it.dayaPembeda.kategori})`),
                dataCell(`${it.validitas.r} (${it.validitas.kategori})`),
                dataCell(num0(it.dayaSerap)),
            ],
        })),
    ];
    children.push(makeTable(butirRows, [450, 700, 1900, 2400, 1350, 1250, 1256, 1600]));

    // Soal yang tidak dikuasai kelas (daya serap butir < KKTP) — dasar remidi klasikal
    children.push(subTitle('Soal yang Tidak Dikuasai Kelas'));
    if (rombel.butirLemah && rombel.butirLemah.length) {
        children.push(bodyText(`Berikut butir soal yang daya serapnya di bawah KKTP (${rombel.kktpKelas || 70}%) sehingga perlu dijelaskan ulang & menjadi dasar program perbaikan klasikal:`));
        children.push(bodyText(rombel.butirLemah.map(b =>
            `No.${b.no} (Daya serap ${num0(b.dayaSerap)}%)${b.materi ? ` — ${b.elemen && b.elemen !== b.materi ? b.elemen + ' • ' : ''}${b.materi}` : ''}`
        ).join('; ')));
    } else {
        children.push(bodyText('Semua butir dikuasai kelas (daya serap ≥ KKTP).'));
    }
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));

    /* ============ 5. REKOMENDASI & PROGRAM PERBAIKAN (REMEDIAL) ============ */
    children.push(sectionTitle('REKOMENDASI & PROGRAM PERBAIKAN (REMEDIAL)'));

    const belumTuntas = (analisis.rekomendasi || []).filter(r => r.tindakan === 'Remedial');
    const tuntasList = (analisis.rekomendasi || []).filter(r => r.tindakan === 'Pengayaan');

    children.push(bodyText(`Berdasarkan hasil analisis ulangan harian ini, siswa yang belum mencapai ketuntasan (KKTP) perlu mengikuti program perbaikan (remidial). Siswa yang sudah tuntas mengikuti program pengayaan.`));

    if (isiNarasi) children.push(bodyText(isiNarasi, { italic: true }));

    children.push(subTitle('A. Siswa Perlu Perbaikan (Remedial)'));
    if (belumTuntas.length) {
        const remRows = [
            new TableRow({
                tableHeader: true,
                children: [headCell('No'), headCell('Nama Siswa'), headCell('Skor Akhir'), headCell('Butir Gagal')],
            }),
            ...belumTuntas.map((r, i) => new TableRow({
                children: [
                    dataCell(i + 1),
                    dataCell(r.student_name || namaSiswa(r.student_id), { center: false }),
                    dataCell(r.skorAkhir ?? r.skor ?? 0),
                    dataCell((r.butirGagal || r.butirNol || []).map(b => `No.${b.no ?? b}`).join(', ') || '-'),
                ],
            })),
        ];
        children.push(makeTable(remRows, [500, 4500, 1300, PAGE_W - 500 - 4500 - 1300]));
    } else {
        children.push(bodyText('Tidak ada siswa yang perlu remedial pada ulangan ini.'));
    }

    // Blanko nilai setelah perbaikan (remidi) — sesuai pertanyaan "remidi diisi di mana"
    children.push(subTitle('C. Daftar Nilai Setelah Perbaikan (Remedial)'));
    const nilaiRemidiRows = [
        new TableRow({
            tableHeader: true,
            children: [headCell('No'), headCell('Nama Siswa'), headCell('Nilai Awal'), headCell('Butir Gagal'), headCell('Nilai Setelah Perbaikan')],
        }),
        ...(belumTuntas.length ? belumTuntas.map((r, i) => new TableRow({
            children: [
                dataCell(i + 1),
                dataCell(r.student_name || namaSiswa(r.student_id), { center: false }),
                dataCell(r.skorAkhir ?? r.skor ?? 0),
                dataCell((r.butirGagal || r.butirNol || []).map(b => `No.${b.no ?? b}`).join(', ') || '-'),
                dataCell(uh.remidi_scores?.[String(r.student_id)] ?? '', { center: false }),
            ],
        })) : [new TableRow({ children: [dataCell('-', { center: false }), dataCell('Tidak ada peserta remedial', { center: false }), dataCell('-'), dataCell('-'), dataCell('')] })]),
    ];
    children.push(makeTable(nilaiRemidiRows, [450, 4000, 1100, 2200, PAGE_W - 450 - 4000 - 1100 - 2200]));
    children.push(bodyText('Nilai setelah perbaikan diisi pada kolom yang masih kosong (blanko dapat dicetak dan diisi manual).'));
    children.push(subTitle('D. Siswa Mengikuti Pengayaan'));
    if (tuntasList.length) {
        children.push(bodyText(`Sebanyak ${tuntasList.length} siswa sudah mencapai ketuntasan dan diarahkan mengikuti program pengayaan: ${tuntasList.map(r => r.student_name || namaSiswa(r.student_id)).join(', ')}.`));
    }

    /* ============ 6. SOAL PERBAIKAN ============ */
    children.push(sectionTitle('SOAL PERBAIKAN'));
    children.push(identitasGrid([
        ['Nama Sekolah', blank(userProfile?.school || userProfile?.nama_sekolah || userProfile?.school_name || uh.school || '-')],
        ['Mata Pelajaran', blank(uh.subject_name || '-')],
        ['Kelas / Semester', `${blank(uh.class_name || '-')} / ${blank(activeSemester || uh.semester || '-')}`],
        ['Tahun Pelajaran', blank(academicYear || '-')],
        ['Pokok Bahasan', blank(uh.rpp_topic || '-')],
        ['Tanggal Perbaikan', '......................................................'],
    ]));

    const butirGagal = [...new Set((analisis.rekomendasi || []).flatMap(r => (r.butirGagal || []).map(b => Number(b.no ?? b))))]
        .filter(Boolean)
        .sort((a, b) => a - b);

    if (butirGagal.length) {
        children.push(bodyText(`Soal-soal yang perlu diperbaiki kembali adalah butir nomor : ${butirGagal.join(', ')}.`));
    } else {
        children.push(bodyText(`Seluruh butir telah tuntas; tidak ada soal yang perlu diulang.`));
    }

    // lembar jawab perbaikan
    children.push(subTitle('Lembar Jawab Perbaikan'));
    const jawabRows = [
        new TableRow({
            tableHeader: true,
            children: [headCell('No'), headCell('Butir'), headCell('Jawaban Perbaikan')],
        }),
        ...(butirGagal.length ? butirGagal : [1]).map((no, i) => new TableRow({
            children: [dataCell(i + 1), dataCell(no), dataCell('', { center: false })],
        })),
    ];
    children.push(makeTable(jawabRows, [600, 1000, PAGE_W - 1600]));

    /* ============ 7. PROGRAM PENGAYAAN ============ */
    children.push(sectionTitle('PROGRAM PENGAYAAN'));
    children.push(identitasGrid([
        ['Mata Pelajaran', blank(uh.subject_name || '-')],
        ['Pokok Bahasan', blank(uh.rpp_topic || '-')],
        ['Satuan Pendidikan', blank(userProfile?.school || '-')],
        ['Kelas / Semester', `${blank(uh.class_name || '-')} / ${blank(activeSemester || uh.semester || '-')}`],
        ['Tahun Pelajaran', blank(academicYear || '-')],
    ]));
    children.push(bodyText('1. Tujuan :', { bold: true }));
    children.push(bodyText('Memberikan pengalaman belajar tambahan bagi siswa yang telah tuntas agar kemampuannya lebih berkembang (enrichment).'));
    children.push(bodyText('2. Sasaran Kegiatan :', { bold: true }));
    children.push(bodyText(tuntasList.length
        ? `Siswa yang telah mencapai ketuntasan, yaitu : ${tuntasList.map(r => r.student_name || namaSiswa(r.student_id)).join(', ')}.`
        : 'Tidak ada siswa yang mengikuti pengayaan pada ulangan ini.'));
    children.push(bodyText('3. Uraian Kegiatan :', { bold: true }));
    children.push(bodyText('Siswa mengerjakan soal-soal pengayaan (lebih mendalam) terkait materi yang sudah dikuasai, dilanjutkan bimbingan mandiri dan presentasi singkat.'));
    children.push(bodyText('4. Sumber Materi :', { bold: true }));
    children.push(bodyText('Buku teks, LKS, dan sumber belajar digital sesuai kurikulum yang berlaku.'));
    children.push(bodyText('5. Metode :', { bold: true }));
    children.push(bodyText('Pembelajaran mandiri terarah, diskusi kelompok kecil, dan pemberian umpan balik.'));
    children.push(bodyText('Soal-soal pengayaan sebagai berikut :'));
    children.push(bodyText('(lampirkan butir-butir soal pengayaan sesuai kebutuhan)'));

    /* ============ 8. DAFTAR NILAI PESERTA PENGAYAAN + ABSEN / DAFTAR HADIR ============ */
    children.push(sectionTitle('DAFTAR NILAI PESERTA PENGAYAAN'));
    const nilaiRows = [
        new TableRow({
            tableHeader: true,
            children: [headCell('No'), headCell('Nama Siswa'), headCell('Nilai'), headCell('Keterangan')],
        }),
        ...tuntasList.map((r, i) => new TableRow({
            children: [
                dataCell(i + 1),
                dataCell(r.student_name || namaSiswa(r.student_id), { center: false }),
                dataCell(r.skorAkhir ?? r.skor ?? 0),
                dataCell('Pengayaan'),
            ],
        })),
    ];
    if (!tuntasList.length) {
        nilaiRows.push(new TableRow({ children: [dataCell('-', { center: false }), dataCell('Tidak ada peserta', { center: false }), dataCell('-'), dataCell('-')] }));
    }
    children.push(makeTable(nilaiRows, [450, 4900, 1100, PAGE_W - 4900 - 1550]));
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));

    children.push(sectionTitle('DAFTAR HADIR ULANGAN HARIAN'));
    children.push(bodyText(`Hari / Tanggal Pelaksanaan : ${fmtDate(uh.date)}`));
    const attendanceMap = uh.attendanceMap || {};
    const absenRows = [
        new TableRow({
            tableHeader: true,
            children: [headCell('No'), headCell('Nama Siswa'), headCell('Hadir'), headCell('S'), headCell('I'), headCell('A'), headCell('Keterangan')],
        }),
        ...studentIds.map((sid, i) => {
            const status = String(attendanceMap[String(sid)] || 'hadir').toLowerCase();
            const isHadir = status === 'hadir';
            const isSakit = status === 'sakit';
            const isIzin = status === 'izin';
            const isAlpa = status === 'alpa' || status === 'alfa';
            return new TableRow({
                children: [
                    dataCell(noAbsen(sid, i + 1)),
                    dataCell(namaSiswa(sid), { center: false }),
                    dataCell(isHadir ? '✓' : ''),
                    dataCell(isSakit ? '✓' : ''),
                    dataCell(isIzin ? '✓' : ''),
                    dataCell(isAlpa ? '✓' : ''),
                    dataCell(status && !['hadir', 'sakit', 'izin', 'alpa', 'alfa'].includes(status) ? status : '', { center: false }),
                ],
            });
        }),
    ];
    children.push(makeTable(absenRows, [450, 3900, 800, 650, 650, 650, PAGE_W - 3900 - 450 - 800 - 1950]));

    /* ============ TANDA TANGAN ============ */
    children.push(new Paragraph({ children: [], spacing: { after: 200 } }));
    const dateStr = fmtDate(new Date());
    const city = userProfile?.city || userProfile?.kota || '....................';
    const tTdRows = [
        new TableRow({
            children: [
                new TableCell({
                    borders: noBorders,
                    children: [
                        new Paragraph({ children: [new TextRun({ text: 'Mengetahui,', size: 20, font: 'Calibri' })] }),
                        new Paragraph({ children: [new TextRun({ text: 'Kepala Sekolah', size: 20, font: 'Calibri' })] }),
                        new Paragraph({ children: [new TextRun({ text: blank(userProfile?.principalName, '............................'), bold: true, size: 20, font: 'Calibri' })] }),
                        new Paragraph({ children: [new TextRun({ text: `NIP. ${blank(userProfile?.principalNip, '............................')}`, size: 20, font: 'Calibri' })] }),
                    ],
                }),
                new TableCell({
                    borders: noBorders,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.LEFT,
                            children: [new TextRun({ text: `${city}, ${dateStr}`, size: 20, font: 'Calibri' })],
                        }),
                        new Paragraph({ children: [new TextRun({ text: 'Guru Mata Pelajaran', size: 20, font: 'Calibri' })] }),
                        new Paragraph({ children: [new TextRun({ text: blank(userProfile?.name, '............................'), bold: true, size: 20, font: 'Calibri' })] }),
                        new Paragraph({ children: [new TextRun({ text: `NIP. ${blank(userProfile?.nip, '............................')}`, size: 20, font: 'Calibri' })] }),
                    ],
                }),
            ],
        }),
    ];
    children.push(makeTable(tTdRows, [PAGE_W / 2, PAGE_W / 2], noBorders));

    const doc = new Document({
        creator: userProfile?.name || 'Si Pesek Pintar',
        title: `Analisis Ulangan Harian - ${uh.subject_name || ''}`,
        description: 'Laporan Analisis Ulangan Harian',
        styles: {
            default: {
                document: {
                    run: { font: 'Calibri', size: 20 },
                    paragraph: { spacing: { after: 60 } },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1000, bottom: 1000, left: 1100, right: 800 },
                },
            },
            children,
        }],
    });

    return await Packer.toBlob(doc);
}
