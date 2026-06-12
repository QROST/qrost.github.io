/**
 * Phase 4 renderer — turns assets/data/{wfoe,domestic}-steps.json into the
 * step-card DOM that index.html previously hard-coded.
 *
 * Layout (2026-06): horizontal flow rail + compact row list — same i18n/money
 * hooks as before; less vertical scroll on desktop and mobile.
 */
(function () {
    'use strict';

    function summaryHtml() {
        return ''
            + '<summary class="step-flow-more">'
            + '<span class="sr-only" data-i18n="common.sr.toggle">Show or hide additional detail for this step</span>'
            + '<span class="step-flow-more-label" data-i18n="common.sr.more">More</span>'
            + '</summary>';
    }

    function detailBlockHtml(step) {
        if (!step.detail) return '';
        const key = step.id + '.detail';
        let body = '';
        if (step.detail.kind === 'list') {
            const items = step.detail.items_html.map(function (h) { return '<li>' + h + '</li>'; }).join('');
            body = '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1 mt-2" data-i18n="' + key + '">' + items + '</ul>';
        } else if (step.detail.kind === 'paragraph') {
            body = '<p class="text-sm text-slate-600 mt-2" data-i18n="' + key + '">' + step.detail.html + '</p>';
        }
        return '<details class="wfoe-details">' + summaryHtml() + body + '</details>';
    }

    function flowRailHtml(steps, idPrefix) {
        const parts = [];
        steps.forEach(function (step, i) {
            if (i > 0) {
                parts.push('<span class="step-flow-connector" aria-hidden="true"></span>');
            }
            parts.push(
                '<button type="button" class="step-flow-node" data-step-jump="' + idPrefix + step.id + '"'
                + ' aria-label="Step ' + step.num + '">'
                + step.num
                + '</button>'
            );
        });
        return '<nav class="step-flow-rail" aria-label="Setup steps overview">' + parts.join('') + '</nav>';
    }

    function flowHeaderHtml() {
        return ''
            + '<div class="step-flow-header" aria-hidden="true">'
            + '<span>#</span>'
            + '<span data-i18n="process.col_step">Step</span>'
            + '<span data-i18n="process.col_cost">Est. cost</span>'
            + '</div>';
    }

    function wfoeRowHtml(step, idPrefix) {
        const rowId = idPrefix + step.id;
        return ''
            + '<li id="' + rowId + '" class="step-flow-row" data-step-row="' + step.id + '">'
            + '<div class="step-flow-row-inner">'
            + '<div class="step-flow-num" aria-hidden="true">' + step.num + '</div>'
            + '<div class="step-flow-body">'
            + '<p class="step-flow-title" data-i18n="' + step.id + '.title">' + step.title_html + '</p>'
            + detailBlockHtml(step)
            + '</div>'
            + '<div class="step-flow-money">'
            + '<p class="step-flow-money-text" data-wfoe-money="' + step.money_key + '"></p>'
            + '</div>'
            + '</div>'
            + '</li>';
    }

    function domesticMoneyHtml(step) {
        if (!step.money) {
            return '<p class="step-flow-money-text"></p>';
        }
        if (step.money.kind === 'data-domestic-fee') {
            return '<p class="step-flow-money-text domestic-fee" data-domestic-fee="' + step.money.key + '"></p>';
        }
        return '<p class="step-flow-money-text" data-i18n="' + step.money.key + '">' + step.money.html + '</p>';
    }

    function domesticRowHtml(step, idPrefix) {
        const rowId = idPrefix + step.id;
        return ''
            + '<li id="' + rowId + '" class="step-flow-row" data-step-row="' + step.id + '">'
            + '<div class="step-flow-row-inner">'
            + '<div class="step-flow-num" aria-hidden="true">' + step.num + '</div>'
            + '<div class="step-flow-body">'
            + '<p class="step-flow-title" data-i18n="' + step.id + '.title">' + step.title_html + '</p>'
            + detailBlockHtml(step)
            + '</div>'
            + '<div class="step-flow-money">'
            + domesticMoneyHtml(step)
            + '</div>'
            + '</div>'
            + '</li>';
    }

    function buildStepFlow(steps, rowRenderer, idPrefix) {
        const list = '<ol class="step-flow-list">' + steps.map(function (s) {
            return rowRenderer(s, idPrefix);
        }).join('') + '</ol>';
        return ''
            + '<div class="step-flow-layout" data-step-flow>'
            + flowRailHtml(steps, idPrefix)
            + flowHeaderHtml()
            + list
            + '</div>';
    }

    function renderInto(mountId, html) {
        const mount = document.getElementById(mountId);
        if (!mount) return;
        mount.innerHTML = html;
        mount.removeAttribute('aria-busy');
        const layout = mount.querySelector('[data-step-flow]');
        if (layout) wireStepFlow(layout, mountId);
    }

    function wireStepFlow(layout, mountId) {
        const prefix = mountId === 'wfoe-steps-mount' ? 'wfoe-' : 'domestic-';
        const rail = layout.querySelector('.step-flow-rail');
        const nodes = rail ? rail.querySelectorAll('.step-flow-node') : [];
        const rows = layout.querySelectorAll('.step-flow-row');

        nodes.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const targetId = btn.getAttribute('data-step-jump');
                const row = document.getElementById(targetId);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    row.classList.add('step-flow-row--flash');
                    window.setTimeout(function () {
                        row.classList.remove('step-flow-row--flash');
                    }, 1200);
                }
            });
        });

        if (!('IntersectionObserver' in window) || !rows.length) return;

        const rowByStepId = {};
        rows.forEach(function (row) {
            rowByStepId[row.getAttribute('data-step-row')] = row;
        });

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                const stepId = entry.target.getAttribute('data-step-row');
                nodes.forEach(function (n) {
                    const jump = n.getAttribute('data-step-jump');
                    n.classList.toggle('is-active', jump === prefix + stepId);
                });
            });
        }, { root: null, rootMargin: '-35% 0px -45% 0px', threshold: 0 });

        rows.forEach(function (row) { observer.observe(row); });

        if (nodes[0]) nodes[0].classList.add('is-active');
    }

    function renderFailureNotice(mountId, label) {
        const mount = document.getElementById(mountId);
        if (!mount) return;
        mount.removeAttribute('aria-busy');
        mount.innerHTML = '<div class="rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">'
            + 'Unable to load ' + label + ' (data file missing). Refresh to retry; the dashboard below still works.'
            + '</div>';
    }

    function dispatchDone() {
        window.dispatchEvent(new CustomEvent('china-biz-steps-rendered'));
        if (window.ChinaBizI18n && typeof window.ChinaBizI18n.setLang === 'function') {
            window.ChinaBizI18n.setLang(window.ChinaBizI18n.getLang());
        }
    }

    function loadAndRender() {
        const wfoePromise = fetch('assets/data/wfoe-steps.json')
            .then(function (r) { if (!r.ok) throw new Error('wfoe-steps ' + r.status); return r.json(); })
            .then(function (steps) {
                renderInto('wfoe-steps-mount', buildStepFlow(steps, wfoeRowHtml, 'wfoe-'));
            })
            .catch(function (e) {
                console.warn('[steps-render] WFOE load failed:', e);
                renderFailureNotice('wfoe-steps-mount', 'WFOE setup steps');
            });

        const domesticPromise = fetch('assets/data/domestic-steps.json')
            .then(function (r) { if (!r.ok) throw new Error('domestic-steps ' + r.status); return r.json(); })
            .then(function (steps) {
                renderInto('domestic-steps-mount', buildStepFlow(steps, domesticRowHtml, 'domestic-'));
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
