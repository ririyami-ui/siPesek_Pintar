const fs = require('fs');
const path = require('path');

const root = 'F:\\app-firebase\\sekolahPintar\\smart-school-backend';
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8').replace(/^\uFEFF/, ''));
const intel = read('resources/js/utils/bskap_2025_intel.json');
const idx = read('resources/json/books/index.json');

const norm = (s) => (s || '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const tokens = (s) => new Set(norm(s).split(' ').filter(w => w.length > 2));
const isAgama = (m) => /pai|agama budi pekerti|agama/i.test(m);
const stripBab = (t) => String(t).replace(/^(bab|unit|chapter)\s*\d*\s*:\s*/i, '').trim();

const helps = new Set(['peserta','didik','dapat','mampu','serta','dan','atau','yang','dari','untuk','dalam','sumber','pada','dengan','satu','bab','materi','pengenalan','konsep','lanjutan','dasar','sejarah','perkembangan','teknik','nilai']);

// Fase E (SMA kelas 10) memakai buku resmi payung IPA/IPS — meniru
// AiGeneratorService::getRelevantBookContent & gemini.js FASE_E_UMBRELLA.
const UMBRELLA = { Fisika:'IPA', Kimia:'IPA', Biologi:'IPA', Ekonomi:'IPS', Sosiologi:'IPS', Geografi:'IPS', Sejarah:'IPS' };

const report = { level: {}, total: 0, covered: 0, noBook: 0, zero: 0, partial: 0 };
const noBookList = [];
const zeroList = [];
const chapterOnly = [];

for (const level of ['SD','SMP','SMA']) {
  report.level[level] = { total: 0, covered: 0, noBook: 0, zero: 0, partial: 0, chapterOnly: 0 };
  for (const grade of Object.keys(intel.subjects[level] || {})) {
    for (const subj of Object.keys(intel.subjects[level][grade] || {})) {
      if (isAgama(subj)) continue;

      const entry = idx.find(x => x.jenjang === level && String(x.kelas) === String(grade) && norm(x.mapel) === norm((level === 'SMA' && grade == 10 && UMBRELLA[subj]) ? UMBRELLA[subj] : subj));
      let bookText = null, bookChaps = [];
      if (entry) {
        const f = path.join(root, 'resources/json/books', entry.path);
        if (fs.existsSync(f)) {
          const b = read('resources/json/books/' + entry.path);
          bookChaps = (b.chapters || []).map(c => stripBab(c.title));
          bookText = b.chapters.map(c => norm(`${c.title} ${(c.sub_topics||[]).map(s => typeof s === 'string' ? s : (s.name||'')).join(' ')} ${(c.key_terms||[]).join(' ')}`)).join(' ');
        }
      }
      const subjectKey = `${level}/${grade}/${subj}`;

      for (const sem of ['ganjil','genap']) {
        for (const m of (intel.subjects[level][grade][subj][sem]?.materi_inti || [])) {
          const name = (m.materi || '').trim();
          if (!name) continue;
          report.total++; report.level[level].total++;

          if (!entry) { report.noBook++; report.level[level].noBook++; noBookList.push(`${subjectKey} => ${name}`); continue; }
          if (!bookText) { report.noBook++; report.level[level].noBook++; noBookList.push(`${subjectKey} => ${name} (file kosong)`); continue; }

          // Match exact stripos (mirrors AiGeneratorService::getRelevantBookContent)
          const haystack = norm(name);
          const hitStripos = bookText.includes(haystack);
          if (hitStripos) { report.covered++; report.level[level].covered++; continue; }

          // token ratio vs full book text
          const nt = [...tokens(name)].filter(t => !helps.has(t));
          const btokens = new Set(bookText.split(' ').filter(w => w.length > 2));
          const hitCount = nt.filter(t => btokens.has(t)).length;
          const ratio = nt.length ? hitCount / nt.length : 1;
          if (ratio === 0) { report.zero++; report.level[level].zero++; zeroList.push(`${subjectKey}/${sem} => ${name}`); }
          else if (ratio < 1) { report.partial++; report.level[level].partial++; }
          else { report.covered++; report.level[level].covered++; }

          // chapter title presence only (no sub_topics needed)
          const chapHit = nt.filter(t => bookChaps.some(c => norm(c).includes(t))).length;
          const chapRatio = nt.length ? chapHit / nt.length : 1;
          if (chapRatio >= 0.5) chapterOnly.push(`${subjectKey}/${sem} => ${name}`);
        }
      }
    }
  }
}

console.log('=== ALIGN REPORT: materi_inti vs buku backend (non-agama) ===');
console.log(`TOTAL materi_inti: ${report.total}`);
console.log(`Covered (stripos / token penuh): ${report.covered}`);
console.log(`Belum tercakup penuh: ${report.total - report.covered}`);
console.log(`  - rasio 0 (tidak ada jejak): ${report.zero}`);
console.log(`  - rasio 0<r<1 (sebagian): ${report.partial}`);
console.log(`No book entry: ${report.noBook}`);
console.log('\nPer jenjang:');
for (const l of ['SD','SMP','SMA']) {
  const r = report.level[l];
  console.log(`  ${l}: total ${r.total}, covered ${r.covered}, no-book ${r.noBook}, zero ${r.zero}, partial ${r.partial}`);
}
console.log(`\nMateri yang HANYA ditemukan di judul bab (tanpa sub_topics): ${chapterOnly.length}`);
console.log('\n=== NO BOOK ENTRY (non-agama) ===');
noBookList.forEach(x => console.log('  ' + x));
console.log('\n=== RASIO 0 (tidak ada jejak di buku, non-agama) ===');
zeroList.slice(0, 60).forEach(x => console.log('  ' + x));
fs.writeFileSync('C:\\Users\\DiTa\\AppData\\Local\\Temp\\opencode\\align_report_raw.json', JSON.stringify({ noBook: noBookList, zero: zeroList, chapterOnly }, null, 2));