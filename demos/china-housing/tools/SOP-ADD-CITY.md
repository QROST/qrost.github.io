# SOP · 添加城市 / 小区

> 给 **agent / 同事 / 工具**（Cursor Composer、Claude 等）照做的 runbook。深度细节见同目录
> [`README.md`](README.md)；本文件覆盖「加一批房源」的完整闭环。所有命令在
> `demos/china-housing/` 下运行（脚本按自身位置定位路径，cwd 在哪都行），零第三方依赖，
> Python 3.9+ 标准库。

## 0. 心智模型（务必先懂）

```
data/housing.db   ←─ 唯一真相（SQLite）。只通过 manage.py / SQL 改它。
      │  python3 tools/manage.py build
      ▼
assets/data/listings.js · enriched.js · hazards.js · field.js   ←─ 生成产物，页面读取
data/listings.csv                                               ←─ 生成（可 diff 的镜像）
index.html 的「N套 / N省 / 日期」                                ←─ build 就地同步
```

**绝不手改生成文件**（`assets/data/*.js`、`data/listings.csv`、`housing.db` 的行内容除非走 CLI）。
改完 DB **必跑 `build`**。

### 0.1 坐标系铁律（WGS-84 vs GCJ-02 — 2026-06 实测钉死，别再被"中国地图偏移"带跑）

**全栈统一 WGS-84，标点本就对齐，绝不做 WGS→GCJ 转换。**

| 来源 | 坐标系 | 处置 |
|------|--------|------|
| Nominatim / OSM geocode（我们的 `lat/lng`） | **WGS-84** | 直接入库 |
| 详情弹窗卫星底图 = **Esri World Imagery** | **WGS-84** | 与标点天然对齐 |
| OSM 街道底图 | **WGS-84** | 对齐 |
| **高德 / 百度 / 腾讯 / 天地图 / Google 中国瓦片** | **GCJ-02**（百度再叠 BD-09） | ⚠️ 取坐标必须 **GCJ-02→WGS-84** 转换后才入库 |

- A/B 实测（同图打 WGS 绿点 + GCJ 红点）：小区级定位的绿点**精准压楼**，转成 GCJ 的红点反而**偏到海里 ~400m**。所以 Esri/OSM 底图上**做 GCJ 偏移 = 人为制造 ~500m 错位**。
- GCJ-02 法定偏移**只作用于中国持牌厂商瓦片**；Esri/OSM 是境外 WGS 源，不套偏移。
- **头号雷**：让调研 agent 查坐标时，若从**高德/百度**页面取值（GCJ-02/BD-09），**必须显式转 WGS-84 再写库**，否则全库就这一条偏 ~500m。OSM/Nominatim 原生值不用转。**派坐标调研 agent 时把本节铁律原样写进其契约**（OSM 优先、高德/百度必转 WGS-84、查不到坐标返 null 绝不猜、结果须落在标称城市内）。
- 用户看到的"偏移"几乎都是**定位精度问题**（免费 Nominatim 认不出文旅盘名 → 落到街道/镇/区中心）或**错城**（见 §7 `city-check`），**不是坐标系问题**——先别急着转坐标。

## 1. 加房源

**单条**（`id` 自动取下一个空号；`--updated` 接受 `2026.6` 或 `2026-06`）：

```bash
python3 tools/manage.py add \
  --prov 山西 --city 大同市 --dist 平城区 --loc 某某小区 \
  --price-wan 9.5 --area 55 --rent 500 --updated 2026.6
```

**批量**（CSV 表头固定 `id,prov,city,dist,loc,priceWan,area,rent,updated`；`id` 留空自动分配，
已存在的 id 会被覆盖）：

```bash
python3 tools/manage.py import-csv 新一批.csv
```

字段：`priceWan` 总价(万元)、`area` 面积(㎡)、`rent` 月租(元)、`updated` `YYYY-MM`。单价 /
回报率等派生指标前端实时算，不入库。

> **⚠️ 月租 `rent` 反幻觉铁律**：**仅当**贝壳/安居客/58/房天下/链家等**无任何当前或历史挂牌月租**时，才允许粗估入库；否则必须联网调研实际租金并附 source URL 写入 `data/research/`。**禁止**用 `priceWan×100/12`（约 1% 年化毛回报）或 cap-rate 公式替代调研。回填：`data/research/rent-backfill-*.json` → `python3 tools/apply_rent_backfill.py <json>` → `build`。

> **⚠️ 入库前必做：跨时间批次去重预检（cross-temporal-batch）**。`import-csv` 的 id 留空＝**新增**，
> 不会跟主库已有的同盘合并——一不留神就造出「富力湾 19万」和已有「富力湾 12万」两条重复。
> **必须扫 `data/housing.db` 全库**（所有历史批次、所有 `updated` 月份），**不能只查本批 CSV**。
> 典型事故：2026-06 批未查 2026-03 已有「恒大雅苑」→ #144 与 #222 同城同盘重复。
>
> **Checklist（每条待加 loc 都走一遍；品牌盘再按品牌前缀扫一遍）**
>
> 1. **精确 / 模糊查 loc**（不限 `updated`、不限批次）：
>    ```bash
>    sqlite3 data/housing.db \
>      "SELECT id, loc, city, dist, priceWan, area, updated FROM listings WHERE loc LIKE '%恒大雅苑%';"
>    sqlite3 data/housing.db \
>      "SELECT id, city, dist, loc, priceWan, area FROM listings WHERE loc LIKE '%富力湾%';"
>    sqlite3 data/housing.db \
>      "SELECT id, city, loc, priceWan FROM listings WHERE loc LIKE '碧桂园%';"
>    ```
> 2. **同城同盘**（`city` + `loc` 实质相同，或坐标 geocode 后重合）→ **禁止新增**；更可信则**相同 id 覆盖**，
>    否则跳过本行。
> 3. **同 loc 不同城**（尤其 恒大 / 碧桂园 / 融创 等**跨城复用品牌盘名**）→ **loc 加城市消歧**：
>    `碧桂园凤凰城（宜昌）`，否则表格里两行同名难辨。
> 4. **主库已有更便宜同盘** → 一般**保留更便宜那条、跳过新的**（本数据集主打「最便宜」）。
> 5. **双户型同盘**（同小区不同面积/总价）→ 用**户型语义**消歧，**禁止**在 `loc` 写面积数字：`恒大金碧天下（大户型）` / `新田城甲壳虫公寓（小户）`。面积只在 `area` 列；详见 §1.1。

