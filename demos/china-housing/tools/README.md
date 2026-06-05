# china-housing 数据维护

这个 demo 是 **纯静态站**（GitHub Pages，无后端）。页面读取一个 JS *全局变量*
`window.HOUSING_LISTINGS`（在 `assets/data/listings.js`）而非 fetch JSON —— 这样
`file://` 直接打开也能跑。所以那个 `.js` 是**生成产物**，不要手改。

可编辑的真相在 SQLite：

```
data/housing.db                 ← source of truth（普通 SQLite 文件）
      │   python3 tools/manage.py build
      ▼
assets/data/listings.js         ← 生成：页面读取 window.HOUSING_LISTINGS
data/listings.csv               ← 生成：可读 / 可 diff 的镜像
index.html                      ← 就地同步「N 套 / N 省 / 日期范围」等文案
```

零第三方依赖，Python 3.9+ 标准库即可。所有命令在 `demos/china-housing/` 下运行
（脚本按自身位置定位路径，cwd 在哪都行）。

## 常用：加房源 → 重新生成 → 提交

**加一条**（id 自动取下一个空号；`--updated` 接受 `2026.5` 或 `2026-05`）：

```bash
python3 tools/manage.py add \
  --prov 山西 --city 大同市 --dist 平城区 --loc 某某小区 \
  --price-wan 9.5 --area 55 --rent 500 --updated 2026.5
```

**批量加**（CSV 表头：`id,prov,city,dist,loc,priceWan,area,rent,updated`，
`id` 留空则自动分配；已存在的 id 会被覆盖更新）：

```bash
python3 tools/manage.py import-csv 新一批.csv
```

**重新生成所有产物**（每次改完 DB 后必跑）：

```bash
python3 tools/manage.py build
```

`build` 会一次性：① 重写 `assets/data/listings.js`；② 刷新 `data/listings.csv` 镜像；
③ 就地把 `index.html` 里的「N 套 / N 个省 / 日期范围 / 页脚更新于」改成最新值
（找不到某个 token 会打印 `! ... update manually` 警告，不会静默失败）。

**提交**（把 DB、生成的 js、csv、改动的 index.html 一起提交）：

```bash
git add -A && git commit -m "housing: +N listings"
```

> ⚠️ 新省份要单独补一处：地图着色用的短名→GeoJSON 全名映射在
> `assets/js/app.js` 的 `PROV_FULL`。若引入了表里没有的省份（如新增「西藏」），
> 在那里加一行 `'西藏': '西藏自治区',`，否则该省在 ECharts 地图上不会着色
> （柱状图和数据表不受影响）。`build` 不动 `app.js`。

## 全部命令

| 命令 | 作用 |
|------|------|
| `init` | 建库 + 建表（幂等） |
| `import-js [路径]` | 从旧的 `listings.js` 解析导入（一次性 bootstrap，默认本 demo 的 js） |
| `import-csv <路径>` | 从 CSV upsert（按 id 覆盖） |
| `add --prov ... --updated ...` | 加 / 改单条 |
| `build` | 重新生成 `listings.js` + `listings.csv` + 同步 `index.html` |
| `export-csv [路径]` | 仅导出 CSV（默认 `data/listings.csv`） |
| `list` | 打印汇总：条数、id 区间、缺号、各省分布 |

## 直接用 SQL

`housing.db` 就是普通 SQLite 文件，可用任何工具改，改完跑一次 `build` 即可：

```bash
sqlite3 data/housing.db "UPDATE listings SET rent=550 WHERE id=42;"
python3 tools/manage.py build
```

## 字段说明

| 字段 | 含义 | 单位 |
|------|------|------|
| `id` | 源表 序号 | — |
| `prov` / `city` / `dist` / `loc` | 省 / 城市 / 区·乡·镇·村 / 具体位置（小区） | — |
| `priceWan` | 二手房总价 | 万元 |
| `area` | 面积 | ㎡ |
| `rent` | 租金 | 元/月 |
| `updated` | 更新日期 | `YYYY-MM` |

单价、毛租金回报率、回本年限等派生指标由 `assets/js/app.js` 实时计算，不入库。

## 关于把 `.db` 提交进 git

