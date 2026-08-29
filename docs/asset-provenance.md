# About 房间资产来源（asset provenance）

> `roomBase.ts` 头注释与 AGENTS.md 引用本文件。一句话版本：**About 房间的几何与
> 烘焙是第三方采集物，不是自有资产；房间的人格（道具、终端、光、文案）是自有的。**

## 基座：desk study 采集

- 来源：pinchen.me 的 3D 房间（Pin Chen），2025-08-25 用 web-shader-extractor 采集，
  原始材料存 `docs/pinchen-room-research/`。
- 几何：`desk.glb`（1,269,272 B，Draco 压缩）→ 本站
  `public/models/about-room-base.glb`
  （sha256 `34f1999…c319`，完整校验值见 `public/models/about-room-base/manifest.json`）。
- 烘焙：七张 light-day 图集（env / group1 / group2 / group3 / books / camera /
  vinyl），`public/models/about-room-base/light-day-*.webp`，逐张 sha256 在同一
  manifest 里。**只有这一套光照状态**；三档时刻（day/blue/night）是本站的实时调色
  （`room3d.ts` 的 `setLightPreset`），不是对方的 night 烘焙。
- 采集物不带材质：网格→图集的绑定表是本站逆向恢复的（`roomBase.ts`
  `AUTHORED_NODE_ATLAS`，方法见其注释）。

## 在此之上是自有的

- 唱机：`roomTurntable.ts` + `roomPlatter.ts`（采集的原唱机被退役，本站自建机器
  站进原槽位）。
- 道具：`roomProps.ts`（猫 Nick、掌机、篮球+手套）——程序化几何 + 程序化贴图。
- 终端：`roomTerminal.ts`（画在采集屏幕上的 CanvasTexture）。
- 光：`setLightPreset` 的 tint 与灯辉。
- 全部文案：`roomObjects.ts` / `roomBooks.ts` / `roomFilms.ts` / 终端命令输出——
  COPY-REVIEW 状态见各文件。

## 使用的边界

- 采集物仅用于本站自己的 About 房间场景，不做二次分发素材。
- 交互模式（点击→推近→覆盖层）参考了 pinchen.me 的公开实现机制，记录在
  `docs/pinchen-room-research/room-miniapps-2026-08.md`；实现、内容与视觉均为本站
  自己的语言。
- 若将来替换基座（自建房间），`roomBase.ts` 的表结构就是为此准备的——换表不动
  道具、热点与相机。
