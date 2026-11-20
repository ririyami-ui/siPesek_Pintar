import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Format status kehadiran untuk matriks
 */
const formatStatus = (status) => {
    if (!status) return '';
    if (status.toLowerCase() === 'hadir') return '•'; // Titik hitam/bullet untuk hadir
    if (status.toLowerCase() === 'sakit') return 'S';
    if (status.toLowerCase() === 'ijin' || status.toLowerCase() === 'izin') return 'I';
    if (status.toLowerCase() === 'alpha' || status.toLowerCase() === 'alpa') return 'A';
    return '';
};

/**
 * Ekspor matriks kehadiran ke format Excel
 */
export const exportAttendanceMatrixExcel = (attendanceData, dates, meta) => {
    const wsData = [];

    // 1. Kop Surat (teks biasa, tanpa merge)
    wsData.push([meta.schoolName || 'Sekolah Pintar']);
    if (meta.subjectName) wsData.push([`Mata Pelajaran: ${meta.subjectName}`]);
    wsData.push([`Tahun Ajaran: ${meta.academicYear || '-'}`]);
    wsData.push([`Kelas: ${meta.className || '-'}`]);
    if (meta.period) wsData.push([`Periode: ${meta.period}`]);
    wsData.push([]); // Baris kosong

    // 2. Header datar satu baris (tanpa merge)
    const header = ['No', 'NISN', 'NAMA SISWA'];
    dates.forEach(dateStr => {
        const dateObj = new Date(dateStr);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        header.push(`${day}/${month}/${year}`);
    });
    if (dates.length === 0) header.push('Tanggal');
    header.push('Hadir', 'Sakit', 'Izin', 'Alpha');

    wsData.push(header);

    // 3. Isi Data
    attendanceData.forEach((studentData, index) => {
        const row = [
            index + 1,
            studentData.nis || studentData.nisn || '-',
            studentData.name || studentData.namaSiswa || 'Unknown'
        ];

        if (dates.length > 0) {
            dates.forEach(date => {
                row.push(formatStatus(studentData[date]));
            });
        } else {
            row.push('-');
        }

        row.push(studentData.Hadir || 0);
        row.push(studentData.Sakit || 0);
        row.push(studentData.Izin || studentData.Ijin || 0);
        row.push(studentData.Alpha || 0);

        wsData.push(row);
    });

    // 4. Worksheet & Column Widths (tanpa merge)
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [
        { wch: 5 },  // No
        { wch: 15 }, // NISN
        { wch: 30 }, // NAMA
    ];
    dates.forEach(() => colWidths.push({ wch: 11 })); // Tanggal DD/MM/YYYY
    if (dates.length === 0) colWidths.push({ wch: 11 });
    colWidths.push({ wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }); // Hadir Sakit Izin Alpha
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Kehadiran");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
    saveAs(dataBlob, meta.fileName || 'Rekap_Kehadiran.xlsx');
};


/**
 * Ekspor matriks kehadiran ke format PDF menggunakan jsPDF dan autoTable
 */
