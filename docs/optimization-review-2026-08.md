# 代码审查与优化建议 — 2026-08-27（v2，已对源码复核）

> 审查范围：`content-reset` 分支当前工作区（含未提交改动）。
> **v2 修订说明**：v1 由 GLM 起草，本版逐条对着源码复核过。每条都带
> 【已核】/【已修正】/【新增】标记——**只有带【已核】的行号和结论可以直接照做**。
> 复核当日 `npx tsc --noEmit` 实测零错误、退出码 0。
> 优先级：**P0** 真实缺陷 · **P1** 性能/可感知 · **P2** 结构/无障碍 · **P3** 低成本补齐。
> 行号基于 `b9c89bb` 时的工作区，后续提交可能漂移。

---

## 执行状态（v4 · 全部收工）

**回滚点 `029e385`**，之后 20 个提交，每批独立可回滚。收工时：`npx tsc --noEmit` 零源码错误、
11 条路由全部 200、工作区干净。

### 已完成

P0 全部 8 条 · P1 的 9/11 条 · 死 CSS/死导出/死变量 · reduced-motion 合并补全 ·
菜单 dialog 焦点管理 · 两处 `lang="zh-CN"` · 文档漂移三处 · **JSON-LD**（`/` Person、
`/work` CreativeWork）· **sitemap `lastModified`**（取内容日期，不取构建时间）·
**og:title 模板对齐** · **两条重定向补尾斜杠** · **游戏最高分持久化** ·
**room-capture 体积上限** · **hero 文案退出无障碍树** · **postfx 13-tap kernel 去重** ·
**`JoiSignalLab.tsx` 拆分**（2642 → 1892 行，拆出 4 个模块）。

### 主动不做（有理由，不是漏掉）

- **P1-8 `updateWorldMatrix`**：`heroScene` 里 `computer.rotation` 在 `updateFinalCamera()`
  **之后**才设置，要把矩阵更新提前就得重排帧内顺序。换来几次矩阵乘法，在一个逐帧调过的
  场景里不划算。真掉帧再说。
- **P1-11 小对象分配**：原文即「有可感卡顿再动」。
- **robots 的 AI 爬虫策略**：这是立场不是技术（§A.8），留给你。
- **FilmCanvas 提取**：结构拆分做了 5 个缝里的 4 个。FilmCanvas 闭包了几十个上下文变量，
  收益是可读性、风险是行为，单独立项更稳妥。

### ⚠️ P1-10 的修法有陷阱（上线后发现，已修）

`renderer.forceContextLoss()` **不能无条件放在 effect cleanup 里**。它是永久的——画布之后
再也不能渲染。而这个 cleanup 不只在读者离开时跑：React 会在**同一个 DOM 节点**上拆掉再装回
一个 effect（开发态 StrictMode 每次挂载都这样，生产态 router 重渲染也会）。在那里把上下文
打死，下一行就会在一张死画布上 `new THREE.WebGLRenderer()`，`getShaderPrecisionFormat()`
返回 null,读 `.precision` 直接抛错,页面什么都没画出来就崩。

**症状**：从任意 `/work/*` 点「BACK TO REEL」必崩 `Cannot read properties of null
(reading 'precision')`,刷新又好了。

**修法**：推迟一个 macrotask 等 React 提交完,再问唯一能区分两种情况的问题——
画布还在文档里吗？还连着说明 React 留着要复用它,而复用画布就是复用上下文,没有东西要回收;
已脱离说明是真的走了,上下文可以跟着走。已实测:两个 work 页各来回两轮,零报错、3/3 SYSTEMS、
`isContextLost() === false`。

### 执行中发现的、v2 也没抓到的四个问题

1. **P1-6 的修法会冻住海面。** `oceanScene.ts:961` 每帧推进 `wavePhase[i]`，而相位就写在
   要被 dirty-check 跳过的同一张表里（`waveData[i*4+2]`）。已改为拆表：三角函数那半张按
   收敛跳过，相位半张每帧照写。
