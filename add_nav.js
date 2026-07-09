import fs from 'fs';
let content = fs.readFileSync('resources/js/components/DashboardLayout.jsx','utf8');
// 1. Remove duplicate Laporan line in admin section (keep only one)
content = content.replace(/({ name: 'Laporan Orang Tua', icon: <FileText size={20} \/>, path: '\/monitoring-laporan-ortu' },)\s*\n\s*{ name: 'Laporan Orang Tua'/,
  (match, p1) => p1 + ' { name: \'Laporan Orang Tua\', icon: <FileText size={20} />, path: \'/monitoring-laporan-ortu\' },');
// Actually simpler: replace double occurrence with single
content = content.replace(/({ name: 'Laporan Orang Tua', icon: <FileText size={20} \/>, path: '\/monitoring-laporan-ortu' },)\s*\n\s*\1/, '$1');
// 2. Insert Laporan into teacher nav (after Kartu Kendali)
const navLine = "      { name: 'Laporan Orang Tua', icon: <FileText size={20} />, path: '/monitoring-laporan-ortu' },\n";
content = content.replace(/(path: '\/kartu-kendali' },\n)(\s*\])/,'$1' + navLine + '$2');
fs.writeFileSync('resources/js/components/DashboardLayout.jsx', content);
const count = (content.match(/Laporan Orang Tua/g)||[]).length;
console.log('Laporan items count:', count);
