import type { ActionType, BoxRect, GuideProject, GuideStep } from '../types/guide';

/**
 * Level 0 (100% Autonomous Builder without AI and without tokens).
 * Generates neat bilingual instructions with <b>...</b> tags from a UI element name.
 */
export function buildSmartCaptionFromLabel(
  act: ActionType,
  label: string,
  extraNote?: string
): { en: string; ru: string } {
  const cleanLabel = (label || '').trim();
  const highlighted = cleanLabel ? `<b>${cleanLabel}</b>` : '<b>UI element</b>';
  const highlightedRu = cleanLabel ? `<b>${cleanLabel}</b>` : '<b>элемент интерфейса</b>';
  const extra = extraNote?.trim()
    ? extraNote.trim().startsWith(',')
      ? extraNote.trim()
      : ` ${extraNote.trim()}`
    : '';

  switch (act) {
    case 'click':
      return {
        en: `Click ${highlighted}${extra}.`,
        ru: `Нажмите ${highlightedRu}${extra}.`,
      };
    case 'type':
      return {
        en: `Type ${highlighted} into the input field${extra}.`,
        ru: `Введите ${highlightedRu} в поле ввода${extra}.`,
      };
    case 'select':
      return {
        en: `Select ${highlighted} from the options${extra}.`,
        ru: `Выберите ${highlightedRu} из списка${extra}.`,
      };
    case 'drag':
      return {
        en: `Drag ${highlighted} to the desired position${extra}.`,
        ru: `Перетащите ${highlightedRu} в нужное положение${extra}.`,
      };
    case 'scroll':
      return {
        en: `Scroll to ${highlighted}${extra}.`,
        ru: `Прокрутите страницу к ${highlightedRu}${extra}.`,
      };
    case 'look':
    default:
      return {
        en: `Notice ${highlighted}${extra}.`,
        ru: `Обратите внимание на ${highlightedRu}${extra}.`,
      };
  }
}

/**
 * Convert a Blob into an HTMLImageElement for canvas cropping.
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
      reject(new Error('Could not load image asset for cropping.'));
    };
    img.src = url;
  });
}

/**
 * Level 0 Micro-Crop Utility.
 * Crops only the area around the bounding box `box`:
 * 1. tightDataUrl: strictly the button frame (for UI preview).
 * 2. cropDataUrl: target box + surrounding context with red stroke, compressed to max 400px JPEG (~15-25 KB).
 * Reduces payload size by ~20-50x compared to a full 2MB screenshot.
 */
export async function cropStepTargetImage(
  blob: Blob,
  box: BoxRect,
  contextMultiplier: number = 2.0
): Promise<{ cropDataUrl: string; tightDataUrl: string }> {
  const img = await loadImageElement(blob);
  const imgW = img.naturalWidth || img.width || 1920;
  const imgH = img.naturalHeight || img.height || 1080;

  // Pixel coordinates of target bounding box
  const bx = Math.max(0, Math.round((box.x / 100) * imgW));
  const by = Math.max(0, Math.round((box.y / 100) * imgH));
  const bw = Math.max(2, Math.min(imgW - bx, Math.round((box.w / 100) * imgW)));
  const bh = Math.max(2, Math.min(imgH - by, Math.round((box.h / 100) * imgH)));

  // 1. Tight crop (strictly the button/target)
  const tightCanvas = document.createElement('canvas');
  tightCanvas.width = bw;
  tightCanvas.height = bh;
  const tightCtx = tightCanvas.getContext('2d');
  if (!tightCtx) throw new Error('Could not create tight canvas context');
  tightCtx.drawImage(img, bx, by, bw, bh, 0, 0, bw, bh);
  const tightDataUrl = tightCanvas.toDataURL('image/png');

  // 2. Context crop: padding around the target
  const mult = Math.max(1.2, contextMultiplier);
  const padX = Math.max(Math.round(bw * ((mult - 1) / 2)), 60);
  const padY = Math.max(Math.round(bh * ((mult - 1) / 2)), 45);

  const ctxX0 = Math.max(0, bx - padX);
  const ctxY0 = Math.max(0, by - padY);
  const ctxX1 = Math.min(imgW, bx + bw + padX);
  const ctxY1 = Math.min(imgH, by + bh + padY);

  const ctxW = ctxX1 - ctxX0;
  const ctxH = ctxY1 - ctxY0;

  // Downscale so maximum dimension is at most 400px
  const maxDim = 400;
  const scale = Math.min(1, maxDim / Math.max(ctxW, ctxH));
  const outW = Math.max(20, Math.round(ctxW * scale));
  const outH = Math.max(20, Math.round(ctxH * scale));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = outW;
  cropCanvas.height = outH;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error('Could not create crop canvas context');

  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';
  cropCtx.drawImage(img, ctxX0, ctxY0, ctxW, ctxH, 0, 0, outW, outH);

  // Draw bright red bounding box around target element
  const relTargetX = (bx - ctxX0) * scale;
  const relTargetY = (by - ctxY0) * scale;
  const relTargetW = bw * scale;
  const relTargetH = bh * scale;

  cropCtx.strokeStyle = '#ef4444';
  cropCtx.lineWidth = Math.max(2, Math.round(3 * scale));
  cropCtx.strokeRect(relTargetX, relTargetY, relTargetW, relTargetH);

  const cropDataUrl = cropCanvas.toDataURL('image/jpeg', 0.85);

  return { cropDataUrl, tightDataUrl };
}

