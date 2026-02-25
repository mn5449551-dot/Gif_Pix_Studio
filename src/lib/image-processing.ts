import GIF from "gif.js.optimized";
import { BG_REMOVAL_TOLERANCE, SPRITE_COLS, SPRITE_ROWS } from "@/lib/constants";

const CORNER_SAMPLE_SIZE = 4;
const WORKER_CDN =
  "https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js";

let workerBlobUrlCache: string | null = null;

export interface AnimationFrame {
  canvas: HTMLCanvasElement;
  delay: number;
}

export interface GifGenerationOptions {
  width: number;
  height: number;
  quality: number;
  workers: number;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function clampFps(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.max(4, Math.min(24, Math.round(value)));
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, encoded] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function loadImage(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const image = new Image();
    image.crossOrigin = "anonymous";
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      image.onload = null;
      image.onerror = null;
    };
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("图片加载失败"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    image.src = source;
  });
}

function sampleBackgroundColor(data: Uint8ClampedArray, width: number, height: number) {
  const corners = [
    [0, 0],
    [Math.max(width - CORNER_SAMPLE_SIZE, 0), 0],
    [0, Math.max(height - CORNER_SAMPLE_SIZE, 0)],
    [Math.max(width - CORNER_SAMPLE_SIZE, 0), Math.max(height - CORNER_SAMPLE_SIZE, 0)],
  ];

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const [startX, startY] of corners) {
    for (let y = startY; y < Math.min(startY + CORNER_SAMPLE_SIZE, height); y += 1) {
      for (let x = startX; x < Math.min(startX + CORNER_SAMPLE_SIZE, width); x += 1) {
        const index = (y * width + x) * 4;
        r += data[index];
        g += data[index + 1];
        b += data[index + 2];
        count += 1;
      }
    }
  }

  return {
    r: Math.round(r / Math.max(count, 1)),
    g: Math.round(g / Math.max(count, 1)),
    b: Math.round(b / Math.max(count, 1)),
  };
}

