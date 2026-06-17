# 数渊 · Data Abyss

一件交互式新媒体 / generative-art 网页：把 **china-housing**（347 座城的气候·海拔·灾害·房价）与 **china-industrial-software**（325 产品 / 43 内核 / 269 突破 / 123 政策 / 220 厂商 / 64 对标）两套真实数据，全部生灵化成漂浮在三维数渊中的发光星体。Three.js WebGL + UnrealBloom + 雾景深。手机端 full-bleed，可接入陀螺仪 / 麦克风。

## 结构

- `index.html` — full-bleed 容器 + 引入 housing 全局 script + Three.js importmap
- `app.js` — 全部场景逻辑（数据载入、通感编码、渲染、交互）
- `style.css` — full-bleed / overlay UI

数据来自**同仓库的兄弟 demo**（相对路径引用，不复制）：
- housing：`<script src="../china-housing/assets/data/{listings,enriched,hazards}.js">` → `window.HOUSING_*`
- industrial：runtime `fetch('../china-industrial-software/assets/data/...')`

## 通感编码语法（映射不必符合逻辑，但把数据用满）

**气候层（下层 · 悬浮的中国浮雕）— 每座城一颗星**
| 字段 | 视觉通道 |
|---|---|
| 经度 / 纬度 / 海拔 | 三维位置（x / z / y） |
| 单价 priceWan·area | 星体大小 |
| 宜居天数 comfortDayCount | 色相（蓝少→暖绿多） |
| 年温差 tempRange | 饱和度（大陆性越强越浓） |
| 日照 sunshineHours | 亮度 |
| 灾害负担 Σ2^(freq-1) | 明灭幅度（越危险越颤） |
| 楼龄 builtYear | 明灭速度（越新越快） |
| PM2.5 pm25Annual | 雾晕 halo |
| 人口外流 popChangePct | 暗淡（外流城黯淡） |

**自立层（上层 · 发光星网）**
| 实体 | 编码 |
|---|---|
| 产品 product | 位置=按品类聚团·国产内/国外外 · 色=出身(国产金/开源绿/国外蓝) · 大小=成熟度 · 明灭=本地化深度 · 雾晕=1−置信度 · 连线→依赖内核 |
| 内核 kernel | 内圈大核 · 大小=被多少产品使用 |
| 突破 milestone | 高度=年份(1990→2026) · 角度=能力 capability_key · 大小=证据等级 · 红色光束→被替代的国外在位产品 incumbent |
| 政策 policy | 高度=年份 · 大小=目标金额 · 色=政策类型 |
| 厂商 vendor | 外圈微尘 · 色=出身 |
| 对标 pair | 国产↔国外产品之间的青色光束 |

## 交互

- 桌面：拖动旋转 · 滚轮缩放 · 点击星体看真实数据
- 手机：触控旋转/缩放 · 「开启手机感应与声音」→ 陀螺仪倾斜视差 + 麦克风环境声驱动整体明灭起伏（uPulse）
- 传感器（陀螺仪/麦克风）需 **https + 用户授权**，仅在真机部署页生效

## 运行

静态页，需经 http(s) 提供（ES module + fetch 不能跑 file://）：

```bash
# 仓库根目录
python3 -m http.server 8099
# 打开 http://localhost:8099/demos/visual-page/
```

GitHub Pages 上直接访问 `/demos/visual-page/` 即可，sensors 自动可用。

## TODO / 后续

- 摄像头（后置染光定昼夜 / 前置轮廓成天气）作为第二波
- 「可热插拔的皮」：滑块实时重映射字段→通道
- 时间轴 scrub：拖年份让突破逐年点亮、版图变色
- 性能：347+ 同屏已用 GPU points + 单 draw call；如需更密可加 LOD / 视锥裁剪
