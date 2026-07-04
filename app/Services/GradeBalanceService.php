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
        $attendanceStats = Attendance::where('student_id', $studentId)
            ->where('academic_year', $academicYear)
            ->where('semester', $semester)
            ->get()
            ->groupBy('status');
        
        $alphaCount = isset($attendanceStats['Alpha']) ? $attendanceStats['Alpha']->count() : 0;
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
