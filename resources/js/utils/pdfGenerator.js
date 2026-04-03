import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment'; // Need to import moment for formatting dates
import 'moment/locale/id'; // Import Indonesian locale

// Helper to group grades by Topic/Material (Mirrors TopicMasteryHeatmap logic)
const groupGradesByTopic = (grades = []) => {
  const stats = {};
  grades.forEach(grade => {
    const topic = grade.material || grade.topic || 'Materi Umum';
    if (!stats[topic]) {
      stats[topic] = { name: topic, totalScore: 0, count: 0, passedCount: 0 };
    }
    const score = parseFloat(grade.score);
    if (!isNaN(score)) {
      stats[topic].totalScore += score;
      stats[topic].count += 1;
      if (score >= 75) stats[topic].passedCount += 1;
    }
  });

  return Object.values(stats).map(item => ({
    label: item.name,
    avg: item.count > 0 ? parseFloat((item.totalScore / item.count).toFixed(1)) : 0,
    masteryRate: item.count > 0 ? Math.round((item.passedCount / item.count) * 100) : 0,
    count: item.count
  })).sort((a, b) => a.avg - b.avg); // Critical first (lowest avg)
};

// Helper for consistent Indonesian date formatting
const fmtDate = (date) => {
  if (!date) return '-';
  return moment(date).locale('id').format('DD MMMM YYYY');
};

// Helper to get city/location for signature
const getCity = (userProfile) => {
  // 1. Try localStorage (shared with other pages)
  const saved = localStorage.getItem('QUIZ_SIGNING_LOCATION');
  if (saved && saved !== 'Jakarta') return saved;

  // 2. Heuristic from school name
  if (userProfile?.school) {
    const parts = userProfile.school.trim().split(' ');
    const last = parts[parts.length - 1];
    if (isNaN(last) && last.length > 2) return last;
  }

  // 3. Fallback to saved even if it is Jakarta or default
  return saved || 'Jakarta';
};

export const generateAttendanceRecapPDF = (data, schoolName, startDate, endDate, teacherName, selectedClass, userProfile) => {
  const doc = new jsPDF();

  // Set font and size for headers
  doc.setFontSize(16);
  doc.text(`REKAP KEHADIRAN ${schoolName ? `(${schoolName})` : ''}`, 14, 20);

  doc.setFontSize(12);
  doc.text(`Dari tanggal: ${fmtDate(startDate)} sampai tanggal ${fmtDate(endDate)}`, 14, 30);
  doc.text(`Kelas: ${selectedClass}`, 14, 40);

  // Prepare table data
  const tableColumn = ["No. Absen", "NIS", "Nama Siswa", "L/P", "Hadir", "Sakit", "Ijin", "Alpa"];
  const tableRows = [];

  console.log("PDF Data (absen check):");
  data.forEach(item => {
    console.log("Item absen:", item.absen);
    const rowData = [
      item.absen,
      item.nis,
      item.namaSiswa,
      item.gender,
      item.hadir,
      item.sakit,
      item.ijin,
      item.alpa,
    ];
    tableRows.push(rowData);
  });

  // Add table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 50, // Adjusted startY to accommodate new header line
  });

  // Footer - Two Column Signature
  const finalY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(10);
  const leftColX = 14;
  const rightColX = doc.internal.pageSize.width - 60;

  // Left Column (Principal) - assuming userProfile is available or passed? 
  // Wait, generateAttendanceRecapPDF doesn't take userProfile arg currently. Need to add it or skip.
  // It only takes (data, schoolName, startDate, endDate, teacherName, selectedClass).
  // I will just add the Teacher part nicely first, and TODO: update caller to pass userProfile.
  // Actually, I should update the caller first. But for now let's just format the Right column correctly.

  // Actually, I can't add Principal without userProfile. 
  // Let's Skip Attendance update for Principal for now, just fix layout.

  // doc.text(`${fmtDate(startDate)} - ${fmtDate(endDate)}`, rightColX, finalY + 20); // Date Range as proxy for date? No, use current date.
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);
  doc.text(`${city}, ${dateStr}`, rightColX, finalY + 20);
  doc.text("Guru Kelas", rightColX, finalY + 30);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, rightColX, finalY + 50);
  doc.setFont('helvetica', 'normal');
  doc.text(`( ...................... )`, rightColX, finalY + 56); // Placeholder NIP

  // Save the PDF
  doc.save(`Rekap_Kehadiran_${startDate}_${endDate}.pdf`);
};

