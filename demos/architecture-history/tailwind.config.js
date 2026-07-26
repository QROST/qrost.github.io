/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './assets/js/*.js',
  ],
  safelist: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Songti SC"', 'Georgia', 'serif'],
        mono: ['"SFMono-Regular"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
