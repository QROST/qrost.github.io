# ABYSS-SYNC.md — 双 abyss 同步账本

> `visual-page`（数渊 Data Abyss）与 `neon-abyss`（霓虹渊 Neon Abyss）是**同一数据宇宙的双生页**：
> 同一套混沌吸引子星海 + SOM/CPPN 神经地图，一个配 lo-fi hip-hop 呼吸感，一个配 138 BPM Trance
> 夜店感。两者代码 fork 独立、运行时零共享，但**改进默认互相评估是否移植**——这正是本文件存在
> 的意义：改一侧前先来这里查有没有该同步的债，改完再回来记账。

---

## 1. 定位

- `demos/visual-page/index.html` — 数渊，lo-fi、内省、mic 聆听 + 陀螺仪
- `demos/neon-abyss/index.html` — 霓虹渊，Trance、外放、beat-synced bloom + 频闪
- 两者共享：同一套四层真实数据（housing/industrial/pharma/shelter-cats，相对路径引用兄弟 demo，
  **不复制数据**）、同一套 FEAT_DIM=28 SOM 训练、同一套三维吸引子渲染骨架（`app.js` /
  `app-club.js` 互为 fork 起点）。
- 运行时**不共享代码**——两份 `audio.js` / `audio-club.js`、两份 `app*.js` 各自独立维护，
  只共享方法论。所以"同步"不是自动的，是人工评估 + 移植的纪律。

---

## 2. 共享不变量（未来改动不得破坏）

以下条目对两个页面**都成立**；改任一侧时如果会违反下列任一条，先停下重新设计。

1. **音乐确定性纪律**——两套引擎全程禁止在影响音乐参数的路径上使用
   `Math.random()` / `Date.now()`：
   - `this._rng()` 只允许出现在既有调用点（构造/`start()` 的一次性 setup，以及
     `_onBar()`/`_scheduleStep()` 内部）；数量变化用各自 `tools/check-rng.mjs` /
     `check-lofi.mjs [3/3]` 棘轮核对，变了就人工核对新增/减少的调用点再手动更新
     `EXPECTED`。lofi 的合法范围比 neon 宽（`_rng()` 也用于每步人性化微抖），
     neon 更严格（只准 `_onBar`/构造），**这个宽严差异本身是有意分歧**（见 §3），
     但"禁止裸随机数进音乐参数"这条纪律本身两侧都不可违反。
   - 每宇宙一次性参数（bpm/swing/prog/groove/motif/mode/kickBoom/drumVar/...）
     必须走 `this._sigMix(salt)`，挑未用过的新 salt 整数（先 `grep -n "_sigMix("`
     确认占用表，两侧当前已用到 ~1-46，新增前查一遍避免撞号）。
   - 每 step 的概率触发门用 `this._h(...)`（确定性 hash 门），不是裸 `Math.random()`。
   - 纯视觉/UI 层的瞬时选择（例如粒子闪烁抖动、无关听感的渲染细节）允许
     `Math.random`，边界是"是否影响音乐参数"。

2. **和声舒适不变量（m2/m9 撞车检查）**——`bass/pad/stab/arp/lead/hook`（或 lofi 侧对应的
   `chord/bass/mel`）等"同响声部"在每种和弦类型下产生的全部音高，两两比较
   `|差| ∈ {1, 13}`（小二度/小九度）即视为撞车，除非落在 **+14 spice 白名单**（neon 侧；
   lofi 侧目前没有白名单，任何撞车都计入违规，是两侧尚存的规则不对称，见 §3 债务）。
   改动 voicing/和弦表前后必须跑对应 `check-harmony.mjs`（neon）或 `check-lofi.mjs [1/3]`
   （lofi）。

3. **聚合量 vs 指纹陷阱**——SOM 训练出的聚合量（`domType`/`concentration`/`speedMean`/
   `speedSpread`/`populatedFrac`/`hueStar` 等 `musicDNA` 字段）只负责**定倾向**（基调/调式/
   BPM 中枢/和弦桶选择的粗粒度锚点），真正的"每次加载都不同"必须靠 `_sig0` 指纹
   （`_sigMix` 折叠）在这些锚点上做逐载散开。只用聚合量会导致"跨 session 听起来一样"
   （neon 05/06 两轮 diversity pass、lofi 的 `d2f1786`/`ed333e2` 都是修这个类别的回归）；
   只用指纹不用聚合量则会让音乐和视觉脱节（宇宙听起来跟星海形态无关）。两者必须都保留。

