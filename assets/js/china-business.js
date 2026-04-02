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

            /* Data setup: all mainland / dashboard economics are modeled in RMB first (salaries, employer contributions,
               office rent, utilities, modeled overhead). USD display = RMB ÷ USD/CNY (live API when available, else FALLBACK_USD_CNY).
               Exceptions: text that quotes US-market fees (e.g. notary, US wire) or USD vendor list prices is labeled in USD;
               RMB equivalents for those are derived when shown in ¥. */
            const FALLBACK_USD_CNY = 6.8;
            let exchangeRate = FALLBACK_USD_CNY;
            let exchangeRateIsLive = false;

            function effectiveExchangeRate() {
                return typeof exchangeRate === 'number' && exchangeRate > 0 && exchangeRate < 100
                    ? exchangeRate
                    : FALLBACK_USD_CNY;
            }

            function updateFxLabel() {
                const el = document.getElementById('fx-rate-display');
                if (!el) return;
                const r = effectiveExchangeRate().toFixed(2);
                const mode = exchangeRateIsLive
                    ? tr('chart.fx_mode_live', 'live')
                    : tr('chart.fx_mode_fallback', 'offline default (6.8)');
                let line = tr('chart.fx_line', 'USD column uses 1 USD ≈ {rate} CNY ({mode}).');
                line = line.replace(/\{rate\}/g, r).replace(/\{mode\}/g, mode);
                el.textContent = line;
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
                updateFxLabel();
                updateVisuals();
            }

            /* Per city: officeRentAnnualRMB (10 m² × avg office RMB/m²/mo × 12), utilitiesAnnualRMB (power + heat/cool + cleaning alloc.).
               Global: OVERHEAD_HARDWARE_ANNUAL_RMB, OVERHEAD_SOFTWARE_ANNUAL_RMB (AEC Collection + Rhino modeled seat-year). */
            const OVERHEAD_HARDWARE_ANNUAL_RMB = 13800;
            const OVERHEAD_SOFTWARE_ANNUAL_RMB = 36000;

            /* Salaries: AEC CAD/BIM junior vs senior modeler, annual base (12x monthly bands from Liepin, 51job, i人事, city HR releases, 2024-2025).
               Rent: officeRentAnnualRMB = 10 m2 x Grade A/B effective RMB/m2/mo x 12 (CIH, JLL, Savills, Knight Frank, Colliers, DTZ, local gov - mostly Q3-Q4 2024).
               Utilities: allocated HVAC, power, cleaning (higher north/heating; coastal humidity/summer). */
            const cityData = {
                beijing: { name: "Beijing", nameZh: "北京", type: "mainland", juniorAnnual: 118000, seniorAnnual: 270000, contribPct: 0.38, officeRentAnnualRMB: 30240, utilitiesAnnualRMB: 8300 },
                shanghai: { name: "Shanghai", nameZh: "上海", type: "mainland", juniorAnnual: 118000, seniorAnnual: 258000, contribPct: 0.38, officeRentAnnualRMB: 24000, utilitiesAnnualRMB: 7600 },
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
                macau: { name: "Macau", nameZh: "澳门", type: "sar", juniorAnnual: 180000, seniorAnnual: 360000, contribPct: 0.01, officeRentAnnualRMB: 102000, utilitiesAnnualRMB: 7600 },
                suzhou: { name: "Suzhou", nameZh: "苏州", type: "mainland", juniorAnnual: 102000, seniorAnnual: 228000, contribPct: 0.38, officeRentAnnualRMB: 8640, utilitiesAnnualRMB: 7100 },
                changsha: { name: "Changsha", nameZh: "长沙", type: "mainland", juniorAnnual: 80000, seniorAnnual: 174000, contribPct: 0.36, officeRentAnnualRMB: 9420, utilitiesAnnualRMB: 7300 },
                chongqing: { name: "Chongqing", nameZh: "重庆", type: "mainland", juniorAnnual: 84000, seniorAnnual: 180000, contribPct: 0.36, officeRentAnnualRMB: 9000, utilitiesAnnualRMB: 7900 },
                kunming: { name: "Kunming", nameZh: "昆明", type: "mainland", juniorAnnual: 70000, seniorAnnual: 154000, contribPct: 0.35, officeRentAnnualRMB: 8580, utilitiesAnnualRMB: 6400 },
                qingdao: { name: "Qingdao", nameZh: "青岛", type: "mainland", juniorAnnual: 92000, seniorAnnual: 206000, contribPct: 0.38, officeRentAnnualRMB: 12720, utilitiesAnnualRMB: 7900 },
                zhengzhou: { name: "Zhengzhou", nameZh: "郑州", type: "mainland", juniorAnnual: 76000, seniorAnnual: 164000, contribPct: 0.35, officeRentAnnualRMB: 6480, utilitiesAnnualRMB: 6900 },
                dalian: { name: "Dalian", nameZh: "大连", type: "mainland", juniorAnnual: 80000, seniorAnnual: 176000, contribPct: 0.38, officeRentAnnualRMB: 8160, utilitiesAnnualRMB: 8900 }
            };

            function cityDisplayName(key) {
                const c = cityData[key];
                if (!c) return '';
                if (typeof window.ChinaBizI18n !== 'undefined' && window.ChinaBizI18n.getLang() === 'zh' && c.nameZh) return c.nameZh;
                return c.name;
            }

            function overheadAnnualTotalRMB(c) {
                return (c.officeRentAnnualRMB || 0) + OVERHEAD_HARDWARE_ANNUAL_RMB + (c.utilitiesAnnualRMB || 0) + OVERHEAD_SOFTWARE_ANNUAL_RMB;
            }

            function overheadPartsForCity(cityKey) {
                const c = cityData[cityKey];
                return {
                    rent: c.officeRentAnnualRMB || 0,
                    hardware: OVERHEAD_HARDWARE_ANNUAL_RMB,
                    utilities: c.utilitiesAnnualRMB || 0,
                    software: OVERHEAD_SOFTWARE_ANNUAL_RMB
                };
            }

            const state = {
                city: 'shanghai',
                role: 'junior',
                currency: 'usd',
                headcount: 1,
                includeOverhead: false
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

            function getCostData(cityKey, role) {
                const c = cityData[cityKey];
                const base = role === 'junior' ? c.juniorAnnual : c.seniorAnnual;
                const contrib = base * c.contribPct;
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
                                const clickedCityName = barChart.data.labels[dataIndex];
                                const cityKey = Object.keys(cityData).find(key => {
                                    const c = cityData[key];
                                    return c.name === clickedCityName || c.nameZh === clickedCityName;
                                });

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

                // Sort all cities by total cost descending
                const sortedCityKeys = Object.keys(cityData).sort((a, b) => {
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
                    const mPct = 0.10;
                    const uPct = 0.005;
                    const iPct = 0.005;
                    const hPct = selectedCityObj.contribPct - (pPct + mPct + uPct + iPct);

                    donutLabels = [
                        tr('donut.base', 'Annual Base Salary'),
                        tr('donut.pension', '1. Pension (16%)'),
                        tr('donut.medical', '2. Medical & Maternity (10%)'),
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

                document.getElementById('micro-detail-list').innerHTML = listHTML;

                // Update Text Elements
                document.getElementById('macro-title-role').textContent = state.role === 'junior' ? tr('role.junior_short', 'Junior CAD') : tr('role.senior_short', 'Senior Modeler');
                document.getElementById('micro-title-city').textContent = cityDisplayName(state.city);
                const pctEl = document.getElementById('micro-contrib-pct');
                const pctWrap = document.getElementById('micro-contrib-pct-wrap');
                const breakdownLbl = document.getElementById('micro-breakdown-label');
                if (state.includeOverhead) {
                    if (breakdownLbl) breakdownLbl.textContent = tr('dash.micro.sub1', 'Annual breakdown: employment + overhead (rent, kit, utilities, software)');
                    if (pctWrap) pctWrap.style.display = 'none';
                } else {
                    if (breakdownLbl) breakdownLbl.textContent = tr('dash.micro.sub2', 'Annual Base vs. Employer "5 Insurances & 1 Fund"');
                    if (pctWrap) pctWrap.style.display = 'inline';
                    if (pctEl) pctEl.textContent = (cityData[state.city].contribPct * 100).toFixed(0) + '%';
                }
                document.getElementById('hc-display').textContent = state.headcount;

                // Handle SAR Alerts
                const alertBox = document.getElementById('sar-alert');
                const descText = document.getElementById('micro-desc-text');

                if (cityData[state.city].type === 'sar') {
                    alertBox.classList.remove('hidden');
                    const pct = (cityData[state.city].contribPct * 100).toFixed(0);
                    let sarHtml = tr('desc.sar_strong', '<strong>SAR Framework:</strong> ') + tr('desc.sar_line', 'The ~{pct}% statutory contribution represents approximate limits for localized retirement funds (like Hong Kong\'s MPF) rather than mainland social insurance.').replace(/\{pct\}/g, pct);
                    if (state.includeOverhead) {
                        sarHtml += tr('desc.sar_oh_append', ' <strong>Overhead:</strong> SAR rent uses prime-office bands in RMB; hardware/software use the same global license model as mainland for comparison.');
                    }
                    descText.innerHTML = sarHtml;
                } else {
                    alertBox.classList.add('hidden');
                    let mainlandDesc = tr('desc.mainland', '<strong>Mainland Contributions:</strong> Employer statutory contributions include the mandatory "5 Insurances & 1 Fund" (Pension, Medical, Unemployment, Injury, Maternity, and Housing Fund). Rates fluctuate based on selected municipal policies.');
                    if (state.includeOverhead) {
                        mainlandDesc += ' ' + tr('desc.mainland_oh', '<strong>Overhead:</strong> Rent, utilities, hardware amortization, and AEC software stack are modeled per employee-year (see methodology above).');
                    }
                    if (state.city === 'haikou' || state.city === 'sanya') {
                        mainlandDesc += ' ' + tr('desc.hainan_extra', '<strong>Hainan FTP:</strong> Qualifying companies may access a <strong>15% corporate income tax</strong> rate (encouraged industries; substantive operations). Eligible talent may benefit from the <strong>15% personal income tax</strong> cap on qualifying Hainan-sourced income. Island-wide import treatment and “second line” rules apply for goods moving to the mainland—verify with local counsel.');
                    }
                    descText.innerHTML = mainlandDesc;
                }

                refreshDomesticFees();
            }

            function buildDomesticFeeHtml(stepId, lang, cur) {
                const r = effectiveExchangeRate();
                const u = function (n) { return Math.max(0, Math.round(n / r)); };
                const sb = function (n) {
                    if (cur === 'rmb') return '<strong>¥' + (n === 0 ? '0' : String(Math.round(n))) + '</strong>';
                    if (n === 0) return '<strong>$0</strong>';
                    return '<strong>$' + u(n) + '</strong>';
                };
                const sr = function (lo, hi, plus) {
                    if (cur === 'rmb') {
                        return '<strong>¥' + lo + '–' + hi + (plus ? '+' : '') + '</strong>';
                    }
                    return '<strong>$' + u(lo) + '–' + u(hi) + (plus ? '+' : '') + '</strong>';
                };
                const addrBand = function () {
                    if (lang === 'zh') {
                        if (cur === 'rmb') return '<strong>¥0–2 万+</strong>';
                        return '<strong>$0–' + u(20000) + '+</strong>';
                    }
                    if (cur === 'rmb') return '<strong>¥0–20k+</strong>';
                    return '<strong>$0–' + u(20000) + '+</strong>';
                };

                if (lang === 'zh') {
                    switch (stepId) {
                        case 'd01':
                            return '<strong>预估：</strong>政府规费' + sb(0) + '；主要为时间成本。';
                        case 'd02':
                            return '<strong>预估：</strong>名称查询常' + sb(0) + '；地址成本为<strong>租金或园区费用</strong>——预估' + addrBand() + '起，因城市与面积而异。';
                        case 'd03':
                            return '<strong>预估：</strong>填报认缴' + sb(0) + '规费；认缴制下设立当日<strong>不强制</strong>实缴到位。';
                        case 'd04':
                            return '<strong>自助：</strong>市监侧政府性收费常' + sr(0, 500, false) + '。<strong>代办：</strong>仅递交常见' + sr(800, 3000, false) + '；「设立+银行+首年记账」全包常' + sr(3000, 10000, true) + '。';
                        case 'd05':
                            return '<strong>预估：</strong>执照工本费多地' + sb(0) + '；邮寄纸质可选' + sr(0, 30, false) + '。';
                        case 'd06':
                            return '<strong>预估：</strong>若不免费，全套常' + sr(300, 1200, false) + '；加急或材质另计。';
                        case 'd07':
                            return '<strong>预估：</strong>开户费多地' + sb(0) + '；U 盾/网银工具' + sr(0, 500, false) + '。';
                        case 'd08':
                            return '<strong>预估：</strong>税务侧工本多' + sr(0, 200, false) + '；税控设备若仍涉及硬件' + sr(0, 1000, false) + '——多地已全电票、无盘化。';
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
                        return '<strong>DIY:</strong> AMR side often ' + sr(0, 500, false) + ' government charges. <strong>Agent:</strong> lean packages often ' + sr(800, 3000, false) + '; full “setup + bank + first-year books” often ' + sr(3000, 10000, true) + '.';
                    case 'd05':
                        return '<strong>Est.:</strong> license fee commonly ' + sb(0) + ' in many regions; courier ' + sr(0, 30, false) + ' if mailing paper.';
                    case 'd06':
                        return '<strong>Est.:</strong> if not free, a full set often ' + sr(300, 1200, false) + '; express/specialty materials extra.';
                    case 'd07':
                        return '<strong>Est.:</strong> many banks ' + sb(0) + ' opening fee; U-key / cash-management tools ' + sr(0, 500, false) + '.';
                    case 'd08':
                        return '<strong>Est.:</strong> bureau-side fees often ' + sr(0, 200, false) + '; legacy hardware (if any) ' + sr(0, 1000, false) + '—many regions are fully digital now.';
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
                    el.innerHTML = buildDomesticFeeHtml(id, lang, state.currency);
                });
            }
            window.refreshDomesticFees = refreshDomesticFees;

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

            document.getElementById('btn-overhead-exclude').addEventListener('click', () => {
                state.includeOverhead = false;
                syncOverheadToggleUI();
                updateVisuals();
            });
            document.getElementById('btn-overhead-include').addEventListener('click', () => {
                state.includeOverhead = true;
                syncOverheadToggleUI();
                updateVisuals();
            });
            syncOverheadToggleUI();

            window.addEventListener('china-biz-lang-change', function (e) {
                const lang = e.detail && e.detail.lang;
                if (lang === 'zh') state.currency = 'rmb';
                else if (lang === 'en') state.currency = 'usd';
                syncCurrencyButtons();
                updateFxLabel();
                updateVisuals();
            });

            initCharts();
            updateFxLabel();
            loadExchangeRate();
        });
