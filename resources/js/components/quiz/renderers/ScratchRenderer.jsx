import React, { useEffect, useRef, useMemo } from 'react';
import scratchblocks from 'scratchblocks';

const ScratchRenderer = ({ config }) => {
  const ref = useRef(null);
  const uniqueId = useMemo(() => 'scratch-' + Math.random().toString(36).substring(2, 9), []);

  useEffect(() => {
    if (ref.current && config.code) {
      ref.current.textContent = config.code;
      try {
        scratchblocks.renderMatching(`#${uniqueId}`, { 
          style: 'scratch3',
          languages: ['en', 'id']
        });
      } catch (e) {
        console.error("Scratch error", e);
      }
    }
  }, [config.code, uniqueId]);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
      <div ref={ref} id={uniqueId} className="scratchblocks">
        {config.code}
      </div>
    </div>
  );
};

export default ScratchRenderer;