2. **「reel 拖拽没有键盘替代」是错的。** reel 早就有 prev/next 按钮、每帧的 dot 按钮
   （带 `aria-pressed` 和 "Show {title}" 标签），以及左右方向键步进（`JoiSignalLab` 里
   一个 `useEffect`）。真正缺的是那个方向键处理器的护栏——它会在菜单/唱机开着时步进、
   吞掉 ⌘←、在输入框里触发。已补齐。
3. **「snake/tetris/pacman 的 best」只有 snake 真的显示 BEST。** 另外两个只记分不显示。
   三个都做了持久化，tetris/pacman 在结算行显示。
4. **`--contact-progress` 不能 gate 内容。** 深链 `/contact` 落在 progress = 0，下面还有
   一整屏。已实现为装饰（横线随进度填充），不是揭示。

### 数字校正（v2 已修，此处存档）

`setProperty` 14 个非 17 · `public/` 148MB/136 文件 · title-roll 四组非五组 ·
P0-7 的 `new URL(相对路径)` 会抛 `TypeError`（已用 node 实测，改为带 base 解析）。

---

## v2 改了什么（GLM 请先读这段）

v1 里有三处会导致**白干或干错**的问题，已在正文修正：

1. **P0-7 给的修法本身会崩**——`new URL(GAME_BUILD_URL).origin` 在相对路径上抛
   `TypeError: Invalid URL`（已用 node 实测）。照抄会把一个理论风险变成真实崩溃。
   同时该条严重度被高估，已从 P0 降到 P2。
2. **无障碍那条 reduced-motion 结论基本是错的**——`joi-signal-lab.module.css` 里有
   **两个** `@media (prefers-reduced-motion: reduce)` 块（`:1012` 和 `:1518`），v1 只
   找到了第一个。`loadingPulse` 和四组 title-roll **早就关掉了**，照 v1 去"补"是白干；
   真正的缺口是另外三个动画，v1 一个都没提。
3. **P0-1 唱片死代码不是"忘了写"，是作者主动退役的**——`roomRecords.ts:92-99` 有
   成段注释说明为什么退役。这条必须当**设计决策**重新裁决，不能当 bug 直接"修好"。

其余条目复核后属实，行号准确。数字微调：P1-1 是 14 个 `setProperty` 不是 17 个；
`public/` 实测 148MB / 136 文件；title-roll 是四组不是五组。

---

## 总体评价

底子很好，问题不在于架构而在于细节：

- `npx tsc --noEmit` **零错误**【已核，退出码 0】。
- 依赖仅 `next@15` / `react@19` / `three@0.178`，没有任何冗余库。
- 路由切换的 GPU 资源清理**几乎完备**（film/ocean/room/hero/postfx 的几何体、材质、
  render target、监听器全部有释放路径，唯二缺口见 P0-8 / P1-10）。
- 元数据三规则在所有声明 `openGraph` 的页面上**全部合规**（`/classic` 除外，见 P0-5）。
- `projectData.ts` 与 `labData.ts` 引用的每一个 `src` 都真实存在于 `public/`。

---

## 一、真实缺陷（P0，建议第一批修）

### P0-1 唱片交互系统是死代码 —— 但这是**主动退役**，需要你先裁决

**【已修正：v1 把它当成疏漏，实际是有意为之】**

- 【已核】`roomRecords.ts:87-88` 声明 `records` / `pickables` 后从未 push，
  `:108` 的 `byId = new Map(records.map(...))` 永远是空 Map。
  `:181/:196/:221` 三处 `byId.get()` 因此恒为 undefined。
- 【已核】`room3d.ts:495-514` 的 `setPlatterRpm` / `grabRecordAt` / `moveRecordTo` /
  `releaseRecord` 全部挂在 `records?.` 上，因此全链路静默 no-op。
