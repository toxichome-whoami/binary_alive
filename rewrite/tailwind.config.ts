import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          muted: 'rgba(59, 130, 246, 0.15)',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#0f0f0f',
        },
        base: {
          DEFAULT: '#f8fafc',
          dark: '#000000',
        },
        elevated: {
          DEFAULT: '#f1f5f9',
          dark: '#161616',
        },
        border: {
          DEFAULT: '#e2e8f0',
          dark: '#222222',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
