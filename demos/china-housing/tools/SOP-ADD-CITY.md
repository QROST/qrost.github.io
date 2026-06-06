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

## 2. ⚠️ 新省份必做三处（否则地图不着色、灾害 / 供暖缺失）

只在引入了**之前没有的省 / 直辖市**时需要：

| 文件 | 加什么 |
|------|--------|
| `assets/js/app.js` → `PROV_FULL` | `'西藏': '西藏自治区'`（短名→DataV GeoJSON 全名，地图着色用） |
| `tools/enrich.py` → `PROVINCE_HAZARDS` | `'西藏': {"headline": "…", "hazards": [("地震", 3, "…"), …]}` |
| `tools/enrich.py` → `PROVINCE_HEATING` | `'西藏': HEAT_HEATED`（或 PARTIAL / WARM / DAMP） |

## 3. enrichment（每步**幂等可续跑**，只补缺失行）

按顺序跑（或挑需要的）。中断 / 限流后**原样重跑**即可：

```bash
python3 tools/manage.py geocode        # 经纬度 Nominatim(~1/s, 带省份校验防跨省重名)
python3 tools/manage.py climate        # 月级气候 normals (Open-Meteo ERA5)
python3 tools/manage.py climate-daily  # 365 天日级曲线 —— 表格「舒适/极端日期」色条必需！
python3 tools/manage.py elevation      # 海拔 (Open-Meteo DEM, 批量)
python3 tools/manage.py relief         # 地形起伏 (DEM 环采样, 地质灾害降尺度用)
python3 tools/manage.py risk           # 离海岸 / 地震带 / 台风暴露 (离线+派生)
python3 tools/manage.py pois           # 周边 地铁/火车/医院/商场 (Overpass, 最慢最 flaky)
python3 tools/manage.py hazard-merge data/hazard_research.json   # ⚠️ 必跑！每小区灾害 = 地市类型 × 坐标物理频率
```

> **⚠️ 最易漏的一步是 `hazard-merge`** —— 它把每小区的 `hazards_local` 合成出来（地市真实灾种
> × 按坐标物理细化频率：台风按离海岸、地质灾害按地形起伏、采煤沉陷豁免）。**即便没为新地市单独
> 调研灾害，也必须跑**——新地市自动走**省级兜底**（用该省 `PROVINCE_HAZARDS` 类型 + 同样的物理
> 细化）。漏跑则新房源的「主要灾害·频率」列回退到粗略省级、缺逐小区细化。`relief` + `risk` 是它的
> 前置（已在上面跑过）。

> **易撞 Open-Meteo / Nominatim 429（限流）**：不是 bug，等几十秒~1 分钟**重跑同一条命令**，
> 只补没做完的行。小城 / 县城常 geocode 只到街道 / 城市级、查不到周边——属正常，优雅降级。

## 4. 可选：联网调研补 房龄 / 新地市灾害类型（**反幻觉铁律**）

让 agent 产**可验证**的发现（带 source URL、核对城市防重名、查不到返回 null、**禁猜**），
再用确定性命令校验入库：

```bash
# 房龄(建成年代): findings=[{id, builtYear, yearText, source, confidence}, …]
python3 tools/manage.py built-merge findings.json     # 校验 1900≤年≤2026 / ≤挂牌年 / 有来源；approx 不降级精确

# (可选) 新地市的真实灾情史 → 追加进 data/hazard_research.json（{findings:[{prefKey:"省|地级市", headline, hazards:[…]}]}）
#        然后重跑上面第 3 步的 hazard-merge，新地市就从「省级兜底」升级为「地市调研类型」
```

> `built-merge` **可选**（没查到 built_year 就跳过，前端显示「年代未知」）；但第 3 步的
> `hazard-merge` **不可选**（必须有 `hazards_local`）。调研产物存 `data/research/`、
> `data/hazard_research.json`（provenance，可复跑）。详见 README 对应小节。

## 5. 隐藏「高价 / 一线参考」房源（默认不显示、不计入标题）

某些房源（一线城市、或明显贵于「便宜小城」基调的盘）**不该污染默认视图与标题计数**。
**经验阈值**：`总价 > 20 万` **或** `单价 > 5000 元/㎡` → 归入隐藏参考集。把它们的 id 加进
**两处并保持一致**：

- `assets/js/app.js` → `const TIER1_IDS = new Set([...])`（前端默认 filter 掉，footer toggle 才显示）
- `tools/manage.py` → `TIER1_IDS = {...}`（标题 `N套/N省` 计数排除它们）

> 变量名沿用 `TIER1_IDS`（最初只放一线超豪宅），现已泛化为「**高价参考集**」。footer toggle
> 文案因此是「**显示高价参考**」——**不要写死「一线」**：隐藏集里多数是高价度假盘 / 改善盘，并非
> 一线城市。

## 6. build（重新生成所有产物 + 同步页面）

```bash
python3 tools/manage.py build
```

一次性：① 重写 `listings.js / enriched.js / hazards.js / field.js`；② 刷新 `listings.csv` 镜像；
③ 就地把 `index.html` 的「N套 / N省 / 覆盖N省 / 日期范围 / 页脚更新于」同步到 DB（**tier-1 不计入**
标题数）。找不到某 token 会打印 `! … update manually` 警告，不静默失败。

> **页面计数不写死**：hero 的「N套 / N省」既由 build 烘焙进静态 HTML（SEO / 无 JS 兜底），
> 又由 `app.js` `syncHeroCounts()` **运行时按实际数据动态显示**——所以从任何渠道加了城市，
> 页面数字都会跟着变，不会卡在某个旧数。

## 7. 验证 + 提交

```bash
# 浏览器打开 demos/china-housing/index.html（file:// 也行），确认：
#   新房源出现在 表格 / 地图 / 排行；hero 计数已更新；0 个 console error。
git add -A
git commit -m "china-housing: +N listings (城市名…)"    # 作者须 AddinCui；禁止 Co-authored-by
git push origin master
```

## 速查 · 最小闭环

```bash
python3 tools/manage.py import-csv 新城市.csv
python3 tools/manage.py geocode && python3 tools/manage.py climate && \
python3 tools/manage.py climate-daily && python3 tools/manage.py elevation && \
python3 tools/manage.py relief && python3 tools/manage.py risk && python3 tools/manage.py pois && \
python3 tools/manage.py hazard-merge data/hazard_research.json   # ← 别漏！每小区灾害
# (新省份? 先改 app.js PROV_FULL + enrich.py PROVINCE_HAZARDS/HEATING)
# (高价/一线? 把 id 加进 app.js + manage.py 的 TIER1_IDS 两处)
python3 tools/manage.py build
```