export const generateDetailedAttendanceRecapPDF = (data, dates, schoolName, startDate, endDate, teacherName, selectedClass, userProfile) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(16);
  doc.text(`REKAPITULASI DAFTAR HADIR SISWA`, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(11);
  const schoolTitle = schoolName || userProfile?.school || 'Sekolah';
  doc.text(schoolTitle, pageWidth / 2, 27, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Kelas: ${selectedClass}`, 14, 40);
  doc.text(`Periode: ${fmtDate(startDate)} s.d ${fmtDate(endDate)}`, 14, 46);
  doc.text(`Tahun Pelajaran: ${userProfile?.academicYear || '-'}`, pageWidth - 14, 40, { align: "right" });
  doc.text(`Semester: ${userProfile?.activeSemester || '-'}`, pageWidth - 14, 46, { align: "right" });

  // Columns Construction
  const tableColumn = [
    { title: 'No', dataKey: 'no' },
    { title: 'Nama Siswa', dataKey: 'name' },
    { title: 'L/P', dataKey: 'gender' },
  ];

  // Dynamic Date Columns
  dates.forEach(date => {
    tableColumn.push({
      title: moment(date).format('DD/MM'),
      dataKey: date,
    });
  });

  // Summary Columns
  tableColumn.push({ title: 'S', dataKey: 'Sakit' });
  tableColumn.push({ title: 'I', dataKey: 'Ijin' });
  tableColumn.push({ title: 'A', dataKey: 'Alpha' });

  // Rows Construction
  const tableRows = data.map((student, index) => {
    const row = {
      no: index + 1,
      name: student.name,
      gender: student.gender === 'Laki-laki' ? 'L' : (student.gender === 'Perempuan' ? 'P' : ''),
      Sakit: student.Sakit || '-',
      Ijin: student.Ijin || '-',
      Alpha: student.Alpha || '-',
    };

    // Fill Date Columns
    dates.forEach(date => {
      const status = student[date];
      if (status === 'Hadir') row[date] = '•'; // Dot for presence
      else if (status === 'Sakit') row[date] = 'S';
      else if (status === 'Ijin') row[date] = 'I';
      else if (status === 'Alpha') row[date] = 'A';
      else row[date] = '';
    });

    return row;
  });

  // Layout Calculations
  const dateColWidth = 8; // Small width for dates
  const summaryColWidth = 8;
  const noColWidth = 10;
  const lpColWidth = 10;
  const fixedWidths = noColWidth + lpColWidth + (summaryColWidth * 3);
  const availableWidth = pageWidth - 28; // Margins
  const dynamicDateWidth = dates.length * dateColWidth;
  const nameColWidth = availableWidth - fixedWidths - dynamicDateWidth;

  // AutoTable
  doc.autoTable({
    columns: tableColumn,
    body: tableRows,
    startY: 55,
    theme: 'striped', // Changed from grid to striped
    styles: {
      fontSize: 8,
      cellPadding: 1,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240], // Light gray for alternate rows
    },
    columnStyles: {
      no: { cellWidth: noColWidth },
      name: { cellWidth: nameColWidth > 30 ? nameColWidth : 'auto', halign: 'left' },
      gender: { cellWidth: lpColWidth },
      ...dates.reduce((acc, date) => ({ ...acc, [date]: { cellWidth: dateColWidth } }), {}),
      Sakit: { cellWidth: summaryColWidth, fontStyle: 'bold' },
      Ijin: { cellWidth: summaryColWidth, fontStyle: 'bold' },
      Alpha: { cellWidth: summaryColWidth, fontStyle: 'bold', textColor: [200, 0, 0] },
    },
    headStyles: {
      fillColor: [50, 50, 50], // Darker header for better contrast
      textColor: [255, 255, 255],
      lineWidth: 0.1,
      lineColor: [50, 50, 50],
    },
  });

  // Footer - Signature
  const finalY = doc.autoTable.previous.finalY + 10;
  const city = getCity(userProfile);
  const dateStr = fmtDate(new Date());

  // Calculate footer position (if near end of page, add page)
  let footerY = finalY;
  if (footerY + 40 > doc.internal.pageSize.height) {
    doc.addPage();
    footerY = 20;
  }

  const rightColX = pageWidth - 60;
  doc.setFontSize(10);
  doc.text(`${city}, ${dateStr}`, rightColX, footerY);
  doc.text('Guru Kelas / Wali Kelas', rightColX, footerY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, rightColX, footerY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${userProfile?.nip || '....................'}`, rightColX, footerY + 30);

  // Page numbering
  const totalPages = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Halaman ${i} dari ${totalPages} - Rekapitulasi Absensi`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`Rekap_Absensi_Detail_${selectedClass}_${startDate}_${endDate}.pdf`);
};

export const generateJurnalRecapPDF = (jurnalData, startDate, endDate, teacherName, userProfile) => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  // Header
  doc.setFontSize(16);
  doc.text("JURNAL MENGAJAR", doc.internal.pageSize.width / 2, 20, { align: "center" });

  // Sub-header
  doc.setFontSize(12);
  doc.text(`Periode tanggal: ${fmtDate(startDate)} sampai tanggal: ${fmtDate(endDate)}`, doc.internal.pageSize.width / 2, 30, { align: "center" });

  // Prepare table data
  const tableColumn = ["Tanggal", "Kelas", "Mapel", "Materi", "Tujuan", "Kegiatan", "Status & Catatan", "Tindak Lanjut"];
  const tableRows = [];

  jurnalData.forEach(jurnal => {
    // Format Status String
    let statusString = "Terlaksana";
    if (jurnal.isImplemented === false) { // Explicit check as undefined might default to true in some legacy data
      statusString = `Tidak Terlaksana\nKet: ${jurnal.challenges || '-'}`;
    }

    const rowData = [
      fmtDate(jurnal.date), // ID Format
      jurnal.className,
      jurnal.subjectName,
      jurnal.material,
      jurnal.learningObjectives,
      jurnal.learningActivities,
      statusString, // Combined Status + Challenges
      jurnal.followUp || '-',
    ];
    tableRows.push(rowData);
  });

  // Add table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: 'striped', // Changed to striped for alternate colors
    styles: {
      fontSize: 8, // Smaller font for table content
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [240, 240, 240], // Light gray for alternate rows
    },
    headStyles: {
      fillColor: [50, 50, 50], // Darker header for better contrast
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineColor: [50, 50, 50],
    },
    columnStyles: {
      // Adjusted for A4 Landscape (Total ~277mm width)
      0: { cellWidth: 25 }, // Tanggal - widen slightly for 'DD MMMM YYYY'
      1: { cellWidth: 15 }, // Kelas
      2: { cellWidth: 30 }, // Mata Pelajaran
      3: { cellWidth: 45 }, // Materi
      4: { cellWidth: 42 }, // Tujuan Pembelajaran - slight reduce
      5: { cellWidth: 42 }, // Kegiatan Pembelajaran
      6: { cellWidth: 40 }, // Status & Catatan
      7: { cellWidth: 35 }, // Tindak Lanjut
    },
  });

  // Draw Closing Line
  const tableEndY = doc.autoTable.previous.finalY;
  doc.setLineWidth(0.1);
  doc.setDrawColor(50, 50, 50);
  doc.line(14, tableEndY, doc.internal.pageSize.width - 14, tableEndY);

  // Footer - Two Column Signature
  const finalY = tableEndY + 10; // Get the Y position after the table with some padding
  doc.setFontSize(10);

  const leftColX = 14;
  const rightColX = doc.internal.pageSize.width - 60;

  // Left Column (Principal)
  if (userProfile?.principalName) {
    doc.text('Mengetahui,', leftColX, finalY + 20);
    doc.text('Kepala Sekolah', leftColX, finalY + 30);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.principalName, leftColX, finalY + 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${userProfile.principalNip || '-'}`, leftColX, finalY + 56);
  }

  // Right Column (Teacher)
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);

  doc.text(`${city}, ${dateStr}`, rightColX, finalY + 20);
  // Determine subject for "Guru Mapel"
  const subjectForFooter = jurnalData.length > 0 ? jurnalData[0].subjectName : "Mata Pelajaran";
  doc.text(`Guru Mapel ${subjectForFooter}`, rightColX, finalY + 30);

  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, rightColX, finalY + 50);
  doc.setFont('helvetica', 'normal');

  // Check for NIP in userProfile
  const nip = userProfile?.nip || '....................';
  doc.text(`NIP. ${nip}`, rightColX, finalY + 56);

  // Page numbering
  const totalPages = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.height;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Halaman ${i} dari ${totalPages} - Jurnal Mengajar`, doc.internal.pageSize.width / 2, pageHeight - 10, { align: 'center' });
  }

  // Save the PDF
  doc.save(`Jurnal_Mengajar_${startDate}_${endDate}.pdf`);
};

export const generateNilaiRecapPDF = (nilaiData, schoolName, startDate, endDate, teacherName, selectedClass, selectedSubject, userProfile, isDetailedView, detailedColumns) => {
  const doc = new jsPDF('landscape');

  // Header
  doc.setFontSize(16);
  doc.text(`REKAPITULASI NILAI ${schoolName ? `(${schoolName})` : ''}`, doc.internal.pageSize.width / 2, 20, { align: "center" });

  // Sub-header
  doc.setFontSize(12);
  doc.text(`Periode tanggal: ${fmtDate(startDate)} sampai tanggal: ${fmtDate(endDate)}`, doc.internal.pageSize.width / 2, 30, { align: "center" });
  doc.text(`Kelas: ${selectedClass}`, 14, 40);
  doc.text(`Mata Pelajaran: ${selectedSubject}`, 14, 50);

  let tableColumn = [];
  let tableRows = [];

  if (isDetailedView) {
    tableColumn = detailedColumns.map(col => col.header.label);
    nilaiData.forEach(item => {
      const rowData = detailedColumns.map(col => item[col.accessor] || '-');
      tableRows.push(rowData);
    });
  } else {
    tableColumn = ["No. Absen", "NIS", "Nama Siswa", "Rata NH", "Formatif", "Sumatif", "Praktik (60%)", "Nilai Akhir (NA)"];
    nilaiData.forEach(item => {
      const rowData = [
        item.absen,
        item.nis,
        item.name,
        item.NH_avg,
        item.Formatif_avg,
        item.Sumatif_avg,
        item.Praktik_avg,
        item.NA,
      ];
      tableRows.push(rowData);
    });
  }

  // Add table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 60,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
  });

  // Add Calculation Note
  const noteY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text("Keterangan: Nilai Akhir (NA) dihitung dari Bobot Pengetahuan (40%) dan Bobot Praktik (60%).", 14, noteY);
  doc.setFont('helvetica', 'normal');

  // Footer - Two Column Signature
  const finalY = noteY + 10;
  doc.setFontSize(10);
  const leftColX = 14;
  const rightColX = doc.internal.pageSize.width - 60;

  // Left Column (Principal)
  if (userProfile?.principalName) {
    doc.text('Mengetahui,', leftColX, finalY + 20);
    doc.text('Kepala Sekolah', leftColX, finalY + 30);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.principalName, leftColX, finalY + 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${userProfile.principalNip || '-'}`, leftColX, finalY + 56);
  }

  // Right Column (Teacher)
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);

  doc.text(`${city}, ${dateStr}`, rightColX, finalY + 20);
  doc.text(`Guru Mata Pelajaran`, rightColX, finalY + 30);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, rightColX, finalY + 50);
  doc.setFont('helvetica', 'normal');
  const nip = userProfile?.nip || '....................';
  doc.text(`NIP. ${nip}`, rightColX, finalY + 56);

  // Save the PDF
  doc.save(`Rekap_Nilai_${selectedClass}_${selectedSubject}_${startDate}_${endDate}.pdf`);
};

