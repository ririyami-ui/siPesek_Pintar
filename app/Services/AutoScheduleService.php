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
    protected $teacherAvailability = []; // [teacher_id] = [unavailable_days]

    public function __construct($adminUserId)
    {
        $this->adminUserId = $adminUserId;
    }

    /**
     * Main entry point for auto generation
     */
    public function generate()
    {
        // Increase time limit and memory limit to prevent 500 errors on hosting
        set_time_limit(0);
        ini_set('memory_limit', '512M');

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

        // Pre-fetch classes for performance
        $allClasses = SchoolClass::all()->keyBy('id');
        
        // Pre-fetch teacher availability
        $allTeachers = Teacher::whereNotNull('auth_user_id')->get();
        foreach ($allTeachers as $t) {
            $this->teacherAvailability[$t->auth_user_id] = $t->unavailable_days ?: [];
        }

        // 3. Mathematical Pre-flight Validation
        $mathCheck = $this->validateMath($assignments);
        if (!$mathCheck['success']) {
            return $mathCheck;
        }

        // 4. Transform assignments into Meeting Blocks
        $initialBlocks = $this->transformAssignmentsToBlocks($assignments, $allClasses);
        Log::info("AutoSchedule: Transformed into " . count($initialBlocks) . " blocks.");

        $maxAttempts = 150; // Reduced to 150 so worst-case failure happens in ~25 seconds
        $attempt = 0;
        $failureStats = [
            'teachers' => [],
            'classes' => []
        ];
        $bestErrors = [];
        $minErrorCount = PHP_INT_MAX;

        // Start with a clean state - delete OUTSIDE the loop
        DB::beginTransaction();
        try {
            // Clean up existing teaching schedules (Force Delete to prevent database bloat)
            Schedule::where('type', 'teaching')->forceDelete();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return ['success' => false, 'message' => 'Gagal membersihkan jadwal lama: ' . $e->getMessage()];
        }

        while ($attempt < $maxAttempts) {
            $attempt++;
            
            //Stage 4: Pattern-Based Prioritization
            // Calculate "Mobility" for each block based on teacher and class constraints
            $blocks = $this->prepareBlocksWithPriority($initialBlocks, $assignments);
            
            $this->occupiedTeachers = [];
            $this->occupiedClasses = [];
            $this->errors = [];

            $results = $this->solve($blocks);

            if ($results['success']) {
                DB::beginTransaction();
                try {
                    // Final Database Insertion: Bulk Insert for performance
                    $nowTimestamp = now();
                    $insertData = array_map(function($item) use ($nowTimestamp) {
                        return array_merge($item, [
                            'start_date' => $nowTimestamp->format('Y-m-d'),
                            'end_date' => $nowTimestamp->copy()->endOfYear()->format('Y-m-d'),
                            'is_recurring' => 1,
                            'created_at' => $nowTimestamp,
                            'updated_at' => $nowTimestamp
                        ]);
                    }, $results['schedules']);

                    Schedule::insert($insertData);
                    DB::commit();
                    Log::info("AutoSchedule: Success at attempt #{$attempt}");
                    return ['success' => true, 'count' => count($results['schedules'])];
                } catch (\Exception $e) {
                    DB::rollBack();
                    Log::error("AutoSchedule: DB Write Error: " . $e->getMessage());
                    return ['success' => false, 'message' => 'Gagal menyimpan jadwal: ' . $e->getMessage()];
                }
            }

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
        $availableDaysCount = count($this->teachingSlots);

        foreach ($assignments as $as) {
            $h = $as->subject->weekly_hours;
            $tId = $as->teacher->auth_user_id;
            $cId = $as->class_id;

            // Check if subject hours are too high for the available days
            $neededDays = 0;
            if ($h <= 3) $neededDays = 1;
            elseif ($h <= 6) $neededDays = 2;
            else $neededDays = ceil($h / 3);

            if ($neededDays > $availableDaysCount) {
                $cName = SchoolClass::find($cId)->rombel ?? "Kelas ID:{$cId}";
                return [
                    'success' => false,
                    'message' => "KEGAGALAN MATEMATIS: Mapel '{$as->subject->name}' di kelas '{$cName}' butuh {$neededDays} hari ({$h} JP), tapi hanya ada {$availableDaysCount} hari aktif."
                ];
            }

            $teacherHours[$tId] = ($teacherHours[$tId] ?? 0) + $h;
            $classHours[$cId] = ($classHours[$cId] ?? 0) + $h;
            $teacherNames[$tId] = $as->teacher->name;
            $classNames[$cId] = SchoolClass::find($cId)->rombel ?? "Kelas ID:{$cId}";
        }

        foreach ($teacherHours as $id => $hours) {
            $unDays = $this->teacherAvailability[$id] ?? [];
            
            // NEW RULE: > 30 hours cannot have unDays
            if ($hours > 30 && count($unDays) > 0) {
                return [
                    'success' => false,
                    'message' => "Jadwal Ditolak: Guru '{$teacherNames[$id]}' memiliki beban {$hours} JP (> 30 JP), namun meminta hari libur. Guru dengan beban mengajar super padat di atas 30 JP tidak diperbolehkan memiliki hari libur khusus untuk menghindari kebuntuan/bentrok jadwal."
                ];
            }

            // Calculate personal capacity based on unavailable days
            $personalCapacity = 0;
            foreach ($this->teachingSlots as $dayName => $daySlots) {
                if (!in_array($dayName, $unDays)) {
                    $personalCapacity += count($daySlots);
                }
            }

            if ($hours > $personalCapacity) {
                return [
                    'success' => false,
                    'message' => "KEGAGALAN MATEMATIS: Guru '{$teacherNames[$id]}' memiliki total {$hours} jam/pekan, namun hanya tersedia {$personalCapacity} slot waktu karena hari libur yang dipilih. Silakan kurangi jam atau kurangi hari libur guru tersebut."
                ];
            }
        }

        foreach ($classHours as $id => $hours) {
            if ($hours != $totalSlots) {
                $status = $hours > $totalSlots ? "Kelebihan" : "Kekurangan";
                $diff = abs($hours - $totalSlots);
                return [
                    'success' => false,
                    'message' => "JADWAL TIDAK SERASI: Kelas '{$classNames[$id]}' memiliki beban {$hours} JP, sedangkan template waktu menyediakan {$totalSlots} JP ({$status} {$diff} JP). Silakan klik tombol 'Cek Keselarasan' dan perbaiki Master Data Penugasan Guru agar beban dan kapasitas persis sama (0 selisih)."
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

        $message = "Sistem belum berhasil menemukan susunan yang bebas bentrok 100% pada percobaan kali ini. Ini adalah hal yang wajar pada jadwal yang padat.\n\n";
        $message .= "💡 SOLUSI TERBAIK:\n";
        $message .= "Cukup klik tombol 'Generate Otomatis' sekali lagi. Mengulang klik akan memberikan kombinasi acak baru yang seringkali langsung berhasil.\n\n";
        
        $message .= "🔍 ANALISIS TITIK SULIT:\n";
        
        if ($topTeacher) {
            $message .= "- Guru yang paling sering bentrok: {$topTeacher}\n";
        }
        
        if ($topClass) {
            $message .= "- Kelas yang paling buntu: {$topClass}\n";
        }

        $message .= "\n(Jika Anda sudah mengklik ulang lebih dari 3 kali dan terus macet di guru yang sama, pertimbangkan untuk melonggarkan hari liburnya).";

        return [
            'success' => false,
            'message' => $message,
            'errors'  => $bestErrors
        ];
    }

    protected function prepareBlocksWithPriority($blocks, $assignments)
    {
        // 1. Calculate Teacher Constraints (Stage 5: Master Packer Logic)
        
        // Count total weekly hours per teacher, grouped by auth_user_id to match blocks
        $teacherJP = $assignments->groupBy(function($as) {
            return $as->teacher ? $as->teacher->auth_user_id : $as->teacher_id;
        })->map->sum(function($as) {
            return $as->subject->weekly_hours ?? 0;
        });

        // [New] Teacher Connectivity: How many classes is this teacher tied to?
        $teacherConnectivity = $assignments->groupBy(function($as) {
            return $as->teacher ? $as->teacher->auth_user_id : $as->teacher_id;
        })->map(function($group) {
            return $group->pluck('class_id')->unique()->count();
        });

        // 2. Map blocks with a "Master Packer Difficulty Score"
        $scored = collect($blocks)->map(function($b) use ($teacherJP, $teacherConnectivity) {
            $tJP = $teacherJP[$b['teacher_id']] ?? 0;
            $tConn = $teacherConnectivity[$b['teacher_id']] ?? 0;
            
            // Formula: Size is the biggest constraint, followed by Cross-Class Connectivity, then Total JP.
            $b['difficulty'] = ($b['size'] * 100) + ($tConn * 10) + $tJP;
            
            // [NEW] Extreme priority for PJOK/Sports to ensure they get morning slots
            if ($this->isMorningPriority($b['subject_name'])) {
                $b['difficulty'] += 5000;
            }

            // Add a small random jitter to allow different paths across attempts
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
        
        $teachingSlots = [];
        $rawSlots = $activeProfile['slots'] ?? [];
        foreach ($rawSlots as $dayName => $slots) {
            if (empty($slots)) {
                continue;
            }

            $parsed = [];
            foreach ($slots as $idx => $s) {
                if (!isset($s['jam_ke']) || !isset($s['mulai']) || !isset($s['selesai'])) {
                    continue;
                }
                $parsed[] = [
                    'period'     => (int) $s['jam_ke'],
                    'start_time' => $s['mulai'],
                    'end_time'   => $s['selesai'],
                ];
            }

            if (!empty($parsed)) {
                usort($parsed, fn($a, $b) => $a['period'] <=> $b['period']);
                $teachingSlots[$dayName] = $parsed;
            }
        }

        $this->teachingSlots = $teachingSlots;
        return !empty($this->teachingSlots);
    }

    protected function transformAssignmentsToBlocks($assignments, $allClasses)
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
            // Optimized Split per user requirements:
            if ($hours == 6) {
                $split = [3, 3]; 
            } elseif ($hours == 5) {
                $split = [3, 2]; 
            } elseif ($hours == 4) {
                $split = [2, 2]; // Mandatory split for flexibility
            } elseif ($hours == 3) {
                $split = [3]; 
            } elseif ($hours == 2) {
                $split = [2];
            } else {
                $split = [$hours];
            }

            foreach ($split as $blockSize) {
                $blocks[] = [
                    'assignment_id' => $as->id,
                    'class_id' => $as->class_id,
                    'subject_id' => $as->subject_id,
                    'teacher_id' => $as->teacher->auth_user_id, // Important: use auth_user_id for schedules table
                    'teacher_name' => $as->teacher->name,
                    'subject_name' => $as->subject->name,
                    'class_name' => $allClasses[$as->class_id]->rombel ?? '?',
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
        $classGroups = [];
        foreach ($blocks as $b) {
            $classGroups[$b['class_id']][] = $b;
        }
        $days = array_keys($this->teachingSlots);

        foreach ($classGroups as $classId => $blocksArray) {
            $partition = $this->partitionSingleClass($blocksArray, $days);
            if (!$partition) return false; // This shouldn't happen for 2/3 JP blocks
            $grid[$classId] = $partition;
        }
        return $grid;
    }

    protected function partitionSingleClass($blocks, $days)
    {
        // Terapkan aturan: setiap mapel hanya boleh muncul SATU kali per hari di kelas yang sama
        $maxAttempts = 300;
        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $plan = [];
            $remaining = $blocks;
            shuffle($remaining);
            $failed = false;

            $shuffledDays = $days;
            shuffle($shuffledDays);

            foreach ($shuffledDays as $day) {
                $target = count($this->teachingSlots[$day]);
                // Pass list of subjects and teachers already placed on this day (empty at start)
                $usedSubjectsToday = [];
                $usedTeachersToday = [];
                
                // Add teachers who are unavailable on this day to usedTeachersToday
                foreach ($this->teacherAvailability as $tId => $unDays) {
                    if (in_array($day, $unDays)) {
                        $usedTeachersToday[] = (int)$tId;
                    }
                }

                $found = $this->findCombinationNoRepeat($remaining, $target, $usedSubjectsToday, $usedTeachersToday);
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
        $maxSwaps = 5000; // Increased to find a zero-overload state in tight schedules
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
                if ($stuckCount > 15) { // Faster reaction to being stuck
                    // We are stuck: Re-partition MULTIPLE random classes that involve this teacher
                    $this->shakeUpTeacherSchedule($grid, $overload['teacher_id']);
                    $stuckCount = 0;
                }
            } else {
                $stuckCount = 0;
            }
            $lastOverload = $overloadKey;

            $this->performBalancedSwap($grid, $overload['teacher_id'], $overload['day']);
        }
    }

    protected function shakeUpTeacherSchedule(&$grid, $teacherId)
    {
        $days = array_keys($this->teachingSlots);
        $involvedClasses = [];
        foreach ($grid as $classId => $classDays) {
            foreach ($classDays as $dayBlocks) {
                foreach ($dayBlocks as $b) {
                    if ($b['teacher_id'] === $teacherId) {
                        $involvedClasses[] = $classId;
                        break 2;
                    }
                }
            }
        }

        if (empty($involvedClasses)) return;
        
        // Pick 2 random classes to re-partition completely
        shuffle($involvedClasses);
        $toRebuild = array_slice($involvedClasses, 0, 2);

        foreach ($toRebuild as $classId) {
            $allBlocks = [];
            foreach ($grid[$classId] as $dayBlocks) {
                $allBlocks = array_merge($allBlocks, $dayBlocks);
            }
            $newPlan = $this->partitionSingleClass($allBlocks, $days);
            if ($newPlan) {
                $grid[$classId] = $newPlan;
            }
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
                // Capacity is 0 if teacher is unavailable on this day
                $unDays = $this->teacherAvailability[$tId] ?? [];
                $capacity = in_array($day, $unDays) ? 0 : count($this->teachingSlots[$day]);
                
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
            $blocksOnBadDay = $days[$badDay];
            $foundIdxA = -1;
            foreach ($blocksOnBadDay as $idx => $b) {
                if ($b['teacher_id'] === $teacherId) {
                    $foundIdxA = $idx;
                    break;
                }
            }

            if ($foundIdxA !== -1) {
                $blockA = $blocksOnBadDay[$foundIdxA];
                
                // Try to swap a block from $badDay with a block from a $goodDay in THIS same class
                $daysAvailable = array_keys($days);
                shuffle($daysAvailable);
                
                foreach ($daysAvailable as $goodDay) {
                    if ($goodDay === $badDay) continue;
                    
                    // Look for a block on goodDay that is NOT by this same teacher
                    foreach ($days[$goodDay] as $idxB => $blockB) {
                        if ($blockB['teacher_id'] !== $teacherId && $blockA['size'] === $blockB['size']) {
                            
                            $tA = $blockA['teacher_id'];
                            $tB = $blockB['teacher_id'];

                            // Check if Teacher A is already on goodDay
                            $alreadyHasAOnGood = false;
                            foreach ($days[$goodDay] as $bCheck) {
                                if ($bCheck['teacher_id'] === $tA) {
                                    $alreadyHasAOnGood = true;
                                    break;
                                }
                            }
                            if ($alreadyHasAOnGood) continue;

                            // Check if Teacher B is already on badDay
                            $alreadyHasBOnBad = false;
                            foreach ($days[$badDay] as $bCheck) {
                                if ($bCheck['teacher_id'] === $tB) {
                                    $alreadyHasBOnBad = true;
                                    break;
                                }
                            }
                            if ($alreadyHasBOnBad) continue;

                            // SWAP!
                            $days[$badDay][$foundIdxA] = $blockB;
                            $days[$goodDay][$idxB] = $blockA;
                            return;
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
        $totalSlots = count($slots);

        // 1. Generate all valid permutations for each class
        $classPermutations = [];
        foreach ($classes as $classId) {
            $blocks = $grid[$classId][$day];
            $perms = $this->generateAllValidPermutations($blocks, $totalSlots, $slots);
            if (empty($perms)) {
                return null; // Impossible to even satisfy single-class constraints (e.g. PJOK)
            }
            // Shuffle permutations so we don't always pick the same one
            shuffle($perms);
            $classPermutations[$classId] = $perms;
        }

        // 2. Backtracking DFS to find a globally valid daily schedule
        $occupiedInDay = [];
        $resultSchedules = [];
        
        $success = $this->backtrackDaySchedule($classes, 0, $classPermutations, $occupiedInDay, $resultSchedules);
        
        if ($success) {
            return $this->formatBacktrackSchedules($resultSchedules, $day);
        }

        return null;
    }

    protected function generateAllValidPermutations($blocks, $totalSlots, $slots)
    {
        $validPerms = [];
        $this->permuteBlocks($blocks, 0, count($blocks) - 1, $totalSlots, $slots, $validPerms);
        return $validPerms;
    }

    protected function permuteBlocks(&$blocks, $l, $r, $totalSlots, $slots, &$validPerms)
    {
        if ($l == $r) {
            $currentPos = 0;
            $placed = [];
            $isValid = true;
            
            foreach ($blocks as $b) {
                if ($currentPos + $b['size'] > $totalSlots) {
                    $isValid = false; break;
                }
                
                // PJOK must end by Jam 6
                if ($this->isMorningPriority($b['subject_name']) && ($currentPos + $b['size'] > 6)) {
                    $isValid = false; break;
                }
                
                $placed[] = [
                    'block' => $b,
                    'periods' => array_slice($slots, $currentPos, $b['size'])
                ];
                $currentPos += $b['size'];
            }
            
            if ($isValid) {
                // Check if this permutation is already added (blocks can have same size and teacher)
                $sig = serialize($placed);
                static $seen = [];
                if (!isset($seen[$sig])) {
                    $seen[$sig] = true;
                    $validPerms[] = $placed;
                }
            }
        } else {
            for ($i = $l; $i <= $r; $i++) {
                $this->swapBlocks($blocks, $l, $i);
                $this->permuteBlocks($blocks, $l + 1, $r, $totalSlots, $slots, $validPerms);
                $this->swapBlocks($blocks, $l, $i); // backtrack
            }
        }
    }

    protected function swapBlocks(&$arr, $i, $j) {
        $temp = $arr[$i];
        $arr[$i] = $arr[$j];
        $arr[$j] = $temp;
    }

    protected function backtrackDaySchedule($classes, $classIndex, &$classPermutations, &$occupiedInDay, &$resultSchedules)
    {
        static $steps = 0;
        if ($classIndex === 0) {
            $steps = 0; // Reset counter at the start of a new day search
        }
        
        if ($steps++ > 2000) {
            return false; // Fail fast if search space is too large/unresolvable
        }

        if ($classIndex == count($classes)) {
            return true; // All classes scheduled without conflict
        }

        $classId = $classes[$classIndex];
        $perms = $classPermutations[$classId];

        foreach ($perms as $perm) {
            // Check if this permutation conflicts with occupiedInDay
            $conflict = false;
            foreach ($perm as $p) {
                $tId = $p['block']['teacher_id'];
                foreach ($p['periods'] as $s) {
                    $period = $s['period'];
                    if (isset($occupiedInDay[$period][$tId])) {
                        $conflict = true;
                        break 2;
                    }
                }
            }

            if (!$conflict) {
                // Apply placement
                foreach ($perm as $p) {
                    $tId = $p['block']['teacher_id'];
                    foreach ($p['periods'] as $s) {
                        $occupiedInDay[$s['period']][$tId] = true;
                    }
                }
                
                $resultSchedules[$classId] = $perm;

                // Recurse to next class
                if ($this->backtrackDaySchedule($classes, $classIndex + 1, $classPermutations, $occupiedInDay, $resultSchedules)) {
                    return true;
                }

                // Remove placement (Backtrack)
                foreach ($perm as $p) {
                    $tId = $p['block']['teacher_id'];
                    foreach ($p['periods'] as $s) {
                        unset($occupiedInDay[$s['period']][$tId]);
                    }
                }
                unset($resultSchedules[$classId]);
            }
        }

        return false;
    }

    protected function formatBacktrackSchedules($classSchedules, $day)
    {
        $daySchedules = [];
        foreach ($classSchedules as $placed) {
            foreach ($placed as $p) {
                $daySchedules[] = $this->createScheduleData($p['block'], $day, $p['periods']);
            }
        }
        return $daySchedules;
    }




    protected function findCombinationNoRepeat($blocks, $target, $usedSubjects, $usedTeachers)
    {
        $results = [];
        $this->getCombinationsNoRepeatRecursive($blocks, $target, 0, [], [], $usedSubjects, $usedTeachers, $results);
        return empty($results) ? null : $results[0];
    }

    protected function getCombinationsNoRepeatRecursive($blocks, $target, $start, $currentIndices, $currentBlocks, $usedSubjects, $usedTeachers, &$results)
    {
        $sum = 0;
        foreach ($currentBlocks as $cb) {
            $sum += $cb['size'];
        }
        
        if ($sum === $target) {
            $results[] = ['indices' => $currentIndices, 'blocks' => $currentBlocks];
            return;
        }
        if ($sum > $target || count($results) > 5) return; // Fast stop

        for ($i = $start; $i < count($blocks); $i++) {
            $b = $blocks[$i];
            
            // CONSTRAINT 1: Reject if this subject is already used today in this class
            if (in_array($b['subject_id'], $usedSubjects)) continue;

            // CONSTRAINT 2: Reject if this teacher is already teaching in this class today
            // (Standard pedagogic rule: 1 teacher should only enter 1 class once per day)
            if (in_array($b['teacher_id'], $usedTeachers)) continue;

            $newUsedSubjects = array_merge($usedSubjects, [$b['subject_id']]);
            $newUsedTeachers = array_merge($usedTeachers, [$b['teacher_id']]);
            
            $currentIndices[] = $i;
            $currentBlocks[] = $b;
            $this->getCombinationsNoRepeatRecursive($blocks, $target, $i + 1, $currentIndices, $currentBlocks, $newUsedSubjects, $newUsedTeachers, $results);
            array_pop($currentIndices);
            array_pop($currentBlocks);
        }
    }

    protected function repartitionOverloadedClass(&$grid, $teacherId, $badDay)
    {
        // Handled by shakeUpTeacherSchedule for better performance
        return;
    }

    protected function findCombination($blocks, $target)
    {
        $results = [];
        $this->getCombinationsRecursive($blocks, $target, 0, [], [], $results);
        return empty($results) ? null : $results[0];
    }

    protected function getCombinationsRecursive($blocks, $target, $start, $currentIndices, $currentBlocks, &$results)
    {
        $sum = 0;
        foreach ($currentBlocks as $cb) {
            $sum += $cb['size'];
        }
        
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

    /**
     * Helper to identify subjects that prefer morning slots (e.g. PJOK/Sports)
     */
    protected function isMorningPriority($subjectName)
    {
        $name = strtolower($subjectName);
        return str_contains($name, 'olahraga') || 
               str_contains($name, 'pjok') || 
               str_contains($name, 'penjas') ||
               str_contains($name, 'panyas');
    }

    public function getTeacherAvailability() { return $this->teacherAvailability; }
    public function getTeachingSlots() { return $this->teachingSlots; }
    public function getTemplate() { return $this->template; }
}
