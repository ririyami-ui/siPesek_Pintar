/**
 * Extract full CP text from bskap_clean.txt and map to JSON structure.
 * Output: resources/js/utils/bskap_full_cp.json
 *
 * Mapping:
 *   Fase A -> SD kelas 1,2
 *   Fase B -> SD kelas 3,4
 *   Fase C -> SD kelas 5,6
 *   Fase D -> SMP kelas 7,8,9
 *   Fase E -> SMA kelas 10
 *   Fase F -> SMA kelas 11,12
 *
 * Phase-to-class mapping (used in app JSON):
 *   Fase A,B,C -> SD  (dependent on subject)
 *   Fase D     -> SMP
 *   Fase E,F   -> SMA
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLEAN_TXT = path.resolve(__dirname, '..', 'bskap_clean.txt');
const OUTPUT = path.resolve(__dirname, '..', 'resources', 'js', 'utils', 'bskap_full_cp.json');

const text = fs.readFileSync(CLEAN_TXT, 'utf8');
const lines = text.split('\n');

// Remove page markers (may be at start or middle of line)
const cleanLines = lines.map(l => l.replace(/={3,}\s*HALAMAN\s+\d+\s*={3,}/g, '').trim());

// --- Helper: normalize subject name to match JSON keys ---
function normalizeSubject(raw) {
  const name = raw
    // Remove Roman numeral prefix: "VIII. " or "I.1. " or "II "
    .replace(/^[IVXLCDM]+(?:\.[0-9]+)?\.?\s*/, '')
    .replace(/^CAPAIAN PEMBELAJARAN\s+/, '')
    .trim();

  const map = [
    ['PENDIDIKAN AGAMA ISLAM', 'Pendidikan Agama Islam'],
    ['PENDIDIKAN AGAMA KRISTEN', 'Pendidikan Agama Kristen'],
    ['PENDIDIKAN AGAMA KATOLIK', 'Pendidikan Agama Katolik'],
    ['PENDIDIKAN AGAMA HINDU', 'Pendidikan Agama Hindu'],
    ['PENDIDIKAN AGAMA BUDDHA', 'Pendidikan Agama Buddha'],
    ['PENDIDIKAN AGAMA KHONGHUCU', 'Pendidikan Agama Khonghucu'],
    ['PENDIDIKAN PANCASILA', 'Pendidikan Pancasila'],
    ['BAHASA INDONESIA TINGKAT LANJUT', 'Bahasa Indonesia'],
    ['BAHASA INDONESIA', 'Bahasa Indonesia'],
    ['MATEMATIKA TINGKAT LANJUT', 'Matematika'],
    ['MATEMATIKA', 'Matematika'],
    ['BAHASA INGGRIS TINGKAT LANJUT', 'Bahasa Inggris'],
    ['BAHASA INGGRIS', 'Bahasa Inggris'],
    ['ILMU PENGETAHUAN ALAM DAN SOSIAL', 'IPAS'],
    ['ILMU PENGETAHUAN ALAM (IPA)', 'IPA'],
    ['ILMU PENGETAHUAN ALAM', 'IPA'],
    ['FISIKA', 'Fisika'],
    ['KIMIA', 'Kimia'],
    ['BIOLOGI', 'Biologi'],
    ['INFORMATIKA', 'Informatika'],
    ['ILMU PENGETAHUAN SOSIAL', 'IPS'],
    ['SEJARAH TINGKAT LANJUT', 'Sejarah'],
    ['SEJARAH', 'Sejarah'],
    ['GEOGRAFI', 'Geografi'],
    ['EKONOMI', 'Ekonomi'],
    ['SOSIOLOGI', 'Sosiologi'],
    ['ANTROPOLOGI', 'Antropologi'],
    ['SENI MUSIK', 'Seni Musik'],
    ['SENI RUPA', 'Seni Rupa'],
    ['SENI TARI', 'Seni Tari'],
    ['SENI TEATER', 'Seni Teater'],
    ['PRAKARYA BUDI DAYA', 'Prakarya'],
    ['PRAKARYA KERAJINAN', 'Prakarya'],
    ['PRAKARYA PENGOLAHAN', 'Prakarya'],
    ['PRAKARYA REKAYASA', 'Prakarya'],
    ['PRAKARYA DAN KEWIRAUSAHAAN', 'Prakarya'],
    ['PENDIDIKAN JASMANI, OLAHRAGA, DAN KESEHATAN', 'PJOK'],
    ['PENDIDIKAN JASMANI', 'PJOK'],
    ['BAHASA ARAB', 'Bahasa Arab'],
    ['BAHASA JEPANG', 'Bahasa Jepang'],
    ['BAHASA JERMAN', 'Bahasa Jerman'],
    ['BAHASA KOREA', 'Bahasa Korea'],
    ['BAHASA MANDARIN', 'Bahasa Mandarin'],
    ['BAHASA PRANCIS', 'Bahasa Prancis'],
    ['KODING DAN KECERDASAN ARTIFISIAL', 'Koding dan Kecerdasan Artifisial'],
    ['PENDIDIKAN KHUSUS', null],
    ['PROGRAM KEBUTUHAN KHUSUS', null],
    ['MUATAN PEMBERDAYAAN', null],
    ['MUATAN KETERAMPILAN', null],
  ];

  const upper = name.toUpperCase();
  for (const [key, val] of map) {
    if (upper.startsWith(key) || upper.includes(key)) {
      return val;
    }
  }

  // Skip Pendidikan Khusus and other non-relevant
  if (upper.includes('PENDIDIKAN KHUSUS') || upper.includes('KEBUTUHAN KHUSUS') || upper.includes('MUATAN')) {
    return null;
  }

  return name;
}