`housing.db` 是二进制，diff 不可读，但小、且让 clone 即得可用库。真正用于 review 的是
`data/listings.csv`（文本、可 diff）。若不想跟踪二进制，可在 `.gitignore` 忽略
`*.db`，需要时用 `init` + `import-csv data/listings.csv` 从 CSV 重建。

## 地图省界数据（`assets/data/china-geo.js`）

省份 choropleth 的边界几何**已 vendored 到本地**（`window.CHINA_GEO` 全局），
`app.js` 本地优先、远程 Aliyun 兜底，所以离线 / `file://` / 断网都能出图，不再依赖
运行时第三方请求。它和 listings 一样不是手改的——来源与重生成命令写在
[`assets/data/china-geo.js`](../assets/data/china-geo.js) 文件头：

```bash
curl -o /tmp/china_full.json https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
npx -y mapshaper /tmp/china_full.json -filter-fields name -simplify 20% keep-shapes \
    -o /tmp/china.json precision=0.001 format=geojson
# 再包成 `window.CHINA_GEO = <json>;`（见文件头注释）
```

> 务必继续用 Aliyun DataV 这份（PRC 合规底图：含南海九段线 feature `100000_JD`、
> 台湾作为省）。**别换** Natural Earth / world-atlas 等国外源——它们多不含九段线、
> 且把台湾单列。新增省份的着色映射仍在 `app.js` 的 `PROV_FULL`（见上面的警告）。

## 数据增强（地图打点 / 卫星图 / 周边 / 气候）

每个小区的经纬度、气候 normals、周边 POI、灾害风险都在 **build 时离线烘焙**进
`housing.db`，再随 `build` 吐成静态全局 `assets/data/enriched.js`（按 id 索引）。
页面因此**不在运行时发地理编码/POI/气候请求**——只有用户点开「🛰 查看」弹窗时才按需
streaming 地图瓦片（Esri 卫星 / OSM 街道）。逻辑全在 [`tools/enrich.py`](enrich.py)。

数据源（全免费、无 key、全 WGS-84，故无需 GCJ-02 转换）：

| 类别 | 源 | 说明 |
|------|----|------|
| 经纬度 | Nominatim (OSM) | 逐级回退：小区→街道/镇→城市；**带省份校验**（拒绝「恒大/碧桂园」这类全国重名的跨省误配）；`geo_label` 记录定位精度。 |
| 气候 | Open-Meteo Archive (ERA5) | 2014–2023 日值聚合成 12 个月 normals（均温/高/低 + 降水）。 |
| 周边 | Overpass (OSM) | 最近 地铁 / 火车·高铁 / 医院 / 商场。OSM 小城覆盖差，**搜不到属正常**。 |
| 机场·海边 | OurAirports + Natural Earth（离线 `data/ref/`） | 离线算最近 CN 机场 / 海岸线距离，不打 API。 |
| 风险 | 派生 | 距海距离 + 省级地震动概念带（GB18306）+ 台风暴露启发式。**粗略近似，非工程依据**。 |

### 命令

```bash
python3 tools/manage.py enrich     # 跑全部：geocode → climate → risk → pois（可续跑、限速）
# 或分阶段：
python3 tools/manage.py geocode    # 仅经纬度（Nominatim ~1/s；--force 重跑已有坐标）
python3 tools/manage.py climate    # 仅气候
python3 tools/manage.py risk       # 仅风险（离线，秒级）
python3 tools/manage.py pois       # 仅周边（Overpass，最慢/最 flaky）
python3 tools/manage.py build      # 重新生成 enriched.js（连同 listings.js / csv / index.html）
```

每个阶段**幂等可续跑**——只补缺失行，中断后重跑即可。Nominatim 限速 1/s 且带真实
User-Agent（其使用政策）；Overpass 易 504，已做多镜像重试。新增小区后只需再跑一次
`enrich` + `build`（已编码的行会跳过）。

### 前端

- 地图「📍 小区位置」选项 → 把所有已定位小区 `effectScatter` 打点到省图上（点击圆点开弹窗）。
- 表格「详情」列「🛰 查看」→ 弹窗三 tab：**卫星图**（Esri）/ **周边**（OSM 街道 + POI 圆点 + 距离）/ **气候**（Chart.js 月度温度·降水 + 风险摘要）。
- 未定位的行详情列显示 `—`；缺某类 POI 时该项显示「—」。所有缺失都**优雅降级**，不报错。

