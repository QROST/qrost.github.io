/** @type {import('tailwindcss').Config} */
// Tailwind config for demos/wfoe-china only. Keeps the build scoped so adding
// other demos later does not blow up this CSS bundle.
//
// Content globs include both the HTML and the JS files, because china-business.js
// adds classes (e.g. 'bg-white', 'shadow-sm', 'text-slate-800', 'hidden') via
// classList.add() / .toggle() — Tailwind's regex-based scanner picks them up
// from string literals in those files.
module.exports = {
    content: [
        './index.html',
        './assets/js/china-business.js',
        './assets/js/i18n-china-business.js',
    ],
    // Safelist — only used if a future runtime adds classes that never appear
    // anywhere in source. Empty for now; document any additions inline.
    safelist: [],
    theme: {
        extend: {},
    },
    plugins: [],
};
