import React from 'react';
import {
    FileText, MapPin, Loader2, Upload, BrainCircuit, Sliders, RefreshCw
} from 'lucide-react';
import StyledSelect from '../StyledSelect';
import ProgressBar from '../ProgressBar';









;
  QUESTION_TYPES: QuestionType[];
}

const QuizForm: React.FC = ({
    sourceType, setSourceType,
    sourceData, loading,
    selectedContextIds, handleSourceChange,
    subject, setSubject, subjects,
    gradeLevel, setGradeLevel, classes,
    topic, setTopic,
    signingLocation, setSigningLocation,
    handleDetectLocation, detectingLocation,
    previewUrl, setPreviewUrl, setImageFile,
    contextContent, setContextContent,
    difficulty, setDifficulty,
    stimulusMode,
    setStimulusMode,
    typeCounts, updateTypeCount,
    handleGenerate, generating,
    generationProgress,
    QUESTION_TYPES
}) => {
    const [searchQuery, setSearchQuery] = React.useState('');
    const normalizeGrade = (val) => String(val || '').replace(/\D/g, '');
    const totalQuestions = Object.values(typeCounts).reduce((sum, c) => sum + (parseInt(c ) || 0), 0);

    return (
        
            
                {/* LEFT: Context & Basics */}
                
                     Konteks & Materi

                    {/* Row 1: Kelas & Mata Pelajaran */}
                    
                        
                            Kelas (Level)
                             setGradeLevel(e.target.value)}
                            >
                                Pilih Kelas
                                {[...new Set(classes.map(c => c.level).filter(Boolean))].sort((a, b) => {
                                    const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
                                    const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
                                    return numA - numB;
                                }).map(level => {level})}
                            
                        
                        
                            Mata Pelajaran
                             s.name === subject)?.id || ''}
                                onChange={(e) => {
                                    const s = subjects.find(sub => sub.id === e.target.value);
                                    setSubject(s ? s.name : e.target.value);
                                }}
                            >
                                Pilih Mapel
                                {subjects.map(s => {s.name})}
                            
                        
                    

                    {/* Row 2: Sumber Data */}
                    
                        Sumber Data
                         setSourceType(e.target.value)}>
                            Modul Ajar / RPP
                            Program Semester
                            Input Manual
                            Upload Gambar (Vision)
                        
                    

                    {/* Row 3: Pilih Dokumen */}
                    
                        Pilih Dokumen (Berdasarkan filter Kelas & Mapel)
                        {sourceType === 'manual' || sourceType === 'image' ? (
                            
                                -- Pilih --
                            
                        ) : (
                            
                                
                                     setSearchQuery(e.target.value)}
                                        className="w-full text-xs px-2 py-1.5 rounded border dark:bg-gray-900 dark:border-gray-700 outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                     {
                                            const filtered = sourceData
                                                .filter(d => !subject || (d.subject && d.subject.toLowerCase() === subject.toLowerCase()))
                                                .filter(d => !gradeLevel || normalizeGrade(d.gradeLevel || d.grade || '') === normalizeGrade(gradeLevel));
                                            if (selectedContextIds.length === filtered.length && filtered.length > 0) {
                                                handleSourceChange([]);
                                            } else {
                                                handleSourceChange(filtered.map(d => d.id));
                                            }
                                        }}
                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded transition-colors"
                                    >
                                        {selectedContextIds.length > 0 ? 'Batal Semua' : 'Pilih Semua'}
                                    
                                
                                
                                    {loading ? (
                                        Memuat...
                                    ) : sourceData.length === 0 ? (
                                        Tidak ada data
                                    ) : (
                                        sourceData
                                            .filter(d => !subject || (d.subject && d.subject.toLowerCase() === subject.toLowerCase()))
                                            .filter(d => !gradeLevel || normalizeGrade(d.gradeLevel || d.grade || '') === normalizeGrade(gradeLevel))
                                            .filter(d => {
                                                const text = sourceType === 'rpp'
                                                    ? `${d.gradeLevel || ''} ${d.materi || d.topic || ''} ${d.academicYear || ''}`
                                                    : `${d.subject || ''} ${d.gradeLevel || d.grade || ''}`;
                                                return text.toLowerCase().includes(searchQuery.toLowerCase());
                                            })
                                            .map(d => (
                                                
                                                     {
                                                            if (e.target.checked) {
                                                                handleSourceChange([...selectedContextIds, d.id]);
                                                            } else {
                                                                handleSourceChange(selectedContextIds.filter(id => id !== d.id));
                                                            }
                                                        }}
                                                    />
                                                    
                                                        {sourceType === 'rpp'
                                                            ? `${d.gradeLevel || 'Kelas'} - ${d.materi || d.topic} (${d.academicYear || ''})`
                                                            : `${d.subject} - ${d.gradeLevel || d.grade} (${d.semester})`
                                                        }
                                                    
                                                
                                            ))
                                    )}
                                
                            
                        )}
                        {subject && sourceData.filter(d => d.subject && d.subject.toLowerCase() === subject.toLowerCase()).filter(d => !gradeLevel || normalizeGrade(d.gradeLevel || d.grade || '') === normalizeGrade(gradeLevel)).length === 0 && (
                            Tidak ada {sourceType.toUpperCase()} untuk filter mapel & kelas ini.
                        )}
                    

                    
                        Topik Spesifik / KD
                         setTopic(e.target.value)}
                            placeholder="Contoh: Ekosistem, Hukum Newton..."
                        />
                    

                    
                        Kota / Tempat (Untuk Tanda Tangan)
                        
                             {
                                    setSigningLocation(e.target.value);
                                    localStorage.setItem('SIGNING_LOCATION', e.target.value);
                                }}
                                placeholder="Contoh: Jakarta, Bondowoso..."
                            />
                            
                                {detectingLocation ?  : }
                            
                        
                    

                    {sourceType === 'image' ? (
                        
                            Upload Gambar Referensi
                            
                                 {
                                        const files = e.target.files;
                                        if (files && files[0]) {
                                            const file = files[0];
                                            setImageFile(file);
                                            const reader = new FileReader();
                                            reader.onloadend = () => setPreviewUrl(reader.result  | null);
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                                
                                    {previewUrl ? (
                                        
                                            
                                             {
                                                    e.preventDefault();
                                                    setImageFile(null);
                                                    setPreviewUrl(null);
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                            >
                                                
                                            
                                        
                                    ) : (
                                        <>
                                            
                                            Klik untuk upload gambar (Diagram, Teks, dll)
                                        
                                    )}
                                
                            
                        
                    ) : (
                        
                            Konteks Tambahan (AI Reading)
                             setContextContent(e.target.value)}
                                placeholder="Isi materi atau kopikan teks RPP di sini untuk referensi AI..."
                            />
                        
                    )}
                

                {/* RIGHT: Advanced Settings */}
                
                     Konfigurasi Soal

                    
                        Total Soal
                        
                            
                                {totalQuestions}
                            
                            butir
                        
                    

                    
                        
                            Tingkat Kesulitan (HOTS Meter)
                             70 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {difficulty}% - {difficulty > 70 ? 'HOTS' : difficulty > 30 ? 'MOTS' : 'LOTS'}
                            
                        
                         setDifficulty(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        
                            Mudah
                            Menalar
                            Kritis
                        
                    

                    {/* Stimulus Mode Selector */}
                    
                        Mode Stimulus Soal
                        
                            {[
                                { id: 'with_stimulus', label: 'Ada Stimulus', emoji: '📄', color: 'bg-blue-600', lightColor: 'bg-blue-50', textColor: 'text-blue-600', ring: 'ring-blue-200' },
                                { id: 'auto', label: 'Campuran', emoji: '🔀', color: 'bg-indigo-600', lightColor: 'bg-indigo-50', textColor: 'text-indigo-600', ring: 'ring-indigo-200' },
                                { id: 'no_stimulus', label: 'Tanpa Stimulus', emoji: '✏️', color: 'bg-emerald-600', lightColor: 'bg-emerald-50', textColor: 'text-emerald-600', ring: 'ring-emerald-200' },
                            ].map(mode => {
                                const isActive = stimulusMode === mode.id;
                                return (
                                     setStimulusMode(mode.id)}
                                        className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 border-2 ${
                                            isActive 
                                                ? `${mode.color} text-white border-transparent shadow-lg scale-[1.02] z-10` 
                                                : `bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-gray-200 dark:hover:border-gray-600`
                                        }`}
                                    >
                                        {isActive && (
                                            
                                                ✓
                                            
                                        )}
                                        
                                            {mode.emoji}
                                        
                                        
                                            {mode.label}
                                        
                                    
                                );
                            })}
                        
                        
                            
                                {stimulusMode === 'with_stimulus' && '📄 Mode Literasi: Setiap soal akan diawali dengan stimulus (teks/data/narasi).'}
                                {stimulusMode === 'no_stimulus' && '✏️ Mode Direct: Soal dibuat langsung tanpa narasi pendahulu (lebih ringkas).'}
                                {stimulusMode === 'auto' && '🔀 Mode Campuran: AI akan mengatur distribusi ganjil/genap (50% kognitif stimulus).'}
                            
                        
                    

                    
                        Jumlah Soal per Tipe
                        
                            {QUESTION_TYPES.map(type => (
                                
                                    
                                        
                                            {type.icon}
                                        
                                        {type.label}
                                    
                                    
                                         updateTypeCount(type.id, e.target.value)}
                                            placeholder="0"
                                            className="w-20 px-3 py-2 text-center font-bold border rounded-lg dark:bg-gray-800 dark:border-gray-600 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    
                                
                            ))}
                        
                    

                    
                        {generating ?  : }
                        {generating ? 'Sedang Meracik Soal...' : 'GENERATE SOAL SEKARANG'}
                        
                            ⚡ Menggunakan Quota AI
                        
                    

                    {/* Progress Indicator */}
                    
                
            
        
    );
};

export default QuizForm;