export function normalizeFrameIndexes(indexes: number[], frameCount: number): number[] {
  return [...new Set(indexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < frameCount)
    .sort((a, b) => a - b);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function removeBackgroundColorKey(
  imageSource: string,
  tolerance = BG_REMOVAL_TOLERANCE,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  let source = imageSource;
  let objectUrl: string | null = null;
  if (!imageSource.startsWith("data:") && !imageSource.startsWith("blob:")) {
    const response = await fetch(imageSource, { cache: "no-store", signal });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("源图地址已失效(404)，请重新生成后再试。");
      }
      throw new Error(`源图下载失败(${response.status})`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`源图类型异常(${contentType || "unknown"})`);
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    source = objectUrl;
  }

  try {
    const image = await loadImage(source, signal);
    throwIfAborted(signal);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 Canvas 上下文");

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const bgColor = sampleBackgroundColor(data, canvas.width, canvas.height);
    const weights = { r: 0.299, g: 0.587, b: 0.114 };

    for (let i = 0; i < data.length; i += 4) {
      if (i % 16384 === 0) {
        throwIfAborted(signal);
      }
      const distance = Math.sqrt(
        weights.r * Math.pow(data[i] - bgColor.r, 2) +
          weights.g * Math.pow(data[i + 1] - bgColor.g, 2) +
          weights.b * Math.pow(data[i + 2] - bgColor.b, 2),
      );
      if (distance < tolerance) {
        data[i + 3] = 0;
      }
    }

    // GIF 透明是色键机制，先把 alpha 归一化，避免边缘闪烁。
    for (let i = 3; i < data.length; i += 4) {
      if (i % 16384 === 3) {
        throwIfAborted(signal);
      }
      data[i] = data[i] >= 128 ? 255 : 0;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function extractFramesFromSpriteSheet(
  image: HTMLImageElement,
  rows = SPRITE_ROWS,
  cols = SPRITE_COLS,
): HTMLCanvasElement[] {
  const cellWidth = Math.floor(image.width / cols);
  const cellHeight = Math.floor(image.height / rows);
  const frames: HTMLCanvasElement[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const frame = document.createElement("canvas");
      frame.width = cellWidth;
      frame.height = cellHeight;
      const frameCtx = frame.getContext("2d");
      if (!frameCtx) continue;
      frameCtx.imageSmoothingEnabled = false;
      frameCtx.drawImage(
        image,
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        cellWidth,
        cellHeight,
      );
      frames.push(frame);
    }
  }

  return frames;
}

export async function extractFramesFromSpriteSource(
  spriteSource: string,
  rows = SPRITE_ROWS,
  cols = SPRITE_COLS,
): Promise<HTMLCanvasElement[]> {
  const spriteImage = await loadImage(spriteSource);
  return extractFramesFromSpriteSheet(spriteImage, rows, cols);
}

export function filterFramesByRemovedIndexes(
  frames: HTMLCanvasElement[],
  removedFrameIndexes: number[],
): HTMLCanvasElement[] {
  if (!removedFrameIndexes.length) return [...frames];
  const removedSet = new Set(
    removedFrameIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < frames.length),
  );
  return frames.filter((_, index) => !removedSet.has(index));
}

function getContentBounds(
  frame: HTMLCanvasElement,
): { x: number; y: number; width: number; height: number } | null {
  const ctx = frame.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
  const { data } = imageData;

  let minX = frame.width;
  let minY = frame.height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const i = (y * frame.width + x) * 4;
      if (data[i + 3] > 0) {
        hasContent = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!hasContent) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function estimateTorsoAnchor(
  frame: HTMLCanvasElement,
  bounds: { x: number; y: number; width: number; height: number } | null,
): { x: number; y: number } {
  const fallback = { x: frame.width / 2, y: frame.height / 2 };
  if (!bounds) return fallback;
  const ctx = frame.getContext("2d");
  if (!ctx) return fallback;

  const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
  const { data } = imageData;
  const minX = bounds.x;
  const maxX = bounds.x + bounds.width - 1;
  const torsoTop = bounds.y + Math.floor(bounds.height * 0.2);
  const torsoBottom = bounds.y + Math.floor(bounds.height * 0.75);

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = torsoTop; y <= torsoBottom; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = (y * frame.width + x) * 4;
      if (data[i + 3] > 0) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }

  if (count < 12) {
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }
  return {
    x: sumX / count,
    y: sumY / count,
  };
}

function smoothCircularTrack(values: number[]): number[] {
  const n = values.length;
  if (n <= 2) return [...values];
  const weights = [1, 2, 1];
  const totalWeight = 4;
  const smoothed = new Array<number>(n);

  for (let i = 0; i < n; i += 1) {
    const left = values[(i - 1 + n) % n];
    const center = values[i];
    const right = values[(i + 1) % n];
    smoothed[i] = (left * weights[0] + center * weights[1] + right * weights[2]) / totalWeight;
  }
  return smoothed;
}

export function alignFrames(frames: HTMLCanvasElement[]): HTMLCanvasElement[] {
  if (!frames.length) return frames;

  const bounds = frames.map((frame) => getContentBounds(frame));
  const anchors = frames.map((frame, index) => estimateTorsoAnchor(frame, bounds[index]));
  const rawX = anchors.map((anchor) => anchor.x);
  const rawY = anchors.map((anchor) => anchor.y);
  const smoothX = smoothCircularTrack(rawX);
  const smoothY = smoothCircularTrack(rawY);

  const dx = smoothX.map((value, index) => Math.round(value - rawX[index]));
  const dy = smoothY.map((value, index) => Math.round(value - rawY[index]));

  const minDx = Math.min(...dx);
  const maxDx = Math.max(...dx);
  const minDy = Math.min(...dy);
  const maxDy = Math.max(...dy);

  const baseWidth = Math.max(...frames.map((frame) => frame.width));
  const baseHeight = Math.max(...frames.map((frame) => frame.height));
  const outputWidth = Math.max(1, baseWidth + (maxDx - minDx));
  const outputHeight = Math.max(1, baseHeight + (maxDy - minDy));

  return frames.map((frame, index) => {
    const aligned = document.createElement("canvas");
    aligned.width = outputWidth;
    aligned.height = outputHeight;
    const ctx = aligned.getContext("2d");
    if (!ctx) return frame;
    ctx.imageSmoothingEnabled = false;
    const offsetX = dx[index] - minDx;
    const offsetY = dy[index] - minDy;
    ctx.drawImage(frame, offsetX, offsetY);
    return aligned;
  });
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas 导出失败"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function prepareFrameForGif(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const processed = document.createElement("canvas");
  processed.width = canvas.width;
  processed.height = canvas.height;
  const ctx = processed.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, processed.width, processed.height);
  const { data } = imageData;

  // Use magenta (255, 0, 255) for transparency - this is the standard GIF transparent color
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return processed;
}

async function createWorkerBlobUrl(): Promise<string> {
  if (workerBlobUrlCache) return workerBlobUrlCache;
  const response = await fetch(WORKER_CDN);
  if (!response.ok) throw new Error("GIF Worker 脚本加载失败");
  const script = await response.text();
  workerBlobUrlCache = URL.createObjectURL(
    new Blob([script], { type: "application/javascript" }),
  );
  return workerBlobUrlCache;
}

export async function generateGif(
  frames: AnimationFrame[],
  options: GifGenerationOptions,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!frames.length) throw new Error("无可编码帧");
  throwIfAborted(signal);

  const workerScript = await createWorkerBlobUrl();
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    let aborted = false;
    const gif = new GIF({
      workers: options.workers,
      quality: options.quality,
      width: options.width,
      height: options.height,
      workerScript,
      transparent: 0xff00ff,
    });

    frames.forEach((frame) => {
      const prepared = prepareFrameForGif(frame.canvas);
      gif.addFrame(prepared, { delay: frame.delay });
    });

    const onAbort = () => {
      if (aborted) return;
      aborted = true;
      cleanupAbort();
      try {
        const abortableGif = gif as GIF & { abort?: () => void };
        abortableGif.abort?.();
      } finally {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      }
    };

    const cleanupAbort = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    if (onProgress) {
      gif.on("progress", (progress) => onProgress(progress));
    }
    gif.on("finished", (blob) => {
      if (aborted) return;
      cleanupAbort();
      resolve(blob);
    });
    gif.on("error", (error) => {
      if (aborted) return;
      cleanupAbort();
      reject(error);
    });
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }

    gif.render();
  });
}

