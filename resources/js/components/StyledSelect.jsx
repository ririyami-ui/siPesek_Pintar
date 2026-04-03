import React from 'react';

const StyledSelect = ({ label, children, ...props }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">{label}</label>}
    <select
      {...props}
      className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all dark:text-white"
    >
      {children}
    </select>
  </div>
);

export default StyledSelect;
