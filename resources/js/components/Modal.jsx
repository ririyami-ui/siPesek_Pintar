// src/components/Modal.jsx
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Komponen modal yang dapat digunakan kembali.
 * Modal ini menggunakan createPortal untuk merender di luar DOM utama.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Konten yang akan ditampilkan di dalam modal.
 * @param {function} props.onClose - Fungsi yang dipanggil saat modal ditutup.
 * @param {string} props.size - Ukuran modal (sm, md, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, full).
 */
export default function Modal({ children, onClose, size = 'lg', zIndex = 'z-50', position = 'center' }) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    'full': 'max-w-[95vw]'
  };

  const positionClasses = {
    center: 'items-end sm:items-center',
    top: 'items-start pt-4 sm:items-center sm:pt-4',
    bottom: 'items-end'
  };

  const animationClasses = {
    center: 'animate-in slide-in-from-bottom sm:zoom-in',
    top: 'animate-in slide-in-from-top sm:zoom-in',
    bottom: 'animate-in slide-in-from-bottom'
  };

  return createPortal(
    <div className={`fixed inset-0 ${zIndex} flex ${positionClasses[position] || positionClasses.center} justify-center bg-gray-900/60 p-0 sm:p-4 font-sans backdrop-blur-sm transition-all duration-300`}>
      <div className={`relative flex w-full ${sizeClasses[size] || sizeClasses.lg} flex-col ${position === 'top' ? 'rounded-b-[2.5rem] sm:rounded-3xl' : 'rounded-t-[2.5rem] sm:rounded-3xl'} bg-white shadow-2xl dark:bg-gray-800 dark:text-white ${animationClasses[position] || animationClasses.center} duration-300`}>
        <div className="flex items-center justify-end p-4">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full absolute top-3 left-1/2 -translate-x-1/2 sm:hidden" />
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-10 pt-2 sm:px-12 sm:pb-12 sm:pt-0" style={{ maxHeight: '85vh' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
