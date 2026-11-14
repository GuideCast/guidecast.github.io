import type {
  ActionType,
  BoxRect,
  GuideProject,
  GuideStep,
  LegacyStep,
  LegacyStepsJson,
  ScreenshotAsset,
  StandaloneMeta,
  StandaloneStep,
} from '../types/guide';
import {
  addScreenshot,
  db,
  generateId,
  getImageDimensions,
} from '../db/database';
import { renderProcessedScreenshot } from './canvasRenderer';

/**
 * Make JSON safe to embed inside a <script> element: '<' can never form '</script' or '<!--'.
 */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

const SOURCE_FORMAT = 'guide-creation-tool/project';

/**
 * Computes default cursor position slightly inside the bottom-right corner of the target box.
 */
function computeDefaultCursorPos(box: BoxRect): { x: number; y: number } {
  return {
    x: Math.min(100, Math.max(0, Math.round((box.x + box.w * 0.96) * 10) / 10)),
    y: Math.min(100, Math.max(0, Math.round((box.y + box.h * 0.92) * 10) / 10)),
  };
}

/**
 * Convert data:image/...;base64,... into a native binary Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return new Blob([dataUrl], { type: 'image/png' });
  }
  const header = dataUrl.slice(0, commaIdx);
  const base64Data = dataUrl.slice(commaIdx + 1).trim().replace(/\s/g, '');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  const binaryStr = atob(base64Data);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Create a simple placeholder fallback image blob when a screenshot is missing.
 */
function createPlaceholderBlob(label: string): Blob {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1600, 900);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`Screenshot: ${label}`, 80, 200);
  }
  return dataUrlToBlob(canvas.toDataURL('image/png'));
}

/**
 * Safely extracts a JS object or array assigned to a variable in HTML/JS source.
 * Handles const/let/var/window.VAR = ..., /* comments *\/, string literals, and nested brackets.
 */
function extractJsStructure(html: string, varName: string): any {
  const regex = new RegExp(
    `(?:(?:const|let|var|window\\.)\\s+${varName}\\s*=\\s*(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*)([\\{\\[])`
  );
  const match = regex.exec(html);
  if (!match) return null;

  const startChar = match[1];
  const endChar = startChar === '[' ? ']' : '}';
  const startIndex = match.index + match[0].length - 1;

  let depth = 0;
  let inString: string | null = null;
  let escape = false;

  for (let i = startIndex; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }

    // Ignore single-line comments // ...
    if (char === '/' && html[i + 1] === '/') {
      const nextNl = html.indexOf('\n', i + 2);
      i = nextNl === -1 ? html.length : nextNl;
      continue;
    }

    // Ignore multi-line comments /* ... */
    if (char === '/' && html[i + 1] === '*') {
      const nextEnd = html.indexOf('*/', i + 2);
      i = nextEnd === -1 ? html.length : nextEnd + 1;
      continue;
    }

    if (char === startChar) {
      depth++;
    } else if (char === endChar) {
      depth--;
      if (depth === 0) {
        const jsonStr = html.slice(startIndex, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          // Fallback to evaluating JS literal safely
          return new Function(`"use strict"; return (${jsonStr});`)();
        }
      }
    }
  }

  return null;
}

/**
 * Convert legacy pixel coordinates [x0, y0, x1, y1] (based on dw) into percentages BoxRect.
 */
function legacyBoxToPercent(
  box: [number, number, number, number],
  dw: number,
  origW: number,
  origH: number
): BoxRect {
  const dh = (origH * dw) / origW;
  const [x0, y0, x1, y1] = box;
  const x = (x0 / dw) * 100;
  const y = (y0 / dh) * 100;
  const w = ((x1 - x0) / dw) * 100;
  const h = ((y1 - y0) / dh) * 100;

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    w: Math.max(0.1, Math.min(100, w)),
    h: Math.max(0.1, Math.min(100, h)),
  };
}

/**
 * Convert percent BoxRect into legacy [x0, y0, x1, y1] pixels relative to display_width (dw).
 */
function percentToLegacyBox(
  box: BoxRect,
  dw: number,
  origW: number,
  origH: number
): [number, number, number, number] {
  const dh = (origH * dw) / origW;
  const x0 = Math.round((box.x / 100) * dw);
  const y0 = Math.round((box.y / 100) * dh);
  const x1 = Math.round(((box.x + box.w) / 100) * dw);
  const y1 = Math.round(((box.y + box.h) / 100) * dh);
  return [x0, y0, x1, y1];
}

/**
 * Import a folder of files containing steps.json and screenshot images (.png, .jpg).
 */
