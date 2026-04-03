/**
 * Utility to parse KKTP (Kriteria Ketercapaian Tujuan Pembelajaran) 
 * from RPP Markdown content.
 */

const IDENTITY_KEYWORDS = [
    'satuan pendidikan', 'mata pelajaran', 'kelas', 'semester',
    'materi pokok', 'alokasi waktu', 'model pembelajaran',
    'tahun ajaran', 'guru pengampu', 'nama guru', 'nip', 'identitas'
];

export const parseKKTP = (markdown) => {
    if (!markdown) return null;

    const cleanText = (text) => {
        if (!text) return '';
        return text
            .replace(/\*\*/g, '')   // Remove bold **
            .replace(/\*/g, '')     // Remove italic *
            .replace(/__/g, '')     // Remove bold __
            .replace(/_/g, '')      // Remove italic _
            .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
            .trim();
    };

    const result = {
        type: 'Unknown',
        criteria: []
    };

    // 1. Detect Approach/Method
    if (markdown.includes('RUBRIK PENILAIAN')) {
        result.type = 'Rubrik';
    } else if (markdown.includes('DESKRIPSI KRITERIA')) {
        result.type = 'Deskripsi Kriteria';
    } else if (markdown.includes('INTERVAL NILAI')) {
        result.type = 'Interval Nilai';
    } else {
        // Fallback detection
        const methodMatch = markdown.match(/Pendekatan yang digunakan: (.*)/);
        if (methodMatch) result.type = methodMatch[1].trim();
        if (markdown.includes('|') && markdown.includes('---')) result.type = 'Rubrik';
    }

    // 2. Extract Tables as Blocks
    const tableBlocks = [];
    const lines = markdown.split('\n');
    let currentBlock = [];

    lines.forEach(line => {
        if (line.trim().startsWith('|')) {
            currentBlock.push(line);
        } else if (currentBlock.length > 0) {
            tableBlocks.push(currentBlock.join('\n'));
            currentBlock = [];
        }
    });
    if (currentBlock.length > 0) tableBlocks.push(currentBlock.join('\n'));
    if (tableBlocks.length === 0) return result;

    // Helper to check if table is likely Identity
    const isIdentityTable = (tableMarkdown) => {
        const lower = tableMarkdown.toLowerCase();

        // Strong indicators: if any of these exist, it's definitely identity
        const strongKeywords = ['satuan pendidikan', 'nama guru', 'nip', 'identitas', 'kepala sekolah', 'nama penyusun'];
        if (strongKeywords.some(k => lower.includes(k))) return true;

        // Weak indicators: need at least 3 to confirm (increased from 2)
        const weakKeywords = ['mata pelajaran', 'kelas', 'semester', 'materi', 'alokasi waktu', 'tahun ajaran', 'kurikulum'];
        const weakMatches = weakKeywords.filter(k => lower.includes(k)).length;
        if (weakMatches >= 3) return true;

        // Special check: If it has "Kriteria" or "Skor" or "Interval", it is NOT identity, even if it has keywords.
        if (lower.includes('kriteria') || lower.includes('skor') || lower.includes('rentang') || lower.includes('interval')) {
            return false;
        }

        return false;
    };

    const validTables = tableBlocks.filter(t => !isIdentityTable(t));

    if (result.type === 'Rubrik') {
        const rubricTable = validTables.find(t => (t.includes('Aspek') || t.includes('Kriteria')) && (t.includes('Mahir') || t.includes('Sangat Baik') || t.includes('4')));
        if (rubricTable) {
            const rows = rubricTable.split('\n').filter(r => r.includes('|') && !r.includes(':---'));
            const dataRows = rows.slice(1);
            result.criteria = dataRows.map(row => {
                const cols = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                // Handle different column counts (Min 2: Aspect + at least one level)
                if (cols.length >= 2) {
                    return {
                        aspect: cleanText(cols[0]),
                        levels: [
                            { label: 'Level 1', score: 1, desc: cleanText(cols[1]) || '' },
                            { label: 'Level 2', score: 2, desc: cleanText(cols[2] || cols[1]) || '' },
                            { label: 'Level 3', score: 3, desc: cleanText(cols[3] || cols[2] || cols[1]) || '' },
                            { label: 'Level 4', score: 4, desc: cleanText(cols[4] || cols[3] || cols[2] || cols[1]) || '' }
                        ]
                    };
                }
                return null;
            }).filter(item => {
                if (!item || !item.aspect) return false;
                const lowAspect = item.aspect.toLowerCase();
                // Only exclude if it EXACTLY matches a keyword or starts with one followed by colon
                const isHeader = IDENTITY_KEYWORDS.some(k => lowAspect === k || lowAspect.startsWith(k + ':'));
                const isMeta = lowAspect === 'aspek' || lowAspect === 'kriteria' || lowAspect === 'kompetensi' || lowAspect === 'no';
                return !isHeader && !isMeta;
            });
        }
    }

    // If still empty or Generic Table, try fallback to ANY valid table (excluding identity)
    if (result.criteria.length === 0) {
        // Prefer first table remaining after filtering out identity tables
        // Also look for keywords 'Kriteria' or 'Deskripsi' if possible
        let anyTable = validTables.find(t => t.includes('Kriteria') || t.includes('Deskripsi') || t.includes('Indikator') || t.includes('Interval'));

        // Removed absolute fallback validTables[0] to prevent showing random tables (like Identity)
        // if no clear criteria table is found.

        if (anyTable) {
            const rows = anyTable.split('\n').filter(r => r.includes('|') && !r.includes(':---'));
            const dataRows = rows.slice(1);
            result.criteria = dataRows.map(row => {
                const cols = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                if (cols.length > 0) {
                    const cleanedAspect = cleanText(cols[0]);
                    return {
                        aspect: cleanedAspect,
                        indicator: cleanedAspect,
                        // Default levels for generic table
                        levels: [
                            { label: '1', score: 1 }, { label: '2', score: 2 }, { label: '3', score: 3 }, { label: '4', score: 4 }
                        ]
                    };
                }
                return null;
            }).filter(item => {
                if (!item || !item.aspect) return false;
                const lowAspect = item.aspect.toLowerCase();
                const isHeader = IDENTITY_KEYWORDS.some(k => lowAspect === k || lowAspect.startsWith(k + ':'));
                const isMeta = lowAspect === 'aspek' || lowAspect === 'kriteria' || lowAspect === 'kompetensi' || lowAspect === 'no';
                return item.aspect.length > 2 && !isHeader && !isMeta;
            });

            if (result.criteria.length > 0 && result.type === 'Unknown') {
                result.type = 'Rubrik';
            }
        }
    }

    return result;
};