/**
 * Level 1 (Free Batch Prompt for Any AI Chat — 0 API Keys).
 * Generates ready-to-copy prompt for ChatGPT, Claude, Gemini, DeepSeek.
 */
export function generateBatchPromptForFreeAi(project: GuideProject): string {
  const stepsData = project.steps.map((st, idx) => ({
    stepIndex: idx,
    action: st.act,
    voiceDraft: st.voiceDraft || '',
    currentRu: st.ru || '',
    currentEn: st.en || '',
    chapterTitle: st.chapterTitle || '',
  }));

  return `Ты профессиональный технический писатель и составитель интерактивных обучающих руководств.
Твоя задача — превратить черновые голосовые заметки и действия шагов в лаконичные, профессиональные инструкции для пользователей на двух языках (английском и русском).

Проект: "${project.titleRu || project.titleEn}"
${project.subRu || project.subEn ? `Описание: "${project.subRu || project.subEn}"\n` : ''}
Правила оформления инструкций:
1. Выделяй названия кнопок, вкладок, полей ввода, пунктов меню и ссылок тегами <b>...</b> (например, "Нажмите <b>+ Создать</b>." или "Click <b>+ New Item</b>.").
2. Если названия кнопок в интерфейсе на английском языке — сохраняй их точное написание на английском и в русской, и в английской версии.
3. Инструкции должны быть краткими, четкими и побудительными (1-2 предложения на шаг).
4. Если шаг логически начинает новый раздел гайда, укажи или уточни понятный "chapterTitle" (например, "1. Подключение источника").
5. ВЕРНИ СТРОГО ВАЛИДНЫЙ JSON-МАССИВ без дополнительного вступительного и заключительного текста, без markdown-обёрток или комментариев.

Список шагов для обработки:
${JSON.stringify(stepsData, null, 2)}

Формат ожидаемого ответа (строго валидный JSON):
[
  {
    "stepIndex": 0,
    "en": "In the top navigation bar, click <b>+ New Pipeline</b>.",
    "ru": "На верхней панели навигации нажмите <b>+ New Pipeline</b>.",
    "chapterTitle": "Создание нового пайплайна"
  }
]`;
}

export interface BatchAiStepOutput {
  stepIndex?: number;
  step_index?: number;
  index?: number;
  en?: string;
  ru?: string;
  chapterTitle?: string;
  chapter_title?: string;
  buttonLabel?: string;
  button_label?: string;
}

/**
 * Level 1 JSON parser & applicator.
 * Robustly extracts JSON array from raw AI output (including markdown fences) and updates steps.
 */