- 【**新增，v1 遗漏**】`roomRecords.ts:92-99` 有一段注释写明了退役理由，原文大意是：
  三张墙上压胶在当前近景构图里挂在画面上沿之外，读起来像"导航里飘着三张唱片"而不是
  "墙上挂着三张唱片"；选面的动作已经移到 console 货架上，所以"端着唱片走过桌子"
  也没有存在意义了。网格是**故意隐藏而非删除**的，因为几何体已烘进 capture 和
  lightmap，删掉会在墙上留洞。
- **因此这不是 "机器在、内容进不去"，而是"作者把机器停机并写了停机原因"。**
  v1 引用 AGENTS.md "别把内容藏在会失效的机器后面"来论证要修复，用错了地方。

**需要你裁决（二选一，不要让 GLM 自己决定）：**

- **A. 维持退役**：删掉 `roomRecords.ts` 的整套 rig、`room3d.ts:54-60` 的四个 API
  声明与 `:495-514` 实现、以及 shell 侧的 `carryingRecord` 分支。**净减代码，零风险。**
- **B. 复活**（＝视觉方案 Phase 4）：必须先解决注释里指出的**构图问题**——近景里
  唱片根本不在画面内。只重建数据链不动相机，等于修好一台看不见的机器。
  真要做，Phase 4 得先加一条"相机/取景调整"前置项。

> 我的建议是 **A**。理由：退役理由是构图，不是实现难度；B 的成本被 v1 严重低估
> （见视觉方案 v2 对 Phase 4 的批注）。

### P0-2 导航/键盘滑动动画自取消 【已核，行号准确】

- `useScrollDriver.ts:107-110` 的 `onScroll` 会取消启动超过 80ms 的动画；
  而 `:145-151` 的 `tick` 在动画期间每帧执行 `window.scrollTo(0, …)`——
  它触发的 scroll 事件打进同一个 handler。
- 后果：`sections.ts` 里 2–3 秒的 glide 在 80ms 后即被自己杀死，
  表现为 stutter-crawl 或生硬的半截跳变。
- **修法**：驱动器自己发起的滚动打标记。最稳的写法是在 `tick` 里写完之后记下
  `lastWrittenY = Math.round(动画目标值)`，`onScroll` 里
  `if (Math.round(window.scrollY) === lastWrittenY) return;` 再判断取消。
  只让真实手势取消动画。
- ⚠️ 注意 `:135-142` 的 bootLock 分支也在调 `window.scrollTo`，同一个标记要覆盖它，
  否则 boot 期间的回弹会变成"取消源"。

### P0-3 横向滚轮没有归属门槛 【已核，行号准确】

- `JoiSignalLab.tsx:1627-1640` 的 `handleWheel` 只判断
  `Math.abs(event.deltaX) <= Math.abs(event.deltaY)` 就 return，没有任何归属判断。
- 指针路径有完整合同：`heroOwnsPointer()`(:1396)、`roomOwnsPointer()`(:1398-1399)、
  `reelOwnsPointer()`(:1433)，且 `:1478` 已经在用。
- 后果：在 hero / About / Contact 区域横向双指滑动，会在幕后步进 reel 并触发
  `onStepChange` → React 重渲染，屏幕上什么都看不到。
- **修法**：`handleWheel` 开头加 `if (!reelOwnsPointer()) return;`。
- 【**已核，可放心照做**】`reelOwnsPointer()` 只依赖 `entryRef` / `exitRef` /
  `roomPresenceRef` 三个滚动态 ref，**不依赖指针坐标**，所以从 wheel 事件里调用
  完全安全，不需要像 v1 备选方案那样另写 `filmReveal > 0.55` 判断。用同一份合同即可。

### P0-4 REEL_ANCHOR 守卫是同义反复 【已核，行号准确】

- `sections.ts:101` 是 `export const REEL_ANCHOR = SECTIONS[1].position;`，
  `:103` 的断言 `REEL_ANCHOR !== SECTIONS[1].position` 永远为假，`throw` 永远不触发。
