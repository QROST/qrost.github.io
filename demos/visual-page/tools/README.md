# visual-page/tools — 音频引擎回归检查

`demos/visual-page/audio.js`（数渊 lofi hip-hop 引擎）的零依赖 Node 脚本，
`neon-abyss/tools/`（同仓库 Trance 引擎的对等物）的 lofi 侧等价物——但声部规则
按 lofi 引擎自己的实际源码复刻，**不是照抄 neon 那一套**（lofi 没有
min9-b3 避让、没有 spice 白名单，`_rng()` 的合法调用点范围也宽得多）。

**何时必须跑**：任何改动 `audio.js` 的 commit **前后**都要跑完整快速门禁：

```bash
node demos/visual-page/tools/check-lofi.mjs
node demos/visual-page/tools/check-scheduler.mjs
node demos/visual-page/tools/check-felt-piano.mjs
node demos/visual-page/tools/stamp-cache.mjs
node demos/visual-page/tools/stamp-cache.mjs --check
```

要求 Node ≥ 18，零 npm 依赖。`check-lofi.mjs` 的三个检查环节合在一个文件里，依次跑完打印汇总，
任一环节不过 `exit 1`；源码漂移（提取规则用到的片段找不到了）`exit 2`。

另外两个脚本覆盖容易在静态和声门禁里漏掉的运行时契约：

- `check-scheduler.mjs`：复现长静音/后台冻结后的 stale clock，断言恢复时只排 1–2 个 step，不补发历史音符；同时覆盖 ≤50ms RAF 抖动保 grid、明显过期、`NaN`、异常 far-future，以及小节边界 68→89 BPM 不倒序双触发。
- `check-felt-piano.mjs`：验证 C4+C5 恰好两枚、文件名 content hash、总传输 ≤80 KiB、CC0 provenance、single-flight、串行 decode、context-reset 取消后续解码、整族失败降级、4-bar 原子启用、最低 upper voice ±6 semitone attack anchor、每套 baseline progression ≥2/4 命中，以及首音/静音/后台状态内零 fetch/decode。
- `stamp-cache.mjs`：先以 `audio.js` 内容更新 `app.js` 的 import token，再以更新后的 `app.js` 内容更新 `index.html`；`--check` 只验证、不写入。不要手改这两级 `?v=`。

## 三个环节查什么

- **[1/3] 和声穷举 (m2/m9)** —— 枚举 `chord`(_strikeChord，含 upper 变体子集）/
  `bass`(root / fifth / walking 三个固定偏移) / `mel`(主旋律 + call-response +
  focus 电钢，`+12` 或 `+24` 两个八度变体) 这三类"同响声部"在每种和弦类型下
  能产生的全部音高，两两比较 `|差| ∈ {1, 13}` 即撞车。**lofi 引擎没有 spice
  白名单**，任何撞车都计入违规。

- **[2/3] sig 多样性分布** —— 60 个确定性 `_sig0` 模拟不同宇宙，锁死
  `domType`，断言 `bpm` / `swing` / `baseProgIdx` / `groove` / `motif` 这几个
  由 `_sigMix` 折叠出的"每宇宙一次性"参数分布确实展开了。

- **[3/3] this._rng() 计数棘轮** —— 数出现次数，跟脚本内 `EXPECTED` 常量比对。
  **注意**：lofi 引擎里 `_rng()` 大量用在 `_scheduleStep()` 每一步的人性化微抖
  / 概率触发（文件头注释①②③里说的"每次不同"配方的一部分），这是既有设计，
  跟 neon-abyss 那种"只准出现在 `_onBar`/构造"的更严格纪律不是一回事——本脚本
  只做计数棘轮，不对调用点位置做语义判断。数量变了就去人工核对新增/减少的
  调用点是否合理，再手动更新 `EXPECTED`。

## 已知现状

- 2026-07-09 首次跑通时 `[1/3]` 报告过 **6 处真实 m2/m9 撞车**（主旋律 `+24`
  撞和弦大七度/九度音）——已在 harmony pass（commit `17e30e2`）通过"+24 分支
  撞车让位五度"清零，当前 0 处。
- 2026-07-16 悦耳度 pass 之后棘轮基线不变（`EXPECTED = 18`），两条 drift-guard
  needle（mel oct 概率、focus 电钢参数）随源码同步更新。

## measure-harshness.html — 刺耳度离线测量 harness（2026-07-16）

`tools/measure-harshness.html` 用 `OfflineAudioContext` 对引擎做**确定性离线渲染**
（4 个覆盖三档情绪的固定 DNA 预设 × 40s），量化输出：整体 RMS、6 频段能量占比、
频谱质心、尖锐度代理（`10·log10(E[2k–22k]/E[200–2k])`，越负越暗越适合背景聆听）、
瞬时不连续尖峰计数（增益跳变/包络截断的指纹）。同一预设跨版本完全可比——改音色
前后各跑一次就能拿到 before/after 数字，不再只凭耳朵争论。

```bash
# 仓库根目录起静态服务后浏览器打开（module import 需要 http）
python3 -m http.server 8099
open "http://localhost:8099/demos/visual-page/tools/measure-harshness.html?src=../audio.js%3Fbust"
# 带上 felt=1 可测量已激活的轻量触键层；默认仍是 procedural baseline
open "http://localhost:8099/demos/visual-page/tools/measure-harshness.html?src=../audio.js%3Fbust&felt=1"
# 结果渲染成表格，也挂在 window.__RESULTS 供脚本抓取
```

参考基线：2026-07-16 悦耳度 pass 把尖锐度从 −17.1..−19.7dB 压到 −20.9..−24.0dB，
clicks/min 从 13–71 清到 ~0，RMS 保持 ±0.2dB。

## 源码漂移守卫

脚本会先逐字比对提取规则依赖的那几段源码片段（`_strikeChord` 的 base 公式、
三个 bass 分支、mel 的 oct 公式、`_sigMix` 折叠公式、`moodForDom` 等）。改过
就 `exit 2`，提示去核对引擎改动、更新脚本里的复刻逻辑，而不是悄悄用旧规则
跑出虚假的绿。

## 可选参数

接受一个可选的第一参数，覆盖默认的 `../audio.js` 路径：

```bash
node check-lofi.mjs /path/to/other/audio.js
```
