# 前端视觉优化方案（v2，已对源码复核）

> **状态：可执行。** 本版已逐条对着源码复核，配套
> [optimization-review-2026-08.md](./optimization-review-2026-08.md) v2 一起读。
> **但 Phase 4 被阻塞**，见下方「⛔ 动手前必须裁决的一件事」。
> 标记约定：【已核】= 行号与结论对着源码验过，可直接照做；
> 【已修正】= v1 写错了，本版给的是正确版本；【新增】= v1 遗漏。
> 行号基于 `b9c89bb`。条目带 `- [ ]` 复选框。

---

## ⛔ 动手前必须裁决的一件事

**Phase 4（唱片装置复活）建立在一个错误前提上。**

v1 把 `roomRecords.ts` 的空 `records` 数组当成"断头链路"，要重建。
但复核发现 `roomRecords.ts:92-99` 有一段作者注释写明这是**主动退役**，理由是构图：

> 三张墙上压胶在当前近景构图里挂在画面上沿之外，读起来像"导航里飘着三张唱片"
> 而不是"墙上挂着三张唱片"；选面的动作已移到 console 货架，"端着唱片走过桌子"
> 也失去了存在意义。网格是**故意隐藏而非删除**——几何体已烘进 capture 和 lightmap，
> 删掉会在墙上留洞。

**这意味着：**

- 退役理由是**取景**，不是实现难度。Phase 4 只做「数据链重建 + 交互全通」，
  修好的是一台**观众看不见的机器**——唱片仍在画面外。
- 真要做 Phase 4，必须**前置一条相机/取景调整项**，而那会动到 About 房间的
  既定构图，成本远超 v1 估计的"填充 `Record3D`"。

**请二选一：**

- [ ] **A. 维持退役**（建议）：Phase 4 整个删除，改为「清理」——删掉
      `roomRecords.ts` 整套 rig、`room3d.ts:54-60` 四个 API 声明与 `:495-514` 实现、
      shell 侧 `carryingRecord` 分支、以及死动画 `musicRecordSpin`（`module.css:996`，
      **已核：无任何选择器使用**）。净减代码，零风险，且 About 房间的触觉感
      可以用 Phase 4' 的低成本替代项（见下）拿回来。
- [ ] **B. 复活**：保留 Phase 4，但必须先加 4.0「取景调整」，并接受它会重新打开
      About 房间构图这件已经收敛的事。

> 未裁决前，GLB 请**不要动 Phase 4**，其余 Phase 不受影响，可以照常推进。

---

## 0. 已锁定的三个决定

1. **GSAP 仅限轻世界 DOM**：只用于 `/work`、`/lab` 的离散时间线；**不用 ScrollTrigger**；
   CRT 世界的滚动时序（自研 lerp + 捕捉 + 后处理联动）保持唯一权威。
2. ~~唱片装置修好，不拆~~ → **待裁决，见上方 ⛔**。
3. **四个方向全做**：CRT 世界 / 轻世界排版 / 跨世界转场 /
   About 房间触觉（若选 A，第四项改为「低成本触觉替代」）。

---

## 参考站取材结论

| 参考 | 取什么 | 落在哪 |
|---|---|---|
| shader.se（已逆向，`docs/shader-research/`） | 「未移植清单」：滚动速度作为一等视觉输入；DOM 字与玻璃的关系；逐转场编排 | Phase 1 |
| haoqi.design（`docs/research/haoqi.design/`） | 轻世界排版节奏：巨型字时刻、interlude 间奏、网格韵律 | Phase 2 |
| Analogic（vinyl-rho-peach.vercel.app） | 「一件珍贵可触物」：3D 唱机、转速切换、boot 文案语气 | Phase 4（待裁决） |
| pinchen.me | 首页即极简文字页 + 一件 3D 房间——验证现有克制路线，不新增大件 | 全局原则 |
| threeui.com | 组件词汇：标题字入场、Uplink 式 loader、ASCII 转场、CRT 诊断面板 | Phase 1/2/3 |
| motionsites.ai | 趋势 feed，仅作情绪板，不作为工艺基准 | — |
| GSAP | 离散 DOM timeline 引擎 | Phase 2，边界见决定 1 |

