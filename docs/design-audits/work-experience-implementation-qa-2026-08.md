# Work Experience V3 实施验收

日期：2026-08-30
范围：`/work/joi`、`/work/joi-mobile`、Reel / Next / Back route handoff
结论：Gate 0–E 通过。Phase 6 ICE 粒子未合入；Phase 7 文案与截图继续冻结。

---

## 1. 用户决定如何落地

“四屏”只约束浏览叙事，不限制真实产品的使用时间。

- 桌面实测页面高度为 3024px / 720px，即 4.2 个视口。
- 390 × 844 实测页面高度为 3291.59px，即 3.9 个视口。
- 到 Experience 锚点后，点击入口进入 `interact`；滚动位置被锁定，没有自动超时。
- JOI 的同一个 iframe 从 docked presentation 切到 compact desktop-pet presentation，不重建 session。
- 只有 Escape 或可见的 RETURN TO PAGE 才退出；退出后恢复原滚动位置与触发入口焦点。
- 桌宠不跨 route 常驻。离开 Work route 时按既有协议清理，避免遮挡下一页面。

这让短页面保留清晰节奏，同时不把 JOI Web 最重要的桌宠模式压缩成一段演示动画。

---

## 2. Gate 结果

| Gate | 结果 | 证据 |
|---|---|---|
| 0 来源 baseline | 通过 | Viscose / ICE 官方源码、固定 commit、MIT 边界、SOURCE / PARTIAL / GUESS 证据均保存在 `docs/shader-research/viscose-carousel-2026-08/.web-shader-extractor/`。 |
| A 静态骨架 | 通过 | 两页共用 `WorkExperienceShell`；桌面 4.2 屏、移动 3.9 屏；旧长文、截图、参数表不在当前 route。 |
| B 输入状态机 | 通过 | browse / entering / interact / leaving / reduced 已接线；横向拖拽、惯性、三锚点吸附与页面滚动共用 progress。 |
| C 液态几何 | 通过 | 单 canvas、4 个 SDF shape、3 根 swept-box bridge；桥半径穿过负值后断裂；pointer melt / wake 有迟滞衰减。 |
| D 真实体验 | 通过 | JOI 单 iframe 受控停靠/桌宠；Mobile 加载真实 Apple GLTF 几何并可全屏旋转、缩放、点击屏幕。 |
| E 文字与路由 | 通过 | 真实 h1 始终可读；Reel → identity、Next → next route、Back → perforated film frame；深链、前进、后退无空白。 |

---

## 3. 运行时实测

### JOI Web

- Experience 锚点：`scrollY = 1152`，进入前后保持一致。
- interact 中 `html` 锁定，`body` 不设 overflow；额外捕获父页面 wheel / touch，并保持精确滚动位置。这样不会破坏 sticky 舞台。
- 程序化滚动 920px 后仍停在 `scrollY = 1152`、`mode = interact`。
- RETURN TO PAGE 为视口固定控制，获得焦点，位于 body-level Joi wrapper 之上。
- 全站 HUD、导航与音乐控制在 interact 中不可见且不可点击，退出后恢复。
- 本机未配置生产 broker 时，孔径内显示诚实的离线状态，不伪装为在线体验。

另用临时、确定性的 broker 协议回放验证 embed 契约：

- docked → pet → input → docked 全程只有 1 个 iframe，`src` 未变化。
- iframe 内 Escape 成功调用父页退出回调。
- destroy 后 wrapper、iframe、placeholder 均为 0。
- 临时服务在测试后已停止。

### Joi Mobile

- 390 × 844 下加载 2 个 canvas：液态层 + iPhone 层。
- Apple 模型状态为 ready；实测 48 meshes、73,049 triangles。
- browse 中 iPhone canvas `pointer-events:none`，滚轮属于页面。
- interact 中 iPhone canvas `pointer-events:auto; touch-action:none`，页面仍锁在 `scrollY = 1224`。
- 全屏 iPhone canvas 实测矩形约为 `364 × 783`，完整机身可见。
- 真实拖拽由屏幕正面转到机背摄像头视角，滚动位置未移动。
- Escape 后 mode 回到 browse、overflow 恢复、焦点返回入口。
- WebGL context loss 使用同一 device well 内的静态手机 fallback，不形成空白页。

### 路由交接

- Reel 的可访问 View project 链接与 3D 胶片点击共用 arrival marker。
- arrival frame 使用真实 4:3 胶片比例并折入 identity aperture；直接深链不依赖 marker。
- Work → Work 使用 body-level handoff overlay；新 shell 接住后收缩到 identity。
- Joi Mobile → Game Center 使用非接收页 fallback，overlay 会自行淡出并删除。
- Back to Reel 收束为居中的 4:3 perforated film frame，回到正确项目帧。
- 前进、后退与刷新没有遗留 overlay 或空白状态。

---

## 4. 降级、可访问与 SEO

- SSR：两条 route 均返回 200，存在真实 h1、正确 canonical 与 CreativeWork JSON-LD。
- JS 不运行：CSS 切换为可读静态 stack；Mobile 额外提供 `noscript` 手机 poster。
- shader 首帧真正绘制后才标记 ready；编译或 context loss 时保留 CSS 背板。
- reduced-motion 关闭拓扑变形、余波、惯性、自动转动与长 route handoff，但真实体验入口仍可用。
- 分段 inert：当前不可用的 identity/actions/next 不进入焦点顺序。
- title melt 只作用于 `aria-hidden` 视觉副本；语义 h1 不融化。
- metadata description 只用于搜索与分享，不恢复为可见案例长文。

---

## 5. 性能与资源边界

- Work route 最多两个渲染上下文：共享液态 + 核心体验。
- 液态层：Three r178 单 fullscreen quad，`MAX_SHAPES = 4`、`MAX_LINKS = 3`。
- DPR 上限：液态移动 1.25 / 桌面 1.5；iPhone 移动 1.25 / 桌面 1.6。
- 低档设备关闭 pointer wake，保留主体形状与 bridge。
- 两个 renderer 均不使用 `preserveDrawingBuffer`；卸载时释放资源并 `forceContextLoss`。
- iPhone 阴影贴图按 compact / desktop 使用 1024 / 1536。

---

## 6. 静态检查与已知外部项

通过：

- `npx tsc --noEmit`
- `git diff --check`
- 两条 route 浏览器 warning / error 日志为空。
- 当前 Work 渲染树没有 Product Loop、Responsibility、Outcome、Characters、Updated 等旧可见内容。

未运行 `npm run build`：验收时 dev server 正在运行；仓库约定禁止二者同时操作同一个 `.next/`。

生产部署后仍需做一次真实 broker endpoint smoke test。当前实现已通过离线降级与协议级单 iframe 回放；endpoint、鉴权和部署网络属于外部环境，不用伪造在线证据。

Phase 6 ICE 粒子没有合入，因为融合、拉丝、断裂、余波和真实产品已经形成完整因果链；持续粒子会削弱主角。Phase 7 继续冻结，直到新的短内容逐块获批。