export async function importFromLegacyFolder(fileList: FileList | File[]): Promise<GuideProject> {
  const files = Array.from(fileList);
  const jsonCandidates = files.filter((f) => f.name.toLowerCase().endsWith('.json'));
  // Prefer a file named exactly steps.json, then any other .json that parses and has a steps array
  jsonCandidates.sort((a, b) => {
    const an = a.name.toLowerCase() === 'steps.json' ? 0 : 1;
    const bn = b.name.toLowerCase() === 'steps.json' ? 0 : 1;
    return an - bn;
  });

  if (jsonCandidates.length === 0) {
    throw new Error('steps.json was not found in the selected folder/files.');
  }

  let parsed: LegacyStepsJson | null = null;
  let sawInvalidSteps = false;
  for (const cand of jsonCandidates) {
    try {
      const obj = JSON.parse(await cand.text());
      if (obj && Array.isArray(obj.steps)) {
        parsed = obj as LegacyStepsJson;
        break;
      }
      sawInvalidSteps = true;
    } catch {
      sawInvalidSteps = true;
    }
  }
  if (!parsed) {
    throw new Error(
      sawInvalidSteps
        ? 'No valid steps.json found: no .json file with a "steps" array that parses correctly.'
        : 'steps.json was not found in the selected folder/files.'
    );
  }

  const dw = parsed.display_width || 2000;
  const projectId = generateId();

  // Find all image files
  const imageFiles = files.filter((f) =>
    /\.(png|jpe?g|webp|bmp)$/i.test(f.name)
  );

  const imageMap = new Map<string, File>();
  for (const imgFile of imageFiles) {
    imageMap.set(imgFile.name.toLowerCase(), imgFile);
  }

  // Pre-load and save screenshots into IndexedDB
  const assetMap = new Map<string, ScreenshotAsset>();

  // Collect unique image names from steps, blur and mask
  const referencedImages = new Set<string>();
  if (parsed.steps) {
    parsed.steps.forEach((s) => s.img && referencedImages.add(s.img));
  }
  if (parsed.blur) {
    Object.keys(parsed.blur).forEach((k) => referencedImages.add(k));
  }
  if (parsed.mask) {
    Object.keys(parsed.mask).forEach((k) => referencedImages.add(k));
  }

  for (const imgName of referencedImages) {
    const matchedFile = imageMap.get(imgName.toLowerCase());
    let blob: Blob;
    let origW = 1920;
    let origH = 1080;

    if (matchedFile) {
      blob = matchedFile;
      const dims = await getImageDimensions(blob);
      origW = dims.width;
      origH = dims.height;
    } else {
      // Create a fallback placeholder canvas blob if screenshot is missing
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = 1920;
      fallbackCanvas.height = 1080;
      const ctx = fallbackCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`Missing screenshot: ${imgName}`, 100, 200);
      }
      blob = await new Promise<Blob>((res) =>
        fallbackCanvas.toBlob((b) => res(b || new Blob()), 'image/png')
      );
    }

    // Convert legacy blur boxes
    const rawBlur = parsed.blur?.[imgName] || [];
    const blurBoxes: BoxRect[] = rawBlur.map((b) => legacyBoxToPercent(b, dw, origW, origH));

    // Convert legacy mask boxes
    const rawMask = parsed.mask?.[imgName] || [];
    const maskBoxes: BoxRect[] = rawMask.map((b) => legacyBoxToPercent(b, dw, origW, origH));

    const asset = await addScreenshot(projectId, blob, imgName, blurBoxes, maskBoxes);
    assetMap.set(imgName.toLowerCase(), asset);
  }

  // Global blur: converted using the first referenced image's dimensions (fallback 1920x1080)
  let globalBlurBoxes: BoxRect[] = [];
  if (Array.isArray(parsed.global_blur) && parsed.global_blur.length > 0) {
    const firstAsset = referencedImages.size > 0 ? assetMap.get([...referencedImages][0].toLowerCase()) : undefined;
    const gw = firstAsset?.width || 1920;
    const gh = firstAsset?.height || 1080;
    globalBlurBoxes = parsed.global_blur
      .filter((b) => Array.isArray(b) && b.length >= 4)
      .map((b) => legacyBoxToPercent(b, dw, gw, gh));
  }

  // Convert legacy steps
  const steps: GuideStep[] = [];
  if (Array.isArray(parsed.steps)) {
    for (const st of parsed.steps) {
      const asset = assetMap.get(st.img.toLowerCase());
      const origW = asset?.width || 1920;
      const origH = asset?.height || 1080;
      const box = legacyBoxToPercent(st.box, dw, origW, origH);

      steps.push({
        id: generateId(),
        screenshotId: asset?.id || '',
        act: st.act || 'click',
        box,
        chapterTitle: st.chapter || st.chapter_title,
        en: st.en || '',
        ru: st.ru || st.en || '',
        voiceDraft: st.voice_draft,
        keepBlur: st.keep_blur,
        cursorPos: st.cursor_pos
          ? { x: (st.cursor_pos[0] / dw) * 100, y: (st.cursor_pos[1] / ((origH * dw) / origW)) * 100 }
          : undefined,
      });
    }
  }

  const project: GuideProject = {
    id: projectId,
    pageTitle: parsed.page_title || 'Imported Step Guide',
    titleEn: parsed.title_en || 'Interactive Guide',
    titleRu: parsed.title_ru || parsed.titleRu || 'Интерактивное руководство',
    subEn: parsed.sub_en || 'Step-by-step instructions',
    subRu: parsed.sub_ru || 'Пошаговые инструкции',
    defaultLang: parsed.default_lang || 'en',
    globalBlurBoxes,
    steps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.projects.add(project);
  return project;
}

/**
 * Export project to legacy steps.json format (compatible with build_guide.py).
 */
export function exportToLegacyJson(
  project: GuideProject,
  screenshots: ScreenshotAsset[]
): LegacyStepsJson {
  const dw = 2000;
  const assetById = new Map<string, ScreenshotAsset>();
  for (const a of screenshots) {
    assetById.set(a.id, a);
  }

  const legacySteps: LegacyStep[] = project.steps.map((st) => {
    const asset = assetById.get(st.screenshotId);
    const origW = asset?.width || 1920;
    const origH = asset?.height || 1080;
    const box = percentToLegacyBox(st.box, dw, origW, origH);

    const textEn = st.en || st.ru || '';
    const textRu = st.ru || st.en || '';

    const legacy: LegacyStep = {
      img: asset?.filename || '1.png',
      act: st.act,
      box,
      en: textEn,
      ru: textRu,
    };

    if (st.chapterTitle) legacy.chapter = st.chapterTitle;
    if (st.voiceDraft) legacy.voice_draft = st.voiceDraft;
    if (st.keepBlur) legacy.keep_blur = true;
    if (st.cursorPos) {
      const dh = (origH * dw) / origW;
      legacy.cursor_pos = [
        Math.round((st.cursorPos.x / 100) * dw),
        Math.round((st.cursorPos.y / 100) * dh),
      ];
    }
    return legacy;
  });

  const blur: Record<string, [number, number, number, number][]> = {};
  const mask: Record<string, [number, number, number, number][]> = {};

  for (const a of screenshots) {
    if (a.blurBoxes && a.blurBoxes.length > 0) {
      blur[a.filename] = a.blurBoxes.map((b) => percentToLegacyBox(b, dw, a.width, a.height));
    }
    if (a.maskBoxes && a.maskBoxes.length > 0) {
      mask[a.filename] = a.maskBoxes.map((b) => percentToLegacyBox(b, dw, a.width, a.height));
    }
  }

  const firstUsed = project.steps.map((st) => assetById.get(st.screenshotId)).find(Boolean) || screenshots[0];
  const gw = firstUsed?.width || 1920;
  const gh = firstUsed?.height || 1080;
  const globalBlur = (project.globalBlurBoxes || []).map((b) => percentToLegacyBox(b, dw, gw, gh));

  return {
    page_title: project.pageTitle,
    title_en: project.titleEn,
    title_ru: project.titleRu,
    sub_en: project.subEn,
    sub_ru: project.subRu,
    default_lang: project.defaultLang,
    display_width: dw,
    steps: legacySteps,
    blur: Object.keys(blur).length > 0 ? blur : undefined,
    mask: Object.keys(mask).length > 0 ? mask : undefined,
    global_blur: globalBlur.length > 0 ? globalBlur : undefined,
  };
}

