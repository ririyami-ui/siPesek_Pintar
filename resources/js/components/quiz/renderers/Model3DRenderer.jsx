import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Sphere, Cylinder, Text } from '@react-three/drei';

const Model3DRenderer = ({ config }) => {
  return (
    <div className="relative group">
      <div style={{ height: '400px', background: '#f8fafc', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Suspense fallback={null}>
            {config.shapes?.map((shape, idx) => (
              <group key={idx} position={shape.position || [0, 0, 0]}>
                {shape.type === 'box' && <Box args={shape.args || [1, 1, 1]}><meshStandardMaterial color={shape.color || '#6366f1'} /></Box>}
                {shape.type === 'sphere' && <Sphere args={shape.args || [1, 32, 32]}><meshStandardMaterial color={shape.color || '#8b5cf6'} /></Sphere>}
                {shape.type === 'cylinder' && <Cylinder args={shape.args || [1, 1, 2, 32]}><meshStandardMaterial color={shape.color || '#ec4899'} /></Cylinder>}
                {shape.label && <Text position={[0, 1.5, 0]} fontSize={0.4} color="black" anchorX="center" anchorY="middle">{shape.label}</Text>}
              </group>
            ))}
          </Suspense>
          <OrbitControls enableDamping />
        </Canvas>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/80 backdrop-blur text-[10px] font-bold text-gray-500 rounded-full border border-gray-200 shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        DRAG TO ROTATE • SCROLL TO ZOOM
      </div>
    </div>
  );
};

export default Model3DRenderer;