// --- Phase mapping ---
const PHASE_GRADES = {
  'Fase A': { level: 'SD', grades: ['1', '2'] },
  'Fase B': { level: 'SD', grades: ['3', '4'] },
  'Fase C': { level: 'SD', grades: ['5', '6'] },
  'Fase D': { level: 'SMP', grades: ['7', '8', '9'] },
  'Fase E': { level: 'SMA', grades: ['10'] },
  'Fase F': { level: 'SMA', grades: ['11', '12'] },
};

// --- Parse document structure ---
const FASE_RE = /^(?:[0-9]+\.\s*)?Fase\s+([A-F])\s*\(/;

let currentSubject = null;
let currentSubjectLine = 0;
let inCapaianPembelajaran = false;
let currentPhase = null;
let currentPhaseText = [];

// Result: { "SD": { "1": { "Matematika": { "ganjil": { "cp_full": "..." }, "genap": { "cp_full": "..." } } } } }
const result = {};

function ensurePath(level, grade, subject) {
  if (!result[level]) result[level] = {};
  if (!result[level][grade]) result[level][grade] = {};
  if (!result[level][grade][subject]) result[level][grade][subject] = {};
  if (!result[level][grade][subject]['ganjil']) result[level][grade][subject]['ganjil'] = {};
  if (!result[level][grade][subject]['genap']) result[level][grade][subject]['genap'] = {};
}

function setCpFull(level, grades, subject, rawText) {
  let clean = rawText
    // Remove page markers
    .replace(/={5,}\s*HALAMAN\s+\d+\s*={5,}/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Remove leading continuation artifacts like "Paket C)" or "Program Paket C)"
  clean = clean.replace(/^(?:Program\s+)?Paket\s+[A-Z]\)\.?\s*/i, '');

  if (!clean || clean.length < 20) return;
  grades.forEach(g => {
    ensurePath(level, g, subject);
    result[level][g][subject]['ganjil']['cp_full'] = clean;
    result[level][g][subject]['genap']['cp_full'] = clean;
  });
}

// Detect subject headers: match patterns like "I.1. CAPAIAN PEMBELAJARAN ..."
const SUBJECT_RE = /^[IVXLCDM]+(?:\.[0-9]+)?\.?\s+CAPAIAN PEMBELAJARAN\s+/;
const SUBJECT_CONT_RE = /^[A-Z][A-Z\s,().]+$/; // continuation line (all caps)

for (let i = 0; i < cleanLines.length; i++) {
  const line = cleanLines[i];
  if (!line) continue;

  // Detect new subject
  if (SUBJECT_RE.test(line)) {
    // Save previous phase if exists
    if (currentSubject && currentPhase && currentPhaseText.length > 0) {
      const phaseInfo = PHASE_GRADES[currentPhase];
      if (phaseInfo) {
        const cpText = currentPhaseText.join(' ');
        setCpFull(phaseInfo.level, phaseInfo.grades, currentSubject, cpText);
      }
    }

    // Handle multi-line subject names (e.g., "... DAN BUDI" + "PEKERTI")
    let subjectLine = line;
    while (i + 1 < cleanLines.length && cleanLines[i + 1] && SUBJECT_CONT_RE.test(cleanLines[i + 1])) {
      subjectLine += ' ' + cleanLines[i + 1];
      i++;
    }

    currentSubject = normalizeSubject(subjectLine);
    currentSubjectLine = i;
    inCapaianPembelajaran = false;
    currentPhase = null;
    currentPhaseText = [];

    // Skip irrelevant subjects (Pendidikan Khusus, Muatan, etc.)
    if (!currentSubject) {
      currentSubject = null;
    }
    continue;
  }

  if (!currentSubject) continue;

  // Detect "D. Capaian Pembelajaran" section
  if (/^D\.\s*Capaian\s+Pembelajaran/.test(line)) {
    inCapaianPembelajaran = true;
    currentPhase = null;
    currentPhaseText = [];
    continue;
  }

  if (!inCapaianPembelajaran) continue;

  // Detect phase headers like "1. Fase A (Umumnya untuk Kelas I dan II..."
  const faseMatch = line.match(FASE_RE);
  if (faseMatch) {
    // Save previous phase
    if (currentPhase && currentPhaseText.length > 0) {
      const phaseInfo = PHASE_GRADES[currentPhase];
      if (phaseInfo) {
        const cpText = currentPhaseText.join(' ');
        setCpFull(phaseInfo.level, phaseInfo.grades, currentSubject, cpText);
      }
    }

    const phaseLetter = faseMatch[1];
    currentPhase = 'Fase ' + phaseLetter;
    currentPhaseText = [];
    // console.log(`  ${currentPhase} at line ${i}`);
    continue;
  }

  // If we are in a phase, collect text
  if (currentPhase) {
    // Stop at next subject or next major section header
    if (/^[A-Z]\.\s/.test(line) && !line.startsWith('1.') && !line.startsWith('2.') && !line.startsWith('3.')) {
      // Another major section (e.g., "E. ...") — stop collecting
      // ... but we keep collecting until next subject or phase
    }
    currentPhaseText.push(line);
  }
}

// Save last phase
if (currentSubject && currentPhase && currentPhaseText.length > 0) {
  const phaseInfo = PHASE_GRADES[currentPhase];
  if (phaseInfo) {
    const cpText = currentPhaseText.join(' ');
    setCpFull(phaseInfo.level, phaseInfo.grades, currentSubject, cpText);
  }
}

// Write output
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');
console.log('Done! Written to ' + OUTPUT);

// Summary
let total = 0;
Object.keys(result).forEach(level => {
  Object.keys(result[level]).forEach(grade => {
    Object.keys(result[level][grade]).forEach(subj => {
      total++;
    });
  });
});
console.log('Total subject entries: ' + total);
