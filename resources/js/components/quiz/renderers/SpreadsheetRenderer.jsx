import React from 'react';

const getColumnLetter = (index) => {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

const SpreadsheetRenderer = ({ config }) => {
  if (!config) return null;
  const { title = 'Workbook.xlsx', formulaBar = '', selectedCell = 'A1', data = [] } = config;
  const colCount = data.length > 0 && data[0].row ? data[0].row.length : 0;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden shadow-md bg-white font-sans text-sm max-w-full">
      <div className="bg-[#1D6F42] text-white px-4 py-1.5 flex justify-between items-center text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center font-black">X</div>
          <span>{title} - Microsoft Excel</span>
        </div>
      </div>
      
      <div className="flex border-b border-gray-200 bg-gray-50 p-1.5 gap-2 items-center">
        <div className="border border-gray-300 bg-white px-3 py-1 min-w-[60px] text-center font-medium shadow-sm">{selectedCell}</div>
        <div className="h-6 w-px bg-gray-300 mx-1"></div>
        <div className="text-[#1D6F42] italic font-serif font-bold text-lg px-2">fx</div>
        <div className="border border-gray-300 bg-white flex-1 px-3 py-1 shadow-sm font-mono text-gray-700">{formulaBar}</div>
      </div>

      <div className="overflow-auto max-h-[450px]">
        <table className="border-collapse table-fixed w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="w-12 bg-[#F3F3F3] border border-gray-300 text-center font-normal text-[11px] text-gray-500"></th>
              {Array.from({ length: Math.max(colCount, 8) }).map((_, i) => (
                <th key={i} className="bg-[#F3F3F3] border border-gray-300 text-center font-normal text-[11px] text-gray-500 h-6">
                  {getColumnLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((rowItem, rowIndex) => (
              <tr key={rowIndex}>
                <td className="bg-[#F3F3F3] border border-gray-300 text-center text-[11px] text-gray-500 h-6">{rowIndex + 1}</td>
                {Array.from({ length: Math.max(colCount, 8) }).map((_, colIndex) => {
                  const cellValue = rowItem.row?.[colIndex] || "";
                  const colLetter = getColumnLetter(colIndex);
                  const isSelected = `${colLetter}${rowIndex + 1}`.toUpperCase() === selectedCell.toUpperCase();
                  
                  return (
                    <td 
                      key={colIndex} 
                      className={`border border-gray-200 px-2 py-1 truncate relative ${isSelected ? 'outline outline-2 outline-[#1D6F42] z-10 bg-[#E9F5EE]' : ''}`}
                    >
                      {cellValue}
                      {isSelected && <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-[#1D6F42] border border-white"></div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-1 flex items-center gap-4 text-[10px] text-gray-600 font-medium uppercase tracking-tight">
        <div className="text-[#1D6F42] border-b-2 border-[#1D6F42] pb-0.5">Sheet1</div>
        <div className="hover:text-gray-900 cursor-pointer">+</div>
      </div>
    </div>
  );
};

export default SpreadsheetRenderer;
