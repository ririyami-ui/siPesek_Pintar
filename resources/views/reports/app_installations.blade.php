<!DOCTYPE html>
<html>
<head>
    <title>Rekap Instalasi Aplikasi</title>
    <style>
        body { font-family: sans-serif; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 20px; }
        .header p { margin: 0; font-size: 12px; color: #555; }
        .status-installed { color: green; font-weight: bold; }
        .status-not_installed { color: red; font-weight: bold; }
        .status-active { color: blue; font-weight: bold; }
        .status-inactive { color: gray; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rekap Status Instalasi Aplikasi Siswa</h1>
        <p>Data per: {{ date('d F Y H:i:s') }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>No</th>
                <th>Nama Siswa</th>
                <th>NISN</th>
                <th>Kelas</th>
                <th>Status Instalasi</th>
                <th>Status Push Notif</th>
            </tr>
        </thead>
        <tbody>
            @foreach($students as $index => $student)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $student['name'] }}</td>
                    <td>{{ $student['nisn'] }}</td>
                    <td>{{ $student['class'] }}</td>
                    <td>
                        <span class="{{ $student['installation_status'] === 'installed' ? 'status-installed' : 'status-not_installed' }}">
                            {{ $student['installation_status'] === 'installed' ? 'Terinstal' : 'Belum Instal' }}
                        </span>
                    </td>
                    <td>
                        <span class="{{ $student['push_status'] === 'active' ? 'status-active' : 'status-inactive' }}">
                            {{ $student['push_status'] === 'active' ? 'Aktif' : 'Tidak Aktif' }}
                        </span>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
</body>
</html>
