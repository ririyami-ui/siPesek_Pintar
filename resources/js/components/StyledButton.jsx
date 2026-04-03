import React from 'react';

const StyledButton = ({ children, onClick, variant = 'primary', size = 'md', className = '', as: Tag = 'button', ...props }) => {
  const baseClasses = 'inline-flex items-center justify-center font-bold transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-4 py-2 text-xs rounded-xl',
    md: 'px-6 py-3 text-sm rounded-2xl',
    lg: 'px-8 py-4 text-base rounded-[1.25rem]',
    xl: 'px-10 py-5 text-lg rounded-[1.5rem]',
  };

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-indigo-300 dark:hover:bg-indigo-500',
    secondary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none hover:shadow-blue-300 dark:hover:bg-blue-500',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200 dark:shadow-none hover:shadow-rose-300',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-200 dark:shadow-none hover:shadow-emerald-300',
    outline: 'bg-transparent border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-600 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200',
    ai: 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 shadow-xl shadow-indigo-200 dark:shadow-none ring-1 ring-white/20 hover:ring-white/40',
  };

  const buttonProps = Tag === 'button' ? { onClick } : {};

  return (
    <Tag className={`${baseClasses} ${sizes[size]} ${variants[variant]} ${className}`} {...buttonProps} {...props}>
      {children}
    </Tag>
  );
};

export default StyledButton;