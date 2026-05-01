import React, { useState } from 'react';
import { Trash2, Pencil, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import StyledButton from './StyledButton';

const ClassCard = ({ classItem, onEdit, onDelete, analysis }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-lg flex flex-col space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-lg font-semibold text-text-light dark:text-text-dark">{classItem.code}</p>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Tingkat: {classItem.level}</p>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Rombel: {classItem.rombel}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-gray-400">Wali:</span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 truncate max-w-[120px]">
              {classItem.wali?.name || 'Belum ditentukan'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase text-gray-400">Beban:</span>
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                analysis?.status === 'balanced' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                analysis?.status === 'overload' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
              }`}>
                {analysis ? `${analysis.burden}/${analysis.capacity} Jam` : '-/- Jam'}
              </span>
              {analysis?.diff !== 0 && analysis?.diff !== undefined && (
                <span className={`text-[9px] font-bold ${analysis?.diff < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                  ({analysis?.diff > 0 ? `+${analysis?.diff}` : analysis?.diff})
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex space-x-2">
            <StyledButton onClick={() => onEdit(classItem)} variant="primary" size="sm" title="Edit Kelas"><Pencil size={16} /></StyledButton>
            <StyledButton onClick={() => onDelete(classItem.id)} variant="danger" size="sm" title="Hapus Kelas"><Trash2 size={16} /></StyledButton>
          </div>
          <StyledButton
            onClick={() => classItem.onAgreement(classItem)}
            variant="outline"
            size="sm"
            className="!text-[10px] !py-1 text-purple-600 border-purple-200 dark:border-purple-900/30 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            <Scale size={14} className="mr-1" /> Kesepakatan
          </StyledButton>
        </div>
      </div>
      {showDetails && (
        <div className="text-sm text-text-muted-light dark:text-text-muted-dark border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
          <p><strong>Keterangan:</strong> {classItem.description || '-'}</p>
        </div>
      )}
      <div className="flex justify-center">
        <StyledButton onClick={() => setShowDetails(!showDetails)} variant="outline" size="sm">
          {showDetails ? <><ChevronUp size={16} className="mr-1" /> Lebih Sedikit</> : <><ChevronDown size={16} className="mr-1" /> Lebih Banyak</>}
        </StyledButton>
      </div>
    </div>
  );
};

export default ClassCard;
