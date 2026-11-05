import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Tetap impor untuk memastikan autoTable ada, meskipun tidak dipakai langsung di sini
import moment from 'moment';
import 'moment/locale/id';

const fmtDate = (date) => moment(date).locale('id').format('D MMMM YYYY');
const getCity = (userProfile) => userProfile?.city || userProfile?.kota || 'Kota';

export const generateKartuKendaliPdf = (students, tasks, submissions, selectedClass, selectedSubject, activeSemester, academicYear, userProfile, schoolName, selectedClassName, selectedSubjectName) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10; // 1cm margin
    const cardWidth = (pageWidth - 3 * margin) / 2; // 2 cards per row
    const cardHeight = 60; // Dihitung agar muat 4 baris kartu per halaman

    const debtorStudents = students.filter(s => tasks.filter(t => !submissions[t.id]?.includes(String(s.id))).length > 0);

    let currentPageStudents = [];
    let studentsAdded = 0;
    let pageIndex = 0; // Deklarasi pageIndex
    
    debtorStudents.forEach((student, studentIndex) => {
        currentPageStudents.push(student);
        studentsAdded++;

        // Jika sudah 8 siswa di halaman saat ini, atau ini siswa terakhir
        if (studentsAdded % 8 === 0 || studentIndex === debtorStudents.length - 1) {
            // Tambah halaman hanya jika ini BUKAN halaman pertama
            if (pageIndex > 0) { // Perbaikan: hanya tambah halaman jika bukan halaman pertama
                doc.addPage();
            }
            
            let currentX = margin;
            let currentY = margin;
            const cardsInRow = 2;

            currentPageStudents.forEach((s, idx) => {
                if (idx > 0 && idx % cardsInRow === 0) { // Move to next row
                    currentX = margin;
                    currentY += cardHeight + margin;
                }

                const cardStartX = currentX;
                const cardStartY = currentY;

                const pendingTasks = tasks.filter(t => !submissions[t.id]?.includes(String(s.id)));
                
                // Dynamic card height based on number of pending tasks
                let dynamicCardHeight = cardHeight;
                if (pendingTasks.length > 5) {
                    // Increase height for more tasks (approximately 3mm per extra task beyond 5)
                    const extraTasks = pendingTasks.length - 5;
                    dynamicCardHeight += extraTasks * 3;
                }

                // Card border
                doc.rect(cardStartX, cardStartY, cardWidth, dynamicCardHeight, 'S');

                // Watermark
                doc.setFontSize(20);
                doc.setTextColor(0, 0, 0, 0.03); // Very light grey
                doc.text('SI PESEK PINTAR', cardStartX + cardWidth / 2, cardStartY + dynamicCardHeight / 2, { align: 'center', angle: -30 });
                doc.setTextColor(0, 0, 0); // Reset text color

                // Header
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text('KARTU KENDALI TUGAS', cardStartX + 2, cardStartY + 4);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text(`${s.name}`, cardStartX + 2, cardStartY + 8);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(`${selectedSubjectName} | ${selectedClassName} | ${activeSemester}`, cardStartX + 2, cardStartY + 11);

                // Absen
                doc.rect(cardStartX + cardWidth - 10, cardStartY + 2, 8, 8, 'S');
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text(`${s.absen || '-'}`, cardStartX + cardWidth - 10 + 4, cardStartY + 6, { align: 'center' });

                // Daftar Tanggungan
                doc.setFontSize(7);
                doc.setFont('helvetica', 'bold');
                doc.text('DAFTAR TANGGUNGAN:', cardStartX + 2, cardStartY + 16);

                let taskY = cardStartY + 19;
                pendingTasks.slice(0, 5).forEach((task, tIdx) => {
                    doc.rect(cardStartX + 3, taskY, 2.5, 2.5, 'S'); // Checkbox
                    doc.setFont('helvetica', 'normal');
                    doc.text(`${tIdx + 1}. ${task.title}`, cardStartX + 6.5, taskY + 2);
                    taskY += 4;
                });
                if (pendingTasks.length > 5) {
                    doc.setFont('helvetica', 'italic');
                    doc.text(`+ ${pendingTasks.length - 5} lainnya...`, cardStartX + 6.5, taskY + 2);
                }

                // Tanda Tangan
                const signatureY = cardStartY + dynamicCardHeight - 20;
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.text('Guru Mapel:', cardStartX + 5, signatureY);
                doc.text('Ortu / Wali:', cardStartX + cardWidth - 25, signatureY);
                doc.line(cardStartX + 5, signatureY + 10, cardStartX + 25, signatureY + 10); // Guru line
                doc.line(cardStartX + cardWidth - 25, signatureY + 10, cardStartX + cardWidth - 5, signatureY + 10); // Ortu line
                
                doc.setFont('helvetica', 'italic');
                doc.text('Bukti kendali pengumpulan tugas mandiri siswa.', cardStartX + cardWidth / 2, cardStartY + dynamicCardHeight - 3, { align: 'center' });

                currentX += cardWidth + margin; // Move to next card position
            });
            currentPageStudents = []; // Reset for next page
            pageIndex++; // Increment pageIndex
        }
    });

    doc.save(`Kartu_Kendali_Tugas_${academicYear}_${activeSemester}.pdf`);
};
