import React from 'react';

const LogicRenderer = ({ config }) => {
  const code = (config.code || "").toUpperCase();
  
  const isAND = code.includes("AND");
  const isOR = code.includes("OR");
  const isNOT = code.includes("NOT") || code.includes("-> NOT");
  
  return (
    <div className="flex flex-col items-center p-4 bg-gray-50 rounded border">
      <svg width="300" height="150" viewBox="0 0 300 150">
        <text x="10" y="45" fontSize="12">IN A</text>
        <line x1="40" y1="40" x2="100" y2="40" stroke="black" strokeWidth="2" />
        
        <text x="10" y="105" fontSize="12">IN B</text>
        <line x1="40" y1="100" x2="100" y2="100" stroke="black" strokeWidth="2" />
        
        {isOR ? (
          <path d="M 100 20 Q 130 70 100 120 L 150 120 Q 180 70 150 20 Z" fill="white" stroke="black" strokeWidth="2" />
        ) : (
          <path d="M 100 20 L 140 20 A 50 50 0 0 1 140 120 L 100 120 Z" fill="white" stroke="black" strokeWidth="2" />
        )}
        <text x="115" y="75" fontSize="10">{isOR ? "OR" : "AND"}</text>
        
        <line x1="170" y1="70" x2="200" y2="70" stroke="black" strokeWidth="2" />
        
        {isNOT && (
          <>
            <polygon points="200,50 230,70 200,90" fill="white" stroke="black" strokeWidth="2" />
            <circle cx="235" cy="70" r="5" fill="white" stroke="black" strokeWidth="2" />
          </>
        )}
        
        <line x1={isNOT ? 240 : 170} y1="70" x2="280" y2="70" stroke="black" strokeWidth="2" />
        <text x="285" y="75" fontSize="12">OUT Y</text>
      </svg>
      <div className="mt-2 font-bold">
        {isAND && isNOT ? "Gerbang NAND" : isOR && isNOT ? "Gerbang NOR" : isAND ? "Gerbang AND" : isOR ? "Gerbang OR" : "Rangkaian Logika"}
      </div>
    </div>
  );
};

export default LogicRenderer;