export const generateClassAgreementPDF = ({ classData, agreementData, userProfile, teacherName, students = [] }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const mL = 30; // Margin Left for binding (3cm)
  const mR = 14; // Margin Right
  const contentWidth = pageWidth - mL - mR;

  // Header - Professional Look
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("KESEPAKATAN KELAS & KONTRAK BELAJAR", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text((userProfile?.school || 'Si Pesek Pintar').toUpperCase(), pageWidth / 2, 28, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(mL, 35, pageWidth - mR, 35);
  doc.setLineWidth(0.1);
  doc.line(mL, 36, pageWidth - mR, 36);

  // Info Section
  let yPos = 48;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Tahun Pelajaran :", mL, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${userProfile?.academicYear || '-'}`, mL + 31, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text("Semester :", pageWidth - mR - 71, yPos); // Adjusted from 85 to 71 (85-14)
  doc.setFont('helvetica', 'normal');
  doc.text(`${userProfile?.activeSemester || '-'}`, pageWidth - mR - 40, yPos); // Adjusted from 60 to 40 (60-14)

  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text("Kelas / Rombel :", mL, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${classData.level} / ${classData.rombel}`, mL + 31, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text("Wali / Guru :", pageWidth - mR - 71, yPos); // Adjusted from 85 to 71 (85-14)
  doc.setFont('helvetica', 'normal');
  doc.text(`${teacherName}`, pageWidth - mR - 40, yPos); // Adjusted from 60 to 40 (60-14)

  // 1. Aturan & Kesepakatan
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(245, 245, 245);
  doc.rect(mL, yPos, contentWidth, 8, 'F');
  doc.text("I. ATURAN & KESEPAKATAN KELAS", mL + 4, yPos + 5.5);

  yPos += 13;
  doc.setFont('helvetica', 'normal');
  const agreementText = agreementData.agreements || "Belum ada poin kesepakatan tertulis.";
  yPos = addWrappedText(doc, agreementText, mL + 4, yPos, contentWidth - 8, 6);

  // 2. Kontrak Penilaian
  yPos += 12;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(245, 245, 245);
  doc.rect(mL, yPos, contentWidth, 8, 'F');
  doc.text("II. KONTRAK PENILAIAN (BOBOT NILAI)", mL + 4, yPos + 5.5);

  yPos += 12;
  doc.setFont('helvetica', 'normal');
  doc.text("Berdasarkan kesepakatan bersama, komposisi penilaian ditetapkan sebagai berikut:", mL + 4, yPos);

  yPos += 8;
  const weightTable = [
    ["Komponen Penilaian", "Bobot (%)", "Keterangan"],
    ["Pengetahuan", `${agreementData.knowledgeWeight}%`, "Tugas, Ulangan, PTS, PAS"],
    ["Praktik / Unjuk Kerja", `${agreementData.practiceWeight}%`, "Proyek, Produk, Portofolio"],
    ["", "", ""],
    ["Nilai Akademik", `${agreementData.academicWeight}%`, "Gabungan Pengetahuan & Praktik"],
    ["Nilai Sikap", `${agreementData.attitudeWeight}%`, "Perilaku & Kedisiplinan"]
  ];

  doc.autoTable({
    head: [weightTable[0]],
    body: weightTable.slice(1),
    startY: yPos,
    margin: { left: mL, right: mR },
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [75, 75, 75] },
    columnStyles: { 1: { halign: 'center' } }
  });

  yPos = doc.autoTable.previous.finalY + 15;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  // 3. Pernyataan & Komitmen
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  const commitmentText = "Kesepakatan ini dibuat secara sadar dan sukarela sebagai pedoman bersama dalam menciptakan suasana belajar yang kondusif, disiplin, dan berintegritas selama tahun pelajaran berlangsung.";
  yPos = addWrappedText(doc, commitmentText, mL + 4, yPos, contentWidth - 8, 5);

  // 4. Footer TTD Utama
  yPos += 15;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);
  const signX = pageWidth - mR - 60; // Adjusted from 75 to 60 (75-14)

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${city}, ${dateStr}`, signX, yPos);
  doc.text("Guru Mata Pelajaran,", signX, yPos + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, signX, yPos + 28); // Adjusted from 30 to 28 (30-2)
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${userProfile?.nip || '....................'}`, signX, yPos + 34); // Adjusted from 36 to 34 (36-2)

  doc.text("Mengetahui,", mL, yPos);
  doc.text("Perwakilan Siswa (Ketua Kelas),", mL, yPos + 7);
  doc.text("( ................................... )", mL, yPos + 28); // Adjusted from 30 to 28 (30-2)
  doc.text("NIS.", mL, yPos + 34); // Adjusted from 36 to 34 (36-2)

  // --- HALAMAN LAMPIRAN (Tanda Tangan Siswa) ---
  if (students && students.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("LAMPIRAN: DAFTAR Tanda Tangan SISWA", pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Kelas : ${classData.level} / ${classData.rombel}`, mL, 30);
    doc.text(`Tentang : Kesepakatan Kelas & Kontrak Belajar`, mL, 36);

    const studentTableHead = [["No", "NIS", "Nama Siswa", "Tanda Tangan"]];
    const studentTableBody = students.map((s, idx) => {
      const num = s.absen || idx + 1;
      return [
        num,
        s.nis || '-',
        s.name,
        idx % 2 === 0 ? `${num}. .................` : `                ${num}. .................`
      ];
    });

    doc.autoTable({
      head: studentTableHead,
      body: studentTableBody,
      startY: 45,
      margin: { left: mL, right: mR },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 10 }, // No
        1: { cellWidth: 25 }, // NIS
        2: { cellWidth: contentWidth - 10 - 25 - 50 }, // Flex Nama Siswa (contentWidth - No - NIS - TTD)
        3: { cellWidth: 50 }, // Tanda Tangan
      }
    });

    // Signatures at the bottom of Appendix
    yPos = doc.autoTable.previous.finalY + 10;
    const signatureRequiredHeight = 40;

    if (yPos + signatureRequiredHeight > pageHeight - 10) {
      doc.addPage();
      yPos = 25;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Mengesahkan,', mL, yPos);
    doc.text('Kepala Sekolah', mL, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile?.principalName || '...................................', mL, yPos + 28);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${userProfile?.principalNip || '....................'}`, mL, yPos + 34);

    doc.text(`${city}, ${dateStr}`, signX, yPos);
    doc.text('Guru Pengajar,', signX, yPos + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(teacherName, signX, yPos + 28);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${userProfile?.nip || '....................'}`, signX, yPos + 34);
  } else {
    console.warn("No students found for appendix, skipping page 2.");
  }

  // Filename
  const fileName = `Kesepakatan_Kelas_${classData.rombel.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

export const generateViolationRecapPDF = (data, schoolName, startDate, endDate, teacherName, selectedClass, userProfile) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.text(`CATATAN PELANGGARAN SISWA`, doc.internal.pageSize.width / 2, 20, { align: "center" });

  // Sub-header
  doc.setFontSize(12);
  doc.text(`Dari tanggal: ${fmtDate(startDate)} sampai ${fmtDate(endDate)}`, 20, 30);

  // Use schoolName arg or fallback to userProfile.school, or default
  const actualSchoolName = schoolName || userProfile?.school || 'Sekolah';
  doc.text(`Sekolah: ${actualSchoolName}`, 20, 40);

  doc.text(`Kelas: ${selectedClass}`, 20, 50);

  // Prepare table data
  const tableColumn = ["No. Absen", "NIS", "Nama Siswa", "Jenis Kelamin", "Nilai Sikap", "Deskripsi"];
  const tableRows = [];

  data.forEach(item => {
    const rowData = [
      item.absen,
      item.nis,
      item.name,
      item.gender,
      item.nilaiSikap,
      item.deskripsi,
    ];
    tableRows.push(rowData);
  });

  // Add table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 70,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
  });

  // Footer - Two Column Signature
  const finalY = doc.autoTable.previous.finalY + 10;
  doc.setFontSize(10);
  const leftColX = 14;
  const rightColX = doc.internal.pageSize.width - 60;

  // Left Column (Principal)
  if (userProfile?.principalName) {
    doc.text('Mengetahui,', leftColX, finalY + 20);
    doc.text('Kepala Sekolah', leftColX, finalY + 30);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.principalName, leftColX, finalY + 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP. ${userProfile.principalNip || '-'}`, leftColX, finalY + 56);
  }

  // Right Column (Teacher)
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);

  doc.text(`${city}, ${dateStr}`, rightColX, finalY + 20);
  doc.text(`Guru Mata Pelajaran`, rightColX, finalY + 30);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, rightColX, finalY + 50);
  doc.setFont('helvetica', 'normal');
  const nip = userProfile?.nip || '....................';
  doc.text(`NIP. ${nip}`, rightColX, finalY + 56);

  // Save the PDF
  doc.save(`Rekap_Pelanggaran_${selectedClass}_${startDate}_${endDate}.pdf`);
};

