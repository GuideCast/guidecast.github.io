import type { BoxRect, GuideStep, ScreenshotAsset } from '../types/guide';

/**
 * Subtract rectangle c from rectangle r.
 * Returns a list of disjoint rectangles whose union is r \ c.
 * Exactly corresponds to `subtract(r, c)` in build_guide.py.
 */
export function subtractRect(r: BoxRect, c: BoxRect): BoxRect[] {
  const x0 = r.x;
  const y0 = r.y;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;

  const a0 = c.x;
  const b0 = c.y;
  const a1 = c.x + c.w;
  const b1 = c.y + c.h;

  // No overlap
  if (a1 <= x0 || a0 >= x1 || b1 <= y0 || b0 >= y1) {
    return [r];
  }

  const out: BoxRect[] = [];

  // Top slice
  if (b0 > y0) {
    out.push({
      x: x0,
      y: y0,
      w: x1 - x0,
      h: b0 - y0,
    });
  }

  // Bottom slice
  if (b1 < y1) {
    out.push({
      x: x0,
      y: b1,
      w: x1 - x0,
      h: y1 - b1,
    });
  }

  const m0 = Math.max(y0, b0);
  const m1 = Math.min(y1, b1);

  // Left slice
  if (a0 > x0) {
    out.push({
      x: x0,
      y: m0,
      w: a0 - x0,
      h: m1 - m0,
    });
  }

  // Right slice
  if (a1 < x1) {
    out.push({
      x: a1,
      y: m0,
      w: x1 - a1,
      h: m1 - m0,
    });
  }

  // Filter out any zero or negative area slices
  return out.filter((rect) => rect.w > 0.001 && rect.h > 0.001);
}

/**
 * Subtract a list of cutout rectangles from a list of base rectangles.
 */
export function subtractAll(baseList: BoxRect[], cutouts: BoxRect[]): BoxRect[] {
  let current = [...baseList];
  for (const cut of cutouts) {
    const next: BoxRect[] = [];
    for (const r of current) {
      next.push(...subtractRect(r, cut));
    }
    current = next;
  }
  return current;
}

/**
 * Convert a Blob into an HTMLImageElement for canvas rendering.
 */
function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image asset for rendering.'));
    };
    img.src = url;
  });
}

/**
 * Erase areas by filling each horizontal row with the color sampled at the left edge of the box.
 * Matches `apply_mask(im, s, boxes)` from build_guide.py.
 */
function applyMaskToCanvas(
  ctx: CanvasRenderingContext2D,
  box: BoxRect,
  canvasWidth: number,
  canvasHeight: number
): void {
  const bx = Math.max(0, Math.round((box.x / 100) * canvasWidth));
  const by = Math.max(0, Math.round((box.y / 100) * canvasHeight));
  const bw = Math.min(canvasWidth - bx, Math.round((box.w / 100) * canvasWidth));
  const bh = Math.min(canvasHeight - by, Math.round((box.h / 100) * canvasHeight));

  if (bw <= 0 || bh <= 0) return;

  const imgData = ctx.getImageData(bx, by, bw, bh);
  const data = imgData.data;
  const sampleColOffset = Math.min(2, Math.max(0, bw - 1));

  for (let row = 0; row < bh; row++) {
    const sampleIdx = (row * bw + sampleColOffset) * 4;
    const r = data[sampleIdx];
    const g = data[sampleIdx + 1];
    const b = data[sampleIdx + 2];
    const a = data[sampleIdx + 3];

    for (let col = 0; col < bw; col++) {
      const idx = (row * bw + col) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(imgData, bx, by);
}

/**
 * Apply Gaussian blur to a sub-region on the canvas.
 */
function applyBlurToRegion(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  box: BoxRect,
  blurRadiusPx: number = 14
): void {
  const x = Math.max(0, Math.round((box.x / 100) * sourceCanvas.width));
  const y = Math.max(0, Math.round((box.y / 100) * sourceCanvas.height));
  const w = Math.min(sourceCanvas.width - x, Math.round((box.w / 100) * sourceCanvas.width));
  const h = Math.min(sourceCanvas.height - y, Math.round((box.h / 100) * sourceCanvas.height));

  if (w <= 0 || h <= 0) return;

  const pad = Math.ceil(blurRadiusPx * 1.5);
  const sx = Math.max(0, x - pad);
  const sy = Math.max(0, y - pad);
  const sw = Math.min(sourceCanvas.width - sx, w + pad * 2);
  const sh = Math.min(sourceCanvas.height - sy, h + pad * 2);

  const tCanvas = document.createElement('canvas');
  tCanvas.width = sw;
  tCanvas.height = sh;
  const tCtx = tCanvas.getContext('2d');
  if (!tCtx) return;

  tCtx.filter = `blur(${blurRadiusPx}px)`;
  tCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(tCanvas, 0, 0, sw, sh, sx, sy, sw, sh);
  ctx.restore();
}

/**
 * Render processed screenshot image with masks, optional blur (with step cutouts), and max-width downscaling.
 * Returns a base64 JPEG data URL.
 */
export async function renderProcessedScreenshot(
  asset: ScreenshotAsset,
  globalBlurBoxes: BoxRect[] = [],
  stepsUsingThisImage: GuideStep[] = [],
  applyBlur: boolean = true,
  maxWidth: number = 1600
): Promise<string> {
  const img = await loadImageElement(asset.blob);
  const origW = img.naturalWidth || img.width || asset.width || 1920;
  const origH = img.naturalHeight || img.height || asset.height || 1080;

  // Main canvas at original resolution
  const canvas = document.createElement('canvas');
  canvas.width = origW;
  canvas.height = origH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create 2D canvas context.');

  // 1. Draw base image
  ctx.drawImage(img, 0, 0, origW, origH);

  // 2. Apply masks (always applied in both public and private versions)
  if (asset.maskBoxes && asset.maskBoxes.length > 0) {
    for (const maskBox of asset.maskBoxes) {
      applyMaskToCanvas(ctx, maskBox, origW, origH);
    }
  }

  // 3. Apply blur if requested
  if (applyBlur) {
    // Collect all blur areas: global + asset specific
    const allBlur = [...globalBlurBoxes, ...(asset.blurBoxes || [])];
    // Step-specific areas are burned in as they are (no cutout)
    const stepBlur = stepsUsingThisImage.flatMap((step) => step.blur || []);

    if (allBlur.length > 0 || stepBlur.length > 0) {
      // Find cutout rectangles: for steps on this image where act !== 'look' and !keepBlur
      const cutouts = stepsUsingThisImage
        .filter((step) => step.act !== 'look' && !step.keepBlur)
        .map((step) => step.box);

      // Subtract active step boxes from blur regions so buttons stay legible
      const finalBlurRegions = [...subtractAll(allBlur, cutouts), ...stepBlur];

      // Burn blur into each region
      for (const blurBox of finalBlurRegions) {
        applyBlurToRegion(ctx, canvas, blurBox, 14);
      }
    }
  }

  // 4. Downscale if wider than maxWidth
  let outputCanvas = canvas;
  if (origW > maxWidth) {
    const scale = maxWidth / origW;
    const scaledH = Math.round(origH * scale);
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = maxWidth;
    scaledCanvas.height = scaledH;
    const sCtx = scaledCanvas.getContext('2d');
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(canvas, 0, 0, maxWidth, scaledH);
      outputCanvas = scaledCanvas;
    }
  }

  return outputCanvas.toDataURL('image/jpeg', 0.85);
}