export function applyBatchAiJsonToSteps(
  steps: GuideStep[],
  rawAiOutput: string
): { updatedSteps: GuideStep[]; appliedCount: number } {
  if (!rawAiOutput || !rawAiOutput.trim()) {
    return { updatedSteps: [...steps], appliedCount: 0 };
  }

  // 1. Clean markdown code fences if present
  let cleaned = rawAiOutput.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // 2. Locate JSON array bounds [ ... ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  let parsed: BatchAiStepOutput[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Не удалось распознать JSON в ответе ИИ. Убедитесь, что передан валидный JSON-массив.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Ответ ИИ не является JSON-массивом.');
  }

  // Determine if indexing in the AI output is 1-based (indices 1..N and no 0)
  const indices = parsed
    .map((item, idx) => item.stepIndex ?? item.step_index ?? item.index ?? idx)
    .filter((n) => typeof n === 'number') as number[];

  const isOneBased =
    indices.length > 0 &&
    indices.every((idx) => idx >= 1 && idx <= steps.length) &&
    !indices.includes(0);

  const updatedSteps = [...steps];
  let appliedCount = 0;

  parsed.forEach((item, itemIdx) => {
    let targetIdx = item.stepIndex ?? item.step_index ?? item.index ?? itemIdx;
    if (typeof targetIdx === 'number' && isOneBased) {
      targetIdx -= 1;
    }

    if (typeof targetIdx === 'number' && targetIdx >= 0 && targetIdx < updatedSteps.length) {
      const existing = updatedSteps[targetIdx];
      const en = item.en?.trim();
      const ru = item.ru?.trim();
      const ch = item.chapterTitle?.trim() || item.chapter_title?.trim();

      if (en || ru || ch) {
        updatedSteps[targetIdx] = {
          ...existing,
          ...(en ? { en } : {}),
          ...(ru ? { ru } : {}),
          ...(ch ? { chapterTitle: ch } : {}),
        };
        appliedCount++;
      }
    }
  });

  return { updatedSteps, appliedCount };
}

/**
 * Level 2 (Optional BYOK Gemini API with Micro-Crops).
 * Settings storage in localStorage.
 */
const GEMINI_API_KEY_STORAGE = 'guide_gemini_api_key';
const GEMINI_MODEL_STORAGE = 'guide_gemini_model';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function getGeminiSettings(): { apiKey: string; model: string } {
  let apiKey = '';
  let model = DEFAULT_GEMINI_MODEL;
  try {
    apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
    model = localStorage.getItem(GEMINI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
  } catch (err) {
    console.warn('Could not read from localStorage', err);
  }
  return { apiKey, model };
}

export function saveGeminiSettings(settings: { apiKey?: string; model?: string }): void {
  try {
    if (settings.apiKey !== undefined) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, settings.apiKey.trim());
    }
    if (settings.model !== undefined) {
      localStorage.setItem(GEMINI_MODEL_STORAGE, settings.model.trim());
    }
  } catch (err) {
    console.warn('Could not save to localStorage', err);
  }
}

/**
 * Level 2 Gemini Micro-Crop API caller.
 * Takes only a tiny micro-crop with red outline + draft notes, sends to Gemini REST API,
 * and returns bilingual captions.
 */
export async function describeStepWithGeminiMicroCrop(params: {
  apiKey: string;
  model?: string;
  screenshotBlob: Blob;
  step: GuideStep;
}): Promise<{ en: string; ru: string; buttonLabel?: string }> {
  const { apiKey, screenshotBlob, step } = params;
  const model = params.model || DEFAULT_GEMINI_MODEL;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Укажите ключ Gemini API для использования авто-описания.');
  }

  // 1. Cut micro-crop (~15-25 KB JPEG with red bounding box)
  const { cropDataUrl } = await cropStepTargetImage(screenshotBlob, step.box, 2.0);

  // 2. Strip base64 data prefix
  const base64Data = cropDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

  const promptText = `You are an expert technical writer and UI documentation specialist.
Look at the attached micro-cropped screenshot snippet. The target interactive element is highlighted by a bright red rectangular outline.
Action type for this step: "${step.act}".
${step.voiceDraft ? `Author voice draft / note: "${step.voiceDraft}".` : ''}
${step.ru ? `Current Russian description: "${step.ru}".` : ''}

Instructions:
1. Identify the exact label, text, or icon meaning of the button or UI element inside the red outline (buttonLabel).
2. Formulate a short, natural step-by-step instruction in English ("en") and Russian ("ru").
3. Wrap the identified UI element in <b>...</b> HTML tags (for example: "Click <b>+ New Pipeline</b>." / "Нажмите <b>+ New Pipeline</b>.").
4. If the button text is in English in the screenshot, keep the exact English name inside <b>...</b> in both Russian and English instructions.
5. Return strictly valid JSON with this exact structure:
{
  "buttonLabel": "exact button name",
  "en": "concise instruction in English with <b>...</b>",
  "ru": "краткая инструкция на русском с <b>...</b>"
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    let errMsg = `Ошибка Gemini API (${res.status} ${res.statusText})`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMsg += `: ${errJson.error.message}`;
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Пустой ответ от модели Gemini API.');
  }

  // Parse JSON response
  let cleaned = rawText.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  let parsed: { en?: string; ru?: string; buttonLabel?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Не удалось распарсить JSON из ответа Gemini: ${rawText.substring(0, 100)}...`);
  }

  const en = parsed.en?.trim() || '';
  const ru = parsed.ru?.trim() || '';
  const buttonLabel = parsed.buttonLabel?.trim();

  if (!en && !ru) {
    throw new Error('Модель не вернула текст для шага.');
  }

  return { en, ru, buttonLabel };
}

