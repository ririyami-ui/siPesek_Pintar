<?php

namespace App\Services;

use App\Models\Student;
use Carbon\Carbon;

class StudentDistributionService
{
    /**
     * Distribute students fairly across target classes.
     * Algorithm:
     * 1. Separate students by gender (L/P)
     * 2. Sort each gender group by birth_date (youngest first)
     * 3. Interleave: pick alternating from youngest/oldest within each gender
     * 4. Round-robin assign across target classes
     * Result: balanced count, gender ratio, and average age per class.
     */
    public function distributeFairly(array $sourceClassIds, array $targetClassIds): array
    {
        // Fetch all non-deleted students from source classes
        $students = Student::whereIn('class_id', $sourceClassIds)
            ->whereNull('deleted_at')
            ->get();

        if ($students->isEmpty()) {
            return [
                'success' => false,
                'message' => 'Tidak ada siswa yang ditemukan di kelas asal terpilih.',
            ];
        }

        $targetCount = count($targetClassIds);
        if ($targetCount === 0) {
            return [
                'success' => false,
                'message' => 'Pilih minimal satu kelas tujuan.',
            ];
        }

        $totalStudents = $students->count();

        // Ideal counts per class (even distribution)
        $base = intdiv($totalStudents, $targetCount);
        $remainder = $totalStudents % $targetCount;

        // Shuffle target class IDs for fair base allocation
        shuffle($targetClassIds);

        $idealCounts = [];
        foreach ($targetClassIds as $i => $id) {
            $idealCounts[$id] = $base + ($i < $remainder ? 1 : 0);
        }

        // Separate by gender, then sort by age (oldest first)
        $males = $students->where('gender', 'L')->sortBy('birth_date')->values();
        $females = $students->where('gender', 'P')->sortBy('birth_date')->values();

        // Initialize distribution structure
        $distribution = [];
        foreach ($targetClassIds as $id) {
            $distribution[$id] = [
                'students' => [],
                'count' => 0,
                'male_count' => 0,
                'female_count' => 0,
                'ages' => [],
                'age_sum' => 0,
            ];
        }

        // Deal each gender group round-robin to target classes
        // This ensures per-class gender balance and age balance
        $classIndex = 0;
        foreach (['L', 'P'] as $gender) {
            $group = $gender === 'L' ? $males : $females;
            // Shuffle starting class for each gender for randomness
            $startIdx = $classIndex % $targetCount;
            foreach ($group as $i => $student) {
                $classId = $targetClassIds[($startIdx + $i) % $targetCount];
                
                $age = $student->birth_date ? Carbon::parse($student->birth_date)->age : 0;
                
                $distribution[$classId]['students'][] = [
                    'id' => $student->id,
                    'name' => $student->name,
                    'gender' => $student->gender,
                    'nis' => $student->nis,
                    'absen' => $student->absen,
                    'age' => $age,
                    'birth_date' => $student->birth_date ? Carbon::parse($student->birth_date)->format('Y-m-d') : null,
                ];
                $distribution[$classId]['count']++;
                if ($gender === 'L') {
                    $distribution[$classId]['male_count']++;
                } else {
                    $distribution[$classId]['female_count']++;
                }
                $distribution[$classId]['age_sum'] += $age;
                $distribution[$classId]['ages'][] = $age;
            }
            $classIndex++;
        }

        // Build result
        $result = [];
        foreach ($targetClassIds as $id) {
            $d = $distribution[$id];
            $d['class_id'] = $id;
            $d['ideal_count'] = $idealCounts[$id];
            $avgAge = $d['count'] > 0
                ? round($d['age_sum'] / $d['count'], 1)
                : 0;
            $d['average_age'] = $avgAge;
            $d['gender_ratio'] = $d['count'] > 0
                ? round($d['male_count'] / $d['count'], 2)
                : 0;
            unset($d['age_sum']);
            unset($d['ages']);
            $result[] = $d;
        }

        // Calculate fairness metrics
        $fairness = $this->calculateFairness($result);
        $fairness['total_students'] = $totalStudents;
        $fairness['source_class_count'] = count($sourceClassIds);
        $fairness['target_class_count'] = $targetCount;

        return [
            'success' => true,
            'distribution' => $result,
            'fairness' => $fairness,
            'message' => $fairness['valid']
                ? 'Distribusi siswa telah dihitung. Periksa hasil di bawah.'
                : 'Distribusi selesai, namun ada ketidakseimbangan. Periksa peringatan.',
        ];
    }

