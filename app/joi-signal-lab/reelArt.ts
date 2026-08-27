import { projects, reelPosterSources } from "./reelProjects";

/**
 * The reel's drawn frames.
 *
 * Four of the six frames have no footage behind them, so their art is drawn here into the
 * atlas the film samples rather than shipped as images — the palettes are the project's
 * own, and drawing them keeps the reel one texture instead of six more requests.
 */

export const ATLAS_FRAME_WIDTH = 1024;
export const ATLAS_FRAME_HEIGHT = 768;

export function drawGrid(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (let line = 0; line <= 12; line += 1) {
    const px = x + (width / 12) * line;
    context.beginPath();
    context.moveTo(px, y);
    context.lineTo(px, y + height);
    context.stroke();
  }
  for (let line = 0; line <= 8; line += 1) {
    const py = y + (height / 8) * line;
    context.beginPath();
    context.moveTo(x, py);
    context.lineTo(x + width, py);
    context.stroke();
  }
}

export function drawProjectArt(context: CanvasRenderingContext2D, projectIndex: number, x: number, y: number, width: number, height: number) {
  const project = projects[projectIndex];
  const [background, ink, accent] = project.palette;
  context.fillStyle = background;
  context.fillRect(x, y, width, height);
  drawGrid(context, x, y, width, height, `${ink}18`);

  context.fillStyle = ink;
  context.font = "600 13px ui-monospace, SFMono-Regular, monospace";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText(`JOI SYSTEM / ${project.index}`, x + 28, y + 24);
  context.textAlign = "right";
  context.fillText("GALLO  ·  2026", x + width - 28, y + 24);

  if (projectIndex === 0) {
    const cx = x + width * 0.59;
    const cy = y + height * 0.51;
    context.strokeStyle = accent;
    context.lineWidth = 2;
    for (let ring = 1; ring <= 5; ring += 1) {
      context.beginPath();
      context.ellipse(cx, cy, ring * 35, ring * 23, -0.25, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = ink;
    context.font = "400 180px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("J", cx, cy + 4);
    context.fillStyle = accent;
    context.beginPath();
    context.arc(cx + 128, cy - 88, 7, 0, Math.PI * 2);
    context.fill();
  } else if (projectIndex === 1) {
    context.strokeStyle = ink;
    context.lineWidth = 2;
    for (let route = 0; route < 5; route += 1) {
      context.beginPath();
      for (let point = 0; point < 7; point += 1) {
        const px = x + width * (0.12 + point * 0.13);
        const py = y + height * (0.27 + ((point * 37 + route * 19) % 45) / 100);
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.globalAlpha = 0.18 + route * 0.08;
      context.stroke();
    }
    context.globalAlpha = 1;
    const pinX = x + width * 0.58;
    const pinY = y + height * 0.42;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(pinX, pinY, 34, Math.PI, 0);
    context.lineTo(pinX, pinY + 72);
    context.closePath();
    context.fill();
    context.fillStyle = background;
    context.font = "400 34px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("J", pinX, pinY + 2);
  } else if (projectIndex === 2) {
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const px = x + width * 0.17 + column * 58;
        const py = y + height * 0.24 + row * 58;
        context.fillStyle = (row + column) % 4 === 0 ? accent : `${ink}${40 + ((row * 8 + column) % 4) * 20}`;
        context.beginPath();
        context.arc(px, py, 8 + ((row + column) % 3) * 3, 0, Math.PI * 2);
        context.fill();
        if (column < 7) {
          context.strokeStyle = `${ink}42`;
          context.beginPath();
          context.moveTo(px + 12, py);
          context.lineTo(px + 46, py + ((column % 2) * 18 - 9));
          context.stroke();
        }
      }
    }
  } else if (projectIndex === 3) {
    // 04 · THE LAB — a manila folder with the real experiment index on its face.
    const fx = x + width * 0.14;
    const fy = y + height * 0.2;
    const fw = width * 0.72;
    const fh = height * 0.62;
    context.fillStyle = `${ink}14`;
    context.fillRect(fx + 14, fy + 18, fw, fh);
    context.fillStyle = `${ink}e8`;
    context.beginPath();
    context.moveTo(fx, fy + 26);
    context.lineTo(fx, fy);
    context.lineTo(fx + fw * 0.34, fy);
    context.lineTo(fx + fw * 0.4, fy + 26);
    context.lineTo(fx + fw, fy + 26);
    context.lineTo(fx + fw, fy + fh);
    context.lineTo(fx, fy + fh);
    context.closePath();
    context.fill();
    context.fillStyle = background;
    context.font = "600 15px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText("LAB / 实验室", fx + 18, fy + 5);
    const entries = [
      "A-01  CRT / SHADER RESEARCH",
      "A-02  LIVE2D BINDING · 3D CHECK",
      "A-03  PARTICLE PROLOGUE / QTE",
      "A-04  LEITOWER POSTMORTEM",
    ];
    context.font = "500 21px ui-monospace, monospace";
    entries.forEach((entry, line) => {
      context.fillStyle = line === 0 ? accent : `${background}c8`;
      context.fillText(entry, fx + 34, fy + 74 + line * 46);
      context.strokeStyle = `${background}2e`;
      context.beginPath();
      context.moveTo(fx + 30, fy + 104 + line * 46);
      context.lineTo(fx + fw - 34, fy + 104 + line * 46);
      context.stroke();
    });
    // Barcode strip: the folder is a filed object, not a poster.
    let barX = fx + fw - 176;
    while (barX < fx + fw - 40) {
      const bar = 2 + ((barX * 7) % 5);
      context.fillStyle = `${background}d8`;
      context.fillRect(barX, fy + fh - 40, bar, 24);
      barX += bar + 3;
    }
  } else if (projectIndex === 4) {
    // 05 · MY ROOM — line-sketch of the desk until the live 3D room replaces this frame.
    const deskY = y + height * 0.68;
    context.strokeStyle = `${ink}b8`;
    context.lineWidth = 2.5;
    // desk
    context.strokeRect(x + width * 0.16, deskY, width * 0.68, height * 0.05);
    context.beginPath();
    context.moveTo(x + width * 0.2, deskY + height * 0.05);
    context.lineTo(x + width * 0.2, deskY + height * 0.2);
    context.moveTo(x + width * 0.78, deskY + height * 0.05);
    context.lineTo(x + width * 0.78, deskY + height * 0.2);
    context.stroke();
    // monitor
    context.strokeRect(x + width * 0.3, deskY - height * 0.3, width * 0.26, height * 0.24);
    context.beginPath();
    context.moveTo(x + width * 0.43, deskY - height * 0.06);
    context.lineTo(x + width * 0.43, deskY);
    context.stroke();
    // lamp
    context.beginPath();
    context.moveTo(x + width * 0.68, deskY);
    context.lineTo(x + width * 0.72, deskY - height * 0.18);
    context.arc(x + width * 0.7, deskY - height * 0.21, width * 0.035, Math.PI * 0.9, Math.PI * 1.9);
    context.stroke();
    context.fillStyle = `${accent}30`;
    context.beginPath();
    context.moveTo(x + width * 0.685, deskY - height * 0.185);
    context.lineTo(x + width * 0.6, deskY);
    context.lineTo(x + width * 0.77, deskY);
    context.closePath();
    context.fill();
    // cat silhouette on the desk
    context.fillStyle = `${ink}c8`;
    context.beginPath();
    context.ellipse(x + width * 0.63, deskY - 12, 26, 14, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + width * 0.655, deskY - 24, 10, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x + width * 0.649, deskY - 32);
    context.lineTo(x + width * 0.653, deskY - 40);
    context.lineTo(x + width * 0.658, deskY - 32);
    context.moveTo(x + width * 0.66, deskY - 32);
    context.lineTo(x + width * 0.665, deskY - 40);
    context.lineTo(x + width * 0.67, deskY - 31);
    context.fill();
    context.fillStyle = accent;
    context.font = "400 64px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("我的房间", x + width / 2, y + height * 0.24);
  } else {
    // 06 · CONTACT — a clapperboard: the reel needs an ending, and the ending is a call sheet.
    const bx = x + width * 0.16;
    const by = y + height * 0.2;
    const bw = width * 0.68;
    const bh = height * 0.56;
    // clap bar
    const stripeH = 34;
    context.save();
    context.beginPath();
    context.rect(bx, by, bw, stripeH);
    context.clip();
    for (let stripe = -1; stripe < 14; stripe += 1) {
      context.fillStyle = stripe % 2 === 0 ? ink : background;
      context.beginPath();
      context.moveTo(bx + stripe * 52, by + stripeH);
      context.lineTo(bx + stripe * 52 + 26, by);
      context.lineTo(bx + stripe * 52 + 78, by);
      context.lineTo(bx + stripe * 52 + 52, by + stripeH);
      context.closePath();
      context.fill();
    }
    context.restore();
    // slate
    context.fillStyle = ink;
    context.fillRect(bx, by + stripeH + 6, bw, bh - stripeH - 6);
    context.fillStyle = background;
    context.font = "500 19px ui-monospace, monospace";
    context.textAlign = "left";
    context.textBaseline = "top";
    const slate = [
      "SCENE: CONTACT          TAKE: 06",
      "DIR: GALLO LIU          GUANGZHOU",
      "",
      "18520455682@163.com",
      "GITHUB.COM/GALLO233",
      "RESUME / PDF",
    ];
    slate.forEach((line, index) => {
      context.fillStyle = index === 3 ? accent : `${background}${index < 2 ? "d8" : "b8"}`;
      context.fillText(line, bx + 30, by + stripeH + 34 + index * 38);
    });
  }

  context.globalAlpha = 1;
  context.fillStyle = ink;
  context.font = "500 12px ui-monospace, monospace";
  context.textAlign = "left";
  context.textBaseline = "bottom";
  context.fillText(project.title.toUpperCase(), x + 28, y + height - 25);
  context.textAlign = "right";
  context.fillText(project.subtitle.toUpperCase(), x + width - 28, y + height - 25);
}

export function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export function buildAtlas(posters: Array<HTMLImageElement | null>) {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_FRAME_WIDTH * projects.length;
  canvas.height = ATLAS_FRAME_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  projects.forEach((_, index) => {
    drawProjectArt(
      context,
      index,
      index * ATLAS_FRAME_WIDTH,
      0,
      ATLAS_FRAME_WIDTH,
      ATLAS_FRAME_HEIGHT,
    );
    const poster = posters.find((image, posterIndex) => reelPosterSources[posterIndex]?.projectIndex === index && image?.complete);
    if (poster) {
      drawCoverImage(context, poster, index * ATLAS_FRAME_WIDTH, 0, ATLAS_FRAME_WIDTH, ATLAS_FRAME_HEIGHT);
    }
  });
  return canvas;
}
