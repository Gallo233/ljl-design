# 我的房间 — 参考图生成提示词

用途：先出一张参考图定调，我再对着它用 three.js 程序化重建（`app/joi-signal-lab/room3d.ts`）。
所以图不只是"好看"，还要**可重建**：形体简单、轮廓清楚、物件互不遮挡。

---

## 主提示词（英文，直接贴给出图模型）

```
A cozy nighttime desk corner in a small room, stylized 3D diorama, three-quarter
view from slightly above, gentle perspective, one continuous scene.

In the scene, each object clearly separated and readable in silhouette:
a chunky retro CRT monitor on a wooden desk, cream plastic shell, screen glowing
soft cyan with abstract scanline interface; an angled desk lamp with a coral-orange
shade throwing a warm pool of light across the desk; a graphics tablet with a slim
stylus resting on it; a small handheld game console lying flat with two coloured
face buttons; over-ear headphones hanging on a slim stand; a compact vintage camera
on a floating wall shelf; a plump cat curled asleep on a round rug on the floor; a
short stack of four books with coloured spines; a tall window on the back wall
showing a deep blue night skyline with one slender tower silhouette and scattered
warm window lights; an empty desk chair with coral upholstery pushed back at an
angle, as if someone just stepped away.

Lighting: warm tungsten pool from the lamp, cool moonlight wash from the window,
cyan spill from the monitor, deep indigo shadows.
Palette: deep indigo-black ground, cream highlights, coral accent, dusty blue.
Style: soft toon shading with subtle gradients and gentle ambient occlusion, matte
materials, rounded edges, no harsh outlines, clean readable shapes. Quiet, warm,
cinematic. Like a hand-crafted miniature set.

4:3 aspect ratio.
```

## 反向提示词

```
photorealistic, harsh black outlines, cel-shading with thick lines, cluttered desk,
text, letters, numbers, logos, watermark, signature, people, hands, faces, portraits,
lens flare, bloom haze, oversaturated neon, cyberpunk, messy cables
```

---

## 挑图时看这几点

1. **十个物件是否都在、且彼此不重叠**——每一个都要能单独被点击，所以不能挤成一堆。
   显示器 / 台灯 / 数位板 / 掌机 / 耳机 / 相机 / 猫 / 书堆 / 窗 / 椅子。
2. **不能出现人脸**。这是定过的：格子里是"你的场域"，人在旁边的文案里。
3. **形体越简单越好**。我要用基本体重建，圆角盒、圆柱、球。花哨的曲面我做不出来，
   或者做出来跟图对不上。
4. **光的分区要清楚**：台灯的暖光池、窗的冷光、屏幕的青光，三处能分辨。
   房间整体是暗的，亮的地方只有这三处——这样它接在深色 CRT 世界后面才不会突兀。
5. **4:3**。胶片第 05 格是 4:3，About 页是全屏；先按 4:3 定调，我来处理两种取景。

## 站内配色（供出图后比对，也供我重建时对齐）

| | |
|---|---|
| 舞台底色 | `#0a1221` |
| 纸白 / 高光 | `#f2eee8` |
| 珊瑚（强调） | `#ed654a` |
| 灰蓝 | `#294f82` |

## 补充角度（可选）

如果想多一张备选，把 `three-quarter view from slightly above` 换成
`low three-quarter view from desk height, looking slightly up at the monitor`，
其余不变——这个角度更"坐在桌前"，也可能更适合 About 全屏。