### 1.1 `loc` 小区名命名规范（2026-06-17）

`loc` = 表格「小区」列展示名；**不是**完整地址、户型描述、门户 ID 或计价备注。完整地址进 `data/research/*.json` 的 `refined_address` / `notes`。

| 规则 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 单一小区名 | `秋谷阳光里` | `世纪城/秋谷阳光里/名居` |
| 无面积后缀 | `新田城甲壳虫公寓` | `新田城甲壳虫公寓（28㎡）` |
| 无计价/装修备注 | `玉门老城旧住宅` | `玉门老城旧住宅（按套计价·非按㎡）` |
| 跨城品牌盘加城市 | `碧桂园凤凰城（宜昌）` | 裸 `碧桂园凤凰城`（若他城已有） |
| 同城同盘不同户型 | `恒大金碧天下（大户型）` | `恒大金碧天下（80㎡）` |
| 裸品牌名加城市 | `富力湾（惠东）` | 裸 `富力湾` |
| 全角括号 | `莲花新村（一期）` | `莲花新村(一期)` |
| 加州 zip 展示 | `90293` / `94089` | 把物业英文名塞进 `loc`（用 `name_en` 或 research JSON） |
| 北京号院小区 | `交大东路56号院` | 把整个街道地址当 loc（无小区名时） |

**入库后（EN 视图防中文泄漏 · 顺序承重）**：
```bash
python3 tools/manage.py build        # ① 先出新 listings.js
node tools/gen-loc-pinyin.js         # ② 新 loc → loc-pinyin.js（EN 表名拼音罗马化）
node tools/gen-geo-en.js             # ③ 新 dist 字符串 → geo-en.js（自动覆盖全部 dist；★易漏）
python3 tools/manage.py build        # ④ 再 build 一次，刷新 loc-pinyin.js/geo-en.js 的 content-hash ?v=
node tools/_smoke.js                 # ⑤ 含 loc 质量 + EN「no zh」断言
```
> 为什么是这个顺序：`gen-*.js` 读 `listings.js` 产 EN 映射表 → 必须先 build；它们改了生成文件后，
> `?v=` 戳会 stale → **必须再 build 一次刷新**（否则浏览器吃旧缓存，见 [[html-cache-versioning]]）。
> **新 `dist`（含「区」后缀变体，如 `大亚湾区 霞涌` vs 已有 `大亚湾 霞涌` 算两个 key）漏跑 `gen-geo-en.js`
> → smoke 报 `en table body no zh` 失败**（EN 表泄中文）。smoke 若报 `listings N`/`table count` → 同步
> `_smoke.js` 写死套数（§7）。

审计样例：`data/research/audit-community-names-2026-06.json`。

## 1.5 并行 agent 工作流（策略 C · 单写者 SQLite）

多 agent 同时加一批房源时，**禁止**多人并行 `manage.py import-csv` / `add` / 任意 enrich 子命令写
`data/housing.db`。采用 **策略 C**：

> **后端路由（2026-06 实战）**：调研 = **联网多步任务**。① **GLM** 的 WebSearch 是 **z.ai 按周配额**，耗尽后整周 429（reset 见报错；用 curl 直查门户子域可绕一部分，但官方住建局/统计局调研会瘸）→ 额度干了就**降级 Sonnet**。② **Cursor Composer 2.5** 是"到 spec 的自包含编码"，**不适合开放式联网调研**。③ **Sonnet**（in-session `Agent`，model=sonnet）WebSearch/WebFetch 可用，是政策/房龄/坐标调研的主力。**写契约文件让各 agent 读**（如 `_policy_gap2_contract.md`/`_listing_gap_contract.md`/`_geocode_contract.md`），prompt 只塞分配清单 + 输出路径 → 省 token、schema 统一。<br>⚠️ **Nominatim 必须单线程 paced（≥1s）**：多 agent 并行 reverse/geocode 同一公网 IP 会被 429/封；`city-check` 已内建单线程缓存，**别并行**。

| 角色 | 允许 | 禁止 |
|------|------|------|
| **调研 agent（可并行 N 个）** | 联网调研；产出 `data/research/*.json`、`data/hazard_research.json` 片段；`built-merge --dry-run` / `research-merge --dry-run` 预演 | 直接 `import-csv`；直接 `built-merge` / `research-merge`（无 dry-run）；并行 `manage.py climate*` |
| **合并写者（唯一 1 个）** | `import-csv` → 按 §3 顺序串行 enrich → merge 命令 → `build` | 与另一写者同时开 enrich |

**并行阶段产物（只写 JSON，不写 DB）：**