- 在第 1 位插入新 section 会**静默改锚点**而不是报错——正是守卫想防的那件事。
- **修法**：按 id 查找再断言。
  ```ts
  const reelSection = SECTIONS.find((s) => s.id === "selected-work");
  if (!reelSection) throw new Error("SECTIONS must contain 'selected-work'");
  export const REEL_ANCHOR = reelSection.position;
  if (process.env.NODE_ENV !== "production" && REEL_ANCHOR !== SECTIONS[1].position) {
    throw new Error("REEL_ANCHOR must be SECTIONS[1] — see AGENTS.md, scroll architecture");
  }
  ```
  这样守卫咬的是"selected-work 必须排在第 2 位"这条真约束。
- 【已核】当前 `SECTIONS` 顺序：`hero`(:63) → `selected-work`(:75) →
  `about-me`(:86) → `contact`(:87)，断言成立。

### P0-5 `/classic` 元数据裸奔 【已核】

- `app/classic/page.tsx:1` 是 `"use client"`，整个 `app/classic/` 只有这一个文件，
  无 `metadata` 导出、无 `robots`。
- 后果：无 canonical、无 noindex，layout 的 `openGraph` 直接漏进去；
  而 `sitemap.ts:11-12` 的注释明说故意排除它。
  净效果 = 一个可索引、无 canonical 的旧首页重复内容。
- 【已核】`robots.ts` 是 `allow: "/"`，只禁了 `/api/`，所以确实拦不住。
- **修法**：新建 `app/classic/layout.tsx`（server 组件）导出
  `export const metadata = { robots: { index: false, follow: false } }`。
  比包 wrapper page 更小，且不动现有 client 组件。

### P0-6 WebGL 上下文丢失被判永久死刑 【已核】

- `console3d.ts:162-165` 的 `onContextLost` 调用了 `event.preventDefault()`
  （语义上承诺"我会恢复"），但全文件搜索 `webglcontextrestored` **零结果**，
  只有 `:166` 注册和 `:1177` 注销 `webglcontextlost`。
- `preventDefault()` 之后紧接着 `options.onFatal?.()`，
  而 `GameHandheld.tsx:223` 的 `onFatal` 一旦触发就永久折叠为平面 DOM。
- 移动端切后台一次 GPU reset，游戏中心残废到刷新为止。
- **修法（二选一，建议前者）**：
  - **诚实档**：去掉 `preventDefault()`。上下文确实不恢复，就别承诺恢复。**一行改动。**
  - **完整档**：加 `webglcontextrestored` 监听，重建 renderer 与 targets。
    现有架构支持保持 React phase 不变，但工作量不小。
- 建议先做诚实档，把完整档单列成一条独立任务。

### P0-8 GLB 纹理不释放 【已核，行号准确】

- `heroScene.ts:694-703` 的 `dispose()` 只 traverse 了 `geometry` 和 `material`。
  `material.dispose()` **不会**释放已上传的 `Texture`。
- `joi9000-computer.glb` 自带贴图 + 被替换后直接丢弃的原始材质，长期驻留在
  共享 stage renderer 里，About 路由反复进出会累积 VRAM。
- 【已核】`room3d.ts` 已有现成正确范式：`ownedTextures` 数组在 `:194` 声明、
  `:224` 收集、`:237/:336/:519` 三处释放。**照抄即可**。
- 注意收集时要覆盖 `map` / `emissiveMap` / `normalMap` / `roughnessMap` / `aoMap`，
  以及被换下的原始材质本身。

---

## 二、每帧热路径（P1，单项小、合计可观）