/**
 * Export standalone, single-file HTML player compatible with template.html,
 * with embedded base64 images, chapters table of contents, and interactive training mode.
 */
export async function exportStandaloneHtml(
  project: GuideProject,
  screenshots: ScreenshotAsset[],
  options: {
    publicBlur: boolean;
    interactiveMode?: boolean;
    /** Embed the full editable project (original screenshots, blur/mask boxes). Ignored when publicBlur is true. */
    embedSource?: boolean;
    fromStep?: number;
    toStep?: number;
  } = { publicBlur: true }
): Promise<string> {
  const assetMap = new Map<string, ScreenshotAsset>();
  for (const a of screenshots) {
    assetMap.set(a.id, a);
  }

  // Determine active slice of steps if fromStep / toStep are given
  let activeSteps = project.steps;
  const isSliced = options.fromStep !== undefined || options.toStep !== undefined;
  if (isSliced && project.steps.length > 0) {
    const minStep = Math.min(options.fromStep || 1, options.toStep || project.steps.length);
    const maxStep = Math.max(options.fromStep || 1, options.toStep || project.steps.length);
    const fromIdx = Math.max(0, Math.min(project.steps.length - 1, minStep - 1));
    const toIdx = Math.max(fromIdx, Math.min(project.steps.length - 1, maxStep - 1));
    activeSteps = project.steps.slice(fromIdx, toIdx + 1);
  }

  // Render screenshots to base64 images dict without duplication
  const images: Record<string, string> = {};

  for (const asset of screenshots) {
    // Only render if referenced by at least one step in activeSteps
    const stepsUsingThis = activeSteps.filter((s) => s.screenshotId === asset.id);
    if (stepsUsingThis.length > 0) {
      const base64 = await renderProcessedScreenshot(
        asset,
        project.globalBlurBoxes,
        stepsUsingThis,
        options.publicBlur,
        1600
      );
      images[asset.filename] = base64;
    }
  }

  // Prepare steps
  const steps: StandaloneStep[] = activeSteps.map((st) => {
    const asset = assetMap.get(st.screenshotId);
    const textEn = st.en || st.ru || '';
    const textRu = st.ru || st.en || '';

    return {
      img: asset ? asset.filename : '1.png',
      act: st.act,
      box: [
        Number(st.box.x.toFixed(2)),
        Number(st.box.y.toFixed(2)),
        Number(st.box.w.toFixed(2)),
        Number(st.box.h.toFixed(2)),
      ],
      en: textEn,
      ru: textRu,
      chapterTitle: st.chapterTitle,
      cursorPos: st.cursorPos
        ? [Number(st.cursorPos.x.toFixed(2)), Number(st.cursorPos.y.toFixed(2))]
        : undefined,
    };
  });

  const isSingleLang = steps.length > 0 && steps.every((s) => s.en === s.ru);

  const sliceSuffixEn = isSliced ? ` (Steps ${options.fromStep || 1}–${options.toStep || project.steps.length})` : '';
  const sliceSuffixRu = isSliced ? ` (Шаги ${options.fromStep || 1}–${options.toStep || project.steps.length})` : '';

  const titleEn = (project.titleEn || project.titleRu || project.pageTitle || 'Interactive Guide') + sliceSuffixEn;
  const titleRu = (project.titleRu || project.titleEn || project.pageTitle || 'Интерактивное руководство') + sliceSuffixRu;
  const subEn = project.subEn || project.subRu || 'Step-by-step instructions';
  const subRu = project.subRu || project.subEn || 'Пошаговые инструкции';

  const meta: StandaloneMeta = {
    title_en: titleEn,
    title_ru: titleRu,
    sub_en: subEn,
    sub_ru: subRu,
    default_lang: project.defaultLang,
  };

  const stepsJson = safeJsonForScript(steps);
  const imagesJson = safeJsonForScript(images);
  const metaJson = safeJsonForScript(meta);
  const pageTitle = escapeHtml(((project.defaultLang === 'ru' ? titleRu : titleEn) || project.pageTitle || 'Interactive Step Guide') + (isSliced ? sliceSuffixEn : ''));

  let sourceBlock = '';
  if (options.embedSource && !options.publicBlur) {
    const sourceShots = [];
    for (const a of screenshots) {
      sourceShots.push({
        id: a.id,
        filename: a.filename,
        width: a.width,
        height: a.height,
        blurBoxes: a.blurBoxes || [],
        maskBoxes: a.maskBoxes || [],
        dataUrl: await blobToDataUrl(a.blob),
      });
    }
    const source = {
      format: SOURCE_FORMAT,
      version: 1,
      pageTitle: project.pageTitle,
      titleEn: project.titleEn,
      titleRu: project.titleRu,
      subEn: project.subEn,
      subRu: project.subRu,
      defaultLang: project.defaultLang,
      globalBlurBoxes: project.globalBlurBoxes || [],
      steps: project.steps.map((st) => ({
        id: st.id,
        screenshotId: st.screenshotId,
        chapterTitle: st.chapterTitle,
        act: st.act,
        box: st.box,
        cursorPos: st.cursorPos,
        en: st.en,
        ru: st.ru,
        voiceDraft: st.voiceDraft,
        keepBlur: st.keepBlur,
      })),
      screenshots: sourceShots,
    };
    sourceBlock = `<script type="application/json" id="guide-source">${safeJsonForScript(source)}</script>\n`;
  }

  return `<!doctype html>
<html lang="${project.defaultLang || (isSingleLang ? 'en' : 'ru')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<style>
:root{
  --bg:#f4f5f7; --card:#ffffff; --ink:#1b1f24; --muted:#5b6470; --line:#dde1e6;
  --accent:#0f7b6c; --accent-ink:#ffffff; --hl:#e5322d; --chip:#eef1f4;
  --success:#10b981;
}
:root[data-theme="dark"]{--bg:#14171a;--card:#1d2125;--ink:#eceff2;--muted:#9aa4af;--line:#2c3238;--accent:#2bb5a0;--accent-ink:#06201b;--hl:#ff5a54;--chip:#272d33}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1160px;margin:0 auto;padding:16px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
h1{font-size:18px;margin:0}
h1 small{display:block;font-weight:400;color:var(--muted);font-size:13px}
.tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;background:var(--card);color:var(--muted);padding:6px 12px;font:inherit;font-size:13px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.stage{position:relative;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.shotbox{display:block}
.shot{position:relative;line-height:0;overflow:hidden;user-select:none}
.shot img{width:100%;height:auto;display:block}
.hl{position:absolute;border:3px solid var(--hl);border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,.2);pointer-events:none;animation:pulse 1.4s ease-in-out infinite;transition:all .2s ease}
.hl.clickable{pointer-events:auto;cursor:pointer}
.hl.clicked{animation:flash .3s ease-out;border-color:var(--success)}
@keyframes pulse{0%,100%{outline:0 solid rgba(229,50,45,.6)}50%{outline:8px solid rgba(229,50,45,0)}}
@keyframes flash{0%{transform:scale(0.96);outline:12px solid rgba(16,185,129,.8)}100%{transform:scale(1);outline:0 solid rgba(16,185,129,0)}}
.cursor{position:absolute;width:34px;height:34px;pointer-events:none;transform:translate(-4px,-4px);animation:tap 1.4s ease-in-out infinite;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));transition:left .2s ease, top .2s ease}
@keyframes tap{0%,100%{translate:0 0}50%{translate:-5px -5px}}
.panel{position:relative;z-index:2;background:var(--card);padding:16px 18px 18px;border-top:1px solid var(--line);display:flex;gap:14px;align-items:flex-start}
.num{flex:none;width:38px;height:38px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-weight:700}
.txt{flex:1;min-width:0}
.chapter-badge{display:inline-block;background:var(--line);color:var(--ink);font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-bottom:6px;margin-right:6px}
.chip{display:inline-block;background:var(--chip);color:var(--muted);font-size:12px;padding:2px 9px;border-radius:99px;margin-bottom:4px;letter-spacing:.02em;text-transform:uppercase;font-weight:600}
.txt p{margin:0;font-size:17px;line-height:1.45}
.txt b{background:var(--chip);padding:0 5px;border-radius:4px}
nav{display:flex;align-items:center;gap:12px;margin-top:12px}
nav button.nav{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:12px 22px;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;min-width:110px}
nav button.nav.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
nav button.nav:disabled{opacity:.4;cursor:default}
.dots{flex:1;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;max-height:64px;overflow-y:auto;padding:4px}
.dots button{width:12px;height:12px;border-radius:50%;border:0;background:var(--line);cursor:pointer;padding:0;transition:transform .15s}
.dots button[aria-current="true"]{background:var(--accent);transform:scale(1.3)}
.hint{color:var(--muted);font-size:13px;text-align:center;margin-top:10px}
.fsbtn{border:1px solid var(--line);background:var(--card);color:var(--muted);padding:6px 12px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.fsbtn:hover{color:var(--ink);border-color:var(--muted)}
#fsx{display:none}
.lesson, .chapters-menu{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:-4px 0 12px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);font-size:14px}
.lesson.open, .chapters-menu.open{display:flex}
.chapters-menu select{padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit;max-width:100%}
.lesson input{width:64px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit}
.lesson button{border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);padding:6px 14px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer}
.lesson .lnote{color:var(--muted);font-size:12px}
body.fs .lesson, body.fs .chapters-menu{display:none}
/* full-page mode */
body.fs{overflow:hidden;background:#0b0d0f}
body.fs .wrap{max-width:none;padding:0;height:100vh;display:flex;flex-direction:column}
body.fs header,body.fs .hint,body.fs .dots{display:none}
body.fs .stage{flex:1;min-height:0;display:flex;flex-direction:column;border:0;border-radius:0;background:#0b0d0f}
body.fs .shotbox{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
body.fs .shot{flex:none}
body.fs .panel{padding:8px 14px;gap:12px;align-items:center;border-top:1px solid var(--line);background:var(--card)}
body.fs .num{width:30px;height:30px;font-size:14px}
body.fs .txt p{font-size:15px;line-height:1.35}
body.fs .chip{margin:0 8px 0 0;font-size:11px}
body.fs .panel nav{margin:0;gap:8px;flex:none}
body.fs nav button.nav{padding:7px 16px;min-width:0}
body.fs #fsx{display:block;position:fixed;top:8px;right:8px;z-index:5;opacity:.65;background:var(--card)}
body.fs #fsx:hover{opacity:1}
@media (max-width:640px){
  .wrap{padding:10px 12px}
  nav button.nav{padding:10px 14px;min-width:80px}
  .txt p{font-size:15px}
  .panel{padding:12px}
}
</style>
</head>
<body>
<button class="fsbtn" id="fsx"></button>
<div class="wrap">
  <header>
    <h1 id="title"></h1>
    <div class="tools">
      <button class="fsbtn" id="chbtn" title="Chapters">📑 <span id="chlbl">Chapters</span></button>
      <button class="fsbtn" id="modebtn" title="Toggle Trainer Mode">🎯 <span id="modelbl">Trainer Mode</span></button>
      <button class="fsbtn" id="thmbtn" title="Theme">🌓</button>
      <button class="fsbtn" id="lsb"></button>
      <button class="fsbtn" id="fsb" title="F"></button>
      <div class="seg" role="group" aria-label="Language"${isSingleLang ? ' style="display:none"' : ''}>
        <button data-lang="en" aria-pressed="false">EN</button>
        <button data-lang="ru" aria-pressed="false">RU</button>
      </div>
    </div>
  </header>

  <div class="chapters-menu" id="chaptersMenu">
    <span>Раздел / Chapter:</span>
    <select id="chapterSelect"></select>
  </div>

  <div class="lesson" id="lesson">
    <span id="lfrom"></span> <input type="number" id="lf" min="1" value="1">
    <span id="lto"></span> <input type="number" id="lt" min="1" value="1">
    <button id="lsave"></button>
    <span class="lnote" id="lnote"></span>
  </div>

  <div class="stage">
    <div class="shotbox" id="shotbox">
      <div class="shot" id="shot">
        <img id="img" alt="">
        <div class="hl clickable" id="hl" title="Click here to advance"></div>
        <svg class="cursor" id="cur" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l15 9.5-6.5 1.6 3.7 6.9-3 1.6-3.7-6.9L4.5 19z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </div>
    </div>
    <div class="panel">
      <div class="num" id="num"></div>
      <div class="txt">
        <div id="chapterBadgeContainer"></div>
        <span class="chip" id="chip"></span>
        <p id="text"></p>
      </div>
    </div>
  </div>

  <nav>
    <button class="nav" id="prev"></button>
    <div class="dots" id="dots"></div>
    <button class="nav primary" id="next"></button>
  </nav>
  <div class="hint" id="hint"></div>
</div>

${sourceBlock}<script id="app">
const STEPS = ${stepsJson};
const IMAGES = ${imagesJson};
const META = ${metaJson};
const I18N = {
  en:{
    title:"Interactive Step Guide",sub:"Step-by-step walk-through",
    prev:"Back",next:"Next",done:"Start over",
    hint:"Tip: click the highlighted box, use arrow keys to navigate, press F for full page.",
    full:"Full page",lesson:"Cut a lesson",lfrom:"Steps from",lto:"to",
    lsave:"Save lesson as HTML",lnote:"Saves a separate standalone HTML with only selected steps.",
    exit:"Exit full page",
    click:"Click",type:"Type",drag:"Drag",select:"Select",scroll:"Scroll",look:"Notice",step:"Step",
    chapters:"Chapters",trainerOn:"Trainer Mode (Active)",trainerOff:"Overview Mode",
    jumpTo:"Jump to chapter..."
  },
  ru:{
    title:"Интерактивная инструкция",sub:"Пошаговое интерактивное руководство",
    prev:"Назад",next:"Далее",done:"Сначала",
    hint:"Подсказка: кликайте по рамке, листайте стрелками на клавиатуре, клавиша F — на весь экран.",
    full:"На всю страницу",lesson:"Нарезать урок",lfrom:"Шаги с",lto:"по",
    lsave:"Сохранить урок в HTML",lnote:"Сохранится отдельный автономный HTML только с выбранными шагами.",
    exit:"Свернуть",
    click:"Нажать",type:"Ввести",drag:"Протянуть",select:"Выбрать",scroll:"Прокрутить",look:"Обратите внимание",step:"Шаг",
    chapters:"Разделы",trainerOn:"Режим тренажёра (вкл)",trainerOff:"Режим обзора",
    jumpTo:"Перейти к разделу..."
  }
};

for (const l of ["en","ru"]) {
  if (META["title_"+l]) I18N[l].title = META["title_"+l];
  if (META["sub_"+l]) I18N[l].sub = META["sub_"+l];
}

let lang = (META.default_lang && I18N[META.default_lang]) ? META.default_lang : "${project.defaultLang || 'en'}";
const LANG_KEY = "lang:" + (META.title_en || META.title_ru || "");
${isSingleLang ? '' : 'try { const s = localStorage.getItem(LANG_KEY); if(s && I18N[s]) lang = s; } catch(e){}'}

let i = 0;
let trainerMode = ${options.interactiveMode === false ? 'false' : 'true'};

const $ = id => document.getElementById(id);

// Populate chapters select
function updateChaptersSelect() {
  const sel = $("chapterSelect");
  sel.innerHTML = \`<option value="">-- \${I18N[lang].jumpTo} --</option>\`;
  const seen = new Set();
  STEPS.forEach((st, idx) => {
    if (st.chapterTitle && !seen.has(st.chapterTitle)) {
      seen.add(st.chapterTitle);
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = \`\${idx + 1}. \${st.chapterTitle}\`;
      sel.appendChild(opt);
    }
  });
}

function render() {
  if (STEPS.length === 0) return;
  const t = I18N[lang], s = STEPS[i], last = i === STEPS.length - 1;
  document.documentElement.lang = lang;
  $("title").innerHTML = t.title + "<small>" + t.sub + "</small>";
  $("img").src = IMAGES[s.img] || "";
  $("img").alt = t.step + " " + (i+1);

  const [x,y,w,h] = s.box, hl = $("hl");
  hl.style.cssText = \`left:\${x}%;top:\${y}%;width:\${w}%;height:\${h}%\`;
  hl.classList.toggle("clickable", trainerMode);
  hl.style.pointerEvents = trainerMode ? "" : "none";
  hl.title = trainerMode ? "Click here to advance" : "";
  
  const c = $("cur");
  if (s.cursorPos && Array.isArray(s.cursorPos)) {
    c.style.left = s.cursorPos[0] + "%";
    c.style.top = s.cursorPos[1] + "%";
  } else {
    c.style.left = (x + w * 0.96) + "%";
    c.style.top = (y + h * 0.92) + "%";
  }

  $("num").textContent = i + 1;
  $("chip").textContent = t[s.act] || s.act;

  const bContainer = $("chapterBadgeContainer");
  if (s.chapterTitle) {
    bContainer.textContent = "";
    const badge = document.createElement("span");
    badge.className = "chapter-badge";
    badge.textContent = "📑 " + s.chapterTitle;
    bContainer.appendChild(badge);
  } else {
    bContainer.innerHTML = "";
  }

  $("text").innerHTML = s[lang] || s.ru || s.en || "";
  $("prev").textContent = t.prev;
  $("prev").disabled = i === 0;
  $("next").textContent = last ? t.done : t.next;
  $("hint").textContent = t.hint;

  $("dots").innerHTML = STEPS.map((_,k)=>
    \`<button aria-label="\${t.step} \${k+1}" \${k===i?'aria-current="true"':''} data-k="\${k}"></button>\`
  ).join("");

  $("fsb").textContent = "⛶ " + t.full;
  $("fsx").textContent = "✕ " + t.exit + " (F)";
  $("lsb").textContent = "✂ " + t.lesson;
  $("lfrom").textContent = t.lfrom;
  $("lto").textContent = t.lto;
  $("lsave").textContent = t.lsave;
  $("lnote").textContent = t.lnote;
  $("lf").max = $("lt").max = STEPS.length;
  $("chlbl").textContent = t.chapters;
  $("modelbl").textContent = trainerMode ? t.trainerOn : t.trainerOff;

  fit();
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang));
}

function fit() {
  const sh = $("shot"), im = $("img");
  if (!document.body.classList.contains("fs")) {
    sh.style.width = sh.style.height = "";
    return;
  }
  if (!im.naturalWidth) {
    im.onload = fit;
    return;
  }
  const ar = im.naturalWidth / im.naturalHeight, box = $("shotbox");
  const w = Math.min(box.clientWidth, box.clientHeight * ar);
  sh.style.width = w + "px";
  sh.style.height = (w / ar) + "px";
}

function toggleFS() {
  const on = document.body.classList.toggle("fs");
  const nav = document.querySelector("nav");
  if (on) document.querySelector(".panel").appendChild(nav);
  else document.querySelector(".wrap").insertBefore(nav, $("hint"));
  fit();
}

$("fsb").onclick = $("fsx").onclick = toggleFS;
window.addEventListener("resize", fit);

// Chapter menu toggle & jump
$("chbtn").onclick = () => {
  const m = $("chaptersMenu");
  m.classList.toggle("open");
  if (m.classList.contains("open")) updateChaptersSelect();
};

$("chapterSelect").onchange = (e) => {
  const val = e.target.value;
  if (val !== "") {
    go(parseInt(val, 10));
    $("chaptersMenu").classList.remove("open");
  }
};

// Trainer mode toggle
$("modebtn").onclick = () => {
  trainerMode = !trainerMode;
  render();
};

// Interactive click on highlight box
$("hl").onclick = (e) => {
  e.stopPropagation();
  const hl = $("hl");
  hl.classList.add("clicked");
  setTimeout(() => hl.classList.remove("clicked"), 300);
  go(i === STEPS.length - 1 ? 0 : i + 1);
};

// Clicking screenshot outside target in trainer mode shakes/pulses the box
$("shot").onclick = (e) => {
  if (trainerMode && e.target.id !== "hl") {
    const hl = $("hl");
    hl.style.borderColor = "#f59e0b";
    setTimeout(() => { hl.style.borderColor = ""; }, 400);
  }
};

// Dark theme toggle
$("thmbtn").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("theme", next); } catch(e){}
};
try {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
} catch(e){}

// Lesson slicing
$("lsb").onclick = () => {
  const l = $("lesson");
  l.classList.toggle("open");
  if (l.classList.contains("open")) {
    $("lf").value = i + 1;
    $("lt").value = STEPS.length;
  }
};

$("lsave").onclick = () => {
  const a = Math.max(1, Math.min(STEPS.length, +$("lf").value || 1));
  const b = Math.max(a, Math.min(STEPS.length, +$("lt").value || STEPS.length));
  const slicedSteps = STEPS.slice(a - 1, b);
  const slicedImgs = {};
  slicedSteps.forEach(s => { slicedImgs[s.img] = IMAGES[s.img]; });

  const src = document.getElementById("app").textContent;
  const NL = String.fromCharCode(10);
  const k = src.indexOf(NL + "const I18N");
  const safe = o => JSON.stringify(o).replace(/</g, "\\\\u003c");
  const code = "const STEPS = " + safe(slicedSteps) + ";" + NL +
               "const IMAGES = " + safe(slicedImgs) + ";" + NL +
               "const META = " + safe(META) + ";" + src.slice(k);

  const doc = document.documentElement.cloneNode(true);
  doc.querySelector("body").className = "";
  doc.querySelector("#img").removeAttribute("src");
  doc.querySelector("#dots").innerHTML = "";
  doc.querySelector("#lesson").className = "lesson";
  doc.querySelector("#chaptersMenu").className = "chapters-menu";
  doc.querySelector("#app").textContent = code;
  const gsrc = doc.querySelector("#guide-source");
  if (gsrc) gsrc.remove();
  doc.querySelector("title").textContent = document.title + " (steps " + a + "-" + b + ")";

  const html = "<!doctype html>" + NL + doc.outerHTML;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = "lesson-steps-" + a + "-" + b + ".html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
};

function go(n) {
  i = Math.max(0, Math.min(STEPS.length - 1, n));
  render();
}

$("prev").onclick = () => go(i - 1);
$("next").onclick = () => go(i === STEPS.length - 1 ? 0 : i + 1);

$("dots").onclick = e => {
  const k = e.target.dataset.k;
  if (k !== undefined) go(+k);
};

document.querySelector(".seg").onclick = e => {
  const l = e.target.dataset.lang;
  if (!l) return;
  lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch(e){}
  render();
};

document.addEventListener("keydown", e => {
  const tg = e.target, tn = tg && tg.tagName;
  if (tn === "INPUT" || tn === "SELECT" || tn === "TEXTAREA" || (tg && tg.isContentEditable)) return;
  if (e.key === "ArrowRight") go(i + 1);
  if (e.key === "ArrowLeft") go(i - 1);
  if ((e.key === "f" || e.key === "F" || e.key === "а" || e.key === "А") && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFS();
  if (e.key === "Escape" && document.body.classList.contains("fs")) toggleFS();
});

render();
</script>
</body>
</html>`;
}