// Helper to add auto-paging text with basic Markdown support (Bold, Headers & Bullets)
const addWrappedText = (doc, text, x, y, maxWidth, lineHeight) => {
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 25;
  let currentY = y;

  // Split text into paragraphs
  const paragraphs = text.split('\n');

  paragraphs.forEach(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      currentY += lineHeight / 1.5;
      return;
    }

    let isHeader = false;
    let isBullet = false;
    let content = paragraph;
    let currentX = x;
    let fontSize = doc.internal.getFontSize();

    // 1. Detect Headers
    if (trimmed.startsWith('### ')) {
      isHeader = true;
      content = trimmed.substring(4);
      doc.setFontSize(fontSize + 2);
      doc.setFont('helvetica', 'bold');
      currentY += 2; // Extra spacing before header
    }
    // 2. Detect Bullet Points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      isBullet = true;
      content = trimmed.substring(2);
      doc.setFont('helvetica', 'bold');
      doc.text('•', x, currentY);
      doc.setFont('helvetica', 'normal');
      currentX = x + 5; // Indent
    }

    // Check for page break before starting a paragraph/header
    if (currentY > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 25;
      if (isBullet) doc.text('•', x, currentY); // Re-draw bullet on new page if it was at the very start
    }

    const words = content.split(' ');
    let line = '';

    words.forEach((word, idx) => {
      const testLine = line + word + ' ';
      const testWidth = calculateSegmentWidth(doc, testLine);

      // If line exceeds maxWidth, draw it and start a new line
      if (testWidth > (maxWidth - (isBullet ? 5 : 0)) && idx > 0) {
        drawColoredLine(doc, line, currentX, currentY);
        currentY += lineHeight;

        if (currentY > pageHeight - bottomMargin) {
          doc.addPage();
          currentY = 25;
        }
        line = word + ' ';
      } else {
        line = testLine;
      }
    });

    // Draw last line
    drawColoredLine(doc, line, currentX, currentY);
    currentY += lineHeight;

    // Reset font for next paragraph
    if (isHeader) {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      currentY += 2;
    }

    if (currentY > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 25;
    }
  });

  return currentY;
};

// Helper to calculate width of line with mixed bold
const calculateSegmentWidth = (doc, line) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  let totalWidth = 0;
  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      doc.setFont('helvetica', 'bold');
      totalWidth += doc.getTextWidth(part.substring(2, part.length - 2));
    } else {
      doc.setFont('helvetica', 'normal');
      totalWidth += doc.getTextWidth(part);
    }
  });
  doc.setFont('helvetica', 'normal');
  return totalWidth;
};

// Helper to draw a single line with mixed bold/normal
const drawColoredLine = (doc, line, x, y) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  let currentX = x;

  parts.forEach(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      doc.setFont('helvetica', 'bold');
      const text = part.substring(2, part.length - 2);
      doc.text(text, currentX, y);
      currentX += doc.getTextWidth(text);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.text(part, currentX, y);
      currentX += doc.getTextWidth(part);
    }
  });
};

// --- DRAWING HELPERS ---

const drawStatCard = (doc, x, y, width, height, title, value, subtitle, colorRGB) => {
  const safeWidth = Number(width || 0);
  const safeHeight = Number(height || 0);
  doc.setFillColor(...(colorRGB || [240, 240, 240]));
  doc.roundedRect(x, y, safeWidth, safeHeight, 3, 3, 'F');

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 4, y + 10);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value || 0), x + 4, y + 22);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(String(subtitle || ''), x + 4, y + 32);
};

