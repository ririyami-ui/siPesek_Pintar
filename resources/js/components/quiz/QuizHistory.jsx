import React from 'react';
import { History, Trash2, Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

;
}

) => void;
  onDeleteQuiz: (e: React.MouseEvent, id) => void;
  activeSemester;
}

const QuizHistory: React.FC = ({
    savedQuizzes,
    loadingHistory,
    onSelectQuiz,
    onDeleteQuiz,
    activeSemester
}) => {
    return (
        
            
                
                Riwayat Kuis
            

            
                {loadingHistory ? (
                    
                        
                    
                ) : savedQuizzes.length > 0 ? (
                    savedQuizzes.map((q) => (
                         {
                                onSelectQuiz({
                                    ...q.quiz,
                                    context_semester: q.context_semester || activeSemester
                                }, {
                                    subject: q.subject || '',
                                    gradeLevel: q.gradeLevel || '',
                                    topic: q.topic || ''
                                });
                            }}
                            className="group p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer relative"
                        >
                            
                                
                                    
                                        {q.subject} - {q.gradeLevel}
                                    
                                    
                                        {q.topic}
                                    
                                    
                                        {q.createdAt?.toDate
                                            ? formatDate(q.createdAt.toDate())
                                            : 'Baru saja'}
                                    
                                
                                 {
                                        e.stopPropagation();
                                        onDeleteQuiz(e, q.id);
                                    }}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                >
                                    
                                
                            
                        
                    ))
                ) : (
                    
                        Belum ada riwayat kuis.
                    
                )}
            
        
    );
};

export default QuizHistory;