---

## Phase 0 · 地基：先修「手感」bug 与死代码

动效优化的地基——用户可直接感知的缺陷，先于一切新增视觉效果。
**每条都对应 review v2 的编号，实施细节以 review 为准，这里只列视觉相关的。**

- [ ] **导航/键盘滑动自取消**（review P0-2）【已核】：`useScrollDriver.ts:107-110` 的
      `onScroll` 取消 >80ms 的动画，而 `:145-151` 的 `tick` 每帧 `window.scrollTo`
      触发的正是同一个 handler。2–3 秒 glide 80ms 就死。
      驱动器自身滚动打标记（`lastWrittenY` 比对），只让真实手势取消。
      ⚠️ `:135-142` 的 bootLock 回弹也在调 `scrollTo`，标记要一并覆盖。

- [ ] **wheel 归属门槛**（review P0-3）【已核】：`JoiSignalLab.tsx:1627` 的
      `handleWheel` 开头加 `if (!reelOwnsPointer()) return;`。
      **已核可放心**：`reelOwnsPointer()`(:1433) 只依赖 `entryRef`/`exitRef`/
      `roomPresenceRef` 三个滚动态 ref，不依赖指针坐标，从 wheel 调用完全安全。

- [ ] **reduced-motion CSS 补全**【**已修正——v1 这条基本是错的**】
      > v1 说「现只关 `.deckLayer`，补 `loadingPulse`、四组 title-roll、`menuIn`」。
      > 实际文件里有**两个** `@media (prefers-reduced-motion: reduce)` 块：
      > `:1012-1015` 和 `:1518-1532`。v1 只找到了第一个。
      > **`loadingPulse`（`.loader i`，:1519）和四组 title-roll（:1522-1525）
      > 早就关掉了——不要再去"补"。**

      真正缺的是这三个（v1 遗漏其中两个）：
      | 动画 | 定义 | 使用处 |
      |---|---|---|
      | `menuIn` | :1233 | :1230 |
      | `interestPulse` | :563 | :560 |【新增】
      | `roomLabelIn` | :1017 | :631 |【新增】

      补在 `:1518` 那个块里，**不要新建第三个块**；
      顺带把 `:1012` 那块合并进去，一个文件一个 reduced-motion 块。

- [ ] **死视觉代码清理**【已修正：v1 行号范围不完整，照做会留孤儿选择器】
      - `.scanlines`/`.grain` 已被 post chain 取代（JSX `:2425` 只挂 `.vignette`），
        残留分布在 **5 处**，必须一起删：
        `module.css:48-50`（共享规则块选择器）、`:185`、`:206-215`、
        `:1431`（`@keyframes grainShift`）、`:1519`（reduced-motion 里的 `.grain`）。
      - 死变量 `--computer-opacity`(`JoiSignalLab.tsx:2113`) /
        `--computer-scale`(`:2150`)【已核：全仓库 CSS 零消费】。
      - `useScrollDriver.ts:240` 的 `scrollHeightStyle` 导出【已核：零引用】。
      - `musicRecordSpin`（`module.css:996`）【已核：无选择器使用】——
        **去留取决于 ⛔ 裁决**：选 A 则删，选 B 则 Phase 4 复活。

- [ ] **菜单 dialog 焦点管理**（review 4.1）【已核】：`JoiSignalLab.tsx:2390-2421`
      打开聚焦首项、window 级 Escape、基本 trap、关闭还焦点给汉堡。

---

## Phase 1 · CRT 世界：速度即信号

shader.se 未移植项的本地化。核心想法：**滚动是信号输入——快滚＝信号失稳，停下＝画面锁定。**

