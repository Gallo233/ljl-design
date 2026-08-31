# Work Experience V3：Living Signal Gallery

日期：2026-08-30
状态：Gate 0–E 已实施并验收；Phase 6 粒子明确未合入，Phase 7 内容仍冻结
范围：/work/joi、/work/joi-mobile，以及 reel → work → reel 的交接
替代范围：本文替代 front-end-visual-plan-2026-08.md 中关于 /work/[slug] 的视觉与动效方案；不推翻其中已经完成的全站修复。

实施验收记录：[`work-experience-implementation-qa-2026-08.md`](./work-experience-implementation-qa-2026-08.md)

---

## 0. 结论

采用 **B 的信息架构 + C 的核心舞台**：

- 页面保持 3–5 屏，不回到长篇 Case Study。
- 中段进入约两屏的全屏液态展厅，让真实产品体验成为唯一主角。
- JOI Web 与 3D iPhone 共用一套进入、分裂、停靠、交互、释放和下一项目逻辑。
- 两页不共用同一种构图：JOI 是横向的 conversation aperture；JOI Mobile 是竖向的 device well。
- 液态是页面结构和状态转换，不是标题、图片和鼠标后面各贴一个特效。

共享骨架是正确方向。它能让人记住“Gallo 的作品通过一块活体接口被打开”，同时允许每个项目用自己的真实对象占据舞台。

### 实施结果

- 约四屏现在只表示叙事距离，不是产品体验的时限。
- JOI 在 Experience 锚点显式进入同一个 iframe 的 compact desktop-pet presentation；页面锁定后可无限停留，直到访客按 Escape 或点击 RETURN TO PAGE。
- Joi Mobile 使用同一状态机进入全屏 device well；进入前滚轮归页面，进入后拖拽与缩放归 3D iPhone。
- 共享液态层承担融合、显式桥、拉丝、断裂、指针余波和标题视觉副本切换；真实文字、iframe 与手机 canvas 保持独立。
- 旧长案例文案、截图、统计和 legacy gallery 已从当前 route 删除，没有恢复为占位内容。

---

## 1. 已锁定的产品决定

### 1.1 访客与任务

页面同时服务四类访客，但按观看时间分层，而不是把所有信息同时堆在首屏：

1. 招聘方在前 8–12 秒内看懂项目名称、类别和完成度，并立即看到真实体验入口。
2. 潜在合作方在 30–90 秒内完成一次真实交互，确认这不是概念图。
3. 同领域设计师可以感受到交互、材质和系统能力，再选择进入 GitHub。
4. 对 Joi 感兴趣的普通访客可以直接启动 JOI Web，或打开 Joi Mobile 的在线原生体验。

页面的主任务是 **体验项目**。理解背景、看源码、联系作者和进入下一个项目都是次级动作。

### 1.2 内容冻结

在滚动、动效和输入逻辑通过 Gate D 前，页面只允许出现：

- 全站 HUD、GALLO、BACK TO REEL。
- 项目编号、项目名、一句极短定位。
- 一个真实核心体验。
- 启动体验、GitHub、外链体验、继续浏览等必要控制。
- WebGL、网络或远端服务失败时的诚实降级信息。
- NEXT PROJECT。

暂时移除：

- Summary 与中英长文。
- Period / Role / Status / Stack。
- Problem / Responsibility / Decision / Outcome。
- Product Loop。
- 当前四张截图与 captions。
- Characters / Updated 等文章统计。
- 3D iPhone 现有的长 header、caption、参数表和说明段。

这些字段可以留在 Git 历史中，但不得以“占位内容”重新渲染。内容回填发生在体验骨架完成之后，而且必须逐块重新批准。

### 1.3 页面长度

目标为约 4 个视口的短体验，允许根据移动端适配落在 3–5 屏之间。不是一页一屏，也不是 5000px 的案例长文。

### 1.4 视觉世界

Work 页面位于 CRT 世界和普通编辑页之间：已经离开机器，但从胶片中带出了一层仍然活着的信号介质。

