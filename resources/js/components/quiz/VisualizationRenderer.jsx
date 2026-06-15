import React, { Suspense } from 'react';
import { ImageIcon } from 'lucide-react';

// Lazy load the sub-components to optimize the bundle size
const ChartRenderer = React.lazy(() => import('./renderers/ChartRenderer'));
const MathRenderer = React.lazy(() => import('./renderers/MathRenderer'));
const MermaidRenderer = React.lazy(() => import('./renderers/MermaidRenderer'));
const ScratchRenderer = React.lazy(() => import('./renderers/ScratchRenderer'));
const LogicRenderer = React.lazy(() => import('./renderers/LogicRenderer'));
const ChemistryRenderer = React.lazy(() => import('./renderers/ChemistryRenderer'));
const MusicRenderer = React.lazy(() => import('./renderers/MusicRenderer'));
const SpreadsheetRenderer = React.lazy(() => import('./renderers/SpreadsheetRenderer'));
const CodeRenderer = React.lazy(() => import('./renderers/CodeRenderer'));
const GeometryRenderer = React.lazy(() => import('./renderers/GeometryRenderer'));
const MapRenderer = React.lazy(() => import('./renderers/MapRenderer'));
const Model3DRenderer = React.lazy(() => import('./renderers/Model3DRenderer'));
const MindMapRenderer = React.lazy(() => import('./renderers/MindMapRenderer'));

// Premium skeleton loading fallback
const RenderingSkeleton = () => (
  <div className="my-4 p-6 border-2 border-blue-100 dark:border-blue-900/30 rounded-2xl bg-white dark:bg-gray-900 animate-pulse flex flex-col items-center justify-center min-h-[200px] shadow-sm">
    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center mb-3">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-36 mb-2"></div>
    <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded w-24"></div>
  </div>
);

const VisualizationRenderer = ({ visualization }) => {
  // Guard against empty/invalid visualization objects from AI
  if (!visualization || !visualization.type || !visualization.config || Object.keys(visualization.config).length === 0) {
    return null;
  }

  console.log("Rendering Visualization:", visualization); // DEBUG: Cek data dari AI
  // ── MATHEMATICAL & GEOMETRY (JSXGraph/Mafs) ──────────────────────────────
  if (visualization.type === 'function' || visualization.type === 'geometry' || visualization.type === 'math') {
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <MathRenderer config={visualization.config} />
      </Suspense>
    );
  }

  // ── DATA CHART (Chart.js) ───────────────────────────────────────────────
  if (visualization.type === 'chart') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <ChartRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── DIAGRAMS (Mermaid) ──────────────────────────────────────────────────
  if (visualization.type === 'diagram' || visualization.type === 'mermaid') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <MermaidRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── IMAGE PLACEHOLDER ───────────────────────────────────────────────────
  if (visualization.type === 'image') {
    const cleanText = (visualization.config.description || '').trim().replace(/^\[+/, '').replace(/\]+$/, '');
    return (
      <div className="my-2 text-sm text-gray-500 italic flex items-center gap-1.5">
        <ImageIcon className="w-4 h-4 text-gray-400" />
        <span>[{cleanText}]</span>
      </div>
    );
  }

  // ── SCRATCH BLOCKS ──────────────────────────────────────────────────────
  if (visualization.type === 'scratch') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <ScratchRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── LOGIC GATES (SVG ANSI) ──────────────────────────────────────────────
  if (visualization.type === 'logic') {
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <LogicRenderer config={visualization.config} />
      </Suspense>
    );
  }

  // ── CHEMISTRY (SMILES) ──────────────────────────────────────────────────
  if (visualization.type === 'chemistry') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <ChemistryRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── MUSIC (ABC Notation) ────────────────────────────────────────────────
  if (visualization.type === 'music') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <MusicRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── SPREADSHEET (Excel Grid) ─────────────────────────────────────────────
  if (visualization.type === 'spreadsheet') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <SpreadsheetRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── CODE (Syntax Highlighting) ───────────────────────────────────────────
  if (visualization.type === 'code') {
    const cfg = visualization.config;
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <CodeRenderer config={cfg} />
      </Suspense>
    );
  }

  // ── MAPS (Leaflet) ───────────────────────────────────────────────────────
  if (visualization.type === 'map') {
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <MapRenderer config={visualization.config} />
      </Suspense>
    );
  }

  // ── 3D MODELS (React Three Fiber) ────────────────────────────────────────
  if (visualization.type === '3d_model') {
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <Model3DRenderer config={visualization.config} />
      </Suspense>
    );
  }

  // ── MIND MAP (React Flow) ────────────────────────────────────────────────
  if (visualization.type === 'mindmap') {
    return (
      <Suspense fallback={<RenderingSkeleton />}>
        <MindMapRenderer config={visualization.config} />
      </Suspense>
    );
  }

  return null;
};

export default VisualizationRenderer;
