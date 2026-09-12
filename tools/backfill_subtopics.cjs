const fs = require('fs');
const path = require('path');

const root = 'F:\\app-firebase\\sekolahPintar\\smart-school-backend';
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^\uFEFF/, ''));
const write = (f, obj) => fs.writeFileSync(path.join(root, f), JSON.stringify(obj, null, 2), 'utf8');

const intel = read('resources/js/utils/bskap_2025_intel.json');
const idx = read('resources/json/books/index.json');

const norm = (s) => (s || '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const tokens = (s) => new Set(norm(s).split(' ').filter(w => w.length > 2));
const stripBab = (t) => String(t).replace(/^(bab|unit|chapter)\s*\d*\s*:\s*/i, '').trim();
const isAgama = (m) => /pai|agama budi pekerti|agama/i.test(m);

const helps = new Set([
  'dan', 'untuk', 'dalam', 'dari', 'adalah', 'yang', 'pada', 'dengan', 'oleh',
  'dapat', 'sebuah', 'berdasarkan', 'peran', 'salah', 'secara', 'menjadi',
  'serta', 'agar', 'jika', 'bagi', 'sebagai', 'kedua', 'ketiga', 'jenis',
  'macam', 'indonesia', 'dunia', 'masalah', 'nilai', 'dasar', 'konsep',
  'proses', 'ilmu', 'atas', 'tentang', 'sesuai', 'melalui', 'berupa',
  'sistem', 'materi', 'bagian', 'penerapan', 'karakteristik', 'bentuk',
]);

const UMBRELLA = { Fisika: 'IPA', Kimia: 'IPA', Biologi: 'IPA', Ekonomi: 'IPS', Sosiologi: 'IPS', Geografi: 'IPS', Sejarah: 'IPS' };

function chapterTitle(c) { return stripBab(c.title || ''); }

function scoreMateriToChapter(materiNorm, mTok, chapterTitleNorm) {
  let score = 0;
  const ct = stripBab(chapterTitleNorm).split(':').pop().trim();
  const cNorm = norm(ct);
  const cTok = new Set(cNorm.split(' ').filter(w => w.length > 2));

  if (cNorm.length > 3 && materiNorm.includes(cNorm)) score += 1.0;
  const hits = mTok.filter(t => cTok.has(t)).length;
  const ratio = mTok.length ? hits / mTok.length : 0;
  if (ratio >= 0.5) score += 0.4;
  else if (ratio >= 0.3) score += 0.3;
  else if (ratio >= 0.15) score += 0.15;
  return { score, ratio };
}

let totalFilled = 0, totalBooks = 0, totalUnassigned = 0;
const noMateriSubjects = [];

for (const level of ['SD', 'SMP', 'SMA']) {
  const subjects = intel.subjects[level] || {};
  for (const grade of Object.keys(subjects)) {
    for (const subj of Object.keys(subjects[grade])) {
      if (isAgama(subj)) continue;

      const materiInti = [];
      for (const sem of ['ganjil', 'genap']) {
        for (const m of (subjects[grade][subj][sem]?.materi_inti || [])) {
          const name = (m.materi || '').trim();
          if (name) materiInti.push(name);
        }
      }
      if (!materiInti.length) continue;

      // Resolve book entry (memakai payung utk SMA10 sains/sosial, sama dgn backend)
      const subjectKey = (level === 'SMA' && String(grade) === '10' && UMBRELLA[subj]) ? UMBRELLA[subj] : subj;
      const entry = idx.find(x => x.jenjang === level && String(x.kelas) === String(grade) && norm(x.mapel) === norm(subjectKey));
      if (!entry) { noMateriSubjects.push(`${level}/${grade}/${subj} (no book)`); continue; }

      const bookPath = path.join(root, 'resources/json/books', entry.path);
      if (!fs.existsSync(bookPath)) { noMateriSubjects.push(`${level}/${grade}/${subj} (file missing)`); continue; }
      const book = read('resources/json/books/' + entry.path);
      if (!book.chapters || !book.chapters.length) { noMateriSubjects.push(`${level}/${grade}/${subj} (no chapters)`); continue; }

      totalBooks++;
      const chNorm = book.chapters.map(c => norm(chapterTitle(c)));
      const chTitles = book.chapters.map(c => chapterTitle(c));

      for (const name of materiInti) {
        const mNorm = norm(name);
        const mTok = [...tokens(name)].filter(t => !helps.has(t));
        if (!mTok.length) continue;

        let bestCh = -1, bestScore = 0, bestRatio = 0;
        for (let i = 0; i < book.chapters.length; i++) {
          const { score, ratio } = scoreMateriToChapter(mNorm, mTok, chNorm[i]);
          if (score > bestScore) { bestScore = score; bestRatio = ratio; bestCh = i; }
        }

        // Threshold: harus ada jejak nyata (substring bab atau minimal 1 token bermakna)
        if (bestCh < 0 || bestScore < 0.15) { totalUnassigned++; continue; }

        const chapter = book.chapters[bestCh];
        const existing = (chapter.sub_topics || []).map(s => norm(s.name || s));
        if (!existing.includes(mNorm)) {
          if (!chapter.sub_topics) chapter.sub_topics = [];
          chapter.sub_topics.push({ name, bloom_level: 'LOTS', suggested_jp: 1 });
          totalFilled++;
        }
      }

      write('resources/json/books/' + entry.path, book);
    }
  }
}

fs.writeFileSync('C:\\Users\\DiTa\\AppData\\Local\\Temp\\opencode\\backfill_subtopics_raw.json',
  JSON.stringify({ noMateriSubjects, totalFilled, totalBooks, totalUnassigned }, null, 2));
console.log(`Books diproses: ${totalBooks}`);
console.log(`Materi diisi sebagai sub_topics: ${totalFilled}`);
console.log(`Materi tanpa bab cocok (biarkan kosong): ${totalUnassigned}`);
console.log('No book / skip:');
noMateriSubjects.forEach(x => console.log('  ' + x));