```bash
# 每 agent 按城市/区县 fan-out，输出到独立文件
data/research/listing-batch-<slug>-YYYY-MM.json      # 挂牌/租金证据
data/research/built-year-<slug>-YYYY-MM.json         # 房龄 findings
data/research/rent-backfill-<slug>-YYYY-MM.json      # 月租 portal 调研
# 新地市灾害类型 → 追加 prefKey 到 data/hazard_research.json（勿删已有 findings）
```

**单写者合并顺序（入库后，同一 shell 串行，勿多终端同时跑）：**

```bash
python3 tools/manage.py import-csv data/batch-<slug>.csv
# §3 enrich 流水线（见下）— 一次只跑一条 manage.py 气候/geocode 命令
python3 tools/manage.py built-merge data/research/built-year-<slug>.json --dry-run
python3 tools/manage.py built-merge data/research/built-year-<slug>.json
python3 tools/manage.py research-merge data/research/listing-batch-<slug>.json --dry-run
python3 tools/manage.py research-merge data/research/listing-batch-<slug>.json
python3 tools/apply_rent_backfill.py data/research/rent-backfill-<slug>.json   # 若有
python3 tools/check_batch_complete.py --from <id0> --to <idN>   # 全绿再 build
python3 tools/manage.py tier1-check
python3 tools/manage.py build
node tools/_smoke.js
```

> **SQLite 锁**：WAL 模式下长时间 `climate` 仍可能 `database is locked`——并行写者必炸。调研 agent 撞 429 只影响自己的 JSON 产出，**等配额恢复后重跑调研**，不要抢写者进程去 `climate`。

## 2. ⚠️ 新省份必做三处（否则地图不着色、灾害 / 供暖缺失）

只在引入了**之前没有的省 / 直辖市**时需要：

| 文件 | 加什么 |
|------|--------|
| `assets/js/app.js` → `PROV_FULL` | `'西藏': '西藏自治区'`（短名→DataV GeoJSON 全名，地图着色用） |
| `tools/enrich.py` → `PROVINCE_HAZARDS` | `'西藏': {"headline": "…", "hazards": [("地震", 3, "…"), …]}` |
| `tools/enrich.py` → `PROVINCE_HEATING` | `'西藏': HEAT_HEATED`（或 PARTIAL / WARM / DAMP） |

## 2.5 境外 / 特殊行政区增补（香港 · 台湾 · 加州 · 澳洲）

引入 `prov` 为 **香港** / **台湾** / **California** / **澳洲** 时，除 §2 三处外核对：

> **`prov` 粒度**：香港 / 台湾是**行政区名**、California 是**州名**、**澳洲是国家级标签**——四者在数据里**同级**（都当 `prov`）。澳洲 listing **只写 `prov=澳洲`，不写 Queensland/州名**（州只作为 geocode 的内部 state token，见表末注）。

| 项 | 香港 | 台湾 | California (US) | 澳洲 (Australia) |
|----|------|------|-------------------|-------------------|
| `app.js` → `PROV_FULL` | `'香港': '香港特别行政区'` | `'台湾': '台湾省'` | `'California': 'California'` | `'澳洲': '澳洲'` |
| `enrich.py` → `PROVINCE_HAZARDS` / `HEATING` | 已有台风/暴雨模板 | 已有台风/地震模板 | 无省级灾害（per-listing 仍跑 `hazard-merge` 物理细化） | `'澳洲'` 亚热带暴雨/洪涝模板；`SEISMIC='低'`、`HEATING='无·冬暖'` |
| Geocode `countrycodes` | `cn`（`_geo_ladder` + 省份校验） | `tw`（`_geo_ladder_tw`） | `us`（`_geo_ladder_overseas`） | `au`（`_geo_ladder_overseas`；显示 `prov` 与 state token 解耦，见表末注） |
| EN 省名（`gen-geo-en.js` `PROVINCE_EN`） | `Hong Kong`（内建） | `Taiwan`（内建） | `California`（内建） | **须加 `澳洲: 'Australia'`**；漏加 → EN 表泄拼音 `Ao Zhou`（smoke `no zh` 报错） |
| 货币口径（**DB ground truth**） | `priceWan` = **万港元**；`rent` = **港元/月** | `priceWan` = **万新台币**；`rent` = **新台币/月** | `priceWan` = **万美元**；`rent` = **美元/月** | `priceWan` = **万澳元**；`rent` = **澳元/月** |
| 界面显示（`i18n.js`） | **zh**：Frankfurter/fallback 换算为 **人民币**（万/元/元/㎡）；**en**：换算为 **美元** | 同左 | 同左 | 同左；`PROV_CURRENCY['澳洲']='AUD'` + `FALLBACK_CNY_PER_AUD`（FX_API 拉 `…,AUD`） |
| 大陆对照 | `priceWan` = **万人民币**；`rent` = **元/月** — 无 FX | — | — | — |
| FX 铁律 | **禁止**把换算后的人民币/美元写回 `priceWan`/`rent`；FX 仅用于 `formatPriceWan` / `unitPrice` 派生显示 | 同左 | 同左 | 同左 |
| 单价可疑阈值 | 筛选审计用 **>125,000 CNY/㎡**（各 `prov` ground truth → CNY 后比较）；见 `data/research/audit-unit-price-suspects-*.json` | 同左 | 同左 | 同左 |
| PM2.5 `pm25` | 跳过（网格外） | 跳过 | 跳过 | 跳过（`prov NOT IN` + 网格外双保险） |
| 气候 429 兜底 | 同大陆；可 staging JSON | `tools/_tw_climate_fallback.py` + `data/research/tw-climate-cache-*.json` | ERA5 正常；无 CHAP 网格 | ERA5 正常（Brisbane 全球覆盖）；无 CHAP 网格 |
| Metro POI | 适用（港铁） | 六都适用 | 一般不要求 metro | Brisbane 适用（City network / busway，不强制） |
| 离线 airport/coast 顶点 | — | `_TW_AIRPORTS`/`_TW_COAST` | `_US_AIRPORTS`/`_US_COAST` | `_AU_AIRPORTS`（BNE/OOL/MCY）/`_AU_COAST`（SE-QLD 8 点）；`_load_airports`/`_load_coast` 按 `prov=='澳洲'` 分流 |
| 纯租赁公寓 / 计价 | — | — | `listingType: rental`；`rent` = 美元/月（社区挂牌）；**无单元销售**时 `priceWan` = 月租×12÷4.5% 资本化率（隐含资产，便于比回报）；同 zip **买卖/租赁中位数**写入调研 JSON `zipBenchmark`（不进 `priceWan`）；`dist` 与 **`loc` 展示名均用 zip**（如 90293），`city` 保留 Los Angeles；调研 JSON 可保留 `refined_address` / `notes` 中的真实物业名 | 同 California 口径：`dist`/`loc` 用**邮编**（如 `4006`），`city=Brisbane`；套均/成交 comp 计价（万澳元）；真实门牌/楼盘名留 `refined_address`/`notes` |