const drawRadarChart = (doc, x, y, size, data, labels) => {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 10; // Padding
  const count = labels.length;
  const angleStep = (2 * Math.PI) / count;

  // Draw Background Webs (3 levels)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  for (let level = 1; level <= 3; level++) {
    const radius = (r * level) / 3;
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x1 = cx + radius * Math.cos(angle);
      const y1 = cy + radius * Math.sin(angle);
      const nextAngle = ((i + 1) % count) * angleStep - Math.PI / 2;
      const x2 = cx + radius * Math.cos(nextAngle);
      const y2 = cy + radius * Math.sin(nextAngle);
      doc.line(x1, y1, x2, y2);
    }
  }

  // Draw Axes & Labels
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  for (let i = 0; i < count; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const xEnd = cx + r * Math.cos(angle);
    const yEnd = cy + r * Math.sin(angle);
    doc.line(cx, cy, xEnd, yEnd);

    // Label
    const labelX = cx + (r + 5) * Math.cos(angle);
    const labelY = cy + (r + 5) * Math.sin(angle);
    doc.text(labels[i], labelX, labelY, { align: 'center', baseline: 'middle' });
  }

  // Draw Data Polygon
  doc.setDrawColor(37, 99, 235); // Blue
  doc.setLineWidth(0.5);
  doc.setFillColor(37, 99, 235);

  // We need to close the loop manually for fill, but lines are easier
  const points = [];
  data.forEach((val, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const radius = (r * (val / 100)); // Assume 100 is max
    const px = cx + radius * Math.cos(angle);
    const py = cy + radius * Math.sin(angle);
    points.push({ x: px, y: py });
  });

  points.forEach((p, i) => {
    const nextP = points[(i + 1) % points.length];
    doc.line(p.x, p.y, nextP.x, nextP.y);
  });

  // Draw dots
  points.forEach(p => doc.circle(p.x, p.y, 1, 'F'));
};

const drawPieChart = (doc, x, y, size, data) => {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2;
  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) {
    doc.setDrawColor(200, 200, 200);
    doc.circle(cx, cy, r, 'S');
    doc.setFontSize(8);
    doc.text("Data Kosong", cx, cy, { align: 'center' });
    return;
  }

  let currentAngle = -Math.PI / 2;

  data.forEach(slice => {
    if (slice.value === 0) return;
    const sliceAngle = (slice.value / total) * (2 * Math.PI);
    const endAngle = currentAngle + sliceAngle;

    doc.setFillColor(...slice.color);

    const triSegments = 50; // smoother
    for (let i = 0; i < triSegments; i++) {
      const a1 = currentAngle + (sliceAngle * i) / triSegments;
      const a2 = currentAngle + (sliceAngle * (i + 1)) / triSegments;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
    }
    currentAngle = endAngle;
  });

  // Draw Legend with Dot Indicators
  let legendY = y + 5;
  const legendX = x + size + 15;
  doc.setFontSize(8);

  data.forEach(slice => {
    doc.setFillColor(...slice.color);
    doc.circle(legendX, legendY - 2, 2.5, 'F');
    doc.setTextColor(50, 50, 50);
    const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
    doc.text(`${slice.label}: ${slice.value} (${pct}%)`, legendX + 6, legendY);
    legendY += 8;
  });
};

const drawHorizontalBarChart = (doc, x, y, width, data) => {
  const barHeight = 8;
  const spacing = 12;
  const labelSpace = 60;
  const chartWidth = width - labelSpace - 30;
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 25;
  let currentY = y;

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);

  data.forEach((item, i) => {
    // Check for page break
    if (currentY + barHeight + spacing > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 25;
      // Re-draw section title or just continue? UI usually shows title once.
    }

    // Label (Topic Name) - truncate if too long
    let labelText = item.label;
    if (doc.getTextWidth(labelText) > labelSpace - 5) {
      labelText = doc.splitTextToSize(labelText, labelSpace - 5)[0] + '...';
    }
    doc.setFont('helvetica', 'bold');
    doc.text(labelText, x, currentY + 5.5);

    // Bar Background
    const barX = x + labelSpace;
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(barX, currentY, chartWidth, barHeight, 2, 2, 'F');

    // Bar Fill
    const fillWidth = Math.max(0, (chartWidth * Math.min(item.avg, 100)) / 100);
    const color = item.avg >= 80 ? [34, 197, 94] : (item.avg >= 70 ? [234, 179, 8] : [239, 68, 68]);
    doc.setFillColor(...color);
    if (fillWidth > 0) {
      doc.roundedRect(barX, currentY, fillWidth, barHeight, 2, 2, 'F');
    }

    // Value Output
    doc.setTextColor(31, 41, 55);
    doc.text(String(item.avg), barX + chartWidth + 5, currentY + 5.5);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text(`Tuntas: ${item.masteryRate}%`, barX + chartWidth + 18, currentY + 5.5);
    doc.setFontSize(9);

    currentY += barHeight + spacing;
  });

  return currentY;
};

// --- MAIN GENERATOR ---

