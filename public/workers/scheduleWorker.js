self.onmessage = function (e) {
    const data = e.data;

    try {
        const service = new ScheduleGenerator(data);
        const result = service.generate((attempt, max, message) => {
            self.postMessage({ type: 'progress', attempt, max, message });
        });
        self.postMessage({ type: 'done', result });
    } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
    }
};

class ScheduleGenerator {
    constructor(data) {
        this.assignments = data.assignments || [];
        this.classes = data.classes || [];
        this.subjects = data.subjects || [];
        this.teacherAvailability = {}; // tId => [unavailable_days]

        // Parse teaching slots
        const rawData = typeof data.profile?.teaching_time_slots === 'string'
            ? JSON.parse(data.profile?.teaching_time_slots)
            : data.profile?.teaching_time_slots;

        let rawSlots = {};
        if (rawData && rawData.profiles) {
            const activeProfile = rawData.profiles.find(p => p.is_active) || rawData.profiles[0];
            rawSlots = activeProfile?.slots || {};
        } else {
            rawSlots = rawData || {};
        }

        this.teachingSlots = {};
        Object.keys(rawSlots).forEach(day => {
            let slots = [];
            if (Array.isArray(rawSlots[day])) {
                slots = [...rawSlots[day]];
            } else if (rawSlots[day] && typeof rawSlots[day] === 'object') {
                slots = Object.values(rawSlots[day]);
            }
            slots.sort((a, b) => {
                const jamA = parseInt(String(a.jam_ke).replace(/[^0-9]/g, '') || '0');
                const jamB = parseInt(String(b.jam_ke).replace(/[^0-9]/g, '') || '0');
                return jamA - jamB;
            });
            if (slots.length > 0) {
                this.teachingSlots[day] = slots;
            }
        });
    }

    generate(onProgress) {
        const days = Object.keys(this.teachingSlots);
        if (days.length === 0) {
            return { success: false, message: "Template Waktu Kosong." };
        }

        // 1. Setup teacher availability
        this.assignments.forEach(as => {
            const tId = as.teacher?.auth_user_id || as.teacher_id;
            if (as.teacher && !this.teacherAvailability[tId]) {
                this.teacherAvailability[tId] = as.teacher.unavailable_days || [];
            }
        });

        // 2. Validate Math and 24-hour rule
        const mathCheck = this.validateMath();
        if (!mathCheck.success) {
            return mathCheck;
        }

        // 3. Prepare Blocks
        let initialBlocks = this.transformAssignmentsToBlocks();
        if (initialBlocks.length === 0) {
            return { success: false, message: "Tidak ada data penugasan untuk di-generate." };
        }

        const maxAttempts = 1500; // Increased because worker runs in background
        const failureStats = { teachers: {}, classes: {} };
        let bestErrors = [];
        let leastErrors = Infinity;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (attempt % 50 === 0) {
                onProgress(attempt, maxAttempts, `Mencari solusi bentrok (Iterasi #${attempt})...`);
            } else if (attempt === 1) {
                onProgress(1, maxAttempts, "Mulai menyusun jadwal...");
            }

            let blocks = [...initialBlocks];
            this.shuffle(blocks);
            blocks = this.prepareBlocksWithPriority(blocks);

            let grid = {};
            this.classes.forEach(c => {
                grid[c.id] = {};
                days.forEach(d => grid[c.id][d] = []);
            });

            const plan = this.balanceHeatmap(blocks, days, grid);
            if (!plan) continue;

            const solveResult = this.solve(plan, failureStats);
            if (solveResult.success) {
                return { success: true, schedules: this.formatSchedules(solveResult.grid) };
            }

            if (solveResult.errors && solveResult.errors.length < leastErrors) {
                leastErrors = solveResult.errors.length;
                bestErrors = solveResult.errors;
            }
        }