/**
 * Universal Blur Presets for Application Interfaces.
 * Covers typical modern web, cloud, and desktop tool layouts.
 */
export interface BlurPresetItem {
  id: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  box: BoxRect;
}

export const UNIVERSAL_BLUR_PRESETS: BlurPresetItem[] = [
  {
    id: 'left-nav-narrow',
    nameRu: 'Узкая левая панель навигации',
    nameEn: 'Narrow Left Navigation Bar',
    descriptionRu: 'Скрывает иконки и меню боковой панели слева (4.5% ширины)',
    descriptionEn: 'Blurs sidebar navigation icons on the far left',
    box: { x: 0, y: 15, w: 4.5, h: 82 },
  },
  {
    id: 'left-nav-wide',
    nameRu: 'Широкое боковое меню / Дерево проектов',
    nameEn: 'Wide Sidebar / Project Tree',
    descriptionRu: 'Скрывает названия папок, каталогов и внутренних ресурсов (14% ширины)',
    descriptionEn: 'Blurs workspace folder tree and internal project names',
    box: { x: 0, y: 7, w: 14, h: 93 },
  },
  {
    id: 'top-right-profile',
    nameRu: 'Профиль пользователя (правый верхний угол)',
    nameEn: 'User Profile & Email (Top Right)',
    descriptionRu: 'Размывает корпоративный email, аватар и имя аккаунта',
    descriptionEn: 'Blurs account email, avatar and corporate user info',
    box: { x: 82, y: 0, w: 18, h: 6.5 },
  },
  {
    id: 'top-breadcrumbs',
    nameRu: 'Верхняя строка пути / Название рабочей области',
    nameEn: 'Top Breadcrumbs / Workspace Header',
    descriptionRu: 'Размывает внутреннее имя клиента, базы данных или рабочей области',
    descriptionEn: 'Blurs internal tenant name, database or workspace path',
    box: { x: 5, y: 6, w: 28, h: 5.5 },
  },
];

/**
 * Check if a preset is active in globalBlurBoxes with small tolerance.
 */
export function isPresetActive(globalBoxes: BoxRect[], presetBox: BoxRect): boolean {
  if (!globalBoxes || globalBoxes.length === 0) return false;
  return globalBoxes.some(
    (b) =>
      Math.abs(b.x - presetBox.x) < 0.2 &&
      Math.abs(b.y - presetBox.y) < 0.2 &&
      Math.abs(b.w - presetBox.w) < 0.2 &&
      Math.abs(b.h - presetBox.h) < 0.2
  );
}

/**
 * Toggle a preset inside globalBlurBoxes.
 */
export function togglePreset(globalBoxes: BoxRect[], presetBox: BoxRect): BoxRect[] {
  const active = isPresetActive(globalBoxes, presetBox);
  if (active) {
    return globalBoxes.filter(
      (b) =>
        !(
          Math.abs(b.x - presetBox.x) < 0.2 &&
          Math.abs(b.y - presetBox.y) < 0.2 &&
          Math.abs(b.w - presetBox.w) < 0.2 &&
          Math.abs(b.h - presetBox.h) < 0.2
        )
    );
  } else {
    return [...globalBoxes, { ...presetBox }];
  }
}
