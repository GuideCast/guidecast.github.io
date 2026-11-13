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
  Sparkles,
  ChevronUp,
  ChevronDown,
  Sun,
  Moon,
  FileCode,
  Shield,
  Mic,
  MicOff,
  Square,
  Wand2,
  RefreshCw,
} from 'lucide-react';

import type { ActionType, BoxRect, GuideProject, GuideStep, ScreenshotAsset } from './types/guide';
import {
  addScreenshot,
  createDemoProject,
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
} from './services/importerExporter';
import { LiveCaptureWorkspace } from './components/capture/LiveCaptureWorkspace';
import {
  InteractiveBoxEditor,
  computeDefaultCursorPos,
} from './components/common/InteractiveBoxEditor';
import { AiAndPrivacyModal } from './components/editor/AiAndPrivacyModal';
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
  type ParsedVoiceStep,
} from './services/speechService';

type ActiveTab = 'capture' | 'editor' | 'player';
type EditorDrawTool = 'target' | 'blur' | 'globalBlur' | 'mask';

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>(() => getSavedUiLang());
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => !hasSeenWelcomeTour());
  const [projects, setProjects] = useState<GuideProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<GuideProject | null>(null);
  const [screenshots, setScreenshots] = useState<ScreenshotAsset[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Folder import input ref
  const folderInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // Load project list on mount
  useEffect(() => {
    loadProjects();
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
      setActiveTab('player');
      showStatus(
        uiLang === 'en'
          ? 'Demo guide created with pre-configured screenshots!'
          : 'Демо-гайд с встроенными скриншотами создан!'
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

  // Add Screenshots from disk
  async function handleScreenshotsUploaded(e: React.ChangeEvent<HTMLInputElement>) {
    if (!activeProject || !e.target.files) return;
    const files = Array.from(e.target.files);
    try {
      setIsLoading(true);
      const newAssets: ScreenshotAsset[] = [];
      for (const f of files) {
        const asset = await addScreenshot(activeProject.id, f, f.name);
        newAssets.push(asset);
      }
      const updatedList = await getScreenshotsForProject(activeProject.id);
      setScreenshots(updatedList);
      showStatus(
        uiLang === 'en'
          ? `Added ${files.length} screenshots`
          : `Добавлено скриншотов: ${files.length}`
      );
    } catch (err) {
      console.error(err);
      showStatus(uiLang === 'en' ? 'Error uploading screenshots' : 'Ошибка при загрузке скриншота');
    } finally {
      setIsLoading(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }
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

  function handleUpdateCurrentStep(updates: Partial<GuideStep>) {
    if (!activeProject || !activeProject.steps[selectedStepIndex]) return;
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors">
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

      {/* Hidden Screenshot Picker */}
      <input
        type="file"
        ref={screenshotInputRef}
        onChange={handleScreenshotsUploaded}
        multiple
        accept="image/*"
        className="hidden"
      />

      {/* Status banner */}
      {statusMessage && (
        <div className="fixed top-4 right-4 z-50 bg-teal-600 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow">
            G
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100">
              {UI_TEXT[uiLang].header.appName}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {UI_TEXT[uiLang].header.tagline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeProject && (
            <>
              {/* Prominent Privacy & AI Assistant button in header */}
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-sm transition"
                title={
                  uiLang === 'en'
                    ? 'Global blur presets and AI instruction generator'
                    : 'Настройка глобального размытия и ИИ-генерация текстов'
                }
              >
                <Shield className="w-3.5 h-3.5 text-teal-200" />
                <span>
                  {uiLang === 'en' ? '🛡️ Privacy & ✨ AI Assistant' : '🛡️ Приватность и ✨ ИИ-помощник'}
                </span>
                {activeProject.globalBlurBoxes && activeProject.globalBlurBoxes.length > 0 && (
                  <span className="bg-white/25 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
                    {activeProject.globalBlurBoxes.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveProjectId(null)}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {UI_TEXT[uiLang].tabs.backToDashboard}
              </button>
            </>
          )}

          {/* How to Use Modal Trigger */}
          <button
            onClick={() => setIsWelcomeOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-2xs"
            title={
              uiLang === 'en'
                ? 'Open Interactive Welcome Guide & Tips'
                : 'Открыть интерактивный тур и подсказки'
            }
          >
            <span>❓</span>
            <span>{uiLang === 'en' ? 'How to Use' : 'Как пользоваться'}</span>
          </button>

          {/* UI Language Switcher: EN | RU */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold shadow-2xs">
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
            onClick={() => setIsDarkMode(!isDarkMode)}
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
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto">
        {!activeProject ? (
          /* ================= DASHBOARD VIEW ================= */
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-700 to-cyan-800 text-white p-8 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {UI_TEXT[uiLang].dashboard.title}
                </h2>
                <p className="text-teal-100 max-w-2xl text-sm leading-relaxed">
                  {UI_TEXT[uiLang].dashboard.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCreateNewProject}
                  className="bg-white text-teal-800 hover:bg-teal-50 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow transition"
                >
                  <Plus className="w-4 h-4 text-teal-600" />
                  {UI_TEXT[uiLang].dashboard.createGuide}
                </button>

                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="bg-teal-900/60 hover:bg-teal-900 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 border border-teal-500/30 transition"
                >
                  <FolderDown className="w-4 h-4" />
                  {UI_TEXT[uiLang].dashboard.importFolder}
                </button>

                <button
                  onClick={handleCreateDemo}
                  className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  {UI_TEXT[uiLang].dashboard.createDemo}
                </button>
              </div>
            </div>

            {/* Projects Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {uiLang === 'en'
                    ? `Your Guides (${projects.length})`
                    : `Ваши проекты (${projects.length})`}
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
                  <p className="text-sm text-slate-500 mb-5 max-w-lg mx-auto">
                    {UI_TEXT[uiLang].dashboard.noProjectsDesc}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleCreateDemo}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
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
                        setActiveTab('editor');
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
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                          {uiLang === 'en' ? proj.subEn || proj.subRu : proj.subRu || proj.subEn}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
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
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex-1">
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
                  placeholder={uiLang === 'en' ? 'Guide Title' : 'Заголовок гайда'}
                  className="font-bold text-lg bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-teal-500 focus:outline-none w-full text-slate-800 dark:text-slate-100 transition"
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
                  placeholder={uiLang === 'en' ? 'Subtitle (optional)' : 'Подзаголовок (опционально)'}
                  className="text-xs text-slate-500 dark:text-slate-400 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-teal-500 focus:outline-none w-full transition"
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setActiveTab('capture')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'capture'
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  {uiLang === 'en'
                    ? `1. Capture (${screenshots.length})`
                    : `1. Запись (${screenshots.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'editor'
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {uiLang === 'en'
                    ? `2. Editor (${activeProject.steps.length})`
                    : `2. Редактор (${activeProject.steps.length})`}
                </button>
                <button
                  onClick={() => setActiveTab('player')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'player'
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  {uiLang === 'en' ? '3. Player & Export' : '3. Плеер и Экспорт'}
                </button>
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
                  }
                  setActiveTab('editor');
                }}
                uiLang={uiLang}
              />
            )}

            {/* Tab 2: Visual Step Editor */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                {/* Secondary toolbar for Editor Tab */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {uiLang === 'en' ? 'Step Editing:' : 'Редактирование шагов:'}
                    </span>
                    <span>
                      {uiLang === 'en'
                        ? `${activeProject.steps.length} steps, ${screenshots.length} frames`
                        : `${activeProject.steps.length} шагов, ${screenshots.length} кадров`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAiModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-sm transition"
                    >
                      <Shield className="w-3.5 h-3.5 text-teal-200" />
                      <span>
                        {uiLang === 'en'
                          ? '🛡️ Privacy & ✨ AI Assistant'
                          : '🛡️ Приватность и ✨ ИИ-помощник'}
                      </span>
                      {activeProject.globalBlurBoxes && activeProject.globalBlurBoxes.length > 0 && (
                        <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                          {activeProject.globalBlurBoxes.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
                  {/* Left: Step list */}
                  <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col h-[780px]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {uiLang === 'en'
                          ? `Steps (${activeProject.steps.length})`
                          : `Шаги (${activeProject.steps.length})`}
                      </h3>
                      <button
                        onClick={() => handleAddStep()}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {uiLang === 'en' ? 'Add' : 'Добавить'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {activeProject.steps.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          {uiLang === 'en'
                            ? 'No steps yet. Go to "1. Capture" tab to record your screen or click "+ Add".'
                            : 'Нет шагов. Перейдите во вкладку «1. Запись» для захвата экрана или нажмите «+ Добавить».'}
                        </div>
                      ) : (
                        activeProject.steps.map((st, idx) => {
                          const isSelected = idx === selectedStepIndex;
                          return (
                            <div
                              key={st.id}
                              onClick={() => setSelectedStepIndex(idx)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between gap-2 ${
                                isSelected
                                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-slate-900 dark:text-slate-100 shadow-sm'
                                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span
                                  className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                    isSelected
                                      ? 'bg-teal-600 text-white'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  {st.chapterTitle && (
                                    <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 block truncate">
                                      {st.chapterTitle}
                                    </span>
                                  )}
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mb-1">
                                    {st.act}
                                  </span>
                                  <p className="truncate text-slate-700 dark:text-slate-300">
                                    {uiLang === 'en'
                                      ? st.en || st.ru || '(no text)'
                                      : st.ru || st.en || '(без текста)'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'up', e)}
                                  disabled={idx === 0}
                                  className="p-1 hover:text-teal-600 disabled:opacity-20"
                                  title={uiLang === 'en' ? 'Move Up' : 'Переместить вверх'}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'down', e)}
                                  disabled={idx === activeProject.steps.length - 1}
                                  className="p-1 hover:text-teal-600 disabled:opacity-20"
                                  title={uiLang === 'en' ? 'Move Down' : 'Переместить вниз'}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteStep(idx, e)}
                                  className="p-1 hover:text-red-500"
                                  title={uiLang === 'en' ? 'Delete Step' : 'Удалить шаг'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Step details and Interactive Stage */}
                  <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col space-y-4">
                    {activeProject.steps[selectedStepIndex] ? (
                      <StepEditorPanel
                        project={activeProject}
                        step={activeProject.steps[selectedStepIndex]}
                        stepIndex={selectedStepIndex}
                        screenshots={screenshots}
                        onUpdateStep={handleUpdateCurrentStep}
                        onUpdateProject={handleUpdateProject}
                        onUpdateScreenshot={handleUpdateScreenshot}
                        onOpenAiModal={() => setIsAiModalOpen(true)}
                        showStatus={showStatus}
                        uiLang={uiLang}
                      />
                    ) : (
                      <div className="text-center py-20 text-slate-400">
                        {uiLang === 'en'
                          ? 'Select or create a step to edit'
                          : 'Выберите или создайте шаг для редактирования'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Interactive Live Preview Player & Export */}
            {activeTab === 'player' && (
              <div className="space-y-6">
                {/* Export Options Banner */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-base mb-1">
                    {uiLang === 'en' ? 'Export Guide' : 'Экспорт руководства'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {uiLang === 'en'
                      ? 'Choose export format: standalone single-file HTML with embedded assets or steps.json.'
                      : 'Выберите формат выгрузки: автономный однофайловый HTML с встроенными картинками или steps.json.'}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleExportHtml(true)}
                      className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-xl text-left shadow transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">guide-public.html</span>
                          <Download className="w-4 h-4 group-hover:translate-y-0.5 transition" />
                        </div>
                        <p className="text-xs text-teal-100">
                          {uiLang === 'en'
                            ? 'Standalone HTML with all privacy masks and blur areas applied. Ideal for sharing publicly.'
                            : 'Автономный HTML со всеми применёнными масками и размытием конфиденциальных зон. Идеален для публичной ссылки.'}
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-200">
                        {uiLang === 'en'
                          ? 'Recommended for publishing →'
                          : 'Рекомендуется для публикации →'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleExportHtml(false)}
                      className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">
                            guide.html ({uiLang === 'en' ? 'Full' : 'Полный'})
                          </span>
                          <Download className="w-4 h-4 group-hover:translate-y-0.5 transition" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {uiLang === 'en'
                            ? 'Autonomous HTML without blur, in original screenshot quality. For internal use.'
                            : 'Автономный HTML без размытия, с исходным качеством скриншотов. Для внутреннего использования.'}
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                        {uiLang === 'en' ? 'Download without blur →' : 'Скачать без блюра →'}
                      </span>
                    </button>

                    <button
                      onClick={handleExportJson}
                      className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">
                            steps.json ({uiLang === 'en' ? 'Compatibility' : 'Совместимость'})
                          </span>
                          <FileCode className="w-4 h-4 group-hover:translate-y-0.5 transition" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {uiLang === 'en'
                            ? '100% compatible JSON for Python script build_guide.py with coordinates based on display_width: 2000.'
                            : '100% совместимый JSON для Python-скрипта build_guide.py с координатами в пикселях от display_width: 2000.'}
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                        {uiLang === 'en' ? 'Export steps.json →' : 'Выгрузить steps.json →'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Embedded Live Player Preview */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4 text-teal-600" />
                    {uiLang === 'en' ? 'Live Interactive Simulator Preview' : 'Живой интерактивный просмотр'}
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
}: {
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
}) {
  const currentAsset = screenshots.find((s) => s.id === step.screenshotId) || screenshots[0];
  const [imageUrl, setImageUrl] = useState<string>('');

  // Active mouse drawing tool for InteractiveBoxEditor
  const [drawMode, setDrawMode] = useState<EditorDrawTool>('target');

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
          ? '✨ Description generated via micro-crop!'
          : '✨ Описание успешно сгенерировано по микро-кропу!'
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
        ? '🌫 Step blur added to this frame'
        : '🌫 Добавлено локальное размытие на этом кадре'
    );
  };

  const handleRemoveBlurBox = async (idx: number) => {
    if (!currentAsset) return;
    const nextBlur = (currentAsset.blurBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { blurBoxes: nextBlur });
    showStatus(uiLang === 'en' ? 'Step blur removed' : 'Локальное размытие удалено');
  };

  const handleAddGlobalBlurBox = async (newBox: BoxRect) => {
    const nextGlobal = [...(project.globalBlurBoxes || []), newBox];
    await onUpdateProject({ globalBlurBoxes: nextGlobal });
    showStatus(
      uiLang === 'en'
        ? '📌 Global blur added across all frames'
        : '📌 Добавлено сквозное размытие на все кадры'
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
        ? '🎨 Mask patch added to this frame'
        : '🎨 Добавлена маска-плашка на этом кадре'
    );
  };

  const handleRemoveMaskBox = async (idx: number) => {
    if (!currentAsset) return;
    const nextMasks = (currentAsset.maskBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { maskBoxes: nextMasks });
    showStatus(uiLang === 'en' ? 'Mask removed' : 'Маска удалена');
  };

  return (
    <div className="space-y-4">
      {/* Top Action Ribbon: Voice Dictation + AI Micro-Crop + Privacy Modal Trigger */}
      <div className="bg-slate-50 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Voice Dictation Button */}
          <div className="inline-flex rounded-lg shadow-xs overflow-hidden border border-slate-300 dark:border-slate-700">
            <button
              onClick={handleToggleVoice}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                isDictating
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title={
                uiLang === 'en'
                  ? 'Click to dictate step action and button name with your voice'
                  : 'Нажмите, чтобы продиктовать голосом действие и название кнопки'
              }
            >
              {isDictating ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>
                {isDictating
                  ? uiLang === 'en'
                    ? '🔴 Recording...'
                    : '🔴 Идёт запись...'
                  : uiLang === 'en'
                  ? '🎤 Voice Dictate'
                  : '🎤 Диктовать голосом'}
              </span>
            </button>
            <button
              onClick={handleToggleVoiceLang}
              className="px-2 py-1.5 text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 border-l border-slate-200 dark:border-slate-600 transition"
              title={
                uiLang === 'en'
                  ? 'Toggle voice recognition language (RU / EN)'
                  : 'Переключить язык распознавания (RU / EN)'
              }
            >
              {dictationLang === 'ru-RU' ? 'RU' : 'EN'}
            </button>
          </div>

          {/* AI Micro-Crop Button */}
          <button
            onClick={handleAiDescribe}
            disabled={isAiLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-xs transition disabled:opacity-50"
            title={
              uiLang === 'en'
                ? 'Automatically detect button text in box and generate bilingual descriptions'
                : 'Автоматически определить надпись на кнопке в рамке и сгенерировать описания RU/EN'
            }
          >
            {isAiLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>
              {isAiLoading
                ? uiLang === 'en'
                  ? 'AI thinking...'
                  : 'ИИ думает...'
                : uiLang === 'en'
                ? '✨ Describe Micro-Crop'
                : '✨ Авто-описание по микро-кропу'}
            </span>
          </button>
        </div>

        {/* Global Privacy Modal shortcut */}
        <button
          onClick={onOpenAiModal}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {uiLang === 'en'
              ? 'Global Presets & Batch AI →'
              : 'Сквозные пресеты и пакетный ИИ →'}
          </span>
        </button>
      </div>

      {/* Live Voice Dictation Transcript Pill */}
      {isDictating && liveTranscript && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
          <span className="font-semibold shrink-0">
            {uiLang === 'en' ? 'Recognizing:' : 'Распознаётся:'}
          </span>
          <span className="italic truncate">{liveTranscript}</span>
        </div>
      )}

      {/* Step Metadata Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            {uiLang === 'en' ? 'Action Type (Act)' : 'Действие (Act)'}
          </label>
          <select
            value={step.act}
            onChange={(e) => onUpdateStep({ act: e.target.value as ActionType })}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold"
          >
            <option value="click">click ({uiLang === 'en' ? 'Click' : 'Нажать'})</option>
            <option value="type">type ({uiLang === 'en' ? 'Type' : 'Ввести'})</option>
            <option value="drag">drag ({uiLang === 'en' ? 'Drag' : 'Протянуть'})</option>
            <option value="select">select ({uiLang === 'en' ? 'Select' : 'Выбрать'})</option>
            <option value="scroll">scroll ({uiLang === 'en' ? 'Scroll' : 'Прокрутить'})</option>
            <option value="look">look ({uiLang === 'en' ? 'Notice' : 'Обратить внимание'})</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            {uiLang === 'en' ? 'Screenshot' : 'Скриншот'}
          </label>
          <select
            value={step.screenshotId}
            onChange={(e) => onUpdateStep({ screenshotId: e.target.value })}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 truncate"
          >
            {screenshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.filename}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            {uiLang === 'en'
              ? 'Chapter / Step Subtitle (TOC)'
              : 'Название раздела / главы (Оглавление)'}
          </label>
          <input
            type="text"
            value={step.chapterTitle || ''}
            onChange={(e) => onUpdateStep({ chapterTitle: e.target.value })}
            placeholder={
              uiLang === 'en'
                ? 'e.g. 1. Connect Data Source'
                : 'например: 1. Подключение источника'
            }
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Canvas Tool Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400 mr-1 text-[11px]">
            {uiLang === 'en' ? 'Mouse drawing tool:' : 'Инструмент мыши на холсте:'}
          </span>

          <button
            type="button"
            onClick={() => setDrawMode('target')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawMode === 'target'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>{uiLang === 'en' ? '🔴 Target Box' : '🔴 Рамка шага'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawMode('blur')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawMode === 'blur'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{uiLang === 'en' ? '🌫 Step Blur' : '🌫 Локальный блюр'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawMode('globalBlur')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawMode === 'globalBlur'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>{uiLang === 'en' ? '📌 Global Blur' : '📌 Сквозной блюр'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawMode('mask')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawMode === 'mask'
                ? 'bg-slate-800 text-white border border-slate-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Square className="w-3 h-3 text-slate-400" />
            <span>{uiLang === 'en' ? '🎨 Mask Patch' : '🎨 Маска-ластик'}</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>
            {uiLang === 'en' ? 'Global:' : 'Сквозных:'} {project.globalBlurBoxes?.length || 0}
          </span>
          <span>•</span>
          <span>
            {uiLang === 'en' ? 'Frame:' : 'Кадр:'}{' '}
            {(currentAsset?.blurBoxes?.length || 0) + (currentAsset?.maskBoxes?.length || 0)}
          </span>
        </div>
      </div>

      {/* Visual Canvas stage with InteractiveBoxEditor */}
      <div className="relative border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center min-h-[340px]">
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
            onAddGlobalBlurBox={handleAddGlobalBlurBox}
            onRemoveGlobalBlurBox={handleRemoveGlobalBlurBox}
            onAddMaskBox={handleAddMaskBox}
            onRemoveMaskBox={handleRemoveMaskBox}
            uiLang={uiLang}
          />
        ) : (
          <div className="py-24 text-slate-500 text-xs">
            {uiLang === 'en' ? 'No attached image' : 'Нет привязанного изображения'}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        {uiLang === 'en'
          ? '💡 Drag red box to move, pull any of the 8 handles to resize, or drag the ↖ mouse pointer so it never covers button text.'
          : '💡 Перетаскивайте рамку целиком, тяните за 8 маркеров по краям для изменения размера, или сдвиньте ↖ указатель мыши, чтобы он не закрывал буквы.'}
      </p>

      {/* Single Unified Instruction field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            {uiLang === 'en' ? 'Instruction' : 'Инструкция'}
          </label>
          <span className="text-[10px] text-slate-400">
            {uiLang === 'en'
              ? 'Supports <b>bold</b> for button names'
              : 'Поддерживает <b>жирный</b> для названий кнопок'}
          </span>
        </div>
        <textarea
          rows={3}
          value={uiLang === 'en' ? (step.en || step.ru || '') : (step.ru || step.en || '')}
          onChange={(e) => {
            const val = e.target.value;
            onUpdateStep({ en: val, ru: val });
          }}
          placeholder={
            uiLang === 'en'
              ? 'Click <b>+ New</b> to add a new item...'
              : 'Нажмите <b>+ Создать</b> для добавления элемента...'
          }
          className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-normal focus:ring-2 focus:ring-teal-500 focus:outline-none transition leading-relaxed"
        />
      </div>

      {/* Additional options */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!step.keepBlur}
            onChange={(e) => onUpdateStep({ keepBlur: e.target.checked })}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-slate-700 dark:text-slate-300">
            {uiLang === 'en'
              ? 'Keep blur active during this step (do not uncover target element from blur)'
              : 'Не вырезать из блюра (keepBlur — оставить размытие поверх этой зоны)'}
          </span>
        </label>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span>
            {uiLang === 'en' ? 'Box' : 'Рамка'}: [{step.box.x}%, {step.box.y}%, {step.box.w}%, {step.box.h}%]
          </span>
          {step.cursorPos && (
            <span>
              {uiLang === 'en' ? 'Cursor' : 'Курсор'}: [{step.cursorPos.x}%, {step.cursorPos.y}%]
            </span>
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