- [ ] **速度驱动后处理**【已核】：driver 已输出 velocity（`useScrollDriver.ts:157-159`
      算出 `velocity` 与 `direction`）→ 新增小映射模块接入 `FilmCanvas` onFrame，
      调制 `post.uniforms` 既有四旋钮（grain / aberration / distortion / persistence）。
      速度归零则偏移完全归零；mobile 按 `quality.ts` 减半。
      **不动九步链顺序与色彩归属。**
      > 建议与 review P1-1 一起做：那里正要给每帧 `setProperty` 加同值跳过缓存，
      > 速度映射的写入走同一套缓存，不额外增加 style-dirty。

- [ ] **消费免费进度钩子**【已核】：`--about-progress` / `--contact-progress` 在
      `JoiSignalLab.tsx:2123-2124` 每帧写入，**全仓库 CSS 零消费**（只有 `:2282`
      一句注释提到）。About：chips/房间标签随进度点亮；Contact：call sheet 行按
      进度逐行落位。纯 CSS，零新管线。

- [ ] **DOM 字过玻璃（折衷档）**：hero h1 与 closing h2 加速度耦合的色差 text-shadow
      + 极轻 skew（新 `--velocity` CSS 变量）；`.vignette` 与 shader bezel 羽化校准。
      MSDF 字体进链路（shader.se 完整方案）**不做**，维持「已记录差距」。

- [ ] **Boot loader 升级**（threeui Uplink 方向）：文案保留，三系统清单逐行点亮 +
      块状光标；复用现有 `filmReady∧computerReady∧fontsReady` 信号，纯 CSS/className。
      ⚠️ `.loader i` 的 `loadingPulse` 已在 reduced-motion 下关闭（:1519），
      新增的逐行点亮动画**记得同样加进那个块**。

---

## Phase 2 · 轻世界：字体统一 + 编辑动效（GSAP 在此引入）

- [ ] **引入 GSAP**【已核：`package.json` 目前无 gsap】：`npm i gsap`；
      仅 `/work/[slug]` 与 `/lab` **动态 import**；触发仍由 IntersectionObserver/
      RevealRoot 负责，GSAP 只播放 timeline；`prefers-reduced-motion` 直出终态。

- [ ] **品牌字体进轻世界**（最大单项视觉收益）【已核：`app/fonts.ts` 三件套齐备，
      导出 `displayFont`/`bodyFont`/`monoFont` 与合成好的 `fontVariables`】：
      `/work` 与 `/lab` 挂 `fontVariables`，把 `project-detail.css` / `redesign.css` /
      `lab.module.css` 的 Inter/system/Georgia 旧栈换成 `--font-signal-*`：
      标题 Instrument Serif、正文 DM Sans、kicker/标注 IBM Plex Mono。`/classic` 不动。
      ⚠️【已核】`Instrument_Serif` 只声明了 `weight: "400"`——原先用 900 的地方
      必须重调 scale/字距，不能指望字重补偿。

- [ ] **h1 入场 timeline**：ArrivalFade 揭幕 → h1 clip-path 升起（Matte Rise 式）
      + 字符微 stagger（GSAP）。程度见 §A.6。

- [ ] **Interlude 节奏**（haoqi speed-line 本地化）：章节间全宽分隔条——
      巨大 mono 序号 + 顶部细线 + 右对齐短注；纯 CSS；复用现有 section 编号语义。

- [ ] **`data-reveal` 增加 clip 变体**：`globals.css` 加 `.reveal-clip-armed`
      （clip-path 揭开），RevealRoot 逻辑不动。

- [ ] **CSS 债务收敛（视觉中性）**【已核：实测行数与 v1 完全一致】：
      `/work` 现背 **7,387 行**遗留 CSS（`redesign.css` 1276 + `styles.css` 4362 +
      `experience.css` 1157 + `project-detail.css` 592）。审计实际命中的子集后
      卸掉 `styles.css`/`experience.css` 全量导入。
      方法：改前 record 关键节点 computed styles，删后 diff 必须为零。
      ⚠️ 这三个文件也被 `/classic`（`app/classic/page.tsx:3-5`）导入——
      **`/classic` 不动**是既定原则，所以只能改 `/work` 侧的导入，不能删文件。

---

