export const indonesianHolidays = [
    // 2025
    { date: '2025-01-01', name: 'Tahun Baru 2025 Masehi' },
    { date: '2025-01-27', name: 'Isra Mikraj Nabi Muhammad SAW' },
    { date: '2025-01-29', name: 'Tahun Baru Imlek 2576 Kongzili' },
    { date: '2025-03-29', name: 'Hari Suci Nyepi Tahun Baru Saka 1947' },
    { date: '2025-03-31', name: 'Idul Fitri 1446 Hijriah' },
    { date: '2025-04-01', name: 'Idul Fitri 1446 Hijriah' },
    { date: '2025-04-18', name: 'Wafat Yesus Kristus' },
    { date: '2025-04-20', name: 'Kebangkitan Yesus Kristus (Paskah)' },
    { date: '2025-05-01', name: 'Hari Buruh Internasional' },
    { date: '2025-05-12', name: 'Hari Raya Waisak 2569 BE' },
    { date: '2025-05-29', name: 'Kenaikan Yesus Kristus' },
    { date: '2025-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2025-06-06', name: 'Idul Adha 1446 Hijriah' },
    { date: '2025-06-27', name: 'Tahun Baru Islam 1447 Hijriah' },
    { date: '2025-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { date: '2025-09-05', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2025-12-25', name: 'Hari Raya Natal' },

    // 2026 (Estimasi & Fixed)
    { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi' },
    { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW' },
    { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili' },
    { date: '2026-03-19', name: 'Hari Suci Nyepi Tahun Baru Saka 1948' },
    { date: '2026-03-20', name: 'Idul Fitri 1447 Hijriah' },
    { date: '2026-03-21', name: 'Idul Fitri 1447 Hijriah' },
    { date: '2026-04-03', name: 'Wafat Yesus Kristus' },
    { date: '2026-04-05', name: 'Kebangkitan Yesus Kristus (Paskah)' },
    { date: '2026-05-01', name: 'Hari Buruh Internasional' },
    { date: '2026-05-14', name: 'Kenaikan Yesus Kristus' },
    { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE' },
    { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
    { date: '2026-05-27', name: 'Idul Adha 1447 Hijriah' },
    { date: '2026-06-16', name: 'Tahun Baru Islam 1448 Hijriah' },
    { date: '2026-08-17', name: 'Hari Kemerdekaan Republik Indonesia' },
    { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW' },
    { date: '2026-12-25', name: 'Hari Raya Natal' },
];

export const getHolidaysByYear = (year) => {
    return indonesianHolidays.filter(h => h.date.startsWith(String(year)));
};

export const getCategoryLabel = (cat) => {
    const labels = {
        semester_ganjil: 'Libur Semester Ganjil',
        semester_genap: 'Libur Semester Genap',
        tengah_semester: 'Kegiatan Tengah Semester (KTS)',
        ujian: 'Ujian Harian / PTS',
        ujian_semester: 'Ujian Akhir Semester (PAS/PAT)',
        rapat: 'Rapat Dinas/Guru',
        workshop: 'Workshop / IHT',
        studi_tiru: 'Studi Tiru / Outbound',
        class_meeting: 'Class Meeting',
        keagamaan: 'Kegiatan Keagamaan',
        lainnya: 'Kegiatan Lainnya'
    };
    return labels[cat] || cat;
};

export const getCategoryColor = (cat) => {
    const colors = {
        semester_ganjil: 'bg-red-500',
        semester_genap: 'bg-red-500',
        tengah_semester: 'bg-purple-500',
        ujian: 'bg-orange-500',
        ujian_semester: 'bg-orange-500',
        rapat: 'bg-blue-500',
        workshop: 'bg-indigo-500',
        studi_tiru: 'bg-cyan-500',
        class_meeting: 'bg-pink-500',
        keagamaan: 'bg-emerald-500',
        lainnya: 'bg-gray-400'
    };
    return colors[cat] || 'bg-gray-400';
};
