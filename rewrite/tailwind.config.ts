import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#f6821f',
          hover: '#e0731a',
          muted: 'rgba(246, 130, 31, 0.15)',
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
          '"Inter Variable"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
