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
