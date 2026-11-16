import type { BoxRect, GuideStep } from '../types/guide';
import { addScreenshot, generateId } from '../db/database';
import { computeDefaultCursorPos } from '../components/common/InteractiveBoxEditor';

/** Images wider than this are scaled down before saving (keeps exports small). */
export const MAX_IMPORT_WIDTH = 2560;

export type SortMode = 'name' | 'date';

/** Keep only image files, drop everything else (folders, documents). */
export function onlyImages(files: Iterable<File>): File[] {
  return Array.from(files).filter(
    (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)
  );
}

/** Natural sort by file name (shot2 before shot10) or by file modification time. */
export function sortImageFiles(files: File[], mode: SortMode): File[] {
  const copy = [...files];
  if (mode === 'date') {
    return copy.sort(
      (a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }
  return copy.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/** Scale a very large image down through a canvas. Smaller images are returned untouched. */
export async function downscaleIfHuge(file: File, maxWidth = MAX_IMPORT_WIDTH): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    if (bitmap.width <= maxWidth) return file;
    const scale = maxWidth / bitmap.width;
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    return blob || file;
  } finally {
    bitmap.close();
  }
}

/** Save the images (shrunk if huge) and build one default step per image, in the given order. */
export async function buildStepsFromFiles(
  projectId: string,
  files: File[]
): Promise<GuideStep[]> {
  const steps: GuideStep[] = [];
  for (const file of files) {
    const blob = await downscaleIfHuge(file);
    const asset = await addScreenshot(projectId, blob, file.name);
    const box: BoxRect = { x: 30, y: 30, w: 20, h: 10 };
    const en = 'Click on the highlighted element';
    const ru = 'Нажмите на выделенный элемент';
    steps.push({
      id: generateId(),
      screenshotId: asset.id,
      act: 'click',
      box,
      cursorPos: computeDefaultCursorPos(box),
      en,
      ru,
    });
  }
  return steps;
}
