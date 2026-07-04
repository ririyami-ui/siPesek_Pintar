<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'smart_school';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

// 1. Calendar structure records
$result = $conn->query("SELECT id, user_id, grade_level, type, pekan_efektif FROM teaching_programs WHERE type = 'calendar_structure' ORDER BY grade_level");
if ($result->num_rows > 0) {
    echo "=== CALENDAR STRUCTURE ===\n";
    while ($row = $result->fetch_assoc()) {
        echo "ID: {$row['id']} | Grade: {$row['grade_level']}\n";
        $data = json_decode($row['pekan_efektif'], true);
        if ($data) {
            foreach ($data as $m) {
                $total = $m['totalWeeks'] ?? '?';
                $nonEff = $m['nonEffectiveWeeks'] ?? 0;
                $indices = isset($m['nonEffectiveWeekIndices']) ? json_encode($m['nonEffectiveWeekIndices']) : '[]';
                echo "  {$m['name']}: total={$total} nonEff={$nonEff} indices={$indices}\n";
            }
        } else {
            echo "  (null/invalid JSON)\n";
        }
    }
} else {
    echo "No calendar_structure records.\n";
}

// 2. Subject programs (JP per week)
echo "\n=== SUBJECT PROGRAMS ===\n";
$r2 = $conn->query("SELECT id, grade_level, subject_id, jp_per_week, total_effective_weeks, total_effective_hours FROM teaching_programs WHERE type = 'subject_program' ORDER BY grade_level");
if ($r2->num_rows > 0) {
    while ($row = $r2->fetch_assoc()) {
        echo "ID: {$row['id']} | Grade: {$row['grade_level']} | Subject: {$row['subject_id']} | JP: {$row['jp_per_week']} | Weeks: {$row['total_effective_weeks']} | Hours: {$row['total_effective_hours']}\n";
    }
} else {
    echo "No subject_program records.\n";
}

// 3. Holidays
$r3 = $conn->query("SELECT COUNT(*) AS cnt FROM holidays");
$row3 = $r3->fetch_assoc();
echo "\n=== HOLIDAYS ===\nTotal: {$row3['cnt']}\n";
$r3b = $conn->query("SELECT id, title, name, date, start_date, end_date, type, category FROM holidays ORDER BY start_date DESC LIMIT 10");
if ($r3b->num_rows > 0) {
    while ($row = $r3b->fetch_assoc()) {
        echo "  {$row['id']}: {$row['title']}{$row['name']} ({$row['start_date']} - {$row['end_date']}) type={$row['type']} cat={$row['category']}\n";
    }
}

// 4. School days setting
$r4 = $conn->query("SELECT id, user_id, school_days FROM user_profiles WHERE school_days IS NOT NULL LIMIT 3");
echo "\n=== SCHOOL DAYS SETTING ===\n";
if ($r4->num_rows > 0) {
    while ($row = $r4->fetch_assoc()) {
        echo "  User {$row['user_id']}: {$row['school_days']} days\n";
    }
}

$conn->close();
