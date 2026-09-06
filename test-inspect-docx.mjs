import fs from 'fs';
const { default: JSZip } = await import('jszip');

for (const f of ['test-rpp-fulle', 'test-rpp-math']) {
  const buf = fs.readFileSync(`C:/Users/DiTa/AppData/Local/Temp/opencode/${f}.docx`);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const oMath = (xml.match(/<m:oMath\b/g) || []).length;
  const eqPlaceholder = (xml.match(/\[Equation\s+\d+\]/g) || []).length;
  console.log(`${f}: oMath=${oMath}, "[Equation N]"=`, eqPlaceholder);
  if (f === 'test-rpp-fulle') {
    const mstart = xml.indexOf('<m:oMath');
    console.log('sample oMath xml:', xml.slice(mstart, mstart + 300));
  }
}