它不是全黑赛博空间，也不是现在的浅蓝渐变 Case Study。主体保持明亮、可读、安静；只有承载项目的界面会融合、拉丝、恢复和断裂。

---

## 2. 设计意图

### Domain

- 胶片乳剂与显影
- 信号握手与在线状态
- 接口、端口与停靠
- 毛细桥、黏度与表面张力
- 记忆、余波与恢复
- companion presence
- 窗口、设备与可进入的孔径
- splice、thread、release、eject

### Color world

- 银盐相纸的暖白
- CRT 关机后的石墨黑
- 屏幕冷蓝和磷光青
- JOI 的氧化珊瑚色
- Joi Mobile 的霜紫
- iPhone Cosmic Orange 的金属橙
- 连接将断时的暗灰细丝

精确色值属于后续视觉调校，全部标为 PROJECT / GUESS，不冒充参考站 SOURCE 常量。

### Signature

**Living Aperture / 活体接口**：

项目身份卡、真实体验窗口和下一项目不是三个独立 section，而是同一块介质的三个状态。滚动或拖拽使它分裂；卡片离开母体时拉出细丝；真实产品在中央孔径中停靠；离开时孔径重新收束，并把细丝交给下一项目。

这条签名必须明确出现在四处：

1. 项目标题生成体验窗口。
2. 核心体验进入和停靠。
3. 指针在介质边缘留下短暂余波。
4. 当前项目释放并连接下一项目。

### Defaults to reject

1. 长案例模板 → 三幕式短体验。
2. 图片瀑布流 → 一个真实运行的核心对象。
3. 鼠标后面的装饰液滴 → 输入真正改变形状、连接与恢复时间。
4. 每个效果一张 canvas → 一张共享液态 canvas。
5. 完整复制 Viscose 圆环 → 三状态的短轨道，只借用材质物理与输入语法。
6. 隐藏真实文字再显影 → 真实 DOM 文字始终清晰，融化只发生在 aria-hidden 的视觉副本。

---

## 3. 从参考项目中采用什么

以下为 SOURCE 层行为，生产适配仍需经过本地 baseline：

### 3.1 必须采用

1. **SDF smooth-min 融合**

   卡片背板共享一个距离场。靠近时不是 opacity 叠加，而是拓扑上连成一个表面。

2. **显式毛细桥**

   相邻状态之间用 swept-box bridge，而不是泛光线或普通 SVG 曲线。桥从粗颈变细、下垂，并让半径经过零后自然离开抗锯齿区，形成真实的断裂。

3. **惯性与吸附**

   原生页面滚动和空白液态区域的横向拖拽驱动同一个 progress。释放后先按速度滑行，速度下降后再吸附到状态锚点。

4. **快抓慢放的迟滞**

   指针接近时介质快速回应，离开时较慢恢复。不能使用对称 easing，否则只像按钮 hover。

5. **黏性余波**

   指针速度形成短暂的毛细波，停止后继续衰减。余波只改变介质，不在指针中心画一个发光 blob。

6. **视觉位置与材质计算解耦**

   hover 可以让可见对象轻微靠近，但桥宽和拓扑仍按 rest geometry 计算，避免形状反馈越来越胖。

7. **文字 soften → re-harden**

   只用于标题状态切换；保留真实清晰文本，不再让真实 h1 在 1 秒内变成不可读黑块。

### 3.2 延后采用

ICE Works 的 ASCII 粒子只作为 Phase 6 可选层：

- 最多用于首次生成中央孔径，或远端 Joi 正在启动的短暂状态。
- 不用于所有 hover。
- 不横跨整个画面。
- 不在 iPhone 周围持续漂浮。
- reduced-motion、低性能和移动端默认关闭。

粒子不是“液态生命感”的核心。核心是连续形状、迟滞、记忆和因果。

### 3.3 明确不采用

