# neon-abyss/tools — 音频引擎回归检查

`demos/neon-abyss/audio-club.js`（霓虹渊 Trance 引擎）的三个零依赖 Node 脚本，
把前几轮 session 里"手工验证一次就丢弃"的推理沉淀为可重复运行的断言。

**何时必须跑**：任何改动 `audio-club.js` 的 commit **前后**都要跑一遍——
改前建立基线，改后确认没有引入回归。三个脚本互相独立，全部要跑绿：

```bash
node demos/neon-abyss/tools/check-harmony.mjs
node demos/neon-abyss/tools/check-diversity.mjs
node demos/neon-abyss/tools/check-rng.mjs
```

要求 Node ≥ 18（用了 `import.meta.url` / 可选链等现代语法），零 npm 依赖。

## 三个脚本查什么

- **check-harmony.mjs** —— 和声舒适不变量。枚举 `bass/pad/stab/arp/lead/hook`
  六个"同响声部"在每种和弦类型下能产生的全部音高（八度精确），两两比较，
  `|差| ∈ {1, 13}`（小二度 / 小九度）即撞车，除非落在白名单（+14 spice 音）。
  发现撞车会打印一张对照表并 `exit 1`；全绿 `exit 0`。

- **check-diversity.mjs** —— 跨 session 多样性。60 个确定性 `_sig0` 模拟不同
  宇宙，锁死 `domType`，断言 `mode` / `drumVar` / `_leadContour` / `kickBoom` /
  `styleW` 这几个"每宇宙一次性"参数的折叠分布确实展开了，不是恒等于一个值
  （那种回归耳朵很难听出来，但分布上一眼可辨）。

- **check-rng.mjs** —— `this._rng()` 限域棘轮。单纯数出现次数，跟脚本顶部
  `EXPECTED` 常量比对。数量变了不代表一定错，但要求人去核对新增/减少的调用点
  是否落在合法范围（`_onBar()` 内部，或构造/`start()` 的一次性 setup），核对完
  再手动更新 `EXPECTED`。

## 源码漂移守卫

三个脚本都会先用逐字字符串匹配确认它们赖以提取规则的那几段源码片段还在
（比如 pad 只弹前三音、arp 高八度限根/五、lead 的 min9-b3 避让、`_sigMix` 的
折叠公式）。如果引擎的选音/折叠规则被改过而脚本没同步更新，脚本会 `exit 2`
并报错提示"提取规则可能已过期"，而不是悄悄用旧规则跑出一个虚假的绿。看到
`exit 2` 说明该去核对引擎改动、更新脚本里对应的复刻逻辑，而不是重跑。

## 可选参数

三个脚本都接受一个可选的第一参数，覆盖默认的 `../audio-club.js` 路径
（用于在别处测试同一份规则复刻，或指向某个历史版本做对比）：

```bash
node check-harmony.mjs /path/to/other/audio-club.js
```
