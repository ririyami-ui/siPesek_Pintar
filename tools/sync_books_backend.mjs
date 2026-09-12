import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const INTEL = path.join(root, 'resources/js/utils/bskap_2025_intel.json');
const INDEX = path.join(root, 'resources/json/books/index.json');
const BOOKS_ROOT = path.join(root, 'resources/json/books');

const intel = JSON.parse(fs.readFileSync(INTEL, 'utf8').replace(/^\uFEFF/, ''));
const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8').replace(/^\uFEFF/, ''));

function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function stripBab(t) { return String(t).replace(/^(bab|unit|chapter)\s*\d*\s*:\s*/i, '').trim(); }
function dice(a, b) {
  const A = new Set(norm(a).split(' ').filter(w => w.length > 2));
  const B = new Set(norm(b).split(' ').filter(w => w.length > 2));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return 2 * inter / (A.size + B.size);
}

let updated = 0, skipped = 0, unchanged = 0;

for (const entry of idx) {
  const bookPath = path.join(BOOKS_ROOT, entry.path);
  if (!fs.existsSync(bookPath)) { skipped++; continue; }

  const tbs = intel.textbooks[entry.jenjang]?.[entry.kelas];
  const intelSubj = tbs && tbs[entry.mapel] ? entry.mapel : null;
  if (!intelSubj) { skipped++; continue; }

  const book = JSON.parse(fs.readFileSync(bookPath, 'utf8').replace(/^\uFEFF/, ''));
  const intelChapters = (tbs[intelSubj].chapters || []).map(t => stripBab(t));
  const currentTitles = (book.chapters || []).map(c => c.title || '');

  // check if already aligned
  let aligned = intelChapters.length === currentTitles.length;
  if (aligned) {
    for (let i = 0; i < intelChapters.length; i++) {
      if (dice(norm(intelChapters[i]), norm(currentTitles[i])) < 0.6) { aligned = false; break; }
    }
  }
  if (aligned) { unchanged++; continue; }

  // Build chapter map: old chapter index -> best matching new index
  const oldByTitle = new Map();
  (book.chapters || []).forEach((c, i) => oldByTitle.set(i, norm(c.title)));
  const matchedOld = new Set();
  const matchMap = []; // newIdx -> { oldIdx, score }

  intelChapters.forEach((newTitle) => {
    const nn = norm(newTitle);
    let bestOld = -1, bestScore = 0;
    for (const [oldIdx, oldTitle] of oldByTitle) {
      if (matchedOld.has(oldIdx)) continue;
      const s = dice(nn, stripBab(oldTitle));
      if (s > bestScore) { bestScore = s; bestOld = oldIdx; }
    }
    if (bestOld >= 0) matchedOld.add(bestOld);
    matchMap.push({ newTitle, oldIdx: bestOld, score: bestScore });
  });

  // Complements: chapters that are strict expansions (all meaning tokens of the old
  // title appear in the new title) also inherit their sub_topics, e.g. "Eksponen".
  intelChapters.forEach((newTitle, i) => {
    const m = matchMap[i];
    if (m.oldIdx >= 0 && m.score >= 0.6) return;
    const nn = norm(newTitle);
    const nTokens = new Set(nn.split(' ').filter(w => w.length > 2));
    for (const [oldIdx, oldTitle] of oldByTitle) {
      if (matchedOld.has(oldIdx)) continue;
      const ot = stripBab(oldTitle);
      const oTokens = norm(ot).split(' ').filter(w => w.length > 2);
      if (oTokens.length === 0) continue;
      const allIn = oTokens.every(t => nTokens.has(t));
      if (allIn) {
        m.oldIdx = oldIdx; m.score = 1;
        matchedOld.add(oldIdx);
        break;
      }
    }
  });

  // Build new chapters array
  const newChapters = matchMap.map((m, i) => {
    const old = m.oldIdx >= 0 && m.score >= 0.6 ? book.chapters[m.oldIdx] : null;
    const ch = { no: i + 1, title: m.newTitle };
    if (old) {
      ch.sub_topics = (old.sub_topics || []).map(sub => {
        if (typeof sub === 'string') return { name: sub, bloom_level: 'LOTS', suggested_jp: 1 };
        return { name: sub.name || '', bloom_level: sub.bloom_level || 'LOTS', suggested_jp: sub.suggested_jp || 1 };
      });
      ch.key_terms = old.key_terms || [];
      if (old.pages) ch.pages = old.pages;
      if (old.visual_hints) ch.visual_hints = old.visual_hints;
    } else {
      ch.sub_topics = [];
      ch.key_terms = [];
    }
    return ch;
  });

  book.chapters = newChapters;
  fs.writeFileSync(bookPath, JSON.stringify(book, null, 2), 'utf8');
  updated++;
}

console.log(`Sync complete: ${updated} files updated, ${unchanged} unchanged, ${skipped} skipped (no intel match)`);