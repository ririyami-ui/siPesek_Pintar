<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\ClassAgreement;
use App\Models\Infraction;
use App\Models\Student;
use Illuminate\Support\Collection;

/**
 * Service to calculate a student's weighted final score based on Class Agreement and Infractions.
 */
class GradeCalculationService
{
    /**
     * Calculate comprehensive grades for a student.
     * 
     * @param Student $student The student model.
     * @param Collection $grades The raw Grade records associated with the student (filtered by semester/year if needed).
     * @param string|null $semester Optional semester filter for infractions
     * @param string|null $academicYear Optional academic year filter for infractions
     * @return array
     */
    public function calculateStudentGrades(Student $student, Collection $grades, $semester = null, $academicYear = null): array
    {
        // 1. Attendance Summary
        $attendanceQuery = Attendance::where('student_id', $student->id);
        if ($semester) $attendanceQuery->where('semester', $semester);
        if ($academicYear) $attendanceQuery->where('academic_year', $academicYear);
        
        $attendances = $attendanceQuery->get();
        $uniqueDates = $attendances->pluck('date')->unique();
        $numDays = $uniqueDates->count();

        $attendanceCounts = $attendances->groupBy('status')->map(function($group) {
            return $group->count();
        });

        $hadir = $attendanceCounts->get('hadir', 0);
        $sakit = $attendanceCounts->get('sakit', 0);
        $izin = $attendanceCounts->get('izin', 0);
        $alpa = $attendanceCounts->get('alpa', 0);
        $totalAttendance = $attendances->count();
        $attPct = $numDays > 0 ? ($hadir / $numDays) * 100 : 100;

        // 2. Infractions Summary
        $infractionsQuery = Infraction::where('student_id', $student->id);
        if ($semester) $infractionsQuery->where('semester', $semester);
        if ($academicYear) $infractionsQuery->where('academic_year', $academicYear);
        
        $infractions = $infractionsQuery->orderBy('date', 'desc')->get();
        $totalInfractionPoints = $infractions->sum('points');
        $penalty = $totalInfractionPoints;
        $infPenalty = ($totalInfractionPoints / 100) * 10;

        // 3. Class Agreement (Weights)
        $agreement = ClassAgreement::where('class_id', $student->class_id)->first();
        $wk = ($agreement->knowledge_weight ?? 40) / 100;
        $wp = ($agreement->practice_weight ?? 60) / 100;
        $wa = ($agreement->academic_weight ?? 50) / 100;
        $ws = ($agreement->attitude_weight ?? 50) / 100;

        // 4. Group by subject and calculate scores
        $bySubject = $grades->groupBy('subject_id')->map(function ($records, $subjectId) use ($penalty, $wk, $wp, $wa, $ws) {
            $subject = $records->first()->subject;
            $avg     = round($records->avg('score'), 2);

            $practiceScores  = $records->where('type', 'praktik');
            $attitudeScores  = $records->where('type', 'sikap');
            $knowledgeScores = $records->whereNotIn('type', ['praktik', 'sikap']);

            $avg_knowledge = $knowledgeScores->count() > 0 ? $knowledgeScores->avg('score') : 0;
            $avg_practice  = $practiceScores->count()  > 0 ? $practiceScores->avg('score')  : 0;

            $actual_wk = $knowledgeScores->count() > 0 ? $wk : 0;
            $actual_wp = $practiceScores->count()  > 0 ? $wp : 0;
            $total_academic_weight_used = $actual_wk + $actual_wp;

            $nilai_akademik = $total_academic_weight_used > 0 
                ? (($avg_knowledge * $actual_wk) + ($avg_practice * $actual_wp)) / $total_academic_weight_used 
                : 0;

            $base_attitude = $attitudeScores->count() > 0 ? $attitudeScores->avg('score') : 100;
            $nilai_sikap   = max(0, $base_attitude - $penalty);
            $nilai_akhir   = round(($nilai_akademik * $wa) + ($nilai_sikap * $ws), 2);

            $byType = $records->groupBy('type')->map(function ($typeRecords, $type) {
                return [
                    'type'     => $type,
                    'average'  => round($typeRecords->avg('score'), 2),
                    'count'    => $typeRecords->count(),
                    'records'  => $typeRecords->map(fn($g) => [
                        'id'    => $g->id,
                        'topic' => $g->topic,
                        'score' => (float)$g->score,
                        'date'  => $g->date?->toDateString(),
                        'notes' => $g->notes,
                    ])->values(),
                ];
            })->values();

            // Trend Calculation
            $latestGrade = $records->sortByDesc('date')->first();
            $prevAvg     = $records->count() > 1 
                ? ($records->sum('score') - $latestGrade->score) / ($records->count() - 1)
                : $latestGrade->score;
            
            $trend = 'stable';
            if ($latestGrade->score > $prevAvg + 2) $trend = 'up';
            elseif ($latestGrade->score < $prevAvg - 2) $trend = 'down';

            return [
                'subject_id'      => $subjectId,
                'subject_name'    => $subject?->name ?? 'Tanpa Mapel',
                'avg_knowledge'   => round($avg_knowledge, 2),
                'avg_practice'    => round($avg_practice, 2),
                'nilai_akademik'  => round($nilai_akademik, 2),
                'nilai_sikap'     => round($nilai_sikap, 2),
                'nilai_akhir'     => $nilai_akhir,
                'trend'           => $trend,
                'total_input'     => $records->count(),
                'by_type'         => $byType,
            ];
        })->values();

        // 5. Radar Mapping (Profil Pelajar Pancasila) - Consistent with RekapIndividuPage.jsx
        $academicAvg = $bySubject->count() > 0 ? $bySubject->avg('nilai_akademik') : 75;
        $knowledgeAvg = $bySubject->count() > 0 ? $bySubject->avg('avg_knowledge') : 75;
        $practiceAvg = $bySubject->count() > 0 ? $bySubject->avg('avg_practice') : 75;
        $attitudeAvg = $bySubject->count() > 0 ? $bySubject->avg('nilai_sikap') : (100 - $penalty);

        $radarData = [
            "Keimanan"         => round(min(100, max(50, 95 - $infPenalty)), 1),
            "Kewargaan"        => round(min(100, max(50, $attPct * 0.6 + (100 - $infPenalty) * 0.4)), 1),
            "Penalaran Kritis" => round($knowledgeAvg, 1),
            "Kreativitas"      => round($practiceAvg, 1),
            "Kolaborasi"       => round(min(100, ($knowledgeAvg * 0.3 + $practiceAvg * 0.7)), 1),
            "Kemandirian"      => round(min(100, max(40, $attPct * 0.4 + ($knowledgeAvg + $practiceAvg) / 2 * 0.6)), 1),
            "Kesehatan"        => round(min(100, max(30, 100 - ($sakit * 5))), 1),
            "Komunikasi"       => round($practiceAvg, 1)
        ];

        // 6. Early Warning Logic
        $warnings = [];
        $overallNilaiAkhir = $bySubject->count() > 0 ? round($bySubject->avg('nilai_akhir'), 2) : 0;
        
        if ($overallNilaiAkhir < 65 && $bySubject->count() > 0) {
            $warnings[] = "Rata-rata akademik rendah ($overallNilaiAkhir)";
        }
        if ($alpa >= 3) {
            $warnings[] = "$alpa kali Alpa (Tanpa Keterangan)";
        }
        if ($attitudeAvg < 70) {
            $warnings[] = "Skor sikap sangat kurang (" . round($attitudeAvg, 1) . ")";
        }

        return [
            'by_subject' => $bySubject,
            'weights' => [
                'knowledge' => ($agreement->knowledge_weight ?? 40),
                'practice'  => ($agreement->practice_weight ?? 60),
                'academic'  => ($agreement->academic_weight ?? 50),
                'attitude'  => ($agreement->attitude_weight ?? 50),
            ],
            'attendance_summary' => [
                'hadir' => $hadir,
                'sakit' => $sakit,
                'izin'  => $izin,
                'alpa'  => $alpa,
                'total' => $totalAttendance,
                'pct_hadir' => round($attPct, 1),
                'school_days' => $numDays
            ],
            'infraction_summary' => [
                'total_points' => $totalInfractionPoints,
                'penalty'      => $penalty,
                'count'        => $infractions->count(),
            ],
            'radar_data' => $radarData,
            'warnings'   => $warnings,
            'overall_nilai_akhir' => $overallNilaiAkhir
        ];
    }
}