4. **pick 手感**——点选星体的射线拾取用 `distanceToRay` 排序，**排除当前已 focus 的 idx**
   （被选中几何体不再遮挡/吞掉后续点击），阈值 2.6→3.6 放宽；相机切换用 `smoothstep`
   ease-in-out 过渡（~200ms），不是硬切。此手感在 `a39be9e`（neon 首发）→ `7265e85`
   （移植进 visual-page）已双侧对齐，未来改拾取逻辑两侧都要保持这个手感。

5. **按钮可见性规则**——底部控制条（`#enable` 等）在音频开始后：桌面端默认隐藏，
   `hover`/`focus-visible` 才显现（沉浸感优先）；触屏（`hover: none`）常驻但半透明
   （0.4 透明度，保证可发现性）。CSS 主导可见性，不用 JS opacity 淡出/淡入 timer
   （`9bec334` neon 首发 → `7265e85` 移植进 visual-page，都已对齐）。

6. **SOM → musicDNA → 引擎的管线**——星海位置/聚簇由 SOM/CPPN 训练得到，训练结果
   折算成 `musicDNA{hueStar, concentration, clusters, speed, motif, sig}` 一份结构化
   摘要，两套音频引擎各自消费这份摘要映射到自己的音乐语法（不是各自重新分析原始
   数据）。改 `musicDNA` 的字段形状是**双侧破坏性变更**，必须同步改两份 app 的
   feed 逻辑和两份引擎的消费逻辑。

7. **觉醒机制**——用户交互（点击/hover 星体）触发引擎"觉醒"式音色/参数微调
   （如 `9edc8cd`/`ed333e2` 提到的 hiShelf 暖度更新），两侧都遵循"觉醒时用当前
   `_sig0` 温柔重算，不整段重启"的原则。

8. **数据来源纪律**——四层数据一律相对路径引用兄弟 demo（`../china-housing/...`、
   `fetch('../china-industrial-software/...')`、`fetch('../pharm-companies/...')`、
   `fetch('../shelter-cats/...')`），**绝不复制数据文件**进 `visual-page/` 或
   `neon-abyss/` 自己的 `assets/data/`。每层独立 `try/catch`，缺数据不拖垮其他层。

---

## 3. 有意分歧表（永不同步项）

以下差异是**设计意图**，改进移植时**不要**试图消除，只需确认双方都还站得住理由。

| 维度 | visual-page（数渊/lofi） | neon-abyss（霓虹渊） | 分歧理由 |
|---|---|---|---|
| 配乐体裁 | lo-fi hip-hop，72–89 BPM，Rhodes + boom-bap，呼吸感 | Trance/Progressive，128–146 BPM，four-on-the-floor + supersaw + sidechain | 两种情绪定位（内省研究 vs 夜店律动），体裁本身就是产品差异化 |
| 入口门 | 无特殊门（数据/WebGL 降级提示即可） | photosensitivity 门（癫痫警示，进入前需用户确认） | strobe + 高频闪光屏于安全合规必须前置警示；lofi 无频闪不需要 |
| 频闪/beat-sync 视觉 | 无 strobe，无 bloom | `UnrealBloomPass`（桌面）+ camera shake + FOV punch + drop 段 strobe | lofi 追求沉浸放松，strobe 与其情绪相悖；neon 追求律动冲击 |
| "静音"语义 | mic 振幅驱动节奏感（`getUserMedia`）+ 陀螺仪导航；麦克风是**聆听**输入 | 麦克风/陀螺仪已移除，纯 generative；`beatPulse` 由引擎自身节拍驱动视觉，无外部输入 | lofi 把环境声音当创作素材（更"活的空间"感）；neon 需要精确 beat-lock 视觉，外部 mic 输入的抖动会破坏同步感 |
| 弧线结构 | 磁带"翻面"（A 面/B 面，`_side`，7–10 分钟/面） | 32-bar DJ-set 弧线（intro→build→drop→breakdown→loop），`breatherEvery`/`_apex` 控制能量顶点节奏 | 磁带比喻服务 lofi 的怀旧感；DJ-set 结构服务 neon 的夜店叙事，两套时间尺度和呼吸模型不可互换 |
| 缓存戳机制 | `?v=` **content-hash**（build 时自动重写，遵循仓库 `AGENTS.md` §2.1 铁律） | `?v=nNN` **手写序号**（历史遗留） | **这是已知技术债，不是设计意图**——neon 应迁移到 content-hash 但尚未排期；后续任何人碰 neon 缓存戳时应顺手迁移并在此登记 |
| `_rng()` 合法范围严格度 | 宽：允许用于 `_scheduleStep()` 每步人性化微抖/概率触发 | 严：仅 `_onBar()`/构造一次性 setup | lofi 的"人性化演奏感"设计需要更细粒度的逐步抖动；neon 的精确 beat-lock 不允许步内抖动破坏节拍网格 |
| m2/m9 白名单 | 无白名单，任何撞车计入违规（目前已知 6 处待决） | +14 spice 白名单（9th 和弦音允许） | neon 经过两轮 harmony pass 主动引入白名单换取和声丰富度；lofi 尚未做等价的 harmony pass，是否引入白名单是独立待决问题，不能直接照搬 neon 规则 |

