/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // Enable dark mode
    content: [
        "./resources/**/*.blade.php",
        "./resources/**/*.js",
        "./resources/**/*.jsx",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#4F46E5', // Indigo 600
                    '50': '#EEF2FF',
                    '100': '#E0E7FF',
                    '200': '#C7D2FE',
                    '300': '#A5B4FC',
                    '400': '#818CF8',
                    '500': '#6366F1',
                    '600': '#4F46E5',
                    '700': '#4338CA',
                    '800': '#3730A3',
                    '900': '#312E81',
                    '950': '#1E1B4B',
                },
                secondary: {
                    DEFAULT: '#10B981', // Emerald 500
                    '50': '#ECFDF5',
                    '100': '#D1FAE5',
                    '200': '#A7F3D0',
                    '300': '#6EE7B7',
                    '400': '#34D399',
                    '500': '#10B981',
                    '600': '#059669',
                    '700': '#047857',
                    '800': '#065F46',
                    '900': '#064E3B',
                    '950': '#022C22',
                },
                background: {
                    light: '#F9FAFB', // Gray 50
                    dark: '#111827',  // Gray 900
                },
                surface: {
                    light: '#FFFFFF', // White
                    dark: '#1F2937',  // Gray 800
                },
                text: {
                    light: '#1F2937', // Gray 800
                    dark: '#F9FAFB',  // Gray 50
                },
                'text-muted': {
                    light: '#6B7280', // Gray 500
                    dark: '#9CA3AF',  // Gray 400
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                orbitron: ['Orbitron', 'sans-serif'],
                dseg7classic: ['DSEG7Classic', 'monospace'], // Added DSEG7Classic
            },
            keyframes: {
                'pulse-yellow': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.7)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(250, 204, 21, 0)' },
                },
                'pulse-active': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(79, 70, 229, 0.6)' },
                    '50%': { boxShadow: '0 0 0 15px rgba(79, 70, 229, 0)' },
                },
                'gradient-move': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'scan-line': {
                    '0%': { top: '-10%' },
                    '100%': { top: '110%' },
                },
                'pulse-soft': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
                    '50%': { transform: 'scale(2.5)', opacity: '0' },
                }
            },
            animation: {
                'pulse-yellow': 'pulse-yellow 2s infinite',
                'pulse-active': 'pulse-active 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'gradient-move': 'gradient-move 3s ease infinite',
                'scan-line': 'scan-line 3s linear infinite',
                'pulse-soft': 'pulse-soft 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            },
        },
    },
    plugins: [],
}
