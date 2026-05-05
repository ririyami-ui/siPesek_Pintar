import React, { useRef, useState, useEffect } from 'react';
import { Printer, TrendingUp, ShieldAlert, FileText, ChevronLeft, BookCopy, Users } from 'lucide-react';
import StyledButton from './StyledButton';
import { useSettings } from '../utils/SettingsContext';
import api from '../lib/axios';
import moment from 'moment';

export default function LibraryReport({ onBack, circulationData }) {
    const { userProfile } = useSettings();
    const printRef = useRef();
    const [reportType, setReportType] = useState('recap'); // recap, classification, borrowers
    const [classificationData, setClassificationData] = useState([]);
    const [borrowersData, setBorrowersData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Data from Props (Main Stats)
    const stats = circulationData || {
        month: moment().format('MMMM YYYY'),
        totalBorrowed: 0,
        totalReturned: 0,
        pending: 0,
        late: 0
    };

    useEffect(() => {
        if (reportType === 'classification') {
            fetchClassification();
        } else if (reportType === 'borrowers') {
            fetchBorrowers();
        }
    }, [reportType]);

    const fetchClassification = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/library/reports/classification');
            setClassificationData(res.data);
        } catch (err) {
            console.error('Failed to fetch classification report');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBorrowers = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/library/reports/borrowers');
            setBorrowersData(res.data);
        } catch (err) {
            console.error('Failed to fetch borrowers report');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const renderReportContent = () => {
        if (reportType === 'recap') {
            return (
                <div className="space-y-6 print:space-y-4 animate-in fade-in">
                    <div className="text-center">
                        <h2 className="text-xl font-bold uppercase underline underline-offset-4">
                            LAPORAN REKAPITULASI SIRKULASI PERPUSTAKAAN
                        </h2>
                        <p className="text-sm mt-1">Periode: <span className="font-bold">{stats.month}</span></p>
                    </div>

                    <section>
                        <h3 className="text-sm font-bold uppercase mb-2">I. Ringkasan Sirkulasi</h3>
                        <table className="w-full border-black border-collapse text-sm print:text-xs">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th style={{ width: '40px', border: '1px solid black' }} className="p-2 text-center">No</th>
                                    <th style={{ border: '1px solid black' }} className="p-2 text-left">Kategori Aktivitas</th>
                                    <th style={{ width: '120px', border: '1px solid black' }} className="p-2 text-center">Jumlah (Buku)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">1</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 font-medium">Total Peminjaman Buku Bulan Ini</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.totalBorrowed}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">2</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 font-medium">Total Pengembalian Buku Bulan Ini</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.totalReturned}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">3</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 font-medium">Buku Masih Dalam Pinjaman (Belum Kembali)</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.pending}</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">4</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 font-medium italic">Tingkat Keterlambatan Pengembalian</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.late}</td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <section>
                        <h3 className="text-sm font-bold uppercase mb-2">II. Analisis Kepatuhan Pengembalian</h3>
                        <table className="w-full border-black border-collapse text-sm print:text-xs">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th style={{ border: '1px solid black' }} className="p-2 text-left">Indikator Kinerja</th>
                                    <th style={{ width: '100px', border: '1px solid black' }} className="p-2 text-center">Jumlah</th>
                                    <th style={{ width: '100px', border: '1px solid black' }} className="p-2 text-center">Persentase</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 italic">Pengembalian Tepat Waktu (Disiplin)</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">{stats.totalReturned - stats.late}</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.totalBorrowed > 0 ? Math.round(((stats.totalReturned - stats.late)/stats.totalBorrowed)*100) : 0}%</td>
                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid black' }} className="p-2 italic">Pengembalian Terlambat</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">{stats.late}</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{stats.totalBorrowed > 0 ? Math.round((stats.late/stats.totalBorrowed)*100) : 0}%</td>
                                </tr>
                                <tr className="font-bold">
                                    <td style={{ border: '1px solid black' }} className="p-2 bg-gray-50">Total Transaksi Selesai</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center bg-gray-50">{stats.totalReturned}</td>
                                    <td style={{ border: '1px solid black' }} className="p-2 text-center bg-gray-50">100%</td>
                                </tr>
                            </tbody>
                        </table>
                        <p className="text-[9px] italic mt-1">* Persentase dihitung berdasarkan total buku yang keluar di bulan berjalan.</p>
                    </section>
                </div>
            );
        }

        if (reportType === 'classification') {
            return (
                <div className="space-y-6 print:space-y-4 animate-in fade-in">
                    <div className="text-center">
                        <h2 className="text-xl font-bold uppercase underline underline-offset-4">
                            REKAPITULASI KOLEKSI BERDASARKAN KLASIFIKASI
                        </h2>
                        <p className="text-sm mt-1">Per Tanggal: <span className="font-bold">{moment().format('DD MMMM YYYY')}</span></p>
                    </div>

                    {isLoading ? (
                        <div className="p-20 text-center text-gray-400">Memuat data koleksi...</div>
                    ) : classificationData.length > 0 ? (
                        <div className="space-y-8">
                            {classificationData.map((categoryGroup, catIdx) => (
                                <section key={catIdx} className="break-inside-avoid">
                                    <div className="bg-gray-100 p-2 border-x border-t border-black flex justify-between items-center">
                                        <h3 className="text-sm font-bold uppercase">Klasifikasi: {categoryGroup.category}</h3>
                                        <span className="text-[10px] font-bold">Total: {categoryGroup.total_titles} Judul ({categoryGroup.total_physical} Eks)</span>
                                    </div>
                                    <table className="w-full border-black border-collapse text-xs print:text-[10px]">
                                        <thead>
                                            <tr className="bg-white">
                                                <th style={{ width: '40px', border: '1px solid black' }} className="p-2 text-center">No</th>
                                                <th style={{ border: '1px solid black' }} className="p-2 text-left">Judul Buku / Nama Koleksi</th>
                                                <th style={{ width: '150px', border: '1px solid black' }} className="p-2 text-center">ISBN</th>
                                                <th style={{ width: '80px', border: '1px solid black' }} className="p-2 text-center">Stok</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(categoryGroup.books || []).map((book, bIdx) => (
                                                <tr key={`book-${catIdx}-${bIdx}`}>
                                                    <td style={{ border: '1px solid black' }} className="p-2 text-center">{bIdx + 1}</td>
                                                    <td style={{ border: '1px solid black' }} className="p-2 font-medium uppercase">{book.title}</td>
                                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-mono">{book.isbn || '-'}</td>
                                                    <td style={{ border: '1px solid black' }} className="p-2 text-center font-bold">{book.stock}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </section>
                            ))}

                            <div className="mt-6 p-4 border-2 border-black bg-gray-50 flex justify-between items-center">
                                <span className="font-bold uppercase text-sm">Total Seluruh Judul Buku</span>
                                <span className="text-lg font-black underline">
                                    {classificationData.reduce((acc, curr) => acc + curr.total_titles, 0)} JUDUL
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-20 text-center text-gray-400">Belum ada data koleksi yang tercatat.</div>
                    )}
                </div>
            );
        }

        if (reportType === 'borrowers') {
            return (
                <div className="space-y-6 print:space-y-4 animate-in fade-in">
                    <div className="text-center">
                        <h2 className="text-xl font-bold uppercase underline underline-offset-4">
                            DAFTAR PEMINJAM BUKU AKTIF
                        </h2>
                        <p className="text-sm mt-1">Keadaan Sampai: <span className="font-bold">{moment().format('DD MMMM YYYY')}</span></p>
                    </div>

                    <section>
                        <table className="w-full border-black border-collapse text-xs print:text-[10px]">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th style={{ width: '30px', border: '1px solid black' }} className="p-2 text-center">No</th>
                                    <th style={{ width: '80px', border: '1px solid black' }} className="p-2 text-center">NIS</th>
                                    <th style={{ border: '1px solid black' }} className="p-2 text-left">Nama Peminjam</th>
                                    <th style={{ border: '1px solid black' }} className="p-2 text-left">Judul Buku</th>
                                    <th style={{ width: '80px', border: '1px solid black' }} className="p-2 text-center">Tgl Pinjam</th>
                                    <th style={{ width: '80px', border: '1px solid black' }} className="p-2 text-center">Tenggat</th>
                                    <th style={{ width: '70px', border: '1px solid black' }} className="p-2 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="7" className="p-4 text-center">Memuat data...</td></tr>
                                ) : borrowersData.length > 0 ? (
                                    borrowersData.map((item, idx) => {
                                        const isOverdue = moment().isAfter(moment(item.due_date));
                                        return (
                                            <tr key={idx}>
                                                <td style={{ border: '1px solid black' }} className="p-2 text-center">{idx + 1}</td>
                                                <td style={{ border: '1px solid black' }} className="p-2 text-center">{item.student?.nis}</td>
                                                <td style={{ border: '1px solid black' }} className="p-2 font-medium">{item.student?.name}</td>
                                                <td style={{ border: '1px solid black' }} className="p-2 italic">{item.book?.title}</td>
                                                <td style={{ border: '1px solid black' }} className="p-2 text-center">{moment(item.loan_date).format('DD/MM/YY')}</td>
                                                <td style={{ border: '1px solid black' }} className={`p-2 text-center ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                                                    {moment(item.due_date).format('DD/MM/YY')}
                                                </td>
                                                <td style={{ border: '1px solid black' }} className="p-2 text-center uppercase font-bold text-[8px]">
                                                    {isOverdue ? 'Terlambat' : 'Dipinjam'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan="7" className="p-4 text-center">Tidak ada peminjaman aktif</td></tr>
                                )}
                            </tbody>
                        </table>
                    </section>
                </div>
            );
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Action Bar (Hidden in Print) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 print:hidden transition-all">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onBack}
                        className="p-3 bg-gray-50 dark:bg-gray-900 text-gray-500 hover:text-primary rounded-2xl transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl gap-1">
                        <button 
                            onClick={() => setReportType('recap')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${reportType === 'recap' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <TrendingUp size={16} /> Rekap Sirkulasi
                        </button>
                        <button 
                            onClick={() => setReportType('classification')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${reportType === 'classification' ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <BookCopy size={16} /> Klasifikasi Koleksi
                        </button>
                        <button 
                            onClick={() => setReportType('borrowers')}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all ${reportType === 'borrowers' ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <Users size={16} /> Data Peminjam
                        </button>
                    </div>
                </div>
                <StyledButton onClick={handlePrint} className="!bg-black shadow-xl shadow-black/20">
                    <Printer size={18} className="mr-2" /> Cetak Laporan Resmi
                </StyledButton>
            </div>

            {/* Main Report Document */}
            <div 
                ref={printRef}
                className="bg-white p-8 md:p-12 shadow-2xl print:shadow-none print:p-0 text-black font-serif transition-all"
            >
                {/* --- KOP SEKOLAH (CENTERED) --- */}
                <div className="flex flex-col items-center text-center mb-8">
                    {userProfile?.logoUrl && (
                        <img 
                            src={userProfile.logoUrl} 
                            alt="Logo Sekolah" 
                            className="h-24 w-24 object-contain mb-4" 
                        />
                    )}
                    <h1 className="text-2xl md:text-2xl font-bold uppercase tracking-tight text-black leading-tight">
                        {userProfile?.school_name || "NAMA SEKOLAH BELUM DIATUR"}
                    </h1>
                    <p className="text-sm font-medium text-black mt-1">
                        {userProfile?.address || "Alamat Sekolah belum diatur di Profil Sekolah"}
                    </p>
                    {/* Official Double Line */}
                    <div className="w-full border-t-[3px] border-black mt-4"></div>
                    <div className="w-full border-t border-black mt-[2px]"></div>
                </div>

                <div className="space-y-6 print:space-y-4 min-h-[400px]">
                    {renderReportContent()}

                    {/* SIGNATURE SECTION */}
                    <div className="mt-12 print:mt-10">
                        <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr style={{ border: 'none' }}>
                                    <td style={{ border: 'none', width: '50%' }}></td>
                                    <td style={{ border: 'none', width: '50%' }} className="text-center pb-6 text-sm italic">
                                        Bondowoso, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </td>
                                </tr>
                                <tr style={{ border: 'none' }}>
                                    <td style={{ border: 'none', width: '50%', height: '120px', verticalAlign: 'top' }} className="text-center text-sm leading-relaxed">
                                        Mengetahui,<br />
                                        Kepala Sekolah
                                    </td>
                                    <td style={{ border: 'none', width: '50%', height: '120px', verticalAlign: 'top' }} className="text-center text-sm">
                                        Kepala Perpustakaan,
                                    </td>
                                </tr>
                                <tr style={{ border: 'none' }}>
                                    <td style={{ border: 'none', width: '50%' }} className="text-center">
                                        <p className="text-sm font-bold uppercase underline decoration-1 underline-offset-4 mb-1 whitespace-nowrap overflow-hidden">
                                            {userProfile?.principalName || userProfile?.principal_name || "........................................."}
                                        </p>
                                        <p className="text-sm uppercase whitespace-nowrap overflow-hidden">
                                            NIP. {userProfile?.principalNip || userProfile?.principal_nip || "........................................."}
                                        </p>
                                    </td>
                                    <td style={{ border: 'none', width: '50%' }} className="text-center">
                                        <p className="text-sm font-bold uppercase underline decoration-1 underline-offset-4 mb-1 whitespace-nowrap overflow-hidden">
                                            .........................................
                                        </p>
                                        <p className="text-sm uppercase whitespace-nowrap overflow-hidden">
                                            NIP. .........................................
                                        </p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-12 pt-4 border-t border-gray-100 text-center print:mt-8">
                    <p className="text-[9px] text-gray-400 italic">
                        Laporan Resmi Sistem SiPesek Pintar - Dicetak pada {new Date().toLocaleString('id-ID')}
                    </p>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A4; margin: 15mm; }
                    body { background: white !important; font-family: 'serif' !important; width: 100% !important; }
                    .print\\:hidden { display: none !important; }
                    
                    /* Reset Table for Print */
                    table { width: 100% !important; border-collapse: collapse !important; border: none !important; margin: 0 auto !important; }
                    thead { display: table-header-group !important; }
                    tbody { display: table-row-group !important; }
                    tr { display: table-row !important; }
                    td, th { display: table-cell !important; color: black !important; vertical-align: top !important; border: none !important; }
                    
                    /* Data Table Borders */
                    .border-black { border: 1px solid black !important; }
                    .border-black td, .border-black th { border: 1px solid black !important; padding: 6px !important; }
                    
                    h1, h2, h3, p, span { color: black !important; }
                }
            `}} />
        </div>
    );
}