export const exportAttendanceMatrixPDF = (attendanceData, dates, meta) => {
    // Gunakan orientasi landscape sesuai format unduh PDF kehadiran
    const doc = jsPDF('landscape', 'mm', 'a4');
    
    // 1. Kop Surat
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.schoolName || 'Sekolah Pintar', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let currentY = 22; // Mulai dari baris kedua kop
    if (meta.subjectName) {
        doc.text(`Mata Pelajaran : ${meta.subjectName}`, 14, currentY);
        currentY += 6;
    }
    doc.text(`Tahun Ajaran   : ${meta.academicYear || '-'}` , 14, currentY);
    currentY += 6;
    doc.text(`Kelas                : ${meta.className || '-'}`       , 14, currentY);
    if (meta.period) {
        currentY += 6;
        doc.text(`Periode            : ${meta.period}`, 14, currentY);
    }
    
    // 2. Persiapan Data Tabel
    const numDates = Math.max(1, dates.length);
    
    // Baris Header Bertingkat untuk jspdf-autotable
    const head = [
        [
            { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7, fontStyle: 'bold' } },
            { content: 'NISN', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7, fontStyle: 'bold' } },
            { content: 'NAMA SISWA', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 7, fontStyle: 'bold' } },
            { content: 'TANGGAL', colSpan: numDates, styles: { halign: 'center', fontSize: 7, fontStyle: 'bold' } },
            { content: 'Absen', colSpan: 4, styles: { halign: 'center', fontSize: 7, fontStyle: 'bold' } }
        ],
        [
            // Baris kedua (Tanggal format DD/MM dan H,S,I,A)
            ...(dates.length > 0 ? dates.map(d => {
                const dateObj = new Date(d);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                return `${day}/${month}`;
            }) : ['-']),
            'H', 'S', 'I', 'A'
        ]
    ];

    const body = attendanceData.map((studentData, index) => {
        const row = [
            (index + 1).toString(),
            studentData.nis || studentData.nisn || '-',
            studentData.name || studentData.namaSiswa || 'Unknown'
        ];

        if (dates.length > 0) {
            dates.forEach(date => {
                row.push(formatStatus(studentData[date]));
            });
        } else {
            row.push('-');
        }

        row.push((studentData.Hadir || 0).toString());
        row.push((studentData.Sakit || 0).toString());
        row.push((studentData.Izin || studentData.Ijin || 0).toString());
        row.push((studentData.Alpha || 0).toString());
        
        return row;
    });

    // 3. Render Tabel
    doc.autoTable({
        startY: currentY + 5, // Mulai tabel sedikit di bawah kop
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 12 }, // No
            1: { cellWidth: 28 },                  // NISN
            // Kolom Nama Siswa akan diatur di didParseCell
        },
        styles: {
            halign: 'center', // Default align center untuk tanggal & absen
            valign: 'middle', // Vertikal tengah
        },
        didParseCell: function(data) {
            const pageWidth = doc.internal.pageSize.width; // Deklarasi ulang
            const margin = 10; // Deklarasi ulang
            const numDates = Math.max(1, dates.length); // Deklarasi ulang

            // Kolom Nama (index 2) rata kiri
            if (data.section === 'body' && data.column.index === 2) {
                data.cell.styles.halign = 'left';
            }

            // Set width for date columns
            if (data.column.index >= 3 && data.column.index < (numDates + 3)) { // Kolom Tanggal
                data.cell.styles.cellWidth = 7; // Lebar tetap untuk tanggal (DD/MM)
            }
            // Set width for attendance summary columns (H,S,I,A)
            if (data.column.index >= (numDates + 3)) { // Kolom Absen
                data.cell.styles.cellWidth = 7; // Lebar tetap untuk H,S,I,A
            }

            // Kolom NAMA SISWA (index 2) mengisi sisa ruang secara otomatis
            if (data.column.index === 2) {
                // Lebar kolom tetap: No(12) + NISN(28) + Tanggal(N*7) + Absen(4*7)
                const fixedWidths = (12 + 28) + (numDates * 7) + (4 * 7);
                const availableWidth = pageWidth - (margin * 2) - fixedWidths;
                data.cell.styles.cellWidth = availableWidth > 0 ? availableWidth : 50; // Minimum 50mm
            }
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245] // Abu-abu muda
        },
        // minCellHeight: 8, // Atur tinggi baris minimum jika perlu
    });

    // Tambahkan Tanda Tangan di bawah tabel
    const tableEndY = doc.autoTable.previous.finalY || currentY + 5; // Akhir tabel, atau posisi awal jika tabel kosong
    const signatureSectionY = tableEndY + 15; // Jarak dari akhir tabel

    // Deklarasi ulang margin dan pageWidth untuk scope ini
    const margin = 10; 
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Kepala Sekolah
    const kepalaSekolahY = signatureSectionY + 15;
    doc.text('Kepala Sekolah', margin, kepalaSekolahY);
    doc.text(meta.schoolPrincipalName || '', margin, kepalaSekolahY + 8);
    if (meta.schoolPrincipalNip) {
        doc.text(`NIP. ${meta.schoolPrincipalNip}`, margin, kepalaSekolahY + 13);
    }

    // Guru Mata Pelajaran
    const guruMapelX = pageWidth / 2;
    const guruMapelY = signatureSectionY + 15; // Sejajar dengan Kepala Sekolah
    doc.text('Guru Mata Pelajaran', guruMapelX, guruMapelY);
    doc.text(meta.teacherName || '', guruMapelX, guruMapelY + 8);
    if (meta.teacherNip) {
        doc.text(`NIP. ${meta.teacherNip}`, guruMapelX, guruMapelY + 13);
    }


    doc.save(meta.fileName || 'Rekap_Kehadiran.pdf');
};
