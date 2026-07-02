/** @type {import('tailwindcss').Config} */
// Tailwind config for demos/wfoe-china only. Keeps the build scoped so adding
// other demos later does not blow up this CSS bundle.
//
// Content globs include the HTML, the JS files, and the step JSON data, because:
// - china-business.js adds classes (e.g. 'bg-white', 'shadow-sm', 'text-slate-800',
//   'hidden') via classList.add() / .toggle() — Tailwind's regex-based scanner
//   picks them up from string literals in those files.
// - steps-render.js injects utility classes (list-disc, pl-4, text-sm, rounded-md,
//   border-amber-200, bg-amber-50, sr-only, ...) when rendering step cards.
// - assets/data/*.json (wfoe-steps, domestic-steps, joint-venture-steps) carry
//   title_html/detail HTML strings with more utility classes (font-semibold,
//   text-emerald-600, underline, underline-offset-2). Scanning the JSON directly
//   keeps future edits to step data from silently dropping classes from the build.
module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './assets/js/china-business.js',
        './assets/js/i18n-china-business.js',
        './assets/js/steps-render.js',
        './assets/data/*.json',
    ],
    // Safelist — only used if a future runtime adds classes that never appear
    // anywhere in source. Empty for now; document any additions inline.
    safelist: [],
    theme: {
        extend: {},
    },
    plugins: [],
};
