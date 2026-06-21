import React, { useEffect, useRef, useId } from 'react';

const MathRenderer = ({ config }) => {
  const containerId = useId().replace(/:/g, '');
  const containerRef = useRef(null);
  const boardRef = useRef(null);

  const getProcessedFns = (expr) => {
    if (!expr) return [];
    const parts = expr.split(/\s+dan\s+|,|;/i);
    return parts.map(p => {
      try {
        let processed = p
          .replace(/y\s*=\s*/gi, '')
          .replace(/f\(x\)\s*=\s*/gi, '')
          .replace(/(\d)(x)/g, '$1*$2')
          .replace(/(x)(\d)/g, '$1*$2')
          .replace(/(\))(\()/g, '$1*$2')
          .replace(/(\d)(\()/g, '$1*$2')
          .replace(/(\))([a-zA-Z0-9x])/g, '$1*$2')
          .replace(/[^0-9a-zA-Z+\-*/^().\s]/g, '')
          .replace(/\^/g, '**');
        processed = processed.replace(/(sin|cos|tan|sqrt|exp|log|abs|pow|PI)/g, 'Math.$1');
        return new Function('x', `return ${processed};`);
      } catch (e) {
        return null;
      }
    }).filter(f => f !== null);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const init = () => {
      if (boardRef.current) {
        try { JXG.JSXGraph.freeBoard(boardRef.current); boardRef.current = null; } catch (e) {}
      }

      const numbers = config?.expression?.match(/-?\d+/g)?.map(Number) || [];
      const maxVal = Math.max(...numbers.map(Math.abs), 10);
      const limit = maxVal > 100 ? maxVal * 1.2 : 10;
      const xRange = config.xRange || [-limit / 2, limit];
      const yRange = config.yRange || [-limit / 2, limit];

      try {
        const board = JXG.JSXGraph.initBoard(containerId, {
          boundingbox: [xRange[0], yRange[1], xRange[1], yRange[0]],
          axis: true,
          grid: true,
          showCopyright: false,
          pan: { enabled: false },
          zoom: { enabled: false },
        });
        boardRef.current = board;

        const fns = getProcessedFns(config.expression || "");
        const graphObjects = [];
        const palette = [config.color || '#2563eb', '#8b5cf6', '#f43f5e'];

        fns.forEach((fn, idx) => {
          const graph = board.create('functiongraph', [fn, xRange[0], xRange[1]], {
            strokeColor: palette[idx % palette.length],
            strokeWidth: 2,
          });
          graphObjects.push(graph);
        });

        if (config.points) {
          config.points.forEach((pt) => {
            board.create('point', [pt.x, pt.y], {
              name: pt.label || '',
              withLabel: !!pt.label,
              size: 4,
              fillColor: '#ef4444',
              strokeColor: '#dc2626',
            });
          });
        }

        if (config.elements) {
          const elMap = new Map();
          config.elements.forEach((el) => {
            try {
              if (el.type === 'point') {
                const p = board.create('point', el.parents, {
                  name: el.label || '',
                  withLabel: !!el.label,
                  size: 4,
                });
                if (el.id) elMap.set(el.id, p);
              } else if (el.type === 'segment') {
                const p1 = elMap.get(el.parents[0]) || el.parents[0];
                const p2 = elMap.get(el.parents[1]) || el.parents[1];
                board.create('segment', [p1, p2], {
                  strokeColor: '#2563eb',
                  strokeWidth: 2,
                });
              } else if (el.type === 'integral') {
                const targetGraph = graphObjects[el.parents[1] || 0];
                if (targetGraph) {
                  board.create('integral', [el.parents[0], targetGraph], {
                    fillColor: '#2563eb',
                    fillOpacity: 0.3,
                  });
                }
              } else if (el.type === 'tangent') {
                const p = elMap.get(el.parents[0]) || el.parents[0];
                const targetGraph = graphObjects[el.parents[1] || 0];
                if (p && targetGraph) {
                  board.create('tangent', [p, targetGraph], {
                    strokeColor: '#8b5cf6',
                    strokeWidth: 2,
                    dash: 2,
                  });
                }
              } else if (el.type === 'polygon') {
                const vertices = el.parents.map((id) => elMap.get(id) || id);
                board.create('polygon', vertices, {
                  fillColor: '#fde68a',
                  fillOpacity: 0.3,
                  borders: { strokeColor: '#d97706' },
                });
              }
            } catch (e) {
              console.warn("Element creation failed:", el, e);
            }
          });
        }
      } catch (err) {
        console.error("Board init fail:", err);
      }
    };

    const timer = setTimeout(init, 100);

    return () => {
      clearTimeout(timer);
      if (boardRef.current) {
        try {
          JXG.JSXGraph.freeBoard(boardRef.current);
          boardRef.current = null;
        } catch (e) {}
      }
    };
  }, [config, containerId]);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Matematika Modern</span>
        <h4 className="text-sm font-semibold text-gray-800">{config.title || 'Visualisasi Grafik Fungsi'}</h4>
      </div>
      <div ref={containerRef} id={containerId} style={{ width: '100%', height: config.height || '400px', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
      {config.expression && (
        <p className="text-xs text-gray-500 font-mono mt-1">f(x) = {config.expression}</p>
      )}
    </div>
  );
};

export default MathRenderer;
