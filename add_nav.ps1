$f = 'resources\js\components\DashboardLayout.jsx'
$c = Get-Content $f -Raw
# Add to NAV_CATEGORIES (admin) - after kartu-kendali in Analisis & Rekap
$c = $c -replace "(path: '/kartu-kendali' \}\s*\r?\n\s*\])\s*\r?\n\s*\}\s*,\s*\r?\n\s*\{\s*\r?\n\s*title: 'Sistem'", "`$1`n      { name: 'Laporan Orang Tua', icon: <FileText size={20} />, path: '/monitoring-laporan-ortu' }," + "`n  ]," + "`n  }," + "`n  {" + "`n    title: 'Sistem'"
Set-Content $f $c -NoNewline
Write-Host "Step 1 done"
