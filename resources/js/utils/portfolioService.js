import api from '../lib/axios';

export const generatePortfolioChapter = async (chapterId, context, userProfile, subject, existingChapters) => {
    // context.semester dan context.tahunAjaran berasal dari gatherContext atau fallback manual
    const semester = (context?.semester || 'Genap');
    const academicYear = (context?.tahunAjaran || context?.academicYear || '2025/2026');

    // Validasi format semester: Ganjil/Genap
    const validSemesters = ['Ganjil', 'Genap'];
    const formattedSemester = semester
        ? semester.charAt(0).toUpperCase() + semester.slice(1).toLowerCase()
        : 'Genap';
    const isValidSemester = validSemesters.includes(formattedSemester);
    const safeSemester = isValidSemester ? formattedSemester : 'Genap';

    const res = await api.post('/portfolios/generate', {
        academic_year: academicYear,
        semester: safeSemester,
        chapter_id: chapterId,
        context,
        user: userProfile,
        subject,
        existing_chapters: existingChapters
    });

    return res.data.content;
};