---

## 4. 移植账本（`305b9da..HEAD`）

范围：`git log --oneline 305b9da..HEAD -- demos/neon-abyss demos/visual-page`。

| 特性 | neon commit | lofi commit | 状态 |
|---|---|---|---|
| DJ-set 呼吸弧线（每 ~3 cycle 一次 rest-then-lift） | `1fe172a` | — | 有意不移植：lofi 用磁带翻面模型，无 DJ-set 能量弧线概念（§3） |
| 数据驱动每宇宙 key + tempo variance | `fc53098` | 对等已有（lofi bpm 公式自带 sig 散开，`audio.js:154`） | 已对齐（各自原生实现，非直接移植） |
| 每宇宙情绪 MODE（minor/major/dorian/phrygian，据 domType） | `02f30e0` | `ed333e2`（"per-universe emotional mood + timbre signature"，adapt neon `02f30e0` + `e731d85`） | **已移植**（comfort-preserving 改写，非逐字复刻） |
| 主控低通 filter-down → slam 的"赚来的 drop" + breather sink | `7c87f9f` | — | 有意不移植：lofi 无 drop 段结构 |
| breakdown 里的 solo lead hook（DJ #4a） | `59d4ceb` | — | 有意不移植：lofi 弧线模型不同 |
| 几何边可变线宽（capped ribbon subset, mobile-safe） | `35546e2` | `9edc8cd`（"port neon 35546e2"） | **已移植**（视觉层，直接对齐） |
| 每宇宙乐器音色组（sonic signature，DJ #5） | `e731d85` | 并入 `ed333e2` 的 timbre signature 部分 | **已移植** |
| 16-bar breakdown（DJ #4b，可变 cycle via BARS 常量） | `97382bf` | — | 有意不移植：lofi 无 bar-cycle 结构概念 |
| 系统性 dissonance 修复（arp/hook 锁定和弦音） | `92f2ab0` | 对应 lofi `check-lofi.mjs [1/3]` 报告的 6 处 m2/m9 待决 | **未移植 / 待决**：lofi 尚未做等价 harmony pass，见 §3 白名单差异 |
| 旋律 sameness 修复（motif + progression 折 sig） | `03bd523` | `d2f1786`（"fix per-load sameness — fold sig fingerprint into bpm/swing/prog/groove/motif, borrow neon `03bd523`"） | **已移植** |
| 和声舒适 pass（arp spice 9th-only ~5%，lead delay 收敛） | `ac3fdc8` | — | 有意不移植（暂缓）：依赖 lofi 先有白名单机制，属于上一行"未决" |
| 侧链修复（arpBus + 让位给 active lead） | `e799922` | — | 未评估：lofi 无对等 arpBus 结构，需先确认是否适用 |
| pick 跟手 + 必切换 + 缓入过渡（`distanceToRay` 排除已选 + smoothstep） | `a39be9e` | `7265e85`（"port neon-abyss pick 跟手 + 缓入 + bottom-control auto-hide"） | **已移植**（见 §2 不变量 4） |
| 底部控制条 auto-hide（hover/focus-visible 桌面，触屏半透明） | `9bec334` | 并入 `7265e85` | **已移植**（见 §2 不变量 5） |
| m2/m9 残余撞车清零（harmony pass 2，6 处枚举撞车→0） | `25e0222` | `17e30e2` | **已移植**：check-lofi 首跑抓出 lofi 侧 6 处历史撞车（+24 高八度旋律变体撞 maj7/9th），改走五度后清零 |
| 跨 session 熟悉感修复（sig 折入三个常量锚点 + 鼓/lead 变体，diversity pass 2） | `5a338b8` | — | 待评估：lofi 是否有等价"熟悉感"回归尚未系统核查过 |