## Phase 3 · 跨世界转场叙事

- [ ] **离场 veil 叙事化**（`JoiSignalLab.tsx` leaveVeil:1103-1120 +
      open handler:2216-2233）：奶油 veil 中央加一行 mono 状态字
      （如 `EJECTING — /work/joi`），与现有 300ms 同步。文案见 §A.1。

- [ ] **进场合流**：ArrivalFade（`globals.css:46-58`）揭幕与 Phase 2 的 h1 入场
      合成一条 ~200ms 序列。

- [ ] **回程跳过 boot**（全站最大体感摩擦）：`JoiSignalLab.tsx:2040-2050` 检测
      session `reel:return` → boot loader UI 不渲染（150ms 快闪或直出），
      恢复 step 后 veil 揭开；**boot lock 释放机制保留不变**。
      ⚠️ 与 Phase 0 的「滚动自取消」有交互：bootLock 期间 `tick` 会 `scrollTo` 回弹，
      两条一起做时确认 `lastWrittenY` 标记覆盖了 bootLock 分支。

- [ ] （备选，默认不做）ASCII 散布 veil——仅当纯色 veil 显得平淡时启用。

---

## Phase 4 · About 房间触觉 ⛔ 待裁决

**若选 B（复活），条目如下，并须先做 4.0：**

- [ ] **4.0 取景调整**【新增，v1 遗漏的前置项】：解决 `roomRecords.ts:92-99` 记录的
      构图问题——近景里唱片在画面上沿之外。不解决这条，下面全部是不可见的工作。
- [ ] **数据链重建**：从 `roomBase.ts` / `roomObjects.ts` 的 record 节点重建
      `Record3D` 填充（`roomRecords.ts:87-108`），`byId` / `pickables` 非空。
      注意 `:100-105` 现在是**主动把这些节点 `visible = false`** 的循环，要一并处理。
- [ ] **交互全通**：`grabRecordAt / moveRecordTo / releaseRecord`
      （`room3d.ts:497-514`）→ platter 停靠 → tonearm 落臂 → 33⅓/45 转速切换
      （`setPlatterRpm` :495）→ music deck 播放联动；`musicRecordSpin` 复活接上。
- [ ] **指针与提示**：record hover cursor=grab + `roomLabel` 文案。
- [ ] **reduced-motion**：唱片预置 platter 上、无物理，点击切转速。
      （并把 `roomLabelIn` 一并补进 reduced-motion 块，见 Phase 0。）
- [ ] **进度氛围**：`--about-progress` 驱动房间主灯色温 0→1 冷到暖。

**若选 A（维持退役），Phase 4 改为「Phase 4' · 低成本触觉替代」：**

- [ ] **清理**：删除整套 record rig（清单见 ⛔ 段）。
- [ ] **进度氛围**：`--about-progress` 驱动房间主灯色温 0→1 冷到暖
      （**这条与唱片无关，是 Phase 4 里唯一不依赖裁决的项，建议无论如何都做**）。
- [ ] **既有物件的触觉加强**：`roomObjects.ts` 已有 8 个兴趣物件 id 与
      `roomLabel` 路由（`:1454-1477`），成本远低于唱片，且它们在画面内。
      给 hover 加轻微 lift + label 入场，就能拿回"可触物"的感觉。

---

## 统一细节

- [ ] **缓动 token 进 `globals.css`**：`--ease-out: cubic-bezier(.22,1,.36,1)`、
      `--ease-out-expo: cubic-bezier(.16,1,.3,1)`；新增代码一律用 token，存量渐进替换。
      【已核】`module.css:1322` 的 title-roll 已在用 `cubic-bezier(.22,1,.36,1)`
      字面量，是现成的第一个替换点。
- [ ] **文档同步**：AGENTS.md 记录「GSAP 限轻世界」与唱片裁决结果；
      同时修掉 review v2 指出的两处漂移——`AGENTS.md:57` 引用了**已不存在**的
      `AboutRoom.tsx`，`docs/asset-requests.md` 声称 COPY-REVIEW `<ol>` 还在
      `JoiSignalLab.tsx` 里（实际 marker 已不存在）。

