const fs = require('fs');
const path = require('path');

const dir = 'f:/app-firebase/sekolahPintar/smart-school-backend/resources/js/components/quiz/renderers';
const files = fs.readdirSync(dir);

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix broken exports/empty lines from partial regex matches
  content = content.replace(/export\s*>\s*;/g, '');
  content = content.replace(/export\s*;/g, '');
  
  // Remove dangling TS-like garbage that was left behind
  // e.g. "elements?: Array;" or "color?;" outside of objects
  content = content.replace(/^\s*[a-zA-Z0-9_]+\??:\s*[^;]+;\s*$/gm, '');
  content = content.replace(/^\s*[a-zA-Z0-9_]+\?;\s*$/gm, '');
  content = content.replace(/^\s*\}\s*$/gm, (match, offset, fullText) => {
      // Only remove if it's a "lonely" closing brace that likely belonged to a deleted interface
      // This is risky, but we can look for "const Component =" shortly after
      const following = fullText.substring(offset).substring(0, 100);
      if (following.includes('const ') || following.includes('function ')) {
          return '';
      }
      return match;
  });

  // Fix common errors in MathRenderer.jsx specifically
  if (file === 'MathRenderer.jsx') {
      content = content.replace(/graphObjects\[\] = \[\]/g, 'graphObjects = []');
  }

  // Final trim of double empty lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  fs.writeFileSync(filePath, content);
  console.log(`Deep cleaned ${file}`);
});
