document.addEventListener('DOMContentLoaded', () => {

            function tr(key, en) {
                if (typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' && window.ChinaBizI18n.zh[key]) {
                    return window.ChinaBizI18n.zh[key];
                }
                return en;
            }

            // WFOE vs SAR Process Toggle Logic
            const steps = document.querySelectorAll('.step-item');
            const contents = document.querySelectorAll('.step-content');

            steps.forEach(step => {
                step.addEventListener('click', () => {
                    // Reset all tabs
                    steps.forEach(s => {
                        s.classList.remove('step-active');
                        s.style.borderBottomColor = 'transparent';
                        s.classList.remove('text-slate-800');
                        s.classList.add('text-slate-500');
                    });

                    // Hide all contents
                    contents.forEach(c => c.classList.add('hidden'));

                    // Activate clicked tab
                    step.classList.add('step-active');
                    step.classList.remove('text-slate-500');
                    step.classList.add('text-slate-800');
                    step.style.borderBottomColor = '#0f172a';

                    // Show target content
                    const targetId = step.getAttribute('data-target');
                    document.getElementById(targetId).classList.remove('hidden');
                });
            });

            /* Data setup: all mainland / dashboard economics are modeled in RMB first. USD = RMB ÷ USD/CNY (live API when
               available, else FALLBACK_USD_CNY). WFOE + domestic process “money” columns: RMB bands are fixed anchors;
               overseas-only costs (notary, wire) use planning RMB equivalents; USD shown as derived. */
            const FALLBACK_USD_CNY = 7.2;
            let exchangeRate = FALLBACK_USD_CNY;
            let exchangeRateIsLive = false;
            let exchangeRateFetchSettled = false; // true after first fetch attempt resolves either way

            function effectiveExchangeRate() {
                return typeof exchangeRate === 'number' && exchangeRate > 0 && exchangeRate < 100
                    ? exchangeRate
                    : FALLBACK_USD_CNY;
            }

            function updateFxLabel() {
                const trigger = document.getElementById('fx-info-trigger');
                const tooltip = document.getElementById('fx-info-tooltip');
                const chip = document.getElementById('fx-status-chip');
                if (!trigger || !tooltip) return;

                const r = effectiveExchangeRate().toFixed(2);
                const mode = exchangeRateIsLive
                    ? tr('chart.fx_mode_live', 'live')
                    : tr('chart.fx_mode_fallback', '2024-avg fallback (7.2)');
                let line = tr('chart.fx_line', 'USD column uses 1 USD ≈ {rate} CNY ({mode}).');
                line = line.replace(/\{rate\}/g, r).replace(/\{mode\}/g, mode);

                let status;
                let statusClass;
                trigger.classList.remove('fx-live', 'fx-fallback', 'fx-pending');
                if (!exchangeRateFetchSettled) {
                    statusClass = 'fx-pending';
                    status = tr('chart.fx_status_pending', 'Checking FX…');
                } else if (exchangeRateIsLive) {
                    statusClass = 'fx-live';
                    status = tr('chart.fx_status_live', 'Live rate');
                } else {
                    statusClass = 'fx-fallback';
                    status = tr('chart.fx_status_fallback', 'Offline · fallback 7.2');
                }
                trigger.classList.add(statusClass);

                tooltip.replaceChildren();
                const lineEl = document.createElement('span');
                lineEl.className = 'fx-info-tooltip-line';
                lineEl.textContent = line;
                const statusEl = document.createElement('span');
                statusEl.className = 'fx-info-status ' + statusClass;
                statusEl.textContent = status;
                tooltip.appendChild(lineEl);
                tooltip.appendChild(statusEl);

                if (chip) {
                    chip.textContent = status;
                    chip.classList.remove('fx-live', 'fx-fallback', 'fx-pending');
                    chip.classList.add(statusClass);
                }

                trigger.setAttribute('title', line + ' ' + status);
                trigger.setAttribute('aria-label', tr('dash.fx_info_aria', 'Exchange rate details') + ': ' + status);
            }

            async function loadExchangeRate() {
                const tryFetch = async function (url, getCny) {
                    try {
                        const ctrl = new AbortController();
                        const tid = setTimeout(function () { ctrl.abort(); }, 8000);
                        const res = await fetch(url, { signal: ctrl.signal });
                        clearTimeout(tid);
                        if (!res.ok) return null;
                        const data = await res.json();
                        const v = getCny(data);
                        if (typeof v === 'number' && v >= 5 && v <= 12) return v;
                    } catch (e) { /* use fallback */ }
                    return null;
                };

                let v = await tryFetch('https://api.exchangerate.host/latest?base=USD&symbols=CNY', function (d) {
                    return d.rates && typeof d.rates.CNY === 'number' ? d.rates.CNY : null;
                });
                if (v == null) {
                    v = await tryFetch('https://open.er-api.com/v6/latest/USD', function (d) {
                        return d.rates && typeof d.rates.CNY === 'number' ? d.rates.CNY : null;
                    });
                }

                if (v != null) {
                    exchangeRate = v;
                    exchangeRateIsLive = true;
                } else {
                    exchangeRate = FALLBACK_USD_CNY;
                    exchangeRateIsLive = false;
                }
                exchangeRateFetchSettled = true;
                updateFxLabel();
                updateVisuals();
            }

            /* Per city: officeRentAnnualRMB (10 m² × avg office RMB/m²/mo × 12), utilitiesAnnualRMB (power + heat/cool + cleaning alloc.).
               Global: OVERHEAD_HARDWARE_ANNUAL_RMB, OVERHEAD_SOFTWARE_ANNUAL_RMB (AEC Collection + Rhino modeled seat-year). */
            const OVERHEAD_HARDWARE_ANNUAL_RMB = 13800;
            const OVERHEAD_SOFTWARE_ANNUAL_RMB = 29000;

            /* SAR employer statutory (planning RMB equivalents; not live FX). */
            const HK_MPF_RATE = 0.05;
            const HK_MPF_CAP_MONTHLY_HKD = 1500;
            const HKD_TO_RMB = 0.93;
            const MO_FSS_EMPLOYER_MONTHLY_MOP = 60;
            const MOP_TO_RMB = 0.89;

            /* Salaries: AEC CAD/BIM junior vs senior modeler, annual base (12x monthly bands from Liepin, 51job, i人事, city HR releases, 2024-2025).
               Rent: officeRentAnnualRMB = 10 m2 x Grade A/B effective RMB/m2/mo x 12 (CIH, JLL, Savills, Knight Frank, Colliers, DTZ, local gov - mostly Q3-Q4 2024).
               Utilities: allocated HVAC, power, cleaning (higher north/heating; coastal humidity/summer). */
            const cityData = {
                beijing: { name: "Beijing", nameZh: "北京", type: "mainland", juniorAnnual: 118000, seniorAnnual: 270000, contribPct: 0.33, officeRentAnnualRMB: 30240, utilitiesAnnualRMB: 8300 },
                shanghai: { name: "Shanghai", nameZh: "上海", type: "mainland", juniorAnnual: 118000, seniorAnnual: 258000, contribPct: 0.33, officeRentAnnualRMB: 24000, utilitiesAnnualRMB: 7600 },
                shenzhen: { name: "Shenzhen", nameZh: "深圳", type: "mainland", juniorAnnual: 112000, seniorAnnual: 252000, contribPct: 0.35, officeRentAnnualRMB: 19560, utilitiesAnnualRMB: 6900 },
                guangzhou: { name: "Guangzhou", nameZh: "广州", type: "mainland", juniorAnnual: 102000, seniorAnnual: 234000, contribPct: 0.35, officeRentAnnualRMB: 15540, utilitiesAnnualRMB: 7100 },
                hangzhou: { name: "Hangzhou", nameZh: "杭州", type: "mainland", juniorAnnual: 108000, seniorAnnual: 246000, contribPct: 0.36, officeRentAnnualRMB: 13800, utilitiesAnnualRMB: 7300 },
                nanjing: { name: "Nanjing", nameZh: "南京", type: "mainland", juniorAnnual: 100000, seniorAnnual: 220000, contribPct: 0.38, officeRentAnnualRMB: 11880, utilitiesAnnualRMB: 7700 },
                tianjin: { name: "Tianjin", nameZh: "天津", type: "mainland", juniorAnnual: 88000, seniorAnnual: 198000, contribPct: 0.40, officeRentAnnualRMB: 12120, utilitiesAnnualRMB: 8100 },
                wuhan: { name: "Wuhan", nameZh: "武汉", type: "mainland", juniorAnnual: 88000, seniorAnnual: 190000, contribPct: 0.38, officeRentAnnualRMB: 9480, utilitiesAnnualRMB: 7300 },
                chengdu: { name: "Chengdu", nameZh: "成都", type: "mainland", juniorAnnual: 82000, seniorAnnual: 178000, contribPct: 0.36, officeRentAnnualRMB: 11520, utilitiesAnnualRMB: 6900 },
                zhuhai: { name: "Zhuhai", nameZh: "珠海", type: "mainland", juniorAnnual: 82000, seniorAnnual: 176000, contribPct: 0.35, officeRentAnnualRMB: 4680, utilitiesAnnualRMB: 6600 },
                xian: { name: "Xi'an", nameZh: "西安", type: "mainland", juniorAnnual: 76000, seniorAnnual: 166000, contribPct: 0.36, officeRentAnnualRMB: 8400, utilitiesAnnualRMB: 7600 },
                hefei: { name: "Hefei", nameZh: "合肥", type: "mainland", juniorAnnual: 70000, seniorAnnual: 154000, contribPct: 0.35, officeRentAnnualRMB: 5760, utilitiesAnnualRMB: 6800 },
                harbin: { name: "Harbin", nameZh: "哈尔滨", type: "mainland", juniorAnnual: 58000, seniorAnnual: 128000, contribPct: 0.35, officeRentAnnualRMB: 8160, utilitiesAnnualRMB: 9000 },
                haikou: { name: "Haikou", nameZh: "海口", type: "mainland", juniorAnnual: 82000, seniorAnnual: 182000, contribPct: 0.35, officeRentAnnualRMB: 6600, utilitiesAnnualRMB: 6300 },
                sanya: { name: "Sanya", nameZh: "三亚", type: "mainland", juniorAnnual: 86000, seniorAnnual: 194000, contribPct: 0.35, officeRentAnnualRMB: 9600, utilitiesAnnualRMB: 6500 },
                hongkong: { name: "Hong Kong", nameZh: "香港", type: "sar", juniorAnnual: 216000, seniorAnnual: 432000, contribPct: 0.05, officeRentAnnualRMB: 156000, utilitiesAnnualRMB: 9200 },
                macau: { name: "Macau", nameZh: "澳门", type: "sar", juniorAnnual: 180000, seniorAnnual: 360000, contribPct: 0.004, officeRentAnnualRMB: 102000, utilitiesAnnualRMB: 7600 },
                suzhou: { name: "Suzhou", nameZh: "苏州", type: "mainland", juniorAnnual: 102000, seniorAnnual: 228000, contribPct: 0.38, officeRentAnnualRMB: 8640, utilitiesAnnualRMB: 7100 },
                changsha: { name: "Changsha", nameZh: "长沙", type: "mainland", juniorAnnual: 80000, seniorAnnual: 174000, contribPct: 0.36, officeRentAnnualRMB: 9420, utilitiesAnnualRMB: 7300 },
                chongqing: { name: "Chongqing", nameZh: "重庆", type: "mainland", juniorAnnual: 84000, seniorAnnual: 180000, contribPct: 0.36, officeRentAnnualRMB: 9000, utilitiesAnnualRMB: 7900 },
                kunming: { name: "Kunming", nameZh: "昆明", type: "mainland", juniorAnnual: 70000, seniorAnnual: 154000, contribPct: 0.35, officeRentAnnualRMB: 8580, utilitiesAnnualRMB: 6400 },
                qingdao: { name: "Qingdao", nameZh: "青岛", type: "mainland", juniorAnnual: 92000, seniorAnnual: 206000, contribPct: 0.38, officeRentAnnualRMB: 12720, utilitiesAnnualRMB: 7900 },
                zhengzhou: { name: "Zhengzhou", nameZh: "郑州", type: "mainland", juniorAnnual: 76000, seniorAnnual: 164000, contribPct: 0.35, officeRentAnnualRMB: 6480, utilitiesAnnualRMB: 6900 },
                dalian: { name: "Dalian", nameZh: "大连", type: "mainland", juniorAnnual: 80000, seniorAnnual: 176000, contribPct: 0.38, officeRentAnnualRMB: 8160, utilitiesAnnualRMB: 8900 },
                losangeles: { name: "Los Angeles", nameZh: "洛杉矶", type: "international", juniorAnnualUSD: 78000, seniorAnnualUSD: 110000, contribPct: 0.095, officeRentAnnualUSD: 5400, utilitiesAnnualUSD: 280 },
                sanfrancisco: { name: "San Francisco", nameZh: "旧金山", type: "international", juniorAnnualUSD: 80000, seniorAnnualUSD: 115000, contribPct: 0.095, officeRentAnnualUSD: 7800, utilitiesAnnualUSD: 350 },
                newyork: { name: "New York", nameZh: "纽约", type: "international", juniorAnnualUSD: 76000, seniorAnnualUSD: 110000, contribPct: 0.098, officeRentAnnualUSD: 9300, utilitiesAnnualUSD: 400 },
                london: { name: "London", nameZh: "伦敦", type: "international", juniorAnnualUSD: 50200, seniorAnnualUSD: 83800, contribPct: 0.157, officeRentAnnualUSD: 11887, utilitiesAnnualUSD: 572 },
                sydney: { name: "Sydney", nameZh: "悉尼", type: "international", juniorAnnualUSD: 46200, seniorAnnualUSD: 82500, contribPct: 0.12, officeRentAnnualUSD: 8712, utilitiesAnnualUSD: 1577 },
                melbourne: { name: "Melbourne", nameZh: "墨尔本", type: "international", juniorAnnualUSD: 44880, seniorAnnualUSD: 77880, contribPct: 0.12, officeRentAnnualUSD: 5128, utilitiesAnnualUSD: 1485 },
                abudhabi: { name: "Abu Dhabi", nameZh: "阿布扎比", type: "international", juniorAnnualUSD: 33000, seniorAnnualUSD: 115000, contribPct: 0.17, officeRentAnnualUSD: 8600, utilitiesAnnualUSD: 330 },
                tokyo: { name: "Tokyo", nameZh: "东京", type: "international", juniorAnnualUSD: 28000, seniorAnnualUSD: 48000, contribPct: 0.16, officeRentAnnualUSD: 9100, utilitiesAnnualUSD: 1200 },
                singapore: { name: "Singapore", nameZh: "新加坡", type: "international", juniorAnnualUSD: 33300, seniorAnnualUSD: 71040, contribPct: 0.17, officeRentAnnualUSD: 10859, utilitiesAnnualUSD: 2664 }
            };

            function cityDisplayName(key) {
                const c = cityData[key];
                if (!c) return '';
                if (typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' && c.nameZh) return c.nameZh;
                return c.name;
            }

            function isInternationalCity(cityKey) {
                const c = cityData[cityKey];
                return !!(c && c.type === 'international');
            }

            function usdToRMB(usdValue) {
                return Math.round(usdValue * effectiveExchangeRate());
            }

            function annualBaseRMB(c, role) {
                if (c.type === 'international') {
                    const usd = role === 'junior' ? c.juniorAnnualUSD : c.seniorAnnualUSD;
                    return usdToRMB(usd);
                }
                return role === 'junior' ? c.juniorAnnual : c.seniorAnnual;
            }

            function officeRentAnnualRMB(c) {
                if (c.type === 'international') return usdToRMB(c.officeRentAnnualUSD || 0);
                return c.officeRentAnnualRMB || 0;
            }

            function utilitiesAnnualRMB(c) {
                if (c.type === 'international') return usdToRMB(c.utilitiesAnnualUSD || 0);
                return c.utilitiesAnnualRMB || 0;
            }

            function overheadAnnualTotalRMB(c) {
                return officeRentAnnualRMB(c) + OVERHEAD_HARDWARE_ANNUAL_RMB + utilitiesAnnualRMB(c) + OVERHEAD_SOFTWARE_ANNUAL_RMB;
            }

            function overheadPartsForCity(cityKey) {
                const c = cityData[cityKey];
                return {
                    rent: officeRentAnnualRMB(c),
                    hardware: OVERHEAD_HARDWARE_ANNUAL_RMB,
                    utilities: utilitiesAnnualRMB(c),
                    software: OVERHEAD_SOFTWARE_ANNUAL_RMB
                };
            }

            function getDashboardCityKeys() {
                return Object.keys(cityData).filter(function (k) {
                    const t = cityData[k].type;
                    if (t === 'international') return state.showInternationalCities;
                    return t === 'mainland' || t === 'sar';
                });
            }

            function ensureValidCitySelection() {
                const keys = getDashboardCityKeys();
                if (keys.indexOf(state.city) === -1) {
                    state.city = 'shanghai';
                }
            }

            const state = {
                city: 'shanghai',
                role: 'junior',
                currency: 'usd',
                headcount: 1,
                includeOverhead: false,
                showInternationalCities: false
            };

            let barChart, doughnutChart;

            function syncCurrencyButtons() {
                const usd = document.getElementById('btn-usd');
                const rmb = document.getElementById('btn-rmb');
                if (!usd || !rmb) return;
                if (state.currency === 'usd') {
                    usd.classList.add('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    usd.classList.remove('text-slate-600');
                    rmb.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    rmb.classList.add('text-slate-600');
                } else {
                    rmb.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
                    rmb.classList.remove('text-slate-600');
                    usd.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    usd.classList.add('text-slate-600');
                }
            }

            function convert(rmbValue) {
                const scaledValue = rmbValue * state.headcount;
                return state.currency === 'usd' ? Math.round(scaledValue / effectiveExchangeRate()) : Math.round(scaledValue);
            }

            function getSymbol() {
                return state.currency === 'usd' ? '$' : '¥';
            }

            function employerContribAnnualRMB(cityKey, baseAnnual) {
                if (isInternationalCity(cityKey)) {
                    return baseAnnual * cityData[cityKey].contribPct;
                }
                if (cityKey === 'hongkong') {
                    const monthlyBaseRMB = baseAnnual / 12;
                    const monthlyHKD = monthlyBaseRMB / HKD_TO_RMB;
                    const relevantMonthlyHKD = Math.min(monthlyHKD, 30000);
                    const mpfMonthlyHKD = Math.min(relevantMonthlyHKD * HK_MPF_RATE, HK_MPF_CAP_MONTHLY_HKD);
                    return mpfMonthlyHKD * 12 * HKD_TO_RMB;
                }
                if (cityKey === 'macau') {
                    return MO_FSS_EMPLOYER_MONTHLY_MOP * 12 * MOP_TO_RMB;
                }
                return baseAnnual * cityData[cityKey].contribPct;
            }

            function effectiveContribPct(cityKey, baseAnnual) {
                if (!baseAnnual) return cityData[cityKey].contribPct;
                return employerContribAnnualRMB(cityKey, baseAnnual) / baseAnnual;
            }

            function getCostData(cityKey, role) {
                const c = cityData[cityKey];
                const base = annualBaseRMB(c, role);
                const contrib = employerContribAnnualRMB(cityKey, base);
                const overheadAnnual = overheadAnnualTotalRMB(c);
                const empTotalRMB = base + contrib;
                const overheadTotalRMB = state.includeOverhead ? overheadAnnual * state.headcount : 0;
                const totalRMB = empTotalRMB + overheadTotalRMB;
                return {
                    baseRMB: base,
                    contribRMB: contrib,
                    overheadAnnualRMB: overheadAnnual,
                    totalRMB,
                    base: convert(base),
                    contrib: convert(contrib),
                    overhead: state.includeOverhead ? convert(overheadAnnual) : 0,
                    total: convert(base) + convert(contrib) + (state.includeOverhead ? convert(overheadAnnual) : 0)
                };
            }

            function initCharts() {
                Chart.defaults.font.family = "'Inter', sans-serif";
                Chart.defaults.color = '#475569';

                // Initialize Horizontal Bar Chart
                const ctxBar = document.getElementById('barChartAllCities').getContext('2d');
                barChart = new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [
                            { label: 'Annual Base Salary', data: [], backgroundColor: [], borderRadius: 0 },
                            { label: 'Employer Contributions', data: [], backgroundColor: [], borderRadius: 0 },
                            { label: 'Overhead (modeled)', data: [], backgroundColor: [], borderRadius: { topRight: 4, bottomRight: 4 } }
                        ]
                    },
                    options: {
                        indexAxis: 'y', // Horizontal bars for many cities (24 mainland + SAR)
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (e, elements) => {
                            if (elements && elements.length > 0) {
                                // Get the index of the clicked bar
                                const dataIndex = elements[0].index;
                                // Find the corresponding city name from the chart labels
                                const sortedKeys = getDashboardCityKeys().slice().sort((a, b) => {
                                    return getCostData(b, state.role).totalRMB - getCostData(a, state.role).totalRMB;
                                });
                                const cityKey = sortedKeys[dataIndex];

                                // Update state and visuals if it's a new city
                                if (cityKey && state.city !== cityKey) {
                                    state.city = cityKey;
                                    updateVisuals();
                                }
                            }
                        },
                        onHover: (event, chartElement) => {
                            // Turn cursor to pointer when hovering over bars to indicate clickability
                            event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    filter: function (legendItem) {
                                        if (legendItem.datasetIndex === 2 && !state.includeOverhead) return false;
                                        return true;
                                    }
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: function (context) {
                                        if (context.datasetIndex === 2 && !state.includeOverhead) return null;
                                        return context.dataset.label + ': ' + getSymbol() + context.parsed.x.toLocaleString();
                                    },
                                    footer: function (tooltipItems) {
                                        let total = 0;
                                        tooltipItems.forEach(function (tooltipItem) {
                                            if (tooltipItem.datasetIndex === 2 && !state.includeOverhead) return;
                                            total += tooltipItem.parsed.x;
                                        });
                                        return '\n' + tr('chart.tooltip_total', 'Total Annual: ') + getSymbol() + total.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                beginAtZero: true,
                                ticks: { callback: function (v) { return getSymbol() + v.toLocaleString(); } }
                            },
                            y: {
                                stacked: true,
                                ticks: { autoSkip: false, font: { size: 11 } }
                            }
                        }
                    }
                });

                // Initialize Doughnut Chart
                const ctxDoughnut = document.getElementById('doughnutCityDetail').getContext('2d');
                doughnutChart = new Chart(ctxDoughnut, {
                    type: 'doughnut',
                    data: {
                        labels: [], // Will be populated dynamically by updateVisuals
                        datasets: [{
                            data: [],
                            backgroundColor: [],
                            borderWidth: 1,
                            borderColor: '#ffffff',
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        return ' ' + context.label + ': ' + getSymbol() + context.parsed.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });

                updateVisuals();
            }

            function updateVisuals() {
                const methodEl = document.getElementById('overhead-method');
                if (methodEl) methodEl.classList.toggle('hidden', !state.includeOverhead);

                const macroLabel = document.getElementById('macro-cost-label');
                if (macroLabel) {
                    macroLabel.textContent = state.includeOverhead
                        ? tr('dash.macro.cost_oh', 'Total Annual Cost (Base + Contributions + modeled overhead)')
                        : tr('dash.macro.cost_base', 'Total Annual Cost (Base + Contributions)');
                }

                // Update Master Bar Chart
                const labels = [];
                const baseData = [];
                const contribData = [];
                const overheadData = [];
                const baseColors = [];
                const contribColors = [];
                const overheadColors = [];

                const chartHost = document.querySelector('.chart-container-tall');
                if (chartHost) {
                    const barCount = getDashboardCityKeys().length;
                    chartHost.style.height = Math.max(720, barCount * 32) + 'px';
                }

                // Sort dashboard cities by total cost descending
                const sortedCityKeys = getDashboardCityKeys().slice().sort((a, b) => {
                    return getCostData(b, state.role).totalRMB - getCostData(a, state.role).totalRMB;
                });

                sortedCityKeys.forEach(key => {
                    labels.push(cityDisplayName(key));
                    const cost = getCostData(key, state.role);
                    baseData.push(cost.base);
                    contribData.push(cost.contrib);
                    overheadData.push(state.includeOverhead ? cost.overhead : 0);

                    // Highlight selected city with solid colors, fade out the others
                    if (key === state.city) {
                        baseColors.push('#334155');
                        contribColors.push('#10b981');
                        overheadColors.push('#4f46e5');
                    } else {
                        baseColors.push('#94a3b8');
                        contribColors.push('#6ee7b7');
                        overheadColors.push('#a5b4fc');
                    }
                });

                barChart.data.labels = labels;
                barChart.data.datasets[0].data = baseData;
                barChart.data.datasets[0].backgroundColor = baseColors;
                barChart.data.datasets[1].data = contribData;
                barChart.data.datasets[1].backgroundColor = contribColors;
                barChart.data.datasets[2].data = overheadData;
                barChart.data.datasets[2].backgroundColor = overheadColors;
                barChart.data.datasets[0].label = tr('chart.base', 'Annual Base Salary');
                barChart.data.datasets[1].label = tr('chart.contrib', 'Employer Contributions');
                barChart.data.datasets[2].label = tr('chart.overhead', 'Overhead (modeled)');
                if (barChart.options.plugins.legend.labels) {
                    barChart.options.plugins.legend.labels.filter = function (legendItem) {
                        if (legendItem.datasetIndex === 2 && !state.includeOverhead) return false;
                        return true;
                    };
                }
                barChart.update();

                // Update Doughnut Chart Detail (5 Insurances & 1 Fund Breakdown)
                const selectedCityObj = cityData[state.city];
                const selectedCost = getCostData(state.city, state.role);

                let donutLabels = [];
                let donutData = [];
                let donutColors = [];

                if (selectedCityObj.type === 'mainland') {
                    const pPct = 0.16;
                    const mPct = 0.09;
                    const uPct = 0.005;
                    const iPct = 0.005;
                    const hPct = selectedCityObj.contribPct - (pPct + mPct + uPct + iPct);

                    donutLabels = [
                        tr('donut.base', 'Annual Base Salary'),
                        tr('donut.pension', '1. Pension (16%)'),
                        tr('donut.medical', '2. Medical (9%)'),
                        tr('donut.unemp', '3. Unemployment (0.5%)'),
                        tr('donut.injury', '4. Work Injury (0.5%)'),
                        tr('donut.housing', '5. Housing Fund ({pct}%)').replace(/\{pct\}/g, (hPct * 100).toFixed(1))
                    ];

                    donutData = [
                        selectedCost.base,
                        convert(selectedCost.baseRMB * pPct),
                        convert(selectedCost.baseRMB * mPct),
                        convert(selectedCost.baseRMB * uPct),
                        convert(selectedCost.baseRMB * iPct),
                        convert(selectedCost.baseRMB * hPct)
                    ];

                    donutColors = ['#0f172a', '#047857', '#065f46', '#059669', '#10b981', '#34d399'];

                    if (state.includeOverhead) {
                        const p = overheadPartsForCity(state.city);
                        donutLabels.push(
                            tr('donut.rent', 'Office rent (allocated)'),
                            tr('donut.hardware', 'Hardware & furniture (workstation, desk, chair)'),
                            tr('donut.utilities', 'Utilities, cleaning & climate (allocated)'),
                            tr('donut.software', 'Software (AEC Collection + Rhino, modeled seat-year)')
                        );
                        donutData.push(
                            convert(p.rent),
                            convert(p.hardware),
                            convert(p.utilities),
                            convert(p.software)
                        );
                        donutColors.push('#6366f1', '#64748b', '#d97706', '#0284c7');
                    }

                } else if (state.city === 'hongkong') {
                    donutLabels = [tr('donut.base', 'Annual Base Salary'), tr('donut.mpf', 'MPF (Mandatory Retirement)')];
                    donutData = [selectedCost.base, selectedCost.contrib];
                    donutColors = ['#0f172a', '#f59e0b'];
                    if (state.includeOverhead) {
                        const p = overheadPartsForCity(state.city);
                        donutLabels.push(
                            tr('donut.rent', 'Office rent (allocated)'),
                            tr('donut.hardware', 'Hardware & furniture (workstation, desk, chair)'),
                            tr('donut.utilities', 'Utilities, cleaning & climate (allocated)'),
                            tr('donut.software', 'Software (AEC Collection + Rhino, modeled seat-year)')
                        );
                        donutData.push(
                            convert(p.rent),
                            convert(p.hardware),
                            convert(p.utilities),
                            convert(p.software)
                        );
                        donutColors.push('#6366f1', '#64748b', '#d97706', '#0284c7');
                    }
                } else if (state.city === 'macau') {
                    donutLabels = [tr('donut.base', 'Annual Base Salary'), tr('donut.fss', 'Social Security (FSS)')];
                    donutData = [selectedCost.base, selectedCost.contrib];
                    donutColors = ['#0f172a', '#f59e0b'];
                    if (state.includeOverhead) {
                        const p = overheadPartsForCity(state.city);
                        donutLabels.push(
                            tr('donut.rent', 'Office rent (allocated)'),
                            tr('donut.hardware', 'Hardware & furniture (workstation, desk, chair)'),
                            tr('donut.utilities', 'Utilities, cleaning & climate (allocated)'),
                            tr('donut.software', 'Software (AEC Collection + Rhino, modeled seat-year)')
                        );
                        donutData.push(
                            convert(p.rent),
                            convert(p.hardware),
                            convert(p.utilities),
                            convert(p.software)
                        );
                        donutColors.push('#6366f1', '#64748b', '#d97706', '#0284c7');
                    }
                } else if (selectedCityObj.type === 'international') {
                    donutLabels = [
                        tr('donut.base', 'Annual Base Salary'),
                        tr('donut.intl_contrib', 'Employer Statutory (modeled)')
                    ];
                    donutData = [selectedCost.base, selectedCost.contrib];
                    donutColors = ['#0f172a', '#f59e0b'];
                    if (state.includeOverhead) {
                        const p = overheadPartsForCity(state.city);
                        donutLabels.push(
                            tr('donut.rent', 'Office rent (allocated)'),
                            tr('donut.hardware', 'Hardware & furniture (workstation, desk, chair)'),
                            tr('donut.utilities', 'Utilities, cleaning & climate (allocated)'),
                            tr('donut.software', 'Software (AEC Collection + Rhino, modeled seat-year)')
                        );
                        donutData.push(
                            convert(p.rent),
                            convert(p.hardware),
                            convert(p.utilities),
                            convert(p.software)
                        );
                        donutColors.push('#6366f1', '#64748b', '#d97706', '#0284c7');
                    }
                }

                doughnutChart.data.labels = donutLabels;
                doughnutChart.data.datasets[0].data = donutData;
                doughnutChart.data.datasets[0].backgroundColor = donutColors;
                doughnutChart.update();

                // Populate the detailed itemized list below the pie chart
                let listHTML = '';
                let totalAnnualAmt = 0;

                for (let i = 0; i < donutLabels.length; i++) {
                    listHTML += `
                        <div class="flex justify-between items-center py-2 ${i !== donutLabels.length - 1 ? 'border-b border-slate-100' : ''}">
                            <div class="flex items-center gap-2">
                                <span class="w-3 h-3 rounded-full inline-block shadow-sm" style="background-color: ${donutColors[i]}"></span>
                                <span class="text-slate-700 text-xs">${donutLabels[i]}</span>
                            </div>
                            <span class="font-medium text-slate-900 text-xs">${getSymbol()}${donutData[i].toLocaleString()}</span>
                        </div>
                    `;
                    totalAnnualAmt += donutData[i];
                }

                // Add Total Row
                listHTML += `
                    <div class="flex justify-between items-center pt-3 mt-1 border-t-2 border-slate-200">
                        <span class="font-bold text-slate-800 text-sm">${tr('chart.total_annual_cost', 'Total Annual Cost')}</span>
                        <span class="font-bold text-emerald-600 text-sm">${getSymbol()}${totalAnnualAmt.toLocaleString()}</span>
                    </div>
                `;

                const microDetailList = document.getElementById('micro-detail-list');
                if (microDetailList) {
                    microDetailList.innerHTML = listHTML;
                }

                // Update Text Elements
                const macroTitleRole = document.getElementById('macro-title-role');
                if (macroTitleRole) {
                    macroTitleRole.textContent = state.role === 'junior' ? tr('role.junior_short', 'Junior CAD') : tr('role.senior_short', 'Senior Modeler');
                }
                document.getElementById('micro-title-city').textContent = cityDisplayName(state.city);
                // Keep the city-select dropdown's value in sync with state.city so
                // bar-chart clicks visibly drive the dropdown too. We don't rebuild
                // options here (the dropdown gets its options once on init and on
                // language change), only set value.
                const citySelectSync = document.getElementById('city-nav-select');
                if (citySelectSync && citySelectSync.value !== state.city) {
                    citySelectSync.value = state.city;
                }
                const selectedType = cityData[state.city].type;
                const pctEl = document.getElementById('micro-contrib-pct');
                const pctWrap = document.getElementById('micro-contrib-pct-wrap');
                const breakdownLbl = document.getElementById('micro-breakdown-label');
                if (state.includeOverhead) {
                    if (breakdownLbl) breakdownLbl.textContent = tr('dash.micro.sub1', 'Annual breakdown: employment + overhead (rent, kit, utilities, software)');
                    if (pctWrap) pctWrap.style.display = 'none';
                } else {
                    if (breakdownLbl) {
                        breakdownLbl.textContent = selectedType === 'international'
                            ? tr('dash.micro.intl_sub2', 'Annual Base vs. local employer statutory load')
                            : tr('dash.micro.sub2', 'Annual Base vs. Employer "5 Insurances & 1 Fund"');
                    }
                    if (pctWrap) pctWrap.style.display = 'inline';
                    if (pctEl) {
                        const baseRMB = annualBaseRMB(cityData[state.city], state.role);
                        pctEl.textContent = (effectiveContribPct(state.city, baseRMB) * 100).toFixed(0) + '%';
                    }
                }
                const hcDisplay = document.getElementById('hc-display');
                if (hcDisplay) {
                    hcDisplay.textContent = state.headcount;
                }

                // Handle SAR / international alerts
                const alertBox = document.getElementById('sar-alert');
                const intlAlertBox = document.getElementById('international-alert');
                const descText = document.getElementById('micro-desc-text');

                if (intlAlertBox) {
                    intlAlertBox.classList.toggle('hidden', selectedType !== 'international');
                }

                if (selectedType === 'sar') {
                    alertBox.classList.remove('hidden');
                    const baseRMB = annualBaseRMB(cityData[state.city], state.role);
                    const pct = (effectiveContribPct(state.city, baseRMB) * 100).toFixed(0);
                    let sarHtml = tr('desc.sar_strong', '<strong>SAR Framework:</strong> ') + tr('desc.sar_line', 'The ~{pct}% statutory contribution represents approximate employer payroll statutory (HK MPF capped at HKD 1,500/mo; Macau FSS MOP 60/mo employer) rather than mainland social insurance.').replace(/\{pct\}/g, pct);
                    if (state.includeOverhead) {
                        sarHtml += tr('desc.sar_oh_append', ' <strong>Overhead:</strong> SAR rent uses prime-office bands in RMB; hardware/software use the same global license model as mainland for comparison.');
                    }
                    descText.innerHTML = sarHtml;
                } else if (selectedType === 'international') {
                    alertBox.classList.add('hidden');
                    const baseRMB = annualBaseRMB(cityData[state.city], state.role);
                    const pct = (effectiveContribPct(state.city, baseRMB) * 100).toFixed(0);
                    let intlHtml = tr('desc.international', '<strong>International benchmark:</strong> Salaries and local occupancy are sourced in USD and converted to RMB/USD for comparison using the same USD/CNY rate as the chart. Employer statutory load (~{pct}%) is a planning percentage for payroll taxes, pension/CPF, superannuation, or visa-related employer costs—not mainland social insurance.').replace(/\{pct\}/g, pct);
                    if (state.includeOverhead) {
                        intlHtml += ' ' + tr('desc.international_oh', '<strong>Overhead:</strong> Local rent and utilities are USD-native; hardware and AEC software use the same global seat-year model as China cities for apples-to-apples comparison.');
                    }
                    descText.innerHTML = intlHtml;
                } else {
                    alertBox.classList.add('hidden');
                    let mainlandDesc = tr('desc.mainland', '<strong>Mainland Contributions:</strong> Employer statutory contributions include Pension, Medical (9% in this model—maternity often merged into medical in many cities), Unemployment, Work Injury, and Housing Fund. Rates fluctuate by municipality; donut slices are illustrative.');
                    if (state.includeOverhead) {
                        mainlandDesc += ' ' + tr('desc.mainland_oh', '<strong>Overhead:</strong> Rent, utilities, hardware amortization, and AEC software stack are modeled per employee-year (see methodology above).');
                    }
                    if (state.city === 'haikou' || state.city === 'sanya') {
                        mainlandDesc += ' ' + tr('desc.hainan_extra', '<strong>Hainan FTP:</strong> Qualifying companies may access a <strong>15% corporate income tax</strong> rate (encouraged industries; substantive operations). Eligible talent may benefit from the <strong>15% personal income tax</strong> cap on qualifying Hainan-sourced income. Island-wide import treatment and “second line” rules apply for goods moving to the mainland—verify with local counsel.');
                    }
                    descText.innerHTML = mainlandDesc;
                }

                refreshDomesticFees();
                refreshWfoeMoney();
                refreshJvMoney();
            }

            /** RMB-first fee bands; USD = RMB ÷ rate (EN only — ZH cost column is RMB-only). */
            function makeStepMoneyFormatters(lang, rate) {
                const dual = lang !== 'zh';
                const usd = function (n) { return Math.max(0, Math.round(n / rate)); };
                const fmtN = function (n) { return Number(n).toLocaleString(); };
                return {
                    z: function () {
                        return dual ? '<strong>¥0</strong> (≈ <strong>$0</strong>)' : '<strong>¥0</strong>';
                    },
                    pr: function (lo, hi) {
                        const rmb = '<strong>¥' + fmtN(lo) + '–¥' + fmtN(hi) + '</strong>';
                        return dual ? rmb + ' (≈ <strong>$' + usd(lo) + '–$' + usd(hi) + '</strong>)' : rmb;
                    },
                    prPlus: function (lo, hi) {
                        const rmb = '<strong>¥' + fmtN(lo) + '–¥' + fmtN(hi) + '+</strong>';
                        return dual ? rmb + ' (≈ <strong>$' + usd(lo) + '–$' + usd(hi) + '+</strong>)' : rmb;
                    },
                    pgt: function (lo) {
                        const rmb = '<strong>&gt;¥' + fmtN(lo) + '</strong>';
                        return dual ? rmb + ' (≈ <strong>&gt;$' + usd(lo) + '</strong>)' : rmb;
                    },
                    sb: function (n) {
                        if (n === 0) {
                            return dual ? '<strong>¥0</strong> (≈ <strong>$0</strong>)' : '<strong>¥0</strong>';
                        }
                        const rmb = '<strong>¥' + String(Math.round(n)) + '</strong>';
                        return dual ? rmb + ' (≈ <strong>$' + usd(n) + '</strong>)' : rmb;
                    },
                    sr: function (lo, hi, plus) {
                        const sfx = plus ? '+' : '';
                        const rmb = '<strong>¥' + lo + '–' + hi + sfx + '</strong>';
                        return dual ? rmb + ' (≈ <strong>$' + usd(lo) + '–$' + usd(hi) + sfx + '</strong>)' : rmb;
                    },
                    addrBand: function () {
                        if (!dual) return '<strong>¥0–2 万+</strong>';
                        return '<strong>¥0–20k+</strong> (≈ <strong>$0–$' + usd(20000) + '+</strong>)';
                    }
                };
            }

            function buildWfoeStepMoneyHtml(stepId, lang) {
                const r = effectiveExchangeRate();
                const f = makeStepMoneyFormatters(lang, r);
                const z = f.z;
                const pr = f.pr;
                const prPlus = f.prPlus;
                const pgt = f.pgt;
                const rateFmt = r.toFixed(2);
                let fxNote = tr('s05.fee_fx_note', 'RMB is the planning anchor; USD = RMB ÷ rate. Same as Financials: <strong>1 USD ≈ {rate} CNY</strong> (live when the feed loads, otherwise a 2024-avg fallback of 7.2).');
                fxNote = fxNote.replace(/\{rate\}/g, rateFmt);
                const foot = lang === 'zh' ? '' : '<span class="text-slate-500 text-xs block mt-1.5">' + fxNote + '</span>';

                if (lang === 'zh') {
                    switch (stepId) {
                        case 's01':
                            return '<strong>尚无 WFOE 账户。</strong><strong class="text-slate-800">预估：</strong>本步' + z() + '；名称预审通常含于第5步代理合同。';
                        case 's02':
                            return '<strong>尚无 WFOE 账户。</strong><strong class="text-slate-800">预估：</strong>' + z() + '；仅看房差旅等软成本。';
                        case 's03':
                            return '<strong>尚无 WFOE 账户。</strong><strong class="text-slate-800">预估：</strong>' + z() + '（房东提供权证）。';
                        case 's04':
                            return '<strong>个人 /</strong>境外母公司。<strong class="text-slate-800">现金预估：</strong>押金（常<strong>1–3 个月租金</strong>）+ 首期租金 + 杂费——一线城市小面积示意 ' + prPlus(30000, 250000) + '，因城市差异大。';
                        case 's05':
                            return '<strong>代理服务费</strong>（本地机构、人民币报价常见）：标准 WFOE 常 ' + pr(12000, 40000) + '（一线城市常更高）；仅递交常 ' + pr(5000, 16000) + '；全包（银行+账）常 ' + pr(35000, 100000) + '+。市监<strong>政府性收费</strong>另常 ' + pr(0, 2500) + '。<strong>个人/母公司</strong>垫付——尚无 WFOE。' + foot;
                        case 's06':
                            return '<strong>个人</strong>/母公司。<strong class="text-slate-800">预估：</strong>境外公证以当地货币计价——此处用人民币<strong>规划等价</strong>：常见材料包 ' + pr(70, 1050) + '；单次签署/确认约 ' + pr(35, 175) + '；法人全套更高。';
                        case 's07':
                            return '<strong>个人</strong>/母公司。<strong class="text-slate-800">预估：</strong>海牙认证每份 ' + pr(70, 350) + '；主管机关规费（如州务卿）常 ' + pr(35, 210) + '（加急/快递另计）。';
                        case 's08':
                            return '<strong>仅纸面</strong>—勿汇资本金。<strong class="text-slate-800">预估：</strong>增量 ' + z() + '（章程多在第5步代理范围内）。待第<strong>14–18</strong>步后再汇入。';
                        case 's09':
                            return '<strong>仅表格测算。</strong><strong class="text-slate-800">预估：</strong>' + z() + '；若外包财务建模<strong>约</strong> ' + pr(1400, 14000) + '+。';
                        case 's10':
                            return '<strong>仅纸面。</strong><strong class="text-slate-800">预估：</strong>工商填报高管规费 ' + z() + '。';
                        case 's11':
                            return '<strong>个人</strong>/母公司垫付。<strong class="text-slate-800">预估：</strong>市监<strong>政府收费</strong>常 ' + pr(0, 500) + '；若已含于第5步代理，增量 ' + z() + '。';
                        case 's12':
                            return '尚未收投资款。<strong class="text-slate-800">预估：</strong>领照多数城市另收工本费约 ' + z() + '。';
                        case 's13':
                            return '尚无日常现金流。<strong class="text-slate-800">预估：</strong>公章+财务章+法人章一套常 ' + pr(400, 2000) + '（<strong>数电票</strong>通常不需发票章；部分城市首套免费）。';
                        case 's14':
                            return '<strong>首批企业账户</strong>，可空户开。<strong class="text-slate-800">预估：</strong>开户费 ' + pr(0, 800) + '（多可减免）；注意最低余额要求。';
                        case 's15':
                            return '可收 FDI。<strong class="text-slate-800">预估：</strong>第二账户若收费常 ' + pr(0, 500) + '，多 ' + z() + '。';
                        case 's16':
                            return '<strong>尚未汇出。</strong><strong class="text-slate-800">预估：</strong>纸面 ' + z() + '；代理超出套餐工时按 <strong>约</strong> ' + pr(350, 1400) + '/小时。';
                        case 's17':
                            return '<strong>资本金到账。</strong><strong class="text-slate-800">预估：</strong>境外汇出行费用（规划等价）约 ' + pr(200, 1500) + '+（因银行差异大）；入账行完成<strong>货币出资入账登记</strong>后可能有<strong>汇差</strong>（非固定手续费行）。';
                        case 's18':
                            return '<strong>基本户可用人民币。</strong><strong class="text-slate-800">预估：</strong>结汇常 ' + pr(0, 300) + ' 或含在套餐；少见单独规费。';
                        case 's19':
                            return '自<strong>基本户</strong>支付。<strong class="text-slate-800">预估：</strong>新办纳税人信息确认多 ' + z() + '；<strong>数电发票</strong>开通 ' + pr(0, 500) + '（如有平台/服务费）；极少数 legacy 税控硬件 ' + pr(0, 500) + '。';
                        case 's20':
                            return '<strong>工资+法定缴费</strong>自基本户。<strong class="text-slate-800">预估：</strong>社保/公积金单位登记常 ' + pr(0, 300) + '（<strong>用工前</strong>须办；一窗通可勾选或后续补办）；<strong>持续</strong>缴费见<a href="#costs" class="text-emerald-700 font-semibold underline">仪表盘</a>。';
                        default:
                            return '';
                    }
                }

                switch (stepId) {
                    case 's01':
                        return '<strong>No WFOE account.</strong> <strong class="text-slate-800">Est.:</strong> ' + z() + ' at this step; name pre-check is usually folded into your agent agreement (step 5).';
                    case 's02':
                        return '<strong>No WFOE account.</strong> <strong class="text-slate-800">Est.:</strong> ' + z() + ' for registration prep; only soft costs (travel to view space).';
                    case 's03':
                        return '<strong>No WFOE account.</strong> <strong class="text-slate-800">Est.:</strong> ' + z() + ' (landlord provides the certificate).';
                    case 's04':
                        return '<strong>Personal /</strong> offshore parent. <strong class="text-slate-800">Est. cash:</strong> deposit (often <strong>1–3× monthly rent</strong>) + first month + fees—illustrative ' + prPlus(30000, 250000) + ' for a small tier‑1 office; wide by city.';
                    case 's05':
                        return '<strong>Agency service fees</strong> (local firms, usually quoted in <strong>RMB</strong>): standard WFOE often ' + pr(12000, 40000) + ' (tier‑1 often higher); lean filing often ' + pr(5000, 16000) + '; full-service (bank + books) often ' + pr(35000, 100000) + '+. AMR <strong>government</strong> charges commonly ' + pr(0, 2500) + ' on top. <strong>Personal</strong> / <strong>parent</strong> pays—no WFOE yet.' + foot;
                    case 's06':
                        return '<strong>Personal</strong> / parent. <strong class="text-slate-800">Est.:</strong> home-country notary is paid abroad—<strong>planning RMB equivalents</strong>: typical pack ' + pr(70, 1050) + '; many acknowledgments ' + pr(35, 175) + ' each; corporate stacks higher.';
                    case 's07':
                        return '<strong>Personal</strong> / parent. <strong class="text-slate-800">Est.:</strong> apostille per document ' + pr(70, 350) + '; authority fee (e.g. Secretary of State) often ' + pr(35, 210) + ' (courier/expedite extra).';
                    case 's08':
                        return '<strong>Paper only</strong>—no equity wired. <strong class="text-slate-800">Est.:</strong> ' + z() + ' incremental (articles drafting usually inside step 5). Wait for steps <strong>14–18</strong> before inbound capital.';
                    case 's09':
                        return '<strong>Spreadsheet only.</strong> <strong class="text-slate-800">Est.:</strong> ' + z() + '; optional outsourced model <strong>~</strong> ' + pr(1400, 14000) + '+.';
                    case 's10':
                        return '<strong>Paper only.</strong> <strong class="text-slate-800">Est.:</strong> ' + z() + ' government fee for naming officers in the file.';
                    case 's11':
                        return '<strong>Personal</strong> / parent until the WFOE can pay. <strong class="text-slate-800">Est.:</strong> AMR <strong>government</strong> fee often ' + pr(0, 500) + '; if your agent (step 5) already included filing, incremental ' + z() + '.';
                    case 's12':
                        return 'Not receiving investment yet. <strong class="text-slate-800">Est.:</strong> license pickup usually ' + z() + ' (no separate fee in many cities).';
                    case 's13':
                        return 'Still <strong>no</strong> operating cash flow. <strong class="text-slate-800">Est.:</strong> seal set (official + financial + legal-person) often ' + pr(400, 2000) + ' all-in (<strong>数电票</strong> usually needs no invoice chop; some cities bundle one free seal).';
                    case 's14':
                        return '<strong>First WFOE accounts</strong>—may open empty. <strong class="text-slate-800">Est.:</strong> account-opening fee ' + pr(0, 800) + ' (often waived); minimum balance rules vary.';
                    case 's15':
                        return 'Ready to <strong>receive</strong> FDI wires. <strong class="text-slate-800">Est.:</strong> ' + pr(0, 500) + ' if the bank charges a second account-setup fee (often ' + z() + ').';
                    case 's16':
                        return '<strong>No wire yet</strong>—paperwork first. <strong class="text-slate-800">Est.:</strong> ' + z() + ' filing; agent time beyond package <strong>~</strong> ' + pr(350, 1400) + '/hr if billable.';
                    case 's17':
                        return '<strong>Equity lands onshore.</strong> <strong class="text-slate-800">Est.:</strong> sender-bank charges (planning <strong>RMB equivalent</strong>) often ' + pr(200, 1500) + '+ (highly bank-dependent); bank completes <strong>capital contribution receipt registration</strong> before settlement—receiving side may embed <strong>FX spread</strong>.';
                    case 's18':
                        return '<strong>Usable RMB</strong> in the basic account. <strong class="text-slate-800">Est.:</strong> settlement often ' + pr(0, 300) + ' or included; rare separate government charge.';
                    case 's19':
                        return 'Pay from <strong>RMB basic</strong>. <strong class="text-slate-800">Est.:</strong> new-taxpayer onboarding often ' + z() + '; <strong>fully digital e-invoicing (数电发票)</strong> onboarding ' + pr(0, 500) + ' (if any); legacy hardware only in rare setups ' + pr(0, 500) + '.';
                    case 's20':
                        return '<strong>Payroll + statutory</strong> from basic. <strong class="text-slate-800">Est.:</strong> social/housing-fund unit registration often ' + pr(0, 300) + ' (<strong>before hiring</strong>; optional at 一窗通 or later); <strong>ongoing</strong> contributions per <a href="#costs" class="text-emerald-700 font-semibold underline">dashboard</a> once you hire.';
                    default:
                        return '';
                }
            }

            function refreshWfoeMoney() {
                document.querySelectorAll('[data-wfoe-money]').forEach(function (el) {
                    const id = el.getAttribute('data-wfoe-money');
                    if (!id) return;
                    const lang = typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' ? 'zh' : 'en';
                    el.innerHTML = buildWfoeStepMoneyHtml(id, lang);
                });
            }
            // Exposed for steps-render.js's `china-biz-steps-rendered` listener:
            // the WFOE step DOM may be injected after this script's DOMContentLoaded
            // path has already filled (or no-op'd) the money cells, so the renderer
            // needs to retrigger the fill once the data-wfoe-money nodes exist.
            window.refreshWfoeMoney = refreshWfoeMoney;

            function buildDomesticFeeHtml(stepId, lang) {
                const f = makeStepMoneyFormatters(lang, effectiveExchangeRate());
                const sb = f.sb;
                const sr = f.sr;
                const addrBand = f.addrBand;

                if (lang === 'zh') {
                    switch (stepId) {
                        case 'd01':
                            return '<strong>预估：</strong>政府规费' + sb(0) + '；主要为时间成本。';
                        case 'd02':
                            return '<strong>预估：</strong>名称查询常' + sb(0) + '；地址成本为<strong>租金或园区费用</strong>——预估' + addrBand() + '起，因城市与面积而异。';
                        case 'd03':
                            return '<strong>预估：</strong>填报认缴' + sb(0) + '规费；认缴制下设立当日<strong>不强制</strong>实缴到位。';
                        case 'd04':
                            return '<strong>自助：</strong>市监侧政府性收费常' + sr(0, 500, false) + '。<strong>代办：</strong>仅递交常见' + sr(500, 3000, false) + '；「设立+银行+首年记账」全包常' + sr(3000, 15000, true) + '（一线城市常更高）。';
                        case 'd05':
                            return '<strong>预估：</strong>执照工本费多地' + sb(0) + '；邮寄纸质可选' + sr(0, 30, false) + '。';
                        case 'd06':
                            return '<strong>预估：</strong>若不免费，全套常' + sr(300, 1200, false) + '；加急或材质另计。';
                        case 'd07':
                            return '<strong>预估：</strong>开户费多地' + sb(0) + '；U 盾/网银工具' + sr(0, 500, false) + '。';
                        case 'd08':
                            return '<strong>预估：</strong>新办纳税人信息确认多' + sb(0) + '；<strong>数电票</strong>开通' + sr(0, 200, false) + '；legacy 税控设备（如仍被要求）' + sr(0, 500, false) + '——新设多数' + sb(0) + '。';
                        case 'd09':
                            return '<strong>预估：</strong>开户登记常' + sr(0, 300, false) + '；实际缴费自用工起发生。';
                        case 'd10':
                            return '<strong>预估：</strong>代理记账小微企业常见' + sr(200, 800, true) + '/月；业务复杂或进出口另议。';
                        default:
                            return '';
                    }
                }

                switch (stepId) {
                    case 'd01':
                        return '<strong>Est.:</strong> ' + sb(0) + ' government fee for prep; only time cost.';
                    case 'd02':
                        return '<strong>Est.:</strong> name search often ' + sb(0) + '; address cost is <strong>rent or park fee</strong>—illustrative ' + addrBand() + ' upfront depending on city and size.';
                    case 'd03':
                        return '<strong>Est.:</strong> ' + sb(0) + ' filing fee to declare amounts; no mandatory day-one cash injection under subscription rules.';
                    case 'd04':
                        return '<strong>DIY:</strong> AMR side often ' + sr(0, 500, false) + ' government charges. <strong>Agent:</strong> lean packages often ' + sr(500, 3000, false) + '; full “setup + bank + first-year books” often ' + sr(3000, 15000, true) + ' (tier‑1 often higher).';
                    case 'd05':
                        return '<strong>Est.:</strong> license fee commonly ' + sb(0) + ' in many regions; courier ' + sr(0, 30, false) + ' if mailing paper.';
                    case 'd06':
                        return '<strong>Est.:</strong> if not free, a full set often ' + sr(300, 1200, false) + '; express/specialty materials extra.';
                    case 'd07':
                        return '<strong>Est.:</strong> many banks ' + sb(0) + ' opening fee; U-key / cash-management tools ' + sr(0, 500, false) + '.';
                    case 'd08':
                        return '<strong>Est.:</strong> new-taxpayer onboarding often ' + sb(0) + '; digital invoicing onboarding ' + sr(0, 200, false) + '; legacy hardware (if still required) ' + sr(0, 500, false) + '—most new entities ' + sb(0) + '.';
                    case 'd09':
                        return '<strong>Est.:</strong> opening registrations often ' + sr(0, 300, false) + '; actual contributions begin once you hire.';
                    case 'd10':
                        return '<strong>Est.:</strong> agency bookkeeping often ' + sr(200, 800, true) + '/month for a micro company; complex invoicing or export adds fees.';
                    default:
                        return '';
                }
            }

            function refreshDomesticFees() {
                document.querySelectorAll('[data-domestic-fee]').forEach(function (el) {
                    const id = el.getAttribute('data-domestic-fee');
                    if (!id) return;
                    const lang = typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' ? 'zh' : 'en';
                    el.innerHTML = buildDomesticFeeHtml(id, lang);
                });
            }
            window.refreshDomesticFees = refreshDomesticFees;

            function buildJvStepMoneyHtml(stepId, lang) {
                const r = effectiveExchangeRate();
                const f = makeStepMoneyFormatters(lang, r);
                const z = f.z;
                const pr = f.pr;
                const prPlus = f.prPlus;
                const pgt = f.pgt;
                const rateFmt = r.toFixed(2);
                let fxNote = tr('s05.fee_fx_note', 'RMB is the planning anchor; USD = RMB ÷ rate. Same as Financials: <strong>1 USD ≈ {rate} CNY</strong> (live when the feed loads, otherwise a 2024-avg fallback of 7.2).');
                fxNote = fxNote.replace(/\{rate\}/g, rateFmt);
                const foot = lang === 'zh' ? '' : '<span class="text-slate-500 text-xs block mt-1.5">' + fxNote + '</span>';

                if (lang === 'zh') {
                    switch (stepId) {
                        case 'jv01':
                            return '<strong>双方股东</strong>垫付。<strong class="text-slate-800">预估：</strong>第三方尽调/法律 ' + pr(15000, 80000) + '+。';
                        case 'jv02':
                            return '<strong>双方股东</strong>垫付。<strong class="text-slate-800">预估：</strong>合资合同+章程律师费 ' + pr(30000, 150000) + '+。';
                        case 'jv03':
                            return '<strong>预估：</strong>负面清单对照 ' + pr(5000, 50000) + '+；政府规费 ' + pr(0, 500) + '；行业前置审批另计。';
                        case 'jv04':
                            return '<strong>尚无合资公司账户。</strong><strong class="text-slate-800">预估：</strong>名称自主申报 ' + z() + '；多含于代办套餐。';
                        case 'jv05':
                            return '<strong>股东垫付。</strong><strong class="text-slate-800">现金预估：</strong>押金+首期租金示意 ' + prPlus(30000, 250000) + '；境外公证海牙 ' + pr(500, 5000) + '+。';
                        case 'jv06':
                            return '<strong>股东垫付。</strong><strong class="text-slate-800">预估：</strong>市监<strong>政府收费</strong> ' + pr(0, 2500) + '；合资代办（双股东、双语）常 ' + pr(18000, 55000) + '，多已含于前期律师/代理合同。' + foot;
                        case 'jv07':
                            return '尚无日常现金流。<strong class="text-slate-800">预估：</strong>公章+财务章+法人章一套 ' + pr(400, 2000) + '（<strong>数电票</strong>通常不需发票章；部分城市首套免费）。';
                        case 'jv08':
                            return '自<strong>基本户</strong>支付。<strong class="text-slate-800">预估：</strong>新办纳税人信息确认多 ' + z() + '；<strong>数电发票</strong>开通 ' + pr(0, 500) + '（如有）；代理协助 ' + pr(0, 3000) + '。';
                        case 'jv09':
                            return '<strong>首批企业账户</strong>。<strong class="text-slate-800">预估：</strong>开户+外汇登记 ' + pr(0, 1300) + '；银行协助 ' + pr(3000, 15000) + '。';
                        case 'jv10':
                            return '<strong>资本金到账。</strong><strong class="text-slate-800">预估：</strong>境外汇出行费用约 ' + pr(100, 500) + '+；银行杂费 ' + pr(0, 5000) + '。';
                        case 'jv11':
                            return '<strong>工资+法定缴费</strong>自基本户。<strong class="text-slate-800">预估：</strong>登记 ' + pr(0, 300) + '；开办杂费 ' + pr(0, 2000) + '；<strong>持续</strong>缴费见<a href="#costs" class="text-emerald-700 font-semibold underline">仪表盘</a>。';
                        case 'jv12':
                            return '<strong>预估：</strong>政府规费 ' + pr(0, 5000) + '+；海关/ICP/行业许可代办 ' + prPlus(5000, 100000) + '（视行业）。';
                        default:
                            return '';
                    }
                }

                switch (stepId) {
                    case 'jv01':
                        return '<strong>Both shareholders</strong> pay. <strong class="text-slate-800">Est.:</strong> third-party DD / legal ' + pr(15000, 80000) + '+.';
                    case 'jv02':
                        return '<strong>Both shareholders</strong> pay. <strong class="text-slate-800">Est.:</strong> JV agreement + Articles counsel ' + pr(30000, 150000) + '+.';
                    case 'jv03':
                        return '<strong>Est.:</strong> Negative List mapping ' + pr(5000, 50000) + '+; government fees ' + pr(0, 500) + '; sector pre-approval extra.';
                    case 'jv04':
                        return '<strong>No JV account yet.</strong> <strong class="text-slate-800">Est.:</strong> name self-declaration ' + z() + '; usually folded into agent pack.';
                    case 'jv05':
                        return '<strong>Shareholders pay.</strong> <strong class="text-slate-800">Est. cash:</strong> deposit + first rent illustrative ' + prPlus(30000, 250000) + '; overseas notary/apostille ' + pr(500, 5000) + '+.';
                    case 'jv06':
                        return '<strong>Shareholders pay</strong> until the JV can reimburse. <strong class="text-slate-800">Est.:</strong> AMR <strong>government</strong> fee ' + pr(0, 2500) + '; JV agency (two shareholders, bilingual) often ' + pr(18000, 55000) + '—may already sit in prior counsel/agent contracts.' + foot;
                    case 'jv07':
                        return 'Still <strong>no</strong> operating cash flow. <strong class="text-slate-800">Est.:</strong> seal set (official + financial + legal-person) often ' + pr(400, 2000) + ' all-in (<strong>digital invoicing</strong> setups usually skip invoice chop; some cities waive first set).';
                    case 'jv08':
                        return 'Pay from <strong>RMB basic</strong>. <strong class="text-slate-800">Est.:</strong> new-taxpayer onboarding often ' + z() + '; <strong>fully digital e-invoicing (数电发票)</strong> onboarding ' + pr(0, 500) + ' (if any).';
                    case 'jv09':
                        return '<strong>First JV accounts</strong>. <strong class="text-slate-800">Est.:</strong> opening + FX registration ' + pr(0, 1300) + '; bank assist ' + pr(3000, 15000) + '.';
                    case 'jv10':
                        return '<strong>Equity lands onshore.</strong> <strong class="text-slate-800">Est.:</strong> sender-bank charges often ' + pr(200, 1500) + '+; in-kind/IP appraisal (if any) ' + pr(8000, 50000) + '+.';
                    case 'jv11':
                        return '<strong>Payroll + statutory</strong> from basic. <strong class="text-slate-800">Est.:</strong> social insurance + housing fund registration often ' + pr(0, 300) + '; <strong>ongoing</strong> contributions per <a href="#costs" class="text-emerald-700 font-semibold underline">dashboard</a> once you hire.';
                    case 'jv12':
                        return '<strong>Est.:</strong> government fees ' + pr(0, 5000) + '+; customs / ICP / sector licence agents ' + prPlus(5000, 100000) + ' (sector-dependent).';
                    default:
                        return '';
                }
            }

            function refreshJvMoney() {
                document.querySelectorAll('[data-jv-money]').forEach(function (el) {
                    const id = el.getAttribute('data-jv-money');
                    if (!id) return;
                    const lang = typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' ? 'zh' : 'en';
                    el.innerHTML = buildJvStepMoneyHtml(id, lang);
                });
            }
            window.refreshJvMoney = refreshJvMoney;

            // Headcount listener
            const hcInput = document.getElementById('headcount-input');
            hcInput.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                state.headcount = val;
                updateVisuals();
            });

            // Event Listeners
            function toggleBtnActive(btnId, otherBtnId, updateStateKey, updateStateVal) {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        state[updateStateKey] = updateStateVal;
                        // Correctly target the button if a child was clicked
                        const target = e.currentTarget;
                        const other = document.getElementById(otherBtnId);

                        target.classList.add('bg-white', 'shadow-sm', 'text-slate-800');
                        target.classList.remove('text-slate-600');
                        if (other) {
                            other.classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
                            other.classList.add('text-slate-600');
                        }
                        updateVisuals();
                    });
                }
            }

            toggleBtnActive('btn-junior', 'btn-senior', 'role', 'junior');
            toggleBtnActive('btn-senior', 'btn-junior', 'role', 'senior');
            toggleBtnActive('btn-usd', 'btn-rmb', 'currency', 'usd');
            toggleBtnActive('btn-rmb', 'btn-usd', 'currency', 'rmb');

            if (typeof window.ChinaBizI18n !== 'undefined') {
                state.currency = window.ChinaBizI18n.getLang() === 'zh' ? 'rmb' : 'usd';
            }
            syncCurrencyButtons();

            function syncOverheadToggleUI() {
                const ex = document.getElementById('btn-overhead-exclude');
                const inc = document.getElementById('btn-overhead-include');
                if (!ex || !inc) return;
                if (state.includeOverhead) {
                    ex.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    ex.classList.add('text-slate-600');
                    inc.classList.add('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    inc.classList.remove('text-slate-600');
                } else {
                    inc.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    inc.classList.add('text-slate-600');
                    ex.classList.add('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    ex.classList.remove('text-slate-600');
                }
            }

            const btnOverheadExclude = document.getElementById('btn-overhead-exclude');
            if (btnOverheadExclude) {
                btnOverheadExclude.addEventListener('click', () => {
                    state.includeOverhead = false;
                    syncOverheadToggleUI();
                    updateVisuals();
                });
            }
            const btnOverheadInclude = document.getElementById('btn-overhead-include');
            if (btnOverheadInclude) {
                btnOverheadInclude.addEventListener('click', () => {
                    state.includeOverhead = true;
                    syncOverheadToggleUI();
                    updateVisuals();
                });
            }
            syncOverheadToggleUI();

            function syncInternationalToggleUI() {
                const hideBtn = document.getElementById('btn-international-hide');
                const showBtn = document.getElementById('btn-international-show');
                if (!hideBtn || !showBtn) return;
                if (state.showInternationalCities) {
                    hideBtn.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    hideBtn.classList.add('text-slate-600');
                    showBtn.classList.add('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    showBtn.classList.remove('text-slate-600');
                } else {
                    showBtn.classList.remove('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    showBtn.classList.add('text-slate-600');
                    hideBtn.classList.add('bg-white', 'shadow-sm', 'font-semibold', 'text-slate-800');
                    hideBtn.classList.remove('text-slate-600');
                }
            }

            document.getElementById('btn-international-hide').addEventListener('click', () => {
                state.showInternationalCities = false;
                ensureValidCitySelection();
                syncInternationalToggleUI();
                rebuildCitySelectOptions();
                updateVisuals();
            });
            document.getElementById('btn-international-show').addEventListener('click', () => {
                state.showInternationalCities = true;
                syncInternationalToggleUI();
                rebuildCitySelectOptions();
                updateVisuals();
            });
            syncInternationalToggleUI();

            window.addEventListener('china-biz-lang-change', function (e) {
                const lang = e.detail && e.detail.lang;
                if (lang === 'zh') state.currency = 'rmb';
                else if (lang === 'en') state.currency = 'usd';
                syncCurrencyButtons();
                updateFxLabel();
                rebuildCitySelectOptions(); // refresh option text in the new language
                updateVisuals();
            });

            // Phase 4 — WFOE/domestic step cards are rendered asynchronously by
            // steps-render.js after fetching JSON. When that completes, re-fill
            // the money/fee cells (which need data-wfoe-money / data-domestic-fee
            // nodes to exist) and trigger a single updateVisuals so chart
            // dependants pick up any change. setLang re-application is handled
            // inside steps-render.js itself.
            window.addEventListener('china-biz-steps-rendered', function () {
                if (typeof refreshWfoeMoney === 'function') refreshWfoeMoney();
                if (typeof refreshDomesticFees === 'function') refreshDomesticFees();
                if (typeof refreshJvMoney === 'function') refreshJvMoney();
            });

            /* ----------------------------------------------------------------
               Dark mode toggle. The html.dark class + saved preference are
               already applied pre-paint by the inline bootstrap script in
               index.html <head> (avoids flash of wrong theme); this handler
               only flips the class + persists on click. Chart.js draws its
               axis/legend/tooltip text in a fixed Chart.defaults.color, which
               does not respond to CSS, so we update that and force a redraw
               of both charts on toggle — everything else (surfaces, borders,
               step-flow rail, badges) is covered by the html.dark overrides
               in china-business.css.
               ---------------------------------------------------------------- */
            const THEME_STORAGE_KEY = 'wfoe-china-theme';
            function isDarkMode() {
                return document.documentElement.classList.contains('dark');
            }
            function applyChartTheme() {
                if (typeof Chart === 'undefined') return;
                Chart.defaults.color = isDarkMode() ? '#94a3b8' : '#475569';
                [barChart, doughnutChart].forEach(function (c) {
                    if (c) c.update();
                });
            }
            function setDarkMode(dark) {
                document.documentElement.classList.toggle('dark', dark);
                try { localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
                applyChartTheme();
            }
            const themeToggleBtn = document.getElementById('theme-toggle');
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener('click', function () {
                    setDarkMode(!isDarkMode());
                });
            }

            /* ----------------------------------------------------------------
               Phase 1.2 — City focus dropdown.
               A keyboard-friendly parallel control for the bar-chart onClick.
               Builds <option> nodes once from cityData, listens to "change",
               and rebuilds option labels on language change. state.city is the
               single source of truth; updateVisuals() keeps select.value in
               sync after a chart click. We do not change cityData ordering.
               ---------------------------------------------------------------- */
            function rebuildCitySelectOptions() {
                const sel = document.getElementById('city-nav-select');
                if (!sel) return;
                // Sort alphabetically by display name for predictable scanning;
                // the bar chart sorts by cost descending, which is its own concern.
                const keys = getDashboardCityKeys().slice().sort(function (a, b) {
                    return cityDisplayName(a).localeCompare(cityDisplayName(b));
                });
                sel.innerHTML = '';
                keys.forEach(function (k) {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.textContent = cityDisplayName(k);
                    sel.appendChild(opt);
                });
                ensureValidCitySelection();
                sel.value = keys.indexOf(state.city) !== -1 ? state.city : keys[0];
            }
            rebuildCitySelectOptions();
            const citySelectEl = document.getElementById('city-nav-select');
            if (citySelectEl) {
                citySelectEl.addEventListener('change', function (e) {
                    const v = e.target.value;
                    if (v && cityData[v] && state.city !== v) {
                        state.city = v;
                        updateVisuals();
                    }
                });
            }

            /* ----------------------------------------------------------------
               Phase 1.1 — Mobile menu toggle.
               aria-expanded drives both the panel visibility (via .hidden) and
               the icon swap (CSS). Closes on: panel link click, Escape key,
               outside click, or viewport widening past md. Focus moves to the
               first link on open; back to the toggle on close.
               ---------------------------------------------------------------- */
            (function setupMobileMenu() {
                const toggle = document.getElementById('nav-menu-toggle');
                const panel = document.getElementById('mobile-menu');
                if (!toggle || !panel) return;

                function ariaLabelKey(open) {
                    return open ? 'nav.menu_close' : 'nav.menu_open';
                }
                function applyAriaLabel(open) {
                    const fallback = open ? 'Close menu' : 'Open menu';
                    toggle.setAttribute('aria-label', tr(ariaLabelKey(open), fallback));
                }
                function open() {
                    panel.classList.remove('hidden');
                    toggle.setAttribute('aria-expanded', 'true');
                    applyAriaLabel(true);
                    const first = panel.querySelector('[data-mobile-nav-link]');
                    if (first) first.focus({ preventScroll: true });
                }
                function close(restoreFocus) {
                    panel.classList.add('hidden');
                    toggle.setAttribute('aria-expanded', 'false');
                    applyAriaLabel(false);
                    if (restoreFocus) toggle.focus({ preventScroll: true });
                }
                toggle.addEventListener('click', function () {
                    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                    if (isOpen) close(true); else open();
                });
                // Closing on link tap keeps the panel from obscuring the section it just jumped to.
                panel.querySelectorAll('[data-mobile-nav-link]').forEach(function (a) {
                    a.addEventListener('click', function () { close(false); });
                });
                document.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
                        close(true);
                    }
                });
                document.addEventListener('click', function (e) {
                    if (toggle.getAttribute('aria-expanded') !== 'true') return;
                    if (panel.contains(e.target) || toggle.contains(e.target)) return;
                    close(false);
                });
                // If user resizes past md, hide panel so it doesn't linger when re-entering mobile.
                const mq = window.matchMedia('(min-width: 768px)');
                function syncFromMq() {
                    if (mq.matches && toggle.getAttribute('aria-expanded') === 'true') {
                        close(false);
                    }
                }
                if (mq.addEventListener) mq.addEventListener('change', syncFromMq);
                else if (mq.addListener) mq.addListener(syncFromMq);
                // Refresh aria-label after each language change.
                window.addEventListener('china-biz-lang-change', function () {
                    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                    applyAriaLabel(isOpen);
                });
                applyAriaLabel(false);
            })();

            /* ----------------------------------------------------------------
               Phase 1.3 helper — force every <details> open before printing so
               the printed copy contains every step body. The original open
               state is restored on "afterprint" so the on-screen disclosure
               UI is not affected. Pure progressive enhancement; if the print
               events aren't supported the original layout still prints.
               ---------------------------------------------------------------- */
            (function setupPrintExpansion() {
                let originalStates = null;
                function expandAll() {
                    originalStates = [];
                    document.querySelectorAll('details').forEach(function (d) {
                        originalStates.push({ el: d, wasOpen: d.open });
                        d.open = true;
                    });
                }
                function restoreAll() {
                    if (!originalStates) return;
                    originalStates.forEach(function (s) { s.el.open = s.wasOpen; });
                    originalStates = null;
                }
                window.addEventListener('beforeprint', expandAll);
                window.addEventListener('afterprint', restoreAll);
            })();

            /* ----------------------------------------------------------------
               Phase 2.3 safety — if the Chart.js CDN fails (network, SRI
               mismatch, ad blocker), surface a single inline notice instead
               of leaving two silent blank canvases. We do not try to swap in
               an alternative library; the page text + tables still work.
               ---------------------------------------------------------------- */
            if (typeof Chart === 'undefined') {
                const barHost = document.getElementById('barChartAllCities');
                const donutHost = document.getElementById('doughnutCityDetail');
                function placeNotice(canvas) {
                    if (!canvas || !canvas.parentNode) return;
                    const wrap = canvas.closest('.chart-container, .chart-container-tall') || canvas.parentNode;
                    const note = document.createElement('div');
                    note.setAttribute('role', 'status');
                    note.className = 'text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3';
                    note.textContent = tr('chart.cdn_unavailable',
                        'Chart visualisation unavailable (Chart.js failed to load). Salary and contribution numbers are unaffected; refresh to retry.');
                    wrap.appendChild(note);
                    canvas.style.display = 'none';
                }
                placeNotice(barHost);
                placeNotice(donutHost);
                return; // Skip chart init; rest of page (tabs, i18n, fees) still works.
            }

            initCharts();
            applyChartTheme(); // pick up html.dark set pre-paint by the bootstrap script, if any
            updateFxLabel();
            loadExchangeRate();

            window.__chinaBizTest = {
                getDashboardCityCount: function () { return getDashboardCityKeys().length; },
                getState: function () { return Object.assign({}, state); },
                getCostData: getCostData
            };
        });