        return this.summarizeFailures(failureStats, maxAttempts, bestErrors);
    }

    validateMath() {
        let totalSlots = 0;
        for (const day in this.teachingSlots) {
            totalSlots += this.teachingSlots[day].length;
        }

        const teacherHours = {};
        const classHours = {};
        const teacherNames = {};
        const classNames = {};

        this.assignments.forEach(as => {
            const h = Number(as.subject?.weekly_hours || 0);
            if (h === 0) return;
            const tId = as.teacher?.auth_user_id || as.teacher_id;
            const cId = as.class_id;

            teacherHours[tId] = (teacherHours[tId] || 0) + h;
            classHours[cId] = (classHours[cId] || 0) + h;
            teacherNames[tId] = as.teacher?.name || `ID:${tId}`;

            const cls = this.classes.find(c => c.id == cId);
            classNames[cId] = cls ? cls.rombel : `Kelas ID:${cId}`;
        });

        for (const tId in teacherHours) {
            const hours = teacherHours[tId];
            const unDays = this.teacherAvailability[tId] || [];

            // NEW RULE: > 30 hours cannot have unDays
            if (hours > 30 && unDays.length > 0) {
                return {
                    success: false,
                    message: `Jadwal Ditolak: Guru ${teacherNames[tId]} memiliki beban ${hours} JP (> 30 JP), namun meminta hari libur. Guru dengan beban mengajar super padat di atas 30 JP tidak diperbolehkan memiliki hari libur khusus untuk menghindari kebuntuan/bentrok jadwal.`
                };
            }

            let personalCapacity = 0;
            for (const day in this.teachingSlots) {
                if (!unDays.includes(day)) {
                    personalCapacity += this.teachingSlots[day].length;
                }
            }

            if (hours > personalCapacity) {
                return {
                    success: false,
                    message: `KEGAGALAN MATEMATIS: Guru '${teacherNames[tId]}' memiliki total ${hours} JP, namun hanya tersedia ${personalCapacity} slot karena hari libur.`
                };
            }
        }

        for (const cId in classHours) {
            const hours = classHours[cId];
            if (hours !== totalSlots) {
                const status = hours > totalSlots ? "Kelebihan" : "Kekurangan";
                const diff = Math.abs(hours - totalSlots);
                return {
                    success: false,
                    message: `JADWAL TIDAK SERASI: Kelas '${classNames[cId]}' memiliki beban ${hours} JP, sedangkan kapasitas template ${totalSlots} JP (${status} ${diff} JP).`
                };
            }
        }

        return { success: true };
    }

    transformAssignmentsToBlocks() {
        const blocks = [];
        this.assignments.forEach(as => {
            const hours = Number(as.subject?.weekly_hours || 0);
            if (hours <= 0) return;

            let split = [];
            if (hours === 6) split = [3, 3];
            else if (hours === 5) split = [3, 2];
            else if (hours === 4) split = [2, 2];
            else if (hours > 3) split = [3, hours - 3];
            else split = [hours];

            split.forEach(size => {
                blocks.push({
                    id: Math.random().toString(36).substr(2, 9),
                    class_id: as.class_id,
                    subject_id: as.subject_id,
                    teacher_id: as.teacher?.auth_user_id || as.teacher_id,
                    subject_name: as.subject?.name || '',
                    teacher_name: as.teacher?.name || '',
                    size: size
                });
            });
        });
        return blocks;
    }

    prepareBlocksWithPriority(blocks) {
        // Simple priority: sort by size descending
        blocks.sort((a, b) => b.size - a.size);
        return blocks;
    }

    balanceHeatmap(blocks, days, grid) {
        // Group blocks by class
        const classBlocks = {};
        blocks.forEach(b => {
            if (!classBlocks[b.class_id]) classBlocks[b.class_id] = [];
            classBlocks[b.class_id].push(b);
        });

        for (const cId in classBlocks) {
            let remaining = classBlocks[cId];
            let failed = false;

            // Limit shuffling for this class to 100 tries
            for (let i = 0; i < 100; i++) {
                failed = false;
                let tempGrid = {};
                days.forEach(d => tempGrid[d] = []);
                let tempRemaining = [...remaining];

                let shuffledDays = [...days];
                this.shuffle(shuffledDays);

                for (const day of shuffledDays) {
                    const target = this.teachingSlots[day].length;
                    const usedSubjects = new Set();
                    const usedTeachers = new Set();

                    for (const tId in this.teacherAvailability) {
                        if (this.teacherAvailability[tId].includes(day)) {
                            usedTeachers.add(parseInt(tId));
                        }
                    }

                    const found = this.findCombinationNoRepeat(tempRemaining, target, usedSubjects, usedTeachers);
                    if (!found) { failed = true; break; }

                    tempGrid[day] = found.blocks;
                    found.indices.sort((a, b) => b - a).forEach(idx => tempRemaining.splice(idx, 1));
                }

                if (!failed && tempRemaining.length === 0) {
                    grid[cId] = tempGrid;
                    break;
                }
            }
            if (failed) return false;
        }

        // FULL HEATMAP BALANCING
        const maxSwaps = 5000;
        let lastOverload = null;
        let stuckCount = 0;

        for (let i = 0; i < maxSwaps; i++) {
            const heatmap = this.calculateHeatmap(grid);
            const overload = this.findOverload(heatmap);

            if (!overload) break; // Balanced!

            const overloadKey = `${overload.teacher_id}-${overload.day}`;
            if (lastOverload === overloadKey) {
                stuckCount++;
                if (stuckCount > 15) {
                    this.shakeUpTeacherSchedule(grid, overload.teacher_id, days);
                    stuckCount = 0;
                }
            } else {
                stuckCount = 0;
            }
            lastOverload = overloadKey;

            this.performBalancedSwap(grid, overload.teacher_id, overload.day);
        }

        return grid;
    }

    shakeUpTeacherSchedule(grid, teacherId, days) {
        const involvedClasses = [];
        for (const classId in grid) {
            const classDays = grid[classId];
            for (const day in classDays) {
                const dayBlocks = classDays[day];
                if (dayBlocks.some(b => parseInt(b.teacher_id) === parseInt(teacherId))) {
                    involvedClasses.push(classId);
                    break; // break inner loop, move to next class
                }
            }
        }

        if (involvedClasses.length === 0) return;

        this.shuffle(involvedClasses);
        const toRebuild = involvedClasses.slice(0, 2);

        for (const classId of toRebuild) {
            let allBlocks = [];
            for (const day in grid[classId]) {
                allBlocks = allBlocks.concat(grid[classId][day]);
            }

            // Re-partition this single class
            let tempGrid = {};
            days.forEach(d => tempGrid[d] = []);
            let tempRemaining = [...allBlocks];
            let shuffledDays = [...days];
            this.shuffle(shuffledDays);

            let failed = false;
            for (const day of shuffledDays) {
                const target = this.teachingSlots[day].length;
                const usedSubjects = new Set();
                const usedTeachers = new Set();

                for (const tId in this.teacherAvailability) {
                    if (this.teacherAvailability[tId].includes(day)) {
                        usedTeachers.add(parseInt(tId));
                    }
                }

                const found = this.findCombinationNoRepeat(tempRemaining, target, usedSubjects, usedTeachers);
                if (!found) { failed = true; break; }

                tempGrid[day] = found.blocks;
                found.indices.sort((a, b) => b - a).forEach(idx => tempRemaining.splice(idx, 1));
            }

            if (!failed && tempRemaining.length === 0) {
                grid[classId] = tempGrid;
            }
        }
    }

    calculateHeatmap(grid) {
        const heatmap = {};
        for (const classId in grid) {
            const days = grid[classId];
            for (const day in days) {
                const blocks = days[day];
                for (const b of blocks) {
                    const tId = b.teacher_id;
                    if (!heatmap[tId]) heatmap[tId] = {};
                    heatmap[tId][day] = (heatmap[tId][day] || 0) + b.size;
                }
            }
        }
        return heatmap;
    }

    findOverload(heatmap) {
        for (const tId in heatmap) {
            const days = heatmap[tId];
            for (const day in days) {
                const load = days[day];
                const unDays = this.teacherAvailability[tId] || [];
                const capacity = unDays.includes(day) ? 0 : (this.teachingSlots[day] ? this.teachingSlots[day].length : 0);

                if (load > capacity) {
                    return { teacher_id: parseInt(tId), day: day, load: load };
                }
            }
        }
        return null;
    }

    performBalancedSwap(grid, teacherId, badDay) {
        for (const classId in grid) {
            const days = grid[classId];
            const blocksOnBadDay = days[badDay] || [];

            const foundIdxA = blocksOnBadDay.findIndex(b => parseInt(b.teacher_id) === parseInt(teacherId));

            if (foundIdxA !== -1) {
                const blockA = blocksOnBadDay[foundIdxA];

                const daysAvailable = Object.keys(days);
                this.shuffle(daysAvailable);

                for (const goodDay of daysAvailable) {
                    if (goodDay === badDay) continue;

                    const blocksOnGoodDay = days[goodDay] || [];

                    for (let idxB = 0; idxB < blocksOnGoodDay.length; idxB++) {
                        const blockB = blocksOnGoodDay[idxB];
                        if (parseInt(blockB.teacher_id) !== parseInt(teacherId) && blockA.size === blockB.size) {

                            const tA = parseInt(blockA.teacher_id);
                            const tB = parseInt(blockB.teacher_id);

                            // Check if Teacher A is already on goodDay
                            if (blocksOnGoodDay.some(b => parseInt(b.teacher_id) === tA)) continue;

                            // Check if Teacher B is already on badDay
                            if (blocksOnBadDay.some(b => parseInt(b.teacher_id) === tB)) continue;

                            // SWAP!
                            days[badDay][foundIdxA] = blockB;
                            days[goodDay][idxB] = blockA;
                            return;
                        }
                    }
                }
            }
        }
    }

    findCombinationNoRepeat(blocks, target, usedSubjects, usedTeachers) {
        const results = [];
        const solve = (start, currentSum, indices) => {
            if (currentSum === target) {
                results.push({ indices: [...indices], blocks: indices.map(i => blocks[i]) });
                return results.length > 5;
            }
            if (currentSum > target || start >= blocks.length) return false;

            for (let i = start; i < blocks.length; i++) {
                const b = blocks[i];
                if (usedSubjects.has(b.subject_id) || usedTeachers.has(parseInt(b.teacher_id))) continue;

                usedSubjects.add(b.subject_id);
                usedTeachers.add(parseInt(b.teacher_id));
                indices.push(i);

                if (solve(i + 1, currentSum + b.size, indices)) return true;

                indices.pop();
                usedTeachers.delete(parseInt(b.teacher_id));
                usedSubjects.delete(b.subject_id);
            }
            return false;
        };

        solve(0, 0, []);
        if (results.length > 0) {
            // Pick a random one
            return results[Math.floor(Math.random() * results.length)];
        }
        return null;
    }

    solve(grid, failureStats) {
        const days = Object.keys(this.teachingSlots);
        const finalGrid = {};

        for (const day of days) {
            const daySchedules = this.solveDaySchedules(grid, day);
            if (!daySchedules) {
                // Record failure
                Object.keys(grid).forEach(cId => {
                    grid[cId][day].forEach(b => {
                        failureStats.teachers[b.teacher_name] = (failureStats.teachers[b.teacher_name] || 0) + 1;
                        failureStats.classes[cId] = (failureStats.classes[cId] || 0) + 1;
                    });
                });
                return { success: false, errors: [] };
            }
            finalGrid[day] = daySchedules;
        }
        return { success: true, grid: finalGrid };
    }

    solveDaySchedules(grid, day) {
        const classIds = Object.keys(grid);
        const classPermutations = {};
        const slotsCount = this.teachingSlots[day].length;

        for (const cId of classIds) {
            const blocks = grid[cId][day];
            const validPerms = [];
            this.permuteBlocks(blocks, 0, blocks.length - 1, slotsCount, validPerms);
            if (validPerms.length === 0) return null;
            this.shuffle(validPerms);
            classPermutations[cId] = validPerms;
        }

        const occupied = {};
        const resultSchedules = {};
        this.dfsSteps = 0; // Instance level step counter

        if (this.backtrackDaySchedule(classIds, 0, classPermutations, occupied, resultSchedules, day)) {
            return resultSchedules;
        }
        return null;
    }

    permuteBlocks(blocks, l, r, totalSlots, validPerms) {
        if (l === r) {
            const placed = [];
            let currentIdx = 0;
            for (const b of blocks) {
                const isSports = b.subject_name.toLowerCase().includes('pjok') || b.subject_name.toLowerCase().includes('olahraga');
                // PJOK constraint: must end before period 6 (index 5)
                if (isSports && (currentIdx + b.size - 1) > 5) return;

                placed.push({ ...b, start_idx: currentIdx });
                currentIdx += b.size;
            }
            validPerms.push(placed);
        } else {
            for (let i = l; i <= r; i++) {
                [blocks[l], blocks[i]] = [blocks[i], blocks[l]];
                this.permuteBlocks(blocks, l + 1, r, totalSlots, validPerms);
                [blocks[l], blocks[i]] = [blocks[i], blocks[l]];
            }
        }
    }

    backtrackDaySchedule(classIds, classIndex, classPermutations, occupied, resultSchedules, day) {
        if (classIndex >= classIds.length) return true;
        if (this.dfsSteps++ > 2000) return false;

        const cId = classIds[classIndex];
        const perms = classPermutations[cId];

        for (const perm of perms) {
            let conflict = false;

            // Check conflicts
            for (const b of perm) {
                for (let i = 0; i < b.size; i++) {
                    const period = b.start_idx + i;
                    const key = `${b.teacher_id}-${period}`;
                    if (occupied[key]) {
                        conflict = true; break;
                    }
                }
                if (conflict) break;
            }

            if (!conflict) {
                // Place
                for (const b of perm) {
                    for (let i = 0; i < b.size; i++) {
                        const period = b.start_idx + i;
                        occupied[`${b.teacher_id}-${period}`] = true;
                    }
                }
                resultSchedules[cId] = perm;

                if (this.backtrackDaySchedule(classIds, classIndex + 1, classPermutations, occupied, resultSchedules, day)) {
                    return true;
                }

                // Backtrack
                for (const b of perm) {
                    for (let i = 0; i < b.size; i++) {
                        const period = b.start_idx + i;
                        occupied[`${b.teacher_id}-${period}`] = false;
                    }
                }
                delete resultSchedules[cId];
            }
        }
        return false;
    }

    formatSchedules(grid) {
        const formatted = [];
        for (const day in grid) {
            const daySchedules = grid[day];
            for (const cId in daySchedules) {
                const blocks = daySchedules[cId];
                for (const b of blocks) {
                    const slots = this.teachingSlots[day];
                    const startSlot = slots[b.start_idx];
                    const endSlot = slots[b.start_idx + b.size - 1];

                    formatted.push({
                        class_id: parseInt(b.class_id),
                        subject_id: parseInt(b.subject_id),
                        teacher_id: parseInt(b.teacher_id),
                        day: day,
                        start_period: parseInt(String(startSlot.jam_ke).replace(/[^0-9]/g, '')),
                        end_period: parseInt(String(endSlot.jam_ke).replace(/[^0-9]/g, '')),
                        start_time: startSlot.mulai || startSlot.jam_mulai || '07:00',
                        end_time: endSlot.selesai || endSlot.jam_selesai || '08:00'
                    });
                }
            }
        }
        return formatted;
    }

    summarizeFailures(stats, maxAttempts, bestErrors) {
        let topTeacher = null;
        let topClass = null;
        let maxT = 0, maxC = 0;

        for (const t in stats.teachers) {
            if (stats.teachers[t] > maxT) { maxT = stats.teachers[t]; topTeacher = t; }
        }
        for (const c in stats.classes) {
            if (stats.classes[c] > maxC) { maxC = stats.classes[c]; topClass = this.classes.find(cl => cl.id == c)?.rombel || c; }
        }

        let message = `Sistem belum berhasil menemukan susunan bebas bentrok setelah ${maxAttempts} percobaan.\n\n`;
        message += "💡 SOLUSI TERBAIK:\nKlik tombol 'Generate Otomatis' sekali lagi untuk mengulang acakan.\n\n";
        message += "🔍 ANALISIS TITIK SULIT:\n";
        if (topTeacher) message += `- Guru yang sering buntu: ${topTeacher}\n`;
        if (topClass) message += `- Kelas yang sering buntu: ${topClass}\n`;

        return { success: false, message, errors: bestErrors };
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
