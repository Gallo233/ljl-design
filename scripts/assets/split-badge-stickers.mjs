import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const source = process.argv[2];
const outputDirectory = process.argv[3] ?? "public/contact/stickers";

if (!source) {
  throw new Error("Usage: node scripts/assets/split-badge-stickers.mjs <sheet.png> [output-directory]");
}

const names = [
  "crying",
  "confused",
  "shocked",
  "money",
  "suspicious",
  "unimpressed",
  "blep",
  "love",
  "rocket",
];

const sourcePath = resolve(source);
const outputPath = resolve(outputDirectory);
const { data: sourcePixels, info } = await sharp(sourcePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const padding = 10;

if (channels !== 4) throw new Error("Expected an RGBA sticker sheet.");

// The artwork is arranged as a 3 × 3 grid, but its rows overlap slightly: a
// rectangular nine-cell crop clips ears in one row or pulls pixels from its neighbour.
// Label alpha-connected components first, then assign each component to the nearest
// grid centre. The output copies only the labelled pixels, so overlapping bounding
// boxes remain perfectly separated and the source alpha is preserved byte-for-byte.
const pixelCount = width * height;
const visited = new Uint8Array(pixelCount);
const labels = new Int8Array(pixelCount);
labels.fill(-1);
const queue = new Int32Array(pixelCount);
const bounds = names.map(() => ({ minX: width, minY: height, maxX: -1, maxY: -1 }));
// The exported sheet keeps a very faint antialias fringe between neighbouring
// stickers. Ignoring that sub-13%-alpha fringe prevents it from joining all nine
// opaque white outlines into one giant component.
const alphaThreshold = 32;
const minimumComponentSize = 4;

const nearestGroup = (x, y) => {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < names.length; index += 1) {
    const centreX = ((index % 3) + 0.5) * (width / 3);
    const centreY = (Math.floor(index / 3) + 0.5) * (height / 3);
    const distance = (x - centreX) ** 2 + (y - centreY) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  }
  return nearest;
};

for (let origin = 0; origin < pixelCount; origin += 1) {
  if (visited[origin] || sourcePixels[origin * channels + 3] <= alphaThreshold) continue;

  let read = 0;
  let write = 1;
  let sumX = 0;
  let sumY = 0;
  let sumRed = 0;
  let sumGreen = 0;
  let sumBlue = 0;
  let componentMinX = width;
  let componentMinY = height;
  let componentMaxX = -1;
  let componentMaxY = -1;
  queue[0] = origin;
  visited[origin] = 1;

  while (read < write) {
    const pixel = queue[read++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    sumX += x;
    sumY += y;
    sumRed += sourcePixels[pixel * channels];
    sumGreen += sourcePixels[pixel * channels + 1];
    sumBlue += sourcePixels[pixel * channels + 2];
    componentMinX = Math.min(componentMinX, x);
    componentMinY = Math.min(componentMinY, y);
    componentMaxX = Math.max(componentMaxX, x);
    componentMaxY = Math.max(componentMaxY, y);

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (!offsetX && !offsetY) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (visited[next] || sourcePixels[next * channels + 3] <= alphaThreshold) continue;
        visited[next] = 1;
        queue[write++] = next;
      }
    }
  }

  if (write < minimumComponentSize) continue;
  const componentWidth = componentMaxX - componentMinX + 1;
  const componentHeight = componentMaxY - componentMinY + 1;
  const averageLuma = (sumRed * 0.2126 + sumGreen * 0.7152 + sumBlue * 0.0722) / write;
  const isDarkRegistrationLine = averageLuma < 24
    && (componentWidth > componentHeight * 6 || componentHeight > componentWidth * 6);
  if (isDarkRegistrationLine) continue;
  const group = nearestGroup(sumX / write, sumY / write);
  const groupBounds = bounds[group];
  for (let index = 0; index < write; index += 1) {
    const pixel = queue[index];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    labels[pixel] = group;
    groupBounds.minX = Math.min(groupBounds.minX, x);
    groupBounds.minY = Math.min(groupBounds.minY, y);
    groupBounds.maxX = Math.max(groupBounds.maxX, x);
    groupBounds.maxY = Math.max(groupBounds.maxY, y);
  }
}

await mkdir(outputPath, { recursive: true });
await copyFile(sourcePath, resolve(outputPath, "source-sheet.png"));

const stickers = [];

for (let index = 0; index < names.length; index += 1) {
  const file = `${String(index + 1).padStart(2, "0")}-${names[index]}.png`;
  const targetPath = resolve(outputPath, file);
  const sourceBounds = bounds[index];
  if (sourceBounds.maxX < sourceBounds.minX || sourceBounds.maxY < sourceBounds.minY) {
    throw new Error(`No alpha component was assigned to sticker ${names[index]}.`);
  }
  const contentWidth = sourceBounds.maxX - sourceBounds.minX + 1;
  const contentHeight = sourceBounds.maxY - sourceBounds.minY + 1;
  const outputWidth = contentWidth + padding * 2;
  const outputHeight = contentHeight + padding * 2;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);

  for (let y = sourceBounds.minY; y <= sourceBounds.maxY; y += 1) {
    for (let x = sourceBounds.minX; x <= sourceBounds.maxX; x += 1) {
      const sourceIndex = y * width + x;
      if (labels[sourceIndex] !== index) continue;
      const targetX = x - sourceBounds.minX + padding;
      const targetY = y - sourceBounds.minY + padding;
      const targetIndex = (targetY * outputWidth + targetX) * 4;
      sourcePixels.copy(output, targetIndex, sourceIndex * 4, sourceIndex * 4 + 4);
    }
  }

  await sharp(output, {
    raw: { width: outputWidth, height: outputHeight, channels: 4 },
  }).png({ compressionLevel: 9 }).toFile(targetPath);
  const result = await sharp(targetPath).metadata();
  stickers.push({
    id: names[index],
    file,
    width: result.width,
    height: result.height,
    sourceBounds,
  });
}

await writeFile(
  resolve(outputPath, "manifest.json"),
  `${JSON.stringify({
    source: basename(sourcePath),
    sourceWidth: width,
    sourceHeight: height,
    padding,
    stickers,
  }, null, 2)}\n`,
);

console.log(`Prepared ${stickers.length} stickers in ${outputPath}`);