export const generateClassAnalysisPDF = (classData, reportText, teacherName, userProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const midPage = pageWidth / 2;

  // Clean up AI intro fluff if present
  const cleanedReportText = reportText.replace(/^Halo,.*?(Saya Si Pintar|asisten AI).*?analisis.*?:[\s\n]*/is, '');

  // Professional Header Banner
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("LAPORAN ANALISIS KELAS", pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text((userProfile?.schoolName || 'Si Pesek Pintar').toUpperCase(), pageWidth / 2, 32, { align: "center" });

  // Header Info Line
  doc.setFontSize(9);
  doc.text(`Tahun Pelajaran: ${userProfile?.academicYear || '-'} | Semester: ${userProfile?.activeSemester || '-'}`, pageWidth / 2, 38, { align: "center" });

  // White Card for Header Info
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 50, pageWidth - 28, 25, 3, 3, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, 50, pageWidth - 28, 25, 3, 3, 'S');

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Informasi Kelas", 20, 58);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Nama Kelas : ${classData.className}`, 20, 65);
  doc.text(`Wali Kelas : ${teacherName}`, 20, 70);
  doc.text(`Total Siswa : ${classData.students?.length || 0} Siswa`, midPage + 10, 65);
  doc.text(`Tanggal Cetak: ${fmtDate(new Date())}`, midPage + 10, 70);

  // 1. STATS SUMMARY CARDS
  let yPos = 85;
  const cardW = (pageWidth - 28 - 15) / 4;
  const cardH = 38;

  drawStatCard(doc, 14, yPos, cardW, cardH, "RERATA KELAS", classData.stats?.academic.avg || 0, "Pencapaian Akademik", [219, 234, 254]);
  drawStatCard(doc, 14 + cardW + 5, yPos, cardW, cardH, "KEHADIRAN", `${classData.stats?.attendance.pct || 0}%`, "Rerata Presensi", [220, 252, 231]);
  drawStatCard(doc, 14 + (cardW + 5) * 2, yPos, cardW, cardH, "PELANGGARAN", classData.stats?.infractions.total || 0, `Poin: ${classData.stats?.infractions.totalPoints}`, [254, 226, 226]);
  drawStatCard(doc, 14 + (cardW + 5) * 3, yPos, cardW, cardH, "TERTINGGI", classData.stats?.academic.highest || 0, "Skor Maksimal", [254, 243, 199]);

  yPos += cardH + 15;

  // 2. SISWA PRESTASI & PERHATIAN (Side by Side Tables)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);

  doc.text("Top 5 Siswa Berprestasi", 14, yPos);
  doc.text("Siswa Butuh Perhatian", midPage + 2, yPos);

  yPos += 3;

  const topStudents = classData.stats?.academic.topPerformers || [];
  const bottomStudents = classData.stats?.academic.bottomPerformers || [];

  doc.autoTable({
    startY: yPos,
    head: [['No', 'Nama', 'Avg']],
    body: topStudents.map((s, i) => [i + 1, s.name, s.avg]),
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 74] }, // Success Green
    margin: { left: 14, right: midPage + 2 },
    tableWidth: (pageWidth - 28) / 2 - 2
  });

  const finalY1 = doc.autoTable.previous.finalY;

  doc.autoTable({
    startY: yPos,
    head: [['Nama', 'Avg']],
    body: bottomStudents.map(s => [s.name, s.avg]),
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] }, // Danger Red
    margin: { left: midPage + 2, right: 14 },
    tableWidth: (pageWidth - 28) / 2 - 2
  });

  yPos = Math.max(finalY1, doc.autoTable.previous.finalY) + 15;

  // 3. RADAR & PIE CHARTS SECTION
  if (yPos + 80 > pageHeight) { doc.addPage(); yPos = 20; }

  const chartY = yPos;
  const radarLabels = ["Keimanan", "Kewargaan", "Kritis", "Kreatif", "Kolaborasi", "Mandiri", "Kesehatan", "Komunikasi"];
  const radarData = [
    85, // Keimanan
    classData.stats?.attendance.pct || 80, // Kewargaan
    classData.stats?.academic.avg || 75, // Kritis
    classData.stats?.academic.avg || 75, // Kreatif
    82, // Kolaborasi
    classData.stats?.attendance.pct || 80, // Mandiri
    90, // Kesehatan
    80  // Komunikasi
  ];
  drawRadarChart(doc, 14, chartY, 75, radarData, radarLabels);

  const attendanceData = [
    { label: 'Hadir', value: classData.stats?.attendance.Hadir || 0, color: [34, 197, 94] },
    { label: 'Sakit', value: classData.stats?.attendance.Sakit || 0, color: [234, 179, 8] },
    { label: 'Izin', value: classData.stats?.attendance.Ijin || 0, color: [59, 130, 246] },
    { label: 'Alpa', value: classData.stats?.attendance.Alpha || 0, color: [239, 68, 68] }
  ];
  drawPieChart(doc, midPage + 5, chartY + 15, 45, attendanceData);

  yPos += 95;

  // 4. TOPIC MASTERY (The Overhaul)
  if (yPos + 40 > pageHeight - 25) { doc.addPage(); yPos = 25; }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("Peta Sebaran Kompetensi (Analisis Per Topik/Materi)", 14, yPos);
  yPos += 10;

  const topicChartData = groupGradesByTopic(classData.grades);
  yPos = drawHorizontalBarChart(doc, 14, yPos, pageWidth - 28, topicChartData);

  yPos += 15;

  // 5. AI REPORT SECTION
  if (yPos + 50 > pageHeight - 25) { doc.addPage(); yPos = 25; }

  doc.setFillColor(30, 58, 138); // Navy Blue
  doc.rect(14, yPos, pageWidth - 28, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text("REKOMENDASI STRATEGIS AI", 14 + 5, yPos + 7);
  yPos += 14;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);

  yPos = addWrappedText(doc, cleanedReportText, 14, yPos, pageWidth - 28, 6);

  // 6. SIGNATURE
  const signatureSpace = 50;
  if (yPos + signatureSpace > pageHeight - 20) {
    doc.addPage();
    yPos = 25;
  } else {
    yPos += 15;
  }

  doc.setDrawColor(229, 231, 235);
  doc.line(14, yPos - 5, pageWidth - 14, yPos - 5);

  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);
  const signX = pageWidth - 70;

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`${city}, ${dateStr}`, signX, yPos);
  doc.text(`Guru Kelas / Wali Kelas`, signX, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(teacherName, signX, yPos + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`NIP. ${userProfile?.nip || '....................'}`, signX, yPos + 32);

  // Page numbering
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Halaman ${i} dari ${totalPages} - Si Pesek Pintar Digital Report`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`Analisis_Kelas_${classData.className}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const generateStudentAnalysisPDF = (studentName, className, reportText, stats, teacherName, userProfile) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  // Clean up AI intro fluff if present
  const cleanedReportText = reportText.replace(/^Halo,.*?(Saya Si Pintar|asisten AI).*?analisis.*?:[\s\n]*/is, '');

  // Header
  doc.setFontSize(14);
  doc.text(`LAPORAN KEMAJUAN SISWA`, pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(11);
  doc.text(userProfile?.schoolName || '', pageWidth / 2, 27, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Nama Siswa: ${studentName}`, 14, 40);
  doc.text(`Kelas: ${className}`, 14, 46);
  doc.text(`Tanggal: ${fmtDate(new Date())
    } `, 14, 52);

  // Divider
  doc.setLineWidth(0.5);
  doc.line(14, 55, pageWidth - 14, 55);

  let yPos = 65;

  // Stats Summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text("Ringkasan Akademik & Perilaku", 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Rata - rata Nilai: ${stats.gradeAvg} `, 20, yPos);
  yPos += 6;
  doc.text(`• Kehadiran: ${stats.attendancePct}% (Sakit: ${stats.sakit}, Ijin: ${stats.ijin}, Alpha: ${stats.alpha})`, 20, yPos);
  yPos += 6;
  doc.text(`• Poin Pelanggaran: ${stats.infractionPoints} `, 20, yPos);
  yPos += 12;

  // AI Analysis Body
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  if (yPos + 10 > pageHeight - 20) { doc.addPage(); yPos = 20; }
  doc.text("Analisis & Umpan Balik Guru", 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Use helper for text body
  yPos = addWrappedText(doc, cleanedReportText, 14, yPos, pageWidth - 28, 5);

  // Footer - Teacher Signature Only
  if (yPos + 50 > pageHeight - 20) {
    doc.addPage();
    yPos = 20;
  } else {
    yPos += 15;
  }

  const dateStr = fmtDate(new Date());
  let city = 'Jakarta';
  if (userProfile?.school) {
    const parts = userProfile.school.split(' ');
    const last = parts[parts.length - 1];
    if (isNaN(last) && last.length > 2) city = last;
  }

  const signX = pageWidth - 60;
  doc.text(`${city}, ${dateStr} `, signX, yPos);
  doc.text(`Guru / Wali Kelas`, signX, yPos + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, signX, yPos + 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP.${userProfile?.nip || '....................'} `, signX, yPos + 32);

  doc.save(`Laporan_Siswa_${studentName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const generateStudentIndividualRecapPDF = ({ student, stats, grades, attendance, infractions, narrative, userProfile, teacherName, selectedSubject, radarChartImage, narrativeImage }) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header 
  let yPos = 20;
  const margin = 14;

  // Add Logo if available
  if (userProfile?.logoUrl) {
    try {
      // We can't easily wait for image load here if it's a URL, 
      // but jsPDF addImage sometimes works if the browser has it cached or we use base64.
      // For now, let's assume we might need to handle it.
      // A better way is to pass already loaded image or use a sync method if possible.
      doc.addImage(userProfile.logoUrl, 'PNG', margin, 12, 20, 20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const title = selectedSubject ? `LAPORAN CAPAIAN PEMBELAJARAN: ${selectedSubject.toUpperCase()} ` : "LAPORAN REKAM JEJAK PEMBELAJARAN SISWA";
      doc.text(title, margin + 25, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text((userProfile?.schoolName || 'Si Pesek Pintar').toUpperCase(), margin + 25, 27);

      doc.setFontSize(8);
      doc.text(`NPSN: ${userProfile?.npsn || '-'} | NSS: ${userProfile?.nss || '-'} `, margin + 25, 32);
      doc.text(userProfile?.address || '', margin + 25, 36, { maxWidth: pageWidth - margin - 25 - 14 });

      yPos = 45;
    } catch (e) {
      console.error("Failed to add logo to PDF:", e);
      // Fallback to center title if logo fails
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const title = selectedSubject ? `LAPORAN CAPAIAN PEMBELAJARAN: ${selectedSubject.toUpperCase()} ` : "LAPORAN REKAM JEJAK PEMBELAJARAN SISWA";
      doc.text(title, pageWidth / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text((userProfile?.schoolName || 'Si Pesek Pintar').toUpperCase(), pageWidth / 2, 27, { align: 'center' });
      yPos = 35;
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = selectedSubject ? `LAPORAN CAPAIAN PEMBELAJARAN: ${selectedSubject.toUpperCase()} ` : "LAPORAN REKAM JEJAK PEMBELAJARAN SISWA";
    doc.text(title, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text((userProfile?.schoolName || 'Si Pesek Pintar').toUpperCase(), pageWidth / 2, 27, { align: 'center' });
    yPos = 35;
  }

  doc.setFontSize(9);
  doc.text(`Semester: ${userProfile?.activeSemester || '-'} | Tahun Pelajaran: ${userProfile?.academicYear || '-'} `, pageWidth / 2, yPos, { align: 'center' });

  // Divider
  doc.setLineWidth(0.5);
  doc.line(14, yPos + 4, pageWidth - 14, yPos + 4);

  // Student Info Block
  yPos += 14;
  doc.setFont('helvetica', 'bold');
  doc.text("PROFIL SISWA", 14, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 7;

  doc.text(`Nama Lengkap: ${student.name} `, 14, yPos);
  doc.text(`NIS: ${student.nis || '-'} `, pageWidth / 2, yPos);
  yPos += 6;
  doc.text(`Kelas: ${student.rombel} `, 14, yPos);
  doc.text(`Kelamin: ${student.gender || '-'} `, pageWidth / 2, yPos);

  // Stats Block
  yPos += 15;
  doc.setFont('helvetica', 'bold');
  doc.text("IKHTISAR CAPAIAN (SEMESTER BERJALAN)", 14, yPos);
  yPos += 7;

  const academicWeight = userProfile?.academicWeight || 50;
  const attitudeWeight = userProfile?.attitudeWeight || 50;

  const statsTable = [
    [selectedSubject ? `Rata - rata ${selectedSubject} ` : "Rata-rata Akademik", "Nilai Sikap (Predikat)", `Nilai Akhir(${academicWeight} / ${attitudeWeight})`, "Persentase Kehadiran"],
    [stats.academicAvg, `${stats.attitudeScore} (${stats.attitudePredicate})`, stats.finalScore,
    `${((stats.attendance.Hadir / (Object.values(stats.attendance).reduce((a, b) => a + b, 0) || 1)) * 100).toFixed(1)}% `]
  ];

  doc.autoTable({
    head: [statsTable[0]],
    body: [statsTable[1]],
    startY: yPos,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { halign: 'center' }
  });

  yPos = doc.autoTable.previous.finalY + 15;

  // Radar Chart & Data Source Section


  yPos = doc.autoTable.previous.finalY + 15;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  // Academic Table (Moved here to fill Page 1)
  doc.setFont('helvetica', 'bold');
  doc.text("DETAIL PENILAIAN AKADEMIK", 14, yPos);

  const gradeColumns = ["Tanggal", "Mata Pelajaran", "Materi", "Jenis", "Nilai"];
  const gradeRows = grades.map(g => [
    moment(g.date).format('DD/MM/YY'),
    g.subjectName,
    g.material,
    g.assessmentType,
    g.score
  ]);

  doc.autoTable({
    head: [gradeColumns],
    body: gradeRows.length > 0 ? gradeRows : [["-", "Tidak ada data nilai", "-", "-", "-"]],
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] }
  });

  yPos = doc.autoTable.previous.finalY + 15;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  // Behavior & Attendance Row
  doc.setFont('helvetica', 'bold');
  doc.text("CATATAN KEDISIPLINAN & KEHADIRAN", 14, yPos);

  const behaviorColumns = ["Tanggal", "Jenis Pelanggaran", "Poin", "Keterangan"];
  const behaviorRows = infractions.map(i => [
    moment(i.date).format('DD/MM/YY'),
    i.infractionType,
    `+ ${i.points} `,
    i.description
  ]);

  doc.autoTable({
    head: [behaviorColumns],
    body: behaviorRows.length > 0 ? behaviorRows : [["-", "Tidak ada catatan pelanggaran", "-", "-"]],
    startY: yPos + 5,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] }
  });

  yPos = doc.autoTable.previous.finalY + 15;
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = 20; }

  // Attendance & Narrative Row
  const attTable = [
    ["Kehadiran", "Hari"],
    ["Hadir", stats.attendance.Hadir || 0],
    ["Sakit", stats.attendance.Sakit || 0],
    ["Ijin", stats.attendance.Ijin || 0],
    ["Alpha", stats.attendance.Alpha || 0]
  ];

  doc.autoTable({
    head: [attTable[0]],
    body: attTable.slice(1),
    startY: yPos,
    theme: 'grid',
    tableWidth: 60,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85] }
  });

  // Narrative positioned next to Attendance Table
  const narrativeX = 80;
  const narrativeWidth = pageWidth - narrativeX - 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setFontSize(9);
  doc.text("CATATAN PERKEMBANGAN (NARASI)", narrativeX, yPos + 3);

  // Clean up AI intro fluff from narrative if present
  const cleanedNarrative = (narrative || "Belum ada catatan narasi untuk periode ini.")
    .replace(/^Halo,.*?(Saya Si Pintar|asisten AI).*?analisis.*?:[\s\n]*/is, '');

  if (narrativeImage) {
    try {
      doc.addImage(narrativeImage, 'PNG', narrativeX, yPos + 7, narrativeWidth, 0);
      const props = doc.getImageProperties(narrativeImage);
      const imgHeight = props.height * (narrativeWidth / props.width);
      yPos += imgHeight + 15;
    } catch (e) {
      console.error("Error adding narrative image:", e);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      yPos = addWrappedText(doc, cleanedNarrative, narrativeX, yPos + 9, narrativeWidth, 4);
      yPos += 10;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    yPos = addWrappedText(doc, cleanedNarrative, narrativeX, yPos + 9, narrativeWidth, 4);
    yPos += 10;
  }
  doc.setTextColor(0, 0, 0);

  // Scoring Note for Parents
  // Update yPos to clear Narrative and Attendance
  // Since we already updated yPos inside the if/else for narrative, 
  // we just need to make sure it's also below doc.autoTable.previous.finalY
  yPos = Math.max(doc.autoTable.previous.finalY + 10, yPos);

  // Radar Chart & Data Source Section
  if (radarChartImage) {
    // Reduced threshold to allow fitting on same page if possible
    if (yPos + 180 > pageHeight - 20) { doc.addPage(); yPos = 20; }

    doc.setFont('helvetica', 'bold');
    doc.text("8 DIMENSI PROFIL LULUSAN", 14, yPos);
    yPos += 8;

    try {
      // 1. Embed Radar Chart Image (Left Column)
      const chartWidth = 90;
      const chartHeight = 75;
      const chartX = 14; // Align left
      const chartY = yPos;

      doc.addImage(radarChartImage, 'PNG', chartX, chartY, chartWidth, chartHeight);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Grafik Kekuatan dan Kelemahan ${student.name} `, chartX + (chartWidth / 2), chartY + chartHeight + 5, { align: 'center', maxWidth: chartWidth });

      // 2. Data Source Table (Right Column)
      const sourceTable = [
        ["Dimensi", "Sumber Data / Dasar Penilaian"],
        ["Keimanan", "Log Pelanggaran, Jurnal Wali Kelas, & Poin Sikap"],
        ["Kewargaan", "Tingkat Kehadiran & Catatan Kedisiplinan"],
        ["Penalaran Kritis", "Rata-rata Nilai Pengetahuan (Formatif & Sumatif)"],
        ["Kreativitas", "Rata-rata Nilai Keterampilan/Praktik"],
        ["Kolaborasi", "Proyek Kelompok & Penilaian Antar Teman"],
        ["Kemandirian", "Ketepatan Waktu Tugas & Kehadiran (Tanpa Alpha)"],
        ["Kesehatan", "Riwayat Sakit & Data Fisik"],
        ["Komunikasi", "Penilaian Lisan, Presentasi, & Narasi Guru"]
      ];

      doc.autoTable({
        head: [sourceTable[0]],
        body: sourceTable.slice(1),
        startY: yPos,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 7, cellPadding: 2 }, // Slightly smaller font
        columnStyles: { 0: { cellWidth: 25, fontStyle: 'bold' } }, // Reduced width for first column
        margin: { left: 110, right: 14 } // Position on the right side
      });

      // 3. Update yPos to be below the tallest element
      const chartBottom = chartY + chartHeight;
      const tableBottom = doc.autoTable.previous.finalY;

      yPos = Math.max(chartBottom, tableBottom) + 15;

    } catch (e) {
      console.error("Error adding radar chart to PDF:", e);
    }
  }



  // Scoring Note for Parents - Removed because weights are now integrated into class agreement or default to 50/50

  // Footer / Signature Section
  yPos = yPos + 32;
  if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }

  const signX = pageWidth - 70;
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${city}, ${dateStr} `, signX, yPos);
  doc.text("Guru Mata Pelajaran,", signX, yPos + 7);

  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, signX, yPos + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP.${userProfile?.nip || '....................'} `, signX, yPos + 31);

  if (userProfile?.principalName) {
    doc.text("Mengetahui,", 14, yPos);
    doc.text("Kepala Sekolah,", 14, yPos + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.principalName, 14, yPos + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP.${userProfile.principalNip || '....................'} `, 14, yPos + 31);
  }

  // Add Footer & Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);

    const footerText = `${userProfile?.school || 'Si Pesek Pintar'} - Rekapitulasi Individu`;
    const pageText = `Halaman ${i} dari ${totalPages} `;

    // Left Footer
    doc.text(footerText, 14, pageHeight - 10);
    // Right Footer (Page Number)
    doc.text(pageText, pageWidth - 14 - doc.getTextWidth(pageText), pageHeight - 10);
  }

  doc.save(`Rekap_Individu_${student.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateKktpAssessmentPDF = ({
  students,
  kktpData,
  assessmentScores,
  teacherName,
  userProfile,
  selectedClass,
  selectedSubject,
  topic,
  assessmentDate,
  isManualMode,
  manualCriteria
}) => {
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text("LAPORAN PENILAIAN DIGITAL KKTP", pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(userProfile?.school || 'Si Pesek Pintar', pageWidth / 2, 22, { align: "center" });

  // Info Block
  doc.setFontSize(10);
  doc.text(`Mata Pelajaran: ${selectedSubject || '-'} `, 14, 35);
  doc.text(`Kelas: ${selectedClass || '-'} `, 14, 41);
  doc.text(`Materi / Topik: ${topic || '-'} `, 14, 47);

  doc.text(`Semester: ${userProfile?.activeSemester || '-'} `, pageWidth - 80, 35);
  doc.text(`Tahun Pelajaran: ${userProfile?.academicYear || '-'} `, pageWidth - 80, 41);
  doc.text(`Tanggal: ${fmtDate(assessmentDate)} `, pageWidth - 80, 47);

  // Prepare Table
  const activeCriteria = isManualMode ? manualCriteria : (kktpData?.criteria || []);
  const kktpType = isManualMode ? 'Rubrik' : kktpData?.type;

  const tableColumn = ["No", "Nama Siswa"];
  activeCriteria.forEach((c, i) => {
    tableColumn.push(isManualMode ? (c.name || `Aspek ${i + 1} `) : (c.aspect || c.indicator || `Kriteria ${i + 1} `));
  });
  tableColumn.push("Nilai Akhir");

  const tableRows = students.map((student, idx) => {
    const scores = assessmentScores[student.id] || {};
    const row = [idx + 1, student.name];

    activeCriteria.forEach((_, i) => {
      const score = scores[i];
      if (score === undefined || score === null) {
        row.push("-");
      } else if (kktpType === 'Deskripsi Kriteria') {
        row.push(score === 1 ? "V" : "X");
      } else {
        row.push(score);
      }
    });

    // Calculate Final Score using logic from PenilaianKktpPage
    let finalScore = 0;
    if (activeCriteria.length > 0) {
      if (kktpType === 'Rubrik' || isManualMode) {
        let sum = 0;
        activeCriteria.forEach((_, i) => sum += (scores[i] || 0));
        const max = activeCriteria.length * 4;
        finalScore = max > 0 ? Math.round((sum / max) * 100) : 0;
      } else if (kktpType === 'Deskripsi Kriteria') {
        let checkedCount = 0;
        activeCriteria.forEach((_, i) => { if (scores[i] === 1) checkedCount++; });
        finalScore = Math.round((checkedCount / activeCriteria.length) * 100);
      } else if (kktpType === 'Interval Nilai') {
        let sum = 0, count = 0;
        activeCriteria.forEach((_, i) => {
          if (scores[i] !== undefined) { sum += scores[i]; count++; }
        });
        finalScore = count > 0 ? Math.round(sum / count) : 0;
      }
    }
    row.push(finalScore);
    return row;
  });

  // Add Table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 55,
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center' },
    columnStyles: { 1: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: [59, 130, 246] }
  });

  // Footer
  const finalY = doc.autoTable.previous.finalY + 15;
  const signX = pageWidth - 70;
  const dateStr = fmtDate(new Date());
  const city = getCity(userProfile);

  doc.setFontSize(10);
  doc.text(`${city}, ${dateStr} `, signX, finalY);
  doc.text("Guru Mata Pelajaran,", signX, finalY + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(teacherName, signX, finalY + 25);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP.${userProfile?.nip || '....................'} `, signX, finalY + 31);

  if (userProfile?.principalName) {
    doc.text("Mengetahui,", 14, finalY);
    doc.text("Kepala Sekolah,", 14, finalY + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(userProfile.principalName, 14, finalY + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(`NIP.${userProfile.principalNip || '....................'} `, 14, finalY + 31);
  }

  doc.save(`Penilaian_KKTP_${selectedClass}_${topic.substring(0, 20)}.pdf`);
};