- 18 张卡片和完整圆环。
- 6 秒以上的开场展开。
- 把所有 UI 与文字画进 fragment shader。
- 原站图片与 PP Neue Montreal 字体。
- 资产加载到 100 才允许页面出现的硬门槛。
- 常驻粒子雾。
- 原作缺失的 reduced-motion、键盘和小屏策略。

---

## 4. 页面结构

### 4.1 共享骨架

建议建立 WorkExperienceShell，内部只接受项目 descriptor 与一个真实体验 adapter：

    WorkExperienceShell
    ├── SiteHUD / route navigation
    ├── LiquidStageCanvas
    ├── ProjectIdentityCard
    ├── ExperienceAperture
    │   ├── JoiStageAdapter
    │   └── JoiMobileStageAdapter
    ├── InteractionGate
    ├── ProjectActions
    └── NextProjectCard

共享的部分：

- 页面高度和 sticky stage。
- scroll / drag progress。
- 三个吸附锚点。
- SDF 卡片、桥、余波和断裂。
- browse / interact 输入所有权。
- 标题融化切换。
- reduced-motion、fallback、键盘和路由交接。

项目自定义部分：

- 主孔径比例与位置。
- 核心体验组件。
- 介质颜色和一个项目 accent。
- 体验启动方式。
- 主控制按钮。

### 4.2 三个状态锚点

页面不是多张内容卡 carousel，而是一条只有三个必要状态的短轨道：

1. IDENTITY：项目是什么。
2. EXPERIENCE：现在就体验。
3. RELEASE：去源码、去外链或进入下一项目。

拖动与滚动可以在三个状态之间移动，释放时吸附。体验处于 interact 模式时，轨道暂停并把输入交给产品。

---

## 5. 滚动与动效分镜

以下区间是第一版原型目标，标记为 PROJECT / GUESS；它们需要通过录屏与手感测试确定，不是来源常量。

### Scene 0：Reel handoff

范围：进入页面后的前半屏。

- 延续 reel 的 cream veil，不出现新的 loader。
- 有条件时保持被点击胶片帧的屏幕矩形，等 Work 页的 identity card 接住它。
- 深链访问不依赖该帧，直接从清晰 identity 状态开始。
- reduced-motion 直接显示终态。

### Scene 1：Identity / Birth

范围：约第 0–1 屏。

- 页面加载时标题和一句定位已经可读。
- 项目编号、标题、体验入口先位于一块母卡内。
- 滚动开始后母卡不是淡出，而是向中央体验孔径分裂。
- 分裂顺序保持单一：主孔径先形成，操作卡后形成，NEXT 仍在视口外。
- 标题视觉副本 soften / re-harden；真实文字保持清晰。

### Scene 2：Spread / Dock

范围：约第 1–1.7 屏。

- 中央孔径扩展到主要视口面积。
- Identity 和 actions 向边缘让位，与主孔径之间保留逐渐变细的桥。
- 桥宽由状态分离度驱动，不由 hover 后的位置驱动。
- 指针进入液态空白区时形成局部 melt 和短余波。
- 核心体验此时为 browse 模式：可预览，但不抢走页面滚轮。

### Scene 3：Experience Hold

范围：约第 1.7–3.2 屏，sticky 停留。

- 核心体验占据全屏舞台的视觉中心。
- 显示明确按钮：ENTER JOI 或 INTERACT WITH DEVICE。
- 点击后进入 interact 模式；页面进度暂时固定，真实体验获得指针。四屏只限制叙事距离，不限制体验时间。
- JOI 的孔径扩为全视口桌面场，同一个 iframe 从 docked presentation 切为 compact desktop-pet presentation；访客可无限停留、拖动和缩放。
- Joi Mobile 的设备井扩为全屏展厅，完整机身获得旋转、缩放和屏幕点击输入。
- Escape、EXIT EXPERIENCE 或 CONTINUE 恢复 browse 模式。
- browse 模式下滚轮始终可以离开舞台。
- 不在体验窗口上覆盖 hover 粒子、色差或模糊。

### Scene 4：Release / Next

范围：约第 3.2–4.2 屏。