| # | 位置 | 问题 | 修法 | 复核 |
|---|---|---|---|---|
| P1-1 | `JoiSignalLab.tsx:2093-2124` | 每帧 4 次 O(n) section 查找（`getSection`×2 @:2093-94 + `progressWithin`×2 @:2123-24）+ **14 个**无条件 `setProperty`，页面静止时也在持续 style-dirty | `aboutStart`/`contactStart` 提为模块常量；缓存上一帧字符串，同值跳过写入 | 【已修正】v1 写 17 个，实测 14 个；行号收窄。结论成立 |
| P1-2 | `JoiSignalLab.tsx:1696-1704, 1792, 1818-1820, 1887` | 每帧两次 `reelMotions.find` 线性扫描；每帧新建 render options 字面量；`updateProjectionMatrix` 无条件执行；`entry >= 1` 后 hero 的 CPU 更新（orb/solar/dust）在 Contact 仍全速运行 | 按 index 建 map；复用可变 options 对象；exit 变化时才更新投影；`entry >= 1` 早退 | 【已核】 |
| P1-3 | `JoiSignalLab.tsx:1382-1387, 1406-1412, 1414-1420` | 三个辅助函数各自 `getBoundingClientRect`，每次 pointermove 最多两次 rect 读取，与光标/class/style 写交错——全屏 fixed canvas 上的经典读写布局抖动 | 缓存 `{left,top,width,height}` 进现有 ResizeObserver 闭包 | 【已核】三份重复确认 |
| P1-4 | `badge/LanyardBadge.tsx:240-252` | `onPointerMove` 是 **window 级**监听(:318)，在 `visibility:hidden`（aria-hidden）时照样先做 `card.getBoundingClientRect()` + 两次 `setProperty`，**之后**才 `if (!dragging) return`(:253)——不可见挂件造成的全局布局抖动 | 把早退提到 rect 读取**之前**：非 `dragging && !active` 直接 return | 【已核】早退位置确认在 rect 之后 |
| P1-5 | `heroScene.ts:349-358, 375-383` | 三盏投影灯，key 与 terminalKey 默认 `autoUpdate` 每帧重绘 1024² shadow map，星场里收益趋近于零 | 抄 `heroLightOrb.ts:308-310` 已验证的 `autoUpdate=false` + 位移阈值失效模式 | 【已核】 |
| P1-6 | `oceanScene.ts:994-1021` | 海况收敛、指针静止后仍每帧重写 wave table 与约 20 个 uniform；`sampleWave`(:820-837) 每帧分配结果对象 | dirty-check `live` vs `target`；复用 scratch 对象 | 【已核】 |
| P1-7 | `solarSystem.ts:746-755, 792` | nebula 全屏 15-octave fbm，`uOpacity=0` 时仍全价计算；场是静态的只有透明度在动 | `visible` 门控（<0.01 置 false）——最省事且零视觉风险 | 【已核】 |
| P1-8 | `heroScene.ts:558, 667` + `solarSystem.ts:832` | 每帧多次 `updateWorldMatrix(true,false)` / `getWorldPosition` 重复走祖先链 | 动画后一次 `scene.updateMatrixWorld(true)`，其余读缓存 | 【已核】 |
| **P1-9** | `console3d.ts` 整体 | **完全无视 `quality.ts`**：`antialias:true`(:149)、`PCFSoftShadowMap`(:155)、固定 1024² 阴影(:206)、自造 DPR 2/1.6(:857)；`key.shadow.radius=4`(:214) 在 PCFSoft 下是 **no-op**；boot/离屏时 rAF 全速跑 | 引入 `detectQuality()`：`antialias`→`tier.antialias`、DPR→`tier.dprCap`、阴影→`tier.shadows` 分级；删 `:214`；加 IntersectionObserver 或 boot 暂停 | 【已核】全文件 `quality` 零引用；五处行号全部准确。**P1 里收益最大的一条** |
| P1-10 | `JoiSignalLab.tsx:1932` | 卸载链很完整（14 项 dispose），但只到 `renderer.dispose()`，WebGL context 仍被占用到 GC；快速往返详情页向浏览器 context 上限累积 | 在 `renderer.dispose()` 后追加 `renderer.forceContextLoss()` | 【已核】全 `app/` 搜索 `forceContextLoss` 零结果。**一行改动** |
| P1-11 | `console3d.ts:901-911`、`games/tetris.ts:143-147, 304-306` | 指针热路径/碰撞检测的小对象分配 | 提 scratch 向量、预过滤列表；**有可感卡顿再动** | 【已核】v1 附带的 `roomRecords.ts:205,214` 已随 P0-1 失效，删去 |

