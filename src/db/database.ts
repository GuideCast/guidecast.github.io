import Dexie, { type Table } from 'dexie';
import type { BoxRect, GuideProject, GuideStep, ScreenshotAsset } from '../types/guide';

export class GuideDatabase extends Dexie {
  projects!: Table<GuideProject, string>;
  screenshots!: Table<ScreenshotAsset, string>;

  constructor() {
    super('GuideCreationToolDB');
    this.version(1).stores({
      projects: 'id, pageTitle, updatedAt, createdAt',
      screenshots: 'id, projectId, filename',
    });
  }
}

export const db = new GuideDatabase();

/**
 * Measure image dimensions from a Blob or File using Image object.
 */
export function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width || 1920;
      const height = img.naturalHeight || img.height || 1080;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image file to measure dimensions.'));
    };
    img.src = url;
  });
}

/**
 * Helper to generate random UUID-like IDs safely.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Create a new empty project.
 */
export async function createProject(data?: Partial<GuideProject>): Promise<GuideProject> {
  const now = Date.now();
  const project: GuideProject = {
    id: generateId(),
    pageTitle: data?.pageTitle || 'New Interactive Guide',
    titleEn: data?.titleEn || 'New Step Guide',
    titleRu: data?.titleRu || 'Новое интерактивное руководство',
    subEn: data?.subEn || 'Step-by-step interactive walk-through',
    subRu: data?.subRu || 'Пошаговая интерактивная инструкция',
    defaultLang: data?.defaultLang || 'en',
    globalBlurBoxes: data?.globalBlurBoxes || [],
    steps: data?.steps || [],
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  await db.projects.add(project);
  return project;
}

/**
 * Get single project by id.
 */
export async function getProject(id: string): Promise<GuideProject | undefined> {
  return await db.projects.get(id);
}

/**
 * List all projects ordered by updatedAt descending.
 */
export async function listProjects(): Promise<GuideProject[]> {
  return await db.projects.orderBy('updatedAt').reverse().toArray();
}

/**
 * Update project details and steps.
 */
export async function updateProject(id: string, updates: Partial<GuideProject>): Promise<void> {
  await db.projects.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Delete project and all associated screenshots.
 */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.screenshots, async () => {
    await db.screenshots.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

/**
 * Add a screenshot asset to the database with measured dimensions.
 */
export async function addScreenshot(
  projectId: string,
  blobOrFile: Blob | File,
  filename: string,
  blurBoxes: BoxRect[] = [],
  maskBoxes: BoxRect[] = []
): Promise<ScreenshotAsset> {
  const { width, height } = await getImageDimensions(blobOrFile);
  const asset: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename,
    blob: blobOrFile,
    width,
    height,
    blurBoxes,
    maskBoxes,
  };
  await db.screenshots.add(asset);
  return asset;
}

/**
 * Get all screenshots for a project.
 */
export async function getScreenshotsForProject(projectId: string): Promise<ScreenshotAsset[]> {
  return await db.screenshots.where('projectId').equals(projectId).toArray();
}

/**
 * Get a single screenshot asset by ID.
 */
export async function getScreenshot(id: string): Promise<ScreenshotAsset | undefined> {
  return await db.screenshots.get(id);
}

/**
 * Update screenshot asset (e.g. blurBoxes, maskBoxes).
 */
export async function updateScreenshot(id: string, updates: Partial<ScreenshotAsset>): Promise<void> {
  await db.screenshots.update(id, updates);
}

/**
 * Delete a screenshot asset.
 */
export async function deleteScreenshot(id: string): Promise<void> {
  await db.screenshots.delete(id);
}

/**
 * Helper to generate a nice mock canvas screenshot for demo.
 */
async function createDemoScreenshotBlob(title: string, subtitle: string, stepHighlightName: string): Promise<Blob> {
  const width = 1920;
  const height = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d canvas context');

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Top navigation bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, 72);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('NOVA BI · Analytics Workspace', 32, 44);

  // Top right user profile info (to demonstrate blur)
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(width - 50, 36, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('demo_user@corp.internal', width - 260, 41);

  // Left sidebar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 72, 260, height - 72);

  const navItems = ['📊 Dashboards', '⚡ Pipelines', '📁 Datasets', '⚙️ Settings'];
  navItems.forEach((item, idx) => {
    ctx.fillStyle = idx === 1 ? '#0284c7' : '#334155';
    ctx.fillRect(16, 100 + idx * 56, 228, 44);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillText(item, 36, 128 + idx * 56);
  });

  // Main area header
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillText(title, 300, 130);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(subtitle, 300, 168);

  // Action button (+ New Item)
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(300, 200, 180, 46, 8) : ctx.fillRect(300, 200, 180, 46);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('+ New Pipeline', 330, 229);

  // Cards grid
  const cards = [
    { name: 'Cloud Dataflow ETL', desc: 'Transform, clean and prepare multi-source datasets' },
    { name: 'Ingestion Pipeline', desc: 'Copy batch and streaming tables to Data Lake' },
    { name: 'Semantic Model', desc: 'Define relations, metrics and row-level security' },
  ];

  cards.forEach((card, idx) => {
    const cx = 300 + (idx % 2) * 440;
    const cy = 290 + Math.floor(idx / 2) * 220;
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx, cy, 410, 180, 12) : ctx.fillRect(cx, cy, 410, 180);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(card.name, cx + 24, cy + 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(card.desc, cx + 24, cy + 80);

    // Button inside card
    const isTarget = card.name.includes(stepHighlightName);
    ctx.fillStyle = isTarget ? '#0284c7' : '#334155';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx + 24, cy + 115, 140, 38, 6) : ctx.fillRect(cx + 24, cy + 115, 140, 38);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(isTarget ? 'Build now →' : 'Details', cx + 55, cy + 139);
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([]));
    }, 'image/png');
  });
}

