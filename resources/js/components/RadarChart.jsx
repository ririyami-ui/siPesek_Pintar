import React from 'react';

const RadarChart = ({ data, size = 300, descriptions = {} }) => {
    // data format: { "Dimensi Name": score (0-100) }
    const dimensions = Object.keys(data);
    const numDimensions = dimensions.length;

    if (numDimensions < 3) return <div className="text-xs text-gray-400">Minimal 3 dimensi diperlukan</div>;

    const center = size / 2;
    const radius = (size / 2) * 0.6; // Factor for padding labels
    const angleStep = (Math.PI * 2) / numDimensions;

    // Helper to get coordinates
    const getPoint = (score, index, scale = 1) => {
        const value = (score / 100) * radius * scale;
        const angle = angleStep * index - Math.PI / 2;
        return {
            x: center + value * Math.cos(angle),
            y: center + value * Math.sin(angle)
        };
    };

    // 1. Background Polygons (Grid)
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
    const gridPolygons = gridLevels.map((scale) => {
        const points = Array.from({ length: numDimensions })
            .map((_, i) => {
                const p = getPoint(100, i, scale);
                return `${p.x},${p.y}`;
            })
            .join(' ');
        return points;
    });

    // 2. Data Polygon
    const dataPoints = dimensions
        .map((dim, i) => {
            const p = getPoint(data[dim] || 0, i);
            return `${p.x},${p.y}`;
        })
        .join(' ');

    // 3. Labels
    const labels = dimensions.map((dim, i) => {
        const p = getPoint(100, i, 1.2); // Increased offset for larger text
        let anchor = "middle";
        if (p.x < center - 10) anchor = "end";
        if (p.x > center + 10) anchor = "start";

        return (
            <text
                key={i}
                x={p.x}
                y={p.y}
                textAnchor={anchor}
                className="text-[10px] font-bold fill-gray-600 dark:fill-gray-300 uppercase tracking-tight cursor-help hover:fill-blue-600 transition-colors"
                style={{ fontSize: '9px' }}
            >
                <title>{descriptions[dim] || `Skor: ${data[dim]}`}</title>
                {dim}
            </text>
        );
    });

    return (
        <div className="flex items-center justify-center w-full h-full">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Grid Lines (Axes) */}
                {dimensions.map((_, i) => {
                    const p = getPoint(100, i);
                    return (
                        <line
                            key={`axis-${i}`}
                            x1={center}
                            y1={center}
                            x2={p.x}
                            y2={p.y}
                            className="stroke-gray-200 dark:stroke-gray-700"
                            strokeWidth="0.5"
                        />
                    );
                })}

                {/* Grid Polygons */}
                {gridPolygons.map((points, i) => (
                    <polygon
                        key={`grid-${i}`}
                        points={points}
                        className="fill-none stroke-gray-100 dark:stroke-gray-800"
                        strokeWidth="0.5"
                    />
                ))}

                {/* Data Area */}
                <polygon
                    points={dataPoints}
                    className="fill-blue-500/20 stroke-blue-500"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    style={{ transition: 'all 1s ease-in-out' }}
                />

                {/* Data Points (Dots) */}
                {dimensions.map((dim, i) => {
                    const p = getPoint(data[dim] || 0, i);
                    return (
                        <circle
                            key={`dot-${i}`}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            className="fill-blue-600 shadow-sm"
                        />
                    );
                })}

                {/* Center dot */}
                <circle cx={center} cy={center} r="1.5" className="fill-gray-300" />

                {labels}
            </svg>
        </div>
    );
};

export default RadarChart;
