<?php

namespace App\Services;

use Carbon\Carbon;
use App\Models\Holiday;

class CalendarService
{
    /**
     * Calculate effective weeks in a semester
     */
    public function getEffectiveWeeks($academicYear, $semester)
    {
        // Define months for each semester
        $months = ($semester === 'Ganjil') 
            ? [7, 8, 9, 10, 11, 12] 
            : [1, 2, 3, 4, 5, 6];
        
        $years = explode('/', $academicYear);
        $result = [];
        $totalEffectiveWeeks = 0;

        foreach ($months as $month) {
            $year = ($month >= 7) ? $years[0] : $years[1];
            $startDate = Carbon::create($year, $month, 1)->startOfMonth();
            $endDate = Carbon::create($year, $month, 1)->endOfMonth();
            
            $totalWeeks = $startDate->diffInWeeks($endDate) + 1;
            
            // Fetch holidays in this month
            $holidaysCount = Holiday::whereMonth('date', $month)
                ->whereYear('date', $year)
                ->count();
            
            // Simple heuristic: if more than 3 holidays in a week, it's non-effective
            // This can be refined based on specific school rules
            $nonEffectiveWeeks = floor($holidaysCount / 3); 
            $effectiveWeeks = max(0, $totalWeeks - $nonEffectiveWeeks);
            
            $result[] = [
                'month' => $startDate->translatedFormat('F'),
                'total_weeks' => $totalWeeks,
                'non_effective_weeks' => $nonEffectiveWeeks,
                'effective_weeks' => $effectiveWeeks,
            ];
            
            $totalEffectiveWeeks += $effectiveWeeks;
        }

        return [
            'details' => $result,
            'total_effective_weeks' => $totalEffectiveWeeks,
            'academic_year' => $academicYear,
            'semester' => $semester,
        ];
    }
}