- 退出 interact 模式后，中央孔径略微收束。
- NEXT PROJECT 从右侧或下方进入，与当前孔径形成最后一根桥。
- 桥逐渐变细并断裂，当前体验降为背景，Next 卡成为新的实心对象。
- 点击 Next 时复用同一种介质交接到下一 route。
- 返回 Reel 使用反方向：Next/identity 收束成一张胶片帧，而不是纯色遮罩后突然出现。

---

## 6. 输入所有权状态机

这是本次重做的地基。当前两个体验都会与页面滚动冲突：iframe 内的 wheel 不会冒泡；iPhone canvas 当前对所有 wheel 调用 preventDefault。

### BROWSE

- window 原生垂直滚动拥有 wheel。
- 液态空白区允许横向拖拽进度。
- 触摸先判断方向：纵向归页面，明确横向后才归轨道。
- iPhone 不允许 wheel zoom。
- JOI iframe 前有透明但可见的 activation gate，iframe 不接收指针。

### ENTERING

- 点击激活后只做一次短交接。
- 液态孔径稳定，不再对 scroll progress 漂移。
- focus 移入真实体验。
- JOI 等待 session；iPhone 打开旋转/缩放输入。

### INTERACT

- 真实体验拥有指针。
- 该状态没有自动超时；访客明确退出后叙事滚动才继续。
- 外围保留一个始终可达的 EXIT / CONTINUE 控制。
- Escape 退出。
- JOI iframe 的内部滚轮与拖拽不再和页面竞争，因为页面状态已显式切换。
- iPhone wheel zoom 只在此状态启用；也可要求 Alt/Option + wheel，最终以浏览测试决定。

### LEAVING

- 先从真实体验回收 focus。
- 解除 iframe / canvas 的输入所有权。
- 下一帧才恢复 page progress，避免一次 wheel 同时缩放对象又滚动页面。

### REDUCED

- 不做拓扑变形、余波、惯性和吸附动画。
- 三个状态使用原生短滚动与静态卡片。
- 产品体验仍可进入。
- 所有内容始终可见。

---

## 7. JOI Web 适配

### 保留

- 单 iframe、单 visitor Core。
- session 的创建、复用和 pagehide 销毁。
- broker 不在线时的诚实 fallback。
- iframe 不 reparent 的现有约束。

### 重做

1. JoiWebEmbed 增加 stage 模式，只输出体验 mount 与 fallback，不再输出当前的长 header、footer 和说明段。
2. joi-embed.js 改为受控 presentation：browse 固定停靠；interact 时主动释放为真实 compact 桌宠，而不是由 IntersectionObserver 在路过 section 时自动浮动。
3. session 默认在接近 Experience Hold 时预备；真正启动可以由 ENTER JOI 明确触发，避免仅路过页面就创建远端 Core。
4. joi-embed.js 暴露 setInteractionEnabled：browse 时 body-level wrapper 设为 pointer-events: none，interact 时恢复；不能只在 route 内盖一层 overlay，因为当前 wrapper 被 append 到 body 且拥有极高 z-index。
5. browse 模式在孔径内显示 activation gate，但不阻止页面滚动；interact 模式移除 gate，并把 focus 交给 iframe。
6. fallback 也占据同一个活体孔径，不产生完全不同的卡片模板。
7. 退出体验后不销毁 session；离开 route 时才销毁。
8. 桌宠态不默认跨 route 追随；页面内部完整体验，路由离开时仍按现有契约释放 session，避免遮挡与资源泄漏。

JOI 页的构图是一块宽阔、略横向的 conversation aperture。角色与聊天 UI 是介质内部唯一复杂的画面，外围保持安静。

---

## 8. JOI Mobile / 3D iPhone 适配

全屏液态展厅非常适合 iPhone，但不是把现在的 990px 渐变盒子放大到全屏。

### 当前必须解决的问题