export async function buildTransparentGifFromSpriteSource(params: {
  spriteSource: string;
  fps: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const spriteImage = await loadImage(params.spriteSource, params.signal);
  const frames = alignFrames(extractFramesFromSpriteSheet(spriteImage, SPRITE_ROWS, SPRITE_COLS));
  if (!frames.length) {
    throw new Error("无法从精灵图提取帧");
  }

  const frameDelay = Math.max(20, Math.round(1000 / clampFps(params.fps)));
  return generateGif(
    frames.map((canvas) => ({ canvas, delay: frameDelay })),
    {
      width: frames[0].width,
      height: frames[0].height,
      quality: 10,
      workers: 2,
    },
    params.onProgress,
    params.signal,
  );
}

export async function buildTransparentGifFromFrames(params: {
  frames: HTMLCanvasElement[];
  fps: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const filteredFrames = params.frames.filter(Boolean);
  if (!filteredFrames.length) {
    throw new Error("无可编码帧");
  }
  const alignedFrames = alignFrames(filteredFrames);
  const frameDelay = Math.max(20, Math.round(1000 / clampFps(params.fps)));
  return generateGif(
    alignedFrames.map((canvas) => ({ canvas, delay: frameDelay })),
    {
      width: alignedFrames[0].width,
      height: alignedFrames[0].height,
      quality: 10,
      workers: 2,
    },
    params.onProgress,
    params.signal,
  );
}

function normalizeTargetSize(value: number): number {
  if (!Number.isFinite(value)) throw new Error("导出尺寸无效");
  return Math.max(32, Math.round(value));
}

export function scaleFrames(frames: HTMLCanvasElement[], targetSize: number): HTMLCanvasElement[] {
  const size = normalizeTargetSize(targetSize);
  return frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return frame;
    ctx.imageSmoothingEnabled = false;

    const scale = Math.min(size / frame.width, size / frame.height);
    const drawWidth = Math.max(1, Math.round(frame.width * scale));
    const drawHeight = Math.max(1, Math.round(frame.height * scale));
    const offsetX = Math.floor((size - drawWidth) / 2);
    const offsetY = Math.floor((size - drawHeight) / 2);

    ctx.drawImage(frame, 0, 0, frame.width, frame.height, offsetX, offsetY, drawWidth, drawHeight);
    return canvas;
  });
}

export async function buildTransparentGifFromFramesWithSize(params: {
  frames: HTMLCanvasElement[];
  fps: number;
  targetSize: "original" | number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<Blob> {
  const filteredFrames = params.frames.filter(Boolean);
  if (!filteredFrames.length) {
    throw new Error("无可编码帧");
  }

  const alignedFrames = alignFrames(filteredFrames);
  const outputFrames =
    params.targetSize === "original" ? alignedFrames : scaleFrames(alignedFrames, params.targetSize);
  const frameDelay = Math.max(20, Math.round(1000 / clampFps(params.fps)));

  return generateGif(
    outputFrames.map((canvas) => ({ canvas, delay: frameDelay })),
    {
      width: outputFrames[0].width,
      height: outputFrames[0].height,
      quality: 10,
      workers: 2,
    },
    params.onProgress,
    params.signal,
  );
}
