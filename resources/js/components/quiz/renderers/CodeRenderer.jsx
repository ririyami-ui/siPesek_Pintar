import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CodeRenderer = ({ config }) => {
  return (
    <SyntaxHighlighter language={config.language || 'text'} style={vscDarkPlus}>
      {config.code}
    </SyntaxHighlighter>
  );
};

export default CodeRenderer;
