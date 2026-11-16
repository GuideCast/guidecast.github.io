import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  FolderDown,
  Play,
  Edit3,
  Video,
  Trash2,
  Download,
  ArrowLeft,
  Check,
  Layers,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  FileCode,
  Shield,
  Mic,
  MicOff,
  Square,
  Wand2,
  RefreshCw,
  Scissors,
  HelpCircle,
  FolderOpen,
  Info,
  Save,
  ZoomIn,
  ZoomOut,
  PanelLeftOpen,
  PlayCircle,
  ImagePlus,
  Undo2,
  Redo2,
} from 'lucide-react';

import type { ActionType, BoxRect, GuideProject, GuideStep, ScreenshotAsset } from './types/guide';
import {
  createDemoProject,
  DEMO_GUIDE_URL,
  createProject,
  db,
  deleteProject,
  generateId,
  getProject,
  getScreenshotsForProject,
  listProjects,
  updateProject,
  updateScreenshot,
} from './db/database';
import {
  exportStandaloneHtml,
  exportToLegacyJson,
  importFromLegacyFolder,
  importFromStandaloneHtml,
  createSubProjectFromRange,
} from './services/importerExporter';
import { buildStepsFromFiles, onlyImages } from './services/screenshotImport';
import { ScreenshotImportModal } from './components/editor/ScreenshotImportModal';
import { LiveCaptureWorkspace } from './components/capture/LiveCaptureWorkspace';
import {
  InteractiveBoxEditor,
  computeDefaultCursorPos,
} from './components/common/InteractiveBoxEditor';
import { AiAndPrivacyModal } from './components/editor/AiAndPrivacyModal';
import { UpdateBanner, InstallButton } from './components/common/PwaControls';
import { WelcomeTourModal } from './components/onboarding/WelcomeTourModal';
import {
  type UiLang,
  getSavedUiLang,
  saveUiLang,
  hasSeenWelcomeTour,
  markWelcomeTourSeen,
  UI_TEXT,
} from './i18n/uiTranslations';
import {
  getGeminiSettings,
  describeStepWithGeminiMicroCrop,
} from './services/aiAssistantService';
import {
  VoiceDictationController,
  isSpeechRecognitionSupported,
  formatActionInstruction,
  type ParsedVoiceStep,
} from './services/speechService';

type ActiveTab = 'capture' | 'editor' | 'player';
type EditorDrawTool = 'target' | 'blur' | 'globalBlur' | 'mask';

type EditEntry = {
  kind: 'step' | 'asset' | 'project';
  targetId: string;
  /** Step to show again when the edit is undone or redone. */
  stepId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  t: number;
};

const MORE_TOOLS_KEY ='gct_editor_more_tools_open';

