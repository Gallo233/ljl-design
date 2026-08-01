# shader.se ↔ JOI9000 差距报告

对照对象：`https://www.shader.se/`
我方对象：`/joi-signal-lab` — 首屏 [Joi9000Hero.tsx](../../../app/joi-signal-lab/Joi9000Hero.tsx) + 胶片页 [JoiSignalLab.tsx](../../../app/joi-signal-lab/JoiSignalLab.tsx)
证据：`.web-shader-extractor/`（scout-card、post-processing-chain、asset-index）
日期：2026-07-25

---

## 0. 先说结论

胶片的**几何和交互**上一轮已经按源码对齐过了（Catmull-Rom 曲线、160 段、fov 65、far 305、拖拽 20% 夹紧 / 10% 阈值），那部分不用再动。

现在拉开差距的不是几何，是**合成方式**。shader.se 把整站压成一次后期；我们把效果拆在了 CSS 和各自的材质里。这一条解释了大部分"看起来像贴上去的"观感。

---

## 1. 架构对照

| | shader.se | 我们 | 证据 |
|---|---|---|---|
| 渲染面 | **1 个 canvas** | **2 个 canvas / 2 个 WebGL2 context** | 运行时清点 |
| 后端 | WebGPU · Three r183 · TSL | WebGL2 · Three r178 · GLSL ShaderMaterial | `data-engine` 属性 / `__THREE__` |
| 后期 | 一条统一节点图作用在最终合成上 | **没有 composer**，直接 `renderer.render()` | 源码 |
| CRT 质感 | 全在 shader 里 | CSS `.scanlines` / `.vignette` / `.grain` 叠层 | `joi-signal-lab.module.css:142-172` |
| 排版 | MSDF 位图字体，画在 canvas 内 | DOM 文字浮在 canvas 上（32 个文本节点） | `fonts/stix_*.json+png` |
| 像素比 | 钳到 **1.5** | **1.65 / 1.7**（两个 context 各一份） | 运行时清点 |
| 滚动 | Lenis 1.3.3 + 容器，**17.8 屏** | 原生 scroll + rAF，**3 屏** | `scrollHeight` |
| 画质分级 | `isMobileDevice` / `reducedMemoryMode` | 无 | `useSettingsStore` |
| 加载 | CRT 开机屏预载 5.2 MB | 无，直接弹出 | 网络面板 |

---

## 2. P0 —— 合成成一次后期（影响最大）

**问题**：我们的 CRT 感来自三层 CSS 叠加：

```css
.scanlines { mix-blend-mode: overlay; background: repeating-linear-gradient(180deg, transparent 0 2px, rgba(0,0,0,.2) 2px 3px); }
.vignette  { background: radial-gradient(ellipse at center, transparent 43%, rgba(0,0,0,.31) 100%); }
.grain     { mix-blend-mode: soft-light; animation: grainShift 320ms steps(2,end) infinite; }
```

这些是 DOM 层，所以：

- **不知道场景亮度**。shader.se 的颗粒是 `+= g * (1 - color.rgb) * noiseIntensity` —— 亮部干净、暗部起噪。我们的颗粒在整屏均匀铺，亮部会脏。
- **不弯曲几何**。没有桶形畸变，屏幕不"鼓"，也就没有边缘的挤压感。
- **不给辉光染色**。shader.se 是 `bloom * vec3(1.0, 0.8, 0.0) * 0.1`，10% 琥珀色叠加，这是显像管辉光的颜色来源。
- **两个 canvas 和文字各走各的**，接缝可见 —— 这是最致命的一条。

**做法**：合并成一个 canvas + 一个 renderer，挂 `EffectComposer`，按顺序移植（WebGL/GLSL 完全可以做，不必上 WebGPU）：

1. 选择性 bloom：阈值 0.1、羽化 0.2、半径 0.5、**7 级 mip**、强度 1
2. 暖辉光叠加：`+ bloom * vec3(1.0, 0.8, 0.0) * 0.1`
3. 时间残留（ping-pong HalfFloat RT）—— 移动端/低配关掉
4. `pow(color, vec3(pow))`
5. 棕褐矩阵，混合 0.3：`(.393,.769,.189) / (.349,.686,.168) / (.272,.534,.131)`
6. 亮度 → 对比度 `(c-0.5)*contrast+0.5`
7. 镜头畸变（系数 0.3655 × distortion，重新缩放居中）+ 圆角挡板 SDF（圆角 `mix(0,0.04,d)`、羽化 `mix(0,0.005,d)`）
8. 色差：**垂直** R/B 分离，`0.001 * length((uv-0.5)*aspect*2) * 2 * strength`
9. 颗粒放**最后**（在 UI 之后）：高斯 σ=0.7，乘 `(1 - color.rgb)`

细节全部在 [post-processing-chain.md](.web-shader-extractor/evidence/source/post-processing-chain.md)。