**香港 geocode 提示**：查询串用「区 + 香港」阶梯；`prov=香港` 时 `_prov_ok` 走大陆 `cn` 路径——若 Nominatim 误配深圳，用 `research-merge` 细化地址纠正。

**澳洲 geocode 提示（显示 `prov` 与 state token 解耦 · 2026-07 固化）**：Nominatim **不认识「澳洲」**，故 `enrich.py` 用 `_OVERSEAS_STATE = {'California':'California', '澳洲':'Queensland'}` 提供**可解析的 state token**——address ladder（`_geo_ladder_overseas`）与 `_prov_ok` 校验都用它，`country=Australia` 再作 OR 兜底。所以 DB/表格里 `prov` 恒为 `澳洲`，而 geocode 查询串是 `4006, Brisbane, Queensland, Australia`。⚠️ **该 state token 是 Brisbane/Queensland 专属**——未来加非昆州澳洲城市（悉尼 NSW…）要改成 **per-city** 映射，而非往 `prov` 里塞州名。坐标仍走 §0.1 铁律：**绝不裸写 agent 坐标**——具体楼盘用调研 JSON 的 `refined_address` + `force_refine`，让 `research-merge` 经 Nominatim 落到楼栋（查不到则优雅降级到邮编中心）。

**台湾气候并行事故**：多 agent 同时 `manage.py climate` → archive 429 → 用缓存脚本，**禁止**再开第二个 climate 进程：

```bash
# 写者：ERA5 仍 429 时，先落盘再合并（不 migrate）
PYTHONUNBUFFERED=1 python3 tools/_tw_climate_fallback.py
# 或全库 extended dims 补烘焙（30s pacing + 磁盘 cache）
PYTHONUNBUFFERED=1 python3 tools/_climate_ext_refresh.py
```

## 3. enrichment（每步**幂等可续跑**，只补缺失行）

### 3.0 串行 enrich 命令顺序（单写者 · 禁止跳步）

**同一时刻只允许一个进程写 DB。** 按下列顺序跑；中断 / 429 后**从失败那条原样重跑**（幂等）：

```bash
python3 tools/manage.py geocode        # ① 经纬度（Nominatim ~1/s）
python3 tools/manage.py climate        # ② 月级气候 + 尽量 co-bake daily_climate
python3 tools/manage.py climate-daily  # ③ 仍缺 comfort/extreme 日曲线时
python3 tools/manage.py hist-temp      # ④ 历史最高/最低温（wiki → ERA5）
python3 tools/manage.py elevation      # ⑤ 海拔 DEM
python3 tools/manage.py relief         # ⑥ 地形起伏（hazard-merge 前置）
python3 tools/manage.py risk           # ⑦ 海岸/台风/地震暴露
python3 tools/manage.py pois           # ⑧ Overpass 周边（最慢）
python3 tools/manage.py pois-refix     # ⑨ 可疑 0m 医院 / 缺地铁城
python3 tools/manage.py lulu           # ⑩ LULU 7 类敏感设施距离（离线 ref + CA 本地 Overpass）⚠️ 易漏
python3 tools/manage.py pm25           # ⑪ 可选；大陆 PM2.5（需 tools/.venv）
python3 tools/manage.py hazard-merge data/hazard_research.json   # ⑫ 必跑
# 调研 merge（§4）插在 pois 之后、hazard-merge 之前或之后均可
python3 tools/manage.py built-merge … / research-merge …
python3 tools/manage.py hazard-merge data/hazard_research.json   # 新地市类型后重跑
```

> **⚠️ 最易漏：`lulu`** —— `pois` 只烘焙 airport/coast/hospital/mall/metro/train/hsr；**化工厂/垃圾填埋/焚化炉/变电站/污水处理厂/核设施/敏感设施** 7 类在 `poi` 表但由 **`manage.py lulu`** 单独写入（`source='osm-ref'`）。新批次 `pois` 后**必跑 `lulu`**，否则表格「敏感设施距离」列全空。California 走 `lulu` 内建的 `lulu_ca_local`（per-listing Overpass，慢）。

> 旧写法 `geocode && climate && …` 一键链仍可用，但**多 agent 场景必须拆成上表逐步执行**，写者不得在 agent 并行调研时后台挂 `climate`。

### 3.1 气候数据获取（ERA5 / Open-Meteo）

