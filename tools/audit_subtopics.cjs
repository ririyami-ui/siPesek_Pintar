const fs = require('fs');
const path = require('path');

const root = 'F:\\app-firebase\\sekolahPintar\\smart-school-backend';
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^\uFEFF/, ''));

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
const SUBJ_MAP = (level, grade, subj) =>
  (level === 'SMA' && String(grade) === '10' && UMBRELLA[subj]) ? UMBRELLA[subj] : subj;

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
  return { score, ratio, hits };
}

const flagged = [];
let booksWithData = 0, subsChecked = 0;

for (const entry of idx) {
  const level = entry.jenjang, grade = entry.kelas;
  if (isAgama(entry.mapel)) continue;

  const book = read('resources/json/books/' + entry.path);
  if (!book.chapters || !book.chapters.length) continue;
  const hasSub = book.chapters.some(c => (c.sub_topics || []).length);
  if (!hasSub) continue;
  booksWithData++;

  const chNorm = book.chapters.map(c => norm(chapterTitle(c)));

  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i];
    for (const s of (chapter.sub_topics || [])) {
      const name = s.name || s;
      if (typeof name !== 'string' || !name.trim()) continue;
      subsChecked++;
      const mNorm = norm(name);
      const mTok = [...tokens(name)].filter(t => !helps.has(t));
      if (!mTok.length) continue;

      const own = scoreMateriToChapter(mNorm, mTok, chNorm[i]);

      let bestCh = -1, bestScore = 0, bestRatio = 0, bestHits = 0;
      for (let j = 0; j < book.chapters.length; j++) {
        const s2 = scoreMateriToChapter(mNorm, mTok, chNorm[j]);
        if (s2.score > bestScore) { bestScore = s2.score; bestRatio = s2.ratio; bestHits = s2.hits; bestCh = j; }
      }

      const misplaced = bestCh >= 0 && bestCh !== i &&
        bestScore >= 0.15 && bestScore > own.score;

      if (misplaced) {
        flagged.push({ level, grade, mapel: entry.mapel, path: entry.path,
          chapter_no: chapter.no, chapter: stripBab(chapter.title),
          sub: name, ownScore: own.score,
          bestCh: bestCh + 1, bestChapter: stripBab(book.chapters[bestCh].title),
          bestScore, bestRatio, bestHits: bestHits + '/' + mTok.length, note: 'MISPLACED' });
      }
    }
  }
}

fs.writeFileSync('C:\\Users\\DiTa\\AppData\\Local\\Temp\\opencode\\audit_subtopics_raw.json',
  JSON.stringify({ booksWithData, subsChecked, flagged }, null, 2));

console.log(`Buku dgn sub_topics: ${booksWithData}`);
console.log(`Sub_topics diperiksa: ${subsChecked}`);
console.log(`Flagged (MISPLACED/ORPHAN): ${flagged.length}`);
for (const f of flagged) {
  const loc = f.note === 'ORPHAN'
    ? `ORPHAN  [${f.level}/${f.grade} ${f.mapel}] Bab ${f.chapter_no} "${f.chapter}"`
    : `MISPLACED [${f.level}/${f.grade} ${f.mapel}] Bab ${f.chapter_no} "${f.chapter}" (own=${f.ownScore}) -> seharusnya Bab ${f.bestCh} "${f.bestChapter}" (score=${f.bestScore}, hits=${f.bestHits})`;
  console.log(`  ${loc}`);
  console.log(`      sub: "${f.sub}"`);
}