> **建议顺序**：P1-10（一行）→ P1-9（收益最大）→ P1-4（一行位置调整）→ P1-1 → 其余按表。

---

## 三、结构与死代码（P2）

- **`JoiSignalLab.tsx` 实测 2443 行**【已核】。现成的分解缝，按体量排序：
  1. `FilmCanvas` 效果体 + JSX（:900-1969，约 1070 行）→ 独立文件；
  2. atlas 绘制函数 `drawGrid`/`drawProjectArt`/`drawCoverImage`/`buildAtlas`
     （:450-742）→ art 模块；
  3. 三个 reel-motion 后端（:103-349）→ `reelMotion.ts`；
  4. `buildHandheldModel`（:744-886）与 `console3d.ts` 重复建模同一台掌机 → 抽共享 builder；
  5. `projects` 数组 + href↔SECTIONS 映射 → 仿 `roomObjects.ts` 的数据模块模式。
- **死 CSS**【已修正：v1 的行号范围不完整，照做会留下孤儿】
  `.scanlines`/`.grain` 在 JSX 里已被 post chain 取代（`:2425` 只挂 `.vignette`），
  但残留分布在 **5 处**，必须一起删，否则留下悬空选择器：
  - `:48-50`（`.scanlines, … .grain {` 共享规则块的选择器）
  - `:185`（`.scanlines` 主体）
  - `:206-215`（`.grain` 主体，含 `animation: grainShift`）
  - `:1431`（`@keyframes grainShift`）
  - `:1519`（reduced-motion 块里的 `.grain { animation: none; }`）
- 【已核】`useScrollDriver.ts:240` 的 `scrollHeightStyle` 导出**全仓库零引用**，可删。
- `postfx.ts:120-170`：PREFILTER 与 DOWNSAMPLE 逐字重复同一段 13-tap kernel，
  可提取共享 GLSL（约 -20 行；**不动** pass 顺序与色彩归属）。

---

## 四、无障碍（P2）

### 4.1 菜单 dialog 无焦点管理 【已核】

`JoiSignalLab.tsx:2390-2421`：`role="dialog"` 不聚焦、无 trap/inert、
Escape 挂在不可聚焦 div 上（只有焦点恰好在链接上才生效），打开时背景仍可滚动。
**修法**：打开聚焦首个导航项、window 级 Escape、基本 trap、关闭后焦点还给汉堡按钮。

### 4.2 `prefers-reduced-motion` 覆盖情况 【已修正——v1 结论基本是错的】

> **GLM 注意**：v1 说"CSS 只关了 `.deckLayer`"并要求补 `loadingPulse` 和四组
> title-roll。**这是错的，照做等于白干。** 文件里有 **两个** reduced-motion 块：

| 位置 | 已关掉的 |
|---|---|
| `:1012-1015` | `.deckLayer`（→ `deckLayerIn`）、`.deckShelf i` 过渡 |
| `:1518-1532` | `.grain`（→ `grainShift`）、**`.loader i`（→ `loadingPulse`）**、`.controls > button`/`.dots button` 过渡、**四组 title-roll 全部**、五个选择器的 `will-change` 复位 |

**所以 `loadingPulse` 和 title-roll 早就关掉了，不用碰。**

**真正的缺口是这三个（v1 一个都没提到两个）**：

| 动画 | 定义 | 使用处 | 状态 |
|---|---|---|---|
| `menuIn` | `:1233` | `:1230` | ❌ 未关闭（v1 提到了，属实） |
| `interestPulse` | `:563` | `:560` | ❌ 未关闭（**v1 遗漏**） |
| `roomLabelIn` | `:1017` | `:631` | ❌ 未关闭（**v1 遗漏**） |

**修法**：在 `:1518` 那个块里补三行即可，不要新建第三个块——
文件里已经有两个了，再加一个只会让下一个人重蹈 v1 的覆辙。
顺带建议把 `:1012` 那块合并进 `:1518`，一个文件一个 reduced-motion 块。

