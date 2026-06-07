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

> **⚠️ 入库前必做：去重预检**。`import-csv` 的 id 留空＝**新增**，不会跟主库已有的同盘合并——
> 一不留神就造出「富力湾 19万」和已有「富力湾 12万」两条重复。**导入前**先按 loc 查主库
> （尤其 恒大 / 碧桂园 / 融创 这类**跨城复用的品牌盘名**）：
>
> ```bash
> # 把每个待加 loc 的关键词查一遍；品牌盘再按品牌扫一遍
> sqlite3 data/housing.db "SELECT id,city,dist,loc,priceWan FROM listings WHERE loc LIKE '%富力湾%';"
> sqlite3 data/housing.db "SELECT id,city,loc,priceWan FROM listings WHERE loc LIKE '碧桂园%';"
> ```
>
> 按命中情况处置：① **主库已有同一个盘**（同城同盘）→ 跳过，或若新价更可信就用**相同 id** 覆盖；
> ② **同品牌不同城**（如贵州 vs 宜昌的「碧桂园凤凰城」）→ **loc 加城市消歧**：`碧桂园凤凰城（宜昌）`，
> 否则表格里两行同名难辨；③ 主库的同盘更便宜 → 一般**保留更便宜那条、跳过新的**（本数据集主打「最便宜」）。

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
python3 tools/manage.py pois-refix     # 复核：0m 医院 / 轨交城缺地铁 等可疑 POI 重烘焙
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

# 周边 POI 缺口 / 0m 医院：findings=[{id, hospital_name?, metro_name?, train_name?, refined_address?, sources}, …]
python3 tools/manage.py research-merge findings.json  # 城市限定 geocode；覆盖可疑近距离 OSM 误标

# (可选) 新地市的真实灾情史 → 追加进 data/hazard_research.json（{findings:[{prefKey:"省|地级市", headline, hazards:[…]}]}）
#        然后重跑上面第 3 步的 hazard-merge，新地市就从「省级兜底」升级为「地市调研类型」
```

> `built-merge` **可选**（没查到 built_year 就跳过，前端显示「年代未知」）；但第 3 步的
> `hazard-merge` **不可选**（必须有 `hazards_local`）。调研产物存 `data/research/`、
> `data/hazard_research.json`（provenance，可复跑）。详见 README 对应小节。

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
③ 就地把 `index.html` 的「N套 / N省 / 覆盖N省 / 日期范围 / 页脚网页更新于（build 时刻）」同步到 DB（超阈值样本
不计入标题数，与 `is_default_hidden()` 一致）。找不到某 token 会打印 `! … update manually` 警告，不静默失败。

> **页面计数不写死**：hero 的「N套 / N省」既由 build 烘焙进静态 HTML（SEO / 无 JS 兜底），
> 又由 `app.js` `syncHeroCounts()` **运行时按实际数据动态显示**——所以从任何渠道加了城市，
> 页面数字都会跟着变，不会卡在某个旧数。
>
> **方法论 §房龄不写具体套数**：`index.html` methodology 段的房龄说明只描述口径（精确 /
> 「约」/ 未知），**禁止**写「已覆盖 N 套」——样本会持续扩充；`build` 的 `sync_html` 亦不会
> 改写该段（见 `manage.py` 注释）。

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
# 先去重预检(见 §1)：品牌盘按 loc LIKE 扫主库，决定 跳过 / 改名消歧 / 覆盖
sqlite3 data/housing.db "SELECT id,city,loc,priceWan FROM listings WHERE loc LIKE '%关键词%';"
python3 tools/manage.py import-csv 新城市.csv
python3 tools/manage.py geocode && python3 tools/manage.py climate && \
python3 tools/manage.py climate-daily && python3 tools/manage.py elevation && \
python3 tools/manage.py relief && python3 tools/manage.py risk && python3 tools/manage.py pois && \
python3 tools/manage.py hazard-merge data/hazard_research.json   # ← 别漏！每小区灾害
# (新省份? 先改 app.js PROV_FULL + enrich.py PROVINCE_HAZARDS/HEATING)
python3 tools/manage.py tier1-check   # 自动核对超阈值过滤（§5）
python3 tools/manage.py build
```
