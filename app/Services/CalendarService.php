<?php

namespace App\Services;

use Carbon\Carbon;
use App\Models\Holiday;

class CalendarService
{
    /**
     * Calculate effective weeks in a semester using ISO week iteration.
     * Each week is evaluated: count school days overlapping the month,
     * then check holiday overlap against threshold.
     */
    public function getEffectiveWeeks($academicYear, $semester)
    {
        $months = ($semester === 'Ganjil')
            ? [7, 8, 9, 10, 11, 12]
            : [1, 2, 3, 4, 5, 6];

        $years = explode('/', $academicYear);
        $result = [];
        $totalEffectiveWeeks = 0;

        // Fetch all holidays for the academic year range
        $yearStart = ($semester === 'Ganjil')
            ? Carbon::create($years[0], 7, 1)
            : Carbon::create($years[1], 1, 1);
        $yearEnd = ($semester === 'Ganjil')
            ? Carbon::create($years[0], 12, 31)
            : Carbon::create($years[1], 6, 30);
        $allHolidays = Holiday::whereBetween('date', [$yearStart, $yearEnd])->get();

        $schoolDaysCount = 6; // default, can be overridden per school
        $threshold = 4;

        foreach ($months as $month) {
            $year = ($month >= 7) ? $years[0] : $years[1];
            $monthStart = Carbon::create($year, $month, 1)->startOfMonth();
            $monthEnd = Carbon::create($year, $month, 1)->endOfMonth();

            $totalWeeks = 0;
            $nonEffectiveWeeks = 0;
            $holidayNotes = [];

            // Start from the ISO week containing the first day of month
            $weekStart = $monthStart->copy()->startOfWeek(Carbon::MONDAY);

            while ($weekStart->lessThanOrEqualTo($monthEnd)) {
                $weekEnd = $weekStart->copy()->endOfWeek(Carbon::SUNDAY);

                // Count school days in this week that fall within this month
                $schoolDaysInMonth = 0;
                $dayIter = $weekStart->copy();
                while ($dayIter->lessThanOrEqualTo($weekEnd)) {
                    if ($dayIter->month === $month) {
                        $d = $dayIter->dayOfWeek; // 0=Sun, 1=Mon...6=Sat
                        if ($d >= 1 && $d <= $schoolDaysCount) $schoolDaysInMonth++;
                    }
                    $dayIter->addDay();
                }

                // Only count as calendar week if enough school days in this month
                if ($schoolDaysInMonth >= $threshold) {
                    $totalWeeks++;

                    // Check if any holiday blocks this week
                    foreach ($allHolidays as $holiday) {
                        $hDate = Carbon::parse($holiday->date)->startOfDay();
                        $hEnd = $holiday->start_date && $holiday->end_date
                            ? Carbon::parse($holiday->end_date)->startOfDay()
                            : $hDate->copy();

                        $overlapStart = $weekStart->max($hDate);
                        $overlapEnd = $weekEnd->min($hEnd);

                        if ($overlapEnd->lessThan($overlapStart)) continue;

                        $overlapDays = $overlapEnd->diffInDays($overlapStart) + 1;

                        if ($overlapDays >= $threshold) {
                            $nonEffectiveWeeks++;
                            $title = $holiday->name ?? $holiday->title ?? '';
                            if ($title && !in_array($title, $holidayNotes)) {
                                $holidayNotes[] = $title;
                            }
                            break; // one holiday per week counted
                        }
                    }
                }

                $weekStart->addWeek();
            }

            $effectiveWeeks = max(0, $totalWeeks - $nonEffectiveWeeks);

            $result[] = [
                'month' => $monthStart->translatedFormat('F'),
                'total_weeks' => $totalWeeks,
                'non_effective_weeks' => $nonEffectiveWeeks,
                'effective_weeks' => $effectiveWeeks,
                'keterangan' => implode(', ', $holidayNotes),
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
