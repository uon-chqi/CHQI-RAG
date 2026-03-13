/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf4',
          100: '#c5cee3',
          200: '#9fafd0',
          300: '#7990bd',
          400: '#5c79af',
          500: '#3f62a1',
          600: '#375899',
          700: '#2d4c8f',
          800: '#244085',
          900: '#0A1B3A',
          950: '#060f20',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
