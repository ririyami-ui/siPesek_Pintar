import React from 'react';
import Modal from './Modal';
import StyledButton from './StyledButton';
import { Printer, X } from 'lucide-react';

const PrintScheduleModal = ({ isOpen, onClose, schedules, classes, subjects, teachers, teachingSlots, schoolName }) => {
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    
    // Safety check: if teachingSlots is empty, try to see if there's any data in schedules
    const hasSlots = Object.values(teachingSlots).some(slots => slots && slots.length > 0);
    
    // If no slots, but we have schedules, we might need a default time grid
    // However, usually teachingSlots should be populated if schedules exist.

    const handlePrint = () => {
        window.print();
    };

    // Helper to get teacher code
    const getTeacherCode = (teacherId) => {
        if (!teacherId) return '-';
        const teacher = teachers.find(t => t.id === teacherId || t.auth_user_id === teacherId);
        return teacher?.code || teacher?.name?.substring(0, 2).toUpperCase() || '??';
    };

    // Helper to get subject code
    const getSubjectCode = (subjectId) => {
        if (!subjectId) return '-';
        const subject = subjects.find(s => s.id === subjectId);
        return subject?.code || subject?.name?.substring(0, 3).toUpperCase() || '???';
    };

    return (
        <Modal onClose={onClose} size="full">
            <div className="p-4 print:p-0">
                <div className="flex justify-between items-center mb-6 no-print bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                            <Printer className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-amber-900">Siap Cetak Jadwal</h3>
                            <p className="text-xs text-amber-700">
                                Gunakan <strong>Kode Guru</strong> dan <strong>Kode Mapel</strong> agar tabel tetap rapi.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <StyledButton onClick={onClose} variant="outline" className="!py-2">
                            Tutup
                        </StyledButton>
                        <StyledButton onClick={handlePrint} variant="primary" className="!py-2 shadow-lg shadow-purple-200">
                            <Printer className="w-4 h-4 mr-2" />
                            Cetak Sekarang
                        </StyledButton>
                    </div>
                </div>

                {!hasSlots ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-bold">Template waktu belum tersedia.</p>
                        <p className="text-xs text-gray-400">Pastikan Anda sudah mengatur "Template Waktu" di menu sebelumnya.</p>
                    </div>
                ) : (
                    /* Print Area */
                    <div id="print-area" className="bg-white p-4 print:p-0">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">{schoolName || 'Jadwal Pelajaran Sekolah'}</h2>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Tahun Ajaran 2023/2024</p>
                            <div className="w-24 h-1 bg-gray-800 mx-auto mt-4 rounded-full"></div>
                        </div>

                        <table className="w-full border-collapse border-2 border-black text-[10px]">
                            <thead>
                                <tr>
                                    <th className="border-2 border-black p-2 bg-gray-100 font-black" style={{ width: '80px' }}>HARI</th>
                                    <th className="border-2 border-black p-2 bg-gray-100 font-black" style={{ width: '40px' }}>JAM</th>
                                    {classes.map(cls => (
                                        <th key={cls.id} className="border-2 border-black p-1 bg-gray-100 text-center font-black">
                                            {cls.rombel}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {days.map(day => {
                                    const daySlots = teachingSlots[day] || [];
                                    if (daySlots.length === 0) return null;

                                    return daySlots.map((slot, sIdx) => (
                                        <tr key={`${day}-${slot.jam_ke}`} className="break-inside-avoid">
                                            {sIdx === 0 && (
                                                <td rowSpan={daySlots.length} className="border-2 border-black p-2 text-center font-black align-middle bg-gray-50 text-xs rotate-180 [writing-mode:vertical-lr]">
                                                    {day.toUpperCase()}
                                                </td>
                                            )}
                                            <td className="border-2 border-black p-1 text-center font-mono font-bold bg-gray-50">
                                                {slot.jam_ke}
                                            </td>
                                            {classes.map(cls => {
                                                // Find schedule for this day, class, and period
                                                const item = schedules.find(s => 
                                                    s.day === day && 
                                                    s.class_id === cls.id && 
                                                    parseInt(slot.jam_ke) >= parseInt(s.start_period) && 
                                                    parseInt(slot.jam_ke) <= parseInt(s.end_period)
                                                );

                                                return (
                                                    <td key={`${day}-${slot.jam_ke}-${cls.id}`} className="border border-black p-1 text-center min-w-[50px] h-10">
                                                        {item ? (
                                                            <div className="flex flex-col leading-[1.1]">
                                                                <span className="font-black text-[11px]">{getSubjectCode(item.subject_id)}</span>
                                                                <span className="text-[9px] font-bold text-gray-600 border-t border-gray-100 mt-0.5 pt-0.5">{getTeacherCode(item.teacher_id)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-200">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>

                        <div className="mt-10 grid grid-cols-2 text-xs font-bold">
                            <div className="text-center">
                                <p>Mengetahui,</p>
                                <p className="mb-20 uppercase">Kepala Sekolah</p>
                                <p className="font-black underline decoration-2 underline-offset-4">( ............................................ )</p>
                                <p className="text-[10px] mt-1 text-gray-400 font-medium italic">NIP. ............................................</p>
                            </div>
                            <div className="text-center">
                                <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                <p className="mb-20 uppercase">Waka Kurikulum</p>
                                <p className="font-black underline decoration-2 underline-offset-4">( ............................................ )</p>
                                <p className="text-[10px] mt-1 text-gray-400 font-medium italic">NIP. ............................................</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Legend for Codes (Only on screen) */}
                {hasSlots && (
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 no-print text-[10px] border-t-2 border-dashed border-gray-100 pt-8 pb-10">
                        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                            <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                DAFTAR KODE MATA PELAJARAN
                            </h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                                {subjects.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                                        <span className="font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md min-w-[35px] text-center">{s.code || s.name.substring(0,3).toUpperCase()}</span>
                                        <span className="text-gray-600 truncate font-bold">{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                            <h4 className="font-black text-gray-800 mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                DAFTAR KODE GURU
                            </h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {teachers.slice(0, 40).map(t => (
                                    <div key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg transition-colors">
                                        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md min-w-[30px] text-center">{t.code || t.name.substring(0,2).toUpperCase()}</span>
                                        <span className="text-gray-600 truncate font-bold">{t.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    /* Make modal visible during print */
                    .fixed { position: relative !important; display: block !important; background: transparent !important; backdrop-filter: none !important; padding: 0 !important; }
                    .rounded-t-[2.5rem], .sm\\:rounded-3xl { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
                    .max-h-\\[85vh\\] { max-height: none !important; overflow: visible !important; padding: 0 !important; }
                    #print-area { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
                    th, td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @page { size: landscape; margin: 0.5cm; }
                }
            `}} />
        </Modal>
    );
};

export default PrintScheduleModal;