---

## 明确不做

- 不引 ScrollTrigger、不重写滚动驱动（CRT 世界时序仍完全自研）。
- MSDF 字体进 post 链路不做（成本/收益不成立，维持「已记录差距」状态）。
- reel 几何数字、post 链九步顺序、色彩管理归属不动（SOURCE 事实，AGENTS.md 冻结）。
- 不新增大件 3D 场景（pinchen 验证克制路线）；badge 保持现状
  （但 review P1-4 的早退位置仍要修，那是性能不是视觉）。
- 不动 `/classic`（含它导入的三个 CSS 文件本体）。

---

## 验证方式（按 AGENTS.md 规则）

- 每阶段 `npx tsc --noEmit`【已核：当前基线零错误、退出码 0，
  所以任何报错都是本次改动引入的】；深链 `/`、`/selected-work`、`/about-me`、
  `/contact` 落地值检查。
- 动效验证靠读 DOM / 计算样式 / CSS 变量数值，**不靠截屏**（agent 浏览器 rAF 冻结）；
  GSAP timeline 用 `timeScale(50)` 快进后查终态 computed style。
- 速度映射打印映射前后数值验证；Phase 2 字体切换逐路由核对
  `getComputedStyle(el).fontFamily`。
- **reduced-motion 验证**：用 `resize_window` 的 `colorScheme` 同类手段模拟，
  或直接查 `matchMedia("(prefers-reduced-motion: reduce)")` 分支下
  `getComputedStyle(el).animationName === "none"`。三个补上的动画逐个核。
- 遵守「dev server 运行时不 `npm run build`」；dev server 用 `.claude/launch.json` 配置。

---

## 落地顺序

**Phase 0 → 1 → 3 → 2 → 4**（转场先于轻世界：依赖少、体感收益即时）。
每阶段独立可交付、可单独回滚。

> 建议在 Phase 0 之前先插一个「一行级修复批」：review v2 的 P1-10
> （`forceContextLoss`）、P0-6 诚实档、P1-4 早退位置——三条都是单行改动，
> 合计 10 分钟，先把最脏的资源泄漏止住。

---

## §A 待作者修订的开放位

这些是**内容决定，只有你能填**；不填则用方括号里的默认值实现。

0. **⛔ 唱片：退役 A 还是复活 B**（见文首）——**这条最重要，会决定 Phase 4 存废。**
1. **veil 状态字文案**（Phase 3.1）：格式建议 `EJECTING — {目的地}`，
   还是别的机器动词？（默认 `EJECTING`）
2. **interlude 短注文案**（Phase 2.4）：双语还是仅中文？
   （默认：仅 mono 英文序号 + 无短注，先出骨架）
3. **boot 三系统清单文案**（Phase 1.4）：现在是 `BOOTING JOI9000 / n/3 SYSTEMS`，
   三行系统名要不要换成语义化名字（如 `FILM TRANSPORT / ROOM SERVICE / TYPE SETTER`）？
4. **唱片 × music deck 映射**（Phase 4.2）：仅当 §A.0 选 B 时才需要回答。
5. **night-tide 是否也换品牌字体**：Phase 2 只动 `/work`、`/lab`；游戏中心跟不跟？
   （注：该页有两处中文缺 `lang="zh-CN"`，见 review 4.3，换字体时顺手补）
6. **h1 字符 stagger 的程度**（Phase 2.3）：逐字（编辑感强、实现重）
   还是整块 clip 升起 + 词语级 stagger（克制、快）？
7. **CSS 债务收敛的激进程度**（Phase 2.6）：只卸 `styles.css`/`experience.css`
   未命中规则（保守，推荐），还是把 `/work` 样式全量收进现代 module（大工程，另立阶段）？
8. **AI 爬虫策略**（review 第五节）：`robots.ts` 要不要对
   GPTBot / ClaudeBot / CCBot 表态？这是立场问题，不是技术问题。（默认：不动）
