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
  X,
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
import { AiAndPrivacyModal } from './components/editor/AiAndPrivacyModal';
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
type EditorDrawTool = 'target' | 'step_blur' | 'global_blur' | 'mask';

export default function App() {
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
      const newProj = await createProject({
        titleRu: 'Новый интерактивный гайд',
        titleEn: 'New Interactive Guide',
        pageTitle: 'Interactive Guide',
      });
      await loadProjects();
      setActiveProjectId(newProj.id);
      setActiveTab('capture');
      showStatus('Проект успешно создан!');
    } catch (err) {
      console.error(err);
      showStatus('Не удалось создать проект');
    }
  }

  async function handleCreateDemo() {
    try {
      setIsLoading(true);
      const demo = await createDemoProject();
      await loadProjects();
      setActiveProjectId(demo.id);
      setActiveTab('player');
      showStatus('Демо-гайд с встроенными скриншотами создан!');
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при создании демо-проекта');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить этот проект и все его скриншоты?')) return;
    try {
      await deleteProject(id);
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
      await loadProjects();
      showStatus('Проект удалён');
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при удалении проекта');
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
      showStatus(`Импортирован проект "${imported.titleRu}" (${imported.steps.length} шагов)`);
    } catch (err: unknown) {
      console.error(err);
      showStatus(`Ошибка импорта: ${err instanceof Error ? err.message : String(err)}`);
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
      showStatus(`Добавлено скриншотов: ${files.length}`);
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при загрузке скриншота');
    } finally {
      setIsLoading(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }
  }

  // Step Management
  function handleAddStep(screenshotId?: string) {
    if (!activeProject) return;
    const targetShotId = screenshotId || screenshots[0]?.id || '';
    const newStep: GuideStep = {
      id: generateId(),
      screenshotId: targetShotId,
      act: 'click',
      box: { x: 30, y: 30, w: 25, h: 12 },
      en: 'Next step description',
      ru: 'Описание следующего шага',
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
      showStatus(`Файл ${a.download} успешно сформирован и скачан!`);
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при генерации HTML');
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
      showStatus('Файл steps.json успешно выгружен!');
    } catch (err) {
      console.error(err);
      showStatus('Ошибка при экспорте steps.json');
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
              Guide Creation Tool
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Универсальный конструктор интерактивных руководств и тренажёров
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {activeProject && (
            <>
              {/* Prominent Privacy & AI Assistant button in header */}
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-sm transition"
                title="Настройка глобального размытия и ИИ-генерация текстов"
              >
                <Shield className="w-3.5 h-3.5 text-teal-200" />
                <span>🛡️ Приватность и ✨ ИИ-помощник</span>
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
                <ArrowLeft className="w-3.5 h-3.5" /> Все гайды
              </button>
            </>
          )}

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title="Переключить тему"
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
                <h2 className="text-2xl font-bold mb-2">Создание интерактивных гайдов</h2>
                <p className="text-teal-100 max-w-2xl text-sm leading-relaxed">
                  Создавайте кликабельные интерактивные руководства и тренажёры из серии
                  скриншотов и живого экрана. Экспортируйте в полностью автономный одиночный HTML-файл с поддержкой
                  переключения RU/EN, сквозного размытия конфиденциальных данных и режима тренажёра.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleCreateNewProject}
                  className="bg-white text-teal-800 hover:bg-teal-50 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow transition"
                >
                  <Plus className="w-4 h-4 text-teal-600" /> Новый гайд
                </button>

                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="bg-teal-900/60 hover:bg-teal-900 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 border border-teal-500/30 transition"
                >
                  <FolderDown className="w-4 h-4" /> Импорт папки (steps.json)
                </button>

                <button
                  onClick={handleCreateDemo}
                  className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" /> Загрузить демо-гайд
                </button>
              </div>
            </div>

            {/* Projects Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Ваши проекты ({projects.length})
                </h3>
              </div>

              {isLoading && projects.length === 0 ? (
                <div className="text-center py-12 text-slate-500">Загрузка проектов...</div>
              ) : projects.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
                  <FileCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h4 className="text-base font-semibold mb-1">Пока нет созданных гайдов</h4>
                  <p className="text-sm text-slate-500 mb-5">
                    Создайте новый проект с нуля или импортируйте существующую папку со steps.json
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleCreateDemo}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                    >
                      Создать демонстрационный гайд
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
                            {proj.titleRu || proj.titleEn}
                          </h4>
                          <button
                            onClick={(e) => handleDeleteProject(proj.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                            title="Удалить проект"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                          {proj.subRu || proj.subEn}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-teal-600" />
                          {proj.steps.length} {proj.steps.length === 1 ? 'шаг' : 'шагов'}
                        </span>
                        <span>{new Date(proj.updatedAt).toLocaleDateString()}</span>
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
                  value={activeProject.titleRu}
                  onChange={(e) => {
                    const titleRu = e.target.value;
                    setActiveProject({ ...activeProject, titleRu });
                    updateProject(activeProject.id, { titleRu });
                  }}
                  placeholder="Заголовок гайда (RU)"
                  className="font-bold text-lg bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-teal-500 focus:outline-none w-full text-slate-800 dark:text-slate-100 transition"
                />
                <input
                  type="text"
                  value={activeProject.subRu}
                  onChange={(e) => {
                    const subRu = e.target.value;
                    setActiveProject({ ...activeProject, subRu });
                    updateProject(activeProject.id, { subRu });
                  }}
                  placeholder="Подзаголовок (RU)"
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
                  <Video className="w-3.5 h-3.5" /> 1. Запись ({screenshots.length})
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'editor'
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" /> 2. Редактор ({activeProject.steps.length})
                </button>
                <button
                  onClick={() => setActiveTab('player')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'player'
                      ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" /> 3. Плеер и Экспорт
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
              />
            )}

            {/* Tab 2: Visual Step Editor */}
            {activeTab === 'editor' && (
              <div className="space-y-4">
                {/* Secondary toolbar for Editor Tab */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Редактирование шагов:
                    </span>
                    <span>{activeProject.steps.length} шагов, {screenshots.length} кадров</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAiModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-sm transition"
                    >
                      <Shield className="w-3.5 h-3.5 text-teal-200" />
                      <span>🛡️ Приватность и ✨ ИИ-помощник</span>
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
                        Шаги ({activeProject.steps.length})
                      </h3>
                      <button
                        onClick={() => handleAddStep()}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Добавить
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {activeProject.steps.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs">
                          Нет шагов. Перейдите во вкладку «1. Запись» для захвата экрана или нажмите «+ Добавить».
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
                                    {st.ru || st.en || '(без текста)'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'up', e)}
                                  disabled={idx === 0}
                                  className="p-1 hover:text-teal-600 disabled:opacity-20"
                                  title="Переместить вверх"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleMoveStep(idx, 'down', e)}
                                  disabled={idx === activeProject.steps.length - 1}
                                  className="p-1 hover:text-teal-600 disabled:opacity-20"
                                  title="Переместить вниз"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteStep(idx, e)}
                                  className="p-1 hover:text-red-500"
                                  title="Удалить шаг"
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
                      />
                    ) : (
                      <div className="text-center py-20 text-slate-400">
                        Выберите или создайте шаг для редактирования
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
                  <h3 className="font-bold text-base mb-1">Экспорт руководства</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Выберите формат выгрузки: автономный однофайловый HTML с встроенными картинками
                    или steps.json.
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
                          Автономный HTML со всеми применёнными масками и размытием конфиденциальных
                          зон. Идеален для публичной ссылки.
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-200">
                        Рекомендуется для публикации →
                      </span>
                    </button>

                    <button
                      onClick={() => handleExportHtml(false)}
                      className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">guide.html (Полный)</span>
                          <Download className="w-4 h-4 group-hover:translate-y-0.5 transition" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Автономный HTML без размытия, с исходным качеством скриншотов. Для
                          внутреннего использования.
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                        Скачать без блюра →
                      </span>
                    </button>

                    <button
                      onClick={handleExportJson}
                      className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 p-4 rounded-xl text-left transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm">steps.json (Совместимость)</span>
                          <FileCode className="w-4 h-4 group-hover:translate-y-0.5 transition" />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          100% совместимый JSON для Python-скрипта build_guide.py с координатами в
                          пикселях от display_width: 2000.
                        </p>
                      </div>
                      <span className="mt-3 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                        Выгрузить steps.json →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Embedded Live Player Preview */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4 text-teal-600" /> Живой интерактивный просмотр
                  </h4>
                  <LivePlayerPreview project={activeProject} screenshots={screenshots} />
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
        />
      )}
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
}) {
  const currentAsset = screenshots.find((s) => s.id === step.screenshotId) || screenshots[0];
  const [imageUrl, setImageUrl] = useState<string>('');
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // Active mouse drawing tool
  const [drawTool, setDrawTool] = useState<EditorDrawTool>('target');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoxRect | null>(null);

  // Voice Dictation
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [dictationLang, setDictationLang] = useState<'ru-RU' | 'en-US'>('ru-RU');
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const voiceControllerRef = useRef<VoiceDictationController | null>(null);

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
      showStatus('Web Speech API не поддерживается текущим браузером (рекомендуется Chrome или Edge)');
      return;
    }

    if (!voiceControllerRef.current) {
      const controller = new VoiceDictationController(dictationLang);
      controller.onTranscript = (transcript) => {
        setLiveTranscript(transcript);
      };
      controller.onParsedStep = (parsed: ParsedVoiceStep) => {
        onUpdateStep({
          act: parsed.act,
          ru: parsed.ru,
          en: parsed.en,
          voiceDraft: parsed.rawTranscript,
        });
        showStatus(`Голос распознан: ${parsed.ru}`);
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
        showStatus('Ошибка микрофона или распознавания речи');
      };
      voiceControllerRef.current = controller;
    }

    if (isDictating) {
      voiceControllerRef.current.stop();
    } else {
      voiceControllerRef.current.setLanguage(dictationLang);
      voiceControllerRef.current.start();
      showStatus(`Слушаю (${dictationLang === 'ru-RU' ? 'RU' : 'EN'})... Говорите команду (например: "Нажмите Создать")`);
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
      showStatus('Укажите ключ Gemini API в настройках ИИ');
      return;
    }

    if (!currentAsset?.blob) {
      showStatus('Для этого шага не найдено изображение кадра');
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

      onUpdateStep({
        ru: result.ru,
        en: result.en,
        voiceDraft: result.buttonLabel ? `Элемент: ${result.buttonLabel}` : step.voiceDraft,
      });
      showStatus('✨ Описание успешно сгенерировано по микро-кропу!');
    } catch (err: unknown) {
      console.error(err);
      showStatus(`Ошибка ИИ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Mouse drag handlers on image canvas
  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0 || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentBox({ x, y, w: 0, h: 0 });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isDrawing || !startPoint || !imgContainerRef.current) return;
    const rect = imgContainerRef.current.getBoundingClientRect();
    const curX = ((e.clientX - rect.left) / rect.width) * 100;
    const curY = ((e.clientY - rect.top) / rect.height) * 100;

    const left = Math.max(0, Math.min(100, Math.min(startPoint.x, curX)));
    const top = Math.max(0, Math.min(100, Math.min(startPoint.y, curY)));
    const width = Math.max(0.5, Math.min(100 - left, Math.abs(curX - startPoint.x)));
    const height = Math.max(0.5, Math.min(100 - top, Math.abs(curY - startPoint.y)));

    const newRect: BoxRect = {
      x: Number(left.toFixed(2)),
      y: Number(top.toFixed(2)),
      w: Number(width.toFixed(2)),
      h: Number(height.toFixed(2)),
    };

    setCurrentBox(newRect);

    // If drawing target box, update live
    if (drawTool === 'target') {
      onUpdateStep({ box: newRect });
    }
  }

  async function handleMouseUp() {
    if (!isDrawing || !currentBox) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentBox(null);
      return;
    }

    const finalBox = { ...currentBox };
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentBox(null);

    // Ignore tiny accidental clicks
    if (finalBox.w < 1 || finalBox.h < 1) return;

    if (drawTool === 'target') {
      onUpdateStep({ box: finalBox });
      showStatus('Рамка шага обновлена');
    } else if (drawTool === 'step_blur') {
      if (currentAsset) {
        const nextBlur = [...(currentAsset.blurBoxes || []), finalBox];
        await onUpdateScreenshot(currentAsset.id, { blurBoxes: nextBlur });
        showStatus('🌫 Добавлено локальное размытие на этом кадре');
      }
    } else if (drawTool === 'global_blur') {
      const nextGlobal = [...(project.globalBlurBoxes || []), finalBox];
      await onUpdateProject({ globalBlurBoxes: nextGlobal });
      showStatus('📌 Добавлено сквозное размытие на все кадры');
    } else if (drawTool === 'mask') {
      if (currentAsset) {
        const nextMasks = [...(currentAsset.maskBoxes || []), finalBox];
        await onUpdateScreenshot(currentAsset.id, { maskBoxes: nextMasks });
        showStatus('🎨 Добавлена маска-плашка на этом кадре');
      }
    }
  }

  // Delete handlers for privacy boxes
  const handleDeleteStepBlur = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentAsset) return;
    const nextBlur = (currentAsset.blurBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { blurBoxes: nextBlur });
    showStatus('Локальное размытие удалено');
  };

  const handleDeleteGlobalBlur = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextGlobal = (project.globalBlurBoxes || []).filter((_, i) => i !== idx);
    await onUpdateProject({ globalBlurBoxes: nextGlobal });
    showStatus('Сквозное размытие удалено');
  };

  const handleDeleteMask = async (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentAsset) return;
    const nextMasks = (currentAsset.maskBoxes || []).filter((_, i) => i !== idx);
    await onUpdateScreenshot(currentAsset.id, { maskBoxes: nextMasks });
    showStatus('Маска удалена');
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
              title="Нажмите, чтобы продиктовать голосом действие и название кнопки"
            >
              {isDictating ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isDictating ? '🔴 Идёт запись...' : '🎤 Диктовать голосом'}</span>
            </button>
            <button
              onClick={handleToggleVoiceLang}
              className="px-2 py-1.5 text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 border-l border-slate-200 dark:border-slate-600 transition"
              title="Переключить язык распознавания (RU / EN)"
            >
              {dictationLang === 'ru-RU' ? 'RU' : 'EN'}
            </button>
          </div>

          {/* AI Micro-Crop Button */}
          <button
            onClick={handleAiDescribe}
            disabled={isAiLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white shadow-xs transition disabled:opacity-50"
            title="Автоматически определить надпись на кнопке в рамке и сгенерировать описания RU/EN"
          >
            {isAiLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>{isAiLoading ? 'ИИ думает...' : '✨ Авто-описание по микро-кропу'}</span>
          </button>
        </div>

        {/* Global Privacy Modal shortcut */}
        <button
          onClick={onOpenAiModal}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Сквозные пресеты и пакетный ИИ →</span>
        </button>
      </div>

      {/* Live Voice Dictation Transcript Pill */}
      {isDictating && liveTranscript && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2 animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
          <span className="font-semibold shrink-0">Распознаётся:</span>
          <span className="italic truncate">{liveTranscript}</span>
        </div>
      )}

      {/* Step Metadata Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Действие (Act)</label>
          <select
            value={step.act}
            onChange={(e) => onUpdateStep({ act: e.target.value as ActionType })}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold"
          >
            <option value="click">click (Нажать)</option>
            <option value="type">type (Ввести)</option>
            <option value="drag">drag (Протянуть)</option>
            <option value="select">select (Выбрать)</option>
            <option value="scroll">scroll (Прокрутить)</option>
            <option value="look">look (Обратить внимание)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Скриншот</label>
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
            Название раздела / главы (Оглавление)
          </label>
          <input
            type="text"
            value={step.chapterTitle || ''}
            onChange={(e) => onUpdateStep({ chapterTitle: e.target.value })}
            placeholder="например: 1. Подключение источника"
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Canvas Tool Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-slate-600 dark:text-slate-400 mr-1 text-[11px]">
            Инструмент мыши на холсте:
          </span>

          <button
            type="button"
            onClick={() => setDrawTool('target')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawTool === 'target'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>🔴 Рамка шага (Target Box)</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawTool('step_blur')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawTool === 'step_blur'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>🌫 Блюр на этом кадре (Step Blur)</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawTool('global_blur')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawTool === 'global_blur'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>📌 Сквозной блюр на все кадры</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawTool('mask')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              drawTool === 'mask'
                ? 'bg-slate-800 text-white border border-slate-600 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Square className="w-3 h-3 text-slate-400" />
            <span>🎨 Маска-ластик (Mask)</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>Сквозных: {project.globalBlurBoxes?.length || 0}</span>
          <span>•</span>
          <span>Кадр: {(currentAsset?.blurBoxes?.length || 0) + (currentAsset?.maskBoxes?.length || 0)}</span>
        </div>
      </div>

      {/* Visual Canvas stage */}
      <div className="relative border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
        {imageUrl ? (
          <div
            ref={imgContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full cursor-crosshair select-none"
          >
            <img src={imageUrl} alt="" className="w-full h-auto block pointer-events-none" />

            {/* Step Highlight Target Box */}
            <div
              className="absolute border-2 border-red-500 rounded bg-red-500/20 pointer-events-none shadow-sm transition-all"
              style={{
                left: `${step.box.x}%`,
                top: `${step.box.y}%`,
                width: `${step.box.w}%`,
                height: `${step.box.h}%`,
              }}
            >
              <span className="absolute -top-5 left-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {stepIndex + 1}. {step.act}
              </span>
            </div>

            {/* Display Global Blur Boxes (applied to all frames) */}
            {project.globalBlurBoxes?.map((b, i) => (
              <div
                key={`global_${i}`}
                className="absolute border border-purple-400 bg-purple-500/25 backdrop-blur-sm group select-none"
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.w}%`,
                  height: `${b.h}%`,
                }}
              >
                <span className="text-[9px] bg-purple-600 text-white font-semibold px-1 rounded absolute top-0 left-0">
                  📌 сквозной
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteGlobalBlur(i, e)}
                  className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 opacity-80 hover:opacity-100 transition shadow"
                  title="Удалить этот сквозной блюр"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            {/* Display Screenshot-specific Blur Boxes */}
            {currentAsset?.blurBoxes?.map((b, i) => (
              <div
                key={`step_blur_${i}`}
                className="absolute border border-amber-400 bg-amber-400/25 backdrop-blur-sm group select-none"
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.w}%`,
                  height: `${b.h}%`,
                }}
              >
                <span className="text-[9px] bg-amber-500 text-black font-semibold px-1 rounded absolute top-0 left-0">
                  🌫 кадр
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteStepBlur(i, e)}
                  className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 opacity-80 hover:opacity-100 transition shadow"
                  title="Удалить это локальное размытие"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            {/* Display Screenshot-specific Mask Boxes */}
            {currentAsset?.maskBoxes?.map((b, i) => (
              <div
                key={`mask_${i}`}
                className="absolute border border-slate-500 bg-slate-900 group select-none"
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${b.w}%`,
                  height: `${b.h}%`,
                }}
              >
                <span className="text-[9px] bg-slate-700 text-white px-1 rounded absolute top-0 left-0">
                  🎨 маска
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteMask(i, e)}
                  className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 opacity-80 hover:opacity-100 transition shadow"
                  title="Удалить эту маску"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}

            {/* In-progress drawing preview box */}
            {isDrawing && currentBox && drawTool !== 'target' && (
              <div
                className={`absolute pointer-events-none border-2 border-dashed ${
                  drawTool === 'step_blur'
                    ? 'border-amber-400 bg-amber-400/20 backdrop-blur-sm'
                    : drawTool === 'global_blur'
                    ? 'border-purple-400 bg-purple-500/20 backdrop-blur-sm'
                    : 'border-slate-300 bg-slate-900/80'
                }`}
                style={{
                  left: `${currentBox.x}%`,
                  top: `${currentBox.y}%`,
                  width: `${currentBox.w}%`,
                  height: `${currentBox.h}%`,
                }}
              />
            )}
          </div>
        ) : (
          <div className="py-24 text-slate-500 text-xs">Нет привязанного изображения</div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        💡 Зажмите и потяните мышь по скриншоту выше, чтобы применить выбранный инструмент (
        {drawTool === 'target'
          ? '🔴 Рамка шага'
          : drawTool === 'step_blur'
          ? '🌫 Локальный блюр'
          : drawTool === 'global_blur'
          ? '📌 Сквозной блюр'
          : '🎨 Маска-плашка'}
        ).
      </p>

      {/* Russian and English texts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Инструкция на русском (RU)
          </label>
          <textarea
            rows={3}
            value={step.ru}
            onChange={(e) => onUpdateStep({ ru: e.target.value })}
            placeholder="Нажмите <b>+ Создать</b> для добавления элемента..."
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Instruction in English (EN)
          </label>
          <textarea
            rows={3}
            value={step.en}
            onChange={(e) => onUpdateStep({ en: e.target.value })}
            placeholder="Click <b>+ New</b> to add a new item..."
            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
          />
        </div>
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
            Не вырезать из блюра (keepBlur — оставить размытие поверх этой зоны)
          </span>
        </label>

        <span className="text-slate-400 font-mono text-[11px]">
          Рамка: [{step.box.x}%, {step.box.y}%, {step.box.w}%, {step.box.h}%]
        </span>
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
}: {
  project: GuideProject;
  screenshots: ScreenshotAsset[];
}) {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [lang, setLang] = useState<'ru' | 'en'>(project.defaultLang || 'ru');
  const [trainerMode, setTrainerMode] = useState<boolean>(true);

  if (project.steps.length === 0) {
    return <div className="text-center py-12 text-slate-500 text-xs">В проекте нет шагов</div>;
  }

  const s = project.steps[currentStepIdx] || project.steps[0];
  const asset = screenshots.find((a) => a.id === s.screenshotId);
  const shotUrl = asset?.blob ? URL.createObjectURL(asset.blob) : '';

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 max-w-4xl mx-auto shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Шаг {currentStepIdx + 1} из {project.steps.length}
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
            {trainerMode ? '🎯 Тренажёр: Вкл' : 'Обзор: Вкл'}
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
          <div className="h-64 flex items-center justify-center text-slate-500">Нет кадра</div>
        )}

        {/* Pulsing Highlight Box */}
        <div
          onClick={() => {
            if (trainerMode) {
              setCurrentStepIdx((idx) => (idx === project.steps.length - 1 ? 0 : idx + 1));
            }
          }}
          className="absolute border-2 border-red-500 rounded cursor-pointer animate-pulse transition hover:border-teal-400"
          style={{
            left: `${s.box.x}%`,
            top: `${s.box.y}%`,
            width: `${s.box.w}%`,
            height: `${s.box.h}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
          }}
          title={trainerMode ? 'Кликните сюда для перехода к следующему шагу' : ''}
        />
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
            dangerouslySetInnerHTML={{ __html: s[lang] || s.ru || s.en || '' }}
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
          ← Назад
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
          {currentStepIdx === project.steps.length - 1 ? 'Сначала' : 'Далее →'}
        </button>
      </div>
    </div>
  );
}