- 页面把 header、巨大 serif 标题、渐变网格、状态 pill、按钮组、参数表堆成多个风格。
- 手机在舞台中经常过大并被裁切，负空间不足。
- wheel 在 preview 模式一律 preventDefault，鼠标位于 canvas 上时页面几乎无法继续滚动。
- setMode 的 entering / live 能力存在，但 Showcase 没有真正把它接入页面状态。
- debug EXPLODE 不应出现在正式体验结构中。

### 新空间

1. 删除现有 header、caption、参数表、网格渐变背景和胶囊式控制组。
2. 3D canvas 背景透明，由共享 LiquidStageCanvas 提供空间和介质。
3. 手机在桌面端保持完整可见，默认高度约占视口的一半到三分之二；任何比例都以“不裁机身”为验收条件。
4. Cosmic Orange 成为本项目唯一强 accent，霜紫只承担信号/控制状态。
5. 手机后方不是普通 spotlight，而是一块竖向 device well；其 SDF 代理轮廓可以与 identity/actions 卡连接，但不假装精确追踪 3D mesh silhouette。
6. browse 模式允许自动极慢转动，但滚轮必须留给页面。
7. interact 模式启用横拖旋转和 wheel zoom；垂直触摸仍可离开舞台。
8. 点击屏幕继续打开 Appetize 外链，保留真实原生体验的主路径。
9. WebGL 失败时把静态手机按钮放在同一个 device well 中，不切回另一套视觉语言。

### 不做

- 不把 Appetize iframe 硬塞进手机屏幕。
- 不让液态 shader 覆盖或折射机身纹理。
- 不把液态细丝绑到每个摄像头 mesh。
- 不用粒子掩盖现有模型的材质或构图问题。

---

## 9. 液态渲染架构

### 9.1 一张共享 canvas

每个 Work route 只新增一张 LiquidStageCanvas，位于真实 DOM / iframe / iPhone canvas 下方。

页面上下文预算：

- JOI：液态 1 + iframe 内 Joi 自己的渲染上下文。
- JOI Mobile：液态 1 + iPhone Three.js 1。
- 移除当前 gallery 的两张常驻 canvas 与首图一次性 canvas。

禁止 preserveDrawingBuffer。离开视口或 idle 后停止 rAF，只在 progress、pointer、resize 或恢复尾巴仍变化时绘制。

### 9.2 生产栈

实施前先恢复官方 Viscose / Ice 源码 baseline。生产项目建议使用仓库现有 Three r178 的单 fullscreen ShaderMaterial：

- 不引入第二套 Three 版本。
- shader 仍是一张 full-screen quad 和一个 pass。
- DOM rect 通过 ResizeObserver 测量，作为中心、半尺寸、圆角和状态 uniforms。
- MAX_SHAPES 先限定为 4：identity、experience、actions、next。
- MAX_LINKS 先限定为 3。

真实 iframe、文字和 3D phone 不进入 shader texture。shader 负责背板、连接和外部介质；真实内容以 DOM / 独立 canvas 放在上层，保持可访问、可交互和可降级。

### 9.3 动态输入

- scrollProgress：三状态轨道的位置。
- signedVelocity：决定拖尾方向与强度。
- pointerPosition / pointerVelocity：局部 melt 与余波。
- activeShape：当前被选择的物体。
- interactionMode：browse / entering / interact / leaving。
- reducedMotion：静态终态。
- qualityTier：DPR、noise、bridge 和 wake 开关。

### 9.4 真实性规则

- SDF、bridge 公式和原作输入语法标 SOURCE。
- 页面布局、颜色、三个锚点和所有新时间标 PROJECT / GUESS。
- 不把“看起来像”当成 baseline 通过。
- 如果生产改写无法匹配 baseline，先修坐标、时间、alpha 和输入 wiring，不用改颜色或速度遮掩。

---

## 10. 文件级改造建议

### 新增

- app/work/[slug]/WorkExperienceShell.tsx
- app/work/[slug]/work-experience.module.css
- components/work-experience/LiquidStage.tsx
- components/work-experience/liquidStageRenderer.ts
- components/work-experience/useWorkExperienceDriver.ts
- components/work-experience/workExperienceState.ts
- components/work-experience/InteractionGate.tsx
- components/work-experience/adapters/JoiStageAdapter.tsx
- components/work-experience/adapters/JoiMobileStageAdapter.tsx
- components/work-experience/workExperienceData.ts

