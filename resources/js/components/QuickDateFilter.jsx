import React from 'react';

const QuickDateFilter = ({ onSelect }) => {
    const getDateRange = (days) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    };

    const getSemesterRange = () => {
        const now = new Date();
        const currentMonth = now.getMonth(); // 0-11
        const currentYear = now.getFullYear();

        // Semester 1: July - December
        // Semester 2: January - June
        const isFirstSemester = currentMonth >= 6; // July (6) onwards

        let startDate, endDate;

        if (isFirstSemester) {
            // Current semester is 1 (July - December)
            startDate = new Date(currentYear, 6, 1); // July 1st
            endDate = new Date(currentYear, 11, 31); // December 31st
        } else {
            // Current semester is 2 (January - June)
            startDate = new Date(currentYear, 0, 1); // January 1st
            endDate = new Date(currentYear, 5, 30); // June 30th
        }

        return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
        };
    };

    const presets = [
        { label: '7 Hari', getValue: () => getDateRange(7) },
        { label: '30 Hari', getValue: () => getDateRange(30) },
        { label: '90 Hari', getValue: () => getDateRange(90) },
        { label: 'Semester Ini', getValue: getSemesterRange },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {presets.map((preset, index) => (
                <button
                    key={index}
                    onClick={() => {
                        const { start, end } = preset.getValue();
                        onSelect(start, end);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 hover:shadow-md"
                >
                    {preset.label}
                </button>
            ))}
        </div>
    );
};

export default QuickDateFilter;
