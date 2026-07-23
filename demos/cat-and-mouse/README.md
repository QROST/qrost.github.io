# Cat & Mouse · 猫鼠之间

A dependency-free Canvas 2D interaction: a top-down cat notices, watches, stalks, approaches, and chases the pointer rendered as a small mouse.

## Controls

- Pointer: move the mouse; leaving the canvas releases it.
- Touch: tap or drag to position the mouse.
- Keyboard: focus the canvas, then use Arrow keys to steer, Space to pause, and Escape to release.
- The top-right controls customize the cat, pause motion, and switch language/theme.

## Appearance system

The cat now uses the same controlled vocabulary as `shelter-cats`: ten canonical colors, eight coat patterns, 38 curated colorways, and short, medium, long or hairless coats. The default remains a short-haired ginger tabby. The appearance panel combines a live mini preview, visual pattern chips, localized color swatches, segmented light-marking controls, and a visible fur-length dropdown. Pattern comes first, then the panel offers only compatible color combinations and light-marking ranges: calico and tortoiseshell stay coherent multi-color recipes, pointed coats keep their darker ears/face/paws/tail, and hairless cats cannot select smoke because smoke depends on colored hair over a pale undercoat. Tortoiseshell stays unmarked; adding pale areas moves the recipe into the calico category, matching the sibling taxonomy.

Shelter records provide whole-cat `colors`, `pattern` and `coat_length` fields; they do not contain per-body-part annotations. The chest, muzzle, paw, flank, head and tail masks in this demo are therefore procedural illustration rules informed by the sibling pixel-cat renderer, not claimed shelter facts. Markings are anchored to the articulated rig rather than randomized per frame, so patches do not slide while the cat walks or rests. The selection is stored locally under the versioned `qrost-cat-and-mouse-appearance-v1` key.

Fur length is render-only and leaves the gait, skeleton and checked face/ear geometry untouched. Short hair deliberately remains on the established core-silhouette code path; deterministic SHA-256 call-trace guards now lock both its main-canvas and warmed mini-preview rendering. Only medium and long coats enter the layered-mass renderer. They share one fixed topology and differ through bounded amplitudes: a non-uniform filled body profile, broad cheek ruff, variable-radius tail plume and soft limb cuffs establish the silhouette; two flank tone bands, five closed body locks, two body flow ribbons, two tail ribbons and three head patches add low-contrast direction. No layer is a row of literal hairs, and no DPR-dependent LOD can make the coat sparse at browser zoom.

Hairless retains its slimmer tail, muted skin palette and low-contrast folds. For medium and long coats, fill, coat clipping, outline, shadow, hit testing and pose envelopes all use the same expanded silhouettes, so markings and interactions do not stop at the short-hair boundary. The additional main-canvas budget is capped at 80 curves, eight fills, four strokes and 240 total Canvas calls over short hair; medium and long use identical call topology.

