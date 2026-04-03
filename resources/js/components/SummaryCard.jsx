import React from 'react';

const SummaryCard = ({ title, value, icon, color = 'blue', trend, subtitle }) => {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
        yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
    };

    return (
        <div className={`${colorClasses[color]} rounded-xl border p-5 transition-all duration-300 hover:shadow-lg hover:scale-105`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-bold opacity-100 mb-1">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold">{value}</p>
                        {trend && (
                            <span className={`text-xs font-semibold ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {trend.isPositive ? '↑' : '↓'} {trend.value}
                            </span>
                        )}
                    </div>
                    {subtitle && (
                        <p className="text-xs font-bold opacity-90 mt-1">{subtitle}</p>
                    )}
                </div>
                {icon && (
                    <div className="flex-shrink-0 ml-3 opacity-60">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SummaryCard;
