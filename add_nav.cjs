const fs = require('fs');
const f = fs.readFileSync('resources/js/components/DashboardLayout.jsx','utf8');
const nav = "      { name: 'Laporan Orang Tua', icon: <FileText size={20} />, path: '/monitoring-laporan-ortu' },\n";
// Add to NAV_CATEGORIES (admin) after Kartu Kendali
let r = f.replace(/({ name: 'Kartu Kendali Tugas',[^}]+},)/g, nav + '$1');
// Add to TEACHER_NAV_CATEGORIES (teacher) after Kartu Kendali
r = r.replace(/({ name: 'Kartu Kendali Tugas',[^}]+},)/g, nav + '$1');
fs.writeFileSync('resources/js/components/DashboardLayout.jsx', r);
console.log('Injected successfully');