- 【已核】`musicRecordSpin`（`:996` 定义）**无任何选择器使用**——
  它已经是死代码。是否保留取决于 P0-1 的裁决结果（选 A 则一并删）。

### 4.3 其余 【已核】

- **hero 文案滚过后仍留在无障碍树**（`module.css:218-230` 只做 opacity +
  `pointer-events:none`）：读屏用户在 About/Contact 深处还能摸到
  "I DESIGN HOW AI ENTERS HUMAN LIFE" 和一个失效的 Sea-State HUD。
  closingPanel 的 visibility cutoff 模式（:574-610）可直接套用。
- **reel 拖拽没有键盘替代**——全站核心交互对键盘不可达。
  （注：`useScrollDriver.ts:112-127` 已有上下键切 section，左右键步进 reel 是对称缺口。）
- 两处中文未标 `lang="zh-CN"`：
  - `work/[slug]/page.tsx:241` 的 `<h2>{section.headingZh}</h2>`——
    紧邻的 `:245` 兄弟节点标了，就它没标。
  - `play/night-tide/page.tsx:49` 的 `<h1>游戏厅</h1>` 与 `:50-53` 副标题。

---

## 五、内容 / SEO / 文档（P2–P3）

### P2-新 iframe postMessage 出站无 origin 限定 【已修正：v1 列为 P0-7，且修法会崩】

- 【已核】`GameHandheld.tsx:121-123` 向游戏 iframe 发合成键盘事件时 targetOrigin 用 `"*"`；
  入站消息反而检查了 `event.source`(:306)。
- **⚠️ v1 给的修法 `new URL(GAME_BUILD_URL).origin` 会抛
  `TypeError: Invalid URL`**（已 node 实测）。原因：
  `GAME_BUILD_URL = ${basePath}/games/night-tide/index.html?…`(:19)，
  而 `basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""`(:18)——
  它**永远是相对路径**，`new URL()` 单参数形式只吃绝对 URL。
  照抄会把一个理论风险变成 `postToGodot` 每次按键必崩。
- **正确修法**：
  ```ts
  const gameOrigin = typeof window === "undefined"
    ? "*"
    : new URL(GAME_BUILD_URL, window.location.href).origin;
  ```
  实际等价于 `window.location.origin`，写成上面这样是为了 basePath 将来真变绝对 URL 时自动跟上。
- **降级理由**：`next.config.mjs:20-21` 里 `basePath` / `assetPrefix` 同源于一个
  **路径**而非主机名，所以 iframe 在当前与可预见配置下**恒为同源**，
  今天的实际风险≈0。这是纵深防御，不是 P0。放在这批一起做即可。

### 其余 【已核】

- **COPY-REVIEW 仍在**：`projectData.ts:92` 与 `labData.ts:27` 两处文件级标记 =
  `/work/*` 与 `/lab` 全部文案仍是未审初稿。
- **文档漂移**：
  - 【已核】`AGENTS.md:57` 仍引用 `AboutRoom.tsx`，该文件**已不存在**
    （room 场景实际在 `room3d.ts`，由 FilmCanvas 挂载）。
  - 【已核】`docs/asset-requests.md` 第 2 行素材项声称实习时间线的 COPY-REVIEW `<ol>`
    还在 `JoiSignalLab.tsx` 里，实际该 marker 已不存在。
- **无任何 JSON-LD**：`/work/*` 加 Article/CreativeWork graph、`/` 加 Person 是便宜收益。
- 【已核】`sitemap.ts` 覆盖完整（SECTIONS 四路由 + work slugs + night-tide + lab，
  `/classic` 有意排除），**缺每项 `lastModified`**。
- 【已核】`robots.ts` 健全（禁 `/api/`），但没有任何 AI 爬虫策略
  （GPTBot/ClaudeBot/CCBot）——想表态的话加在这里，属内容决定。
- `/work/*` 的 `og:title` 不走 `%s — Gallo` 模板（title 走了），与 `/lab`、
  night-tide 不一致。装饰性问题。