| 事实 | 说明 |
|------|------|
| **加权配额** | 全库 geocoded 行各跑一遍 `climate` + `climate-daily` ≈ **~235 次** archive 调用/轮（每坐标 1 次全量 daily 块）；同 IP **勿并行** `manage.py climate`。 |
| **并发限制** | 同一公网 IP 建议 **1 个** archive 消费者；多 agent 各自 `climate` = 必 429。 |
| **429 类型** | JSON `reason`：`minutely`（~1min）、`hourly`（等到 UTC 整点+75s）、`daily`（日配额，heavy 12 变量先挂）、`concurrent`（同时多连接）— `enrich._parse_open_meteo_429` 自动分流等待。 |
| **pacing** | 共享 IP 时请求间隔 **≥2.5s**；`_climate_ext_refresh.py` 默认 **30s/req**。 |
| **cache-first** | 429 或批量补洞：先 `data/.climate_daily_ext.json` / `data/research/tw-climate-cache-*.json`，再 merge 进 DB，**勿**多终端重复 fetch。 |
| **`climate` vs `climate-daily`** | `climate` 单次 `_fetch_era5_archive_daily` 同时写 `climate` 表 + `daily_climate`；仅缺 comfort 曲线时再 `climate-daily`。 |
| **light finisher** | 日配额耗尽、heavy 12 变量 429 但 3 变量仍可用时：`PYTHONUNBUFFERED=1 python3 tools/_finish_climate_light.py`（只补月 norm + 轻量 daily，**无** extended dims）。 |
| **extended dims 次日补** | `PYTHONUNBUFFERED=1 python3 tools/_climate_ext_refresh.py`（雪/湿度/日照等 extended dims）。 |

### 3.1a 连续底图 0.25°（CDS ERA5 bulk，免 archive 429）

| 事实 | 说明 |
|------|------|
| **问题** | `field --step 0.25` 对 ~5k `coarse_interp` 格点逐点打 Open-Meteo archive → 易 429。 |
| **推荐** | Copernicus CDS `derived-era5-single-levels-daily-statistics` 中国区 2014–2023 一次拉 NetCDF → `tools/era5_bulk.py` 双线性采样进 `field_grid_0.25.json`（`src: cds_era5`）。 |
| **凭证** | `~/.cdsapirc`（无凭证时 `era5-bulk download --dry-run` + `self-test` 验逻辑）。 |
| **海拔** | 仍用 Open-Meteo elevation API（`gridfield.fill_elevation`），与 CDS 无关。 |

```bash
pip install -r tools/requirements-era5.txt   # cdsapi xarray scipy netCDF4
python3 tools/manage.py era5-bulk download
python3 tools/manage.py era5-bulk sample     # 或 field --source cds --step 0.25
python3 tools/manage.py build
python3 tools/manage.py era5-bulk status
```

```bash
# 429 后恢复模板（写者单进程）
PYTHONUNBUFFERED=1 python3 tools/_finish_climate_light.py    # 先解 blocking gap
PYTHONUNBUFFERED=1 python3 tools/_climate_ext_refresh.py     # 再补 extended（慢）
python3 tools/manage.py climate        # 或重跑幂等主命令
```

### 3.2 分命令说明（与上表一致）

```bash
python3 tools/manage.py geocode        # 经纬度 Nominatim(~1/s, 带省份校验防跨省重名)
python3 tools/manage.py climate        # 月级气候 normals (Open-Meteo ERA5)
python3 tools/manage.py climate-daily  # 365 天日级曲线 —— 表格「舒适/极端日期」色条必需！
python3 tools/manage.py elevation      # 海拔 (Open-Meteo DEM, 批量)
python3 tools/manage.py relief         # 地形起伏 (DEM 环采样, 地质灾害降尺度用)
python3 tools/manage.py risk           # 离海岸 / 地震带 / 台风暴露 (离线+派生)
python3 tools/manage.py pois           # 周边 地铁/火车/医院/商场 (Overpass, 最慢最 flaky)
python3 tools/manage.py pois-refix     # 复核：0m 医院 / 轨交城缺 metro 等可疑 POI 重烘焙
python3 tools/manage.py lulu           # LULU 7 类敏感设施距离（离线 ref；California 本地 Overpass）
python3 tools/manage.py pm25           # 年均 + 采暖季 PM2.5（ChinaHighPM2.5；需 tools/.venv + netCDF4）
python3 tools/manage.py hazard-merge data/hazard_research.json   # ⚠️ 必跑！每小区灾害 = 地市类型 × 坐标物理频率
```

> **⚠️ 最易漏的两步：`lulu` + `hazard-merge`** —— `lulu` 补 7 类敏感设施距离（不在 `pois` 里）；
> `hazard-merge` 把每小区的 `hazards_local` 合成出来（地市真实灾种
> × 按坐标物理细化频率：台风按离海岸、地质灾害按地形起伏、采煤沉陷豁免）。**即便没为新地市单独
> 调研灾害，也必须跑**——新地市自动走**省级兜底**（用该省 `PROVINCE_HAZARDS` 类型 + 同样的物理
> 细化）。漏跑则新房源的「主要灾害·频率」列回退到粗略省级、缺逐小区细化。`relief` + `risk` 是它的
> 前置（已在上面跑过）。

> **易撞 Open-Meteo / Nominatim 429（限流）**：不是 bug，等几十秒~1 分钟**重跑同一条命令**，
> 只补没做完的行。小城 / 县城常 geocode 只到街道 / 城市级、查不到周边——属正常，优雅降级。

### 3.3 ⚠️ 改**已有房源**坐标后的重烘焙（清表 · `poi_done` 陷阱）

