import axios from 'axios';

class AutoScheduleService {
    constructor(data) {
        this.assignments = data.assignments || [];
        this.classes = data.classes || [];
        this.subjects = data.subjects || [];
        this.callCounter = 0;
        
        try {
            const rawData = typeof data.profile?.teaching_time_slots === 'string' 
                ? JSON.parse(data.profile.teaching_time_slots) 
                : data.profile?.teaching_time_slots;

            let rawSlots = {};
            if (rawData && rawData.profiles) {
                const activeProfile = rawData.profiles.find(p => p.is_active) || rawData.profiles[0];
                rawSlots = activeProfile?.slots || {};
            } else {
                rawSlots = rawData || {};
            }

            // --- CRITICAL FIX: SORT AND CLEAN SLOTS ---
            this.teachingSlots = {};
            Object.keys(rawSlots).forEach(day => {
                let slots = [];
                if (Array.isArray(rawSlots[day])) {
                    slots = [...rawSlots[day]];
                } else if (rawSlots[day] && typeof rawSlots[day] === 'object') {
                    // Handle if data comes as object/associative array
                    slots = Object.values(rawSlots[day]);
                }

                // Sort by jam_ke numerically
                slots.sort((a, b) => {
                    const jamA = parseInt(String(a.jam_ke).replace(/[^0-9]/g, '') || '0');
                    const jamB = parseInt(String(b.jam_ke).replace(/[^0-9]/g, '') || '0');
                    return jamA - jamB;
                });
                this.teachingSlots[day] = slots;
            });
            console.log("AutoSchedule: Sorted slots:", this.teachingSlots);
            // ------------------------------------------

        } catch (e) {
            console.error("AutoSchedule: Error parsing teaching slots:", e);
            this.teachingSlots = {};
        }
        this.config = { maxAttempts: 1000 }; 
    }

