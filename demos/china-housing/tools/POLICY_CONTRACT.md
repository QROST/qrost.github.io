# POLICY_CONTRACT.md — 政策维度数据契约

单一 source-of-truth,供 (a) workflow 研究 agent 产出、(b) pipeline 集成 (`enrich.py`/`manage.py`)、
(c) 前端消费 (`app.js`/`index.html`) 三方对齐。所有 agent / dispatch 子 / 后续编辑都以本文件为准。

## 设计原则

1. **实体化,不重复**:政策是**城市级**(限购/落户/补贴) 或 **国家级** 常量,绝不按 348 套逐行复制。
   新建归一化实体表 `city_policy`(键=`地级市`)与 `national_policy`(全局~9 条),listing 通过 `prov+city` JOIN。
2. **粒度 = 地级市**:DB 城市名为 `地级市-区县` 结构(如 `威海市-荣成市`),政策按 `地级市`(`-` 前)研究,
   县级市/区差异写进 `detail`。每个 `city_policy` 行用 `loc_names[]` 登记它覆盖的原始 DB 城市串。
3. **溯源三联(强制)**:每个政策字段都带 `source_url` + `as_of`(YYYY-MM) + `confidence`。
   `confidence ∈ {high, med, low, unknown}`:high=政府原文 / med=权威媒体或地方门户 / low=推断 / unknown=查无可靠源。
4. **cite-or-null**:查不到可靠源 → `value=null` + `confidence="unknown"`,**绝不臆测**。政策错误代价高于气候错误。
5. **慢变量优先**:落户门槛、契税分档、公积金上限、资源枯竭、棚改 = 结构性,可信;
   本周利率、限购微调 = 快变量,标 `as_of` 并淡化。
6. **时效免责**:前端全局醒目 "政策为 {as_of} 快照,购房前请向当地住建局/不动产登记中心核实"。
7. **非大陆**(香港/台湾/California):政策制度不同 → 标 `regime="non-mainland"`,不套大陆 schema,前端显 "制度不同,另述/暂略"。

## `city_policy` 字段(每 `地级市` 一行)

| 字段 | 类型 | 说明 |
|---|---|---|
| `prefecture` | str | 地级市名(`威海市`) |
| `loc_names[]` | str[] | 覆盖的原始 DB city 串(`威海市-荣成市`,`威海市-乳山市`,`威海市`) |
| `purchase_limit` | field | `status ∈ {不限购,限购,区域限购,unknown}` + `detail` |
| `loan_policy` | field | `first_down_pct` / `second_down_pct`(%) + `recognize`(认房认贷/认房不认贷) |
| `hukou` | field | `threshold ∈ {零门槛,买房落户,积分落户,社保年限,稳定就业,其他,unknown}` + `detail` ← **核心差异化** |
| `subsidy` | field | `has` + `kinds[]`(人才/购房/契税补贴) + `amount_note` + `eligibility` |
| `provident_fund` | field | `max_loan_wan`(万) + `cross_city`(异地互认) |
| `deed_tax_note` | field | 地方契税减免/补贴(全国分档在 national) |
| `guide_price` | field | 二手房参考/指导价 `has` + `detail` |
| `urban_renewal` | field | 棚改/城市更新 `active` + `detail` |
| `property_tax_pilot` | bool | 房产税试点(沪/渝) |
| `resource_exhausted` | field | NDRC 资源枯竭城市 `flag` + `ndrc_batch` |
| `population` | field | `pop_2020`(七普) / `pop_2010`(六普) / `change_pct` / `aging_65plus_pct` ← **补缺 fold-in** |

`field` = `{...typed value..., source_url, as_of, confidence}`。

## `national_policy` 主题(~9 条,全局上下文面板)

LPR(1Y/5Y+) · 全国首付下限(首套/二套) · 认房不认贷全国转向 · 契税分档(≤90㎡ 1% / 90+ 1.5%/3%,首套二套,财政部) ·
增值税(满2年免) · 个税(满五唯一免) · 房地产税立法状态 · 户籍改革(城区常住人口300万以下全面取消落户限制) · 保交楼/白名单。

每条:`topic` + `key_facts[]` + `value_struct` + `source_url` + `as_of` + `confidence`。

## Pipeline 集成(Phase 2,集成者串行执行)

- 新表 `city_policy` + `national_policy`(`manage.py init` 加 schema;研究 JSON 落 `data/research/policy-*.json` → `manage.py import-policy`)。

> ### ⚠️ `import-policy` 是**清表全量替换**，不是 upsert（2026-06 钉死）
> `cmd_import_policy` 内部 `DELETE FROM city_policy` 后整批 INSERT。**所以它只能用于"一次性提交完整 128 城快照"，绝不能拿来补几条**——传只含几城的 JSON 会**抹掉其余 120+ 城**。
> **补单个/少数字段缺口（如本轮 首付/补贴/人口/公积金/契税/指导价/棚改）走 fill-only 合并，不走 import-policy**：
> 逐 `(prov,prefecture)` 读出该行 `data` JSON，**仅当目标字段 null / 缺 / `confidence=="unknown"` / 关键子键 null 时才写入，既有非空一律保留**，然后 `UPDATE city_policy SET data=?,updated='YYYY-MM'`。
> - `population` 类还要做 **>10% 差异检测纠错**（本轮抓到娄底 `pop_2020` 误存县级数 329912→七普地级市 3826996）。
> - `subsidy` 查无可靠源 → `has=null`+`confidence` low/unknown **诚实留空**，不臆造（cite-or-null）。
> - 合并完照常 `build`（重 emit `policy.js` + 刷 `?v`）。research JSON 全 gitignored，真相在 `housing.db`。
- `enrich.py` 加 `emit_city_policy(con)` + `emit_national_policy(con)` → 新 global `window.CITY_POLICY`(`{ "prov|prefecture": {...} }`)、`window.NATIONAL_POLICY`。
- `manage.py build` 多 emit 两个文件 `assets/data/policy.js` + 在 index.html 注入带 content-hash `?v=` 的 `<script>`(见 [[html-cache-versioning]],绝不手填 stamp)。
- 前端 `app.js` 按 `listing.prov + 地级市(city.split('-')[0])` JOIN policy;modal 加 "政策" 区块 + 决策漏斗 + TCO/月供;来源逐条可点 + 全局时效免责。

## 关联性交付(Phase 3)

1. **决策漏斗**:能买(限购)→划算(契税+税费+月供 via LPR)→落户(门槛)→宜居(现有分)→保交楼(房企暴雷+建成)。五闸 红/黄/绿。
2. **TCO**:房款+契税(按面积/套数分档)+中介+物业费×N年+取暖费(气候驱动) → 一次性+年持有。
3. **月供模拟**:公积金/商贷额度+LPR+首付比例 → 月供+总利息。
4. **"为什么便宜" 解释器**:资源枯竭 ↔ 人口流出(七普) ↔ 房企暴雷 ↔ 低价,交叉引用 chip。
5. **方法与来源页**:逐维度 源/抓法/as_of/confidence/缺口,透明披露。