> ⚠️ 定位精度：小区名常搜不到，多回退到街道/城市级，弹窗顶部会标「定位 城市级」等。
> 灾害风险是**省级粗略近似**，仅供直观参考。`data/ref/`（机场/海岸线）和 `*.db` 一样可提交。

## 子代理深度调研（research-merge）

API 管线对小城/县城覆盖差（很多小区只到街道/城市级、缺医院/商场）。对这些缺口，用
**并行子代理 web 调研**补齐——但**绝不**让 agent 直接写坐标（会幻觉）。混合法：

1. **agent 只产可验证的名字/地址**（带 source URL，查不到返回 null、禁猜）。每城一个 agent，
   按城市分组 fan-out（见生成的 Workflow 脚本；目标 = `geo_level in (city,dist)` 或缺医院的小区）。
2. **确定性代码换坐标**：`manage.py research-merge <findings.json>` 把每个名字/地址喂 Nominatim，
   **省 bbox + 距锚点 < 60km** 校验；地址带门牌号会自动去号回退；POI 距离用细化后的坐标重算；
   风险摘要随之重算。
3. **provenance**：细化的定位标 `geo_source='research'`、POI 标 `poi.source='research'`，
   前端「周边」列表对应项显示橙色「调研」微标；能换到坐标的打点，换不到的保留**名字(未定位)**。
4. **大幅纠正复核**：位置移动 > 25km 的会在报告里列出（agent 调研常能**纠正原 geocode 错误**，
   但大幅移动需人眼确认）。

```bash
# findings.json = agent 返回的 [{id, refined_address, hospital_name, mall_name, metro_name, sources, notes}, …]
python3 tools/manage.py research-merge findings.json
python3 tools/manage.py build
```

merge 只**补缺**（不覆盖 OSM 已有 POI），幂等可重跑。findings 可来自任意调研流程，只要符合上面的
对象结构即可。

## 房龄 / 完工年份（built-merge）

每个小区的**建成年代（完工年份）**同样用子代理联网调研补齐，但因其极易被幻觉，走一条**独立的、带确定性校验门**的合并通道（`listings.built_year` / `built_year_src` / `built_year_approx` 三列）：

1. **agent 只产可验证年份**：联网查 贝壳 / 安居客 / 房天下 的「建成年代」字段，覆盖不到的（老破小 / 厂矿家属院）再换**老旧小区改造名单 / 地方志 / 厂史 / 政府征收公告 / 楼盘库 / 百度高德**；**核对页面城市/省份防重名**，给出 `source`（URL）+ `yearText`（原文引用）+ `confidence`；查不到返回 `builtYear:null, confidence:"none"`，**禁猜**（搜索摘要里的年份若打开页面核不到即弃用）。多期楼盘取**最早一期**。
2. **三档置信**：`high`/`med` = 权威页明确年份；`approx` = 仅查到**可信来源的年代级估算**（如改造名单「建于上世纪90年代」、三线厂史「XX年投产、家属楼随建」），`built_year_approx=1`，前端标**「约」**+ 虚线圈以示非精确。
3. **确定性校验门**（`enrich.merge_built_years`）：仅当 `confidence∈{high,med,approx}` **且**有来源 **且** `1900≤year≤2026` **且** 不晚于挂牌年(+1 容差) 才入库；`approx` **不覆盖**已有精确年份（精确优先）；其余一律留空（前端「年代未知」）。`rejected` 打印所有被拒原因。

```bash
# findings.json = [{id, builtYear, yearText, source, confidence, note}, …]（或 {findings:[…]}）
python3 tools/manage.py built-merge findings.json
python3 tools/manage.py build   # 把 built_year 吐进 enriched.js（前端「房龄」色条：绿=新→琥珀=老，约=虚线圈）
```

幂等可重跑（重跑覆盖同 id 的更优证据，但 approx 不降级已有精确）。两轮并行 agent（首轮贝壳系，次轮改造名单/厂史等深挖）共覆盖 **71 / 121** 套（58 精确 + 13 约，含 1935 历史街区与 1960s 三线厂宿舍）；其余 50 套公开渠道暂无。
