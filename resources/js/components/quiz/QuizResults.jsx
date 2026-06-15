import React from 'react';
import {
    Save, Loader2, FileText, Download, Image as ImageIcon, Grid,
    BrainCircuit, Hash, ChevronUp, ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { formatAnswer } from '../../utils/quizExportUtils';
import VisualizationRenderer from './VisualizationRenderer';

[];
  items?[];
  explanation?;
  competency?;
  visualization?: {
    type: 'chart' | 'function' | 'diagram' | 'image' | 'scratch' | 'logic' | 'chemistry' | 'music' | 'spreadsheet' | 'code' | 'geometry' | 'map' | '3d_model' | 'mindmap' | 'mermaid' | 'math';
    config: Record;
  };
}





const QuizResults: React.FC = ({
    quizResult,
    isSaving,
    onSave,
    onExportWord,
    onExportPDF,
    onExportKartuSoalWord,
    onExportKartuSoalPDF,
    onExportKisiKisiWord,
    onExportKisiKisiPDF
}) => {
    if (!quizResult) return null;

    return (
        
            
                Preview Hasil
                
                    
                        {isSaving ?  : }
                        Simpan Kuis
                    
                    
                         Word
                    
                    
                         PDF
                    

                    
                         Kartu Soal (Word)
                    
                    
                         Kartu Soal (PDF)
                    

                    
                         Kisi-kisi (Word)
                    
                    
                         Kisi-kisi (PDF)
                    
                
            

            {/* TIP: Pedagogy Context */}
            {quizResult.questions && quizResult.questions.length > 0 && !quizResult.questions[0].competency && (
                
                    
                    Catatan: Kompetensi & Indikator otomatis hanya tersedia untuk kuis yang baru digenerate. Kuis lama mungkin menampilkan field ini sebagai kosong.
                
            )}

            {/* QUESTIONS GRID */}
            
                {quizResult && Array.isArray(quizResult.questions) && quizResult.questions.length > 0 ? (
                    quizResult.questions.map((q, idx) => (
                        
                            {(q.
                                            return (
                                                
                                                    [{cleanText}]
                                                
                                            );
                                        })()}

                                        
                                            {q.question || 'Petunjuk: Klik "Generate" untuk membuat soal.'}
                                        
                                    
                                
                            

                            
                                {/* PEDAGOGICAL METADATA */}
                                {(q.indicator || q.cognitive_level) && (
                                    
                                        {q.cognitive_level && (
                                            
                                                Level: {q.cognitive_level}
                                            
                                        )}
                                        {q.indicator && (
                                            
                                                Indikator: {q.indicator}
                                            
                                        )}
                                    
                                )}

                                {/* OPTION RENDERER */}
                                {(q.type === 'pg' || q.type === 'pg_complex') && Array.isArray(q.options) && (
                                    
                                        {q.options.map((opt, oIdx) => (
                                            
                                                
                                                
                                                    
                                                        {opt}
                                                    
                                                
                                            
                                        ))}
                                    
                                )}

                                {q.type === 'matching' && Array.isArray(q.left_side) && Array.isArray(q.right_side) && (
                                    
                                        
                                            {q.left_side.map((l, i) => (
                                                
                                                    
                                                        {l}
                                                    
                                                
                                            ))}
                                        
                                        
                                            {q.right_side.map((r, i) => (
                                                
                                                    
                                                        {r}
                                                    
                                                
                                            ))}
                                        
                                    
                                )}

                                {q.type === 'pg_matrix' && Array.isArray(q.rows) && Array.isArray(q.columns) && (
                                    
                                        
                                            
                                                
                                                    Pernyataan
                                                    {q.columns.map((col, cIdx) => (
                                                        
                                                            
                                                                {col}
                                                            
                                                        
                                                    ))}
                                                
                                            
                                            
                                                {q.rows.map((row, rIdx) => (
                                                    
                                                        
                                                            
                                                                {row}
                                                            
                                                        
                                                        {q.columns?.map((col, cIdx) => (
                                                            
                                                                
                                                            
                                                        ))}
                                                    
                                                ))}
                                            
                                        
                                    
                                )}

                                {q.type === 'true_false' && Array.isArray(q.statements) && (
                                    
                                        {q.statements.map((s, i) => (
                                            
                                                
                                                    
                                                        {s.text}
                                                    
                                                
                                                
                                                    B
                                                    S
                                                
                                            
                                        ))}
                                    
                                )}

                                {q.type === 'short_answer' && (
                                    
                                        
                                             Jawab: ................................................................................
                                        
                                    
                                )}

                                {q.type === 'sequencing' && Array.isArray(q.items) && (
                                    
                                        {q.items.map((item, i) => (
                                            
                                                
                                                    
                                                    
                                                
                                                
                                                    
                                                        {item}
                                                    
                                                
                                            
                                        ))}
                                        Petunjuk: Urutkan langkah-langkah di atas dengan benar.
                                    
                                )}

                                {/* ANSWER KEY REVEAL */}
                                
                                    
                                        
                                            Lihat Kunci & Pembahasan
                                        
                                        
                                            
                                                Jawaban:
                                                
                                                    
                                                        {formatAnswer(q)}
                                                    
                                                
                                            
                                            {q.explanation && (
                                                
                                                    Pembahasan:
                                                    
                                                        
                                                            {q.explanation}
                                                        
                                                    
                                                
                                            )}
                                        
                                    
                                
                            
                        
                    ))
                ) : (
                    
                        Terjadi kesalahan teknis saat memproses soal.
                        Format data dari AI tidak terbaca dengan benar. Mohon klik tombol Generate ulang untuk mendapatkan hasil yang utuh.
                    
                )}
            
        
    );
};

export default QuizResults;

