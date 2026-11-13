export type ActionType = 'click' | 'type' | 'drag' | 'select' | 'scroll' | 'look';

/**
 * Normalized rectangle coordinates in percentages (0..100) relative to image dimensions.
 * x: left %, y: top %, w: width %, h: height %
 */
export interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Single step within a guide project.
 */
export interface GuideStep {
  id: string;
  screenshotId: string;
  chapterTitle?: string;
  act: ActionType;
  box: BoxRect;
  cursorPos?: { x: number; y: number }; // optional custom cursor percentage (0..100)
  en: string;
  ru: string;
  voiceDraft?: string;
  keepBlur?: boolean; // if true, does not carve out blur for this step in public mode
}

/**
 * Screenshot binary asset stored in IndexedDB.
 */
export interface ScreenshotAsset {
  id: string;
  projectId: string;
  filename: string;
  blob: Blob;
  width: number;
  height: number;
  blurBoxes: BoxRect[]; // screenshot-specific blur areas (percentages 0..100)
  maskBoxes: BoxRect[]; // screenshot-specific mask/patch areas (percentages 0..100)
}

/**
 * Guide project root configuration.
 */
export interface GuideProject {
  id: string;
  pageTitle: string;
  titleEn: string;
  titleRu: string;
  subEn: string;
  subRu: string;
  defaultLang: 'en' | 'ru';
  globalBlurBoxes: BoxRect[]; // blur areas applied across all screenshots in this project
  steps: GuideStep[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Legacy formats (from fabric-guide-tool / build_guide.py / steps.json)
 * where box is [x0, y0, x1, y1] in pixels relative to display_width (default: 2000).
 */
export interface LegacyStep {
  img: string;
  act: ActionType;
  box: [number, number, number, number]; // [x0, y0, x1, y1]
  en: string;
  ru: string;
  chapter?: string;
  chapter_title?: string;
  cursor_pos?: [number, number];
  voice_draft?: string;
  keep_blur?: boolean;
}

export interface LegacyStepsJson {
  page_title?: string;
  title_en?: string;
  titleRu?: string;
  title_ru?: string;
  sub_en?: string;
  sub_ru?: string;
  default_lang?: 'en' | 'ru';
  display_width?: number; // usually 2000
  steps: LegacyStep[];
  blur?: Record<string, [number, number, number, number][]>;
  mask?: Record<string, [number, number, number, number][]>;
  global_blur?: [number, number, number, number][];
}

/**
 * Format used inside standalone generated HTML (template.html).
 */
export interface StandaloneStep {
  img: string;
  act: ActionType;
  box: [number, number, number, number]; // [x%, y%, w%, h%]
  en: string;
  ru: string;
  chapterTitle?: string;
  cursorPos?: [number, number];
}

export interface StandaloneMeta {
  title_en?: string;
  title_ru?: string;
  sub_en?: string;
  sub_ru?: string;
  default_lang?: 'en' | 'ru';
}