§3 的命令靠"该列为 NULL"判定 to-do。但**改一条已存在 listing 的 `lat/lng` 后，光 UPDATE 坐标不会触发重烘焙**——
旧富集还在、且**有独立 `poi_done` 表**（PK `listing_id`）标记"POI 已做"，`pois`/`lulu` 的 to-do 查询是
`id NOT IN (SELECT listing_id FROM poi_done)`，所以**删了 `poi` 行仍报 "0 to do"**。正确清表（单写者，按移动距离选范围）：

```sql
UPDATE listings SET lat=?,lng=?,geo_source='research',geo_label='调研纠偏' WHERE id=?;
DELETE FROM poi       WHERE listing_id=?;
DELETE FROM poi_done  WHERE listing_id=?;   -- ★ 不删这个，pois/lulu 永远跳过
-- 跨城/大幅移动(>~10km)：气候/海岸/灾害都变，连同清掉：
DELETE FROM climate   WHERE listing_id=?;
UPDATE listings SET elevation=NULL,daily_climate=NULL,terrain_relief=NULL,hazards_local=NULL,
  hist_temp_max=NULL,hist_temp_min=NULL,hist_temp_max_date=NULL,hist_temp_min_date=NULL,
  hist_temp_src=NULL,hist_temp_station=NULL,hist_temp_note=NULL,hist_temp_level=NULL,
  pm25_annual=NULL,pm25_heating=NULL,pm25_year=NULL,pm25_src=NULL WHERE id=?;
```

然后顺跑 §3.0 流水线（`climate`→`hist-temp`→`elevation`→`relief`→`risk`→`pois`→`pois-refix`→`lulu`→`pm25`→`hazard-merge`），
每条只碰被清空的那一行。**列名是 snake_case**（`pm25_annual` 非 emit 后的 `pm25Annual`）。
**改完坐标务必 `city-check --refresh --from <id> --to <id>` 复核**落回正确城市（见 §7）。
> 重烘焙会清掉旧 POI——若新（正确）坐标处 Overpass 没有医院，"最近医院"会暂缺（优雅降级，本就比错坐标算出的假距离诚实）；有需要再单独 `research-merge` 补。

### 3.4 入库后 POI / LULU 缺口审计（**2026-06-30 固化 · 易漏**）

`pois` 标记 `poi_done` 后**不会**自动补 hospital（Overpass 查不到时留空）或 LULU（根本不在 `pois` 路径里）。**每批 enrich 结束、全库定期巡检**必跑：

```bash
# ① 缺 hospital（name IS NULL）— 多为偏远文旅盘/海岛/乡镇
sqlite3 data/housing.db "
SELECT l.id, l.loc, l.city FROM listings l
LEFT JOIN poi p ON p.listing_id=l.id AND p.category='hospital'
WHERE l.lat IS NOT NULL AND p.name IS NULL ORDER BY l.id;"

# ② 缺 LULU 7 类任一（chemical/incinerator/landfill/nuclear/sensitive/substation/wastewater）
sqlite3 data/housing.db "
SELECT l.id, l.loc FROM listings l WHERE l.lat IS NOT NULL
  AND l.id NOT IN (
    SELECT DISTINCT listing_id FROM poi
    WHERE category IN ('chemical','incinerator','landfill','nuclear','sensitive','substation','wastewater')
  );"

# ③ 自动门禁（含 lulu_* + poi_hospital）
python3 tools/check_batch_complete.py --from <id0> --to <idN>
```

**补全路径：**

| 缺口 | 命令 | 说明 |
|------|------|------|
| **LULU 7 类** | `python3 tools/manage.py lulu` | 大陆/HK/TW 离线 ref 全库重算（~5min）；含 CA `lulu_ca_local` |
| **hospital 空** | 调研 JSON → `apply_hospital_gap_backfill.py` | `data/research/hospital-gap-backfill-*.json` 含 `hospital_name` + **`hospital_lat`/`hospital_lng`（WGS-84）**；Nominatim 429 时**禁止**裸跑 `research-merge` 25 条（太慢） |
| **hospital 0m 可疑** | `pois-refix` 或 `research-merge` | `_POI_REFIX_KM.hospital=0.5` |

```bash
# hospital 缺口 backfill（推荐：JSON 预填 WGS-84 坐标 + source URL）
python3 tools/apply_hospital_gap_backfill.py data/research/hospital-gap-backfill-<slug>.json
python3 tools/manage.py build
```

> **事故复盘（2026-06-30）**：#401/#402 入库后 enrich 漏跑 `lulu` → 7 类敏感设施全空；全库 25 条偏远盘 Overpass 无 hospital → 表格「最近医院」列空。根因：§3.0 流水线未列 `lulu`；`check_batch_complete` 未验 LULU。

## 4. 可选：联网调研补 房龄 / 新地市灾害类型（**反幻觉铁律**）

让 agent 产**可验证**的发现（带 source URL、核对城市防重名、查不到返回 null、**禁猜**），
再用确定性命令校验入库：

```bash
# 房龄(建成年代): findings=[{id, builtYear, yearText, source, confidence}, …]
python3 tools/manage.py built-merge findings.json --dry-run  # 预演：kept_existing = 将被跳过的已有调研
python3 tools/manage.py built-merge findings.json     # 校验 1900≤年≤(当年+3) / 有来源；仅填空或 approx→精确；禁覆盖已有精确年

# 周边 POI 缺口 / 0m 医院：findings=[{id, hospital_name?, metro_name?, train_name?, refined_address?, sources}, …]
python3 tools/manage.py research-merge findings.json --dry-run
python3 tools/manage.py research-merge findings.json  # 城市限定 geocode；仅填空或替换可疑近距离 OSM；保留 source=research 且距离合格的 POI

# (可选) 新地市的真实灾情史 → 追加进 data/hazard_research.json（{findings:[{prefKey:"省|地级市", headline, hazards:[…]}]}）
#        然后重跑上面第 3 步的 hazard-merge，新地市就从「省级兜底」升级为「地市调研类型」
```

