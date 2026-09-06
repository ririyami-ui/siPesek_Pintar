<?php

namespace App\Services;

use App\Models\Grade;
use App\Models\Infraction;
use App\Models\Attendance;
use App\Models\Student;

class GradeBalanceService
{
    /**
     * Calculate balanced score between Knowledge (Grades) and Attitude (Infractions & Attendance)
     */
    public function calculateBalancedScore($studentId, $academicYear, $semester)
    {
        // 1. Knowledge Score (Average of grades)
        $avgGrade = Grade::where('student_id', $studentId)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->avg('score') ?: 0;

        // 2. Attitude Score (Base 100 - Infraction Points)
        $infractionPoints = Infraction::where('student_id', $studentId)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->sum('points');
        
        $attitudeBase = 100 - $infractionPoints;
        
        // 3. Attendance Factor
        // attendance table tidak memiliki kolom academic_year/semester.
        // Filter hanya berdasarkan tanggal yang berada dalam rentang semester.
        $semesterMonths = $semester === 'Ganjil'
            ? [7,8,9,10,11,12]
            : [1,2,3,4,5,6];
        $attendanceQuery = Attendance::where('student_id', $studentId)
            ->whereIn('date', function($q) use ($academicYear, $semesterMonths) {
                // Build date range: academicYear format "2023/2024"
                $years = explode('/', $academicYear);
                $yearStart = (int)$years[0];
                $yearEnd   = count($years) > 1 ? (int)$years[1] : $yearStart + 1;
                $months = $semesterMonths;
                $dates = [];
                foreach ($months as $m) {
                    $y = ($m >= 7) ? $yearStart : $yearEnd; // Ganjil uses start year, Genap uses next year
                    $dates[] = "{$y}-" . str_pad($m, 2, '0', STR_PAD_LEFT) . '-%'; // wildcard for day
                }
                // Use raw LIKE for each month pattern
                $q->where(function($sub) use ($dates) {
                    foreach ($dates as $pattern) {
                        $sub->orWhere('date', 'like', $pattern);
                    }
                });
            });
        $attendanceStats = $attendanceQuery->get()->groupBy('status');

        // status alpa selalu huruf kecil ('alpa'), bukan 'Alpha'
        $alphaCount = isset($attendanceStats['alpa']) ? $attendanceStats['alpa']->count() : 0;
        $attendancePenalty = $alphaCount * 2; // Penalty 2 points per Alpha
        
        $finalAttitudeScore = max(0, $attitudeBase - $attendancePenalty);

        // 4. Balanced Calculation (Knowledge 60%, Attitude 40% - adjustable)
        $balancedScore = ($avgGrade * 0.6) + ($finalAttitudeScore * 0.4);

        return [
            'knowledge_score' => round($avgGrade, 2),
            'attitude_score' => round($finalAttitudeScore, 2),
            'balanced_score' => round($balancedScore, 2),
            'predicate' => $this->getPredicate($finalAttitudeScore),
        ];
    }

    private function getPredicate($score)
    {
        if ($score >= 91) return 'Sangat Baik';
        if ($score >= 75) return 'Baik';
        if ($score >= 60) return 'Cukup';
        return 'Kurang';
    }
}
