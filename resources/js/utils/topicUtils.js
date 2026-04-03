import moment from 'moment';

/**
 * Resolves the current teaching topic for a schedule based on date, programs, and classes.
 * Logic adapted from JadwalPage.jsx
 */
export const getTopicForSchedule = (schedule, date, programs, classes, activeSemester, academicYear) => {
    // Guard: ensure programs is always a valid array
    const safePrograms = Array.isArray(programs) ? programs : [];
    if (!safePrograms.length) return null;

    const safeStr = (v) => String(v || '').trim().toUpperCase();
    const scheduleRombel = safeStr(typeof schedule.class === 'object' ? schedule.class?.rombel : schedule.class);
    const classInfo = classes.find(c => safeStr(c.rombel) === scheduleRombel);
    const scheduleLevel = classInfo?.level ? safeStr(classInfo.level) : (scheduleRombel?.match(/\d+/)?.[0] || '');

    const normalizedSubject = String(schedule.subject || '').toLowerCase().trim();
    const targetYear = String(academicYear || '').replace(/\s+/g, '').replace('/', '-');

    // TIERED LOOKUP: This avoids "guessing" what the user wants.
    // We strictly search for Rombel first, then Grade Level.

    // 1. Filter all programs matching Subject, Year, and Semester
    const potentialPrograms = safePrograms.filter(p => {
        if (p.type === 'calendar_structure') return false;

        // Subject match (soft)
        const pSub = String(p.subject || '').toLowerCase().trim();
        const sMatch = pSub === normalizedSubject || pSub.includes(normalizedSubject) || normalizedSubject.includes(pSub);
        if (!sMatch) return false;

        // Year & Semester match
        const pYear = String(p.academicYear || '').replace(/\s+/g, '').replace('/', '-');
        const semMatch = p.semester === activeSemester || String(p.id || '').endsWith(`_${activeSemester}`);
        return sMatch && pYear === targetYear && semMatch;
    });

    // 2. Identify Tier 1 (Exact Rombel) and Tier 2 (Exact Grade Level)
    const tier1Programs = potentialPrograms.filter(p => safeStr(p.gradeLevel) === scheduleRombel);
    const tier2Programs = potentialPrograms.filter(p => safeStr(p.gradeLevel) === scheduleLevel);

    // 3. Selection Priority
    let program = null;
    const sortByDate = (a, b) => (new Date(b.updatedAt || 0)) - (new Date(a.updatedAt || 0));

    if (tier1Programs.length > 0) {
        program = tier1Programs.sort(sortByDate)[0];
    } else if (tier2Programs.length > 0) {
        program = tier2Programs.sort(sortByDate)[0];
    }

    if (!program || !program.promes || !program.prota) return null;

    // Resolve Pekan Efektif (Similar tiered logic)
    const potentialCalendars = safePrograms.filter(p => {
        if (p.type !== 'calendar_structure') return false;
        const pYear = String(p.academicYear || '').replace(/\s+/g, '').replace('/', '-');
        const semMatch = p.semester === activeSemester || String(p.id || '').endsWith(`_${activeSemester}`);
        return pYear === targetYear && semMatch;
    });

    const tier1Cal = potentialCalendars.find(p => safeStr(p.gradeLevel) === scheduleRombel);
    const tier2Cal = potentialCalendars.find(p => safeStr(p.gradeLevel) === scheduleLevel);
    const calendar = tier1Cal || tier2Cal || potentialCalendars[0];

    const pekanEfektif = calendar?.pekanEfektif || program.pekanEfektif || [];

    const startMonth = activeSemester === 'Ganjil' ? 6 : 0;
    const dateMoment = moment(date);
    const monthIndex = (dateMoment.month() - startMonth + 12) % 12;

    if (monthIndex < 0 || monthIndex > 5) return null;

    const monthConfig = pekanEfektif[monthIndex];
    const totalWeeksInMonth = monthConfig?.totalWeeks || 4;

    // Stable Week Index: Strictly follows the visual grid in Promes (Day 1-7 = P1, etc.)
    const weekIndex = Math.min(Math.floor((dateMoment.date() - 1) / 7), totalWeeksInMonth - 1);

    const activeTopics = [];
    const protaRows = Array.isArray(program.prota) ? program.prota : [];

    protaRows.forEach(row => {
        const key = `${row.id}_${monthIndex}_${weekIndex}`;
        const val = program.promes[key];
        if (val !== undefined && val !== null && val !== '' && val !== 0 && val !== '0' && val !== false && val !== 'false') {
            // Only show material (materi), not KD/learning objectives to keep it concise
            const label = row.materi || '(Materi Kosong)';
            activeTopics.push(label);
        }
    });

    return activeTopics.length > 0 ? activeTopics.join(', ') : null;
};