### 修改

- app/work/[slug]/page.tsx：只保留 metadata、路由、共享 shell 与 adapter 选择。
- components/projectData.ts：收缩为 identity 和机器 metadata；可见长文全部移除。
- components/JoiWebEmbed.tsx：增加 stage / startPolicy / interactionMode。
- public/joi-shell/joi-embed.js：增加固定 dock 与输入激活选项。
- public/joi-shell/joi-embed.css：去除当前重阴影和独立卡片外观，服从 aperture。
- components/joi-mobile-iphone/JoiMobileIPhoneShowcase.tsx：改成 stage adapter，不再自己拥有整套页面排版。
- components/joi-mobile-iphone/createIPhone17ProScene.ts：接入外部 mode；browse 不吞 wheel，interact 才缩放。
- components/ArrivalFade.tsx：升级为可接住 reel frame 的 handoff，但深链保持独立。

### 在新架构验收后删除

- components/DetailGallery.tsx
- components/detail-figure-fx.ts
- 当前 reveal-melt-threshold 页面 SVG 与真实标题 melt 状态机
- project-detail.css 中 summary、case frame、loop、gallery、meta card、旧 iPhone wrapper 等规则
- projectData 中 sections / figures / loop / motion 等暂不使用的数据类型

删除必须发生在新骨架通过 Gate D 后，避免一次提交既拆旧又建新而无法定位回归。

---

## 11. 实施阶段与 Gate

### Phase 0：恢复参考 baseline

- 重新获取官方 Viscose Carousel 与 Ice Works 源码；GLM 的 /tmp 原站包已经不存在。新的 baseline 固定存放在 docs/shader-research/viscose-carousel-2026-08/.web-shader-extractor/，不再依赖临时目录。
- 按 web-shader-extractor 生成 scout-card、replay-manifest、run-state、qa-report。
- 在固定桌面 viewport 验证卡片融合、bridge 断裂、拖拽/滚轮惯性、snap、pointer wake 和文字 morph。
- 保留 MIT attribution；不带入原图和商业字体。

**Gate 0：** baseline 独立运行，关键行为均有 SOURCE / PARTIAL / GUESS 标签。

### Phase 1：清空并建立静态骨架

- 先删除确认不要的可见文案、截图与统计。
- 两个 route 共用 WorkExperienceShell。
- 先用静态卡片完成四屏构图，不写 shader。
- JOI Web 与 iPhone 都能在静态孔径内正常运行和降级。

**Gate A：** 1440 桌面与 390 移动端录屏确认构图、页面长度和核心体验占比。未通过不得加 shader。

### Phase 2：统一 progress 与输入状态机

- 写纯函数 state module。
- 原生 scroll 驱动三状态。
- 空白区拖拽、惯性、低速 snap。
- browse / entering / interact / leaving / reduced 五状态。
- 修复 iPhone wheel 捕获；为 iframe 加 activation gate。

**Gate B：** 用纯色矩形验证滚动、拖拽和真实体验输入不会互相抢夺。未通过不得做材质。

### Phase 3：液态材质 graybox

- 一张 canvas。
- 先做 identity + experience 两块形状的 merge、bridge、break。
- 再加入 actions / next。
- 最后加入 pointer wake 与迟滞。
- 不加粒子、不加彩色 grade、不加文字 morph。

**Gate C：** 只看黑白几何录屏，也能明确读出生成、停靠、拉丝和断裂；如果只能靠颜色看出效果，材质不合格。

### Phase 4：两个真实体验 adapter

- JOI 固定 dock、按需创建 session、显式激活。
- iPhone 重做构图、透明背景、外部 mode、完整机身可见。
- 两页应用项目颜色，但保持共享材质规则。
- 验证远端 Joi 离线、Apple 模型失败与 WebGL context loss。

