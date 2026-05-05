import React, { useRef } from 'react';
import Modal from './Modal';
import { Printer, X } from 'lucide-react';
import moment from 'moment';
import Barcode from 'react-barcode';
import { useSettings } from '../utils/SettingsContext';

const PrintLibraryReceiptModal = ({ isOpen, onClose, transactionData }) => {
    const { userProfile } = useSettings();
    const printRef = useRef();

    if (!isOpen || !transactionData) return null;

    const handlePrint = () => {
        const printContent = printRef.current.innerHTML;
        
        // Create a hidden iframe for printing to avoid DOM manipulation/refresh
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        
        // Inject styles and content into the iframe
        doc.write(`
            <html>
                <head>
                    <title>Cetak Struk Perpustakaan</title>
                    <style>
                        @page { size: A6 portrait; margin: 0; }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            font-family: 'Courier New', Courier, monospace;
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important;
                        }
                        .print-container { 
                            width: 10.5cm; 
                            height: 14.8cm; 
                            padding: 20px;
                            box-sizing: border-box;
                            background: white !important;
                        }
                        /* Ensure all internal styles from the ref are preserved */
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid black; padding: 8px; }
                        .no-border th, .no-border td { border: none; }
                    </style>
                    <!-- Include Tailwind for classes used inside the ref -->
                    <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body>
                    <div class="print-container">
                        ${printContent}
                    </div>
                    <script>
                        // Wait for images/scripts (like Tailwind) to load
                        window.onload = () => {
                            window.print();
                            setTimeout(() => {
                                window.frameElement.remove();
                            }, 100);
                        };
                    </script>
                </body>
            </html>
        `);
        doc.close();
    };

    const student = transactionData.student;
    const books = transactionData.books;
    const loanDate = transactionData.loanDate;
    const dueDate = transactionData.dueDate;
    const librarianName = transactionData.librarianName || 'Pustakawan';
    const transactionId = transactionData.transaction_id || transactionData.transactionId;

    return (
        <Modal onClose={onClose} size="lg">
            <div className="relative min-h-[90vh] bg-gray-900/95 dark:bg-black/95 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10 animate-zoom-in">
                
                {/* Premium Floating Header */}
                <div className="absolute top-0 inset-x-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent backdrop-blur-sm">
                    <div className="pl-4">
                        <h2 className="text-xl font-black text-white tracking-tight">Pratinjau Struk</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Format: A6 Vertical • Perpustakaan Pintar</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-2xl shadow-xl hover:bg-gray-100 font-bold transition-all transform active:scale-95"
                        >
                            <Printer size={18} /> Cetak Struk
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-3 bg-white/10 text-white hover:bg-white/20 rounded-2xl transition-all backdrop-blur-md"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Preview Area */}
                <div className="flex-1 overflow-y-auto pt-32 pb-20 px-8 flex justify-center items-start custom-scrollbar bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800 to-gray-900">
                    {/* The Receipt Document */}
                    <div 
                        className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] transform hover:scale-[1.02] transition-transform duration-500" 
                        style={{ 
                            width: '10.5cm', 
                            height: '14.8cm', 
                            minHeight: '14.8cm',
                            color: 'black', 
                            fontFamily: "'Courier New', Courier, monospace" 
                        }}
                    >
                        <div ref={printRef} className="p-8 h-full bg-white text-black flex flex-col" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                            {/* Header Section */}
                            <div className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                                <div className="flex-1">
                                    <h1 className="text-sm font-black uppercase text-black tracking-tighter">
                                        DAFTAR PEMINJAMAN BUKU
                                    </h1>
                                    <h2 className="text-[10px] font-bold text-gray-700 uppercase">
                                        {userProfile?.school_name || import.meta.env.VITE_SCHOOL_NAME || 'SMP NEGERI 7 BONDOWOSO'}
                                    </h2>
                                </div>
                                
                                {transactionId && (
                                    <div className="flex flex-col items-end">
                                        <Barcode 
                                            value={transactionId} 
                                            width={0.9}
                                            height={25}
                                            fontSize={8}
                                            background="#ffffff"
                                            margin={0}
                                        />
                                        <p className="text-[7px] font-mono mt-1 text-gray-400">TRX-ID: {transactionId}</p>
                                    </div>
                                )}
                            </div>

                            {/* Info Table */}
                            <table className="w-full mb-6 font-bold" style={{ fontSize: '11px' }}>
                                <tbody>
                                    <tr>
                                        <td className="w-[70px] py-1">NAMA</td>
                                        <td className="w-4">:</td>
                                        <td className="uppercase">{student?.name}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1">KELAS</td>
                                        <td>:</td>
                                        <td className="uppercase">
                                            {student?.class?.rombel || student?.classroom?.name || '-'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-1">NIS</td>
                                        <td>:</td>
                                        <td>{student?.nis}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1">TANGGAL</td>
                                        <td>:</td>
                                        <td>{moment(loanDate).format('DD/MM/YYYY')}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Books List */}
                            <div className="flex-1">
                                <table className="w-full border-collapse border border-black" style={{ fontSize: '10px' }}>
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="border border-black p-2 text-center w-8">NO</th>
                                            <th className="border border-black p-2 text-left">JUDUL BUKU</th>
                                            <th className="border border-black p-2 text-center w-24">TGL KEMBALI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {books?.map((book, idx) => (
                                            <tr key={idx}>
                                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                                <td className="border border-black p-2 font-bold uppercase">{book.title}</td>
                                                <td className="border border-black p-2 text-center">
                                                    {moment(dueDate).format('DD/MM/YYYY')}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Fill empty slots */}
                                        {Array.from({ length: Math.max(0, 4 - (books?.length || 0)) }).map((_, idx) => (
                                            <tr key={`empty-${idx}`}>
                                                <td className="border border-black p-2 h-8"></td>
                                                <td className="border border-black p-2"></td>
                                                <td className="border border-black p-2"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-[8px] italic mt-2 text-gray-500">* Harap kembalikan buku tepat waktu untuk menghindari denda.</p>
                            </div>

                            {/* Signature Area */}
                            <div className="mt-8 flex justify-end">
                                <div className="text-center w-40">
                                    <p className="mb-10 uppercase text-[9px]">Pustakawan,</p>
                                    <p className="font-bold border-b border-black inline-block px-2 uppercase">{librarianName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-black/20 text-center">
                    <p className="text-[10px] text-gray-500 font-medium">Sistem SiPesek Pintar - Professional Library Management Solution</p>
                </div>
            </div>
        </Modal>
    );
};

export default PrintLibraryReceiptModal;
