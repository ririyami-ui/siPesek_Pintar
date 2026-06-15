const fs = require('fs');
const path = require('path');

const dir = 'f:/app-firebase/sekolahPintar/smart-school-backend/resources/js/components/quiz/renderers';
const files = fs.readdirSync(dir);

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix broken exports like "export >;" or "export ;"
  content = content.replace(/export\s*>\s*;/g, '');
  content = content.replace(/export\s*;/g, '');
  
  // Remove React.FC and other TS type annotations in components
  // Match const Name: React.FC = ... or const Name: React.FC<Props> = ...
  content = content.replace(/:\s*React\.FC(\s*<[^>]+>)?/g, '');
  
  // Remove interface/type definitions if they exist in JSX
  content = content.replace(/interface\s+\w+\s*\{[\s\S]*?\}/g, '');
  content = content.replace(/type\s+\w+\s*=\s*[\s\S]*?;/g, '');

  fs.writeFileSync(filePath, content);
  console.log(`Cleaned ${file}`);
});

// Fix PortfolioPage specifically
const portfolioPath = 'f:/app-firebase/sekolahPintar/smart-school-backend/resources/js/pages/PortfolioPage.jsx';
if (fs.existsSync(portfolioPath)) {
    let pContent = fs.readFileSync(portfolioPath, 'utf8');
    pContent = pContent.replace(/:\s*Chapter\[\]/g, '');
    fs.writeFileSync(portfolioPath, pContent);
    console.log('Cleaned PortfolioPage.jsx');
}