/**
 * Import a standalone HTML guide file (created by this app or build_guide.py / template.html)
 * and reconstruct it into a full editable GuideProject with screenshots in IndexedDB.
 */
export async function importFromStandaloneHtml(file: File): Promise<GuideProject> {
  const html = await file.text();

  const embedded = await tryImportEmbeddedSource(html);
  if (embedded) return embedded;

  // Extract page title from <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let extractedTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  if (extractedTitle.includes('/*PAGETITLE*/')) {
    extractedTitle = '';
  }

  // Extract STEPS, IMAGES, META
  const rawSteps = extractJsStructure(html, 'STEPS');
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error('No STEPS array found in the HTML file, or the steps list is empty.');
  }

  const rawImages = extractJsStructure(html, 'IMAGES') || {};
  const rawMeta = extractJsStructure(html, 'META') || {};

  const projectId = generateId();
  const assetMap = new Map<string, ScreenshotAsset>();

  // Collect all image keys referenced in STEPS or defined in IMAGES
  const imageKeys = new Set<string>();
  Object.keys(rawImages).forEach((k) => imageKeys.add(k));
  rawSteps.forEach((st: any) => {
    if (st && st.img) imageKeys.add(String(st.img));
  });

  if (imageKeys.size === 0) {
    imageKeys.add('1.png');
  }

  // Convert each image to Blob and save into IndexedDB
  for (const imgName of imageKeys) {
    const dataUrl = rawImages[imgName];
    let blob: Blob;

    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
      try {
        blob = dataUrlToBlob(dataUrl);
      } catch (err) {
        console.warn(`Failed to convert dataUrl for ${imgName}, creating placeholder:`, err);
        blob = createPlaceholderBlob(imgName);
      }
    } else {
      blob = createPlaceholderBlob(imgName);
    }

    const asset = await addScreenshot(projectId, blob, imgName);
    assetMap.set(imgName.toLowerCase(), asset);
  }

  const defaultAsset = assetMap.values().next().value;

  // Reconstruct guide steps
  const steps: GuideStep[] = rawSteps.map((s: any) => {
    const asset = assetMap.get(String(s.img || '').toLowerCase()) || defaultAsset;

    let box: BoxRect = { x: 30, y: 30, w: 25, h: 12 };
    if (Array.isArray(s.box) && s.box.length >= 4) {
      box = {
        x: Math.max(0, Math.min(100, Number(s.box[0]) || 0)),
        y: Math.max(0, Math.min(100, Number(s.box[1]) || 0)),
        w: Math.max(0.1, Math.min(100, Number(s.box[2]) || 10)),
        h: Math.max(0.1, Math.min(100, Number(s.box[3]) || 10)),
      };
    } else if (s.box && typeof s.box === 'object') {
      box = {
        x: Math.max(0, Math.min(100, Number(s.box.x) || 0)),
        y: Math.max(0, Math.min(100, Number(s.box.y) || 0)),
        w: Math.max(0.1, Math.min(100, Number(s.box.w) || 10)),
        h: Math.max(0.1, Math.min(100, Number(s.box.h) || 10)),
      };
    }

    let cursorPos: { x: number; y: number };
    if (Array.isArray(s.cursorPos) && s.cursorPos.length >= 2) {
      cursorPos = {
        x: Math.max(0, Math.min(100, Number(s.cursorPos[0]) || 0)),
        y: Math.max(0, Math.min(100, Number(s.cursorPos[1]) || 0)),
      };
    } else if (s.cursorPos && typeof s.cursorPos === 'object') {
      cursorPos = {
        x: Math.max(0, Math.min(100, Number(s.cursorPos.x) || 0)),
        y: Math.max(0, Math.min(100, Number(s.cursorPos.y) || 0)),
      };
    } else {
      cursorPos = computeDefaultCursorPos(box);
    }

    const enText = s.en || s.ru || '';
    const ruText = s.ru || s.en || '';

    return {
      id: generateId(),
      screenshotId: asset?.id || '',
      act: (s.act as ActionType) || 'click',
      box,
      cursorPos,
      chapterTitle: s.chapterTitle || s.chapter || s.chapter_title,
      en: enText,
      ru: ruText,
      voiceDraft: s.voiceDraft || s.voice_draft,
      keepBlur: Boolean(s.keepBlur || s.keep_blur),
    };
  });

  const baseFileName = file.name.replace(/\.[^/.]+$/, '');
  const titleEn = rawMeta.title_en || rawMeta.titleEn || extractedTitle || baseFileName || 'Interactive Step Guide';
  const titleRu = rawMeta.title_ru || rawMeta.titleRu || rawMeta.title_en || extractedTitle || baseFileName || 'Интерактивное руководство';
  const subEn = rawMeta.sub_en || rawMeta.subEn || 'Step-by-step interactive instructions';
  const subRu = rawMeta.sub_ru || rawMeta.subRu || 'Пошаговые интерактивные инструкции';
  const pageTitle = extractedTitle || (rawMeta.default_lang === 'ru' ? titleRu : titleEn);
  const defaultLang = (rawMeta.default_lang === 'ru' || rawMeta.default_lang === 'en') ? rawMeta.default_lang : 'en';

  const project: GuideProject = {
    id: projectId,
    pageTitle,
    titleEn,
    titleRu,
    subEn,
    subRu,
    defaultLang,
    globalBlurBoxes: [],
    steps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.projects.add(project);
  return project;
}

