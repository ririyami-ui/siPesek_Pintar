<?php

namespace App\Services;

if (function_exists('opcache_reset')) { opcache_reset(); }

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
    protected $seenPermutations = []; // signature permutasi yang sudah dipakai

    public function __construct($adminUserId)
    {
        $this->adminUserId = $adminUserId;
    }

    /**
     * Titik masuk utama untuk pembuatan jadwal otomatis
     */
    public function generate()
    {
        // Tingkatkan batas waktu dan memori untuk mencegah error 500 di hosting
        set_time_limit(0);
        ini_set('memory_limit', '512M');

        // 1. Siapkan template dan slot waktu yang tersedia
        if (!$this->prepareTemplate()) {
            return ['success' => false, 'message' => 'Template waktu aktif tidak ditemukan. Pastikan Anda sudah menentukan template waktu yang "Aktif" di menu Kelola Template Waktu.'];
        }

        Log::info("AutoSchedule: Template found. Day slots: " . count($this->teachingSlots));

        // 2. Ambil semua data penugasan guru
        $assignments = TeacherAssignment::with(['subject', 'teacher'])
            ->whereHas('subject', function($q) {
                $q->where('weekly_hours', '>', 0);
            })
            ->get();

        if ($assignments->isEmpty()) {
            return ['success' => false, 'message' => 'Tidak ada data penugasan guru (Teacher Assignments) yang memiliki jam per pekan.'];
        }

        // Ambil data kelas terlebih dahulu untuk performa (Pre-fetch)
        $allClasses = SchoolClass::all()->keyBy('id');
        
        // Ambil data ketersediaan guru terlebih dahulu (Pre-fetch)
        $allTeachers = Teacher::whereNotNull('auth_user_id')->get();
        foreach ($allTeachers as $t) {
            $this->teacherAvailability[$t->auth_user_id] = $t->unavailable_days ?: [];
        }

        // 3. Validasi Matematis Awal (Pre-flight Validation)
        $mathCheck = $this->validateMath($assignments);
        if (!$mathCheck['success']) {
            return $mathCheck;
        }

        // 4. Ubah penugasan menjadi Blok Pertemuan
        $initialBlocks = $this->transformAssignmentsToBlocks($assignments, $allClasses);
        Log::info("AutoSchedule: Transformed into " . count($initialBlocks) . " blocks.");

        $maxAttempts = 150; // Dikurangi menjadi 150 agar skenario terburuk gagal hanya memakan waktu ~25 detik
        $attempt = 0;
        $failureStats = [
            'teachers' => [],
            'classes' => []
        ];
        $bestErrors = [];
        $minErrorCount = PHP_INT_MAX;

        // Mulai dari awal (bersih) - hapus DI LUAR perulangan
        DB::beginTransaction();
        try {
            // Bersihkan jadwal mengajar yang sudah ada (Force Delete untuk mencegah database membengkak)
            Schedule::where('type', 'teaching')->forceDelete();
            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return ['success' => false, 'message' => 'Gagal membersihkan jadwal lama: ' . $e->getMessage()];
        }

        while ($attempt < $maxAttempts) {
            $attempt++;
            
            //Tahap 4: Prioritas Berbasis Pola (Pattern-Based Prioritization)
            // Hitung "Mobilitas" untuk setiap blok berdasarkan batasan guru dan kelas
            $blocks = $this->prepareBlocksWithPriority($initialBlocks, $assignments);
            
            $this->occupiedTeachers = [];
            $this->occupiedClasses = [];
            $this->errors = [];

            $results = $this->solve($blocks);

            if ($results['success']) {
                DB::beginTransaction();
                try {
                    // Penyisipan Database Akhir: Penyisipan Massal (Bulk Insert) untuk performa
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
        // Hitung total slot yang tersedia untuk SATU kelas atau SATU guru
        $totalSlots = 0;
        foreach ($this->teachingSlots as $daySlots) {
            $totalSlots += count($daySlots);
        }

        $teacherHours = [];
        $classHours = [];
        $teacherNames = [];
        $classNames = [];
        $availableDaysCount = count($this->teachingSlots);

        // Group assignments by teacher + subject + class for validation
        $groupedHours = [];
        foreach ($assignments as $as) {
            $key = $as->teacher->auth_user_id . '_' . $as->subject_id . '_' . $as->class_id;
            if (!isset($groupedHours[$key])) {
                $groupedHours[$key] = [
                    'total_hours' => 0,
                    'subject_name' => $as->subject->name,
                    'class_id' => $as->class_id,
                    'teacher_id' => $as->teacher->auth_user_id,
                    'teacher_name' => $as->teacher->name,
                ];
            }
            $groupedHours[$key]['total_hours'] += $as->subject->weekly_hours;
        }

        foreach ($groupedHours as $g) {
            $h = $g['total_hours'];
            $tId = $g['teacher_id'];
            $cId = $g['class_id'];

            // Periksa apakah jam pelajaran terlalu tinggi untuk hari-hari yang tersedia
            $neededDays = 0;
            if ($h <= 3) $neededDays = 1;
            elseif ($h <= 5) $neededDays = 2;
            elseif ($h == 6) $neededDays = 3;
            else $neededDays = ceil($h / 3);

            if ($neededDays > $availableDaysCount) {
                $cName = SchoolClass::find($cId)->rombel ?? "Kelas ID:{$cId}";
                return [
                    'success' => false,
                    'message' => "KEGAGALAN MATEMATIS: Mapel '{$g['subject_name']}' di kelas '{$cName}' butuh {$neededDays} hari ({$h} JP), tapi hanya ada {$availableDaysCount} hari aktif."
                ];
            }

            $teacherHours[$tId] = ($teacherHours[$tId] ?? 0) + $h;
            $classHours[$cId] = ($classHours[$cId] ?? 0) + $h;
            $teacherNames[$tId] = $g['teacher_name'];
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

            // Hitung kapasitas pribadi berdasarkan hari yang tidak bersedia (hari libur)
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
        // 1. Hitung Batasan Guru (Tahap 5: Logika Master Packer)
        
        // Hitung total jam per pekan untuk setiap guru, dikelompokkan berdasarkan auth_user_id agar cocok dengan blok
        $teacherJP = $assignments->groupBy(function($as) {
            return $as->teacher ? $as->teacher->auth_user_id : $as->teacher_id;
        })->map->sum(function($as) {
            return $as->subject->weekly_hours ?? 0;
        });

        // [Baru] Konektivitas Guru: Ke berapa banyak kelas guru ini terikat?
        $teacherConnectivity = $assignments->groupBy(function($as) {
            return $as->teacher ? $as->teacher->auth_user_id : $as->teacher_id;
        })->map(function($group) {
            return $group->pluck('class_id')->unique()->count();
        });

        // 2. Petakan blok dengan "Skor Kesulitan Master Packer"
        $scored = collect($blocks)->map(function($b) use ($teacherJP, $teacherConnectivity) {
            $tJP = $teacherJP[$b['teacher_id']] ?? 0;
            $tConn = $teacherConnectivity[$b['teacher_id']] ?? 0;
            
            // Rumus: Ukuran (Size) adalah batasan terbesar, diikuti oleh Konektivitas Lintas Kelas, lalu Total JP.
            $b['difficulty'] = ($b['size'] * 100) + ($tConn * 10) + $tJP;
            
            // [BARU] Prioritas ekstrem untuk PJOK/Olahraga untuk memastikan mereka mendapat slot pagi
            if ($this->isMorningPriority($b['subject_name'])) {
                $b['difficulty'] += 5000;
            }

            // Tambahkan sedikit pengacakan agar mendapat jalur yang berbeda setiap percobaan
            $b['difficulty'] += rand(0, 10);
            
            return $b;
        });

        // 3. Urutkan berdasarkan Kesulitan MENURUN (DESC)
        return $scored->sortByDesc('difficulty')->values()->toArray();
    }

    protected function prepareTemplate()
    {
        // Pertama, coba cari khusus untuk admin spesifik ini
        $profile = UserProfile::where('user_id', $this->adminUserId)->whereNotNull('teaching_time_slots')->first();
        
        // Jika tidak ditemukan, temukan profil MANAPUN yang memiliki slot
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

        // Group assignments by teacher_id + subject_id + class_id, then split total hours
        $groups = [];
        foreach ($assignments as $as) {
            $key = $as->teacher_id . '_' . $as->subject_id . '_' . $as->class_id;
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'total_hours' => 0,
                    'class_id' => $as->class_id,
                    'subject_id' => $as->subject_id,
                    'teacher_id' => $as->teacher_id,
                    'teacher_name' => $as->teacher->name ?? 'Guru',
                    'subject_name' => $as->subject->name,
                    'class_name' => $allClasses[$as->class_id]->rombel ?? '?',
                ];
            }
            $groups[$key]['total_hours'] += $as->subject->weekly_hours;
        }

        // Resolve teacher auth_user_id once per teacher
        $teacherAuthCache = [];
        foreach ($groups as &$g) {
            $tId = $g['teacher_id'];
            if (!isset($teacherAuthCache[$tId])) {
                $t = Teacher::find($tId);
                $teacherAuthCache[$tId] = $t ? ($t->auth_user_id ?? $tId) : $tId;
            }
            $g['teacher_auth_user_id'] = $teacherAuthCache[$tId];
        }
        unset($g);

        foreach ($groups as $g) {
            $hours = $g['total_hours'];
            $split = [];

            // Logika Pemisahan Blok (Split) berdasarkan aturan penggunaan:
            // 2h -> [2]
            // 3h -> [3]
            // 4h -> [2, 2]
            // 5h -> [3, 2]
            // 6h -> [2, 2, 2]
            // Pemisahan Optimal:
            if ($hours == 6) {
                $split = [2, 2, 2];
            } elseif ($hours == 5) {
                $split = [3, 2];
            } elseif ($hours == 4) {
                $split = [2, 2]; // Pemisahan wajib untuk fleksibilitas jadwal
            } elseif ($hours == 3) {
                $split = [3];
            } elseif ($hours == 2) {
                $split = [2];
            } else {
                $split = [$hours];
            }

            foreach ($split as $blockSize) {
                \Illuminate\Support\Facades\Log::info("transformAssignmentsToBlocks: total_hours={$hours}, split=" . json_encode($split) . ", blockSize={$blockSize}, subject={$g['subject_name']}, class={$g['class_id']}");
                $blocks[] = [
                    'assignment_id' => 0,
                    'class_id' => $g['class_id'],
                    'subject_id' => $g['subject_id'],
                    'teacher_id' => $g['teacher_auth_user_id'],
                    'teacher_name' => $g['teacher_name'],
                    'subject_name' => $g['subject_name'],
                    'class_name' => $g['class_name'],
                    'size' => $blockSize,
                ];
            }
        }
        return $blocks;
    }

    protected function solve($blocks)
    {
        // Fase 1: Partisi Matematis (Kerangka)
        // Kelompokkan blok berdasarkan kelas menjadi minggu 5-hari yang 100% penuh
        $grid = $this->partitionAllClasses($blocks);
        if (!$grid) return ['success' => false, 'errors' => [['teacher'=>'System','subject'=>'Partitioning','class'=>'All','size'=>'Gagal menyusun bingkai awal.']]];

        // Fase 2: Penyeimbangan Heatmap Global (Penyeimbang Beban)
        // Pastikan tidak ada guru yang mengajar lebih dari kapasitas hariannya di semua kelas
        $this->balanceHeatmap($grid);

        // Fase 3: Penempatan Intra-hari (Penempatan Slot)
        // Setelah beban seimbang, menyusun potongan ke dalam jam pelajaran menjadi jauh lebih mudah
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
            if (!$partition) return false; // Ini seharusnya tidak terjadi untuk blok 2/3 JP
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
                // Operkan daftar mapel dan guru yang sudah ditempatkan pada hari ini (kosong pada awalnya)
                $usedSubjectsToday = [];
                $usedTeachersToday = [];
                
                // Tambahkan guru yang tidak tersedia (libur) pada hari ini ke usedTeachersToday
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

        return false; // Tidak dapat mempartisi dengan batasan yang diberikan
    }

    protected function balanceHeatmap(&$grid)
    {
        $maxSwaps = 5000; // Ditingkatkan untuk menemukan keadaan tanpa beban berlebih (zero-overload) pada jadwal yang padat
        $lastOverload = null;
        $stuckCount = 0;

        for ($i = 0; $i < $maxSwaps; $i++) {
            $heatmap = $this->calculateHeatmap($grid);
            $overload = $this->findOverload($heatmap);

            if (!$overload) break; // Sudah seimbang!

            // Deteksi jika kita terjebak pada beban berlebih yang sama (tidak ada kemajuan)
            $overloadKey = ($overload['teacher_id'] ?? '') . '-' . ($overload['day'] ?? '');
            if ($lastOverload === $overloadKey) {
                $stuckCount++;
                if ($stuckCount > 15) { // Reaksi lebih cepat saat terjebak
                    // Kita terjebak: Partisi ulang BEBERAPA kelas acak yang melibatkan guru ini
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
        
        // Pilih 2 kelas secara acak untuk dipartisi ulang sepenuhnya
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
                // Kapasitas adalah 0 jika guru tidak tersedia pada hari ini
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
        // Temukan satu kelas-hari di mana guru ini mengalami beban berlebih
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
                
                // Coba tukar sebuah blok dari $badDay dengan blok dari $goodDay di kelas yang SAMA ini
                $daysAvailable = array_keys($days);
                shuffle($daysAvailable);
                
                foreach ($daysAvailable as $goodDay) {
                    if ($goodDay === $badDay) continue;
                    
                    // Cari blok di goodDay yang BUKAN diajar oleh guru yang sama ini
                    foreach ($days[$goodDay] as $idxB => $blockB) {
                        if ($blockB['teacher_id'] !== $teacherId && $blockA['size'] === $blockB['size']) {
                            
                            $tA = $blockA['teacher_id'];
                            $tB = $blockB['teacher_id'];

                            // Cek apakah Guru A sudah mengajar di goodDay
                            $alreadyHasAOnGood = false;
                            foreach ($days[$goodDay] as $bCheck) {
                                if ($bCheck['teacher_id'] === $tA) {
                                    $alreadyHasAOnGood = true;
                                    break;
                                }
                            }
                            if ($alreadyHasAOnGood) continue;

                            // Cek apakah Guru B sudah mengajar di badDay
                            $alreadyHasBOnBad = false;
                            foreach ($days[$badDay] as $bCheck) {
                                if ($bCheck['teacher_id'] === $tB) {
                                    $alreadyHasBOnBad = true;
                                    break;
                                }
                            }
                            if ($alreadyHasBOnBad) continue;

                            // TUKAR POSISI!
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

        // 1. Hasilkan semua permutasi yang valid untuk setiap kelas
        $classPermutations = [];
        foreach ($classes as $classId) {
            $blocks = $grid[$classId][$day];
            $perms = $this->generateAllValidPermutations($blocks, $totalSlots, $slots);
            if (empty($perms)) {
                return null; // Sangat tidak mungkin untuk memenuhi batasan kelas-tunggal sekalipun (misal: PJOK)
            }
            // Acak permutasi agar kita tidak selalu memilih pola yang sama
            shuffle($perms);
            $classPermutations[$classId] = $perms;
        }

        // 2. Pencarian Mundur Berkedalaman (Backtracking DFS) untuk menemukan jadwal harian yang valid secara global
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
        $this->seenPermutations = []; // reset per hari/kelas agar tidak "buntu" lintas hari
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
                
                // PJOK harus selesai sebelum jam ke-6
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
                // Periksa apakah permutasi ini sudah ditambahkan (blok bisa memiliki ukuran dan guru yang sama)
                $sig = serialize($placed);
                if (!isset($this->seenPermutations[$sig])) {
                    $this->seenPermutations[$sig] = true;
                    $validPerms[] = $placed;
                }
            }
        } else {
            for ($i = $l; $i <= $r; $i++) {
                $this->swapBlocks($blocks, $l, $i);
                $this->permuteBlocks($blocks, $l + 1, $r, $totalSlots, $slots, $validPerms);
                $this->swapBlocks($blocks, $l, $i); // kembali ke keadaan semula (backtrack)
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
            $steps = 0; // Atur ulang penghitung pada awal pencarian hari baru
        }
        
        if ($steps++ > 2000) {
            return false; // Gagal cepat jika ruang pencarian terlalu besar/tidak dapat diselesaikan
        }

        if ($classIndex == count($classes)) {
            return true; // Semua kelas dijadwalkan tanpa bentrok
        }

        $classId = $classes[$classIndex];
        $perms = $classPermutations[$classId];

        foreach ($perms as $perm) {
            // Periksa apakah permutasi ini bentrok dengan jadwal yang sudah terisi (occupiedInDay)
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
                // Terapkan penempatan
                foreach ($perm as $p) {
                    $tId = $p['block']['teacher_id'];
                    foreach ($p['periods'] as $s) {
                        $occupiedInDay[$s['period']][$tId] = true;
                    }
                }
                
                $resultSchedules[$classId] = $perm;

                // Lanjutkan ke kelas berikutnya (Rekursif)
                if ($this->backtrackDaySchedule($classes, $classIndex + 1, $classPermutations, $occupiedInDay, $resultSchedules)) {
                    return true;
                }

                // Hapus penempatan (Mundur / Backtrack)
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
        if ($sum > $target || count($results) > 5) return; // Berhenti cepat (Fast stop)

        for ($i = $start; $i < count($blocks); $i++) {
            $b = $blocks[$i];
            
            // BATASAN 1: Tolak jika mapel ini sudah digunakan hari ini di kelas yang sama
            if (in_array($b['subject_id'], $usedSubjects)) continue;

            // BATASAN 2: Tolak jika guru ini sudah mengajar di kelas ini hari ini
            // (Aturan pedagogik standar: 1 guru hanya boleh masuk 1 kelas sekali dalam sehari)
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
        // Ditangani oleh shakeUpTeacherSchedule untuk performa yang lebih baik
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
        if ($sum > $target || count($results) > 20) return; // batasi pencarian

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
     * Fungsi pembantu untuk mengidentifikasi mapel yang memprioritaskan slot pagi (misal: PJOK/Olahraga)
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
