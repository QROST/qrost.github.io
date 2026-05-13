/**
 * Phase 4 renderer — turns assets/data/{wfoe,domestic}-steps.json into the
 * step-card DOM that index.html previously hard-coded.
 *
 * Why this exists: index.html had ~700 lines of repeating step-card markup
 * (20 WFOE + 10 domestic). Editing copy meant scrolling past hundreds of
 * structural divs. The card template is now in ONE place (this file) and
 * the content is in ONE place (the JSON files).
 *
 * Non-breaking contract — the rendered DOM is byte-equivalent (after
 * normalisation) to the previous inline markup. Specifically:
 *   - Every WFOE step has data-i18n="sXX.title", data-i18n="sXX.detail"
 *     (when a detail block exists) and data-wfoe-money="sXX" — the same
 *     hooks i18n-china-business.js and china-business.js already rely on.
 *   - Every domestic step has data-i18n="dXX.title", data-i18n="dXX.detail"
 *     and either data-domestic-fee="dXX" (filled by refreshDomesticFees)
 *     or data-i18n="dXX.money" (translated like any other i18n string).
 *   - Summary toggles carry data-i18n="common.sr.toggle" for the sr-only
 *     label, identical to before.
 *
 * Load order: this script is included BEFORE i18n-china-business.js and
 * china-business.js so that, by the time those scripts run their
 * DOMContentLoaded handlers, the mount points may already be populated.
 * Because the data lives in separate JSON files fetched asynchronously,
 * the population can still complete after DOMContentLoaded. To cover both
 * orderings we dispatch `china-biz-steps-rendered` on completion;
 * china-business.js listens for it and re-runs the money-cell + i18n
 * passes for the freshly-inserted nodes.
 *
 * If fetch fails (file://, offline, etc.), the page still works: tabs,
 * dashboard, FX, language toggle continue. Only the step bodies are
 * missing — and we surface a one-line inline notice in their place so the
 * absence isn't silent.
 */
(function () {
    'use strict';

    const DISCLOSURE_SVG = '<svg class="wfoe-disclosure-icon h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';

    function summaryHtml() {
        return ''
            + '<summary class="cursor-pointer flex items-center gap-1.5 mt-1 w-fit text-emerald-700 hover:text-emerald-600 select-none">'
            + '<span class="sr-only" data-i18n="common.sr.toggle">Show or hide additional detail for this step</span>'
            + DISCLOSURE_SVG
            + '</summary>';
    }

    function detailBlockHtml(step) {
        if (!step.detail) return '';
        const key = step.id + '.detail';
        let body = '';
        if (step.detail.kind === 'list') {
            const items = step.detail.items_html.map(function (h) { return '<li>' + h + '</li>'; }).join('');
            body = '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3" data-i18n="' + key + '">' + items + '</ul>';
        } else if (step.detail.kind === 'paragraph') {
            body = '<p class="text-sm text-slate-600 mt-3" data-i18n="' + key + '">' + step.detail.html + '</p>';
        }
        return '<details class="wfoe-details mt-2">' + summaryHtml() + body + '</details>';
    }

    function wfoeCardHtml(step) {
        return ''
            + '<div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[3.25rem_minmax(0,1fr)_minmax(260px,400px)]">'
            + '<div class="bg-emerald-600 text-white flex items-center justify-center py-3 lg:py-0 lg:min-h-[72px] text-lg font-bold tabular-nums">' + step.num + '</div>'
            + '<div class="p-4 lg:p-5 border-t lg:border-t-0 lg:border-r border-slate-100">'
            + '<p class="text-sm font-semibold text-slate-900 leading-snug" data-i18n="' + step.id + '.title">' + step.title_html + '</p>'
            + detailBlockHtml(step)
            + '</div>'
            + '<div class="p-4 lg:p-5 bg-emerald-50/90 border-t lg:border-t-0 lg:border-l border-emerald-100">'
            + '<p class="text-sm text-slate-700 leading-relaxed" data-wfoe-money="' + step.money_key + '"></p>'
            + '</div>'
            + '</div>';
    }

    function domesticMoneyHtml(step) {
        if (!step.money) {
            return '<p class="text-sm text-slate-700 leading-relaxed"></p>';
        }
        if (step.money.kind === 'data-domestic-fee') {
            return '<p class="text-sm text-slate-700 leading-relaxed domestic-fee" data-domestic-fee="' + step.money.key + '"></p>';
        }
        // i18n money: original markup uses the i18n key directly on the <p>
        return '<p class="text-sm text-slate-700 leading-relaxed" data-i18n="' + step.money.key + '">' + step.money.html + '</p>';
    }

    function domesticCardHtml(step) {
        return ''
            + '<div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[3.25rem_minmax(0,1fr)_minmax(260px,400px)]">'
            + '<div class="bg-emerald-600 text-white flex items-center justify-center py-3 lg:py-0 lg:min-h-[72px] text-lg font-bold tabular-nums">' + step.num + '</div>'
            + '<div class="p-4 lg:p-5 border-t lg:border-t-0 lg:border-r border-slate-100">'
            + '<p class="text-sm font-semibold text-slate-900 leading-snug" data-i18n="' + step.id + '.title">' + step.title_html + '</p>'
            + detailBlockHtml(step)
            + '</div>'
            + '<div class="p-4 lg:p-5 bg-emerald-50/90 border-t lg:border-t-0 lg:border-l border-emerald-100">'
            + domesticMoneyHtml(step)
            + '</div>'
            + '</div>';
    }

    function renderInto(mountId, html) {
        const mount = document.getElementById(mountId);
        if (mount) mount.innerHTML = html;
    }

    function renderFailureNotice(mountId, label) {
        const mount = document.getElementById(mountId);
        if (!mount) return;
        mount.innerHTML = '<div class="rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">'
            + 'Unable to load ' + label + ' (data file missing). Refresh to retry; the dashboard below still works.'
            + '</div>';
    }

    function dispatchDone() {
        window.dispatchEvent(new CustomEvent('china-biz-steps-rendered'));
        // If i18n is already initialised, re-apply so the freshly inserted
        // nodes pick up the current language and their EN content is cached
        // for future toggles.
        if (window.ChinaBizI18n && typeof window.ChinaBizI18n.setLang === 'function') {
            window.ChinaBizI18n.setLang(window.ChinaBizI18n.getLang());
        }
    }

    function loadAndRender() {
        // assets/data/ is relative to index.html
        const wfoePromise = fetch('assets/data/wfoe-steps.json')
            .then(function (r) { if (!r.ok) throw new Error('wfoe-steps ' + r.status); return r.json(); })
            .then(function (steps) {
                const html = steps.map(wfoeCardHtml).join('');
                renderInto('wfoe-steps-mount', html);
            })
            .catch(function (e) {
                console.warn('[steps-render] WFOE load failed:', e);
                renderFailureNotice('wfoe-steps-mount', 'WFOE setup steps');
            });

        const domesticPromise = fetch('assets/data/domestic-steps.json')
            .then(function (r) { if (!r.ok) throw new Error('domestic-steps ' + r.status); return r.json(); })
            .then(function (steps) {
                const html = steps.map(domesticCardHtml).join('');
                renderInto('domestic-steps-mount', html);
            })
            .catch(function (e) {
                console.warn('[steps-render] domestic load failed:', e);
                renderFailureNotice('domestic-steps-mount', 'domestic LLC steps');
            });

        Promise.all([wfoePromise, domesticPromise]).then(dispatchDone);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAndRender);
    } else {
        loadAndRender();
    }
})();
