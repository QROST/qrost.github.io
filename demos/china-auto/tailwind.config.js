/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './assets/js/*.js'],
  theme: { extend: { fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] } } },
  plugins: [],
};
