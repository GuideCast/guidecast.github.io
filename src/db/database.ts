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
 * Helper to generate crisp 1920x1080 mock canvas screenshots for the 6-step demo walkthrough.
 */
async function createDemoScreenshotBlob(stepNumber: number): Promise<Blob> {
  const width = 1920;
  const height = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d canvas context');

  // Background base
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Helper rounded rect
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  };

  // Top App Bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, 72);

  // App Logo & Title
  drawRoundedRect(28, 16, 40, 40, 8);
  ctx.fillStyle = '#0d9488';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('G', 39, 44);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('Guide Creation Tool · Interactive Studio', 82, 44);

  // Top tabs
  const tabNames = ['1. Screen & Step Capture', '2. Step Editor & Privacy', '3. Player & Export'];
  const activeTabIdx = stepNumber === 1 || stepNumber === 2 ? 0 : stepNumber === 3 || stepNumber === 4 || stepNumber === 5 ? 1 : 2;
  tabNames.forEach((tName, i) => {
    const tx = 600 + i * 260;
    if (i === activeTabIdx) {
      drawRoundedRect(tx, 16, 240, 40, 8);
      ctx.fillStyle = '#0d9488';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(tName, tx + 16, 42);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText(tName, tx + 16, 42);
    }
  });

  // Top right user profile info (demonstrates privacy blur)
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(width - 48, 36, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('demo_trainer@corp.internal', width - 260, 41);

  // ================= SCENARIO 1: START SCREEN CAPTURE & SELECT TARGET TAB =================
  if (stepNumber === 1) {
    // Background workspace
    ctx.fillStyle = '#1e293b';
    drawRoundedRect(120, 110, width - 240, height - 150, 16);
    ctx.fill();

    // Central Browser Screen Sharing Dialog Modal
    const mx = 480;
    const my = 200;
    const mw = 960;
    const mh = 620;

    // Modal backdrop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 72, width, height - 72);

    // Modal Box
    drawRoundedRect(mx, my, mw, mh, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dialog Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Share your screen — chrome wants to share contents of your screen', mx + 32, my + 44);

    // Dialog Subtabs
    drawRoundedRect(mx + 32, my + 70, 240, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Entire Screen (❌ Loop)', mx + 48, my + 96);

    drawRoundedRect(mx + 290, my + 70, 140, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Window', mx + 330, my + 96);

    drawRoundedRect(mx + 450, my + 70, 260, 40, 8);
    ctx.fillStyle = '#0d9488';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('✓ Browser Tab (Recommended)', mx + 466, my + 96);

    // List of Tabs
    const tabsList = [
      { icon: '📊', name: 'Power BI Service — Sales & Margin Dashboard', isTarget: true },
      { icon: '⚙️', name: 'Guide Creation Tool (Current Tab — Avoid)', isTarget: false },
      { icon: '📄', name: 'Documentation & API Reference', isTarget: false },
    ];

    tabsList.forEach((tab, idx) => {
      const ty = my + 140 + idx * 90;
      drawRoundedRect(mx + 32, ty, mw - 64, 76, 12);
      ctx.fillStyle = tab.isTarget ? 'rgba(13, 148, 136, 0.25)' : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = tab.isTarget ? '#2dd4bf' : '#334155';
      ctx.lineWidth = tab.isTarget ? 3 : 1;
      ctx.stroke();

      ctx.fillStyle = tab.isTarget ? '#2dd4bf' : '#f8fafc';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`${tab.icon}  ${tab.name}`, mx + 56, ty + 44);

      if (tab.isTarget) {
        // Highlighted button
        drawRoundedRect(mx + mw - 250, ty + 18, 160, 40, 8);
        ctx.fillStyle = '#0d9488';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText('Select & Share →', mx + mw - 236, ty + 44);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText('❌ Infinite Mirror Loop', mx + mw - 230, ty + 44);
      }
    });

    // Dialog Footer Note
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('💡 Tip: Selecting the target application tab guarantees clean 1080p frames with zero recursive mirror feedback.', mx + 32, my + mh - 36);
  }

  // ================= SCENARIO 2: POP OUT FLOATING RECORDER (ALWAYS ON TOP) =================
  else if (stepNumber === 2) {
    // Full screen view of Power BI
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 72, width, height - 72);

    // Power BI Ribbon
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 72, width, 60);
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Power BI Desktop · Global Sales Workspace', 32, 108);

    const ribbonItems = ['Home', 'Insert', 'Modeling', 'View', 'Optimize', 'Help'];
    ribbonItems.forEach((r, idx) => {
      ctx.fillStyle = idx === 0 ? '#f8fafc' : '#94a3b8';
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText(r, 450 + idx * 110, 108);
    });

    // Mock dashboard visuals inside Power BI
    drawRoundedRect(80, 170, 700, 360, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Monthly Revenue vs Targets ($M)', 110, 215);

    // Bar chart mock
    for (let b = 0; b < 6; b++) {
      const bh = 120 + (b % 3) * 60;
      ctx.fillStyle = '#0284c7';
      drawRoundedRect(140 + b * 95, 480 - bh, 55, bh, 6);
      ctx.fill();
    }

    // FLOATING RECORDER WINDOW (Top Right)
    const pw = 520;
    const ph = 340;
    const px = width - pw - 80;
    const py = 160;

    drawRoundedRect(px, py, pw, ph, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Floating Window Header
    ctx.fillStyle = '#1e293b';
    drawRoundedRect(px, py, pw, 52, 16);
    ctx.fill();
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('🪟 Floating Step Recorder', px + 24, py + 34);

    drawRoundedRect(px + pw - 170, py + 12, 145, 28, 14);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('● ALWAYS ON TOP', px + pw - 158, py + 31);

    // Snap Step Button inside Floating Window
    const sbw = pw - 48;
    const sbh = 68;
    const sbx = px + 24;
    const sby = py + 80;

    drawRoundedRect(sbx, sby, sbw, sbh, 12);
    ctx.fillStyle = '#0d9488';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('📸 Snap Step & Mark Action', sbx + 60, sby + 43);

    // Voice dictation info
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('🎤 Speak instruction: "Click Add Source to start wizard"', px + 24, py + 180);
    ctx.fillText('💡 Stays floating while you work in your program without switching tabs!', px + 24, py + 215);

    // Step counter pill
    drawRoundedRect(px + 24, py + 260, 160, 36, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Steps recorded: 4', px + 40, py + 283);
  }

  // ================= SCENARIO 3: DRAW & RESIZE RED BOX + MOVE POINTER =================
  else if (stepNumber === 3) {
    // Editor stage background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 72, width, height - 72);

    // Central canvas card
    const cw = 1400;
    const ch = 760;
    const cx = (width - cw) / 2;
    const cy = 130;

    drawRoundedRect(cx, cy, cw, ch, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Canvas image contents: BI Table & Top Action Button
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('Financial Data Workspace · Semantic Models', cx + 48, cy + 64);

    // Target Button
    const btnX = cx + 48;
    const btnY = cy + 110;
    const btnW = 340;
    const btnH = 64;

    drawRoundedRect(btnX, btnY, btnW, btnH, 8);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('+ New Report / Dashboard', btnX + 32, btnY + 40);

    // Red Bounding Box around Button
    const pad = 12;
    const boxX = btnX - pad;
    const boxY = btnY - pad;
    const boxW = btnW + pad * 2;
    const boxH = btnH + pad * 2;

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    drawRoundedRect(boxX, boxY, boxW, boxH, 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.fill();

    // 8 White Handles
    const handles = [
      { x: boxX, y: boxY },
      { x: boxX + boxW / 2, y: boxY },
      { x: boxX + boxW, y: boxY },
      { x: boxX + boxW, y: boxY + boxH / 2 },
      { x: boxX + boxW, y: boxY + boxH },
      { x: boxX + boxW / 2, y: boxY + boxH },
      { x: boxX, y: boxY + boxH },
      { x: boxX, y: boxY + boxH / 2 },
    ];

    handles.forEach((h) => {
      drawRoundedRect(h.x - 7, h.y - 7, 14, 14, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // ↖ Pointer Cursor placed off to the side so text is 100% visible
    const curX = boxX + boxW + 40;
    const curY = boxY + boxH + 30;
    drawRoundedRect(curX - 10, curY - 14, 240, 36, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('↖', curX, curY + 12);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('Pointer offset away from text', curX + 24, curY + 10);

    // Callout badge
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('💡 Drag 8 handles to resize perfectly. Move ↖ pointer so button labels stay 100% readable!', cx + 48, cy + ch - 40);
  }

  // ================= SCENARIO 4: DRAW PRIVACY BLUR & WRITE INSTRUCTION =================
  else if (stepNumber === 4) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 72, width, height - 72);

    const cw = 1400;
    const ch = 760;
    const cx = (width - cw) / 2;
    const cy = 130;

    drawRoundedRect(cx, cy, cw, ch, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Top Area: User account details with Privacy Blur Box
    drawRoundedRect(cx + 48, cy + 48, cw - 96, 90, 12);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Account Settings & Production Access Keys:', cx + 72, cy + 85);

    // Blurred email area
    const blurX = cx + 480;
    const blurY = cy + 62;
    const blurW = 360;
    const blurH = 46;

    drawRoundedRect(blurX, blurY, blurW, blurH, 8);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('🌫 chief_analyst@corp.internal (BLURRED)', blurX + 16, blurY + 28);

    // Step instruction textarea card
    const formY = cy + 180;
    drawRoundedRect(cx + 48, formY, cw - 96, 260, 12);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Instruction Field (HTML & Bold text enabled):', cx + 72, formY + 44);

    drawRoundedRect(cx + 72, formY + 68, cw - 144, 120, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Click  + New Report  to configure semantic models and build your visual dashboards.', cx + 96, formY + 115);

    // Save and capture next button
    const saveX = cx + cw - 460;
    const saveY = cy + ch - 120;
    drawRoundedRect(saveX, saveY, 390, 64, 12);
    ctx.fillStyle = '#059669';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('✅ Save Step & Capture Next →', saveX + 32, saveY + 40);
  }

  // ================= SCENARIO 5: FULL-WIDTH EDITOR & ZOOM 140% =================
  else if (stepNumber === 5) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 72, width, height - 72);

    // Top Editor Toolbar with Zoom buttons & Height
    drawRoundedRect(48, 92, width - 96, 68, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sidebar mode controls
    drawRoundedRect(68, 106, 120, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('◀ Compact', 84, 131);

    drawRoundedRect(200, 106, 100, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillText('✕ Hide', 222, 131);

    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Full-Width Workspace (Max 1920px)', 330, 131);

    // Zoom Controls Group
    const zx = width - 640;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('🔍 Zoom:', zx, 131);

    drawRoundedRect(zx + 75, 106, 75, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('100%', zx + 92, 131);

    // Active Zoom 140%
    drawRoundedRect(zx + 160, 104, 85, 44, 8);
    ctx.fillStyle = '#0d9488';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('140%', zx + 180, 132);

    drawRoundedRect(zx + 255, 106, 75, 40, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('180%', zx + 272, 131);

    // Tall Canvas Button
    drawRoundedRect(zx + 345, 106, 160, 40, 8);
    ctx.fillStyle = '#312e81';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e0e7ff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('↕️ Tall Canvas', zx + 365, 131);

    // Main Zoomed Canvas area
    const cw = width - 96;
    const ch = height - 200;
    drawRoundedRect(48, 175, cw, ch, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Enlarged Power BI buttons
    drawRoundedRect(cw / 2 - 250, 175 + ch / 2 - 80, 500, 140, 16);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('+ Add Data Source (140% Zoom)', cw / 2 - 210, 175 + ch / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Tiny icons, dropdowns, and folders scale up smoothly with 2D scroll!', cw / 2 - 230, 175 + ch / 2 + 35);
  }

  // ================= SCENARIO 6: EXPORT SINGLE HTML OR SPLIT INTO LESSONS =================
  else if (stepNumber === 6) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 72, width, height - 72);

    // Header
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('Export & Delivery Options', 120, 140);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Deploy autonomous single-file guides to students, or slice long walkthroughs into bite-sized lessons.', 120, 175);

    // Card 1: Standalone HTML (Recommended)
    const cardY = 220;
    const cardW = 500;
    const cardH = 460;

    drawRoundedRect(120, cardY, cardW, cardH, 16);
    ctx.fillStyle = '#0f766e';
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('guide-public.html', 152, cardY + 54);

    drawRoundedRect(152, cardY + 74, 210, 30, 15);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('★ RECOMMENDED FOR LMS', 166, cardY + 94);

    ctx.fillStyle = '#ccfbf1';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('• 100% self-contained single HTML file', 152, cardY + 145);
    ctx.fillText('• Base64 embedded 1080p screenshots', 152, cardY + 185);
    ctx.fillText('• Interactive simulator with click audio', 152, cardY + 225);
    ctx.fillText('• Sensitive data masked with blur presets', 152, cardY + 265);
    ctx.fillText('• Double click to run offline anywhere!', 152, cardY + 305);

    drawRoundedRect(152, cardY + 360, cardW - 64, 56, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('⬇️ Download guide-public.html', 210, cardY + 396);

    // Card 2: Split into Lessons Slicer
    drawRoundedRect(660, cardY, cardW, cardH, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('✂️ Split Long Guide into Lessons', 692, cardY + 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Select step range (e.g. Steps 1 to 15):', 692, cardY + 110);

    drawRoundedRect(692, cardY + 135, 180, 50, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('From: 1', 712, cardY + 167);

    drawRoundedRect(900, cardY + 135, 180, 50, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillText('To: 15', 920, cardY + 167);

    drawRoundedRect(692, cardY + 215, cardW - 64, 50, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Title: Lesson 1 — Data Ingestion', 712, cardY + 246);

    drawRoundedRect(692, cardY + 360, cardW - 64, 56, 12);
    ctx.fillStyle = '#4f46e5';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('⬇️ Export Range as HTML', 750, cardY + 396);

    // Card 3: Reverse HTML Import
    drawRoundedRect(1200, cardY, cardW, cardH, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('📄 Reverse HTML Import', 1232, cardY + 54);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Load previously exported .html guides back into the studio to modify steps or replace screenshots anytime.', 1232, cardY + 110);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([]));
    }, 'image/png');
  });
}

/**
 * Creates a rich built-in 6-step interactive walkthrough demo project.
 * Anyone can play it in 3. Player & Export or export to HTML as an onboarding trainer!
 */
export async function createDemoProject(): Promise<GuideProject> {
  const now = Date.now();
  const projectId = generateId();

  // Create 6 tutorial screenshots
  const [blob1, blob2, blob3, blob4, blob5, blob6] = await Promise.all([
    createDemoScreenshotBlob(1),
    createDemoScreenshotBlob(2),
    createDemoScreenshotBlob(3),
    createDemoScreenshotBlob(4),
    createDemoScreenshotBlob(5),
    createDemoScreenshotBlob(6),
  ]);

  const asset1: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '1_select_target_tab.png',
    blob: blob1,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  const asset2: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '2_floating_recorder_pip.png',
    blob: blob2,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  const asset3: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '3_highlight_handles_pointer.png',
    blob: blob3,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  const asset4: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '4_privacy_blur_and_instruction.png',
    blob: blob4,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  const asset5: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '5_fullwidth_editor_and_zoom.png',
    blob: blob5,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  const asset6: ScreenshotAsset = {
    id: generateId(),
    projectId,
    filename: '6_export_standalone_html.png',
    blob: blob6,
    width: 1920,
    height: 1080,
    blurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    maskBoxes: [],
  };

  await db.screenshots.bulkAdd([asset1, asset2, asset3, asset4, asset5, asset6]);

  const steps: GuideStep[] = [
    {
      id: generateId(),
      screenshotId: asset1.id,
      chapterTitle: '1. Select Target Tab',
      act: 'click',
      box: { x: 38.0, y: 31.0, w: 46.0, h: 7.5 },
      en: 'In the screen sharing dialog, choose <b>Browser Tab</b> and select your target program tab to eliminate mirror loops.',
      ru: 'В диалоге браузера выберите вкладку <b>Browser Tab (Вкладка браузера)</b> с вашей программой и нажмите <b>Поделиться</b>.',
      voiceDraft: 'Выберите вкладку целевой программы в диалоге браузера.',
    },
    {
      id: generateId(),
      screenshotId: asset2.id,
      chapterTitle: '2. Floating Recorder',
      act: 'click',
      box: { x: 70.0, y: 22.0, w: 25.5, h: 7.0 },
      en: 'Click <b>📸 Snap Step & Mark Action</b> in the floating recorder to capture your action without switching away from your work.',
      ru: 'Нажимайте <b>📸 Snap Step</b> в плавающем окне, чтобы делать снимки шагов прямо поверх рабочей программы.',
      voiceDraft: 'Нажмите кнопку снимка шага в плавающем рекордере.',
    },
    {
      id: generateId(),
      screenshotId: asset3.id,
      chapterTitle: '3. Highlight & Handles',
      act: 'click',
      box: { x: 17.0, y: 21.0, w: 21.0, h: 8.0 },
      en: 'Drag the <b>8 white handles</b> to frame <b>+ New Report</b>, and move the <b>↖ pointer</b> away from text.',
      ru: 'Обведите кнопку <b>+ New Report</b> красной рамкой, потяните за <b>8 маркеров</b> и сдвиньте стрелку от букв.',
      voiceDraft: 'Выделите рамку и настройте размер ручками.',
    },
    {
      id: generateId(),
      screenshotId: asset4.id,
      chapterTitle: '4. Privacy & Save',
      act: 'click',
      box: { x: 57.0, y: 70.0, w: 25.0, h: 7.0 },
      en: 'Notice the privacy blur over confidential emails. Type your instruction and click <b>✅ Save Step & Capture Next →</b>.',
      ru: 'Обратите внимание на блюр email. Введите текст и нажмите <b>✅ Save Step & Capture Next →</b>.',
      voiceDraft: 'Сохраните шаг и перейдите к следующему действию.',
    },
    {
      id: generateId(),
      screenshotId: asset5.id,
      chapterTitle: '5. Full-Width & Zoom',
      act: 'click',
      box: { x: 74.0, y: 9.5, w: 5.5, h: 4.5 },
      en: 'Collapse the left column with <b>◀ Compact</b> and click <b>🔍 Zoom 140%</b> to magnify small icons.',
      ru: 'Сверните левую колонку кнопкой <b>◀ Compact</b> и включите <b>🔍 Zoom 140%</b> для увеличения мелких элементов.',
      voiceDraft: 'Включите масштаб сто сорок процентов для детальной разметки.',
    },
    {
      id: generateId(),
      screenshotId: asset6.id,
      chapterTitle: '6. Export Deliverable',
      act: 'click',
      box: { x: 7.5, y: 49.0, w: 25.0, h: 6.5 },
      en: 'Click <b>⬇️ Download guide-public.html</b> to download an autonomous interactive tutorial for Moodle, Canvas, or chat!',
      ru: 'Нажмите <b>guide-public.html</b> для выгрузки автономного интерактивного файла для студентов в Moodle или Canvas!',
      voiceDraft: 'Скачайте готовый автономный файл гайда.',
      keepBlur: true,
    },
  ];

  const project: GuideProject = {
    id: projectId,
    pageTitle: 'Guide Creation Tool · Interactive Tutorial',
    titleEn: 'How to Use Guide Creation Tool (Interactive Tutorial)',
    titleRu: 'Как пользоваться Guide Creation Tool (Интерактивный тренажёр)',
    subEn: '6-step visual guide: screen capture, floating PiP recorder, bounding boxes, blur, zoom, and HTML export.',
    subRu: '6-шаговое интерактивное руководство: захват экрана, плавающий рекордер PiP, рамки, блюр, zoom и экспорт.',
    defaultLang: 'en',
    globalBlurBoxes: [{ x: 84, y: 2, w: 14, h: 4.5 }],
    steps,
    createdAt: now,
    updatedAt: now,
  };

  await db.projects.add(project);
  return project;
}
