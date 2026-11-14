/// <reference types="vite/client" />
import Dexie, { type Table } from 'dexie';
import type { BoxRect, GuideProject, ScreenshotAsset } from '../types/guide';

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

/** Public URL of the built-in tutorial: a guide about this tool, made with this tool. */
export const DEMO_GUIDE_URL = `${import.meta.env.BASE_URL}demo/how-to-guide.html`;

/**
 * Creates the built-in demo project: an 18-step guide about how to use this tool
 * (public/demo/how-to-guide.html, a "project for editing" export with embedded sources).
 * Imported through the regular HTML importer, so it opens in the editor like any guide.
 */
export async function createDemoProject(): Promise<GuideProject> {
  const response = await fetch(DEMO_GUIDE_URL);
  if (!response.ok) {
    throw new Error(`Could not load demo guide (${response.status})`);
  }
  const text = await response.text();
  // Dynamic import avoids a circular dependency (importerExporter imports this module).
  const { importFromStandaloneHtml } = await import('../services/importerExporter');
  return importFromStandaloneHtml(new File([text], 'how-to-guide.html', { type: 'text/html' }));
}
