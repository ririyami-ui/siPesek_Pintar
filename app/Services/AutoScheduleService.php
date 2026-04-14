<?php

namespace App\Services;

use App\Models\Subject;
use App\Models\Schedule;
use App\Models\Teacher;
use App\Models\TeacherAssignment;
use App\Models\UserProfile;
use App\Models\SchoolClass;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoScheduleService
{
    protected $adminUserId;
    protected $template;
    protected $teachingSlots = [];
    protected $errors = [];
    protected $occupiedTeachers = []; // [day][period][] = teacher_id
    protected $occupiedClasses = [];  // [day][period][] = class_id

    public function __construct($adminUserId)
    {
        $this->adminUserId = $adminUserId;
    }

    /**
     * Main entry point for auto generation
     */
    public function generate()
    {
        // 1. Prepare template and available slots
        if (!$this->prepareTemplate()) {
            return ['success' => false, 'message' => 'Template waktu aktif tidak ditemukan. Pastikan Anda sudah menentukan template waktu yang "Aktif" di menu Kelola Template Waktu.'];
        }

        Log::info("AutoSchedule: Template found. Day slots: " . count($this->teachingSlots));

        // 2. Get all assignments
        $assignments = TeacherAssignment::with(['subject', 'teacher'])
            ->whereHas('subject', function($q) {
                $q->where('weekly_hours', '>', 0);
            })
            ->get();

        if ($assignments->isEmpty()) {
            return ['success' => false, 'message' => 'Tidak ada data penugasan guru (Teacher Assignments) yang memiliki jam per pekan.'];
        }

        // 3. Mathematical Pre-flight Validation
        $mathCheck = $this->validateMath($assignments);
        if (!$mathCheck['success']) {
            return $mathCheck;
        }

        // 4. Transform assignments into Meeting Blocks
        $initialBlocks = $this->transformAssignmentsToBlocks($assignments);
        Log::info("AutoSchedule: Transformed into " . count($initialBlocks) . " blocks.");

        // Calculate burdens to prioritize "busy" teachers and classes in the sorting logic
        $teacherBurdens = $assignments->groupBy('teacher.auth_user_id')->map->sum(function($as) {
            return $as->subject->weekly_hours ?? 0;
        })->toArray();

        $classBurdens = $assignments->groupBy('class_id')->map->sum(function($as) {
            return $as->subject->weekly_hours ?? 0;
        })->toArray();

        $maxAttempts = 500;
        $attempt = 0;
        $failureStats = [
            'teachers' => [],
            'classes' => []
        ];
        $bestErrors = [];
        $minErrorCount = PHP_INT_MAX;

        while ($attempt < $maxAttempts) {
            $attempt++;
            Log::info("AutoSchedule: Starting attempt #{$attempt}");

            DB::beginTransaction();
            try {
                // Clear previous teaching schedules
                Schedule::where('type', 'teaching')->delete();

                // [NEW] Stage 4: Pattern-Based Prioritization
                // Calculate "Mobility" for each block based on teacher and class constraints
                $blocks = $this->prepareBlocksWithPriority($initialBlocks, $assignments);
                
                $this->occupiedTeachers = [];
                $this->occupiedClasses = [];
                $this->errors = [];

                $results = $this->solve($blocks);

                if ($results['success']) {
                    // [NEW] Final Database Insertion: Only write to DB once everything is perfect.
                    foreach ($results['schedules'] as $data) {
                        Schedule::create($data);
                    }
                    DB::commit();
                    return ['success' => true, 'count' => count($results['schedules'])];
                }

                // If failed, record hotspots and rollback
                DB::rollBack();
                
                $currentErrors = $results['errors'];
                if (count($currentErrors) < $minErrorCount) {
                    $minErrorCount  = count($currentErrors);
                    $bestErrors     = $currentErrors;
                }

                foreach ($currentErrors as $err) {
                    $tKey = $err['teacher'];
                    $cKey = $err['class'];
                    $failureStats['teachers'][$tKey] = ($failureStats['teachers'][$tKey] ?? 0) + 1;
                    $failureStats['classes'][$cKey] = ($failureStats['classes'][$cKey] ?? 0) + 1;
                }

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error("AutoSchedule Error on attempt #{$attempt}: " . $e->getMessage());
            }
        }

        return $this->summarizeFailures($failureStats, $maxAttempts, $bestErrors);
    }

    protected function validateMath($assignments)
    {
        // Calculate total available slots for ONE class or ONE teacher
        $totalSlots = 0;
        foreach ($this->teachingSlots as $daySlots) {
            $totalSlots += count($daySlots);
        }

        $teacherHours = [];
        $classHours = [];
        $teacherNames = [];
        $classNames = [];

        foreach ($assignments as $as) {
            $h = $as->subject->weekly_hours;
            $tId = $as->teacher->auth_user_id;
            $cId = $as->class_id;

            $teacherHours[$tId] = ($teacherHours[$tId] ?? 0) + $h;
            $classHours[$cId] = ($classHours[$cId] ?? 0) + $h;
            $teacherNames[$tId] = $as->teacher->name;
            $classNames[$cId] = SchoolClass::find($cId)->rombel ?? "Kelas ID:{$cId}";
        }

        foreach ($teacherHours as $id => $hours) {
            if ($hours > $totalSlots) {
                return [
                    'success' => false,
                    'message' => "KEGAGALAN MATEMATIS: Guru '{$teacherNames[$id]}' memiliki total {$hours} jam/pekan, namun sekolah hanya menyediakan {$totalSlots} slot waktu/pekan. Silakan kurangi jam atau tambah slot waktu."
                ];
            }
        }

        foreach ($classHours as $id => $hours) {
            if ($hours > $totalSlots) {
                return [
                    'success' => false,
                    'message' => "KEGAGALAN MATEMATIS: Kelas '{$classNames[$id]}' memiliki total {$hours} jam/pekan, namun sekolah hanya menyediakan {$totalSlots} slot waktu/pekan. Silakan kurangi mata pelajaran di kelas ini."
                ];
            }
        }

        return ['success' => true];
    }

    protected function summarizeFailures($stats, $maxAttempts, $bestErrors = [])
    {
        arsort($stats['teachers']);
        arsort($stats['classes']);

        $topTeacher = key($stats['teachers']);
        $topClass = key($stats['classes']);

        $message = "Gagal menyusun jadwal lengkap setelah {$maxAttempts} percobaan cerdas.";
        $message .= "\n\nKESIMPULAN ANALISIS:";
        
        if ($topTeacher) {
            $message .= "\n- Titik macet utama ada pada Guru '{$topTeacher}'. Cek apakah beliau memiliki jadwal bentrok di sekolah lain atau jam mengajarnya terlalu padat.";
        }
        
        if ($topClass) {
            $message .= "\n- Titik macet utama ada pada Kelas '{$topClass}'.";
        }

        $message .= "\n\nSaran: Coba kurangi sedikit jam di Master Data Mata Pelajaran atau pecah jam mengajar menjadi blok yang lebih kecil.";

        return [
            'success' => false,
            'message' => $message,
            'errors'  => $bestErrors
        ];
    }

    protected function prepareBlocksWithPriority($blocks, $assignments)
    {
        // 1. Calculate Teacher Constraints (Stage 5: Master Packer Logic)
        
        // Count total weekly hours per teacher
        $teacherJP = $assignments->groupBy('teacher_id')->map->sum(function($as) {
            return $as->subject->weekly_hours ?? 0;
        });

        // [New] Teacher Connectivity: How many classes is this teacher tied to?
        // Teachers who teach in 10 different classes are much harder to schedule 
        // than those who teach the same hours in only 1 class.
        $teacherConnectivity = $assignments->groupBy('teacher_id')->map(function($group) {
            return $group->pluck('class_id')->unique()->count();
        });

        // 2. Map blocks with a "Master Packer Difficulty Score"
        $scored = collect($blocks)->map(function($b) use ($teacherJP, $teacherConnectivity) {
            $tJP = $teacherJP[$b['teacher_id']] ?? 0;
            $tConn = $teacherConnectivity[$b['teacher_id']] ?? 0;
            
            // Formula: Size is the biggest constraint, followed by Cross-Class Connectivity, then Total JP.
            // A 3-JP block for a teacher teaching 8 classes is top priority.
            $b['difficulty'] = ($b['size'] * 100) + ($tConn * 10) + $tJP;
            
            // Add a small random jitter to allow different paths across 500 attempts
            $b['difficulty'] += rand(0, 10);
            
            return $b;
        });

        // 3. Sort by Difficulty DESC
        return $scored->sortByDesc('difficulty')->values()->toArray();
    }

    protected function prepareTemplate()
    {
        // First try the specific admin
        $profile = UserProfile::where('user_id', $this->adminUserId)->whereNotNull('teaching_time_slots')->first();
        
        // If not found, find ANY profile that has slots
        if (!$profile) {
            $profile = UserProfile::whereNotNull('teaching_time_slots')->first();
        }

        if (!$profile || !$profile->teaching_time_slots) return false;

        $profiles = is_string($profile->teaching_time_slots) 
            ? json_decode($profile->teaching_time_slots, true) 
            : $profile->teaching_time_slots;

        $activeProfile = collect($profiles['profiles'] ?? [])->firstWhere('is_active', true);
        if (!$activeProfile) return false;

        $this->template = $activeProfile;
        
        $days    = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        $maxDays = $profile->school_days ?? 6;
        $rawSlots = $activeProfile['slots'] ?? [];

        foreach ($days as $index => $day) {
            if ($index >= $maxDays) continue;

            // Actual format: slots keyed by day name → array of {jam_ke, mulai, selesai}
            $daySlots = $rawSlots[$day] ?? [];

            if (empty($daySlots)) continue;

            // Normalize to internal format used by solve()
            $normalized = [];
            foreach ($daySlots as $slot) {
                $normalized[] = [
                    'period'     => $slot['jam_ke']  ?? 0,
                    'start_time' => $slot['mulai']   ?? '',
                    'end_time'   => $slot['selesai'] ?? '',
                ];
            }

            // Sort by period number and store
            usort($normalized, fn($a, $b) => $a['period'] <=> $b['period']);
            $this->teachingSlots[$day] = $normalized;
        }

        return !empty($this->teachingSlots);
    }

    protected function transformAssignmentsToBlocks($assignments)
    {
        $blocks = [];
        foreach ($assignments as $as) {
            $hours = $as->subject->weekly_hours;
            $split = [];

            // Logic Split per user requirements:
            // 2h -> [2]
            // 3h -> [3]
            // 4h -> [2, 2]
            // 5h -> [3, 2]
            // 6h -> [3, 3]
            if ($hours <= 3) {
                $split = [$hours];
            } elseif ($hours == 4) {
                $split = [2, 2];
            } elseif ($hours == 5) {
                $split = [3, 2];
            } elseif ($hours == 6) {
                $split = [3, 3];
            } else {
                // Fallback for > 6 if exists
                $split = array_fill(0, floor($hours / 3), 3);
                if ($hours % 3 >= 2) $split[] = $hours % 3;
                elseif ($hours % 3 == 1) $split[count($split)-1]++; // Avoid 1h sessions
            }

            foreach ($split as $blockSize) {
                $blocks[] = [
                    'assignment_id' => $as->id,
                    'class_id' => $as->class_id,
                    'subject_id' => $as->subject_id,
                    'teacher_id' => $as->teacher->auth_user_id, // Important: use auth_user_id for schedules table
                    'teacher_name' => $as->teacher->name,
                    'subject_name' => $as->subject->name,
                    'class_name' => SchoolClass::find($as->class_id)->rombel ?? '?',
                    'size' => $blockSize
                ];
            }
        }
        return $blocks;
    }

    protected function solve($blocks)
    {
        // Phase 1: Mathematical Partitioning (The Frame)
        // Group blocks by class into a guaranteed 100% full 5-day week
        $grid = $this->partitionAllClasses($blocks);
        if (!$grid) return ['success' => false, 'errors' => [['teacher'=>'System','subject'=>'Partitioning','class'=>'All','size'=>'Gagal menyusun bingkai awal.']]];

        // Phase 2: Global Heatmap Balancing (The Load Balancer)
        // Ensure no teacher teaches more than the daily capacity across all classes
        $this->balanceHeatmap($grid);

        // Phase 3: Intra-day Slotting (The Placement)
        // Now that load is balanced, arranging pieces into periods is much easier
        return $this->slotFinalGrid($grid);
    }

    protected function partitionAllClasses($blocks)
    {
        $grid = [];
        $classBlocks = collect($blocks)->groupBy('class_id');
        $days = array_keys($this->teachingSlots);

        foreach ($classBlocks as $classId => $blocks) {
            $partition = $this->partitionSingleClass($blocks->toArray(), $days);
            if (!$partition) return false; // This shouldn't happen for 2/3 JP blocks
            $grid[$classId] = $partition;
        }
        return $grid;
    }

    protected function partitionSingleClass($blocks, $days)
    {
        // Terapkan aturan: setiap mapel hanya boleh muncul SATU kali per hari di kelas yang sama
        $maxAttempts = 50;
        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $plan = [];
            $remaining = $blocks;
            shuffle($remaining);
            $failed = false;

            foreach ($days as $day) {
                $target = count($this->teachingSlots[$day]);
                // Pass list of subjects already placed on this day (empty at start)
                $usedSubjectsToday = [];
                $found = $this->findCombinationNoRepeatSubject($remaining, $target, $usedSubjectsToday);
                if (!$found) { $failed = true; break; }

                $plan[$day] = $found['blocks'];
                $remaining = $this->removeBlocks($remaining, $found['indices']);
            }

            if (!$failed && empty($remaining)) return $plan;
        }

        return false; // Cannot partition with the given constraints
    }

    protected function balanceHeatmap(&$grid)
    {
        $maxSwaps = 1000;
        $lastOverload = null;
        $stuckCount = 0;

        for ($i = 0; $i < $maxSwaps; $i++) {
            $heatmap = $this->calculateHeatmap($grid);
            $overload = $this->findOverload($heatmap);

            if (!$overload) break; // Balanced!

            // Detect if we're stuck on the same overload (no progress)
            $overloadKey = ($overload['teacher_id'] ?? '') . '-' . ($overload['day'] ?? '');
            if ($lastOverload === $overloadKey) {
                $stuckCount++;
                if ($stuckCount > 50) {
                    // We are stuck: re-partition this class from scratch
                    $this->repartitionOverloadedClass($grid, $overload['teacher_id'], $overload['day']);
                    $stuckCount = 0;
                }
            } else {
                $stuckCount = 0;
            }
            $lastOverload = $overloadKey;

            $this->performBalancedSwap($grid, $overload['teacher_id'], $overload['day']);
        }
    }

    protected function calculateHeatmap($grid)
    {
        $heatmap = [];
        foreach ($grid as $classId => $days) {
            foreach ($days as $day => $blocks) {
                foreach ($blocks as $b) {
                    $tId = $b['teacher_id'];
                    $heatmap[$tId][$day] = ($heatmap[$tId][$day] ?? 0) + $b['size'];
                }
            }
        }
        return $heatmap;
    }

    protected function findOverload($heatmap)
    {
        foreach ($heatmap as $tId => $days) {
            foreach ($days as $day => $load) {
                $capacity = count($this->teachingSlots[$day]);
                if ($load > $capacity) {
                    return ['teacher_id' => $tId, 'day' => $day, 'load' => $load];
                }
            }
        }
        return null;
    }

    protected function performBalancedSwap(&$grid, $teacherId, $badDay)
    {
        // Find one class-day where this teacher is overloaded
        foreach ($grid as $classId => &$days) {
            $hasTeacherOnBadDay = collect($days[$badDay])->firstWhere('teacher_id', $teacherId);
            if ($hasTeacherOnBadDay) {
                // Try to swap a block from $badDay with a block from a $goodDay in THIS same class
                // Crucial: Must swap blocks of same size to keep the frame 100% full
                $daysAvailable = array_keys($days);
                shuffle($daysAvailable);
                
                foreach ($daysAvailable as $goodDay) {
                    if ($goodDay === $badDay) continue;
                    
                    // Look for a block on goodDay that is NOT by this same teacher
                    foreach ($days[$goodDay] as $idxB => $blockB) {
                        if ($blockB['teacher_id'] !== $teacherId) {
                            // Find the teacher's block on badDay
                            foreach ($days[$badDay] as $idxA => $blockA) {
                                if ($blockA['teacher_id'] === $teacherId && $blockA['size'] === $blockB['size']) {
                                    // SWAP!
                                    $days[$badDay][$idxA] = $blockB;
                                    $days[$goodDay][$idxB] = $blockA;
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    protected function slotFinalGrid($grid)
    {
        $allSchedules = [];
        $days = array_keys($this->teachingSlots);
        $this->occupiedTeachers = [];

        foreach ($days as $day) {
            $daySchedules = $this->backtrackDay($grid, $day);
            if (!$daySchedules) {
                return [
                    'success' => false, 
                    'errors' => [['teacher'=>'System','subject'=>'Slotting','class'=>'All','size'=>"Gagal menyusun detail jam di hari {$day}."]]
                ];
            }
            $allSchedules = array_merge($allSchedules, $daySchedules);
        }

        return ['success' => true, 'schedules' => $allSchedules];
    }

    protected function backtrackDay($grid, $day)
    {
        $slots = $this->teachingSlots[$day];
        $classes = array_keys($grid);

        // Try greedy placement with random restarts for this day
        for ($retry = 0; $retry < 100; $retry++) {
            $daySchedules = [];
            $occupiedInDay = []; // [period][teacher_id]
            $success = true;

            $shuffledClasses = $classes;
            shuffle($shuffledClasses);

            foreach ($shuffledClasses as $classId) {
                $blocks = $grid[$classId][$day];
                shuffle($blocks);
                
                // For each class, try to find a valid permutation for this day
                // In a balanced heatmap, a random permutation usually fits quickly.
                $placedClass = false;
                $perms = $this->getPermutations($blocks);
                shuffle($perms);
                $maxPerms = min(count($perms), 10);

                for ($pIdx = 0; $pIdx < $maxPerms; $pIdx++) {
                    $p = $perms[$pIdx];
                    $currentPeriod = 1;
                    $pPossible = true;
                    $tempPlaced = [];

                    foreach ($p as $block) {
                        $startIndex = $currentPeriod - 1;
                        if ($startIndex + $block['size'] > count($slots)) { $pPossible = false; break; }

                        for ($j = 0; $j < $block['size']; $j++) {
                            $period = $slots[$startIndex + $j]['period'];
                            if (isset($occupiedInDay[$period][$block['teacher_id']])) {
                                $pPossible = false; break;
                            }
                        }

                        if (!$pPossible) break;
                        $tempPlaced[] = ['block' => $block, 'periods' => array_slice($slots, $startIndex, $block['size'])];
                        $currentPeriod += $block['size'];
                    }

                    if ($pPossible) {
                        foreach ($tempPlaced as $tp) {
                            foreach ($tp['periods'] as $slot) {
                                $occupiedInDay[$slot['period']][$tp['block']['teacher_id']] = true;
                            }
                            $daySchedules[] = $this->createScheduleData($tp['block'], $day, $tp['periods']);
                        }
                        $placedClass = true;
                        break;
                    }
                }

                if (!$placedClass) {
                    $success = false;
                    break;
                }
            }

            if ($success) return $daySchedules;
        }

        return null;
    }

    protected function getPermutations($items)
    {
        if (count($items) <= 1) return [$items];
        $result = [];
        for ($i = 0; $i < count($items); $i++) {
            $m = array_splice($items, $i, 1);
            foreach ($this->getPermutations($items) as $p) {
                $result[] = array_merge($m, $p);
            }
            array_splice($items, $i, 0, $m);
        }
        return $result;
    }

    protected function findCombinationNoRepeatSubject($blocks, $target, $usedSubjects)
    {
        $results = [];
        $this->getCombinationsNoRepeatRecursive($blocks, $target, 0, [], [], $usedSubjects, $results);
        return empty($results) ? null : $results[0];
    }

    protected function getCombinationsNoRepeatRecursive($blocks, $target, $start, $currentIndices, $currentBlocks, $usedSubjects, &$results)
    {
        $sum = collect($currentBlocks)->sum('size');
        if ($sum === $target) {
            $results[] = ['indices' => $currentIndices, 'blocks' => $currentBlocks];
            return;
        }
        if ($sum > $target || count($results) > 5) return; // Fast stop

        for ($i = $start; $i < count($blocks); $i++) {
            $b = $blocks[$i];
            // CONSTRAINT: Reject if this subject is already used today
            if (in_array($b['subject_id'], $usedSubjects)) continue;

            $newUsed = array_merge($usedSubjects, [$b['subject_id']]);
            $currentIndices[] = $i;
            $currentBlocks[] = $b;
            $this->getCombinationsNoRepeatRecursive($blocks, $target, $i + 1, $currentIndices, $currentBlocks, $newUsed, $results);
            array_pop($currentIndices);
            array_pop($currentBlocks);
        }
    }

    protected function repartitionOverloadedClass(&$grid, $teacherId, $badDay)
    {
        // Find a class that has this teacher teaching on the bad day
        foreach ($grid as $classId => &$days) {
            $hasTeacher = collect($days[$badDay])->firstWhere('teacher_id', $teacherId);
            if ($hasTeacher) {
                // Gather ALL blocks for this class across all days
                $allBlocks = [];
                foreach ($days as $day => $dayBlocks) {
                    $allBlocks = array_merge($allBlocks, $dayBlocks);
                }
                // Re-partition this single class from scratch with fresh shuffle
                $newPlan = $this->partitionSingleClass($allBlocks, array_keys($days));
                if ($newPlan) {
                    $grid[$classId] = $newPlan;
                }
                return;
            }
        }
    }

    protected function findCombination($blocks, $target)
    {
        $results = [];
        $this->getCombinationsRecursive($blocks, $target, 0, [], [], $results);
        return empty($results) ? null : $results[0];
    }

    protected function getCombinationsRecursive($blocks, $target, $start, $currentIndices, $currentBlocks, &$results)
    {
        $sum = collect($currentBlocks)->sum('size');
        if ($sum === $target) {
            $results[] = ['indices' => $currentIndices, 'blocks' => $currentBlocks];
            return;
        }
        if ($sum > $target || count($results) > 20) return; // limit search

        for ($i = $start; $i < count($blocks); $i++) {
            $currentIndices[] = $i;
            $currentBlocks[] = $blocks[$i];
            $this->getCombinationsRecursive($blocks, $target, $i + 1, $currentIndices, $currentBlocks, $results);
            array_pop($currentIndices);
            array_pop($currentBlocks);
        }
    }

    protected function removeBlocks($blocks, $indices)
    {
        $new = $blocks;
        rsort($indices);
        foreach ($indices as $idx) {
            array_splice($new, $idx, 1);
        }
        return $new;
    }

    protected function createScheduleData($block, $day, $periods)
    {
        $firstSlot = $periods[0];
        $lastSlot  = $periods[count($periods) - 1];

        return [
            'class_id'     => $block['class_id'],
            'subject_id'   => $block['subject_id'],
            'teacher_id'   => $block['teacher_id'],
            'day'          => $day,
            'type'         => 'teaching',
            'start_period' => $firstSlot['period'],
            'end_period'   => $lastSlot['period'],
            'start_time'   => $firstSlot['start_time'],
            'end_time'     => $lastSlot['end_time'],
        ];
    }

}
