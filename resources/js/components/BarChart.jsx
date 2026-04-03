import React from 'react';

const BarChart = ({ data, title }) => {
    // data format: [{ label: 'Label', value: 100, color: 'blue' }, ...]
    const maxValue = Math.max(...data.map(item => item.value), 1);

    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        red: 'bg-red-500',
        yellow: 'bg-yellow-500',
        purple: 'bg-purple-500',
        indigo: 'bg-indigo-500',
        orange: 'bg-orange-500',
        pink: 'bg-pink-500',
    };

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-6">
            {title && (
                <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">{title}</h3>
            )}
            <div className="space-y-4">
                {data.map((item, index) => {
                    const percentage = (item.value / maxValue) * 100;
                    return (
                        <div key={index} className="space-y-2">
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {item.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {item.value}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full ${colorClasses[item.color] || 'bg-blue-500'} rounded-full transition-all duration-700 ease-out`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BarChart;
