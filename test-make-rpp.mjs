import fs from 'fs';
import katex from 'katex';

// Simulate a realistic RPP like the user's: inline + display equations,
// including ones inside list items and paragraph text.
const eqs = [
  ['inline', '\\triangle ABC'],
  ['inline', 'A(x, y)'],
  ['inline', 'k = 2'],
  ['inline', 'P(0, 0)'],
  ['inline', '\\frac{1}{2}'],
  ['inline', '\\sqrt{72} + \\sqrt{50} - \\sqrt{8}'],
  ['display', '\\frac{5}{3}'],
  ['display', 'V = \\frac{4}{3} \\pi r^3'],
];

const blocks = eqs.map(([mode, latex]) => {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode: mode === 'display' });
  if (mode === 'display') {
    return `<p><span class="katex-display">${html}</span></p>`;
  }
  return `<p>Nilai [Equation placeholder] adalah ${html} satuan.</p>`;
});

// Replicate RppDocxService::wrapHtml wrapper output structure
const full = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 2cm; }
        h1 { text-align: center; text-transform: uppercase; font-size: 14pt; border-bottom: 3px double #000; padding-bottom: 5px; }
        h2 { text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 12pt; margin-top: 20px; }
        h3 { border-bottom: 1px solid #ccc; padding-bottom: 2px; font-size: 11pt; margin-top: 15px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid black; padding: 8px; font-size: 11pt; color: #000; }
        th { background-color: #f0f0f0; font-weight: bold; }
        p { margin-bottom: 10px; text-align: justify; }
        ol, ul { padding-left: 30px; }
        li { margin-bottom: 5px; }
        .signature-table td, .signature-table th { border: none !important; }
        .mermaid, svg, [data-mermaid] { display: none; }
        .katex, .katex-display { display: inline; }
    </style>
</head>
<body>
<h2>Soal A</h2>
<p>Kasus: Sebuah motif dasar berbentuk segitiga dengan titik sudut ${eqs[0][1]}, ${eqs[1][1]} dan ${eqs[2][1]}. Dilatasi faktor ${eqs[3][1]} terhadap pusat ${eqs[4][1]}.</p>
<ul>
<li>Diskusi 1</li>
<li>Linap = ${eqs[5][1]}</li>
<li>Diskusi 2</li>
</ul>
${blocks.join('\n')}
<table class="signature-table">
<tr><td align="center">Mengetahui</td></tr>
</table>
</body>
</html>`;

fs.writeFileSync('C:/Users/DiTa/AppData/Local/Temp/opencode/test-rpp-fulle.html', full);
console.log('written, length', full.length, 'eq count', eqs.length);