# visual-page/tools — 音频引擎回归检查

`demos/visual-page/audio.js`（数渊 lofi hip-hop 引擎）的零依赖 Node 脚本，
`neon-abyss/tools/`（同仓库 Trance 引擎的对等物）的 lofi 侧等价物——但声部规则
按 lofi 引擎自己的实际源码复刻，**不是照抄 neon 那一套**（lofi 没有
min9-b3 避让、没有 spice 白名单，`_rng()` 的合法调用点范围也宽得多）。

**何时必须跑**：任何改动 `audio.js` 的 commit **前后**都要跑一遍：

```bash
node demos/visual-page/tools/check-lofi.mjs
```

要求 Node ≥ 18，零 npm 依赖。三个检查环节合在一个文件里，依次跑完打印汇总，
任一环节不过 `exit 1`；源码漂移（提取规则用到的片段找不到了）`exit 2`。

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

## 已知现状（2026-07-09，首次跑通）

`[1/3]` 当前报告 **6 处真实 m2/m9 撞车**（`maj7`/`maj9` 各 2 处、`min9` 2 处，
都是主旋律 `+24`（两个八度上的根音）撞上和弦的大七度/九度音）。这是这套
lofi 引擎第一次被这样系统性核查——之前的"harmony pass"只做过 neon-abyss，
lofi 侧从未被这样审过，所以发现真实、之前未知的问题在预期之内。**本脚本
不修引擎**，只如实报告；是否要动 `audio.js` 是后续独立的决定。

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
