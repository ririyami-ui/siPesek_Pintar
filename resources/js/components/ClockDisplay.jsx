import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import moment from 'moment';
import 'moment/locale/id';
import { useSettings } from '../utils/SettingsContext';

// Force Indonesian locale globally for this component
moment.locale('id');

const ClockDisplay = ({ size = 'lg', variant = 'card', showProgress = false, activeSchedule = null }) => {
  const [currentTime, setCurrentTime] = useState(moment());
  const [schoolName, setSchoolName] = useState('Si Pesek Pintar');
  const [effectiveWeeks, setEffectiveWeeks] = useState(18); // Default 18
  const [currentWeek, setCurrentWeek] = useState(0);
  const [pekanEfektifData, setPekanEfektifData] = useState([]);
  const [userHolidays, setUserHolidays] = useState([]);
  const { userProfile, academicYear, activeSemester } = useSettings();

  useEffect(() => {
    if (userProfile?.school_name) {
      setSchoolName(userProfile.school_name);
    }
  }, [userProfile]);

  useEffect(() => {
    const fetchProgressData = async () => {
      if (showProgress && academicYear && activeSemester) {
        try {
          // 1. Fetch Holidays
          const hRes = await api.get('/holidays');
          setUserHolidays(hRes.data.data || []);

          // 2. Fetch Teaching Programs (for Pekan Efektif)
          const tpRes = await api.get('/teaching-programs', {
            params: {
              semester: activeSemester,
              academic_year: academicYear
            }
          });

          const fetchedPrograms = tpRes.data.data || [];

          // Find relevant program for pekan efektif
          let targetProgram = null;
          if (activeSchedule) {
            targetProgram = fetchedPrograms.find(p =>
              p.subject_id === activeSchedule.subject_id &&
              p.class_id === activeSchedule.class_id
            );
          }

          // Fallback to any program if specific not found
          if (!targetProgram && fetchedPrograms.length > 0) {
            targetProgram = fetchedPrograms[0];
          }

          if (targetProgram && targetProgram.pekan_efektif) {
            const pepData = typeof targetProgram.pekan_efektif === 'string'
              ? JSON.parse(targetProgram.pekan_efektif)
              : targetProgram.pekan_efektif;

            setPekanEfektifData(pepData);
            const total = pepData.reduce((acc, curr) =>
              acc + (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0)), 0);
            if (total > 0) setEffectiveWeeks(total);
          }
        } catch (error) {
          console.error("Error fetching progress data:", error);
        }
      }
    };

    fetchProgressData();
  }, [showProgress, activeSchedule, academicYear, activeSemester]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Helper to determine if a week is blocked by holidays (Matches PromesView logic)
  const getHolidayForWeek = (monthName, wIndex) => {
    if (!academicYear) return null;
    const monthMap = {
      'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6,
      'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
    };
    const monthNum = monthMap[monthName];
    if (!monthNum) return null;

    const years = academicYear.split('/');
    const actualYear = monthNum >= 7 ? years[0] : years[1];
    const weekStart = moment(`${actualYear}-${monthNum}-${(wIndex * 7) + 1}`, 'YYYY-MM-D').startOf('day');
    const weekEnd = weekStart.clone().add(6, 'days').endOf('day');

    const holiday = userHolidays.find(h => {
      const hStart = moment(h.startDate || h.date).startOf('day');
      const hEnd = moment(h.endDate || h.date).endOf('day');
      return hStart.isSameOrBefore(weekEnd) && hEnd.isSameOrAfter(weekStart);
    });

    if (!holiday) return null;

    const hStart = moment(holiday.startDate || holiday.date).startOf('day');
    const hEnd = moment(holiday.endDate || holiday.date).endOf('day');
    const overlapStart = moment.max(weekStart, hStart);
    const overlapEnd = moment.min(weekEnd, hEnd);
    const overlapDays = overlapEnd.diff(overlapStart, 'days') + 1;

    return overlapDays >= 4; // Blocking if >= 4 days
  };

  // Improved logic using ProMeS-style week-by-week scan, strictly capped by Teacher's manual sum
  useEffect(() => {
    const calculateProgress = () => {
      if (pekanEfektifData.length > 0 && academicYear) {
        const now = moment();
        let currentEffCount = 0;
        let totalEffCount = 0;

        // 1. Calculate the REAL target from the manual table (This fixes "jumlah tidak sama")
        const manualTargetTotal = pekanEfektifData.reduce((acc, curr) =>
          acc + Math.max(0, (parseInt(curr.totalWeeks || 0) - parseInt(curr.nonEffectiveWeeks || 0))), 0);

        setEffectiveWeeks(manualTargetTotal);

        // 2. Scan weeks to find current position, but cap per month based on manual data
        pekanEfektifData.forEach(month => {
          const totalWeeksInMonth = parseInt(month.totalWeeks || 4);
          const manualEffectiveInMonth = Math.max(0, totalWeeksInMonth - parseInt(month.nonEffectiveWeeks || 0));
          let monthEffPassed = 0;
          let monthEffTotalFoundByScan = 0;

          const monthMap = {
            'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6,
            'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12
          };
          const mNum = monthMap[month.name];
          const years = academicYear.split('/');
          const actualYear = mNum >= 7 ? years[0] : years[1];

          for (let w = 0; w < totalWeeksInMonth; w++) {
            const isBlocked = getHolidayForWeek(month.name, w);
            const weekStart = moment(`${actualYear}-${mNum}-${(w * 7) + 1}`, 'YYYY-MM-D').startOf('day');

            if (!isBlocked) {
              monthEffTotalFoundByScan++;
              // Only count as passed if it's before or during now, AND we haven't exceeded teacher's manual month total
              if (now.isSameOrAfter(weekStart) && monthEffPassed < manualEffectiveInMonth) {
                monthEffPassed++;
              }
            }
          }

          // Case: If scan found more/less than manual total, we normalize to the manual total
          // If the month has fully passed (now is after month end)
          const monthEnd = moment(`${actualYear}-${mNum}-01`, 'YYYY-MM-DD').endOf('month');
          if (now.isAfter(monthEnd)) {
            currentEffCount += manualEffectiveInMonth;
          } else if (now.isSameOrAfter(moment(`${actualYear}-${mNum}-01`, 'YYYY-MM-DD').startOf('month'))) {
            // We are in the current month
            currentEffCount += monthEffPassed;
          }
          // If future month, currentEffCount doesn't increase
        });

        setCurrentWeek(Math.max(1, Math.min(currentEffCount, manualTargetTotal)));
      } else {
        // Simple fallback
        const now = moment();
        const month = now.month();
        let semesterStart = month >= 6 ? moment().month(6).startOf('month') : moment().month(0).startOf('month');
        const diffWeeks = now.diff(semesterStart, 'weeks') + 1;
        setCurrentWeek(Math.max(1, Math.min(diffWeeks, effectiveWeeks)));
      }
    };

    calculateProgress();
  }, [pekanEfektifData, userHolidays, currentTime, academicYear]);

  const [displayWeek, setDisplayWeek] = useState(0);

  // Smooth number count-up animation
  useEffect(() => {
    if (currentWeek > 0) {
      if (displayWeek < currentWeek) {
        const timer = setTimeout(() => setDisplayWeek(prev => prev + 1), 50);
        return () => clearTimeout(timer);
      } else if (displayWeek > currentWeek) {
        setDisplayWeek(currentWeek);
      }
    }
  }, [currentWeek, displayWeek]);

  // Handle case where effectiveWeeks changes
  useEffect(() => {
    if (currentWeek > 0 && displayWeek === 0) {
      setDisplayWeek(0);
    }
  }, [currentWeek]);

  const timeStr = currentTime.format('HH:mm:ss');
  const [hours, minutes, seconds] = timeStr.split(':');

  // Manual Indonesian date formatter to ensure it works regardless of library locale issues
  const formatIndonesianDate = (m) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const dayName = days[m.day()];
    const dayDate = m.date();
    const monthName = months[m.month()];
    const year = m.year();
    return `${dayName}, ${dayDate} ${monthName} ${year}`;
  };

  const isSmall = size === 'sm';
  const isMinimal = variant === 'minimal';

  const segmentSize = isSmall ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl lg:text-4xl xl:text-5xl';
  const labelSize = isSmall ? 'text-[8px]' : 'text-[9px] sm:text-[10px]';
  const dotSize = isSmall ? 'w-1 h-1' : 'w-1.5 h-1.5 sm:w-2 sm:h-2';
  const gapSize = isSmall ? 'gap-1.5' : 'gap-2 sm:gap-2.5 lg:gap-2';

  const SegmentDisplay = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Background Segments (Off state) */}
        <span className={`${segmentSize} font-bold text-gray-200 dark:text-gray-800 opacity-20`}
          style={{ fontFamily: 'DSEG7Classic, monospace' }}>
          88
        </span>
        {/* Active Segments (On state) */}
        <p className={`absolute inset-0 z-10 ${segmentSize} font-bold text-cyan-700 dark:text-cyan-500 drop-shadow-[0_0_8px_rgba(8,145,178,0.3)]`}
          style={{ fontFamily: 'DSEG7Classic, monospace' }}>
          {value}
        </p>
      </div>
      {!isSmall && (
        <span className={`${labelSize} font-bold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-widest`}>
          {label}
        </span>
      )}
    </div>
  );

  // The containerClasses variable is no longer used as the classes are applied directly in the return statement.
  // const containerClasses = isMinimal
  //   ? "flex flex-col items-center"
  //   : "bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm mx-auto overflow-hidden";

  return (
    <div className={`
      relative group overflow-hidden animate-fade-in-up w-full mx-0
      ${isSmall ? 'py-2 px-3' : 'py-4 px-4 sm:py-6 sm:px-5'}
      ${variant === 'card' ? 'bg-white/80 dark:bg-purple-900/40 backdrop-blur-xl border border-white/20 dark:border-purple-700/30 shadow-xl rounded-3xl' : ''}
      ${variant === 'glass' ? 'bg-white/10 dark:bg-purple-900/20 backdrop-blur-md border border-white/10 rounded-2xl' : ''}
      ${variant === 'minimal' ? 'bg-transparent' : ''}
    `}>
      {/* School Name Header - Hidden in sm minimal */}
      {!isMinimal && (
        <div className="mb-4 text-center">
          <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-tighter truncate px-2">
            {schoolName}
          </h3>
          <div className="h-0.5 w-12 bg-cyan-700 mx-auto mt-1 rounded-full opacity-50" />
        </div>
      )}

      {/* Main Clock Face */}
      <div className={`flex items-center justify-center ${gapSize} ${!isMinimal ? 'mb-4' : ''} select-none`}>
        <SegmentDisplay value={hours} label="Jam" />

        <div className={`flex flex-col ${isSmall ? 'gap-1.5' : 'gap-3'} py-2`}>
          <div className={`${dotSize} bg-cyan-700 dark:bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(8,145,178,0.5)]`} />
          <div className={`${dotSize} bg-cyan-700 dark:bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(8,145,178,0.5)]`} />
        </div>

        <SegmentDisplay value={minutes} label="Menit" />

        <div className={`flex flex-col ${isSmall ? 'gap-1.5' : 'gap-3'} py-2`}>
          <div className={`${dotSize} bg-cyan-700 dark:bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(8,145,178,0.5)]`} />
          <div className={`${dotSize} bg-cyan-700 dark:bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(8,145,178,0.5)]`} />
        </div>

        <SegmentDisplay value={seconds} label="Detik" />
      </div>

      {/* Elegant Date Footer */}
      {!isSmall && (
        <div className={`pt-4 ${!isMinimal ? 'border-t border-gray-100 dark:border-gray-800' : ''} text-center space-y-3`}>
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 tracking-[0.2em] uppercase italic">
            {formatIndonesianDate(currentTime)}
          </p>

          {/* Progress Tracker Pekan Efektif */}
          {showProgress && (
            <div className="mt-4 px-1 animate-fade-in-up">
              <div className="flex justify-between items-center mb-2 px-0.5">
                <span className="text-[9px] sm:text-[10px] font-black text-cyan-700 dark:text-cyan-400 uppercase tracking-[0.2em] opacity-90 truncate max-w-[180px]">
                  {activeSchedule ? `${activeSchedule.subject} (${activeSchedule.class})` : 'Progress Semester'}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-white tabular-nums">
                    {displayWeek}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-purple-400/60">
                    / {effectiveWeeks}
                  </span>
                </div>
              </div>

              {/* Animated Progress Bar Container */}
              <div className="relative h-2.5 sm:h-3 w-full bg-gray-200/50 dark:bg-purple-950/40 rounded-full overflow-hidden border border-white/20 dark:border-purple-800/20 shadow-inner">
                {/* Shimmer Effect Layer */}
                <div className="absolute inset-0 z-10 opacity-30 pointer-events-none overflow-hidden">
                  <div className="h-full w-24 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
                </div>

                {/* Main Progress Bar */}
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                  style={{ width: `${(currentWeek / effectiveWeeks) * 100}%` }}
                >
                  {/* Glossy Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />

                  {/* Pulsing Head Indicator */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full flex items-center justify-center animate-pulse-glow-head">
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_4px_rgba(34,211,238,1)]" />
                  </div>
                </div>
              </div>

              {/* Sub-label */}
              <div className="mt-1.5 flex justify-between items-center opacity-60">
                <span className="text-[7px] sm:text-[8px] font-bold text-gray-400 dark:text-purple-300 uppercase tracking-widest">
                  Target Capaian
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold text-cyan-600 dark:text-cyan-400">
                  {Math.round((currentWeek / (effectiveWeeks || 1)) * 100)}% Complete
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {isSmall && isMinimal && (
        <p className="text-[10px] font-bold text-cyan-800 dark:text-cyan-200 mt-2 tracking-widest uppercase opacity-80">
          {formatIndonesianDate(currentTime)}
        </p>
      )}
    </div >
  );
};

export default ClockDisplay;