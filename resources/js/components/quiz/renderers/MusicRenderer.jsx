import React, { useEffect, useRef } from 'react';
import abcjs from 'abcjs';

const MusicRenderer = ({ config }) => {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current && config.abc) {
      try {
        abcjs.renderAbc(ref.current, config.abc, { 
          responsive: 'resize',
          paddingtop: 0,
          paddingbottom: 0,
          paddingright: 0,
          paddingleft: 0,
          scale: 1
        });
      } catch (e) {
        console.error("ABCJS error", e);
      }
    }
  }, [config.abc]);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-x-auto min-h-[100px]">
      <div ref={ref} className="w-full"></div>
      {config.title && <p className="text-center text-xs font-bold text-gray-500 mt-4 uppercase tracking-widest">{config.title}</p>}
    </div>
  );
};

export default MusicRenderer;