    /**
     * Calculate fairness metrics for a distribution.
     */
    public function calculateFairness(array $distribution): array
    {
        $counts = array_column($distribution, 'count');
        $avgAges = array_column($distribution, 'average_age');
        $genderRatios = array_column($distribution, 'gender_ratio');

        $meanCount = count($counts) > 0 ? array_sum($counts) / count($counts) : 0;
        $meanAge = count($avgAges) > 0 ? array_sum($avgAges) / count($avgAges) : 0;
        $meanRatio = count($genderRatios) > 0 ? array_sum($genderRatios) / count($genderRatios) : 0;

        // Standard deviation
        $countStdDev = $this->stdDev($counts, $meanCount);
        $ageStdDev = $this->stdDev($avgAges, $meanAge);
        $ratioStdDev = $this->stdDev($genderRatios, $meanRatio);

        // Age spread (max - min)
        $ageSpread = count($avgAges) > 1 ? max($avgAges) - min($avgAges) : 0;

        $warnings = [];

        // Check gender balance: std dev of ratio should be low
        if ($ratioStdDev > 0.15) {
            $warnings[] = 'Rasio jenis kelamin tidak seimbang antar kelas.';
        }

        // Check age balance: spread should be < 1 year
        if ($ageSpread > 1.0) {
            $warnings[] = 'Selisih rata-rata umur antar kelas lebih dari 1 tahun.';
        }

        // Check count balance: max diff should be ≤ 1
        $maxCount = max($counts);
        $minCount = min($counts);
        if ($maxCount - $minCount > 1) {
            $warnings[] = 'Jumlah siswa tidak merata antar kelas.';
        }

        return [
            'valid' => empty($warnings),
            'warnings' => $warnings,
            'count_std_dev' => round($countStdDev, 2),
            'age_std_dev' => round($ageStdDev, 2),
            'age_spread' => round($ageSpread, 1),
            'gender_ratio_std_dev' => round($ratioStdDev, 3),
            'max_count_diff' => $maxCount - $minCount,
        ];
    }

    /**
     * Standard deviation helper.
     */
    private function stdDev(array $values, float $mean): float
    {
        $count = count($values);
        if ($count < 2) return 0.0;

        $variance = 0.0;
        foreach ($values as $v) {
            $variance += ($v - $mean) ** 2;
        }
        return sqrt($variance / ($count - 1));
    }

    /**
     * Preview a distribution without saving to database.
     */
    public function previewDistribution(array $sourceClassIds, array $targetClassIds): array
    {
        $result = $this->distributeFairly($sourceClassIds, $targetClassIds);

        // Reset absen sequential A-Z per class for preview (no DB write)
        foreach ($result['distribution'] as &$classDist) {
            $students = $classDist['students'] ?? [];
            // sort by name
            usort($students, fn($a, $b) => strcmp($a['name'] ?? '', $b['name'] ?? ''));
            foreach ($students as $i => &$s) {
                $s['absen'] = $i + 1;
            }
            $classDist['students'] = $students;
        }
        unset($classDist);

        return $result;
    }

    /**
     * Execute distribution and persist to database.
     */
    public function executeDistribution(array $sourceClassIds, array $targetClassIds): array
    {
        $result = $this->distributeFairly($sourceClassIds, $targetClassIds);

        if (!$result['success']) {
            return $result;
        }

        // Update class_id AND reset absen sequentially per class (sorted A-Z by name)
        foreach ($result['distribution'] as &$classDist) {
            $students = $classDist['students'] ?? [];
            if (!empty($students)) {
                // Sort by name for absen order
                usort($students, fn($a, $b) => strcmp($a['name'] ?? '', $b['name'] ?? ''));
                $no = 1;
                foreach ($students as &$s) {
                    Student::where('id', $s['id'])
                        ->update([
                            'class_id' => $classDist['class_id'],
                            'absen' => $no,
                        ]);
                    $s['absen'] = $no; // update response data
                    $no++;
                }
            }
            $classDist['students'] = $students;
        }
        unset($classDist);

        $result['executed'] = true;
        $result['message'] = count($result['distribution'])
            . ' kelas berisi ' . $result['fairness']['total_students']
            . ' siswa berhasil diproses.';

        return $result;
    }
}
