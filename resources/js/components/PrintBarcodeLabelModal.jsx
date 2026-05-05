import React, { useRef } from 'react';
import Modal from './Modal';
import { Printer, X } from 'lucide-react';
import Barcode from 'react-barcode';

const PrintBarcodeLabelModal = ({ isOpen, onClose, selectedBooks, logoUrl }) => {
    const printRef = useRef();

    if (!isOpen || !selectedBooks || selectedBooks.length === 0) return null;

    const handlePrint = () => {
        const printContent = printRef.current.innerHTML;
        const originalContent = document.body.innerHTML;

        document.body.innerHTML = `
            <style>
                @media print {
                    @page { size: A4 portrait; margin: 10mm; }
                    body { background: white; margin: 0; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            </style>
            <div style="width: 210mm; margin: 0 auto; background: white;">
                ${printContent}
            </div>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); 
    };

    // Expand selected books based on their total_stock so every physical copy gets a sticker
    const expandedBooks = [];
    selectedBooks.forEach(book => {
        const qty = book.total_stock || 1;
        for (let i = 0; i < qty; i++) {
            expandedBooks.push({ ...book, copyNumber: i + 1, totalCopies: qty });
        }
    });

    return (
        <Modal onClose={onClose} size="4xl">
            <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-3xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cetak Label Barcode</h2>
                        <p className="text-sm text-gray-500">Format Kertas: A4 | Ukuran Label: 7.5cm x 4cm | Total: {expandedBooks.length} Label (dari {selectedBooks.length} judul)</p>
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
                    {/* A4 Container */}
                    <div 
                        ref={printRef} 
                        className="bg-white shadow-2xl" 
                        style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 7.5cm)', gridAutoRows: '4cm', gap: '5mm', justifyContent: 'center' }}>
                            {expandedBooks.map((book, idx) => (
                                <div key={`${book.id}-${idx}`} style={{ width: '7.5cm', height: '4cm', border: '1px dashed #ccc', boxSizing: 'border-box', pageBreakInside: 'avoid', backgroundColor: 'white', color: 'black', display: 'flex' }}>
                                    
                                    {/* Sisi Kiri (Sampul Depan) */}
                                    <div style={{ width: '50%', height: '100%', padding: '3mm', boxSizing: 'border-box', borderRight: '1px dotted #ccc', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', borderBottom: '1px solid black', paddingBottom: '2px' }}>
                                            <div style={{ width: '20px', height: '20px', marginRight: '4px', flexShrink: 0 }}>
                                                <img 
                                                    src={logoUrl || "/branding_logo.png"} 
                                                    alt="Logo" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={(e) => {
                                                        e.target.onerror = null; 
                                                        e.target.style.display = 'none';
                                                        e.target.nextElementSibling.style.display = 'flex';
                                                    }}
                                                />
                                                <div style={{ display: 'none', width: '20px', height: '20px', backgroundColor: '#3b82f6', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>
                                                    S
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '7px', fontWeight: 'bold', margin: 0, lineHeight: '1.2' }}>
                                                {import.meta.env.VITE_SCHOOL_NAME || 'SMP NEGERI 7 BONDOWOSO'}
                                            </p>
                                        </div>
                                        
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <p style={{ fontSize: '9px', fontWeight: 'bold', margin: 0, lineHeight: '1.2', maxHeight: '3.6em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                                {book.title}
                                            </p>
                                        </div>
                                        
                                        {/* ISBN Info */}
                                        <div style={{ marginTop: 'auto' }}>
                                            {book.isbn ? (
                                                <p style={{ fontSize: '7px', margin: 0, color: '#555', fontStyle: 'italic' }}>ISBN: {book.isbn}</p>
                                            ) : (
                                                <p style={{ fontSize: '7px', margin: 0, color: '#555', fontStyle: 'italic' }}>ID: BK-{book.id.toString().padStart(4, '0')}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sisi Kanan (Sampul Belakang / Barcode) */}
                                    <div style={{ width: '50%', height: '100%', padding: '3mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '16px', height: '16px', marginBottom: '4px', flexShrink: 0 }}>
                                            <img 
                                                src={logoUrl || "/branding_logo.png"} 
                                                alt="Logo" 
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                onError={(e) => {
                                                    e.target.onerror = null; 
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <Barcode 
                                            value={book.isbn || book.id.toString()} 
                                            width={1} 
                                            height={24} 
                                            fontSize={8} 
                                            margin={0} 
                                            displayValue={true}
                                            background="transparent"
                                        />
                                        <p style={{ fontSize: '7px', margin: '4px 0 0 0', color: '#555', fontWeight: 'bold' }}>Salinan {book.copyNumber}/{book.totalCopies}</p>
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

export default PrintBarcodeLabelModal;
