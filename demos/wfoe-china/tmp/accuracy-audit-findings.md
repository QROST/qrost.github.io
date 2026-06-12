# WFOE China Demo — Accuracy Audit Findings (Staging)

> **Internal staging document only.** This file tracks factual accuracy issues identified during content review. It is **not published** to the site and should not be linked from public pages. Use it to plan and batch accuracy fixes before updating `index.html`, JSON step data, and i18n strings.

**Audit scope:** Domestic LLC ✓ · WFOE ✓ · Costs/FX ✓ · Site-wide ✓  
**Method:** Full file read + web verification against 2024–2026 rules (新《公司法》、外商投资法/负面清单、注册资本认缴、MOFCOM信息报告、SAFE外汇登记、数电票、一窗通/一网通办、FX/cost bands).

### Master status

| Area | Status | Score | Completed |
|------|--------|-------|-----------|
| Domestic LLC (内资) | ✓ | 3 / 5 | 2026-06-11 |
| WFOE (外资) | ✓ | 3.5 / 5 | 2026-06-11 |
| Costs / FX | ✓ | 3.5 / 5 | 2026-06-11 |
| Site-wide | ✓ | 3.5 / 5 | 2026-06-11 |

### Fixes applied (2026-06-11)

| Area | Files | Summary |
|------|-------|---------|
| Domestic LLC | `domestic-steps.json`, `i18n-china-business.js`, `china-business.js` | d01 登记联络员 + optional 监事; d02 cluster caveats; d04–d05 一窗通并联; d06→`data-domestic-fee` + 数电票/no 发票章; d07 五年认缴; d08 新办纳税人/数电票; d09 optional 社保/公积金; d10 零申报 + VAT 季/月; d04 agent bands widened |
| WFOE | `wfoe-steps.json`, `i18n-china-business.js`, `china-business.js`, `index.html` | Intro + s05 pre-agent negative list; s02 address nuance; s07 Hague/translation; s08/s11 scope + FDI initial report; s10 optional supervisor; s13/s19 数电票; s17 入账登记; s20 housing fund + optional 社保; s05/s17/s19 fee bands |
| Costs / FX | `china-business.js` | Shanghai/Beijing `contribPct` 0.33; donut medical 9%; HK MPF cap HKD 1500/mo; Macau FSS MOP 60/mo flat; removed stale `s16/s19/d06.money` i18n |
| Site-wide | `index.html`, `i18n-china-business.js` | Hainan Dec 2025 negative-list prose; methodology SAR pre-converted RMB; domestic/WFOE intros; cache-bust `?v=20260611acc` |

**Verify:** `node tmp/verify-accuracy.mjs` (Playwright + static server).

---

## Executive Summary (Domestic LLC)

| Metric | Value |
|--------|-------|
| **Reliability score** | **3 / 5** |
| **Verdict** | Usable as planning-oriented research notes (fee bands, overall flow, 5-year capital rule are largely sound), but **not safe as operational/legal checklist** without fixes — especially on post-2024 governance and 一窗通 parallel processing. |

### Top 3 risks

1. **Governance misalignment (high):** Treating 监事 as default in one-shareholder setups conflicts with 2024《公司法》 optional-supervisor / audit-committee rules; founders may over-structure or miss lawful simplifications.

2. **Process model drift (medium):** Linear 10-step flow + “1–3 day” review understates today’s **1-day parallel 一窗通** and optional 社保/公积金 bundling — users may over-plan time and cost.

3. **Post-2025 registration & tax gaps (medium):** Missing **登记联络员** (mandatory since 2025-02-10) and “tax registration” wording vs **多证合一/智能开业 + 数电票** creates wrong expectations about what to do after receiving the license.

---

## 1. WFOE (外资)

**Status:** audit complete (2026-06-11)  
**Files reviewed:** `assets/data/wfoe-steps.json` (s01–s20), `assets/js/china-business.js` (`buildWfoeStepMoneyHtml`, s01–s20), `assets/js/i18n-china-business.js` (WFOE keys), `index.html` WFOE tab intro/notes.

**Note:** No `w01`–`w05` keys in repo; WFOE money strings are keyed **s01–s20** in `buildWfoeStepMoneyHtml()`.

### Executive Summary

| Metric | Value |
|--------|-------|
| **Reliability score** | **3.5 / 5** |
| **Verdict** | Usable 20-step procedural outline for a typical consulting/CAD WFOE; correctly reflects major 2024 reforms (5-year capital pay-in, Hague apostille for member states, bank-mediated SAFE registration). **Not** audit-grade compliance guidance — mandatory/high-risk items omitted or compressed; several lines outdated after Dec 2024 nationwide **数电发票** rollout and 2024 **Company Law** governance changes. |

### Top 3 risks

1. **No negative-list / business-scope / CAD-vs-construction-design licensing caveat (high):** An AEC founder can misread the page as “any CAD WFOE is unrestricted.” Construction engineering design is separately regulated and often requires Sino-foreign cooperative design.

2. **Post-license compliance gaps (medium):** Housing fund unit registration, explicit **货币出资入账登记**, and **外商投资初始信息报告** are missing or buried in the flow.

3. **Outdated or over-broad wording (medium):** Tax “golden-tax device” costs (s19), “residential cannot” address rule (s02), and supervisor framing (s10) do not match 2024–2026 practice.

### Issues

#### [HIGH] No negative-list / business-scope / sector-license check before filing