**Gate D：** 两个 route 都能在 3–5 屏内完成“认出项目 → 体验 → 继续”，且页面内容仍保持冻结清单。

### Phase 5：文字与路由交接

- title 的视觉副本 morph，真实文本保持清晰。
- reel frame → identity aperture。
- next project → 下一 route。
- back to reel 反向收束。

**Gate E：** 深链、前进、后退、刷新、服务端 fallback 和 reduced-motion 都不出现空白页。

### Phase 6：可选 ICE 粒子

- 只做一版入口 assembly A/B 测试。
- 如果粒子没有增强“真实体验即将启动”的因果，就不合入。
- 不因为已经抽取了源码而强行使用。

### Phase 7：内容回填

- 只有 Gate E 通过后开始。
- 每新增一块内容都必须回答：它是否帮助访客进入、理解或继续体验？
- 不恢复旧 Case Study 模板。
- 截图只有在真实体验无法表达某个关键状态时才加入，而且一次只加一组。

---

## 12. 验收标准

### 体验

- 首屏 10 秒内可识别项目并找到体验入口。
- 两个项目都以真实产品为最大视觉对象。
- 页面总长维持 3–5 屏。
- 没有未经重新批准的旧文案或截图。
- JOI 离线与 iPhone WebGL 失败仍能完成页面路径。

### 动效

- 静止时介质完全稳定，不持续抖动或呼吸。
- 卡片靠近时融合，分离时有可见颈部、拉丝和断裂。
- 指针余波在停止后衰减，不成为持续跟随光标。
- release 明显慢于 acquire。
- title 在每一帧都可读。
- snap 不会把正在阅读或操作的人强行拉走。

### 输入

- browse 状态下，把鼠标放在 iPhone 或 JOI 区域仍可正常滚离页面。
- interact 状态下，产品拥有完整指针输入。
- Escape 与可见按钮都能退出体验。
- iPhone 触摸纵向滚动页面、横向明确拖动才旋转。
- 一次 wheel 不会同时改变页面进度和产品缩放。

### 性能

- 每页最多两个 WebGL context：共享液态 + 核心体验。
- 液态 canvas 不使用 preserveDrawingBuffer。
- DPR 受 quality tier 限制；低档关闭 noise/wake，保留形状与 bridge。
- 离屏停止 rAF；idle 尾巴结束后停止绘制。
- context loss 后出现静态可读页面，不把失败记成永久空白。
- 移动端优先保证真实体验，再决定是否保留动态 bridge。

### 无障碍

- 标题、按钮和说明都是真实 DOM。
- 键盘可以推进状态、进入体验、退出体验和打开下一项目。
- focus 可见，退出后返回触发按钮。
- reduced-motion 无拓扑变形、余波、惯性与自动转动。
- JS 未运行、shader 未编译或资源未加载时，页面内容仍然可见。

### 路由与 SEO

- /work/joi 与 /work/joi-mobile 深链首屏均有内容。
- metadata、canonical、OG 与 JSON-LD 不依赖可见长文。
- reel:return 与 reel:arrive 不影响直接访问。
- 后退不重复创建 Joi session，不重播不必要 loader。

---

## 13. 开发与回滚策略

- 新实现放在独立 feature flag 或工作分支中，不在当前页面上连续打补丁。
- 当前版本只作为 Before 证据；不要继续调 DetailGallery 的颜色、噪声或 glyph 密度。
- 每个 Gate 单独提交，能独立回滚。
- 先用纯色几何验证结构和输入，再接真实体验，再做材质，最后才做文字和粒子。
- 每个 Gate 提供桌面与移动端短录屏。动效不能只凭静态截图验收。
- npx tsc --noEmit 每阶段执行；dev server 运行时不执行 npm run build。

---

## 14. 最终体验一句话

从胶片中弹出的项目卡仍带着活性：它在滚动中分裂出一个真实可进入的界面，访客进入 Joi 或拿起手机体验；离开时介质慢慢松手、拉出最后一根细丝，再把这根线交给下一件作品。