    async generate(onProgress) {
        try {
            if (onProgress) onProgress(1, 1, "Menganalisis data penugasan...");
            console.log("AutoSchedule: Starting generate process...");
            
            const days = Object.keys(this.teachingSlots).filter(day => (this.teachingSlots[day] || []).length > 0);
            if (days.length === 0) {
                console.warn("AutoSchedule: No active days found in teaching slots.");
                return { success: false, message: "Template Waktu Kosong." };
            }

            const blocks = this.prepareBlocks(this.assignments);
            if (onProgress) onProgress(1, 1, `Menyiapkan ${blocks.length} blok pelajaran...`);
            console.log(`AutoSchedule: Prepared ${blocks.length} blocks for distribution.`);

            if (blocks.length === 0) {
                return { success: false, message: "Data Penugasan Guru Kosong atau JP bernilai 0." };
            }

            // Main attempts loop
            for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
                await new Promise(r => setTimeout(r, 0));
                
                if (onProgress) onProgress(attempt, this.config.maxAttempts);

                // 1. Initial State: Fill each class's "Bingkai"
                let schedule = await this.initializeValidClassSchedules(blocks, days, onProgress);
                if (!schedule) {
                    console.log(`AutoSchedule: Attempt ${attempt} - Failed to initialize class schedules.`);
                    continue;
                }

                // 2. Optimization: Resolve teacher conflicts using Stochastic Hill Climbing
                if (await this.optimizeTeacherConflicts(schedule, days, 5000, onProgress)) {
                    console.log(`AutoSchedule: SUCCESS at attempt ${attempt}!`);
                    
                    // --- FORMAT DATA UNTUK SERVER (BACKEND) ---
                    const formattedSchedules = schedule.map(block => {
                        const startP = parseInt(block.jam_ke);
                        const endP = startP + parseInt(block.size) - 1;
                        
                        const daySlots = this.teachingSlots[block.day] || [];
                        
                        // Robust matching: strip non-numeric chars from jam_ke
                        const findSlot = (p) => daySlots.find(s => {
                            const numericJamKe = parseInt(String(s.jam_ke).replace(/[^0-9]/g, ''));
                            return numericJamKe === p;
                        });

                        const startSlot = findSlot(startP);
                        const endSlot = findSlot(endP);

                        return {
                            class_id: parseInt(block.class_id),
                            subject_id: parseInt(block.subject_id),
                            teacher_id: parseInt(block.teacher_id),
                            day: block.day,
                            start_period: startP,
                            end_period: endP,
                            start_time: startSlot?.mulai || startSlot?.jam_mulai || '07:00',
                            end_time: endSlot?.selesai || endSlot?.jam_selesai || '08:00'
                        };
                    });

                    return { success: true, schedules: formattedSchedules };
                }
            }

            return { 
                success: false, 
                message: "Gagal menyusun jadwal lengkap. Analisis: Jadwal Anda memiliki kapasitas 100% (padat presisi). Sistem telah mencoba ribuan kombinasi pertukaran namun tetap ada bentrok guru. Coba cek apakah ada guru yang bebannya melebihi slot harian."
            };
        } catch (e) {
            console.error("AutoSchedule: Fatal Error:", e);
            return { success: false, message: "Sistem Error: " + e.message };
        }
    }

    prepareBlocks(assignments) {
        const blocks = [];
        assignments.forEach(as => {
            // Null checks to prevent crash
            if (!as || !as.subject) return;

            const tId = as.teacher?.auth_user_id || as.teacher_id;
            const hours = Number(as.subject?.weekly_hours || 0);
            if (hours <= 0) return;

            let split = [];
            if (hours === 6) split = [3, 3];
            else if (hours === 5) split = [3, 2];
            else if (hours === 4) split = [2, 2];
            else if (hours > 3) split = [3, hours - 3];
            else split = [hours];
            
            split.forEach(size => {
                if (size > 0) blocks.push({
                    id: Math.random().toString(36).substr(2, 9),
                    class_id: as.class_id,
                    subject_id: as.subject_id,
                    teacher_id: tId,
                    teacher_name: as.teacher?.name || '?',
                    subject_name: as.subject?.name || '?',
                    size: size
                });
            });
        });
        return blocks;
    }

    async initializeValidClassSchedules(blocks, days, onProgress) {
        const schedule = [];
        const classGroups = {};
        blocks.forEach(b => {
            if (!classGroups[b.class_id]) classGroups[b.class_id] = [];
            classGroups[b.class_id].push(b);
        });

        const classIds = Object.keys(classGroups);
        for (let i = 0; i < classIds.length; i++) {
            const classId = classIds[i];
            const classBlocks = classGroups[classId];
            
            const className = this.classes.find(c => c.id == classId)?.rombel || `ID:${classId}`;
            
            // LOG & PROGRESS: Call this BEFORE the heavy computation starts
            console.log(`AutoSchedule: Starting class [${className}] frame filling...`);
            if (onProgress) onProgress(1, 1, `Menyiapkan bingkai ${className}...`);
            
            await new Promise(r => setTimeout(r, 0));
            
            const classSchedule = await this.fillClassBingkai(classBlocks, days);
            if (!classSchedule) {
                console.warn(`AutoSchedule: Failed to fill frame for class ${className}. JP might exceed available slots.`);
                return null;
            }
            schedule.push(...classSchedule);
        }
        return schedule;
    }

    async fillClassBingkai(blocks, days) {
        // New Strategy: Fill DAY BY DAY. Much faster for 100% capacity schedules.
        const result = [];
        const remaining = [...blocks];
        
        const solveDay = async (dIdx, currentRemaining) => {
            if (dIdx >= days.length) return currentRemaining.length === 0;
            const day = days[dIdx];
            const targetJP = this.teachingSlots[day].length;
            
            // Find all possible combinations of blocks that sum up to exactly targetJP
            const combinations = this.findExactJPCombinations(currentRemaining, targetJP);
            this.shuffle(combinations); // Try different patterns (3-2-3 vs 3-3-2 etc)

            for (const combo of combinations) {
                const nextRemaining = [...currentRemaining];
                // Remove used blocks from remaining pool
                combo.indices.sort((a, b) => b - a).forEach(idx => nextRemaining.splice(idx, 1));
                
                // Assign periods for this day's combo
                let currentJam = parseInt(this.teachingSlots[day][0].jam_ke);
                const assignedBlocks = combo.blocks.map(b => {
                    const assigned = { ...b, day, jam_ke: currentJam };
                    currentJam += parseInt(b.size);
                    return assigned;
                });

                result.push(...assignedBlocks);
                if (await solveDay(dIdx + 1, nextRemaining)) return true;
                
                // Backtrack
                for (let k = 0; k < assignedBlocks.length; k++) result.pop();
            }
            return false;
        };

        if (await solveDay(0, remaining)) return result;
        return null;
    }

    findExactJPCombinations(blocks, target) {
        const results = [];
        const solve = (start, currentSum, indices, usedSubjects) => {
            if (currentSum === target) {
                results.push({ indices: [...indices], blocks: indices.map(idx => blocks[idx]) });
                return results.length >= 10; // Limit to 10 pattern variations per day
            }
            if (currentSum > target || start >= blocks.length) return false;

            for (let i = start; i < blocks.length; i++) {
                if (usedSubjects.has(blocks[i].subject_id)) continue;
                usedSubjects.add(blocks[i].subject_id);
                indices.push(i);
                if (solve(i + 1, currentSum + blocks[i].size, indices, usedSubjects)) return true;
                indices.pop();
                usedSubjects.delete(blocks[i].subject_id);
            }
            return false;
        };
        solve(0, 0, [], new Set());
        return results;
    }

    async optimizeTeacherConflicts(schedule, days, maxIterations, onProgress) {
        let currentScore = this.countAllTeacherConflicts(schedule);
        // If there are zero critical conflicts (score < 1000) and it's already perfect, return
        if (currentScore === 0) return true;

        const iterations = 50000; 

        for (let i = 0; i < iterations; i++) {
            if (i % 1000 === 0) {
                await new Promise(r => setTimeout(r, 0));
                const clashes = Math.floor(currentScore / 1000);
                const sportsViolations = currentScore % 1000;
                
                let progressMsg = `Menyelesaikan ${clashes} bentrok guru...`;
                if (clashes === 0 && sportsViolations > 0) {
                    progressMsg = `Mengatur ${sportsViolations} jam PJOK ke pagi hari...`;
                }
                if (onProgress) onProgress(null, null, progressMsg);
            }

            const classId = this.classes[Math.floor(Math.random() * this.classes.length)].id;
            const classBlocks = schedule.filter(s => s.class_id === classId);
            const strategy = Math.random();
            
            if (strategy < 0.7) {
                const b1 = classBlocks[Math.floor(Math.random() * classBlocks.length)];
                const b2 = classBlocks[Math.floor(Math.random() * classBlocks.length)];
                
                if (b1.id !== b2.id && b1.day !== b2.day && b1.size === b2.size) {
                    const oldD1 = b1.day, oldJ1 = b1.jam_ke;
                    const oldD2 = b2.day, oldJ2 = b2.jam_ke;
                    
                    const b1SubInD2 = classBlocks.some(b => b.day === oldD2 && b.subject_id === b1.subject_id && b.id !== b2.id);
                    const b2SubInD1 = classBlocks.some(b => b.day === oldD1 && b.subject_id === b2.subject_id && b.id !== b1.id);
                    
                    if (!b1SubInD2 && !b2SubInD1) {
                        b1.day = oldD2; b1.jam_ke = oldJ2;
                        b2.day = oldD1; b2.jam_ke = oldJ1;
                        
                        const newScore = this.countAllTeacherConflicts(schedule);
                        // Accept if score is lower, or occasionally accept same score to keep moving
                        if (newScore < currentScore || (newScore === currentScore && Math.random() > 0.95)) {
                            currentScore = newScore;
                            // If we have zero critical clashes, and we've reached a good point, we can potentially finish
                            // but we continue to try and optimize sports for the full iterations
                            if (currentScore === 0) return true;
                        } else {
                            b1.day = oldD1; b1.jam_ke = oldJ1;
                            b2.day = oldD2; b2.jam_ke = oldJ2;
                        }
                    }
                }
            } else {
                const d1 = days[Math.floor(Math.random() * days.length)];
                const d2 = days[Math.floor(Math.random() * days.length)];
                
                if (d1 !== d2 && this.teachingSlots[d1].length === this.teachingSlots[d2].length) {
                    const blocksD1 = classBlocks.filter(b => b.day === d1);
                    const blocksD2 = classBlocks.filter(b => b.day === d2);
                    
                    blocksD1.forEach(b => b.day = d2);
                    blocksD2.forEach(b => b.day = d1);
                    
                    const newScore = this.countAllTeacherConflicts(schedule);
                    if (newScore < currentScore || (newScore === currentScore && Math.random() > 0.95)) {
                        currentScore = newScore;
                        if (currentScore === 0) return true;
                    } else {
                        blocksD1.forEach(b => b.day = d1);
                        blocksD2.forEach(b => b.day = d2);
                    }
                }
            }

            // If we have 0 teacher clashes, but some PJOK violations, 
            // we give it some more time but can finish early if needed
            if (currentScore < 1000 && i > 25000) {
                 // After half iterations, if no clashes exist, we're good enough
                 return true;
            }
        }
        return currentScore < 1000; // Success if no teacher clashes
    }

    countAllTeacherConflicts(schedule) {
        const teacherOccupied = {};
        let score = 0;
        
        schedule.forEach(b => {
            const isSports = (b.subject_name || '').toLowerCase().includes('pjok') || 
                            (b.subject_name || '').toLowerCase().includes('olahraga');

            for (let i = 0; i < b.size; i++) {
                const currentJam = parseInt(b.jam_ke) + i;
                const key = `${b.teacher_id}-${b.day}-${currentJam}`;
                
                // Penalty for teacher clash (Hard)
                if (teacherOccupied[key]) {
                    score += 1000;
                }
                teacherOccupied[key] = true;

                // Penalty for sports in afternoon (Soft)
                // Jam ke 5, 6, 7, 8 are afternoon
                if (isSports && currentJam > 4) {
                    score += 1;
                }
            }
        });
        return score;
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}

export default AutoScheduleService;