> `built-merge` **可选**（没查到 built_year 就跳过，前端显示「年代未知」）；但第 3 步的
> `hazard-merge` **不可选**（必须有 `hazards_local`）。调研产物存 `data/research/`、
> `data/hazard_research.json`（provenance，可复跑）。详见 README 对应小节。

### enrich 不得覆盖已有调研字段（铁律）

**任何 merge 写 DB 前必须先 `--dry-run`**，核对 `kept_existing` / 将跳过行数 > 0 即正常（说明保护生效）。

| 字段 | 合并命令 | 规则 | 预演 |
|------|----------|------|------|
| `built_year` | `built-merge` | **仅填空**或 **approx→精确升级**；禁止 null/approx/另一精确年覆盖已有精确年 | `built-merge --dry-run` → `kept_existing` |
| `poi.hospital` 等 | `research-merge` / `pois-refix` | **仅填空**或替换 **可疑近距离 OSM**；`source=research` 且 `dist_km≥floor` 禁止覆盖 | `research-merge --dry-run` |
| `poi.hospital_tier3` | `hospital-tier3-merge` | 仅当无 tier3 或新距离**更近**时写入 | — |
| `rent` | `apply_rent_backfill.py` | 仅当 research JSON 含 portal URL；**估算只允许写在 JSON**（`method:estimate`），禁止 cap-rate 入库 | 人工 diff research JSON |
| `hazards_local` | `hazard-merge` | 重算物理频率；**不删** `hazard_research.json` 中已有 prefKey 类型 | 对比 `headline` 是否仍为省级兜底 |

实现：`enrich._built_year_merge_action`、`_poi_should_replace`。调研 agent **只追加** JSON；写者 `--dry-run` 通过后再正式 merge。

```bash
python3 tools/manage.py built-merge data/research/built-year-foo.json --dry-run
# 输出 kept_existing: N  →  N 条已有精确年将被保护
python3 tools/manage.py research-merge data/research/listing-batch-foo.json --dry-run
```

## 4.5 新批次完成定义（build 前 checklist）

**标记本批「完成」前**，写者必须全绿（可用脚本自动验）：

```bash
python3 tools/check_batch_complete.py --from <首批id> --to <末批id>
# 输出 BATCH_COMPLETE_OK 方可 build；否则按 missing 字段回 §3 补跑
```

| # | 门禁项 | 验证方式 |
|---|--------|----------|
| 1 | **去重预检** | §1 `loc LIKE` 全库扫描已完成 |
| 2 | **geocode** `lat`/`lng` | `check_batch_complete` → `geocode_lat_lng` |
| 3 | **climate 12 月** + **daily_climate**（comfort/extreme） | `climate_12mo` + `daily_climate` |
| 4 | **elevation** | `elevation` |
| 5 | **relief** + **risk** + **hazard-merge** | `relief`/`risk`/`hazards_local`；若 `hazard_research.json` 已有该 `prefKey` 则不得 `hazard_merge_prefecture`（省级 headline 兜底） |
| 6 | **POI** hospital / train / airport / coast / hsr + 轨交城 **metro** | `poi_*`；`poi_done` 行存在 |
| 6b | **LULU 7 类** sensitive-facility 距离 | `lulu_*`（`manage.py lulu` 后 `check_batch_complete` 全绿） |
| 7 | **built_year** 有来源 **或** research JSON `confidence:none` 建档 | `built_year_or_documented_unknown` |
| 8 | **rent** portal 调研 **或** JSON 注明无市场（估算仅 JSON） | `rent_or_research`（`rent>0` 或 rent-backfill 条目） |
| 9 | **hist_temp_max/min** | `hist_temp_max_min`（`manage.py hist-temp`） |
| 10 | **tier1-check** | `manage.py tier1-check` 默认可见套数符合预期 |
| 11 | **build + smoke** | `manage.py build` → `node tools/_smoke.js`；失败则同步 `_smoke.js` 硬编码套数 |
| 12 | **POI 缺口审计** | §3.4 SQL 零行 + 全库 `check_batch_complete` 无 `poi_hospital`/`lulu_*` |

```bash
python3 tools/manage.py hist-temp
python3 tools/manage.py tier1-check
python3 tools/check_batch_complete.py --from 357 --to 359
python3 tools/manage.py build
node tools/_smoke.js
```

## 5. 默认视图过滤（**自动判断，勿手填 id 列表**）

明显贵于「便宜小城」基调的样本，入库后由代码**按阈值自动**从默认表格 / 图表 / 地图与标题
`N套/N省` 计数中排除：

| 条件 | 阈值 |
|------|------|
| 总价 | `priceWan > 20`（万元） |
| 单价 | `priceWan × 10000 ÷ area > 5000`（元/㎡） |

满足**任一**即过滤。实现位置（两处常量须一致）：

- `assets/js/app.js` → `isDefaultHidden()`（`TIER1_MAX_PRICE_WAN` / `TIER1_MAX_UNIT_YUAN`）
- `tools/manage.py` → `is_default_hidden()`（同名常量）

**入库后必跑**（核对本批哪些会被过滤、默认可见套数是否符合预期）：

```bash
python3 tools/manage.py tier1-check
```

示例输出：`default visible: 123 / 163`，并逐条列出超阈值样本及触发原因（总价 / 单价）。

