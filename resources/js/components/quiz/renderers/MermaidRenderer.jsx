import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const MermaidRenderer = ({ config }) => {
  const content = config?.diagram || config?.code;
  const containerRef = useRef(null);
  const elementId = useRef('mermaid-' + Math.random().toString(36).substr(2, 9)).current;

  useEffect(() => {
    mermaid.initialize({ 
      startOnLoad: true, 
      theme: 'default', 
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif'
    });
  }, []);

  useEffect(() => {
    if (content && containerRef.current) {
      containerRef.current.innerHTML = content;
      containerRef.current.removeAttribute('data-processed');
      try {
        mermaid.contentLoaded();
      } catch (e) {
        console.error("Mermaid error", e);
      }
    }
  }, [content]);

  if (!content) return null;

  return (
    <div className="mermaid-container bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex justify-center overflow-x-auto">
      <div ref={containerRef} className="mermaid" id={elementId}>
        {content}
      </div>
    </div>
  );
};

export default MermaidRenderer;
