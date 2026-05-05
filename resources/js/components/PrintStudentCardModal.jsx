import React, { useRef } from 'react';
import Modal from './Modal';
import { Printer, X } from 'lucide-react';
import Barcode from 'react-barcode';

const PrintStudentCardModal = ({ isOpen, onClose, selectedStudents, logoUrl, schoolName, userProfile }) => {
    const printRef = useRef();

    if (!isOpen || !selectedStudents || selectedStudents.length === 0) return null;

    const handlePrint = () => {
        const printContent = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Cetak Kartu Pelajar</title>
                    <style>
                        @page { size: A4 portrait; margin: 10mm; }
                        body { 
                            background: white !important; 
                            margin: 0; 
                            padding: 0; 
                            font-family: Arial, sans-serif; 
                        }
                        * { 
                            -webkit-print-color-adjust: exact !important; 
                            print-color-adjust: exact !important; 
                            color-adjust: exact !important;
                        }
                        .card-header { background-color: #065f46 !important; }
                        .card-photo-box { background-color: #f3f4f6 !important; }
                        .card-footer { background-color: white !important; }
                    </style>
                </head>
                <body>
                    <div style="width: 210mm; margin: 0 auto; background: white;">
                        ${printContent}
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                window.onafterprint = function() { window.close(); };
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <Modal onClose={onClose} size="4xl">
            <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cetak Kartu Pelajar</h2>
                        <p className="text-sm text-gray-500">Format Kertas: A4 | Ukuran Kartu: 5.5cm x 8.6cm | Total: {selectedStudents.length} Kartu</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 font-bold transition-all"
                        >
                            <Printer size={18} /> Cetak (A4)
                        </button>
                        <button onClick={onClose} className="p-3 bg-white dark:bg-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-gray-700 dark:text-white shadow-sm">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto max-h-[70vh] flex justify-center bg-gray-300 p-4 rounded-xl shadow-inner">
                    <div 
                        ref={printRef} 
                        className="bg-white shadow-2xl relative" 
                        style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5mm', justifyContent: 'flex-start', alignContent: 'flex-start' }}>
                            {selectedStudents.map((student, idx) => (
                                <div key={`${student.id}-${idx}`} style={{ 
                                    width: '5.5cm', 
                                    height: '8.6cm', 
                                    border: '1px solid #e5e7eb', 
                                    borderRadius: '8px',
                                    boxSizing: 'border-box', 
                                    pageBreakInside: 'avoid', 
                                    backgroundColor: 'white', 
                                    color: 'black', 
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}>
                                    {/* Header */}
                                    <div className="card-header" style={{ 
                                        backgroundColor: '#065f46', 
                                        color: 'white', 
                                        padding: '6px', 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        borderBottom: '3px solid #fbbf24',
                                        zIndex: 1
                                    }}>
                                        <div style={{ width: '22px', height: '22px', marginRight: '6px', flexShrink: 0 }}>
                                            <img 
                                                src={logoUrl || "/branding_logo.png"} 
                                                alt="Logo" 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <p style={{ fontSize: '10px', fontWeight: '900', margin: 0, letterSpacing: '0.5px' }}>KARTU PELAJAR</p>
                                            <p style={{ fontSize: '6px', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}>
                                                {schoolName || 'SEKOLAH PINTAR'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div style={{ padding: '4px 6px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, overflow: 'hidden' }}>
                                        {/* Photo Box */}
                                        <div className="card-photo-box" style={{ 
                                            width: '2.5cm', 
                                            height: '3.1cm', 
                                            border: '2px solid #e5e7eb', 
                                            marginBottom: '3px',
                                            backgroundColor: '#f3f4f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            borderRadius: '4px'
                                        }}>
                                            <img 
                                                src={student.nisn ? `/storage/student_photos/${student.nisn}.jpg` : '/default_avatar.png'}
                                                alt="Photo"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '/default_avatar.png';
                                                }}
                                            />
                                        </div>

                                        {/* Student Details */}
                                        <div style={{ width: '100%', textAlign: 'center' }}>
                                            <p style={{ 
                                                fontSize: student.name.length > 25 ? '8px' : '10px', 
                                                fontWeight: '900', 
                                                margin: '0 0 1px 0', 
                                                lineHeight: '1.1', 
                                                color: '#111827' 
                                            }}>
                                                {student.name.toUpperCase()}
                                            </p>
                                            <p style={{ fontSize: '7px', margin: '0 0 4px 0', color: '#4b5563', fontWeight: 'bold' }}>
                                                NISN: {student.nisn || student.nis}
                                            </p>
                                        </div>

                                        <div style={{ width: '100%', marginTop: '2px', paddingLeft: '8px' }}>
                                            <table style={{ width: '100%', fontSize: '6px', lineHeight: '1.2', borderCollapse: 'collapse' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ width: '30%', verticalAlign: 'top', color: '#4b5563', fontWeight: 'bold' }}>Tempat, Tanggal Lahir</td>
                                                        <td style={{ width: '5%', verticalAlign: 'top' }}>:</td>
                                                        <td style={{ width: '65%', verticalAlign: 'top', fontWeight: 'bold', color: '#111827' }}>
                                                            {student.birth_place || '-'}, {student.birth_date ? new Date(student.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ verticalAlign: 'top', color: '#4b5563', fontWeight: 'bold' }}>Jenis Kelamin</td>
                                                        <td style={{ verticalAlign: 'top' }}>:</td>
                                                        <td style={{ verticalAlign: 'top', fontWeight: 'bold', color: '#111827' }}>{student.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ verticalAlign: 'top', color: '#4b5563', fontWeight: 'bold' }}>Alamat</td>
                                                        <td style={{ verticalAlign: 'top' }}>:</td>
                                                        <td style={{ 
                                                            verticalAlign: 'top', 
                                                            fontWeight: 'bold', 
                                                            color: '#111827', 
                                                            fontSize: student.address?.length > 50 ? '4.8px' : '5.5px', 
                                                            lineHeight: '1.1' 
                                                        }}>
                                                            <div style={{ 
                                                                maxHeight: '22px', 
                                                                overflow: 'hidden',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 3,
                                                                WebkitBoxOrient: 'vertical',
                                                                wordBreak: 'break-word'
                                                            }}>
                                                                {student.address || '-'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Signature Section */}
                                        <div style={{ 
                                            width: '100%', 
                                            marginTop: 'auto', 
                                            display: 'flex', 
                                            justifyContent: 'flex-end',
                                            paddingRight: '8px',
                                            paddingBottom: '2px',
                                            position: 'relative'
                                        }}>
                                            <div style={{ textAlign: 'center', minWidth: '2.8cm', position: 'relative' }}>
                                                <p style={{ fontSize: '5px', margin: 0, color: '#4b5563', position: 'relative', zIndex: 3 }}>Mengetahui,</p>
                                                <p style={{ fontSize: '5px', margin: '0 0 1px 0', color: '#4b5563', position: 'relative', zIndex: 3 }}>Kepala Sekolah</p>
                                                
                                                {/* Principal Signature Image - Placed behind name */}
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    top: '8px', 
                                                    left: '50%', 
                                                    transform: 'translateX(-50%)',
                                                    width: '100%',
                                                    height: '35px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    zIndex: 1,
                                                    pointerEvents: 'none'
                                                }}>
                                                    {userProfile?.signatureUrl || userProfile?.signature_url ? (
                                                        <img 
                                                            src={userProfile?.signatureUrl || userProfile?.signature_url} 
                                                            alt="TTD" 
                                                            style={{ maxHeight: '100%', maxWidth: '2.5cm', objectFit: 'contain', opacity: 0.85 }} 
                                                        />
                                                    ) : (
                                                        !(userProfile?.signatureUrl || userProfile?.signature_url) && (
                                                            <div style={{
                                                                width: '30px',
                                                                height: '30px',
                                                                border: '1.5px double #1d4ed8',
                                                                borderRadius: '50%',
                                                                opacity: 0.25,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transform: 'rotate(-20deg)',
                                                                color: '#1d4ed8',
                                                                fontSize: '4px',
                                                                fontWeight: 'bold',
                                                                textAlign: 'center',
                                                                lineHeight: '1'
                                                            }}>
                                                                STEMPEL<br/>SEKOLAH
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                <div style={{ marginTop: '18px', position: 'relative', zIndex: 3 }}>
                                                    <p style={{ fontSize: '6px', fontWeight: 'bold', margin: 0, textDecoration: 'underline', color: '#111827', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                                        {userProfile?.principalName || 'NAMA KEPALA SEKOLAH'}
                                                    </p>
                                                    <p style={{ fontSize: '5px', margin: 0, color: '#4b5563' }}>NIP. {userProfile?.principalNip || '..........................'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <p style={{ fontSize: '4.5px', fontStyle: 'italic', color: '#9ca3af', margin: '1px 0 0 0' }}>
                                            * Kartu ini wajib dibawa selama berada di lingkungan sekolah.
                                        </p>
                                    </div>

                                    {/* Footer / Barcode */}
                                    <div className="card-footer" style={{ 
                                        padding: '2px', 
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center',
                                        backgroundColor: 'white',
                                        zIndex: 1,
                                        marginTop: 'auto',
                                        minHeight: '25px'
                                    }}>
                                        <Barcode 
                                            value={student.nisn || student.nis || student.code || student.id.toString()} 
                                            width={1} 
                                            height={14} 
                                            fontSize={7} 
                                            margin={0} 
                                            displayValue={true}
                                            background="transparent"
                                        />
                                    </div>
                                    
                                    {/* Background Watermark */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        opacity: 0.05,
                                        width: '4.5cm',
                                        height: '4.5cm',
                                        zIndex: 0,
                                        pointerEvents: 'none',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}>
                                        <img 
                                            src={logoUrl || "/branding_logo.png"} 
                                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                            onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default PrintStudentCardModal;
