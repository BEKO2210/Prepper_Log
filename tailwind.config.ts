import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f0eb',
          100: '#c0d9cc',
          200: '#96c0aa',
          300: '#6ca688',
          400: '#4d936f',
          500: '#2e8056',
          600: '#27744c',
          700: '#1e6540',
          800: '#1a3a2a',
          900: '#0f1f17',
        },
        olive: {
          100: '#e8e4d0',
          200: '#d1c9a1',
          300: '#baad72',
          400: '#a89a52',
          500: '#8b7d3c',
          600: '#6e6330',
          700: '#524a24',
        },
        khaki: {
          100: '#f0ead6',
          200: '#e0d5ad',
          300: '#d1bf84',
          400: '#c1aa5b',
          500: '#b29a3e',
        },
        danger: '#DC2626',
        warning: '#D97706',
        success: '#16A34A',
        info: '#2563EB',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
