import React, { useEffect, useRef } from 'react';

const GeometryRenderer = ({ config }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    let board = null;
    let JXG_ref = null;
    let mounted = true;

    const initGraph = async () => {
      const JXG = (await import('jsxgraph')).default;
      JXG_ref = JXG;

      if (!mounted || !containerRef.current) return;

      if (!document.getElementById('jsxgraph-css')) {
        const link = document.createElement('link');
        link.id = 'jsxgraph-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css';
        document.head.appendChild(link);
      }

      const id = `jxgbox-${Math.random().toString(36).substr(2, 9)}`;
      containerRef.current.id = id;

      try {
        const boardOptions = {
          boundingbox: config.boundingBox || [-5, 5, 5, -5],
          axis: config.showAxis !== false,
          grid: config.showGrid !== false,
          showCopyright: false,
          ...config.boardOptions
        };

        board = JXG.JSXGraph.initBoard(id, boardOptions);

        if (config.elements && Array.isArray(config.elements)) {
          const elementsMap = {};

          config.elements.forEach(el => {
            const parents = el.parents || el.coords || [];
            const resolvedParents = parents.map(p => {
              if (typeof p === 'string' && elementsMap[p]) return elementsMap[p];
              return p;
            });

            try {
              const created = board.create(el.type, resolvedParents, el.properties || {});
              if (el.id) elementsMap[el.id] = created;
            } catch (err) {
              console.error(`Error creating element ${el.type}:`, err);
            }
          });
        }
      } catch (err) {
        console.error("JSXGraph init error:", err);
      }
    };

    initGraph();

    return () => {
      mounted = false;
      if (board && JXG_ref) {
        try { JXG_ref.JSXGraph.freeBoard(board); } catch (_) {}
      }
    };
  }, [config]);

  return (
    <div className="flex flex-col gap-2">
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: config.height || '400px', border: '1px solid #ccc', borderRadius: '4px' }}
        className="jxgbox"
      />
      {config.caption && <p className="text-sm text-center text-gray-600 italic">{config.caption}</p>}
    </div>
  );
};

export default GeometryRenderer;
