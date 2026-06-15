import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const MindMapRenderer = ({ config }) => {
  const initialNodes = useMemo(() => (config.nodes || []).map((n) => ({
    id: n.id,
    data: { label: n.label },
    position: n.position || { x: Math.random() * 400, y: Math.random() * 400 },
    type: n.type || 'default',
  })), [config.nodes]);

  const initialEdges = useMemo(() => (config.edges || []).map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    animated: e.animated !== false,
    label: e.label,
  })), [config.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '500px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default MindMapRenderer;
