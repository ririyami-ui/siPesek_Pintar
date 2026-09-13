import CP_FULL from './bskap_full_cp.json';
import BSKAP_DATA from './bskap_2025_intel.json';

const LEVEL_BY_GRADE = {
    '1': 'SD', '2': 'SD', '3': 'SD', '4': 'SD', '5': 'SD', '6': 'SD',
    '7': 'SMP', '8': 'SMP', '9': 'SMP',
    '10': 'SMA', '11': 'SMA', '12': 'SMA'
};

const UMBRELLA_SMA10 = {
    'Fisika': 'IPA', 'Kimia': 'IPA', 'Biologi': 'IPA',
    'Ekonomi': 'IPS', 'Sosiologi': 'IPS', 'Geografi': 'IPS', 'Sejarah': 'IPS'
};

const normalizeToken = (t) => String(t).toLowerCase().replace(/[.,;:()'"‘’\-–—\u2011]/g, '').replace(/\s+/g, '');

const tokenize = (s) => (s || '').split(/\s+/).filter(Boolean);

const isButirNumber = (num) => {
    const parts = String(num).split('.');
    if (parts.length < 1 || parts.length > 3) return false;
    return parts.every((p) => /^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= 20);
};

const isVerbStart = (tok) => {
    const n = normalizeToken(tok);
    if (n.length < 4) return false;
    return /^(mem|men|meng|meny|mel|mer)/.test(n);
};

function splitButirs(text) {
    const marks = [];
    const re = /(\d+(?:\.\d+){0,2})\.(?=\s+[A-Z0-9(\u3400-\u9FFF])/g;
    let m;
    while ((m = re.exec(text))) {
        if (!isButirNumber(m[1])) continue;
        marks.push({ index: m.index, num: m[1], end: m.index + m[0].length });
    }
    const intro = marks.length ? text.slice(0, marks[0].index).trim() : text.trim();
    const butirs = marks.map((mk, i) => {
        const next = marks[i + 1] ? marks[i + 1].index : text.length;
        return { num: mk.num, raw: text.slice(mk.end, next).trim() };
    });
    return { intro, butirs };
}

function matchElementName(rawTokens, elemenNames) {
    let best = null;
    for (const name of elemenNames || []) {
        const ntok = tokenize(name).map(normalizeToken);
        if (!ntok.length) continue;
        const limit = Math.min(rawTokens.length, ntok.length + 2);
        const head = rawTokens.slice(0, limit);
        let ti = 0;
        let first = -1;
        let last = -1;
        for (let k = 0; k < head.length; k++) {
            if (ti < ntok.length && normalizeToken(head[k]) === ntok[ti]) {
                if (first < 0) first = k;
                last = k;
                ti += 1;
            }
        }
        const strangers = ti === ntok.length ? (last - first + 1 - ntok.length) : 99;
        if (ti === ntok.length && strangers <= 1 && (!best || ntok.length > best.nameTokens)) {
            best = { name, matchEnd: last + 1, nameTokens: ntok.length };
        }
    }
    return best;
}

function walkParenEnd(rawTokens, from) {
    let depth = 0;
    for (let k = from; k < rawTokens.length; k++) {
        const t = rawTokens[k];
        depth += (t.match(/[(（]/g) || []).length - (t.match(/[)）]/g) || []).length;
        if (depth <= 0) return k + 1;
    }
    return from;
}

function detectLabel(rawTokens) {
    const norm = normalizeToken;
    const startsVerb = (i) => isVerbStart(rawTokens[i]);

    let labelEnd = 1;
    let valid = rawTokens.length > 0 && startsVerb(0);
    if (rawTokens[1] && norm(rawTokens[1]) === 'dan' && startsVerb(2)) {
        labelEnd = 3;
        valid = true;
    } else if (rawTokens[1] && /[(（]/.test(rawTokens[1])) {
        labelEnd = walkParenEnd(rawTokens, 1);
        valid = startsVerb(0);
    }
    if (/[(（]/.test(rawTokens[labelEnd] || '')) {
        labelEnd = walkParenEnd(rawTokens, labelEnd);
    }
    if (valid && (labelEnd >= rawTokens.length || startsVerb(labelEnd))) {
        return { label: rawTokens.slice(0, labelEnd).join(' ').replace(/-\s+/g, '-'), bodyStart: labelEnd };
    }

    let verbIdx = rawTokens.length;
    for (let k = 0; k < rawTokens.length; k++) {
        if (startsVerb(k)) {
            verbIdx = k;
            break;
        }
    }
    let labelTokens = rawTokens.slice(0, verbIdx);
    let cut = labelTokens.length;
    for (let k = 0; k < labelTokens.length; k++) {
        if (/^\d+(\.\d+)+\.?$/.test(labelTokens[k]) || norm(labelTokens[k]) === 'subelemen') {
            cut = k;
            break;
        }
    }
    labelTokens = labelTokens.slice(0, cut);
    if (labelTokens.length > 1 && norm(labelTokens[0]) === 'elemen') {
        labelTokens = labelTokens.slice(1);
    }
    if (!labelTokens.length) {
        labelTokens = rawTokens.slice(0, 1);
    }
    return { label: labelTokens.join(' ').replace(/-\s+/g, '-'), bodyStart: verbIdx };
}

function splitAtSentenceBoundaries(text) {
    const res = [];
    let buf = '';
    let i = 0;
    const n = text.length;
    while (i < n) {
        const ch = text[i];
        if (ch === '.' || ch === ';') {
            const rest = text.slice(i + 1);
            const b = rest.match(/^\s+(.)/);
            if (b) {
                const c = b[1];
                const followOk = ch === ';' || (/[A-Z0-9(\u3400-\u9FFF]/.test(c) && c !== ')');
                if (followOk) {
                    res.push(buf.trim());
                    buf = '';
                    i += 1;
                    continue;
                }
            }
        }
        buf += ch;
        i += 1;
    }
    if (buf.trim()) res.push(buf.trim());
    return res.filter((s) => s.length >= 3);
}

function splitBulletsAndClauses(body) {
    let chunks;
    if (body.includes('\u25CF')) {
        chunks = body.split('\u25CF').map((s) => s.trim()).filter((s) => s.length > 0);
    } else {
        chunks = [body.trim()];
    }
    const out = [];
    for (const chunk of chunks) {
        const parts = splitAtSentenceBoundaries(chunk);
        for (const p of parts) out.push(p);
    }
    return out;
}

function cleanClause(clause) {
    let r = clause.replace(/^\s*\d+(?:\.\d+){0,2}\.\s*/, '');
    const toks = tokenize(r);
    if (toks.length && normalizeToken(toks[0]) === 'subelemen') {
        let v = 1;
        while (v < toks.length && v < 10 && !isVerbStart(toks[v])) v += 1;
        if (v < toks.length) r = toks.slice(v).join(' ');
    }
    r = r.replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' ').replace(/^[-–]\s*/, '').replace(/\s*[-–]$/, '').trim();
    return r;
}

function deriveTps(body) {
    const tps = [];
    for (let clause of splitBulletsAndClauses(body)) {
        const clean = cleanClause(clause);
        if (/[:：]\s*$/.test(clean) || /berikut\.?\s*$/.test(clean)) continue;
        if (clean.length >= 20) tps.push(clean);
    }
    return [...new Set(tps)].slice(0, 24);
}

export function buildCpRows(grade, subject, semester) {
    const g = String(grade || '').trim();
    const level = LEVEL_BY_GRADE[g];
    if (!level) return { level: null, grade: g, subject, semesterKey: null, intro: '', rows: [], ok: false };

    const semKey = String(semester || '').toLowerCase();
    let cpSubjectKey = subject;
    if (level === 'SMA' && g === '10' && UMBRELLA_SMA10[subject]) {
        cpSubjectKey = UMBRELLA_SMA10[subject];
    }

    const cpEntry = CP_FULL?.[level]?.[g]?.[cpSubjectKey]?.[semKey];
    const cpFull = cpEntry && typeof cpEntry.cp_full === 'string' ? cpEntry.cp_full : '';

    const semesterData = BSKAP_DATA?.subjects?.[level]?.[g]?.[subject]?.[semKey];
    const elemenNames = (semesterData && Array.isArray(semesterData.elemen) ? semesterData.elemen : []) || [];

    if (!cpFull) {
        return { level, grade: g, subject, semesterKey: semKey, intro: '', rows: [], ok: false };
    }

    const { intro, butirs } = splitButirs(cpFull);

    const elements = [];
    let current = null;
    for (const b of butirs) {
        const segs = String(b.num).split('.');
        const top = segs.length === 1 ? segs[0] : `${segs[0]}.${segs[1]}`;
        if (!current || current.top !== top) {
            current = { top, butirs: [] };
            elements.push(current);
        }
        current.butirs.push(b);
    }

    const rows = [];
    elements.forEach((el, eIdx) => {
        const labelMatch = matchElementName(tokenize(el.butirs[0].raw), elemenNames);
        let label;
        let bodyStart;
        if (labelMatch) {
            label = labelMatch.name;
            bodyStart = labelMatch.matchEnd;
        } else {
            const fb = detectLabel(tokenize(el.butirs[0].raw));
            label = fb.label;
            bodyStart = fb.bodyStart;
        }

        const cpText = el.butirs
            .map((b) => `${b.num}. ${b.raw}`)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        const firstTokens = tokenize(el.butirs[0].raw);
        let body = firstTokens.slice(bodyStart).join(' ');
        for (let bi = 1; bi < el.butirs.length; bi++) {
            body += ' ' + el.butirs[bi].raw;
        }
        body = body.replace(/\s+-\s+/g, ' ').replace(/^-\s+/, '').replace(/\s+-$/, '').replace(/\s+/g, ' ').trim();

        const tps = deriveTps(body);
        const atp = tps.map((_, tIdx) => `${eIdx + 1}.${tIdx + 1}`);

        rows.push({
            no: eIdx + 1,
            elemen: label || '',
            cp: cpText,
            tps,
            atp
        });
    });

    return { level, grade: g, subject, semesterKey: semKey, intro, rows, ok: rows.length > 0 };
}