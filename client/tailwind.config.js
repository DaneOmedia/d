/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d4fc',
          300: '#a5b4fb',
          400: '#818cf8',
          500: '#6366f1',
          600: '#1e3a8a',
          700: '#1e3070',
          800: '#1a2850',
          900: '#0f172a',
          950: '#09112b',
        },
      },
    },
  },
  plugins: [],
};