> 注意这些全是 uniform。他们的 CRT 强度是**每页可动画**的，不是烤死的 —— 转场时可以把畸变、色差、颗粒一起推上去再收回来。

---

## 3. P1 —— 文字要跟着玻璃一起弯

shader.se 把 UI 渲到独立的 render target，然后**用同一个 `DV()` 畸变函数**去采样它，再合成。结果是：

- 标题跟着屏幕曲率走
- 文字吃到同一份色差 —— 但**在 UI 处强度减半**（`offset *= 0.5`），保证可读
- 亮/暗两套 UI 贴图靠 `uiModeTransition` 交叉淡入

我们是平的 DOM 文字压在一个看起来是弯的场景上。**这是"贴上去"感最主要的来源。**

两条路：

- **彻底**：hero 标题渲进 canvas（MSDF，参考他们的 stix 三档字重方案）
- **折中**：保留 DOM，但把 hero 标题单独渲成贴图过一遍同样的畸变；或者至少让 CSS 的 `.vignette` / 圆角和 shader 的挡板对齐

---

## 4. P2 —— 滚动长度差了 6 倍

- shader.se：**17.8 屏** 装 4 个段落，Lenis 平滑
- 我们：**3 屏**，原生滚动

而且我们的首屏→胶片切换发生在 `filmReveal = smoothStep((progress - 0.66) / 0.22)` —— 3 屏里的 0.22，约 **0.66 屏**内切完。太急，粒子形变和相机推进都没有呼吸的余地。

建议：把 experience 拉到 8–12 屏，转场铺到 1.5–2 屏；接 Lenis（他们用 1.3.3）。

---

## 5. P3 —— 性能预算用反了

我们跑 **两个 WebGL2 context，DPR 1.65 / 1.7**；他们跑 **一个 WebGPU context，DPR 1.5**。

我们花得比他们多，拿到的却更少。合并成单 context 之后：

- DPR 降到 **1.5**（和他们一致）
- 加一组 `isMobileDevice` / `reducedMemoryMode` 开关，低配关掉时间残留和 bloom 级数

---

## 6. P4 —— 胶片里的内容

我们的项目图是 Canvas2D 程序化画在 4096×512 图集上（`JoiSignalLab.tsx:291-298`）。他们用的是：

- Mux 真实剧照，`w800-h600-fpreserve-t0`，11 张
- **预烘焙 AVIF 精灵表**做动态画面（`handshake_sheet_000..002.avif` + manifest），不走 `<video>`

如果想让胶片"像真作品"，**格子里有动态画面**是最大的分水岭 —— 而且 AVIF 精灵表这条路能让画面帧随滚动精确擦洗，还绕开了自动播放策略。

---

## 7. P5 —— 开机屏

shader.se 用一块 CRT 开机屏挡住 5.2 MB 的预载，同时把"你正在开一台机器"这个设定立起来。

我们已经有 CRT 了，但没拿它当加载态用 —— 现在是直接弹出。这是一个几乎白捡的叙事收益。

---

## 8. 已经对齐、不用动的部分

来自上一轮的 `DONE_PROJECTIZED`（[replay-manifest.json](../../../app/joi-signal-lab/.web-shader-extractor/replay-manifest.json)）：

- 七点 chordal `CatmullRomCurve3`，tension 1
- 160 段连续胶片几何，竖直半高 3.75
- 画格宽 `4/3 * 7.36 + 0.06`，borderX 0.03，borderY 0.07
- 透视相机 fov 65 / `[0,0,5]` / far 305
- 外层 reel 缩放 0.4
- 拖拽夹到视口 20%，10% 阈值，松手最多进一格

---

## 9. 建议顺序

| | 动作 | 收益 | 成本 |
|---|---|---|---|
| 1 | 合并双 canvas → 单 renderer + composer | 高 | 中 |
| 2 | 移植后期链（第 2 节九步） | 高 | 中 |
| 3 | DPR 降到 1.5 + 画质分级 | 中 | 低 |
| 4 | 滚动拉长 + Lenis | 中 | 低 |
| 5 | 标题过畸变（先做折中方案） | 中 | 中 |
| 6 | 胶片格子换真实/动态素材 | 高 | 高 |
| 7 | CRT 开机预载屏 | 中 | 低 |

---

## 10. 未解决 / 需补的证据

- **首屏（office 场景）没有拿到实时画面**。内置浏览器的预加载器卡在视频自动播放上（约 70–80%），Chrome 扩展未连接，Edge 我的工具够不到。目前 office 场景的相机参数是从 bundle 读的（`fov 50, near 0.1, far 500, basePosition [0,3.1,5], baseRotation [-0.5,0,0]`），但**构图、材质、光照没有视觉参照**。
  → 需要：一张 shader.se 首屏的截图，或在 Chrome 里装扩展。
- 后期链的**默认 uniform 值是初始值**，各页转场时推到多少还没抓（需要运行时读取）。
- Lenis 的具体缓动配置未抓。