/** Plain-text preview of a caption that may contain simple HTML like <b>. */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>(() => getSavedUiLang());
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(
    () => !hasSeenWelcomeTour() && !new URLSearchParams(window.location.search).has('new')
  );
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const autoCreateDoneRef = useRef<boolean>(false);
  const [projects, setProjects] = useState<GuideProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<GuideProject | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gct_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [sidebarMode, setSidebarMode] = useState<'full' | 'compact'>('full');
  const [isOpenMenuVisible, setIsOpenMenuVisible] = useState<boolean>(false);

  // Folder & HTML import input refs
  const folderInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const newFromShotsInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ files: File[]; mode: 'new' | 'insert' } | null>(null);
  const [isImportBusy, setIsImportBusy] = useState<boolean>(false);
  const [isFileDragOver, setIsFileDragOver] = useState<boolean>(false);
  const [stepDragFrom, setStepDragFrom] = useState<number | null>(null);
  const [stepDragOver, setStepDragOver] = useState<number | null>(null);

  // Split long guide into lessons (range slicer)
  const [sliceFromStep, setSliceFromStep] = useState<number>(1);
  const [sliceToStep, setSliceToStep] = useState<number>(1);
  const [sliceLessonTitle, setSliceLessonTitle] = useState<string>('');

  // Sync range slicer whenever active project steps change
  useEffect(() => {
    if (activeProject && activeProject.steps.length > 0) {
      setSliceFromStep(1);
      setSliceToStep(activeProject.steps.length);
    }
  }, [activeProject?.id, activeProject?.steps.length]);

  // Load project list on mount. On the very first launch the Fabric example guide is added to
  // "Your guides" so the list is not empty (only once: deleting it does not bring it back).
  useEffect(() => {
    (async () => {
      try {
        const existing = await listProjects();
        const seeded = localStorage.getItem('gct_example_seeded_v1') === '1';
        if (existing.length === 0 && !seeded && !new URLSearchParams(window.location.search).has('new')) {
          localStorage.setItem('gct_example_seeded_v1', '1');
          await createDemoProject();
        } else if (!seeded) {
          localStorage.setItem('gct_example_seeded_v1', '1');
        }
      } catch (e) {
        console.warn('Could not add the example guide:', e);
      }
      await loadProjects();
    })();
  }, []);

  // "Now try it yourself" at the end of the tour links to ./?new=1: start a new guide on the Record tab.
  useEffect(() => {
    if (autoCreateDoneRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('new')) return;
    autoCreateDoneRef.current = true;
    params.delete('new');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
    void handleCreateNewProject();
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Guard selectedStepIndex bounds whenever project or steps change
  useEffect(() => {
    if (activeProject && activeProject.steps.length > 0) {
      if (selectedStepIndex >= activeProject.steps.length || selectedStepIndex < 0) {
        setSelectedStepIndex(activeProject.steps.length - 1);
      }
    }
  }, [activeProject, selectedStepIndex]);

  // Load active project and its screenshots whenever activeProjectId changes
  useEffect(() => {
    if (activeProjectId) {
      loadProjectDetails(activeProjectId);
    } else {
      setActiveProject(null);
      setScreenshots([]);
    }
  }, [activeProjectId]);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  async function loadProjects() {
    setIsLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при загрузке списка проектов');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProjectDetails(projectId: string) {
    setIsLoading(true);
    try {
      const proj = await db.projects.get(projectId);
      if (proj) {
        setActiveProject(proj);
        const assets = await getScreenshotsForProject(projectId);
        setScreenshots(assets);
        setSelectedStepIndex((prev) => {
          if (proj.steps.length === 0) return 0;
          return Math.min(prev, proj.steps.length - 1);
        });
      } else {
        setActiveProjectId(null);
      }
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при загрузке проекта');
    } finally {
      setIsLoading(false);
    }
  }

  const reloadActiveProject = async () => {
    if (activeProjectId) {
      await loadProjectDetails(activeProjectId);
    }
  };

  async function handleUpdateProject(updates: Partial<GuideProject>) {
    if (!activeProject) return;
    try {
      const updated = { ...activeProject, ...updates };
      setActiveProject(updated);
      await updateProject(activeProject.id, updates);
      const fresh = await getProject(activeProject.id);
      if (fresh) {
        setActiveProject(fresh);
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      showStatus('Ошибка при сохранении проекта');
    }
  }

  async function handleUpdateScreenshot(screenshotId: string, updates: Partial<ScreenshotAsset>) {
    if (!activeProject) return;
    try {
      await updateScreenshot(screenshotId, updates);
      const freshList = await getScreenshotsForProject(activeProject.id);
      setScreenshots(freshList);
    } catch (err) {
      console.error('Failed to update screenshot:', err);
      showStatus('Ошибка при обновлении скриншота');
    }
  }

  async function handleCreateNewProject() {
    try {
      const isEn = uiLang === 'en';
      const newProj = await createProject({
        titleRu: isEn ? 'Interactive Step Guide' : 'Новый интерактивный гайд',
        titleEn: 'Interactive Step Guide',
        subRu: isEn ? 'Step-by-step training walkthrough' : 'Пошаговый интерактивный тренажёр',
        subEn: 'Step-by-step training walkthrough',
        pageTitle: isEn ? 'Interactive Step Guide' : 'Интерактивный тренажёр',
        defaultLang: isEn ? 'en' : 'ru',
      });
      await loadProjects();
      setActiveProjectId(newProj.id);
      setActiveTab('capture');
      showStatus(isEn ? 'Guide created successfully!' : 'Проект успешно создан!');
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Failed to create guide' : 'Не удалось создать проект');
    }
  }

  async function handleCreateDemo() {
    try {
      setIsLoading(true);
      const demo = await createDemoProject();
      await loadProjects();
      setActiveProjectId(demo.id);
      setSelectedStepIndex(0);
      setActiveTab('editor');
      showStatus(
        uiLang === 'en'
          ? 'Demo opened: a guide about this tool, built with this tool.'
          : 'Демо открыто: гайд об этом инструменте, сделанный в нём же.'
      );
    } catch (err) {
      console.error(err);
      showStatus(
        uiLang === 'en' ? 'Error creating demo project' : 'Ошибка при создании демо-проекта'
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !confirm(
        uiLang === 'en'
          ? UI_TEXT.en.dashboard.confirmDelete
          : UI_TEXT.ru.dashboard.confirmDelete
      )
    )
      return;
    try {
      await deleteProject(id);
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
      await loadProjects();
      showStatus(uiLang === 'en' ? 'Guide deleted' : 'Проект удалён');
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Error deleting guide' : 'Ошибка при удалении проекта');
    }
  }

  // Handle Folder Import (steps.json + pngs)
  async function handleFolderSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setIsLoading(true);
      const imported = await importFromLegacyFolder(files);
      await loadProjects();
      setActiveProjectId(imported.id);
      setSelectedStepIndex(0);
      setActiveTab('editor');
      showStatus(
        uiLang === 'en'
          ? `Imported guide "${imported.titleEn || imported.titleRu}" (${imported.steps.length} steps)`
          : `Импортирован проект "${imported.titleRu}" (${imported.steps.length} шагов)`
      );
    } catch (err: unknown) {
      console.error(err);
      showStatus(
        uiLang === 'en'
          ? `Import error: ${err instanceof Error ? err.message : String(err)}`
          : `Ошибка импорта: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsLoading(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  }

  // Handle Standalone HTML Import (.html / .htm)
  async function handleHtmlSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLoading(true);
      const imported = await importFromStandaloneHtml(file);
      await loadProjects();
      setActiveProjectId(imported.id);
      setSelectedStepIndex(0);
      setActiveTab('editor');
      showStatus(
        uiLang === 'en'
          ? `Imported HTML guide "${imported.titleEn || imported.titleRu}" (${imported.steps.length} steps)`
          : `Импортирован HTML-гайд "${imported.titleRu || imported.titleEn}" (${imported.steps.length} шагов)`
      );
    } catch (err: unknown) {
      console.error('HTML import error:', err);
      showStatus(
        uiLang === 'en'
          ? `HTML import error: ${err instanceof Error ? err.message : String(err)}`
          : `Ошибка импорта HTML: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsLoading(false);
      if (htmlInputRef.current) htmlInputRef.current.value = '';
    }
  }

  // Screenshots made outside the app: pick or drop them, review the order, then make steps.
  function openImportReview(files: File[], mode: 'new' | 'insert') {
    const images = onlyImages(files);
    if (images.length === 0) {
      showStatus(uiLang === 'en' ? 'No pictures found in the selection' : 'Среди выбранных файлов нет картинок');
      return;
    }
    setPendingImport({ files: images, mode });
  }

  function handleNewFromScreenshotsPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length) openImportReview(files, 'new');
  }

  function handleScreenshotsUploaded(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length && activeProject) openImportReview(files, 'insert');
  }

  async function confirmImport(ordered: File[]) {
    if (!pendingImport || ordered.length === 0) return;
    const isEn = uiLang === 'en';
    try {
      setIsImportBusy(true);
      if (pendingImport.mode === 'new') {
        const proj = await createProject({
          titleRu: 'Новый интерактивный гайд',
          titleEn: 'Interactive Step Guide',
          subRu: 'Пошаговый интерактивный тренажёр',
          subEn: 'Step-by-step training walkthrough',
          pageTitle: isEn ? 'Interactive Step Guide' : 'Интерактивный тренажёр',
          defaultLang: isEn ? 'en' : 'ru',
        });
        const steps = await buildStepsFromFiles(proj.id, ordered);
        await updateProject(proj.id, { steps });
        await loadProjects();
        setActiveProjectId(proj.id);
        setSelectedStepIndex(0);
        setActiveTab('editor');
        showStatus(isEn ? `Guide created: ${steps.length} steps` : `Гайд создан: шагов ${steps.length}`);
      } else if (activeProject) {
        const newSteps = await buildStepsFromFiles(activeProject.id, ordered);
        const at = activeProject.steps.length === 0 ? 0 : selectedStepIndex + 1;
        const merged = [...activeProject.steps.slice(0, at), ...newSteps, ...activeProject.steps.slice(at)];
        await updateProject(activeProject.id, { steps: merged });
        await loadProjectDetails(activeProject.id);
        setSelectedStepIndex(at);
        setActiveTab('editor');
        showStatus(isEn ? `Added ${newSteps.length} steps` : `Добавлено шагов: ${newSteps.length}`);
      }
      setPendingImport(null);
    } catch (err) {
      console.error(err);
      showStatus(isEn ? 'Could not import the pictures' : 'Не удалось загрузить картинки');
    } finally {
      setIsImportBusy(false);
    }
  }

  // Dragging files from Explorer onto the page (home: new guide, editor: insert steps)
  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  function handlePageDragOver(e: React.DragEvent) {
    if (!isFileDrag(e) || isTourOpen || pendingImport) return;
    e.preventDefault();
    setIsFileDragOver(true);
  }
  function handlePageDrop(e: React.DragEvent) {
    if (!isFileDrag(e) || isTourOpen || pendingImport) return;
    e.preventDefault();
    setIsFileDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    if (!activeProject) openImportReview(files, 'new');
    else if (activeTab === 'editor') openImportReview(files, 'insert');
  }

  // Reorder steps by dragging in the editor list (arrows still work)
  function handleStepDrop(to: number) {
    if (!activeProject || stepDragFrom === null || stepDragFrom === to) return;
    const next = [...activeProject.steps];
    const [moved] = next.splice(stepDragFrom, 1);
    next.splice(to, 0, moved);
    saveSteps(next);
    setSelectedStepIndex(to);
  }

  // Step Management
  function handleAddStep(screenshotId?: string) {
    if (!activeProject) return;
    const targetShotId = screenshotId || screenshots[0]?.id || '';
    const defaultBox = { x: 30, y: 30, w: 25, h: 12 };
    const initialText =
      uiLang === 'en'
        ? 'Click on the highlighted element'
        : 'Нажмите на выделенный элемент';
    const newStep: GuideStep = {
      id: generateId(),
      screenshotId: targetShotId,
      act: 'click',
      box: defaultBox,
      cursorPos: computeDefaultCursorPos(defaultBox),
      en: initialText,
      ru: initialText,
    };
    const updatedSteps = [...activeProject.steps, newStep];
    saveSteps(updatedSteps);
    setSelectedStepIndex(updatedSteps.length - 1);
  }

  function handleDeleteStep(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeProject) return;
    const updatedSteps = activeProject.steps.filter((_, idx) => idx !== index);
    saveSteps(updatedSteps);
    if (selectedStepIndex >= updatedSteps.length) {
      setSelectedStepIndex(Math.max(0, updatedSteps.length - 1));
    }
  }

  function handleMoveStep(index: number, direction: 'up' | 'down', e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeProject) return;
    const newSteps = [...activeProject.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    saveSteps(newSteps);
    setSelectedStepIndex(targetIndex);
  }

  async function saveSteps(steps: GuideStep[]) {
    if (!activeProject) return;
    const updated = { ...activeProject, steps };
    setActiveProject(updated);
    await updateProject(activeProject.id, { steps });
  }

  // ---- Undo / redo for edits in the step editor (in memory, up to 50 actions) ----
  const activeProjectRef = useRef<GuideProject | null>(null);
  activeProjectRef.current = activeProject;
  const screenshotsRef = useRef<ScreenshotAsset[]>([]);
  screenshotsRef.current = screenshots;
  const historyRef = useRef<{ undo: EditEntry[]; redo: EditEntry[] }>({ undo: [], redo: [] });
  const [, setHistoryVersion] = useState<number>(0);
  const bumpHistory = () => setHistoryVersion((v) => v + 1);

  useEffect(() => {
    historyRef.current = { undo: [], redo: [] };
    bumpHistory();
  }, [activeProjectId]);

  function recordEdit(entry: Omit<EditEntry, 't'>) {
    const h = historyRef.current;
    const now = Date.now();
    const last = h.undo[h.undo.length - 1];
    // Typing a caption is many tiny edits: merge them into one undo step
    if (
      last &&
      entry.kind === 'step' &&
      last.kind === 'step' &&
      last.targetId === entry.targetId &&
      now - last.t < 1000 &&
      Object.keys(entry.after).every((k) => k === 'en' || k === 'ru') &&
      Object.keys(last.after).every((k) => k === 'en' || k === 'ru')
    ) {
      last.after = { ...last.after, ...entry.after };
      last.before = { ...entry.before, ...last.before };
      last.t = now;
      h.redo = [];
      bumpHistory();
      return;
    }
    h.undo.push({ ...entry, t: now });
    if (h.undo.length > 50) h.undo.shift();
    h.redo = [];
    bumpHistory();
  }

  async function applyEdit(entry: EditEntry, values: Record<string, unknown>) {
    const proj = activeProjectRef.current;
    if (!proj) return;
    if (entry.kind === 'step') {
      const steps = proj.steps.map((s) => (s.id === entry.targetId ? { ...s, ...(values as Partial<GuideStep>) } : s));
      const next = { ...proj, steps };
      activeProjectRef.current = next;
      setActiveProject(next);
      await updateProject(proj.id, { steps });
    } else if (entry.kind === 'asset') {
      await updateScreenshot(entry.targetId, values as Partial<ScreenshotAsset>);
      const fresh = await getScreenshotsForProject(proj.id);
      screenshotsRef.current = fresh;
      setScreenshots(fresh);
    } else {
      const next = { ...proj, ...(values as Partial<GuideProject>) };
      activeProjectRef.current = next;
      setActiveProject(next);
      await updateProject(proj.id, values as Partial<GuideProject>);
    }
    const idx = (activeProjectRef.current?.steps || []).findIndex((s) => s.id === entry.stepId);
    if (idx >= 0) setSelectedStepIndex(idx);
  }

  async function undoEdit() {
    const h = historyRef.current;
    const entry = h.undo.pop();
    if (!entry) return;
    h.redo.push(entry);
    bumpHistory();
    await applyEdit(entry, entry.before);
  }

  async function redoEdit() {
    const h = historyRef.current;
    const entry = h.redo.pop();
    if (!entry) return;
    h.undo.push(entry);
    bumpHistory();
    await applyEdit(entry, entry.after);
  }

  const undoFnRef = useRef(undoEdit);
  undoFnRef.current = undoEdit;
  const redoFnRef = useRef(redoEdit);
  redoFnRef.current = redoEdit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
        return; // native undo of the text field
      }
      if (!activeProjectRef.current || document.querySelector('[data-testid=shot-import-modal]')) return;
      e.preventDefault();
      if (isUndo) void undoFnRef.current();
      else void redoFnRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function pickKeys<T extends object>(src: T, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = (src as Record<string, unknown>)[k];
    return out;
  }

  /** Screenshot edits (blur / mask areas) with undo. */
  async function handleUpdateScreenshotUndoable(screenshotId: string, updates: Partial<ScreenshotAsset>) {
    const asset = screenshotsRef.current.find((s) => s.id === screenshotId);
    const stepId = activeProjectRef.current?.steps[selectedStepIndex]?.id || '';
    if (asset) {
      const keys = Object.keys(updates);
      recordEdit({
        kind: 'asset',
        targetId: screenshotId,
        stepId,
        before: pickKeys(asset, keys),
        after: pickKeys(updates, keys),
      });
    }
    await handleUpdateScreenshot(screenshotId, updates);
  }

  /** Project edits from the step editor: only the all-screenshots blur is undoable. */
  async function handleUpdateProjectUndoable(updates: Partial<GuideProject>) {
    const proj = activeProjectRef.current;
    if (proj && 'globalBlurBoxes' in updates) {
      recordEdit({
        kind: 'project',
        targetId: proj.id,
        stepId: proj.steps[selectedStepIndex]?.id || '',
        before: { globalBlurBoxes: proj.globalBlurBoxes || [] },
        after: { globalBlurBoxes: updates.globalBlurBoxes || [] },
      });
    }
    await handleUpdateProject(updates);
  }

  function handleUpdateCurrentStep(updates: Partial<GuideStep>) {
    if (!activeProject || !activeProject.steps[selectedStepIndex]) return;
    const cur = activeProject.steps[selectedStepIndex];
    const keys = Object.keys(updates);
    const changed = keys.some(
      (k) => JSON.stringify((cur as unknown as Record<string, unknown>)[k]) !== JSON.stringify((updates as Record<string, unknown>)[k])
    );
    if (changed) {
      recordEdit({
        kind: 'step',
        targetId: cur.id,
        stepId: cur.id,
        before: pickKeys(cur, keys),
        after: pickKeys(updates, keys),
      });
    }
    const newSteps = [...activeProject.steps];
    newSteps[selectedStepIndex] = {
      ...newSteps[selectedStepIndex],
      ...updates,
    };
    saveSteps(newSteps);
  }

  // Export handlers
  async function handleExportHtml(publicBlur: boolean) {
    if (!activeProject) return;
    try {
      setIsLoading(true);
      const html = await exportStandaloneHtml(activeProject, screenshots, {
        publicBlur,
        interactiveMode: true,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = publicBlur ? 'guide-public.html' : 'guide.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showStatus(
        uiLang === 'en'
          ? `File ${a.download} generated and downloaded successfully!`
          : `Файл ${a.download} успешно сформирован и скачан!`
      );
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Error generating HTML' : 'Ошибка при генерации HTML');
    } finally {
      setIsLoading(false);
    }
  }

  // Save the editable project: one .html with unblurred originals embedded, for the author only.
  async function handleExportProject() {
    if (!activeProject) return;
    try {
      setIsLoading(true);
      // Passed as a variable on purpose: `embedSource` is added to the options type on another branch.
      const opts = { publicBlur: false, interactiveMode: true, embedSource: true };
      const html = await exportStandaloneHtml(activeProject, screenshots, opts);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rawTitle =
        (uiLang === 'en'
          ? activeProject.titleEn || activeProject.titleRu
          : activeProject.titleRu || activeProject.titleEn) || 'guide';
      const safeTitle =
        rawTitle
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9а-яё_-]+/gi, '-')
          .replace(/^-+|-+$/g, '') || 'guide';
      a.download = `${safeTitle}-project.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showStatus(
        uiLang === 'en'
          ? `Project saved as ${a.download}. Keep it private.`
          : `Проект сохранён в ${a.download}. Не публикуйте этот файл.`
      );
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Could not save the project file' : 'Не удалось сохранить файл проекта');
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportJson() {
    if (!activeProject) return;
    try {
      const json = exportToLegacyJson(activeProject, screenshots);
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'steps.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showStatus(
        uiLang === 'en'
          ? 'File steps.json exported successfully!'
          : 'Файл steps.json успешно выгружен!'
      );
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Error exporting steps.json' : 'Ошибка при экспорте steps.json');
    }
  }

  // Export range of steps as standalone HTML
  async function handleExportRangeHtml() {
    if (!activeProject || activeProject.steps.length === 0) return;
    try {
      setIsLoading(true);
      const minStep = Math.min(sliceFromStep, sliceToStep);
      const maxStep = Math.max(sliceFromStep, sliceToStep);
      const from = Math.max(1, Math.min(activeProject.steps.length, minStep));
      const to = Math.max(from, Math.min(activeProject.steps.length, maxStep));

      const html = await exportStandaloneHtml(activeProject, screenshots, {
        publicBlur: true,
        interactiveMode: true,
        fromStep: from,
        toStep: to,
      });

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (sliceLessonTitle.trim() || `lesson-steps-${from}-${to}`)
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_-]+/gi, '-');
      a.download = `${safeTitle}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      showStatus(
        uiLang === 'en'
          ? `Lesson HTML (${from}–${to}) generated and downloaded in ${a.download}!`
          : `Урок (${from}–${to}) успешно сохранён в ${a.download}!`
      );
    } catch (err) {
      console.error('Failed to export lesson range:', err);
      showStatus(uiLang === 'en' ? 'Error exporting lesson' : 'Ошибка при экспорте урока');
    } finally {
      setIsLoading(false);
    }
  }

  // Save selected step range as an independent new project in the studio
  async function handleSaveRangeAsSubProject() {
    if (!activeProject || activeProject.steps.length === 0) return;
    try {
      setIsLoading(true);
      const minStep = Math.min(sliceFromStep, sliceToStep);
      const maxStep = Math.max(sliceFromStep, sliceToStep);
      const from = Math.max(1, Math.min(activeProject.steps.length, minStep));
      const to = Math.max(from, Math.min(activeProject.steps.length, maxStep));

      const subProj = await createSubProjectFromRange(
        activeProject,
        screenshots,
        from,
        to,
        sliceLessonTitle.trim() || undefined
      );

      await loadProjects();
      showStatus(
        uiLang === 'en'
          ? `Lesson "${subProj.titleEn}" (${subProj.steps.length} steps) saved as a new project!`
          : `Урок "${subProj.titleRu}" (${subProj.steps.length} шагов) сохранён как новый проект!`
      );
    } catch (err) {
      console.error('Failed to save range as project:', err);
      showStatus(uiLang === 'en' ? 'Error saving lesson' : 'Ошибка при сохранении урока');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors"
      onDragOver={handlePageDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.relatedTarget) setIsFileDragOver(false);
      }}
      onDrop={handlePageDrop}
    >
      {isFileDragOver && (
        <div className="fixed inset-0 z-40 bg-teal-700/20 border-4 border-dashed border-teal-600 pointer-events-none flex items-center justify-center">
          <span className="bg-white dark:bg-slate-800 px-6 py-3 rounded-xl shadow-xl text-lg font-semibold text-teal-800 dark:text-teal-200">
            {!activeProject
              ? uiLang === 'en' ? 'Drop pictures to create a guide' : 'Отпустите картинки, чтобы создать гайд'
              : activeTab === 'editor'
                ? uiLang === 'en' ? 'Drop pictures to add them as steps' : 'Отпустите картинки, чтобы добавить шаги'
                : uiLang === 'en' ? 'Open the Editor tab to drop pictures' : 'Откройте вкладку редактора, чтобы добавить картинки'}
          </span>
        </div>
      )}
      {pendingImport && (
        <ScreenshotImportModal
          files={pendingImport.files}
          mode={pendingImport.mode}
          afterStepNumber={activeProject && activeProject.steps.length > 0 ? selectedStepIndex + 1 : 0}
          uiLang={uiLang}
          busy={isImportBusy}
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      )}

      {/* Hidden picker: new guide from screenshots */}
      <input
        type="file"
        ref={newFromShotsInputRef}
        onChange={handleNewFromScreenshotsPicked}
        multiple
        accept="image/*"
        className="hidden"
        data-testid="new-from-shots-input"
      />

      {/* Hidden Folder Picker */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderSelected}
        // @ts-expect-error webkitdirectory standard attribute for folder picking
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/* Hidden Standalone HTML Guide Picker */}
      <input
        type="file"
        ref={htmlInputRef}
        onChange={handleHtmlSelected}
        accept=".html,.htm"
        className="hidden"
      />

      {/* Hidden Screenshot Picker */}
      <input
        type="file"
        ref={screenshotInputRef}
        onChange={handleScreenshotsUploaded}
        multiple
        accept="image/*"
        className="hidden"
        data-testid="insert-shots-input"
      />

      {/* Status banner */}
      {statusMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-teal-700 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 text-sm">
          <Check className="w-5 h-5" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm w-full">
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 py-3 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setActiveProjectId(null)}
          title={uiLang === 'en' ? 'Back to all guides' : 'К списку гайдов'}
          data-testid="header-home"
          className="flex items-center gap-3 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow">
            G
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {UI_TEXT[uiLang].header.appName}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {UI_TEXT[uiLang].header.tagline}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2.5">
          {activeProject && (
            <>
              {/* Single entry point for blur presets and AI settings */}
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-3 py-1.5 rounded-lg font-semibold text-sm flex items-center gap-2 border border-teal-600 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition"
                title={
                  uiLang === 'en'
                    ? 'Blur presets for all screenshots and AI caption helper'
                    : 'Размытие на всех скриншотах и ИИ-помощник для подписей'
                }
              >
                <Shield className="w-4 h-4" />
                <span>{uiLang === 'en' ? 'Privacy & AI' : 'Приватность и ИИ'}</span>
                {activeProject.globalBlurBoxes && activeProject.globalBlurBoxes.length > 0 && (
                  <span className="bg-teal-700 text-white text-xs px-1.5 rounded-full font-bold">
                    {activeProject.globalBlurBoxes.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveProjectId(null)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-4 h-4" /> {UI_TEXT[uiLang].tabs.backToDashboard}
              </button>
            </>
          )}

          {/* How to Use Modal Trigger */}
          <button
            onClick={() => {
              setActiveProjectId(null);
              setIsTourOpen(true);
            }}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
            title={uiLang === 'en' ? 'Interactive guide: how to use this tool' : 'Интерактивный гайд: как пользоваться инструментом'}
          >
            <HelpCircle className="w-4 h-4" />
            <span>{uiLang === 'en' ? 'How it works' : 'Как это работает'}</span>
          </button>

          {/* UI Language Switcher: EN | RU */}
          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-sm font-semibold">
            <button
              onClick={() => {
                setUiLang('en');
                saveUiLang('en');
              }}
              className={`px-2.5 py-1 transition ${
                uiLang === 'en'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Switch UI to English"
            >
              EN
            </button>
            <button
              onClick={() => {
                setUiLang('ru');
                saveUiLang('ru');
              }}
              className={`px-2.5 py-1 transition ${
                uiLang === 'ru'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Переключить интерфейс на русский"
            >
              RU
            </button>
          </div>

          {/* Dark / Light Mode Switcher */}
          <button
            onClick={() => {
              const next = !isDarkMode;
              setIsDarkMode(next);
              try {
                localStorage.setItem('gct_theme', next ? 'dark' : 'light');
              } catch {
                /* ignore */
              }
            }}
            className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title={
              uiLang === 'en'
                ? (isDarkMode ? UI_TEXT.en.header.themeLight : UI_TEXT.en.header.themeDark)
                : (isDarkMode ? UI_TEXT.ru.header.themeLight : UI_TEXT.ru.header.themeDark)
            }
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col py-4 sm:py-5 px-3 sm:px-5 lg:px-6 w-full max-w-[1920px] mx-auto">
        {isTourOpen ? (
          /* ================= TOUR VIEW: the how-to guide inside the app, with a way back ================= */
          <div className="flex flex-col flex-1 gap-3" data-testid="tour-view">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsTourOpen(false)}
                data-testid="tour-back"
                className="bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-xl font-semibold text-base flex items-center gap-2 shadow transition"
              >
                <ArrowLeft className="w-5 h-5" />
                {uiLang === 'en' ? 'Back to home' : 'Назад на главную'}
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {uiLang === 'en'
                  ? 'Click the red box in each picture to go to the next step.'
                  : 'Нажимайте на красную рамку на картинке, чтобы перейти к следующему шагу.'}
              </span>
            </div>
            <iframe
              title={uiLang === 'en' ? 'How to make a step-by-step guide' : 'Как сделать пошаговый гайд'}
              src={DEMO_GUIDE_URL}
              className="w-full flex-1 min-h-[75vh] rounded-xl border border-slate-300 dark:border-slate-700 bg-white"
            />
          </div>
        ) : !activeProject ? (
          /* ================= DASHBOARD VIEW ================= */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-800 to-cyan-900 text-white p-8 rounded-2xl shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {UI_TEXT[uiLang].dashboard.title}
                </h2>
                <p className="text-teal-50 max-w-2xl text-base leading-relaxed">
                  {UI_TEXT[uiLang].dashboard.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setIsTourOpen(true)}
                  data-testid="watch-how-to"
                  className="bg-amber-300 text-slate-900 hover:bg-amber-200 px-5 py-2.5 rounded-xl font-semibold text-base flex items-center gap-2 shadow transition"
                >
                  <PlayCircle className="w-5 h-5" />
                  {UI_TEXT[uiLang].dashboard.watchHowTo}
                </button>
                <button
                  onClick={handleCreateNewProject}
                  className="bg-white text-teal-900 hover:bg-teal-50 px-5 py-2.5 rounded-xl font-semibold text-base flex items-center gap-2 shadow transition"
                >
                  <Plus className="w-5 h-5 text-teal-700" />
                  {UI_TEXT[uiLang].dashboard.createGuide}
                </button>

                <button
                  onClick={() => newFromShotsInputRef.current?.click()}
                  data-testid="new-from-screenshots"
                  className="bg-white text-teal-900 hover:bg-teal-50 px-5 py-2.5 rounded-xl font-semibold text-base flex items-center gap-2 shadow transition"
                >
                  <ImagePlus className="w-5 h-5 text-teal-700" />
                  {UI_TEXT[uiLang].dashboard.fromScreenshots}
                </button>

                {/* One "Open" action with a small menu: HTML file or legacy folder */}
                <div className="relative">
                  <button
                    onClick={() => setIsOpenMenuVisible((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={isOpenMenuVisible}
                    className="bg-teal-950/50 hover:bg-teal-950/80 text-white px-5 py-2.5 rounded-xl font-semibold text-base flex items-center gap-2 border border-white/30 transition"
                  >
                    <FolderOpen className="w-5 h-5" />
                    {uiLang === 'en' ? 'Open guide or project' : 'Открыть гайд или проект'}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {isOpenMenuVisible && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsOpenMenuVisible(false)} />
                      <div
                        role="menu"
                        className="absolute z-40 mt-2 left-0 w-80 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5"
                      >
                        <button
                          role="menuitem"
                          onClick={() => {
                            setIsOpenMenuVisible(false);
                            htmlInputRef.current?.click();
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-start gap-3"
                        >
                          <FileCode className="w-5 h-5 text-teal-700 dark:text-teal-300 mt-0.5 shrink-0" />
                          <span>
                            <span className="block font-semibold text-sm">{UI_TEXT[uiLang].dashboard.importHtml}</span>
                            <span className="block text-sm text-slate-600 dark:text-slate-300">
                              {UI_TEXT[uiLang].dashboard.importHtmlHint}
                            </span>
                          </span>
                        </button>
                        <button
                          role="menuitem"
                          onClick={() => {
                            setIsOpenMenuVisible(false);
                            folderInputRef.current?.click();
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-start gap-3"
                        >
                          <FolderDown className="w-5 h-5 text-teal-700 dark:text-teal-300 mt-0.5 shrink-0" />
                          <span>
                            <span className="block font-semibold text-sm">{UI_TEXT[uiLang].dashboard.importFolder}</span>
                            <span className="block text-sm text-slate-600 dark:text-slate-300">
                              {UI_TEXT[uiLang].dashboard.importFolderHint}
                            </span>
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <p className="basis-full text-sm text-teal-50 pt-1" data-testid="from-shots-hint">
                  <b>{UI_TEXT[uiLang].dashboard.fromScreenshots}:</b> {UI_TEXT[uiLang].dashboard.fromScreenshotsHint}
                </p>
              </div>
            </div>

            {/* Calm reminder: data lives only in this browser */}
            <div className="flex items-start gap-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
              <Info className="w-5 h-5 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5" />
              <p>
                {uiLang === 'en'
                  ? 'Your guides are stored only in this browser on this computer. To keep a backup or continue on another computer, open a guide and use "Save project for editing".'
                  : 'Гайды хранятся только в этом браузере на этом компьютере. Чтобы сделать резервную копию или продолжить на другом компьютере, откройте гайд и нажмите «Сохранить проект для редактирования».'}
              </p>
            </div>

            {/* Projects Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {uiLang === 'en'
                    ? `Your guides (${projects.length})`
                    : `Ваши гайды (${projects.length})`}
                </h3>
              </div>

              {isLoading && projects.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {uiLang === 'en' ? 'Loading projects...' : 'Загрузка проектов...'}
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                  <FileCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="text-base font-semibold mb-1">
                    {UI_TEXT[uiLang].dashboard.noProjectsTitle}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 max-w-lg mx-auto">
                    {UI_TEXT[uiLang].dashboard.noProjectsDesc}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleCreateNewProject}
                      className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      {UI_TEXT[uiLang].dashboard.createGuide}
                    </button>
                    <button
                      onClick={handleCreateDemo}
                      className="border border-teal-600 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 px-4 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      {UI_TEXT[uiLang].dashboard.createDemo}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {projects.map((proj) => (
                    <div
                      key={proj.id}
                      onClick={() => {
                        setActiveProjectId(proj.id);
                        setSelectedStepIndex(0);
                        setActiveTab(proj.steps.length > 0 ? 'editor' : 'capture');
                      }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-teal-500 dark:hover:border-teal-500 cursor-pointer transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                            {uiLang === 'en' ? proj.titleEn || proj.titleRu : proj.titleRu || proj.titleEn}
                          </h4>
                          <button
                            onClick={(e) => handleDeleteProject(proj.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                            title={uiLang === 'en' ? 'Delete guide' : 'Удалить проект'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mb-4">
                          {uiLang === 'en' ? proj.subEn || proj.subRu : proj.subRu || proj.subEn}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-teal-600" />
                          {proj.steps.length}{' '}
                          {uiLang === 'en'
                            ? proj.steps.length === 1
                              ? 'step'
                              : 'steps'
                            : proj.steps.length === 1
                            ? 'шаг'
                            : 'шагов'}
                        </span>
                        <span>
                          {new Date(proj.updatedAt).toLocaleDateString(
                            uiLang === 'en' ? 'en-US' : 'ru-RU'
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= PROJECT VIEW ================= */
          <div className="flex-1 flex flex-col space-y-4">
            {/* Project Navigation and Title */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={
                    uiLang === 'en'
                      ? activeProject.titleEn || activeProject.titleRu || ''
                      : activeProject.titleRu || activeProject.titleEn || ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveProject({ ...activeProject, titleEn: val, titleRu: val });
                    updateProject(activeProject.id, { titleEn: val, titleRu: val });
                  }}
                  placeholder={uiLang === 'en' ? 'Guide title' : 'Название гайда'}
                  aria-label={uiLang === 'en' ? 'Guide title' : 'Название гайда'}
                  className="font-bold text-lg bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-teal-500 focus:outline-none w-full text-slate-900 dark:text-slate-100 transition"
                />
                <input
                  type="text"
                  value={
                    uiLang === 'en'
                      ? activeProject.subEn || activeProject.subRu || ''
                      : activeProject.subRu || activeProject.subEn || ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveProject({ ...activeProject, subEn: val, subRu: val });
                    updateProject(activeProject.id, { subEn: val, subRu: val });
                  }}
                  placeholder={uiLang === 'en' ? 'Subtitle (optional)' : 'Подзаголовок (необязательно)'}
                  aria-label={uiLang === 'en' ? 'Subtitle' : 'Подзаголовок'}
                  className="text-sm text-slate-600 dark:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-teal-500 focus:outline-none w-full transition"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shrink-0">
                {(
                  [
                    {
                      id: 'capture' as ActiveTab,
                      icon: <Video className="w-4 h-4" />,
                      label: uiLang === 'en' ? `1. Record (${screenshots.length})` : `1. Запись (${screenshots.length})`,
                    },
                    {
                      id: 'editor' as ActiveTab,
                      icon: <Edit3 className="w-4 h-4" />,
                      label:
                        uiLang === 'en'
                          ? `2. Edit steps (${activeProject.steps.length})`
                          : `2. Шаги (${activeProject.steps.length})`,
                    },
                    {
                      id: 'player' as ActiveTab,
                      icon: <Download className="w-4 h-4" />,
                      label: uiLang === 'en' ? '3. Preview & download' : '3. Просмотр и скачивание',
                    },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (
                        tab.id === 'editor' &&
                        activeProject.steps.length > 0 &&
                        (activeTab === 'capture' ||
                          selectedStepIndex >= activeProject.steps.length ||
                          selectedStepIndex < 0)
                      ) {
                        setSelectedStepIndex(activeProject.steps.length - 1);
                      }
                      setActiveTab(tab.id);
                    }}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab 1: Live Capture Workspace */}
            {activeTab === 'capture' && (
              <LiveCaptureWorkspace
                project={activeProject}
                screenshots={screenshots}
                onProjectUpdated={reloadActiveProject}
                onOpenEditorStep={(stepId) => {
                  const idx = activeProject.steps.findIndex((s) => s.id === stepId);
                  if (idx !== -1) {
                    setSelectedStepIndex(idx);
                  } else if (activeProject.steps.length > 0) {
                    setSelectedStepIndex(activeProject.steps.length - 1);
                  }
                  setActiveTab('editor');
                }}
                uiLang={uiLang}
                {...({ isDarkMode } as any)}
              />
            )}

            {/* Tab 2: Visual Step Editor */}
            {activeTab === 'editor' && (
              <div className="flex flex-col lg:flex-row gap-4 items-stretch flex-1 min-h-0">
                {/* Left: Step list (Full Mode) */}
                {sidebarMode === 'full' && (
                  <div className="lg:w-72 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col max-h-[60vh] lg:max-h-none lg:h-[calc(100vh-11.5rem)] lg:min-h-[420px] shadow-sm">
                    <div className="flex items-center justify-between mb-3 gap-1">
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                        {uiLang === 'en'
                          ? `Steps (${activeProject.steps.length})`
                          : `Шаги (${activeProject.steps.length})`}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleAddStep()}
                          className="bg-teal-700 hover:bg-teal-800 text-white px-2.5 py-1 rounded-lg text-sm font-semibold flex items-center gap-1 transition"
                          title={uiLang === 'en' ? 'Add a step with the same screenshot' : 'Добавить шаг'}
                        >
                          <Plus className="w-4 h-4" />
                          <span>{uiLang === 'en' ? 'Add' : 'Добавить'}</span>
                        </button>
                        <button
                          onClick={() => screenshotInputRef.current?.click()}
                          data-testid="add-screenshots"
                          className="border border-teal-600 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 px-2 py-1 rounded-lg text-sm font-semibold flex items-center gap-1 transition"
                          title={
                            uiLang === 'en'
                              ? 'Add your own screenshots as new steps after the selected step (or drop files here)'
                              : 'Добавить свои скриншоты новыми шагами после выбранного (или перетащите файлы сюда)'
                          }
                        >
                          <ImagePlus className="w-4 h-4" />
                          <span>{uiLang === 'en' ? 'Pictures' : 'Картинки'}</span>
                        </button>
                        <button
                          onClick={() => setSidebarMode('compact')}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                          title={uiLang === 'en' ? 'Narrow the list' : 'Сузить список'}
                          aria-label={uiLang === 'en' ? 'Narrow the list' : 'Сузить список'}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {activeProject.steps.length === 0 ? (
                        <div className="text-center py-12 text-slate-600 dark:text-slate-300 text-sm">
                          {uiLang === 'en'
                            ? 'No steps yet. Open "1. Record" to capture your screen, or click "Add".'
                            : 'Шагов пока нет. Откройте «1. Запись», чтобы снять экран, или нажмите «Добавить».'}
                        </div>
                      ) : (
                        activeProject.steps.map((st, idx) => {
                          const isSelected = idx === selectedStepIndex;
                          const preview = toPlainText(uiLang === 'en' ? st.en || st.ru || '' : st.ru || st.en || '');
                          return (
                            <div
                              key={st.id}
                              draggable
                              data-testid="step-row"
                              onDragStart={(e) => {
                                setStepDragFrom(idx);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', String(idx));
                              }}
                              onDragOver={(e) => {
                                if (stepDragFrom === null) return;
                                e.preventDefault();
                                setStepDragOver(idx);
                              }}
                              onDrop={(e) => {
                                if (stepDragFrom === null) return;
                                e.preventDefault();
                                e.stopPropagation();
                                handleStepDrop(idx);
                                setStepDragFrom(null);
                                setStepDragOver(null);
                              }}
                              onDragEnd={() => {
                                setStepDragFrom(null);
                                setStepDragOver(null);
                              }}
                              onClick={() => setSelectedStepIndex(idx)}
                              className={`group p-2.5 rounded-xl border text-sm cursor-pointer transition flex items-start justify-between gap-2 ${
                                stepDragOver === idx && stepDragFrom !== null && stepDragFrom !== idx
                                  ? 'ring-2 ring-teal-500 '
                                  : ''
                              }${stepDragFrom === idx ? 'opacity-40 ' : ''}${
                                isSelected
                                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 text-slate-900 dark:text-slate-100 shadow-sm'
                                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSelected
                                      ? 'bg-teal-700 text-white'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  {st.chapterTitle && (
                                    <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 block truncate">
                                      {st.chapterTitle}
                                    </span>
                                  )}
                                  <p className="line-clamp-2 text-slate-800 dark:text-slate-200 text-sm leading-snug">
                                    {preview || (uiLang === 'en' ? '(no caption yet)' : '(подписи пока нет)')}
                                  </p>
                                </div>
                              </div>

                              <div
                                className={`flex flex-col items-center shrink-0 text-slate-500 dark:text-slate-400 ${
                                  isSelected ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                } transition`}
                              >
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'up', e)}
                                  disabled={idx === 0}
                                  className="p-0.5 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-20"
                                  title={uiLang === 'en' ? 'Move up' : 'Выше'}
                                  aria-label={uiLang === 'en' ? 'Move up' : 'Выше'}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'down', e)}
                                  disabled={idx === activeProject.steps.length - 1}
                                  className="p-0.5 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-20"
                                  title={uiLang === 'en' ? 'Move down' : 'Ниже'}
                                  aria-label={uiLang === 'en' ? 'Move down' : 'Ниже'}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteStep(idx, e)}
                                  className="p-0.5 hover:text-red-600"
                                  title={uiLang === 'en' ? 'Delete step' : 'Удалить шаг'}
                                  aria-label={uiLang === 'en' ? 'Delete step' : 'Удалить шаг'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Left: Step list (Compact Mode: Narrow Strip with numbers) */}
                {sidebarMode === 'compact' && (
                  <div className="lg:w-16 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 flex flex-row lg:flex-col items-center gap-2 lg:h-[calc(100vh-11.5rem)] lg:min-h-[420px] shadow-sm overflow-x-auto">
                    <button
                      onClick={() => setSidebarMode('full')}
                      className="w-10 h-10 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center transition shrink-0"
                      title={uiLang === 'en' ? 'Show the full step list' : 'Показать список шагов'}
                      aria-label={uiLang === 'en' ? 'Show the full step list' : 'Показать список шагов'}
                    >
                      <PanelLeftOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleAddStep()}
                      className="w-10 h-10 rounded-lg bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center transition shrink-0"
                      title={uiLang === 'en' ? 'Add step' : 'Добавить шаг'}
                      aria-label={uiLang === 'en' ? 'Add step' : 'Добавить шаг'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => screenshotInputRef.current?.click()}
                      className="w-10 h-10 rounded-lg border border-teal-600 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center justify-center transition shrink-0"
                      title={uiLang === 'en' ? 'Add pictures as steps' : 'Добавить картинки шагами'}
                      aria-label={uiLang === 'en' ? 'Add pictures as steps' : 'Добавить картинки шагами'}
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>

                    <div className="flex-1 w-full overflow-y-auto flex flex-row lg:flex-col items-center gap-2 pt-1">
                      {activeProject.steps.map((st, idx) => {
                        const isSelected = idx === selectedStepIndex;
                        return (
                          <button
                            key={st.id}
                            onClick={() => setSelectedStepIndex(idx)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition shrink-0 ${
                              isSelected
                                ? 'bg-teal-700 text-white ring-2 ring-teal-400'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                            }`}
                            title={`${idx + 1}. ${toPlainText(uiLang === 'en' ? st.en || st.ru || '' : st.ru || st.en || '')}`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Right: Step editor */}
                <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                  {activeProject.steps[selectedStepIndex] ? (
                    <StepEditorPanel
                      project={activeProject}
                      step={activeProject.steps[selectedStepIndex]}
                      stepIndex={selectedStepIndex}
                      screenshots={screenshots}
                      onUpdateStep={handleUpdateCurrentStep}
                      onUpdateProject={handleUpdateProjectUndoable}
                      onUpdateScreenshot={handleUpdateScreenshotUndoable}
                      onUndo={() => void undoEdit()}
                      onRedo={() => void redoEdit()}
                      canUndo={historyRef.current.undo.length > 0}
                      canRedo={historyRef.current.redo.length > 0}
                      onOpenAiModal={() => setIsAiModalOpen(true)}
                      showStatus={showStatus}
                      uiLang={uiLang}
                      onSelectStepIndex={(idx) => setSelectedStepIndex(idx)}
                      onSwitchTab={(tab) => setActiveTab(tab)}
                    />
                  ) : (
                    <div className="text-center py-20 text-slate-600 dark:text-slate-300 text-base space-y-4">
                      <p>
                        {uiLang === 'en'
                          ? 'No steps yet. Record your screen first, then come back here to add captions.'
                          : 'Шагов пока нет. Сначала запишите экран, затем вернитесь сюда, чтобы добавить подписи.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('capture')}
                        className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition"
                      >
                        <Video className="w-4 h-4" />
                        {uiLang === 'en' ? 'Go to recording' : 'Перейти к записи'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Preview & download */}
            {activeTab === 'player' && (
              <div className="space-y-6">
                {/* Download: two clear primary actions */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-lg mb-1 text-slate-900 dark:text-slate-100">
                    {uiLang === 'en' ? 'Download' : 'Скачать'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                    {uiLang === 'en'
                      ? 'Each option gives you one .html file that opens in any browser.'
                      : 'Каждый вариант даёт один .html-файл, который открывается в любом браузере.'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => handleExportHtml(true)}
                      className="bg-teal-700 hover:bg-teal-800 text-white p-5 rounded-xl text-left shadow transition flex flex-col gap-2"
                    >
                      <span className="flex items-center gap-2 font-bold text-base">
                        <Download className="w-5 h-5" />
                        {uiLang === 'en' ? 'Guide for students (.html)' : 'Гайд для студентов (.html)'}
                      </span>
                      <span className="text-sm text-teal-50 leading-relaxed">
                        {uiLang === 'en'
                          ? 'Share this file with students. Private areas are blurred. File: guide-public.html'
                          : 'Этот файл можно отправлять студентам. Личные данные размыты. Файл: guide-public.html'}
                      </span>
                    </button>

                    <button
                      onClick={handleExportProject}
                      className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 border-2 border-teal-700 dark:border-teal-500 text-slate-900 dark:text-slate-100 p-5 rounded-xl text-left transition flex flex-col gap-2"
                    >
                      <span className="flex items-center gap-2 font-bold text-base text-teal-900 dark:text-teal-200">
                        <Save className="w-5 h-5" />
                        {uiLang === 'en' ? 'Save project for editing (.html)' : 'Сохранить проект для редактирования (.html)'}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {uiLang === 'en'
                          ? 'Your backup. It contains the original screenshots without blur, so keep it for yourself and do not share it. Open it later with "Open guide or project".'
                          : 'Ваша резервная копия. В ней исходные скриншоты без размытия, поэтому храните её у себя и не отправляйте студентам. Открыть позже: «Открыть гайд или проект».'}
                      </span>
                    </button>
                  </div>

                  <details className="mt-4 group">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-1.5">
                      <ChevronRight className="w-4 h-4 transition group-open:rotate-90" />
                      {uiLang === 'en' ? 'Advanced formats' : 'Другие форматы'}
                    </summary>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => handleExportHtml(false)}
                        className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col gap-1"
                      >
                        <span className="flex items-center gap-2 font-semibold text-sm">
                          <Download className="w-4 h-4" />
                          {uiLang === 'en' ? 'Download guide.html (no blur)' : 'Скачать guide.html (без размытия)'}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {uiLang === 'en'
                            ? 'Same player without blur. For internal use only.'
                            : 'Тот же плеер без размытия. Только для внутреннего использования.'}
                        </span>
                      </button>
                      <button
                        onClick={handleExportJson}
                        className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col gap-1"
                      >
                        <span className="flex items-center gap-2 font-semibold text-sm">
                          <FileCode className="w-4 h-4" />
                          {uiLang === 'en' ? 'Download steps.json' : 'Скачать steps.json'}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          {uiLang === 'en'
                            ? 'For the Python script build_guide.py (coordinates at display_width 2000).'
                            : 'Для Python-скрипта build_guide.py (координаты при display_width 2000).'}
                        </span>
                      </button>
                    </div>
                  </details>
                </div>

                {/* Split long guide into lessons */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-base flex items-center gap-2 text-slate-900 dark:text-slate-100">
                      <Scissors className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                      {UI_TEXT[uiLang].export.splitterTitle}
                    </h3>
                    <span className="text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full font-medium">
                      {activeProject.steps.length}{' '}
                      {uiLang === 'en' ? 'steps in current guide' : 'шагов в текущем гайде'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                    {UI_TEXT[uiLang].export.splitterSubtitle}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {UI_TEXT[uiLang].export.splitterFrom}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={activeProject.steps.length || 1}
                        value={sliceFromStep}
                        onChange={(e) =>
                          setSliceFromStep(
                            Math.max(
                              1,
                              Math.min(
                                activeProject.steps.length || 1,
                                parseInt(e.target.value, 10) || 1
                              )
                            )
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {UI_TEXT[uiLang].export.splitterTo}
                      </label>
                      <input
                        type="number"
                        min={sliceFromStep}
                        max={activeProject.steps.length || 1}
                        value={sliceToStep}
                        onChange={(e) =>
                          setSliceToStep(
                            Math.max(
                              1,
                              Math.min(
                                activeProject.steps.length || 1,
                                parseInt(e.target.value, 10) || 1
                              )
                            )
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {UI_TEXT[uiLang].export.splitterTitleLabel}
                      </label>
                      <input
                        type="text"
                        value={sliceLessonTitle}
                        onChange={(e) => setSliceLessonTitle(e.target.value)}
                        placeholder={
                          uiLang === 'en'
                            ? `e.g. Lesson 1: Data Connection (${sliceFromStep}–${sliceToStep})`
                            : `например, Урок 1: Подключение к данным (${sliceFromStep}–${sliceToStep})`
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="md:col-span-3 flex items-center h-9 text-sm text-slate-600 dark:text-slate-300">
                      <span>
                        {UI_TEXT[uiLang].export.splitterSelectedCount}{' '}
                        <b className="text-slate-800 dark:text-slate-200">
                          {Math.max(
                            0,
                            Math.min(activeProject.steps.length, sliceToStep) -
                              Math.min(activeProject.steps.length, sliceFromStep) +
                              1
                          )}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleExportRangeHtml}
                      disabled={activeProject.steps.length === 0}
                      className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow transition"
                    >
                      <Download className="w-4 h-4" />
                      {UI_TEXT[uiLang].export.splitterExportHtml} ({sliceFromStep}–{sliceToStep})
                    </button>

                    <button
                      onClick={handleSaveRangeAsSubProject}
                      disabled={activeProject.steps.length === 0}
                      className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
                    >
                      <Layers className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                      {UI_TEXT[uiLang].export.splitterSaveProject}
                    </button>
                  </div>
                </div>

                {/* Embedded Live Player Preview */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4 text-teal-600" />
                    {uiLang === 'en' ? 'Preview: what students will see' : 'Просмотр: так увидят студенты'}
                  </h4>
                  <LivePlayerPreview
                    project={activeProject}
                    screenshots={screenshots}
                    uiLang={uiLang}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-3 text-center text-xs text-slate-500 dark:text-slate-400" data-testid="app-footer">
        Made by{' '}
        <a
          href="https://www.linkedin.com/in/stanislavsidorovich/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-teal-700 dark:hover:text-teal-300"
        >
          Stanislav Sidorovich
        </a>
        <InstallButton uiLang={uiLang} />
      </footer>
      <UpdateBanner uiLang={uiLang} />

      {/* Ai and Privacy Modal */}
      {activeProject && (
        <AiAndPrivacyModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          project={activeProject}
          screenshots={screenshots}
          activeStep={activeProject.steps[selectedStepIndex]}
          onUpdateProject={handleUpdateProject}
          uiLang={uiLang}
        />
      )}

      {/* Welcome Tour Modal */}
      <WelcomeTourModal
        isOpen={isWelcomeOpen}
        onClose={() => {
          markWelcomeTourSeen();
          setIsWelcomeOpen(false);
        }}
        uiLang={uiLang}
        onToggleUiLang={(l) => {
          setUiLang(l);
          saveUiLang(l);
        }}
        onStartNew={handleCreateNewProject}
        onStartFromScreenshots={() => {
          setActiveProjectId(null);
          setTimeout(() => newFromShotsInputRef.current?.click(), 0);
        }}
        onOpenDemo={() => {
          setActiveProjectId(null);
          setIsTourOpen(true);
        }}
      />
    </div>
  );
}

/**
 * Enhanced Step Editor Panel with Canvas box positioning, privacy tools, voice dictation, and AI micro-crop.
 */
function StepEditorPanel({
  project,
  step,
  stepIndex,
  screenshots,
  onUpdateStep,
  onUpdateProject,
  onUpdateScreenshot,
  onOpenAiModal,
  showStatus,
  uiLang = 'en',
  onSelectStepIndex,
  onSwitchTab,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  project: GuideProject;
  step: GuideStep;
  stepIndex: number;
  screenshots: ScreenshotAsset[];
  onUpdateStep: (updates: Partial<GuideStep>) => void;
  onUpdateProject: (updates: Partial<GuideProject>) => Promise<void>;
  onUpdateScreenshot: (screenshotId: string, updates: Partial<ScreenshotAsset>) => Promise<void>;
  onOpenAiModal: () => void;
  showStatus: (msg: string) => void;
  uiLang?: 'en' | 'ru';
  onSelectStepIndex?: (index: number) => void;
  onSwitchTab?: (tab: ActiveTab) => void;
}) {
  const currentAsset = screenshots.find((s) => s.id === step.screenshotId) || screenshots[0];
  const [imageUrl, setImageUrl] = useState<string>('');

  // Active mouse drawing tool for InteractiveBoxEditor
  const [drawMode, setDrawMode] = useState<EditorDrawTool>('target');

  // Zoom & Canvas Height Expansion
  const [zoom, setZoom] = useState<number>(100);

  // "Privacy & more tools" section: collapsed by default, remembered per browser
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MORE_TOOLS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleMoreTools = () => {
    setIsMoreOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MORE_TOOLS_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (!next) setDrawMode('target');
      return next;
    });
  };
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStateRef = useRef<{ isPanning: boolean; lastX: number; lastY: number }>({
    isPanning: false,
    lastX: 0,
    lastY: 0,
  });

  // Right-Click Drag to Pan Screen
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      e.preventDefault();
      panStateRef.current = {
        isPanning: true,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current.isPanning) return;
    e.preventDefault();
    const deltaX = e.clientX - panStateRef.current.lastX;
    const deltaY = e.clientY - panStateRef.current.lastY;
    panStateRef.current.lastX = e.clientX;
    panStateRef.current.lastY = e.clientY;

    const vp = viewportRef.current;
    if (vp) {
      const prevScrollTop = vp.scrollTop;
      vp.scrollLeft -= deltaX;
      vp.scrollTop -= deltaY;

      // If viewport has no vertical overflow or reached boundary, pan window vertically
      const scrolledY = Math.abs(vp.scrollTop - prevScrollTop);
      if (scrolledY < 1 && (vp.scrollHeight <= vp.clientHeight || deltaY !== 0)) {
        window.scrollBy(-deltaX, -deltaY);
      }
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panStateRef.current.isPanning) {
      panStateRef.current.isPanning = false;
      setIsPanning(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  // Ctrl + Mouse Wheel Smooth Zoom
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 10 : -10;
        setZoom((prevZoom) => Math.max(100, Math.min(300, prevZoom + step)));
      }
    };

    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      vp.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Voice Dictation
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [dictationLang, setDictationLang] = useState<'ru-RU' | 'en-US'>(
    uiLang === 'en' ? 'en-US' : 'ru-RU'
  );
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const voiceControllerRef = useRef<VoiceDictationController | null>(null);

  // Sync dictationLang with uiLang
  useEffect(() => {
    setDictationLang(uiLang === 'en' ? 'en-US' : 'ru-RU');
  }, [uiLang]);

  // AI Micro-crop status
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  useEffect(() => {
    if (currentAsset?.blob) {
      const url = URL.createObjectURL(currentAsset.blob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [currentAsset]);

  // Voice Controller cleanup
  useEffect(() => {
    return () => {
      voiceControllerRef.current?.destroy();
      voiceControllerRef.current = null;
    };
  }, []);

  // Voice Dictation toggle
  const handleToggleVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      showStatus(
        uiLang === 'en'
          ? 'Web Speech API is not supported in this browser (Chrome or Edge recommended)'
          : 'Web Speech API не поддерживается текущим браузером (рекомендуется Chrome или Edge)'
      );
      return;
    }

    if (!voiceControllerRef.current) {
      const controller = new VoiceDictationController(dictationLang);
      controller.onTranscript = (transcript) => {
        setLiveTranscript(transcript);
      };
      controller.onParsedStep = (parsed: ParsedVoiceStep) => {
        const textVal =
          (dictationLang === 'en-US' ? parsed.en : parsed.ru) ||
          parsed.ru ||
          parsed.en ||
          '';
        onUpdateStep({
          act: parsed.act,
          ru: textVal,
          en: textVal,
          voiceDraft: parsed.rawTranscript,
        });
        showStatus(
          uiLang === 'en'
            ? `Voice recognized: ${textVal}`
            : `Голос распознан: ${textVal}`
        );
      };
      controller.onStateChange = (listening) => {
        setIsDictating(listening);
        if (!listening) {
          setLiveTranscript('');
        }
      };
      controller.onError = (err) => {
        console.warn('Voice error:', err);
        setIsDictating(false);
        showStatus(
          uiLang === 'en'
            ? 'Microphone or speech recognition error'
            : 'Ошибка микрофона или распознавания речи'
        );
      };
      voiceControllerRef.current = controller;
    }

    if (isDictating) {
      voiceControllerRef.current.stop();
    } else {
      voiceControllerRef.current.setLanguage(dictationLang);
      voiceControllerRef.current.start();
      showStatus(
        uiLang === 'en'
          ? `Listening (${dictationLang === 'ru-RU' ? 'RU' : 'EN'})... Speak your command (e.g. "Click Create")`
          : `Слушаю (${dictationLang === 'ru-RU' ? 'RU' : 'EN'})... Говорите команду (например: "Нажмите Создать")`
      );
    }
  };

  const handleToggleVoiceLang = () => {
    const nextLang = dictationLang === 'ru-RU' ? 'en-US' : 'ru-RU';
    setDictationLang(nextLang);
    if (voiceControllerRef.current) {
      voiceControllerRef.current.setLanguage(nextLang);
    }
  };

  // AI Micro-crop call
  const handleAiDescribe = async () => {
    const { apiKey, model } = getGeminiSettings();
    if (!apiKey || !apiKey.trim()) {
      onOpenAiModal();
      showStatus(
        uiLang === 'en'
          ? 'Please enter Gemini API key in AI settings'
          : 'Укажите ключ Gemini API в настройках ИИ'
      );
      return;
    }

    if (!currentAsset?.blob) {
      showStatus(
        uiLang === 'en'
          ? 'No screenshot asset image found for this step'
          : 'Для этого шага не найдено изображение кадра'
      );
      return;
    }

    setIsAiLoading(true);
    try {
      const result = await describeStepWithGeminiMicroCrop({
        apiKey,
        model,
        screenshotBlob: currentAsset.blob,
        step,
      });

      const textVal = uiLang === 'en' ? (result.en || result.ru) : (result.ru || result.en);
      onUpdateStep({
        ru: textVal,
        en: textVal,
        voiceDraft: result.buttonLabel
          ? `${uiLang === 'en' ? 'Element' : 'Элемент'}: ${result.buttonLabel}`
          : step.voiceDraft,
      });
      showStatus(
        uiLang === 'en'
          ? 'Caption written by AI'
          : 'Подпись написана ИИ'
      );
    } catch (err: unknown) {
      console.error(err);
      showStatus(
        uiLang === 'en'
          ? `AI error: ${err instanceof Error ? err.message : String(err)}`
          : `Ошибка ИИ: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // Privacy Box Add / Remove Handlers for InteractiveBoxEditor
  const handleAddBlurBox = async (newBox: BoxRect) => {
    if (!currentAsset) return;
    const nextBlur = [...(currentAsset.blurBoxes || []), newBox];
    await onUpdateScreenshot(currentAsset.id, { blurBoxes: nextBlur });
    showStatus(
      uiLang === 'en'
        ? 'Blur added to this screenshot'
        : 'Размытие добавлено на этот скриншот'
    );
  };

  const handleRemoveBlurBox = async (idx: number) => {
    if (!currentAsset) return;
    const nextBlur = (currentAsset.blurBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { blurBoxes: nextBlur });
    showStatus(uiLang === 'en' ? 'Step blur removed' : 'Локальное размытие удалено');
  };

  // Moving an existing area: without these handlers the move was never saved and the area jumped back
  const handleUpdateBlurBox = async (idx: number, nb: BoxRect) => {
    if (!currentAsset) return;
    const next = (currentAsset.blurBoxes || []).map((b, i) => (i === idx ? nb : b));
    await onUpdateScreenshot(currentAsset.id, { blurBoxes: next });
  };
  const handleUpdateMaskBox = async (idx: number, nb: BoxRect) => {
    if (!currentAsset) return;
    const next = (currentAsset.maskBoxes || []).map((b, i) => (i === idx ? nb : b));
    await onUpdateScreenshot(currentAsset.id, { maskBoxes: next });
  };
  const handleUpdateGlobalBlurBox = async (idx: number, nb: BoxRect) => {
    const next = (project.globalBlurBoxes || []).map((b, i) => (i === idx ? nb : b));
    await onUpdateProject({ globalBlurBoxes: next });
  };

  const handleAddGlobalBlurBox = async (newBox: BoxRect) => {
    const nextGlobal = [...(project.globalBlurBoxes || []), newBox];
    await onUpdateProject({ globalBlurBoxes: nextGlobal });
    showStatus(
      uiLang === 'en'
        ? 'Blur added to all screenshots'
        : 'Размытие добавлено на все скриншоты'
    );
  };

  const handleRemoveGlobalBlurBox = async (idx: number) => {
    const nextGlobal = (project.globalBlurBoxes || []).filter((_, i) => i !== idx);
    await onUpdateProject({ globalBlurBoxes: nextGlobal });
    showStatus(uiLang === 'en' ? 'Global blur removed' : 'Сквозное размытие удалено');
  };

  const handleAddMaskBox = async (newBox: BoxRect) => {
    if (!currentAsset) return;
    const nextMasks = [...(currentAsset.maskBoxes || []), newBox];
    await onUpdateScreenshot(currentAsset.id, { maskBoxes: nextMasks });
    showStatus(
      uiLang === 'en'
        ? 'Patch added to this screenshot'
        : 'Заплатка добавлена на этот скриншот'
    );
  };

  const handleRemoveMaskBox = async (idx: number) => {
    if (!currentAsset) return;
    const nextMasks = (currentAsset.maskBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { maskBoxes: nextMasks });
    showStatus(uiLang === 'en' ? 'Mask removed' : 'Маска удалена');
  };

  const captionValue = uiLang === 'en' ? step.en || step.ru || '' : step.ru || step.en || '';
  const frameBlurCount = (currentAsset?.blurBoxes?.length || 0) + (currentAsset?.maskBoxes?.length || 0);
  const globalBlurCount = project.globalBlurBoxes?.length || 0;

  const actionOptions: { act: ActionType; en: string; ru: string }[] = [
    { act: 'click', en: 'Click', ru: 'Нажать' },
    { act: 'type', en: 'Type', ru: 'Ввести' },
    { act: 'select', en: 'Select', ru: 'Выбрать' },
    { act: 'drag', en: 'Drag', ru: 'Перетащить' },
    { act: 'scroll', en: 'Scroll', ru: 'Прокрутить' },
    { act: 'look', en: 'Look', ru: 'Посмотреть' },
  ];

  // Change the action. Rewrite the caption only if it is still empty or a ready-made template,
  // so a caption the teacher typed by hand is never overwritten.
  const handleSelectAction = (nextAct: ActionType) => {
    if (nextAct === step.act) return;
    const match = captionValue.match(/<b>(.*?)<\/b>/i);
    const targetName = match ? match[1] : '';
    const currentTpl = formatActionInstruction(step.act, targetName);
    const isTemplate =
      !captionValue.trim() ||
      captionValue === currentTpl.en ||
      captionValue === currentTpl.ru ||
      captionValue === 'Click on the highlighted element' ||
      captionValue === 'Нажмите на выделенный элемент';
    if (isTemplate) {
      const formatted = formatActionInstruction(nextAct, targetName);
      const val = uiLang === 'en' ? formatted.en : formatted.ru;
      onUpdateStep({ act: nextAct, ru: val, en: val });
    } else {
      onUpdateStep({ act: nextAct });
    }
  };

  const drawModeLabels: Record<Exclude<EditorDrawTool, 'target'>, { en: string; ru: string }> = {
    blur: { en: 'Blur on this screenshot', ru: 'Размытие на этом скриншоте' },
    globalBlur: { en: 'Blur on all screenshots', ru: 'Размытие на всех скриншотах' },
    mask: { en: 'Solid patch', ru: 'Сплошная заплатка' },
  };

  const toolButtonClass = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium text-left border transition ${
      active
        ? 'bg-teal-700 text-white border-teal-700'
        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
      {/* ===== Left: canvas ===== */}
      <div className="flex-1 min-w-0 space-y-2">
        {drawMode !== 'target' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-600 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            <span>
              <b>{uiLang === 'en' ? drawModeLabels[drawMode].en : drawModeLabels[drawMode].ru}:</b>{' '}
              {uiLang === 'en'
                ? 'drag on the picture to draw an area. Click an area to move it, or its x to remove it.'
                : 'протяните мышью по картинке, чтобы нарисовать область. Область можно сдвинуть или удалить крестиком.'}
            </span>
            <button
              type="button"
              onClick={() => setDrawMode('target')}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm"
            >
              {uiLang === 'en' ? 'Done' : 'Готово'}
            </button>
          </div>
        )}

        {/* Visual Canvas stage with InteractiveBoxEditor, Right-Click Pan and Ctrl+Wheel zoom */}
        <div
          ref={viewportRef}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={handleViewportPointerUp}
          onLostPointerCapture={handleViewportPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative w-full border border-slate-300 dark:border-slate-700 rounded-xl overflow-auto bg-slate-900 dark:bg-slate-950 select-none max-h-[calc(100vh-14rem)] ${
            isPanning ? 'cursor-grabbing' : ''
          }`}
          style={{ touchAction: 'none' }}
        >
          <div
            className="relative transition-[width] duration-150 shrink-0"
            style={{
              width: zoom > 100 ? `${zoom}%` : '100%',
              minWidth: '100%',
            }}
          >
            {imageUrl ? (
              <InteractiveBoxEditor
                imageUrl={imageUrl}
                box={step.box}
                cursorPos={step.cursorPos || computeDefaultCursorPos(step.box)}
                onChangeBoxAndCursor={(newBox, newCursorPos) => {
                  onUpdateStep({ box: newBox, cursorPos: newCursorPos });
                }}
                stepNumber={stepIndex + 1}
                actionType={step.act}
                drawMode={drawMode}
                blurBoxes={currentAsset?.blurBoxes}
                globalBlurBoxes={project.globalBlurBoxes}
                maskBoxes={currentAsset?.maskBoxes}
                onAddBlurBox={handleAddBlurBox}
                onRemoveBlurBox={handleRemoveBlurBox}
                onUpdateBlurBox={handleUpdateBlurBox}
                onAddGlobalBlurBox={handleAddGlobalBlurBox}
                onRemoveGlobalBlurBox={handleRemoveGlobalBlurBox}
                onUpdateGlobalBlurBox={handleUpdateGlobalBlurBox}
                onAddMaskBox={handleAddMaskBox}
                onRemoveMaskBox={handleRemoveMaskBox}
                onUpdateMaskBox={handleUpdateMaskBox}
                uiLang={uiLang}
              />
            ) : (
              <div className="py-24 text-center text-slate-300 text-sm">
                {uiLang === 'en' ? 'This step has no screenshot' : 'У этого шага нет скриншота'}
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {uiLang === 'en'
            ? 'Drag the red box onto the button the student should use. Drag its corners to resize. Drag the small arrow off the text.'
            : 'Перетащите красную рамку на нужную кнопку. Тяните за углы, чтобы изменить размер. Стрелку сдвиньте с текста.'}
        </p>
      </div>

      {/* ===== Right: what to do + caption + navigation ===== */}
      <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-900 dark:text-slate-100">
            {uiLang === 'en'
              ? `Step ${stepIndex + 1} of ${project.steps.length}`
              : `Шаг ${stepIndex + 1} из ${project.steps.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              data-testid="undo-btn"
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 text-slate-800 dark:text-slate-200 transition"
              title={uiLang === 'en' ? 'Undo (Ctrl+Z)' : 'Отменить (Ctrl+Z)'}
            >
              <Undo2 className="w-4 h-4" />
              <span>{uiLang === 'en' ? 'Undo' : 'Отменить'}</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              data-testid="redo-btn"
              className="p-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-800 dark:text-slate-200 transition"
              title={uiLang === 'en' ? 'Redo (Ctrl+Y)' : 'Повторить (Ctrl+Y)'}
              aria-label={uiLang === 'en' ? 'Redo' : 'Повторить'}
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectStepIndex && onSelectStepIndex(stepIndex - 1)}
              disabled={stepIndex === 0 || !onSelectStepIndex}
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 text-slate-800 dark:text-slate-200 transition"
              title={uiLang === 'en' ? 'Previous step' : 'Предыдущий шаг'}
            >
              <ChevronLeft className="w-4 h-4" />
              {uiLang === 'en' ? 'Back' : 'Назад'}
            </button>
            <button
              type="button"
              onClick={() => onSelectStepIndex && onSelectStepIndex(stepIndex + 1)}
              disabled={stepIndex >= project.steps.length - 1 || !onSelectStepIndex}
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition"
              title={uiLang === 'en' ? 'Next step' : 'Следующий шаг'}
            >
              {uiLang === 'en' ? 'Next' : 'Далее'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action type */}
        <div>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
            {uiLang === 'en' ? 'What the student does' : 'Что делает студент'}
          </span>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
            {actionOptions.map((o) => (
              <button
                key={o.act}
                type="button"
                role="radio"
                aria-checked={step.act === o.act}
                onClick={() => handleSelectAction(o.act)}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium border transition ${
                  step.act === o.act
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {uiLang === 'en' ? o.en : o.ru}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div>
          <label
            htmlFor="step-caption"
            className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
          >
            {uiLang === 'en' ? 'Caption for the student' : 'Подпись для студента'}
          </label>
          <textarea
            id="step-caption"
            rows={4}
            value={captionValue}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateStep({ en: val, ru: val });
            }}
            placeholder={
              uiLang === 'en'
                ? 'For example: Click <b>New item</b> at the top left.'
                : 'Например: Нажмите <b>Создать</b> в левом верхнем углу.'
            }
            className="w-full text-base p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 focus:outline-none leading-relaxed"
          />
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {uiLang === 'en'
              ? 'Tip: put a button name between <b> and </b> to make it bold.'
              : 'Совет: название кнопки между <b> и </b> станет жирным.'}
          </p>

          {/* Voice dictation */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border transition ${
                isDictating
                  ? 'bg-red-600 border-red-600 text-white animate-pulse'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                uiLang === 'en'
                  ? 'Say the action and the button name, for example "Click Create"'
                  : 'Скажите действие и название кнопки, например «Нажмите Создать»'
              }
            >
              {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isDictating
                ? uiLang === 'en'
                  ? 'Stop dictation'
                  : 'Остановить диктовку'
                : uiLang === 'en'
                ? 'Dictate caption'
                : 'Надиктовать подпись'}
            </button>
            <button
              type="button"
              onClick={handleToggleVoiceLang}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title={uiLang === 'en' ? 'Dictation language' : 'Язык диктовки'}
            >
              {dictationLang === 'ru-RU' ? 'RU' : 'EN'}
            </button>
          </div>
          {isDictating && liveTranscript && (
            <div className="mt-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2 rounded-lg text-sm text-red-800 dark:text-red-200">
              <span className="font-semibold">{uiLang === 'en' ? 'Hearing: ' : 'Слышу: '}</span>
              <span className="italic">{liveTranscript}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSwitchTab && onSwitchTab('player')}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold border border-teal-700 dark:border-teal-500 text-teal-900 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center justify-center gap-2 transition"
        >
          <Play className="w-4 h-4" />
          {uiLang === 'en' ? 'Preview and download the guide' : 'Просмотреть и скачать гайд'}
        </button>

        {/* ===== Privacy & more tools (collapsible, remembered) ===== */}
        <div className="rounded-xl border border-slate-300 dark:border-slate-600">
          <button
            type="button"
            onClick={toggleMoreTools}
            aria-expanded={isMoreOpen}
            className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition"
          >
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-700 dark:text-teal-300" />
              {uiLang === 'en' ? 'Blur and more tools' : 'Размытие и другие инструменты'}
              {frameBlurCount + globalBlurCount > 0 && (
                <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs px-1.5 py-0.5 rounded-full">
                  {frameBlurCount + globalBlurCount}
                </span>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 transition ${isMoreOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMoreOpen && (
            <div className="px-3 pb-3 space-y-4 border-t border-slate-200 dark:border-slate-700 pt-3">
              {/* Privacy */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {uiLang === 'en' ? 'Hide private data' : 'Скрыть личные данные'}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {uiLang === 'en'
                    ? 'Choose a tool, then drag on the picture. Blur appears only in the guide for students.'
                    : 'Выберите инструмент и протяните мышью по картинке. Размытие видно только в гайде для студентов.'}
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button type="button" onClick={() => setDrawMode('blur')} className={toolButtonClass(drawMode === 'blur')}>
                    {uiLang === 'en' ? drawModeLabels.blur.en : drawModeLabels.blur.ru}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawMode('globalBlur')}
                    className={toolButtonClass(drawMode === 'globalBlur')}
                  >
                    {uiLang === 'en' ? drawModeLabels.globalBlur.en : drawModeLabels.globalBlur.ru}
                    {globalBlurCount > 0 ? ` (${globalBlurCount})` : ''}
                  </button>
                  <button type="button" onClick={() => setDrawMode('mask')} className={toolButtonClass(drawMode === 'mask')}>
                    <Square className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                    {uiLang === 'en' ? drawModeLabels.mask.en : drawModeLabels.mask.ru}
                  </button>
                </div>
                {currentAsset && frameBlurCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onUpdateScreenshot(currentAsset.id, { blurBoxes: [], maskBoxes: [] });
                      showStatus(
                        uiLang === 'en'
                          ? 'Blur and patches removed from this screenshot'
                          : 'Размытие и заплатки убраны с этого скриншота'
                      );
                    }}
                    className="text-sm font-medium text-red-700 dark:text-red-300 hover:underline flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    {uiLang === 'en'
                      ? `Remove blur from this screenshot (${frameBlurCount})`
                      : `Убрать размытие с этого скриншота (${frameBlurCount})`}
                  </button>
                )}
                <label className="flex items-start gap-2 cursor-pointer select-none text-sm text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={!!step.keepBlur}
                    onChange={(e) => onUpdateStep({ keepBlur: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    {uiLang === 'en'
                      ? 'Keep the red box area blurred too (normally it stays sharp)'
                      : 'Размывать и область красной рамки (обычно она остаётся чёткой)'}
                  </span>
                </label>
              </section>

              {/* AI */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {uiLang === 'en' ? 'AI caption' : 'Подпись с ИИ'}
                </h4>
                <button
                  type="button"
                  onClick={handleAiDescribe}
                  disabled={isAiLoading}
                  className="w-full px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition"
                  title={
                    uiLang === 'en'
                      ? 'Reads the button inside the red box and writes a caption (needs a Gemini key)'
                      : 'Читает кнопку в красной рамке и пишет подпись (нужен ключ Gemini)'
                  }
                >
                  {isAiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isAiLoading
                    ? uiLang === 'en'
                      ? 'Writing...'
                      : 'Пишу...'
                    : uiLang === 'en'
                    ? 'Write caption with AI'
                    : 'Написать подпись с ИИ'}
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {uiLang === 'en'
                    ? 'Key, blur presets and captions for all steps: "Privacy & AI" at the top.'
                    : 'Ключ, шаблоны размытия и подписи для всех шагов: «Приватность и ИИ» вверху.'}
                </p>
              </section>

              {/* Zoom */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {uiLang === 'en' ? 'Zoom' : 'Масштаб'}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(100, z - 25))}
                    disabled={zoom <= 100}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                    title={uiLang === 'en' ? 'Zoom out' : 'Уменьшить'}
                    aria-label={uiLang === 'en' ? 'Zoom out' : 'Уменьшить'}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="w-14 text-center text-sm font-semibold text-slate-800 dark:text-slate-200">{zoom}%</span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(300, z + 25))}
                    disabled={zoom >= 300}
                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                    title={uiLang === 'en' ? 'Zoom in' : 'Увеличить'}
                    aria-label={uiLang === 'en' ? 'Zoom in' : 'Увеличить'}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  {zoom !== 100 && (
                    <button
                      type="button"
                      onClick={() => setZoom(100)}
                      className="text-sm font-medium text-teal-800 dark:text-teal-300 hover:underline"
                    >
                      {uiLang === 'en' ? 'Fit' : 'Вписать'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {uiLang === 'en'
                    ? 'Also: Ctrl + mouse wheel. Hold the right mouse button to move the picture.'
                    : 'Также: Ctrl + колесо мыши. Зажмите правую кнопку мыши, чтобы двигать картинку.'}
                </p>
              </section>

              {/* Step details */}
              <section className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {uiLang === 'en' ? 'Step details' : 'Детали шага'}
                </h4>
                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  {uiLang === 'en' ? 'Section title (shown in the contents)' : 'Название раздела (для оглавления)'}
                  <input
                    type="text"
                    value={step.chapterTitle || ''}
                    onChange={(e) => onUpdateStep({ chapterTitle: e.target.value })}
                    placeholder={uiLang === 'en' ? 'For example: 1. Connect data' : 'Например: 1. Подключение данных'}
                    className="mt-1 w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  {uiLang === 'en' ? 'Screenshot for this step' : 'Скриншот для этого шага'}
                  <select
                    value={step.screenshotId}
                    onChange={(e) => onUpdateStep({ screenshotId: e.target.value })}
                    className="mt-1 w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {screenshots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                  {uiLang === 'en' ? 'Box' : 'Рамка'}: {step.box.x}%, {step.box.y}%, {step.box.w}% x {step.box.h}%
                  {step.cursorPos ? ` · ${uiLang === 'en' ? 'Pointer' : 'Курсор'}: ${step.cursorPos.x}%, ${step.cursorPos.y}%` : ''}
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Live Player Preview Component.
 */
function LivePlayerPreview({
  project,
  screenshots,
  uiLang = 'en',
}: {
  project: GuideProject;
  screenshots: ScreenshotAsset[];
  uiLang?: 'en' | 'ru';
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [lang, setLang] = useState<'ru' | 'en'>(
    project.defaultLang || (uiLang === 'en' ? 'en' : 'ru')
  );
  const [trainerMode, setTrainerMode] = useState<boolean>(true);

  if (project.steps.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-xs">
        {uiLang === 'en' ? 'No steps in this guide' : 'В проекте нет шагов'}
      </div>
    );
  }

  const s = project.steps[currentStepIdx] || project.steps[0];
  const asset = screenshots.find((a) => a.id === s.screenshotId);
  const shotUrl = asset?.blob ? URL.createObjectURL(asset.blob) : '';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 max-w-4xl mx-auto shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {uiLang === 'en'
              ? `Step ${currentStepIdx + 1} of ${project.steps.length}`
              : `Шаг ${currentStepIdx + 1} из ${project.steps.length}`}
          </span>
          {s.chapterTitle && (
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-teal-600 dark:text-teal-400 font-semibold px-2 py-0.5 rounded">
              {s.chapterTitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTrainerMode(!trainerMode)}
            className={`text-xs px-2.5 py-1 rounded font-medium border ${
              trainerMode
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {trainerMode
              ? uiLang === 'en'
                ? '🎯 Simulator: On'
                : '🎯 Тренажёр: Вкл'
              : uiLang === 'en'
              ? 'Browse: On'
              : 'Обзор: Вкл'}
          </button>

          <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-xs">
            <button
              onClick={() => setLang('ru')}
              className={`px-2 py-0.5 font-bold ${
                lang === 'ru' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-800'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-0.5 font-bold ${
                lang === 'en' ? 'bg-teal-600 text-white' : 'bg-white dark:bg-slate-800'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Screen Box */}
      <div className="relative border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden bg-black select-none">
        {shotUrl ? (
          <img src={shotUrl} alt="" className="w-full h-auto block" />
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            {uiLang === 'en' ? 'No frame image' : 'Нет кадра'}
          </div>
        )}

        {/* Global Blur Boxes */}
        {project.globalBlurBoxes?.map((b, i) => (
          <div
            key={`pb_g_${i}`}
            className="absolute border border-purple-500/50 bg-purple-500/20 backdrop-blur-md pointer-events-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          />
        ))}

        {/* Step Blur Boxes */}
        {asset?.blurBoxes?.map((b, i) => (
          <div
            key={`pb_b_${i}`}
            className="absolute border border-amber-500/50 bg-amber-500/20 backdrop-blur-md pointer-events-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          />
        ))}

        {/* Mask Boxes */}
        {asset?.maskBoxes?.map((b, i) => (
          <div
            key={`pb_m_${i}`}
            className="absolute bg-slate-950 pointer-events-none z-10"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
            }}
          />
        ))}

        {/* Pulsing Highlight Box */}
        <div
          onClick={() => {
            if (trainerMode) {
              setCurrentStepIdx((idx) => (idx === project.steps.length - 1 ? 0 : idx + 1));
            }
          }}
          className="absolute border-2 border-red-500 rounded cursor-pointer animate-pulse transition hover:border-teal-400 z-15"
          style={{
            left: `${s.box.x}%`,
            top: `${s.box.y}%`,
            width: `${s.box.w}%`,
            height: `${s.box.h}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
          }}
          title={
            trainerMode
              ? uiLang === 'en'
                ? 'Click here to proceed to the next step'
                : 'Кликните сюда для перехода к следующему шагу'
              : ''
          }
        />

        {/* SVG Cursor Pointer with accurate cursorPos */}
        {(() => {
          const curX =
            s.cursorPos && typeof s.cursorPos.x === 'number'
              ? s.cursorPos.x
              : s.box.x + s.box.w * 0.96;
          const curY =
            s.cursorPos && typeof s.cursorPos.y === 'number'
              ? s.cursorPos.y
              : s.box.y + s.box.h * 0.92;

          return (
            <div
              className="absolute pointer-events-none transition-all duration-300 ease-out z-20"
              style={{
                left: `${curX}%`,
                top: `${curY}%`,
                transform: 'translate(-16.67%, -8.33%)',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-7 h-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] filter animate-pulse"
                aria-hidden="true"
              >
                <path
                  d="M4 2l15 9.5-6.5 1.6 3.7 6.9-3 1.6-3.7-6.9L4.5 19z"
                  fill="#ffffff"
                  stroke="#111111"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          );
        })()}
      </div>

      {/* Panel */}
      <div className="mt-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-4 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
          {currentStepIdx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full inline-block mb-1">
            {s.act}
          </span>
          <p
            className="text-sm font-medium text-slate-800 dark:text-slate-100"
            dangerouslySetInnerHTML={{
              __html: (lang === 'en' ? s.en || s.ru : s.ru || s.en) || '',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
          disabled={currentStepIdx === 0}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-30"
        >
          {uiLang === 'en' ? '← Back' : '← Назад'}
        </button>

        <div className="flex gap-1.5 flex-wrap justify-center">
          {project.steps.map((_, k) => (
            <button
              key={k}
              onClick={() => setCurrentStepIdx(k)}
              className={`w-2.5 h-2.5 rounded-full transition ${
                k === currentStepIdx
                  ? 'bg-teal-600 scale-125'
                  : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() =>
            setCurrentStepIdx((i) => (i === project.steps.length - 1 ? 0 : i + 1))
          }
          className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
        >
          {currentStepIdx === project.steps.length - 1
            ? uiLang === 'en'
              ? 'Restart'
              : 'Сначала'
            : uiLang === 'en'
            ? 'Next →'
            : 'Далее →'}
        </button>
      </div>
    </div>
  );
}
