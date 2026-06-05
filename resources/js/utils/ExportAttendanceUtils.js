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

    // 1. Kop Surat
    wsData.push([meta.schoolName || 'Sekolah Pintar']);
    if (meta.subjectName) wsData.push([`Mata Pelajaran: ${meta.subjectName}`]);
    wsData.push([`Tahun Ajaran: ${meta.academicYear || '-'}`]);
    wsData.push([`Kelas: ${meta.className || '-'}`]);
    wsData.push([]); // Baris kosong

    // 2. Header Baris 1
    const headerRow1 = ['No', 'NISN', 'NAMA SISWA'];
    const headerRow2 = ['', '', ''];

    // Tanggal
    if (dates.length > 0) {
        headerRow1.push('TANGGAL');
        for (let i = 1; i < dates.length; i++) headerRow1.push(''); // Padding untuk merge
        
        dates.forEach(dateStr => {
            const dateObj = new Date(dateStr);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            headerRow2.push(`${day}/${month}`);
        });
    } else {
        headerRow1.push('TANGGAL');
        headerRow2.push('-');
    }

    // Kolom Absen
    headerRow1.push('Absen', '', '', '');
    headerRow2.push('H', 'S', 'I', 'A');

    wsData.push(headerRow1);
    wsData.push(headerRow2);

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
        row.push(studentData.Ijin || 0);
        row.push(studentData.Alpha || 0);

        wsData.push(row);
    });

    // 4. Proses Worksheet & Merged Cells
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Tentukan baris awal header (tergantung panjang kop surat)
    let headerRowIndex = 4;
    if (meta.subjectName) headerRowIndex++;
    if (meta.period) headerRowIndex++;
    
    const merges = [
        { s: { r: headerRowIndex, c: 0 }, e: { r: headerRowIndex + 1, c: 0 } }, // No
        { s: { r: headerRowIndex, c: 1 }, e: { r: headerRowIndex + 1, c: 1 } }, // NISN
        { s: { r: headerRowIndex, c: 2 }, e: { r: headerRowIndex + 1, c: 2 } }  // NAMA
    ];

    const numDates = Math.max(1, dates.length);
    // TANGGAL Merge
    merges.push({
        s: { r: headerRowIndex, c: 3 },
        e: { r: headerRowIndex, c: 3 + numDates - 1 }
    });

    // Absen Merge
    const absenStartCol = 3 + numDates;
    merges.push({
        s: { r: headerRowIndex, c: absenStartCol },
        e: { r: headerRowIndex, c: absenStartCol + 3 }
    });

    ws['!merges'] = merges;

    // Set Column Widths
    const colWidths = [
        { wch: 5 },  // No
        { wch: 15 }, // NISN
        { wch: 30 }, // NAMA
    ];
    for (let i = 0; i < numDates; i++) colWidths.push({ wch: 6 }); // Tanggal (lebar 6 agar muat DD/MM)
    colWidths.push({ wch: 4 }, { wch: 4 }, { wch: 4 }, { wch: 4 }); // H S I A
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
    // Gunakan orientasi landscape karena kolom banyak
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // 1. Kop Surat
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.schoolName || 'Sekolah Pintar', 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let startY = 22;
    if (meta.subjectName) {
        doc.text(`Mata Pelajaran : ${meta.subjectName}`, 14, startY);
        startY += 6;
    }
    doc.text(`Tahun Ajaran   : ${meta.academicYear || '-'}`, 14, startY);
    startY += 6;
    doc.text(`Kelas                : ${meta.className || '-'}`, 14, startY);
    if (meta.period) {
        startY += 6;
        doc.text(`Periode            : ${meta.period}`, 14, startY);
    }
    
    // 2. Persiapan Data Tabel
    const numDates = Math.max(1, dates.length);
    
    // Baris Header Bertingkat untuk jspdf-autotable
    const head = [
        [
            { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'NISN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'NAMA SISWA', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'TANGGAL', colSpan: numDates, styles: { halign: 'center' } },
            { content: 'Absen', colSpan: 4, styles: { halign: 'center' } }
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
        row.push((studentData.Ijin || 0).toString());
        row.push((studentData.Alpha || 0).toString());
        
        return row;
    });

    // 3. Render Tabel
    doc.autoTable({
        startY: startY + 5,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 }, // No
            1: { cellWidth: 25 }, // NISN
            2: { cellWidth: 45 }, // Nama
            // Sisa kolom (tanggal dan absen) dibuat sekecil mungkin
        },
        styles: {
            halign: 'center', // Default align center untuk tanggal & absen
            valign: 'middle'
        },
        didParseCell: function(data) {
            // Ubah alignment khusus untuk kolom Nama (kiri)
            if (data.section === 'body' && data.column.index === 2) {
                data.cell.styles.halign = 'left';
            }
        }
    });

    doc.save(meta.fileName || 'Rekap_Kehadiran.pdf');
};
