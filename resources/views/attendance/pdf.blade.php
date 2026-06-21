<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Rekap Absensi {{ $class->rombel }} - {{ $semester }}</title>
    <style>
        body { font-family: 'Helvetica', sans-serif; font-size: 9pt; color: #333; margin: 0; padding: 0; }
        .header { margin-bottom: 20px; }
        .header h1 { font-size: 14pt; margin: 0; text-transform: uppercase; }
        .header p { margin: 2px 0; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
        th, td { border: 1px solid #000; padding: 4px; text-align: center; word-wrap: break-word; }
        th { background: #f2f2f2; font-weight: bold; }
        .text-left { text-align: left; }
        .bg-gray { background: #fafafa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>REKAPITULASI DAFTAR HADIR SISWA</h1>
        <p>{{ $schoolName }}</p>
        <div style="margin-top: 10px;">
            <table style="border: none; width: auto; margin: 0;">
                <tr style="border: none;">
                    <td style="border: none; text-align: left; padding: 0 20px 0 0;">Kelas: {{ $class->rombel }}</td>
                    <td style="border: none; text-align: left; padding: 0;">Tahun Pelajaran: {{ $academicYear }}</td>
                </tr>
                <tr style="border: none;">
                    <td style="border: none; text-align: left; padding: 0 20px 0 0;">Periode: {{ $period }}</td>
                    <td style="border: none; text-align: left; padding: 0;">Semester: {{ $semester }}</td>
                </tr>
            </table>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;">No</th>
                <th style="width: 100px;">NISN</th>
                <th style="width: 250px;">Nama Siswa</th>
                @foreach($dates as $date)
                    <th style="width: 25px; font-size: 7pt;">{{ $date->format('d/m') }}</th>
                @endforeach
                <th style="width: 20px;">S</th>
                <th style="width: 20px;">I</th>
                <th style="width: 20px;">A</th>
            </tr>
        </thead>
        <tbody>
            @foreach($students as $index => $student)
                <tr>
                    <td>{{ $student->absen ?? ($index + 1) }}</td>
                    <td>{{ $student->nisn ?? $student->nis }}</td>
                    <td class="text-left">{{ $student->name }}</td>
                    @foreach($dates as $date)
                        @php
                            $studentMap = $attMap[$student->id] ?? [];
                            $status = $studentMap[$date->format('Y-m-d')] ?? '';
                            $display = '';
                            if ($status === 'H') $display = '•';
                            elseif ($status === 'S') $display = 'S';
                            elseif ($status === 'I') $display = 'I';
                            elseif ($status === 'A') $display = 'A';
                        @endphp
                        <td>{{ $display }}</td>
                    @endforeach
                    @php
                        $summary = $summaryMap[$student->id] ?? [];
                    @endphp
                    <td class="bg-gray">{{ $summary['S'] ?? '-' }}</td>
                    <td class="bg-gray">{{ $summary['I'] ?? '-' }}</td>
                    <td class="bg-gray">{{ $summary['A'] ?? '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
    <div style="margin-top:30px; text-align:center;">
        <p>Mengetahui,</p>
        <p>Wali Kelas {{ $class->rombel }}</p>
        <br><br><br>
        <p style="text-decoration:underline; font-weight:bold;">{{ $waliName }}</p>
        <p>NIP: {{ $class->wali?->nip ?? '' }}</p>
    </div>
</body>
</html>