| Field | Detail |
|-------|--------|
| **Severity** | high |
| **Location** | `wfoe-steps.json` — missing step; nearest `s08`, `s11` |
| **Current claim** | Flow jumps from capital planning to AMR filing without sector access review |
| **Problem** | Under **外商投资准入特别管理措施（负面清单）（2024年版）** (effective 2024-11-01), activities not on the FI negative list are generally open, but **business scope on the license is binding**, and restricted sectors need permits. For AEC audiences, **construction engineering design** is separately regulated and often requires **Sino-foreign cooperative design** with a qualified Chinese design firm — different from general technical/CAD consulting. |
| **Suggested fix** | Add pre-s11 step or s08/s11 bullet: confirm activity against **2024 FI negative list** + **市场准入负面清单**; draft scope with “（须经批准后方可经营）” where needed; flag construction-design vs consulting CAD. |
| **Sources** | [NDRC/MOFCOM Negative List 2024](https://zfxxgk.ndrc.gov.cn/web/iteminfo.jsp?id=20435); [MOHURD Interim Provisions on Foreign Construction Design (2004)](https://www.shanghaiinvest.com/cn/viewfile.php?id=2336) |
| **Confidence** | high |

---

#### [MEDIUM] Supervisor presented as mandatory without 2024 opt-outs

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s10`; `i18n-china-business.js` `s10.title` / `s10.detail` |
| **Current claim** | "Name Legal Rep, Executive Director, and Supervisor—**two roles cannot be the same person**"; "The Supervisor cannot be the Legal Representative or Director." |
| **Problem** | Under **2024 Company Law** Art. 69 & 83, many small single-shareholder WFOEs may **omit the supervisor entirely** (unanimous shareholder consent) or replace supervision with a **board audit committee**. Non-overlap rule is correct *if* a supervisor is appointed, but step reads as always requiring three distinct roles. |
| **Suggested fix** | "Appoint legal representative and director(s). If you retain a supervisor: they cannot also be legal rep or director. Under 2024 Company Law, small LLCs may omit a supervisor by unanimous shareholder consent or use an audit committee instead—confirm local AMR forms." |
| **Sources** | [2024 Company Law Art. 69, 83](https://qisula.com/1403/3767.html); [Shenzhen AMR FAQ](https://amr.sz.gov.cn/zcjzts/content/post_11465758.html) |
| **Confidence** | high |

---

#### [MEDIUM] Title ambiguous: Legal Rep + Director may be same person

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s10` title; `i18n-china-business.js` `s10.title` |
| **Current claim** | "Name Legal Rep, Executive Director, and Supervisor—**two roles cannot be the same person**." |
| **Problem** | For a typical WFOE, **legal representative and sole director are commonly the same person** (2024 Company Law Art. 10). Title can be read as forbidding that combination; detail text is better but title is misleading. |
| **Suggested fix** | Title: "Appoint legal representative, director(s), and (if used) supervisor—**supervisor must be separate from legal rep/director**." |
| **Sources** | [2024 Company Law Art. 10, 75](https://www.szacc.com/index.php/htm/cjfg/gongshangfagui/5353.html) |
| **Confidence** | high |

---

#### [MEDIUM] Residential address rule overstated

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s02`; `i18n-china-business.js` `s02.title` |
| **Current claim** | "Find only commercial office space—**residential units cannot be a WFOE address**." |
| **Problem** | AMR generally requires a **business-usable registered address** with proper lease/ownership proof. Pure residential addresses are usually rejected, but many cities accept **mixed commercial-residential (商住/商办)** properties if ownership certificate/lease permits business registration. Some parks also offer compliant 集中登记地址. |
| **Suggested fix** | "Secure a **business-eligible** registered address (commercial or approved mixed-use); pure residential addresses are usually rejected—verify with AMR before signing." |
| **Sources** | [Beijing certification/registration guidance](https://english.beijing.gov.cn/investinginbeijing/Start_Your_Business/focus_guide/thematic_guide/Certification_Documents/index.html) |
| **Confidence** | medium |

---

#### [MEDIUM] Apostille step lacks Hague / translation / exception caveats

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s07`; `i18n-china-business.js` `s07.detail` |
| **Current claim** | "You no longer need Chinese Embassy legalization for this path—the Apostille is the standard certification." |
| **Problem** | Accurate **only for documents issued in Hague Apostille Convention member states** since China’s accession (in force 2023-11-07). Non-member states still need consular legalization. AMR still expects **certified Chinese translations** of foreign documents. Some identity paths (China permanent residence ID; certain HK/Macao/Taiwan documents) have exceptions. |
| **Suggested fix** | "For Hague-member countries: notarization + apostille replaces PRC embassy legalization. Non-Hague: embassy legalization still required. Provide certified Chinese translations. Confirm local AMR checklist." |
| **Sources** | [PRC gov.cn Apostille guidance](https://english.www.gov.cn/services/visitchina/202408/13/content_WS66bb1869c6d0868f4e8e9e2a.html); [Beijing foreign investment Q&A](https://invest.beijing.gov.cn/sy/zt/qyrx/202307/t20230710_3159308.html) |
| **Confidence** | high |

---

#### [MEDIUM] Missing explicit 外商投资信息报告 (initial report) at establishment

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s11` / `s12` (omitted) |
| **Current claim** | s11 only mentions AMR filing package |
| **Problem** | Since 2020, foreign investors must submit an **initial foreign-investment information report** **when applying for establishment registration** via the enterprise registration system — not a separate MOFCOM approval, but a real compliance step often completed in the same online filing. |
| **Suggested fix** | Add to s11: "During AMR online establishment, complete the **foreign-investment initial information report** (investor, UBO, investment transaction data) in the registration system." |
| **Sources** | [外商投资信息报告办法 Art. 9](https://www.gov.cn/gongbao/content/2020/content_5496775.htm); [MOFCOM Announcement 2019-62](https://www.mofcom.gov.cn/zcfb/zgdwjjmywg/art/2020/art_59bb65ca876a44ee9b26ecb7895205c7.html) |
| **Confidence** | high |

---

#### [MEDIUM] Missing 货币出资入账登记 between wire and FX settlement

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s17`–`s18` |
| **Current claim** | s17: "Bank records paid-in capital (实缴) toward SAFE filing…"; s18 jumps to settlement |
| **Problem** | After inbound capital hits the capital account, the bank must complete **境内直接投资货币出资入账登记** via SAFE’s capital-project IT system before funds can be used (including结汇). Distinct from basic SAFE enterprise information registration in s15. |
| **Suggested fix** | Split or expand s17: "After inbound wire, bank completes **capital contribution receipt registration (货币出资入账登记)**; only then proceed to settlement/operational use." |
| **Sources** | [SAFE capital project guidance 2024](https://www.safe.gov.cn/tianjin/file/file/20240507/646859b89c1444c498fb5b6ac0ab3fdc.pdf); [Chongli law analysis](https://chonglilaw.com/research/info_itemid_748.html) |
| **Confidence** | high |

---

#### [MEDIUM] Step 20 covers social insurance but not housing fund unit registration

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `wfoe-steps.json:s20`; `i18n-china-business.js` `s20.title` |
| **Current claim** | "Register for social insurance—then you can hire and run payroll." |
| **Problem** | Mainland employers must also complete **住房公积金单位缴存登记** (often via 一窗通, but still a distinct obligation). Dashboard models housing fund in employer cost, but setup flow omits it. |
| **Suggested fix** | "Register for **social insurance and housing fund** unit accounts (often via enterprise 一窗通) before hiring." |
| **Sources** | [《住房公积金管理条例》](https://zfgjj.fuzhou.gov.cn/zwgk/gzdt/zyxw/202407/t20240726_4866165.htm); [Henan FDI one-stop guide](https://swj.zhoukou.gov.cn/sitesources/swj/page_pc/ztzl/yhyshj/articlee1ef4dc04aee48778d9bee20c6381f84.html) |
| **Confidence** | high |

---

#### [MEDIUM] International wire fee band likely understated

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` case `s17` |
| **Current claim** | "sender-bank charges … often **¥100–350+**" |
| **Problem** | Outbound international wires from US/EU banks commonly run **USD 15–50+** in sender fees, plus receiving-bank/FX spread; RMB equivalent often exceeds ¥350 for corporate wires. Site notes FX spread separately, but fixed-fee band is optimistic. |
| **Suggested fix** | Widen to **¥200–1,500+** planning equivalent, or phrase as "highly bank-dependent; sender fees + intermediary banks often exceed ¥500." |
| **Sources** | Banking practice; site already acknowledges FX spread |
| **Confidence** | medium |

---

#### [MEDIUM] s19 money still prices legacy tax-control hardware

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` case `s19`; `wfoe-steps.json:s19`; `i18n-china-business.js` `s19.detail` |
| **Current claim** | "fapiao / golden-tax device (if required) **¥0–1,500** one-time"; "Register with the tax bureau and obtain fapiao (official invoicing) capability." |
| **Problem** | After Dec 2024 nationwide **数电发票**, many new entities will not buy golden-tax hardware; cost shifts to platform onboarding / optional service fees. Step wording still framed around legacy hardware. |
| **Suggested fix** | "Complete tax registration and enable **fully digital electronic invoicing (数电发票)** via the electronic tax bureau." Money: "digital invoicing onboarding **¥0–500** (if any); legacy hardware only in rare legacy setups." |
| **Sources** | [SAT Announcement 2024-11](https://www.gov.cn/zhengce/zhengceku/202411/content_6989164.htm) |
| **Confidence** | high |

---

#### [MEDIUM] Intro does not warn on sector access / CAD licensing

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `index.html:124-126` (`process.mainland_intro`); `i18n-china-business.js` |
| **Current claim** | Generic WFOE intro for international investors |
| **Problem** | Page is AEC/CAD-oriented but intro lacks the highest-risk caveat (business scope + construction-design rules). |
| **Suggested fix** | One sentence in intro: "Confirm your planned CAD/design activity fits your registered scope and is not a permit-restricted construction-design category." |
| **Sources** | See high-severity negative-list issue |
| **Confidence** | high |

---

#### [LOW] Tax step still framed around legacy fapiao hardware (step text)

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `wfoe-steps.json:s19` detail (wording only; fee band covered above) |
| **Current claim** | "Register with the tax bureau and obtain fapiao (official invoicing) capability." |
| **Problem** | Outcome correct, but post-2024-12-01 nationwide rollout, new taxpayers generally need **digital tax bureau onboarding**, not physical 金税盘/UKey procurement. |
| **Suggested fix** | Same as s19 medium fix above |
| **Sources** | [SAT Announcement 2024-11](https://www.gov.cn/zhengce/zhengceku/202411/content_6989164.htm) |
| **Confidence** | high |

---

#### [LOW] Basic account “only account for cash salaries” is narrow / potentially misleading

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `wfoe-steps.json:s14` |
| **Current claim** | "Main RMB account for salaries, rent, and tax—**often the only account that can pay cash salaries**." |
| **Problem** | Under **《人民币银行结算账户管理办法》** Art. 33, basic account is the account for **cash withdrawal** for wages/bonuses. Payroll is usually **bank transfer**, not cash; line is technically defensible but may mislead founders about payroll mechanics. |
| **Suggested fix** | "Primary operating RMB account; statutory channel for wage/bonus **cash withdrawals**; payroll is normally transferred electronically from this account." |
| **Sources** | [PBC 人民币银行结算账户管理办法](http://www.pbc.gov.cn/zhifujiesuansi/128525/128527/2829017/index.html) |
| **Confidence** | high |

---

#### [LOW] Agency-fee bands are illustrative, tier-1 low end may be tight

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` case `s05` (`¥10,000–35,000` standard; `¥3,500–10,500` lean) |
| **Current claim** | As above |
| **Problem** | Wide city/agent variance; not falsifiable, but low-end lean package may be tight in tier-1 cities in 2025–2026. (See also §3 Costs/FX for government-fee and full-service ceiling gaps.) |
| **Suggested fix** | Keep ranges but add "tier-1 cities often higher." |
| **Sources** | Market quotes only |
| **Confidence** | low |

---

#### [LOW] Stale unused i18n money keys with hardcoded USD

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `i18n-china-business.js` — `s16.money`, `s19.money` |
| **Current claim** | e.g. `s16.money`: "约 **$50–200**/小时"; `s19.money` hardcoded ¥ bands |
| **Problem** | Live money text is generated by `buildWfoeStepMoneyHtml()` via `data-wfoe-money`; these i18n keys appear **orphaned** and inconsistent with dynamic RMB-first rendering. |
| **Suggested fix** | Remove dead keys or wire them into renderer to avoid future drift. |
| **Sources** | `steps-render.js` uses `data-wfoe-money`, not `sXX.money` i18n keys |
| **Confidence** | high |

---

#### [LOW] “Hosting cost” wording is non-standard

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `index.html:124-126` — `process.mainland_intro` |
| **Current claim** | "Budget **registered capital** (steps 8–9) and **hosting cost** before you file." |
| **Problem** | In incorporation context, readers expect **operating costs / run-rate**, not web-hosting or address-hosting jargon. |
| **Suggested fix** | "**operating costs**" or "**onshore run-rate**." |
| **Sources** | Editorial |
| **Confidence** | high |

---

### Verified as broadly accurate (no issue filed)

| Item | Verdict |
|------|---------|
| **s01** — Chinese name structure pattern; final approval at registration | Correct |
| **s05** — Agent not legally mandatory; practical for foreign founders | Correct |
| **s07** — Hague apostille path for typical US/UK/EU investors | Correct (with caveats on non-Hague / translation) |
| **s08** — 5-year subscribed capital pay-in under 2024 Company Law Art. 47 | Correct for new LLCs |
| **s08** money — `¥0` incremental at planning stage | Correct framing |
| **s13** — PSB filing via licensed seal vendor | Reflects current备案 practice |
| **s15** — Capital account paired with SAFE FDI basic information registration at bank | Directionally correct |
| **s04** deposit + first-month illustrative band | Reasonable planning band |
| **FX note** (`s05.fee_fx_note`) — RMB-first + 7.2 fallback | Internally consistent with methodology |
| **`process.mainland_intro`** — WFOE as vehicle for foreign individuals/parent companies | Correct |
| **`method.timestamp_body`** — 2024 Company Law reference | Appropriate |
| **Fee-note disclaimer** (`process.fee_note`) — illustrative ranges, RMB-first, not quotes | Appropriate |
| **Methodology timestamps** — 2024 Q4 data / 2026-04 review | Internally consistent |

### Category roll-up

| Category | Status |
|----------|--------|
| `wfoe-steps.json` | **8 issues** (1 high, 6 medium, 1 low) + partial VERIFIED OK |
| `buildWfoeStepMoneyHtml` (s01–s20) | **2 medium, 1 low** + VERIFIED OK |
| `i18n-china-business.js` | **Mirrored medium issues + 1 low stale keys** + VERIFIED OK |
| `index.html` WFOE intro/notes | **1 medium, 1 low** + VERIFIED OK |

### Recommended fix priority

1. **Pre-filing** — negative list + business scope + CAD vs construction-design licensing (new step or s08/s11 bullets)
2. **s02 / s07 / s10** — address eligibility, apostille caveats, supervisor optional framing + title clarity
3. **s11 / s17 / s20** — FI initial report, 货币出资入账登记, housing fund
4. **s19 + s17 fees** — 数电发票 wording; widen wire-fee band
5. **Intro + i18n cleanup** — sector caveat in intro; remove stale `s16.money` / `s19.money`

---

## 2. Domestic LLC (内资)

**Status:** audit complete (2026-06-11)  
**Files reviewed:** `assets/data/domestic-steps.json` (d01–d10), `assets/js/china-business.js` (`buildDomesticFeeHtml`), `assets/js/i18n-china-business.js`, `index.html` domestic tab intro/notes.

### Issues

#### [HIGH] Supervisor framed as mandatory in one-shareholder layout

| Field | Detail |
|-------|--------|
| **Severity** | high |
| **Location** | `domestic-steps.json:8` (d01 detail); `i18n-china-business.js` keys `d01.detail` / `d01.title` |
| **Current claim** | "Director and supervisor cannot be the same person in the standard one-shareholder layout"; title lists 监事 as a core prep item alongside shareholders/法定代表人 |
| **Problem** | 2024《公司法》第83条：规模较小或股东人数较少的有限责任公司，经全体股东一致同意，**可以不设监事**；也可设审计委员会替代监事会。将“标准一人公司结构=必有监事”会误导创始人额外挂名监事，或忽略“不设监事”的合法路径。 |
| **Suggested fix** | Rewrite as: “若设监事，董事/高管不得兼任监事；经全体股东一致同意可不设监事或改设董事会审计委员会（2024《公司法》第69、83条）。” Title: 监事改为“（如设）”。 |
| **Sources** | [《公司法》2024](https://www.gov.cn/zhengce/content/202407/content_6960376.htm); [衡阳市场监管局新法热点解答](https://www.hengyang.gov.cn/amr/xxgk/zcwjjjd/20240715/i3415577.html) |
| **Confidence** | high |

---

#### [MEDIUM] AMR review timeline understated vs current 1-day 一窗通 norm

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:60` (d05 detail); `i18n-china-business.js` `d05.detail` |
| **Current claim** | "Typical review windows are roughly **1–3 working days** when materials are complete" |
| **Problem** | 多数省市已将企业开办（含设立登记）压缩至 **1个工作日**（上海、深圳、浙江、重庆等）；材料齐全时常见 **当日/0.5–1日** 办结。写“1–3日”在2024–2026语境偏保守，易低估实际速度。 |
| **Suggested fix** | “材料齐全时，多数城市 **1个工作日内**（部分 **当日**）办结；名称/经营范围补正或前置许可除外。” |
| **Sources** | [上海企业开办条例](https://fgw.sh.gov.cn/ys-sczr-3.1/); [深圳一窗通办事指南 PDF](https://amr.sz.gov.cn/attachment/1/1709/1709661/12672791.pdf); [浙江企业开办1日](http://www.news.cn/2023-08/15/c_1129804773.htm) |
| **Confidence** | high |

---

#### [MEDIUM] Linear 10-step flow misrepresents parallel 一窗通 bundling

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `index.html:140-142` (`process.domestic_intro`); step order d05→d06→d08→d09 |
| **Current claim** | Sequential steps 5–9 imply separate post-license phases for seals, tax, social insurance, housing fund |
| **Problem** | 现行“开办企业一窗通/一件事”将 **设立登记、刻章、发票/数电票、社保登记、公积金开户、银行预约** 并联办理；刻章/税务/社保/公积金可在 **同一次网上申请** 中勾选完成，并非必须等执照后再逐步办。 |
| **Suggested fix** | Intro 增加：“步骤5–9在多数城市可 **一窗并联** 或分时补办，下列顺序为逻辑拆分而非强制时序。” d04/d05 detail 注明并联选项。 |
| **Sources** | [深圳市场监管局 FAQ](https://amr.sz.gov.cn/xxgk/qt/ztlm/qykb/cjwt/content/post_12001550.html); [企业开办一件事规范（1日）](http://www.jzs.gov.cn/columns/c3359349-8741-4a34-ab1b-def5f70c58fb/202312/13/8a0aa7ed-4dfd-41fe-95a6-821925cbb7f8.html) |
| **Confidence** | high |

---

#### [MEDIUM] Social insurance / housing fund presented as required setup step

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:110-118` (d09); `i18n-china-business.js` `d09.title` |
| **Current claim** | Step 9: "Register for social insurance and housing fund accounts so you can hire and run payroll compliantly" |
| **Problem** | 在一窗通中 **社保/公积金为可选**（选“否”可后续分时办理）。无员工前通常 **无强制立即开户** 要求；表述易被理解为设立后必办项。 |
| **Suggested fix** | “**用工前**须完成单位社保/公积金登记；开办时可一窗通 **可选** 同步办理，也可后续分时办。” |
| **Sources** | [深圳一窗通 FAQ（社保/公积金可选）](https://amr.sz.gov.cn/xxgk/qt/ztlm/qykb/cjwt/content/post_12001550.html) |
| **Confidence** | high |

---

#### [MEDIUM] Missing mandatory 登记联络员 (registration liaison officer)

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | d01/d04 (absent); `index.html` domestic intro |
| **Current claim** | d01 lists shareholders, legal rep, supervisor, optional finance contact — no 登记联络员 |
| **Problem** | 《公司登记管理实施办法》（2025-02-10施行）第14条：**设立登记时必须备案登记联络员**（电话、邮箱），负责与登记机关联络；2022年起亦为市场主体登记备案事项。 |
| **Suggested fix** | d01 增加：“指定 **登记联络员** 并备案联系方式（可与法定代表人/员工兼任）。” |
| **Sources** | [公司登记管理实施办法 第14条](https://www.gov.cn/gongbao/2025/issue_11826/202501/content_7001287.html); [法治日报解读](http://www.legaldaily.com.cn/Village_ruled_by_law/content/2025-02/19/content_9132768.html) |
| **Confidence** | high |

---

#### [MEDIUM] “Tax registration” step outdated under 多证合一 / 智能开业

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:97-101` (d08); `buildDomesticFeeHtml` d08; `i18n-china-business.js` `d08.title` |
| **Current claim** | "Complete **tax registration** and enable **digital invoices** (数电票)" |
| **Problem** | 新办企业领取 unified social credit code 营业执照后 **无需单独领取税务登记证**（多证合一）；多数城市市监数据共享至税务，自动赋码/开通电子税务局，企业仅需 **信息确认/新办纳税人开业/数电票核定**。单独“税务登记”用语易误导用户寻找已取消的办证环节。 |
| **Suggested fix** | “完成 **新办纳税人信息确认**（多证合一后自动赋码）并开通 **数电票**；部分城市‘智能开业’可自动完成税费种认定与票种核定。” |
| **Sources** | [广东税务局新办企业指引](https://guangdong.chinatax.gov.cn/gdsw/jmsw_tzgg/2019-11/01/content_a6d8af21a3e940938e338818a338586d.shtml); [上海智能开业](http://shanghai.chinatax.gov.cn/tax/xwdt/ztzl/zhl/yhysgj/nszb/yhggfw/szh/202309/t468659.html) |
| **Confidence** | high |

---

#### [MEDIUM] Invoice seal still listed as standard carve item post-数电票 nationwide rollout

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:70` (d06 title); `i18n-china-business.js` `d06.title` / `d06.money` |
| **Current claim** | "公章, 财务章, 法人章, **发票章** as needed"; free-seal bundles in many cities include 发票专用章 |
| **Problem** | 自 **2024-12-01** 全国推广全面数字化电子发票（国家税务总局2024年第11号公告），数电票含数字签名，**无需加盖发票专用章**即可入账。仍默认刻发票章可能产生不必要成本；免费刻章政策也在部分城市 **缩减为1枚公章**（如珠海高新区2025起）。 |
| **Suggested fix** | d06: “公章、财务章、法人章（**数电票场景通常不需发票专用章**；若仍用纸质/legacy setup 或银行要求再刻）。” 注明免费政策 **因城而异、枚数不一**。 |
| **Sources** | [国家税务总局公告2024年第11号](http://baike.taxrefund.com.cn/html/fg/2024/11/20241125092033-44411.html); [珠海高新区2025免费章调整](https://www.zhuhai-hitech.gov.cn/xxgkml/content/post_3753193.html) |
| **Confidence** | high |

---

#### [MEDIUM] d10 VAT filing frequency oversimplified

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:123` (d10 title); `i18n-china-business.js` `d10.title` |
| **Current claim** | "monthly/quarterly VAT, annual CIT prep, payroll withholding" |
| **Problem** | **小规模纳税人**增值税原则上 **按季申报**（非默认按月）；一般纳税人通常按月。未区分纳税人类型会误导小规模企业做月度 VAT 预算。 |
| **Suggested fix** | “增值税：**小规模纳税人通常按季**；一般纳税人通常按月。企业所得税预缴、代扣代缴个税、附加税费等按核定周期申报。” |
| **Sources** | [江苏税务局小规模申报指引](https://jiangsu.chinatax.gov.cn/art/2025/12/31/art_16717_362477.html) |
| **Confidence** | high |

---

#### [MEDIUM] d10 omits zero-filing obligation for idle new companies

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:125-126` (d10 detail) |
| **Current claim** | Focuses on penalties for missing deadlines before first paying client; no mention of **零申报** |
| **Problem** | 领照后即使 **无经营、无收入**，也须按期纳税申报（零申报），否则可能被列入异常名录/产生滞纳金。这是内资设立后最常见合规坑。 |
| **Suggested fix** | Detail 增加：“无收入期间仍须 **按期零申报**（增值税、企业所得税预缴、个税等按核定税种）。” |
| **Sources** | [税务登记管理办法 第8条](https://www.chinatax.gov.cn/chinatax/n810214/n810641/c102061/c102062/c5171615/content.html); [新办企业30日内税务信息确认](https://guangdong.chinatax.gov.cn/gdsw/stsw_xdjczzy_zhbll/2024-04/29/content_2aec6c8644094e398089934ae71fd1ef.shtml) |
| **Confidence** | high |

---

#### [MEDIUM] Cluster / park address lacks regulatory caveats

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json:18` (d02); `i18n-china-business.js` `d02.title` |
| **Current claim** | "government/business-park cluster address" presented as generic option |
| **Problem** | 集中登记地/集群注册 **有行业限制**（金融、劳务派遣、危化等常禁入）、**总量控制**、**有效期**（如上海杨浦3年）、异常监测与清退机制；并非所有行业/城市均可使用。 |
| **Suggested fix** | 补充：“集中登记地址 **因区而异**；许可类/高风险行业可能不可用；注意住所标注（集中登记地）及期限。” |
| **Sources** | [上海青浦集中登记地措施](https://www.shqp.gov.cn/cindu/sczwgk/ml/yw/20241119/1218318.html); [上海杨浦集中登记地管理办法](https://xyd.shyp.gov.cn/policy-detail/855) |
| **Confidence** | high |

---

#### [MEDIUM] Agent fee band may understate tier-1 full-service packages

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js:791` (`buildDomesticFeeHtml` d04 EN); `:765` (ZH) |
| **Current claim** | "full 'setup + bank + first-year books' often **¥3,000–10,000+**"; lean **¥800–3,000** |
| **Problem** | 一线城市“设立+银行+首年代账”全包常见 **¥5,000–15,000+**（含地址/加急/许可行业更高）；¥800–3,000 lean 区间对 **仅递交** 尚可，但全包下限偏低，尤其对北上广深。 |
| **Suggested fix** | d04 全包改为 **¥3,000–15,000+**（注明城市/是否含地址/记账）；lean **¥500–3,000**。 |
| **Sources** | [上海代办市场区间](https://www.zhongqijt.com/ask/how-much-shanghai-company-registration-cost.html); [2025代理费用对比](https://www.jinpucn.com/zhucebk/7029.html) |
| **Confidence** | medium |

---

#### [LOW] Uses deprecated “executive director” framing

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `domestic-steps.json:8`; `i18n-china-business.js` `d01.detail` (“执行董事”) |
| **Current claim** | "Director and supervisor cannot be the same person" / “执行董事与监事不得为同一人” |
| **Problem** | 2024《公司法》取消“执行董事”称谓，不设董事会时设 **一名董事**（可兼任经理）。portals 可能仍显示旧字段，但法律术语已更新。 |
| **Suggested fix** | 改为“**董事**（不设董事会时为唯一董事）与监事不得为同一人”。 |
| **Sources** | [衡阳市场监管局 FAQ #39/#41](https://www.hengyang.gov.cn/amr/xxgk/zcwjjjd/20240715/i3415577.html) |
| **Confidence** | high |

---

#### [LOW] d01 “finance contact” may confuse with tax roles

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `domestic-steps.json:6`; `i18n-china-business.js` `d01.title` |
| **Current claim** | "(where required) **finance contact**" |
| **Problem** | **财务负责人**非法定登记事项（由董事会聘任）；税务侧常见角色为 **办税员/开票员**。“finance contact” 无明确法律依据，易与 **登记联络员** 或 **财务负责人** 混淆。 |
| **Suggested fix** | 删除或改为：“指定 **财务负责人/会计人员**（内部岗位，非必登记）及 **办税员**（开票/申报）。” |
| **Sources** | [公司登记管理实施办法](https://www.gov.cn/gongbao/2025/issue_11826/202501/content_7001287.html) |
| **Confidence** | medium |

---

#### [LOW] Capital injection from personal accounts lacks procedure caveat

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `domestic-steps.json:87`; `i18n-china-business.js` `d07.detail` |
| **Current claim** | "Shareholder capital can be wired from personal accounts per subscribed amounts" |
| **Problem** | 表述正确但 **不完整**：应通过 **股东出资** 入账、取得 **出资证明/验资（如行业要求）**、在 **5年认缴期内** 按章程缴纳；个人转账若未规范记账可能被认定为借款而非实缴。 |
| **Suggested fix** | 增加：“按章程期限 **实缴/认缴** 入账，保留银行回单与会计凭证；5年内须缴足（2024《公司法》第47条）。” |
| **Sources** | [注册资本登记管理规定](https://www.gov.cn/zhengce/content/202407/content_6960376.htm) |
| **Confidence** | high |

---

#### [LOW] Domestic intro narrows eligible founders to “Chinese citizen”

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `index.html:140-141`; `i18n-china-business.js` `process.domestic_intro` |
| **Current claim** | "For a **Chinese citizen** (or all-domestic shareholders)" |
| **Problem** | 内资有限责任公司股东可为 **境内企业法人**、合伙企业等（不仅自然人）；港澳台居民在内地的投资另有 **专项规定**，并非简单归入本 tab。Intro 略窄但不致命。 |
| **Suggested fix** | “**境内股东**（自然人或境内企业/组织）……” 并 footnote 港澳台居民特殊规则。 |
| **Sources** | [深圳市监局一人公司 FAQ](https://amr.sz.gov.cn/zcjzts/ssdj/content/post_11458245.html) |
| **Confidence** | medium |

---

#### [LOW] d08 legacy tax hardware fee band increasingly obsolete

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js:799` (d08 EN); `:773` (ZH) |
| **Current claim** | "legacy hardware (if any) **¥0–1,000**" |
| **Problem** | 数电票全面推广后，**税控盘/UKey/金税盘** 新设企业大多 **不再采购**；保留区间合理作 legacy caveat，但上限与场景已快速收缩。 |
| **Suggested fix** | 改为 “legacy 税控设备（如仍被银行/客户要求）**¥0–500**；新设企业多数 **¥0**。” |
| **Sources** | [国家税务总局2024年第11号公告](http://baike.taxrefund.com.cn/html/fg/2024/11/20241125092033-44411.html) |
| **Confidence** | medium |

---

### Verified as broadly accurate (no issue filed)

| Item | Verdict |
|------|---------|
| d03 认缴 + **5年内缴足** + 存量过渡 | Correct (2024《公司法》第47条 + 国务院注册资本登记管理规定) |
| d03/d04 认缴制设立日 **不强制实缴** | Correct |
| d04/d05 政府规费 **¥0–500** / 执照工本 **¥0** | Plausible for many regions |
| d06 刻章 **¥300–1,200** if not free | Reasonable (东莞政府采购价约130–180/套4枚) |
| d07 基本户开户费 **¥0** + U盾 **¥0–500** | Reasonable |
| d10 代理记账 **¥200–800/月** 小微 | Market-aligned for 小规模 |
| d02 名称查询 **¥0**; 地址 **¥0–2万+** | Planning band OK |
| 无需外资资本金专户 | Correct |
| 2024 Q4 / 2026-04 review stamp in hero/methodology | Consistent with page metadata |

### Recommended fix priority

1. **d01** — 监事可选 + 登记联络员 + 术语更新（执行董事→董事）
2. **d05 / d08–d09** — 并联/可选/术语（一窗通、多证合一、数电票）
3. **Intro** — 逻辑步骤 vs 法定时序说明
4. **Fee bands** — d04 agent costs, d08 legacy hardware (lower priority)

---

## 3. Costs / FX

**Status:** audit complete (2026-06-11; costs/FX pass finalized)  
**Files reviewed:** `assets/js/china-business.js` (`makeStepMoneyFormatters`, `buildWfoeStepMoneyHtml`, `buildDomesticFeeHtml`, **`buildJvStepMoneyHtml`**, `refreshJvMoney`, `effectiveExchangeRate`, `getCostData`, `convert`, dashboard `cityData`), `assets/js/i18n-china-business.js` (fee notes, stale `*.money` keys), `assets/data/domestic-steps.json` (d06), `assets/data/wfoe-steps.json`, `assets/data/joint-venture-steps.json`, `index.html` (`#costs`, `process.fee_note*`, methodology), `assets/js/steps-render.js`.

### Executive Summary

| Metric | Value |
|--------|-------|
| **Reliability score** | **3 / 5** |
| **Verdict** | Suitable as a **planning-order-of-magnitude** tool, not for quotes or budgets. FX logic (RMB-first, live ÷ rate, 7.2 fallback ≈ 2024 avg) and rent/salary bands align with 2024–2025 sources; **JV cost column is now implemented** (`buildJvStepMoneyHtml`). Main gaps: **mainland `contribPct` / donut slices** overstate employer load, **HK MPF cap** not modeled, WFOE/JV **government + full-service agency ceilings** low for tier-1, domestic **d06** lacks EN dual-currency, stale i18n `*.money` keys, ZH fee-note copy drifts from render behavior. |

**What holds up well**

- **RMB-first → USD = RMB ÷ rate** is implemented consistently in `makeStepMoneyFormatters`, `convert()`, and dashboard charts.
- **7.2 fallback** matches 2024 USD/CNY annual averages (~7.18–7.20; World Bank 7.20).
- **Dashboard office rent** back-calculates cleanly to published Grade A bands (Beijing **252/m²/mo** ≈ Knight Frank Q4 2024 **251.7**; Shanghai **200** ≈ Cushman **201.4**).
- **Domestic LLC** agent/seal/bookkeeping bands are broadly in line with 2024–2025 market chatter.

**Main weaknesses**

- WFOE **government filing** and **full-service agency** ceilings look **low** vs tier-1 CPA quotes.
- **Currency display** is inconsistent on domestic step **d06** (static i18n, no USD in EN).
- **Stale i18n** `*.money` keys (`s16`, `s19`, `d06`) contradict live JS builders.
- **Dashboard employer contributions** use flat **38%** (Shanghai/Beijing) vs ~**32–34%** statutory stacks; donut hardcodes **10% medical** vs Shanghai **9%**.
- **HK MPF** modeled as uncapped **5%** — overstates senior SAR employer statutory (~30% on senior band).
- Methodology claims **HKD/MOP conversion** but SAR figures are **pre-baked RMB** with no FX code.

### FX & Currency Logic Verdict

| Rule | Status |
|------|--------|
| RMB anchor | ✅ |
| USD = RMB ÷ rate (not multiply) | ✅ |
| 7.2 fallback ≈ 2024 avg | ✅ |
| Live fetch + sanity bounds (5–12) | ✅ |
| ZH process fees RMB-only | ✅ (except dead i18n) |
| EN process fees dual display | ✅ (except d06) |
| Lang switch auto currency (zh→RMB, en→USD) | ✅ |
| Dashboard totals = sum of converted parts | ✅ |

### Internal Consistency Cross-Check

| Service | WFOE step | Domestic step | Verdict |
|--------|-----------|---------------|---------|
| Seal carving | s13 **¥400–2,000** | d06 **¥300–1,200** | OK (WFOE slightly higher; more seal types) |
| Tax / fapiao hardware | s19 **¥0–1,500** | d08 **¥0–1,000** | OK (digital invoicing; ranges overlap) |
| Agency setup | s05 **¥10k–35k** std | d04 **¥800–3k** lean / **¥3k–10k** full | WFOE std floor may be low tier-1; JV jv06 **¥18k–55k** > WFOE (OK) |
| Bookkeeping | — | d10 **¥200–800/mo** | Low–medium vs some tier-1 **¥1,600+/mo** packages |
| FX rule | Live ÷ 7.2 fallback | Same | Consistent |

### Dashboard Spot Checks (Shanghai, junior, no overhead)

- Base **¥118,000** + contrib **38%** = **¥162,840/yr** (~**$22,617** @ 7.2) — plausible for CAD junior band in 2024–2025 surveys.
- With overhead: **+¥81,400** → **¥244,240/yr** (~**$33,922**) — rent component aligns with Grade A market indices.

### Issues

#### [MEDIUM] WFOE AMR government charges band too low for tier-1

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` s05 |
| **Current claim** | AMR government charges **¥0–800** on top of agency fees |
| **Problem** | Tier-1 WFOE filings commonly show **¥1,500–2,500+** official/disbursement lines separate from agency service fees (e.g. Kaizen Shanghai/Beijing quotations). **¥0–800** understates tier-1 planning buffers. |
| **Suggested fix** | Widen to **¥0–2,500** (or split "license filing" vs "MOFCOM/FDI-related disbursements") and note city/scope variance. |
| **Sources** | [Kaizen Shanghai WFOE](https://en.kaizencpa.cn/services/Setting-up-a-Consulting-WFOE-in-Shanghai.html); [Kaizen Beijing branch quote](https://kaizencpa.us/services/Setting-up-a-Branch-Office-of-WFOE-in-Beijing-Frocedures-and-Fees.html) |
| **Confidence** | high |

---

#### [MEDIUM] WFOE full-service agency ceiling not an upper bound

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` s05 |
| **Current claim** | Full-service WFOE (bank + books) **>¥35,000** (`pgt(35000)`) |
| **Problem** | Standard tier-1 consulting WFOE agency alone is often **¥15,000–16,000**; **international end-to-end** packages (FDI account, remote banking, compliance) frequently land **US$6k–14k+** (~**¥43k–100k+**). **>¥35k** is a reasonable floor but **not an upper bound** for tier-1 full-service. |
| **Suggested fix** | Use **¥35,000–80,000+** band or label **>¥35k** as "local full-service floor; international bundles higher." |
| **Sources** | [Kaizen Beijing service WFOE ¥15k](https://www.kaizencpa.com/Services/info/id/321.html); [FDI China 2025 cost breakdown](https://fdichina.com/blog/china-business-registration-cost-2025/) |
| **Confidence** | medium–high |

---

#### [LOW–MEDIUM] WFOE lean filing band low for tier-1

| Field | Detail |
|-------|--------|
| **Severity** | low–medium |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` s05 |
| **Current claim** | Lean filing **¥3,500–10,500** |
| **Problem** | Plausible for **tier-2 / minimal-scope** agents; **tier-1 WFOE** with translation/legalisation support often starts **~¥10,000–16,000** service-only. Low end may mislead Shanghai/Beijing planners. |
| **Suggested fix** | Split by city tier or raise lean band to **¥5,000–16,000** for tier-1 footnotes. |
| **Sources** | Kaizen Shanghai **¥16,000** service fee (link above) |
| **Confidence** | medium |

---

#### [LOW] Overseas notary/apostille pack high end low for complex stacks

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` s06–s07 |
| **Current claim** | Overseas notary pack **¥70–1,050**; apostille **¥70–350**/doc + authority **¥35–210** |
| **Problem** | Ranges track **US state apostille/notary fees** (~$1–40/doc) when divided by ~7.2 — good for **government lines only**. A full **US parent-company stack** (multiple notarized corp docs + apostilles + courier) often totals **$75–250/doc** all-in per industry guides — **high end of pack range is low** for complex stacks. |
| **Suggested fix** | Add footnote: "state fees only; bundled agent/courier stacks higher" or widen pack to **¥70–3,500+**. |
| **Sources** | [Apostille cost breakdown 2025](https://apostillebirthcertificates.com/apostille-service-cost-breakdown/); [Apostille by state fees](https://apostilledepot.com/apostille-by-state/) |
| **Confidence** | medium |

---

#### [LOW] WFOE tier-1 office cash band lacks tier-2 guidance

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` `buildWfoeStepMoneyHtml` s04 vs dashboard rent |
| **Current claim** | Tier-1 small office cash **¥30,000–250,000+** (deposit + first month) |
| **Problem** | At Shanghai modeled **¥200/m²/mo × ~50 m²**, 2-month deposit + 1 month ≈ **¥30k** — **low end is tight but coherent**. **¥250k+** is plausible for larger CBD units. Range is **tier-1-specific** while text doesn't steer tier-2 readers (where **¥10k–80k** may be typical). |
| **Suggested fix** | Label explicitly "tier-1 illustrative"; add tier-2 sub-band or link to dashboard rent. |
| **Sources** | Internal rent model + [JLL/Cushman Shanghai 2024](https://www.mingtiandi.com/real-estate/research-policy/shanghai-office-rents-slide-for-12th-straight-quarter/) |
| **Confidence** | medium |

---

#### [LOW] Domestic bank opening / U-key band may understate tier-1

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` `buildDomesticFeeHtml` d07 |
| **Current claim** | Bank opening **¥0**; U-key/tools **¥0–500** |
| **Problem** | Tier-1 guides often cite **¥800–1,500** basic-account opening (plus annual account fees). **¥0–500** tools band may **understate** Shenzhen/Shanghai out-of-pocket. |
| **Suggested fix** | Widen to **¥0–1,500** opening-related or split "opening fee" vs "annual account maintenance." |
| **Sources** | [深圳注册公司成本拆解 2024](https://digi.shenchuang.com/2024/0603/1659754.shtml) |
| **Confidence** | medium |

---

#### [MEDIUM] d06 missing dual-currency display in English

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `domestic-steps.json` d06; `i18n-china-business.js` `d06.money`; `steps-render.js` L74–81 |
| **Current claim** | `process.fee_note_domestic` / EN intro: each domestic line shows **¥… (≈ $…)** in English |
| **Problem** | **d06** uses static **`i18n` money** (`kind: "i18n"`), **not** `data-domestic-fee` → **no `makeStepMoneyFormatters` dual display**. EN users see **¥300–1,200 only**; other domestic steps show USD parentheses. |
| **Suggested fix** | Switch d06 to `kind: "data-domestic-fee", key: "d06"` (already implemented in `buildDomesticFeeHtml`). |
| **Sources** | Code: `steps-render.js` L74–81, `domestic-steps.json` L75–79 |
| **Confidence** | high |

---

#### [LOW] Stale i18n `*.money` keys contradict live JS builders

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `i18n-china-business.js` keys `s16.money`, `s19.money`, `d06.money` |
| **Current claim** | e.g. `s16.money`: Chinese text with **$50–200/hr**; `s19.money` static ¥ bands |
| **Problem** | WFOE steps use **`data-wfoe-money` + `buildWfoeStepMoneyHtml`** (dynamic **¥350–1,400/hr** for s16). Stale keys are **dead code** but violate **RMB-only ZH** policy (`s16` shows USD in Chinese) and risk reintroduction if renderer changes. |
| **Suggested fix** | Remove stale `*.money` i18n entries or sync to JS builder values. |
| **Sources** | `wfoe-steps.json` `money_key`; `china-business.js` L676 vs `i18n-china-business.js` L266 |
| **Confidence** | high |

---

#### [LOW] EN WFOE fee note vs ZH RMB-only behavior (maintainer clarity)

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `index.html` WFOE `process.fee_note`; `makeStepMoneyFormatters` |
| **Current claim** | EN WFOE note: all amounts RMB-first, USD derived |
| **Problem** | **Accurate for EN**. ZH UI is **RMB-only** per `makeStepMoneyFormatters(lang !== 'zh')` — correct, but EN note is injected into ZH via i18n with slightly different wording. No user-facing bug; maintainers may think ZH shows USD. |
| **Suggested fix** | None required; optional doc comment in `makeStepMoneyFormatters`. |
| **Sources** | `china-business.js` L591–593, `i18n-china-business.js` L31 |
| **Confidence** | high |

---

#### [LOW] Overhead software constant ~21% above own list-price derivation

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` `OVERHEAD_SOFTWARE_ANNUAL_RMB = 36000`; `index.html` methodology |
| **Current claim** | ~**¥36k/yr** seat for AEC Collection + Rhino amortization |
| **Problem** | Bottom-up from stated list (**~$3,795 + $995/3 yr**) × 7.2 ≈ **¥29.7k** — model is **~21% above** own methodology text. Directionally conservative, not wrong. |
| **Suggested fix** | Align constant to **~¥30k** or document buffer for maintenance/regional pricing. |
| **Sources** | `index.html` L596–599; internal calc |
| **Confidence** | high |

---

#### [LOW] Methodology overspecifies HKD/MOP conversion

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `index.html` methodology; `china-business.js` `cityData` SAR |
| **Current claim** | "HKD and MOP are converted to RMB equivalents for charting continuity." |
| **Problem** | **No HKD/MOP FX logic** in JS; SAR salaries/rent are **static RMB numbers**. Disclosure overspecifies implementation. |
| **Suggested fix** | Reword to "SAR figures stored as pre-converted RMB planning equivalents (reviewed Q4 2024)." |
| **Sources** | `china-business.js` L144–145; grep shows no HKD/MOP handling |
| **Confidence** | high |

---

#### [MEDIUM] Mainland `contribPct` (38%) overstates Shanghai/Beijing employer statutory load

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js:129-130` (`contribPct: 0.38`); `getCostData` L215; donut `mPct = 0.10` L423-424 |
| **Current claim** | Shanghai/Beijing employer load **38%** of base; donut medical slice **10%** |
| **Problem** | Shanghai 2025 employer stack: pension **16%** + medical **9%** + unemployment **0.5%** + injury **~0.2–1.9%** + housing fund **5–7%** ⇒ **~31–34%**, not 38%. Donut still labels **10%** medical vs **9%** live rate. Inflates annual employment cost **~10–15%** vs current rules. |
| **Suggested fix** | Recalibrate per-city `contribPct`; update donut `mPct` to **0.09** (or city-specific); footnote supplementary 公积金 if keeping upper-bound planning. |
| **Sources** | [上海五险一金 2025](https://sh.bendibao.com/zffw/2025213/294609.shtm); [PwC China social rates](https://taxsummaries.pwc.com/peoples-republic-of-china/individual/other-taxes) |
| **Confidence** | high |

---

#### [MEDIUM] ZH `process.fee_note*` strings misstate USD display (maintainer + UX clarity)

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `i18n-china-business.js:30-31` (`process.fee_note`, `process.fee_note_domestic`) |
| **Current claim** | ZH: “切换 English 后同栏会显示人民币与美元对照” |
| **Problem** | `makeStepMoneyFormatters`: **`dual = lang !== 'zh'`** — Chinese UI is **RMB-only by design**. Copy implies USD appears on toggle while still in 中文; accurate only **after** switching to English. `process.fee_note_jv` has **no ZH key** (JV shell stays EN in 中文 — see §4). |
| **Suggested fix** | ZH fee notes: “**中文界面仅显示人民币**；切换 English 后显示人民币与美元对照（汇率规则同财务区）.” Add `process.fee_note_jv` + `process.jv_intro` ZH strings. |
| **Sources** | `china-business.js:592-603`; `i18n-china-business.js` grep |
| **Confidence** | high |

---

#### [LOW] JV jv06 AMR government band mirrors WFOE low tier-1 ceiling

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `buildJvStepMoneyHtml` jv06/jv08 — `pr(0, 800)` government charges |
| **Current claim** | AMR government charges **¥0–800** on top of JV agency fees |
| **Problem** | Same band as WFOE s05; tier-1 JV/WFOE disbursement lines often **¥1,500–2,500+** (see WFOE s05 issue above). JV legal/agent totals are better (**¥18k–55k** std) but government slice still tight for Shanghai/Beijing buffers. |
| **Suggested fix** | Align jv06/jv08 government band with widened WFOE **¥0–2,500** or cross-reference s05 footnote. |
| **Sources** | [上海外资代办价目](https://m.jinpucn.com/zhucebk/8604.html); `buildJvStepMoneyHtml` jv06 |
| **Confidence** | medium |

---

#### [VERIFIED] `buildJvStepMoneyHtml` + `refreshJvMoney` implemented and wired

| Field | Detail |
|-------|--------|
| **Severity** | — |
| **Location** | `china-business.js:820-913`; `steps-render.js:112`; `china-biz-steps-rendered` L1000-1003; `updateVisuals` L589 |
| **Current claim** | JV tab fee column populated with 2024–2026 tier-1 bands |
| **Problem** | N/A — prior audit draft incorrectly flagged missing JV renderer. **jv01–jv15** bands present (legal DD ¥15k–80k, JV counsel ¥50k–250k+, agency ¥18k–55k std, full-service **>¥60k**). |
| **Suggested fix** | None for wiring; validate bands periodically against counsel quotes. |
| **Sources** | Code read `china-business.js` |
| **Confidence** | high |

---

#### [LOW] Dashboard overhead scales rent linearly per headcount

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `china-business.js` `getCostData` L217–218, L120 |
| **Current claim** | Overhead scaled **per headcount** (`overheadAnnual * headcount`) |
| **Problem** | Each added employee gets a full **10 m²** rent allocation — **linear overcount** for teams sharing one office. Methodology says "per employee-year" so it's **disclosed**, but multi-HC totals skew high. |
| **Suggested fix** | Cap shared rent or footnote "assumes one desk per HC." |
| **Sources** | `china-business.js` L217–218, L120 |
| **Confidence** | high |

### Recommended fix priority

1. **Dashboard** — recalibrate `contribPct`, MPF cap (HK), donut medical %; Macau flat FSS (see §4)
2. **d06** — switch to `data-domestic-fee` for EN dual-currency display
3. **s05 / jv06** — widen government-fee band; WFOE full-service upper bound; tier-1 std agent floor
4. **i18n** — ZH fee-note accuracy; add `process.fee_note_jv` / JV shell ZH; remove stale `*.money` keys
5. **methodology** — reword HKD/MOP disclosure; align `OVERHEAD_SOFTWARE_ANNUAL_RMB` (~¥30k vs ¥36k)

---

## 4. Site-wide

**Status:** audit complete (2026-06-11)  
**Files reviewed:** `index.html` (hero, process tabs incl. SAR/JV shell, regions, dashboard/comparison, methodology, footer), `assets/js/i18n-china-business.js` (non-step keys: nav, hero, sar, regions, costs, dash, method, footer, chart/donut/desc), `assets/data/joint-venture-steps.json` (jv01–jv15), `assets/js/china-business.js` (`cityData`, SAR alert, dashboard charts), `assets/js/steps-render.js` (JV mount).  
**Method:** Full file read + web verification (HK Companies Registry, Macau FSS/CRCBM, Hainan FTP Dec 2025 customs launch, 2024 Negative List, MPF cap, Autodesk/Rhino list pricing, Tianjin–Beijing HSR).

### Executive Summary

| Metric | Value |
|--------|-------|
| **Reliability score** | **3.5 / 5** |
| **Verdict** | Strong **disclaimer + methodology framing** make the page usable as bilingual planning research, but **not** as an operational checklist. SAR payroll modeling (flat % vs MPF cap / Macau FSS flat MOP 60) and Hainan import-tax prose oversimplify post-Dec 2025 rules. Dashboard **macro comparison** is directionally useful for mainland tiers but **distorts SAR employer-statutory rankings** for senior roles. JV tab shell + jv01–jv15 **now have ZH i18n** (verified 2026-06-11). |

### Scope map (what “comparison” means here)

There is **no standalone comparison table**; “comparison” = **Annual Macro Comparison** bar chart (`#costs`, `dash.macro_prefix`) + regional hub cards + SAR alert when HK/Macau selected. All 24 cities counted consistently (5 GBA + 5 East + 9 North/Inland + 3 Southwest + 2 Hainan).

### Issues

#### [HIGH] Macau employer “contributions” modeled as ~1% of salary; law is flat MOP 60/month

| Field | Detail |
|-------|--------|
| **Severity** | high |
| **Location** | `china-business.js` `cityData.macau.contribPct: 0.01`; `dash.sar_body`; `donut.fss`; region card `gba.mo` (“very low tax”) |
| **Current claim** | Dashboard applies **`contribPct`** to base salary; Macau **1%** → ~¥1,800/yr on junior ¥180k modeled base |
| **Problem** | Macau **FSS mandatory** employer share is **MOP 60/month fixed** (MOP 90 total contribution), **not** a percentage of wages ([FSS](https://www.fss.gov.mo/en/social/social-mandatory)). Effective rate on modeled ¥180k junior ≈ **0.04%**, not 1%. Chart **overstates** Macau employer statutory vs reality (~2.5× at junior band; error shrinks in absolute terms but ranking vs HK MPF cap logic is still wrong). Prose “very low tax” conflates **profits tax** with **payroll statutory**. |
| **Suggested fix** | Store SAR statutory as **flat annual RMB** (HK: min(5%×base, HKD 1,500×12); MO: MOP 720/yr employer) or cap-aware function; update `desc.sar_line` / donut labels. |
| **Sources** | [Macau FSS mandatory contributions](https://www.fss.gov.mo/en/social/social-mandatory); [PwC Macau social security](https://taxsummaries.pwc.com/macau-sar/individual/other-taxes) |
| **Confidence** | high |

---

#### [HIGH] Hainan “zero import duties, VAT, and consumption tax” oversimplified for 2026 readers

| Field | Detail |
|-------|--------|
| **Severity** | high |
| **Location** | `index.html` `hn.fold_p1`; `i18n-china-business.js` `hn.fold_p1` |
| **Current claim** | Island-wide **special customs operations**: many imports enter with **zero import duties, VAT, and consumption tax** (mainland-bound shipments taxed at “second line” unless substantially transformed) |
| **Problem** | **Accurate directionally pre-2025** but **stale/incomplete after 18 Dec 2025** island-wide special customs launch. Zero-tariff imports are now managed via a **negative list** of taxable commodities (~74% of tariff lines zero-rated, not “all goods”) ([gov.cn Dec 2025](https://english.www.gov.cn/news/202512/18/content_WS6943ac7dc6d00ca5f9a082cb.html)). VAT/consumption-tax treatment is **simplified**, not universally “zero” for every import category. Page last-reviewed **2026-04** should reflect negative-list framing and eligible-entity scope (registered FTP entities with actual import needs). |
| **Suggested fix** | Replace blanket “zero … VAT and consumption tax” with: “zero **import tariff** on non-listed goods for qualifying FTP entities; VAT/consumption tax follows FTP goods-tax rules; second-line to mainland separate.” Cite Dec 2025封关. |
| **Sources** | [China gov.cn Hainan customs launch Dec 2025](https://english.www.gov.cn/news/202512/18/content_WS6943ac7dc6d00ca5f9a082cb.html); [SCIO Oct 2025 tax policy briefing](http://english.scio.gov.cn/m/pressroom/2025-10/14/content_118123380_4.html) |
| **Confidence** | high |

---

#### [MEDIUM] HK MPF modeled as flat 5% — overstates employer cost for senior SAR salaries

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` `hongkong.contribPct: 0.05`; `dash.sar_body` (“capped at a very low fixed amount”); comparison chart |
| **Current claim** | **5%** employer statutory on all HK base salaries |
| **Problem** | MPF employer share is **5% of relevant income, capped at HKD 1,500/month** (income cap HKD 30,000) ([MPFA/Workday](https://www.workday.com/en-hk/topics/hr/what-is-mpf.html)). Junior modeled ¥216k/yr (~HKD 19.5k/mo) → **true ~5%**. Senior ¥432k/yr (~HKD 39k/mo) → **cap HKD 18k/yr** (~¥16.6k) vs modeled **¥21.6k** (~**30% overstatement**). Macro comparison **under-ranks** HK total cost vs mainland for senior roles. Text mentions “capped” but math does not cap. |
| **Suggested fix** | Implement MPF cap in `getCostData`; footnote proposed 2026 cap review (HKD 40k / HKD 2k) as optional scenario. |
| **Sources** | [Workday HK MPF](https://www.workday.com/en-hk/topics/hr/what-is-mpf.html); [Lewis Silkin Mar 2026 cap review](https://www.lewissilkin.com/insights/2026/03/26/hong-kong-considers-33-percent-mpf-contribution-hike-to-match-rising-cost-of-living) |
| **Confidence** | high |

---

#### [MEDIUM] HK incorporation timeline “24–48 hours” conservative vs official e-incorp (~1 hour)

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `index.html` `sar.hk4`; `i18n-china-business.js` `sar.hk4` |
| **Current claim** | Company usually incorporated within **24 to 48 hours** via NNC1 |
| **Problem** | Companies Registry states straightforward **electronic** NNC1 cases can complete in **~1 hour**; **hard copy** ~**4 working days** ([CR FAQ](https://www.cr.gov.hk/en/electronic/e-servicesportal/faq/business-registration.htm)). “24–48h” is not wrong for agency-led filings but **understates** best-case 2024–2026 e-Services norm; may cause over-planning. |
| **Suggested fix** | “**~1 hour** (e-Services, straightforward) to **4 business days** (hard copy); bank KYC remains weeks.” |
| **Sources** | [Companies Registry e-incorporation FAQ](https://www.cr.gov.hk/en/electronic/e-servicesportal/faq/business-registration.htm); [CR incorporation FAQ](https://cr.gov.hk/en/faq/local-company/incorporation.htm) |
| **Confidence** | high |

---

#### [MEDIUM] Hainan 15% CIT/PIT incentives lack front-and-center qualification gates

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `hn.fold_li1`, `hn.fold_li2`; hub cards `hn.hk` / `hn.sy` (pay bands without tax caveat) |
| **Current claim** | **15%** CIT for qualifying encouraged industries; **15%** PIT cap for eligible talent |
| **Problem** | Rules require **FTP registration + substantive operations + encouraged-industry main business ≥60% revenue** ([NDRC 2024 catalogue](https://www.china-briefing.com/news/unlocking-opportunities-hainans-2024-encouraged-industries-revealed/)). CIT window **extended in phases to 2027** ([Kaizen/Hainan notices](https://kaizencpa.com/knowledge/info/id/1964.html)) — fold note says “verify end dates” but city **salary cards** read like generic low-cost hubs without “tax incentive ≠ automatic.” |
| **Suggested fix** | Add one-line qualifier on Haikou/Sanya cards: “15% tax rates require encouraged-industry + substantive ops — not default for all employers.” |
| **Sources** | [China Briefing Hainan 2024 encouraged catalogue](https://www.china-briefing.com/news/unlocking-opportunities-hainans-2024-encouraged-industries-revealed/); [Hainan gov CIT 15% page](https://en.hainan.gov.cn/englishsite/ogp/202508/d6572754831e48678da2e52cc46262d2.shtml) |
| **Confidence** | high |

---

#### [MEDIUM] JV tab content accuracy gaps (shared with domestic/WFOE drift)

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `joint-venture-steps.json` jv09–jv10; `index.html` `process.jv_intro` |
| **Current claim** | jv09 lists **发票章**; jv10 “**tax registration**” + fapiao; intro references **2024 Negative List** + **中外合资企业** |
| **Problem** | **发票章** largely obsolete under nationwide **数电票** (2024 STA Announcement 11). **Tax registration** wording outdated under **多证合一** (same issue as domestic d08). Intro **中外合资企业** is legacy label; jv02 correctly notes new JVs are **LLCs under FIL/2024 Company Law** — intro/step terminology inconsistent. **29 restricted measures** claim is **verified correct** ([NDRC Order 23, 2024](https://www.ndrc.gov.cn/xxgk/zcfb/fzggwl/202409/t20240907_1392875.html)). |
| **Suggested fix** | Align jv09/jv10 with domestic fixes; intro: “Sino-foreign **LLC/JV** (外商投资有限责任公司)”. |
| **Sources** | [NDRC 2024 Negative List 29 measures](https://www.ndrc.gov.cn/xxgk/zcfb/fzggwl/202409/t20240907_1392875.html); domestic audit §2 d06/d08 |
| **Confidence** | high (29 count); medium (terminology) |

---

#### [MEDIUM] Mainland donut breakdown uses static 16/10/0.5/0.5% + housing — not city-specific

| Field | Detail |
|-------|--------|
| **Severity** | medium |
| **Location** | `china-business.js` donut builder; `i18n-china-business.js` `donut.pension` … `donut.housing`; `index.html` micro breakdown |
| **Current claim** | Micro chart splits employer statutory into **16% pension, 10% medical, 0.5% unemployment, 0.5% injury**, plus housing fund `{pct}%` |
| **Problem** | `contribPct` is a **single blended multiplier per city** (e.g. 38% Shanghai) while donut uses **generic national-ish splits** that may not reconcile to the blended total; housing fund **5–12%** varies by city but only one `{pct}` shown. Comparison **percent label** on micro chart can mislead planners tuning municipal policy. |
| **Suggested fix** | Label donut “illustrative split” or pull city-specific rates from a table; ensure slices sum to `contribPct`. |
| **Sources** | `china-business.js` L426, L466–487; code inspection |
| **Confidence** | medium |

---

#### [LOW] Region card tax shorthand (“lowest employer tax burden”, “very low tax”) imprecise

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `gba.hk`, `gba.mo`; `dash.sar_body` |
| **Current claim** | HK: “Highest base pay, **lowest employer tax burden**”; Macau: “**very low tax**” |
| **Problem** | Dashboard models **employer statutory payroll** (MPF/FSS), not **corporate profits tax** (HK 8.25%/16.5%; Macau 12% on first MOP 600k). Cards read like holistic tax advice. Directionally true for **payroll statutory** vs mainland 五险一金. |
| **Suggested fix** | Qualify: “lowest **employer payroll statutory** burden in this model.” |
| **Sources** | Region cards `index.html` L282–291 |
| **Confidence** | medium |

---

#### [LOW] Tianjin “30 mins from Beijing” — HSR-only, not office-to-office (ZH worse)

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `north.tj` (EN); `i18n-china-business.js` `north.tj` (ZH) |
| **Current claim** | EN: “Major port, **30 mins from Beijing**”; ZH: “大港，**距北京约30分钟车程**” |
| **Problem** | **Beijing South ↔ Tianjin** C-train **~30–33 min** is accurate ([Wikipedia BJ–TJ intercity](https://en.wikipedia.org/wiki/Beijing%E2%80%93Tianjin_Intercity_Railway)); door-to-door / port-industrial zones are **1h+**. EN is ambiguous; **ZH explicitly says 车程 (by car)**, which is misleading for the common HSR reference. |
| **Suggested fix** | EN + ZH: “~30 min **by intercity HSR** (station to station).” |
| **Sources** | [Beijing–Tianjin intercity railway](https://en.wikipedia.org/wiki/Beijing%E2%80%93Tianjin_Intercity_Railway) |
| **Confidence** | high |

---

#### [LOW] Orphan / mismatched i18n region keys (`*.summary` vs `*.fold_title`)

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `i18n-china-business.js` `gba.summary`, `east.summary`, `north.summary`, `hn.summary` |
| **Current claim** | HTML uses `gba.fold_title`, `east.fold_title`, etc. |
| **Problem** | ZH object defines **`gba.summary`** but HTML binds **`gba.fold_title`** (defined in `Object.assign` block). `hn.summary` unused; `sw.summary` unused. No user bug if `fold_title` present; dead keys confuse maintainers. |
| **Suggested fix** | Delete orphan `*.summary` keys or alias to `fold_title`. |
| **Sources** | Grep `i18n-china-business.js` vs `index.html` `data-i18n` |
| **Confidence** | high |

---

#### [LOW] Hero/meta positioning still WFOE-centric despite four entity paths

| Field | Detail |
|-------|--------|
| **Severity** | low |
| **Location** | `<title>`, `meta.description`, `hero.h1` (“How to open a company in China”) |
| **Current claim** | Title emphasizes **WFOE setup**; body covers WFOE + domestic LLC + JV + SAR |
| **Problem** | SEO/expectation skew — users seeking **JV-only** or **HK-only** may underrate coverage. Content matches broader promise in `hero.lead`; title lag only. |
| **Suggested fix** | Title: “China company setup (WFOE, domestic, JV, HK/Macau) & AEC costs”. |
| **Sources** | `index.html` L7–8, L79–86 |
| **Confidence** | medium |

---

### Verified as broadly accurate (no issue filed)

| Item | Verdict |
|------|---------|
| **24 cities** in regions + `cityData` | Consistent count and naming |
| **HK company secretary + registered office** mandatory | Correct ([Companies Ordinance s.474](https://www.cr.gov.hk/en/faq/local-company/directors-secretary.htm)) |
| **HK NNC1** electronic incorporation path | Correct form reference |
| **HK bank account** strict AML / weeks / in-person | Directionally correct (common industry experience) |
| **Macau CRCBM + notary + Lda. + ~2–3 weeks** | Aligns with CRCBM/IPIM guides (16–20 business days common) |
| **SAR separate legal systems** vs mainland WFOE | Correct framing |
| **2024 Negative List: 29 measures** (JV jv03) | Verified ([NDRC 2024 Order 23](https://www.ndrc.gov.cn/xxgk/zcfb/fzggwl/202409/t20240907_1392875.html)) |
| **JV: shareholders' meeting supreme organ** (jv02) | Aligns with post-FIL LLC governance |
| **JV tab ZH i18n** (`process.tab_jv`, `jv01`–`jv15`) | Present in `i18n-china-business.js` (verified 2026-06-11) |
| **Meta description** (four entity paths + 24 cities) | Accurate vs page content |
| **OG/Twitter descriptions** (24 hubs, bilingual) | Accurate; slightly WFOE-skewed like `<title>` |
| **Autodesk AEC Collection ~USD 3,560–3,795/yr** | Matches Autodesk list / 2025–2026 price bumps ([autodesk.com](https://www.autodesk.com/collections/architecture-engineering-construction/overview)) |
| **Rhino 8 commercial perpetual ~USD 995** | Matches McNeel list ([rhino3d.com/buy](https://www.rhino3d.com/buy/)) |
| **Hero/method timestamps** (2024 Q4 data, 2026-04 review) | Internally consistent |
| **Footer disclaimer** (educational, no guarantees, consult counsel) | Adequate for planning portal |
| **Methodology AI disclosure** (Gemini 3.1 Pro, Apr 2026) | Present and appropriately hedged |
| **Tianjin–Beijing HSR ~30 min** (station-to-station) | Verified |
| **GBA geographic grouping** (HK/Macau as SAR alongside Shenzhen/Guangzhou/Zhuhai) | Standard GBA presentation |

### Disclaimer & comparison-stats verdict

| Area | Score | Notes |
|------|-------|-------|
| **Legal/tax disclaimer** (footer + hero “illustrative only”) | ✅ Strong | Multiple layers; not a substitute for counsel |
| **Methodology fold** (sources, RMB-first, FX fallback) | ✅ Good | Minor HKD/MOP overspec (see §3) |
| **Dashboard comparison stats** | ⚠️ Mixed | Salary/rent bands plausible; **SAR contribPct** and **mainland donut splits** weaken cross-city ranking accuracy |
| **Regional policy prose** (Hainan) | ⚠️ Needs update | Post-Dec 2025 customs rules |
| **Bilingual completeness** | ✅ Good | JV tab shell + jv01–jv15 ZH keys present (`process.tab_jv`, `process.jv_intro`, `process.fee_note_jv`, step titles/details); fee column via `buildJvStepMoneyHtml` (RMB-first, EN dual-currency) |

### Recommended fix priority

1. **SAR modeling** — MPF cap + Macau flat FSS (comparison chart integrity)  
2. **Hainan fold** — negative-list / Dec 2025封关 wording + tax qualifiers on hub cards  
3. **HK sar.hk4** timeline refresh; **JV jv09/jv10** align with domestic tax/seal fixes  
4. **Low** — region tax shorthand, orphan i18n keys, title/meta breadth, Tianjin HSR wording (esp. ZH 车程)

---

## Fixes applied

**Date:** 2026-06-11

1. **Domestic d01** — optional supervisor (2024 Company Law); 登记联络员; 董事 terminology; removed finance-contact framing
2. **Domestic d02–d10** — cluster-address caveats; 一窗通 parallel note (d04); 1-day review (d05); 数电票/no invoice chop (d06 → `data-domestic-fee`); capital pay-in caveat (d07); 新办纳税人确认 (d08); 用工前社保/公积金 optional (d09); VAT quarterly + 零申报 (d10)
3. **Domestic intro** — 境内股东 wording; logical vs mandatory sequence note
4. **WFOE s02/s07/s08/s10/s11/s14/s17/s19/s20** — address nuance; Hague caveats; negative-list + CAD vs construction-design; supervisor optional; FI initial report; 货币出资入账登记; 数电票; housing fund; basic-account cash wording
5. **WFOE intro** — sector-scope caveat; operating costs (not “hosting cost”)
6. **Costs** — d06 dual-currency via `buildDomesticFeeHtml`; s05 gov/agent bands widened; s17 wire band; s19 digital invoicing fees; removed stale `s16.money` / `s19.money` / `d06.money` i18n keys
7. **Dashboard** — Shanghai/Beijing `contribPct` ~33%; donut medical 9%; HK MPF income cap HKD 30k + employer cap; Macau flat FSS MOP 60/mo
8. **Site-wide** — JV jv07/jv08 数电票 alignment; Hainan Dec 2025 customs prose; HK e-incorp timeline; Hainan 15% qualifiers on hub cards; methodology SAR RMB-equivalent disclosure; region payroll-statutory wording; Tianjin HSR (ZH/EN); ZH fee-note RMB-only clarity; cache-bust `20260611acc`
9. **P1** — d04 agent fee bands; WFOE s05 tier-1 agency notes; jv06 government fee band aligned with WFOE

**Verification:** `node tmp/verify-accuracy.mjs` (static server + Playwright) — page load, cache-bust, JV tab, lang toggle, d06 fee kind, SAR contrib modeling.

---

## Fixes applied (2026-06-11)

Batch accuracy remediation from P0/P1 priorities + cost-audit dashboard items [7133176a].

| Area | Fix |
|------|-----|
| **Dashboard** | Shanghai/Beijing `contribPct` 0.38→**0.33**; donut medical **9%**; HK MPF cap (HKD 1,500/mo) + Macau FSS flat **MOP 60/mo** via `employerContribAnnualRMB()` |
| **Domestic d01/d05–d10** | 2024 Company Law supervisor opt-out, 登记联络员, 一窗通 parallel, 数电票/seal, tax onboarding wording, zero-filing, d06→`data-domestic-fee` |
| **WFOE s02/s07/s10/s11/s17/s19/s20** | Address/apostille/governance/FI report/入账登记/数电票/housing fund; negative-list + CAD caveat in s08 + intro |
| **Costs P1** | s05/jv06 gov-fee bands widened; s17/s19 fee text; d04 agent bands; ZH fee-note RMB-only clarity |
| **Site-wide** | Hainan Dec 2025 negative-list prose; methodology HKD/MOP disclosure; JV jv07/jv08 ZH+EN; stale `*.money` i18n removed |
| **Cache bust** | `index.html` scripts/css → `?v=20260611acc` |

**Verification:** `python3 -m http.server` + `node tmp/verify-accuracy.mjs` (Playwright smoke).