/**
 * Creates a new independent sub-project by slicing a range of steps (fromStepNumber to toStepNumber, 1-based)
 * from an existing guide. Clones only the screenshots used by the selected steps into IndexedDB.
 */
export async function createSubProjectFromRange(
  project: GuideProject,
  screenshots: ScreenshotAsset[],
  fromStepNumber: number,
  toStepNumber: number,
  customTitle?: string
): Promise<GuideProject> {
  const total = project.steps.length;
  if (total === 0) {
    throw new Error('Project has no steps to split.');
  }

  const minStep = Math.min(fromStepNumber, toStepNumber);
  const maxStep = Math.max(fromStepNumber, toStepNumber);
  const fromIdx = Math.max(0, Math.min(total - 1, minStep - 1));
  const toIdx = Math.max(fromIdx, Math.min(total - 1, maxStep - 1));

  const slicedRawSteps = project.steps.slice(fromIdx, toIdx + 1);
  const subProjectId = generateId();

  // Find all screenshots used by these steps and clone them into the new project
  const usedScreenshotIds = new Set(slicedRawSteps.map((s) => s.screenshotId));
  const oldIdToNewId = new Map<string, string>();

  for (const oldId of usedScreenshotIds) {
    const orig = screenshots.find((a) => a.id === oldId);
    if (orig) {
      const clonedAsset: ScreenshotAsset = {
        id: generateId(),
        projectId: subProjectId,
        filename: orig.filename,
        blob: orig.blob,
        width: orig.width,
        height: orig.height,
        blurBoxes: (orig.blurBoxes || []).map((b) => ({ ...b })),
        maskBoxes: (orig.maskBoxes || []).map((b) => ({ ...b })),
      };
      await db.screenshots.add(clonedAsset);
      oldIdToNewId.set(oldId, clonedAsset.id);
    }
  }

  // Clone steps with updated screenshot IDs and new IDs
  const newSteps: GuideStep[] = slicedRawSteps.map((s) => ({
    ...s,
    id: generateId(),
    screenshotId: oldIdToNewId.get(s.screenshotId) || s.screenshotId,
    box: { ...s.box },
    cursorPos: s.cursorPos ? { ...s.cursorPos } : undefined,
  }));

  const stepRangeStr = `${fromIdx + 1}–${toIdx + 1}`;
  const titleEn = customTitle?.trim() || `${project.titleEn || project.titleRu} (Steps ${stepRangeStr})`;
  const titleRu = customTitle?.trim() || `${project.titleRu || project.titleEn} (Шаги ${stepRangeStr})`;
  const pageTitle = customTitle?.trim() || `${project.pageTitle} (Steps ${stepRangeStr})`;

  const subProject: GuideProject = {
    id: subProjectId,
    pageTitle,
    titleEn,
    titleRu,
    subEn: project.subEn,
    subRu: project.subRu,
    defaultLang: project.defaultLang,
    globalBlurBoxes: (project.globalBlurBoxes || []).map((b) => ({ ...b })),
    steps: newSteps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.projects.add(subProject);
  return subProject;
}

const BOX_KEYS = ['x', 'y', 'w', 'h'] as const;
function cleanBox(b: any): BoxRect {
  const out: any = {};
  for (const k of BOX_KEYS) out[k] = Number(b?.[k]) || 0;
  return out as BoxRect;
}

/**
 * Restore a project losslessly from the <script id="guide-source"> block, if present.
 * Returns null when the block is absent or not a valid project of this format.
 */
async function tryImportEmbeddedSource(html: string): Promise<GuideProject | null> {
  const m = html.match(/<script\b[^>]*\bid=["']guide-source["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  let src: any;
  try {
    src = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (!src || src.format !== SOURCE_FORMAT || !Array.isArray(src.steps) || !Array.isArray(src.screenshots)) {
    return null;
  }

  const projectId = generateId();
  const idMap = new Map<string, string>();
  for (const sh of src.screenshots) {
    const blob = typeof sh.dataUrl === 'string' && sh.dataUrl.startsWith('data:')
      ? dataUrlToBlob(sh.dataUrl)
      : createPlaceholderBlob(String(sh.filename || 'image'));
    const asset = await addScreenshot(
      projectId,
      blob,
      String(sh.filename || '1.png'),
      Array.isArray(sh.blurBoxes) ? sh.blurBoxes.map(cleanBox) : [],
      Array.isArray(sh.maskBoxes) ? sh.maskBoxes.map(cleanBox) : []
    );
    idMap.set(String(sh.id), asset.id);
  }

  const steps: GuideStep[] = src.steps.map((s: any) => {
    const step: GuideStep = {
      id: generateId(),
      screenshotId: idMap.get(String(s.screenshotId)) || '',
      act: (s.act as ActionType) || 'click',
      box: cleanBox(s.box),
      en: s.en || '',
      ru: s.ru || '',
    };
    if (s.chapterTitle !== undefined && s.chapterTitle !== null) step.chapterTitle = s.chapterTitle;
    if (s.cursorPos && typeof s.cursorPos === 'object') {
      step.cursorPos = { x: Number(s.cursorPos.x) || 0, y: Number(s.cursorPos.y) || 0 };
    }
    if (s.voiceDraft !== undefined && s.voiceDraft !== null) step.voiceDraft = s.voiceDraft;
    if (s.keepBlur !== undefined && s.keepBlur !== null) step.keepBlur = Boolean(s.keepBlur);
    return step;
  });

  const project: GuideProject = {
    id: projectId,
    pageTitle: src.pageTitle || '',
    titleEn: src.titleEn || '',
    titleRu: src.titleRu || '',
    subEn: src.subEn || '',
    subRu: src.subRu || '',
    defaultLang: src.defaultLang === 'ru' ? 'ru' : 'en',
    globalBlurBoxes: Array.isArray(src.globalBlurBoxes) ? src.globalBlurBoxes.map(cleanBox) : [],
    steps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.projects.add(project);
  return project;
}