/**
 * Creates a rich built-in demo project to explore the UI immediately.
 */
export async function createDemoProject(): Promise<GuideProject> {
  const now = Date.now();
  const projectId = generateId();

  // Create two demo screenshots
  const blob1 = await createDemoScreenshotBlob(
    'Workspace Pipelines Overview',
    'Demonstration of interactive guide creation with step bounding boxes and blur areas.',
    'Ingestion'
  );
  const blob2 = await createDemoScreenshotBlob(
    'Configure Dataflow Gen2',
    'Select transformation activities and configure target bronze/silver lakehouse.',
    'Dataflow'
  );

  const asset1: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '1_workspace_overview.png',
    blob: blob1,
    width: 1920,
    height: 1080,
    blurBoxes: [
      // Sensitive user email blur at top right (percentages)
      { x: 84, y: 2, w: 14, h: 4.5 },
    ],
    maskBoxes: [],
  };

  const asset2: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '2_configure_dataflow.png',
    blob: blob2,
    width: 1920,
    height: 1080,
    blurBoxes: [
      { x: 84, y: 2, w: 14, h: 4.5 },
    ],
    maskBoxes: [],
  };

  await db.screenshots.bulkAdd([asset1, asset2]);

  const steps: GuideStep[] = [
    {
      id: generateId(),
      screenshotId: asset1.id,
      chapterTitle: 'Workspace Introduction',
      act: 'click',
      box: { x: 15.6, y: 18.5, w: 9.4, h: 4.3 }, // + New Pipeline button
      en: 'In the top toolbar of your workspace, click <b>+ New Pipeline</b> to start the creation wizard.',
      ru: 'На верхней панели рабочей области нажмите <b>+ New Pipeline</b>, чтобы запустить мастер создания.',
      voiceDraft: 'Нажмите кнопку добавления нового пайплайна.',
    },
    {
      id: generateId(),
      screenshotId: asset1.id,
      chapterTitle: 'Select Pipeline Type',
      act: 'click',
      box: { x: 39.8, y: 37.5, w: 7.3, h: 3.5 }, // Button "Build now ->" on Ingestion card
      en: 'Locate the <b>Ingestion Pipeline</b> card and click <b>Build now →</b>.',
      ru: 'Найдите карточку <b>Ingestion Pipeline</b> и нажмите кнопку <b>Build now →</b>.',
      voiceDraft: 'Выберите пункт Ingestion Pipeline.',
    },
    {
      id: generateId(),
      screenshotId: asset2.id,
      chapterTitle: 'Configure Data Transformation',
      act: 'click',
      box: { x: 16.9, y: 37.5, w: 7.3, h: 3.5 }, // Button on Dataflow card
      en: 'Next, click <b>Build now →</b> inside <b>Cloud Dataflow ETL</b> to add data cleaning steps.',
      ru: 'Затем нажмите <b>Build now →</b> в карточке <b>Cloud Dataflow ETL</b> для добавления этапа очистки.',
      voiceDraft: 'Нажмите на кнопку карточки Cloud Dataflow ETL.',
    },
    {
      id: generateId(),
      screenshotId: asset2.id,
      chapterTitle: 'Completion & Summary',
      act: 'look',
      box: { x: 15.6, y: 10.5, w: 30.0, h: 6.5 },
      en: 'Notice that your settings have been preserved. You are ready to run the pipeline.',
      ru: 'Обратите внимание: все параметры сохранены. Пайплайн готов к первому запуску.',
      voiceDraft: 'Обратите внимание на статус готовности.',
      keepBlur: true,
    },
  ];

  const project: GuideProject = {
    id: projectId,
    pageTitle: 'Analytics Pipeline Quickstart',
    titleEn: 'How to Build a Data Ingestion Pipeline',
    titleRu: 'Как создать пайплайн загрузки данных в аналитической системе',
    subEn: 'Step-by-step interactive walk-through with training mode.',
    subRu: 'Пошаговый интерактивный тренажёр и руководство.',
    defaultLang: 'en',
    globalBlurBoxes: [],
    steps,
    createdAt: now,
    updatedAt: now,
  };

  await db.projects.add(project);
  return project;
}
