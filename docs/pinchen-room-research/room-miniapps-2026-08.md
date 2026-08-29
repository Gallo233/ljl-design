# pinchen.me 房间交互小应用 — 源码机制笔记（2026-08-28）

> 从 pinchen.me 现役构建（2026-08-28 抓取）反混淆整理。抓取物存 `/tmp/pinchen-live/`
> （临时），本文件是结论。旧采集（8 月 25 日，`evidence/source/`）不含这些交互。
> 关键 chunk：`9941.<hash>.js`（RoomExperience，约 146KB，全部小应用所在）。

## 总架构

- **房间是独立站点变体**（`SITE_VARIANT=room`，部署在 room.pinchen.me），主站嵌它。
- 点击物件 → 相机飞行 → 打开应用。物件用 `groupId` 分组：mesh 节点名 →
  `computer / whiteboard / filmrolls / writing / turntable / music / poster /
  guitar / book1..10 / chair`（macbook/screen→computer，camera/film→filmrolls，
  pen/纸堆→writing，POWER_DIAL→music）。
- **相机飞行是 GSAP**：`power3.inOut`，约 1.5s，飞行期间 OrbitControls 禁用、
  到达后复用，每帧 `lookAt` 目标。另有 `back.out(1.4)` 用于小动效。
- **悬停高亮**：透明度渐隐（0.25s）+ 光标切换；离开恢复。
- **应用覆盖层是 DOM**（共享框架组件）：背板点击关闭 + 内容面板，GSAP 进出场
  （背板 opacity、面板 opacity + y 30→0；出场反向 y→40），`window` 级 Escape。
  移动端取 `window.innerWidth < 1024 ? "half" : "full"` 两档布局。
- 房间 chunk 外面包了 ErrorBoundary（"Something went wrong loading the room"
  + Close Room 按钮）。

## 各应用实现

### 终端（MacBook 屏上）
- **CanvasTexture 方案**：2D canvas 逐键重绘 → 贴到 3D 屏幕网格。DPR 感知
  （`scale(dpr)`），行高按设备分 38/18 两档，纹理 `generateMipmaps:false` +
  anisotropy 上限 8。
- 命令集：`help / about / projects / education / socials / echo / history /
  welcome / clear`；`projects go <n>`、`socials go <n>` 带参数跳转；Tab 补全；
  上下箭头历史；Ctrl+L 清屏；Escape 退出。
- **桌面**：window 捕获阶段 keydown。**移动端**：隐藏 1px `<input type=text>`
  （opacity 0.015、fontSize 16px 防 iOS 缩放、`enterkeyhint=done`、
  `navigator.virtualKeyboard.show()`）转发输入——经典 iOS 键盘桥。
- 内嵌数据：项目列表（名称/描述/周期/URL）、社交链接、ASCII 名字画。
- 有 debug 后门：`?debug-terminal=1` 或 localStorage `room:terminal-debug`。

### 白板
- DOM 覆盖层 + canvas，5 支墨色（`#222222 #c0392b #2471a3 #27874a #d4a017`），
  笔宽 4；打印按钮走 SVG 导出；清除按钮。
- **画稿持久化**：dataURL 快照存 **IndexedDB**（库 `room-local-state`，
  store `artifacts`，键 `whiteboard-snapshot-v1`，记录 `{dataUrl, updatedAt}`）；
  localStorage（`room-whiteboard-v1`，JSON v2）做回退，双写择新、读后迁移清理。

### 胶片摄影册
- DOM 覆盖层。数据模型：胶卷数组 `{名称, 年份, exp 张数, 照片[], 边缘印字
  edgeText, 厂商 manufacturer}`——Kodak 片框排印（齿孔、框号、edge text）是
  按 edgeText 数据画出来的，不是贴图。
- 按胶卷分 Tab（`Taiwan 2026 · 6 exp`…），横向照片条 + 进度条 + 前后翻页。
- `INSPECT VOLUME ↗` 外链他的 Letterboxd。

### 书架 = 阅读时间线
- **书是从数据生成的 3D 网格**：每本 `{title, author, year, note, quote,
  quoteBy, cover/accent/ink 颜色, height, thickness, depth}`——书的立体尺寸
  都在数据里，书架板 + 每本书可点，悬停整组联动。
- 点击 → 相机飞到书架 → DOM 覆盖层：年份刻度轴（2024/2025/2026）+ 选中书的
  `日期 / 书名(衬线大字) / 作者 / INSPECT VOLUME ↗`。

### 唱机音乐
- 专辑→曲目→**YouTube 流**（react-player）；zustand store；用户自建歌单持久化
  localStorage（`vinyl-user-tracks` v1）；黑胶面（贴纸）有 3 张可换 PNG。

## 光照系统（对时刻方案最关键）

- **四套烘焙状态**：`light-day / light-night / off-day / off-night`，路径
  `/assets/room/textures/<state>/<atlas>.webp`，另有 `/textures-mobile/` 移动版。
- 纹理管理器：按状态缓存、可卸载（dispose）、加载进度回调、`hasVariant` 查询。
- 我们当时只采集了 **light-day** 一套（共 7 张：env/group1/group2/group3/
  books/camera/vinyl）。

## 与我们现状的对照

| pinchen | 我们已有 | 差距 |
|---|---|---|
| GSAP 相机飞行 | room3d 焦点相机 lerp（`focusAmount` 0.075） | 只差逐物件机位表 |
| DOM 覆盖层框架 | menuSheet / JoiMusicPlayer 两套先例 | 需要一个通用 app-sheet |
| CanvasTexture 终端 | hero 屏幕已有纹理管线；room CRT 屏无 | 终端本体全新 |
| 书=数据生成网格 | 书架是烘焙贴图的一部分 | 书网格全新（叠加在模型上） |
| IndexedDB 持久化 | 无此模式 | 若做涂鸦面需要 |
| 四套光照烘焙 | 一套（light-day） | 时刻系统用调色+实时光补 |