This is a deliberately lightweight Canvas 2D adaptation—not a literal implementation—of the volume/silhouette split described by [Lengyel et al.'s real-time fur work](https://hhoppe.com/fur.pdf) and the coherent direction fields used in [real-time hatching](https://hhoppe.com/proj/hatching/). At this scale, the filled silhouette carries the coat mass while a handful of closed tonal shapes and broad local ribbons carry the fur-flow cue; no WebGL shells, particles, per-hair physics or new runtime dependency are required.

### Fur-rendering research boundary

The current renderer borrows a small set of art-direction principles from production and research systems without claiming to reproduce their GPU or offline implementations:

- Pixar's [Hair Emoting with Style Guides in *Turning Red* (SIGGRAPH 2022)](https://graphics.pixar.com/library/HairEmoting/) uses coarse, artist-friendly style guides and layers to control a much denser final groom. The transferable idea here is the hierarchy of controls: one shared mass topology first, localized secondary shapes second, rather than asking hundreds of render hairs to define the design.
- Disney's [art-directed groom for *Strange World* (SIGGRAPH 2023)](https://disneyanimation.com/publications/creating-the-art-directed-groom-for-legend-in-disneys-strange-world/) explicitly translates a graphic comic-book aesthetic into fur, while [Painterly Rendering for Animation](https://disneyanimation.com/publications/painterly-rendering-for-animation/) requires stylized marks to remain attached and temporally coherent. The Canvas adaptation uses deterministic closed clumps and rig-local ribbons rather than noisy frame-by-frame texture.
- Disney Research's [Shaping Strands with Neural Style Transfer (SIGGRAPH Asia 2025)](https://studios.disneyresearch.com/2025/12/14/shaping-strands-with-neural-style-transfer/) reinforces that a convincing stylized groom needs coherent clumps and strong art direction, not merely more fibres. This page uses that visual lesson but no neural model, strand groom or 3D reconstruction.
- [Practical Level-of-Detail Aggregation of Fur Appearance (SIGGRAPH 2022)](https://sites.cs.ucsb.edu/~lingqi/project_page/fur_aggregation/index.html), [Real-time Level-of-detail Strand-based Rendering (EGSR 2025)](https://diglib.eg.org/items/eded9336-bf27-4c28-8c22-39557fbb190f), and Disney's [artist-friendly fur LOD for *Zootopia*](https://www.disneyanimation.com/publications/artist-friendly-level-of-detail-in-a-fur-filled-world/) show why distant fibres must be represented in aggregate. Because this cat is always small on screen, the implementation takes the stronger simplification: the aggregate filled mass is the primary representation at every DPR, with no strand transition to pop or thin out.
- [Real-Time Hair Rendering with Hair Meshes (SIGGRAPH 2024)](https://www.cemyuksel.com/research/hairmesh_rendering/) demonstrates how a small deforming representation can drive much richer detail. The relevant boundary here is fixed low topology; its procedural fibre generation and shading are intentionally omitted.

The practical hierarchy is therefore `authoritative filled silhouette → broad regional tone masses → a few coherent flow ribbons`. Neural reconstruction, BCSDF multiple scattering, mesh shaders, temporal accumulation and per-strand simulation remain out of scope: their cost and dependencies would not buy a reliable improvement for one small top-down cat.

## Locomotion model

The rig uses one master gait clock coupled to four limb phases. Slow movement follows the feline lateral-sequence order `RH → RF → LH → LF`; stalking lengthens the stance interval and lowers body motion. A fast pursuit blends into a diagonal trot (`RH + LF`, then `LH + RF`). Cadence follows distance travelled per limb cycle, so slow movement uses long, deliberate steps instead of rapid shuffling. Each stance paw is held in world space while the body travels over it; the swing paw follows a cubic eased arc, and each hind paw attempts to register in the previous fore-paw track.

Translation and steering are acceleration-limited. A planted paw stays locked until its shoulder or hip approaches the limb's anatomical reach envelope; a tight turn then unloads that paw into a short recovery step while retaining at least one supporting foot. Swing planning, per-frame motion, and touchdown are all reach-constrained, preventing the articulated legs from stretching to follow a turning torso.

The pounce chain starts with a short stalk-and-crouch window, then commits to one bounded ballistic move. A calm target can now trigger that crouch from up to 175 design units away. The landing solver subtracts the rig's 44-unit body-to-fore-paw offset from the travel distance, so the mouse arrives between the planted front paws instead of underneath the cat's waist. A successful landing becomes a persistent capture rather than a momentary overlap: the visible mouse follows the fore paws while the cat settles into a longer rest pose. Small pointer jitter is ignored; moving the target decisively or leaving the canvas releases the capture and resumes pursuit.

When no target is present, the same articulated cat now settles into a broader illustrated rest repertoire: upright sitting, a compact paw-tucked loaf, side-lying with an upper pair of overlapping legs, a belly-up rolling motion, and a C-shaped curl with the head and tail tucked inward. These are not alternate sprites. A dual-pose mixer keeps both the outgoing and incoming poses alive through every transition: the torso lowers and transfers weight first, the spine follows, then paws, tail and coat details settle on staggered curves. Rest chains therefore retain continuous support instead of replacing one geometry with another. Deep loaf, side-lying and curl poses ease into an asymmetric breathing cycle; sparse deterministic dream events add tiny one-sided ear, paw or tail twitches without shaking the whole animal.

Above the footfall controller, a five-node articulated spine (`pelvis → waist → shoulders → neck → head`) gives each body region its own filtered pose. The head reacts first, the neck and shoulder girdle follow, the waist absorbs the curve, and the pelvis trails the turn. Hind legs and the tail attach to the pelvis; forelegs attach to the shoulders. The renderer wraps those moving stations in a continuous fur envelope: centerline-derived skin normals smooth the joints, the torso overlaps the back of the head, the tail root is buried inside the pelvis, and only exposed flanks are outlined. The bones can flex without turning the visible cat into disconnected parts. Legs use tapered closed fur silhouettes instead of stroked skeleton lines; soft Bézier paws overlap the ankle and leave the hidden join unoutlined. The overhead head deliberately stays subordinate to that silhouette: its visual radius is capped relative to the shoulders, the rounded skull flows directly into the neck, and both ear roots sit behind the eyes instead of producing forward-facing spikes. Facial information is limited to three crown marks, two animated upper-lid curves, one tiny nose and two short whisker rows per side. There are no iris jewels, muzzle masks, mouth construction, follicle dots or decorative cheek tufts. The eyelid curves still soften with sleep depth and asymmetric blinks, while the rounded rear-crown pinnae retain their independent swivel and dream flicks.

The timing and motion cues are grounded in published feline locomotion work:

- [Interlimb coordination and diagonality in walking cats](https://pmc.ncbi.nlm.nih.gov/articles/PMC4044364/)
- [Biomechanics of crouched walking in cats](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0003808)
- [A coupled central-pattern-generator model for cat locomotion](https://pubmed.ncbi.nlm.nih.gov/15140698/)
- [Gaze behavior during visually guided walking](https://pmc.ncbi.nlm.nih.gov/articles/PMC4169884/)
- [Head stabilization during locomotion](https://pmc.ncbi.nlm.nih.gov/articles/PMC4986613/)

## Build and verify

Run from this directory:

```sh
python3 tools/build.py
```

The build runs `tools/check-gait.mjs` and a headless runtime smoke harness. The gates cover cadence and swing continuity, fore/hind track registration, locked stance paws, anatomical leg reach during compact edge turns, farther pounce activation, persistent capture/rest/escape behavior, all five illustrated rest-pose silhouettes, bounded dual-pose crossfades, sleeping breath/twitch rhythm, restrained head-to-shoulder proportions, rear-crown ear placement, independent swivel/perk variation, continuous illustrated leg/paw topology, continuous spine curvature, representative coat recipes across four fur lengths and both themes, Shelter Cats vocabulary parity, mini-preview parity, monotonic body/ruff/tail/limb mass, tail-root continuity, DPR-invariant fixed topology, closed-mass density, the medium/long Canvas call budget, exact short-hair main/preview call-trace hashes, localized visual controls, keyboard radio navigation, the visible fur dropdown, the accessible appearance disclosure, the minimal unobtrusive HUD, the 1200×630 OG image, and required page metadata. The build then stamps every local CSS/JS reference with a content hash and refreshes the root homepage asset token. Do not hand-edit `?v=` values.

## tools/visual-harness.html — 隐藏 tab 可用的确定性视觉验证

无头/隐藏 tab 中 rAF 与 ResizeObserver 均不投递 → 真页面无法驱动动画。此 harness 用
rAF 垫片手动步进（`__step(frames)`）+ RO 回调捕获（`__roCb()`）+ 猫区/头部放大镜（`__zoomCat(r)` / `__zoomHead(r)`），
并提供捕获休息帧（`__captureFrame()`）、姿态混合中间帧（`__transitionFrame()`）、
睡眠微动帧（`__sleepFrame()`）、侧卧头部复核帧（`__headFrame()`）、五姿态接触表（`__poseSheet()`）、
十三配方外观接触表（`__appearanceSheet()`）与覆盖橘色坐姿、黑色侧卧、奶油色蜷卧的四毛长接触表（`__furSheet()`），
配合 `window.__catMouseDemo` 快照 API 做逐帧行为断言与截图。经静态服务器打开：
`python3 -m http.server 8099` → `/demos/cat-and-mouse/tools/visual-harness.html`。