---

## 5. 本批次新特性（本次改动落地，9 项，双侧同落）

> 本节记录**这一批次**（编排者当前批次）双侧同步落地的特性；commit 尚未由编排者提交，
> 下列 commit 列先留空，提交后回填 sha。

| # | 特性 | neon commit | lofi commit | 备注 |
|---|---|---|---|---|
| 1 | 验证门禁工具沉淀（check-harmony/diversity/rng + check-lofi） | `add7f56` | `add7f56` | 双侧共享一个 tools commit；改音频引擎前后必跑 |
| 2 | parse-time 音频解锁（冷网点击不再被丢弃） | `f08d55c` | `17e30e2` | inline script 同步接住手势建 ctx，module 兜底补跑 |
| 3 | 癫痫门柔和出口（.ep-alt → visual-page） | `f08d55c` | — | neon 专属（有意分歧：lofi 是无频闪欢迎门） |
| 4 | 静音态 mic 驱动视觉（带上你自己的 DJ） | `f08d55c` | — | 有意分歧：lofi 静音=mic 聆听+陀螺仪（既有） |
| 5 | SOM 觉醒（_applyDNA/updateDNA，沉睡起步→边界绽放） | `f08d55c` | `17e30e2` | dnaPassed 竞态修成开场叙事 |
| 6 | 微弱空间声像（±0.25 pan cap + closeness 偏置） | `f08d55c` | `17e30e2` | neon=lead/arp 总线；lofi=melody 总线（陀螺仪天然联动） |
| 7 | 长时结构 | `f08d55c` | `17e30e2` | 有意分歧的对偶：neon=DJ-set 宏弧（15–25min warmup→lift→peak→afterglow）；lofi=磁带 A/B 面（7–10min side 折 sig 换歌，宇宙不变） |
| 8 | 数据叙事低语（now-playing 诗句 + #whisper） | `f08d55c` | `17e30e2` | 气质对偶：夜店 MC vs 梦呓；文案禁工程词 |
| 9 | lofi 历史 m2/m9 清零（工具首跑发现的存量问题） | （neon 对应 `25e0222`） | `17e30e2` | 见 §4 移植账本对应行 |

---

## 6. 同步流程规则

1. **改一侧前**：先读本文件 §2（不变量，不能碰）与 §3（有意分歧，不要误移植）。
2. **改一侧后**：
   - 在 §4（或若属于当前批次则 §5）登记这次改动。
   - 评估是否该移植到另一侧：能移植 → 开一个对应改动并在表里标注双向 commit；
     不移植 → 在"状态"列写明是"有意不移植"还是"待评估"，附一句理由（对齐 §3 的分歧类别，
     或写清楚为什么还没评估）。
   - 不要把这一步拖到"以后有空再补"——账本的价值就在于改完立刻记，账本本身也是
     未来判断"这个特性到底同步过没有"的唯一真源。
3. **改音频引擎（`audio.js` 或 `audio-club.js`）前后必须跑对应回归脚本**：
   ```bash
   # 改 demos/visual-page/audio.js 前后
   node demos/visual-page/tools/check-lofi.mjs

   # 改 demos/neon-abyss/audio-club.js 前后
   node demos/neon-abyss/tools/check-harmony.mjs
   node demos/neon-abyss/tools/check-diversity.mjs
   node demos/neon-abyss/tools/check-rng.mjs
   ```
   任一脚本 `exit 1` = 发现真实回归（和声撞车 / 多样性坍缩 / rng 计数漂移，需人工核对）；
   `exit 2` = 源码漂移导致脚本的规则复刻已经过期，需要先同步脚本里的规则再重跑，
   不能凭旧规则跑出的绿灯下结论。
4. **改 `_sigMix` salt 表前**：`grep -n "_sigMix(" demos/visual-page/audio.js
   demos/neon-abyss/audio-club.js`，确认新用的 salt 整数没有跟已占用的撞号
   （见 §2 不变量 1）。
5. **改 SOM/musicDNA 字段形状前**：视为双侧破坏性变更，两份 `app*.js` 的 feed 逻辑
   和两份引擎的消费逻辑必须一起改，不能只改一侧。
