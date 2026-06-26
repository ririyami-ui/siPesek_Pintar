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

    // Stable Week Index: Use ISO week iteration, same as PekanEfektifView
    const schoolDaysCount = 6; // default, will match saved pekan_efektif arrangement
    const threshold = schoolDaysCount === 5 ? 3 : 4;

    // Build list of ISO week start dates for this month that have enough school days
    const monthStart = dateMoment.clone().startOf('month');
    const monthEnd = dateMoment.clone().endOf('month');
    let validWeeks = [];
    let isoWeekStart = monthStart.clone().startOf('isoWeek');
    while (isoWeekStart.isBefore(monthEnd)) {
        const isoWeekEnd = isoWeekStart.clone().endOf('isoWeek');

        // Count school days in this week within this month
        let schoolDaysInMonth = 0;
        let dayIter = isoWeekStart.clone();
        while (dayIter.isSameOrBefore(isoWeekEnd)) {
            if (dayIter.month() === monthStart.month()) {
                const d = dayIter.day();
                if (schoolDaysCount === 5) {
                    if (d >= 1 && d <= 5) schoolDaysInMonth++;
                } else {
                    if (d >= 1 && d <= 6) schoolDaysInMonth++;
                }
            }
            dayIter.add(1, 'day');
        }

        if (schoolDaysInMonth >= threshold) {
            validWeeks.push(isoWeekStart.clone());
        }
        isoWeekStart.add(1, 'week');
    }

    // Find which valid week this date falls in
    let weekIndex = -1;
    for (let i = 0; i < validWeeks.length; i++) {
        const ws = validWeeks[i];
        const we = ws.clone().endOf('isoWeek');
        if (dateMoment.isSameOrAfter(ws) && dateMoment.isSameOrBefore(we)) {
            weekIndex = i;
            break;
        }
    }

    // Clamp to valid range
    const clampedIndex = Math.min(Math.max(weekIndex, 0), totalWeeksInMonth - 1);

    const activeTopics = [];
    const protaRows = Array.isArray(program.prota) ? program.prota : [];

    protaRows.forEach(row => {
        const key = `${row.id}_${monthIndex}_${clampedIndex}`;
        const val = program.promes[key];
        if (val !== undefined && val !== null && val !== '' && val !== 0 && val !== '0' && val !== false && val !== 'false') {
            // Only show material (materi), not KD/learning objectives to keep it concise
            const label = row.materi || '(Materi Kosong)';
            activeTopics.push(label);
        }
    });

    return activeTopics.length > 0 ? activeTopics.join(', ') : null;
};