- 重定向少尾斜杠：`/joi-signal-lab → /selected-work`、`joi-map → /work/joi-mobile`
  （`app/page.tsx:70`）在 `trailingSlash: true` 下各多一跳 308。
- 【已核】`next.config.mjs:15` 以 `BASE_PATH` 为键、`site.ts` 以 `NEXT_PUBLIC_SITE_URL`
  为键——真做子路径部署时 canonical/sitemap 会缺前缀（已有记录，低优先）。
- 游戏最高分不持久化（snake/tetris/pacman 的 best 只活在闭包里），HUD 却写着
  "BEST"——localStorage 按 game id 存一份，try/catch 兜底隐私模式。
- 【已修正数字】**`public/` 实测 148MB / 136 文件**：`games` 70M、`assets` 24M、
  `reel` 19M、`media` 11M、`3d` 6.1M、`models` 5.2M。night-tide 那包值得做压缩审；
  AGENTS.md 里 ~35MB 孤儿资产仍挂着待确认删除。
- `app/api/room-capture/route.ts`：生产 404、POST-only、有路径穿越清洗——守卫到位；
  剩余风险是开发态任意本地进程可 POST 无上限 base64 写盘。加解码后体积上限（如 8MB）即可。
- AVIF poster（`projectData.ts:122`）在旧 Safari 不显示——可接受，知晓即可。

---

## 六、审查确认没问题的（不要动）

- 帧渲染距离门控实测成立：nightTide `<=1` 帧(:1741)、room `<=1` 帧(:1768)、
  ocean/hero 按 `heroVisible` 门控(:1781-1799)。
- `postfx.ts` 的 ping-pong 历史失效、autoClear 作用域、uniform 共享正确；
  色彩管理（单一 linear→sRGB、hero 独享 tone mapper）**不重构**。
- badge 的 sleep 门控使其每帧 SVG 重建可容忍（但 P1-4 的早退位置仍要修）。
- `oceanScene` 是 tier 意识模范；`roomBase`/`roomObjects` 纯数据无副作用。
- 【已核】`quality.ts` 本身设计干净：`detectQuality()` 有 SSR 分支、
  单次读取、8 个字段覆盖 DPR/bloom/persistence/AA/shadows——
  **P1-9 要接的就是它，不需要新写分级逻辑**。
- `console3d.ts:1174-1200` 的 dispose 异常完整——含把 CSS3D 劫持的屏幕元素按
  `cssText` 快照归还(:147,1199)。
- `RevealRoot` 的 JS 逐个 arm + 仅离屏 arm 模式、SiteHUD 空时钟挂载——SEO/无障碍安全。
- `projectData.ts` 只被 server 上下文导入，不进客户端 bundle；两个数据文件都无 `'use client'`。
- 【已核】`/classic` 确认无任何内部链接指向。
- 客户端/服务端边界健康；图片 alt 均为真实手写；标题层级干净（h1→h2→h3）。

---

## 建议动手顺序

0. **先裁决 P0-1**（唱片：退役 A / 复活 B）。这一条决定 Phase 4 存废，
   也决定 `musicRecordSpin` 和 `room3d.ts` 四个 API 的去留。**在动手前定。**
1. **第一批（一行级修复，先拿收益）**：P1-10 `forceContextLoss` → P0-6 诚实档
   （删 `preventDefault`）→ P1-4 早退位置 → P0-3 wheel 门槛。
2. **第二批（行为修复）**：P0-2 滚动自取消 → P0-4 REEL_ANCHOR 守卫 →
   P0-5 `/classic` layout noindex → P0-8 GLB 纹理释放。
3. **第三批（性能）**：P1-9（console3d 接入 `quality.ts`，收益最大，单独做）→
   P1-1 → P1-2 → 其余按表。
4. **第四批**：无障碍（4.1 焦点管理 + 4.2 **补那三个**动画 + 4.3 lang 属性）
   + 死 CSS 五处清理 + 文档对齐（AGENTS.md:57、asset-requests.md）。

> 每批做完跑 `npx tsc --noEmit`，并按 AGENTS.md 规则做深链落地值检查。