> 页脚有「**显示全部**」checkbox（`#tier1-toggle`），**不加解释文案**——公众默认只见小城样本，知情者可自行展开。
>
> **禁止**再维护手写 `TIER1_IDS` id 列表；改阈值只改上述两处常量。

## 6. build（重新生成所有产物 + 同步页面）

```bash
python3 tools/manage.py build
```

一次性：① 重写 `listings.js / enriched.js / hazards.js / field.js`；② 刷新 `listings.csv` 镜像；
③ 就地把 `index.html` 的「N套 / N省 / 覆盖N省 / 日期范围」同步到 DB（页脚「网页更新于」由前端读 GitHub 最近 commit，无需 build）（超阈值样本
不计入标题数，与 `is_default_hidden()` 一致）。找不到某 token 会打印 `! … update manually` 警告，不静默失败。

> **页面计数不写死**：hero 的「N套 / N省」既由 build 烘焙进静态 HTML（SEO / 无 JS 兜底），
> 又由 `app.js` `syncHeroCounts()` **运行时按实际数据动态显示**——所以从任何渠道加了城市，
> 页面数字都会跟着变，不会卡在某个旧数。
>
> **方法论 §房龄不写具体套数**：`index.html` methodology 段的房龄说明只描述口径（精确 /
> 「约」/ 未知），**禁止**写「已覆盖 N 套」——样本会持续扩充；`build` 的 `sync_html` 亦不会
> 改写该段（见 `manage.py` 注释）。

## 7. 验证 + 提交

**增删 listings 行后必做（顺序固定）：**

```bash
python3 tools/check_batch_complete.py --from <id0> --to <idN>   # 或整库；须 BATCH_COMPLETE_OK
python3 tools/manage.py city-check --from <id0> --to <idN>      # ★ 错城核查；须 CITY_CHECK_OK（见下）
python3 tools/manage.py tier1-check
python3 tools/manage.py build          # ① 重生成 assets/data/*.js + sync index.html 计数
node tools/_smoke.js                   # ② 无头冒烟（DOM/Chart/表格路径）
```

> **★ `city-check`（错城/错省核查，2026-06 固化）**：geocode **只校验省**（top-5 取首个省份匹配），所以
> **同省落错市**会漏（实测 372 库里 11 个：芜湖盘误落合肥蜀山区、山西介休误落浙江…）。`city-check` 对每条
> listing 的 `(lat,lng)` 做 **Nominatim reverse-geocode**，核对实际行政区是否含标称**地级市/省**；不含即 flag
> 到 `data/research/_city_mismatch.json` 并 `CITY_CHECK_FAIL`（exit 1）。结果**缓存**（`data/research/.revgeo_cache.json`，
> gitignored），re-run 只查新坐标（加房后 `--from/--to` 仅核查本批，秒级）。撞 flag → 派 agent 查正确城市内
> 真实坐标 → 改 `lat/lng` → 按 [[§3]] 清 `poi_done`/`climate` **全套重烘焙** → 再 `city-check` 复核落回正确城市。

若 smoke 报 `listings N` / `table count …` 失败 → **同步 `tools/_smoke.js` 里写死的套数**（与 build 后实际一致）：

| `_smoke.js` 断言 | 含义 |
|------------------|------|
| `listings N` / `enriched N` | `HOUSING_LISTINGS` 总行数 |
| `table count X default` | 默认视图可见套数（`tier1` 过滤后） |
| `table count N tier1` | 「显示全部」开启后的总行数 |

改完 `_smoke.js` 再跑 `node tools/_smoke.js` 直至 `SMOKE_OK`。`manage.py build` **不会**自动改 `_smoke.js`。

```bash
# 浏览器打开 demos/china-housing/index.html（file:// 也行），确认：
#   新房源出现在 表格 / 地图 / 排行；hero 计数已更新；0 个 console error。
git add -A
git commit -m "china-housing: +N listings (城市名…)"    # 作者须 AddinCui；禁止 Co-authored-by
git push origin master
```

## 速查 · 最小闭环

```bash
# ① 调研阶段（多 agent 并行，只写 JSON）
#    data/research/*.json + hazard_research 追加 prefKey

# ② 写者单进程入库 + enrich（§1 去重 → import → §3 串行 enrich → §4 merge）
sqlite3 data/housing.db "SELECT id,loc,city,dist,priceWan,area,updated FROM listings WHERE loc LIKE '%关键词%';"
python3 tools/manage.py import-csv data/batch-<slug>.csv
python3 tools/manage.py geocode
python3 tools/manage.py climate && python3 tools/manage.py climate-daily
python3 tools/manage.py hist-temp
python3 tools/manage.py elevation && python3 tools/manage.py relief && python3 tools/manage.py risk
python3 tools/manage.py pois && python3 tools/manage.py pois-refix
python3 tools/manage.py lulu
python3 tools/manage.py hazard-merge data/hazard_research.json
python3 tools/manage.py built-merge data/research/built-year-<slug>.json --dry-run
python3 tools/manage.py built-merge data/research/built-year-<slug>.json
python3 tools/manage.py research-merge data/research/listing-batch-<slug>.json --dry-run
python3 tools/manage.py research-merge data/research/listing-batch-<slug>.json
# (新省份? §2 PROV_FULL + PROVINCE_HAZARDS/HEATING；境外 §2.5)
python3 tools/check_batch_complete.py --from <id0> --to <idN>
python3 tools/manage.py city-check --from <id0> --to <idN>   # ★ 错城核查；须 CITY_CHECK_OK（§7）
python3 tools/manage.py tier1-check
python3 tools/manage.py build
node tools/_smoke.js
# 429 气候兜底: _finish_climate_light.py → _climate_ext_refresh.py（§3.1）
```
