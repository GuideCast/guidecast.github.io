import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shield,
  Sparkles,
  Copy,
  Check,
  Key,
  Layers,
  AlertCircle,
  Trash2,
  RefreshCw,
  Zap,
  ExternalLink,
  Wand2,
  Lock,
  Eye,
  Sliders,
} from 'lucide-react';

import type { GuideProject, GuideStep, ScreenshotAsset, ActionType } from '../../types/guide';
import {
  UNIVERSAL_BLUR_PRESETS,
  isPresetActive,
  togglePreset,
  generateBatchPromptForFreeAi,
  applyBatchAiJsonToSteps,
  cropStepTargetImage,
  getGeminiSettings,
  saveGeminiSettings,
  describeStepWithGeminiMicroCrop,
  buildSmartCaptionFromLabel,
  DEFAULT_GEMINI_MODEL,
  type BlurPresetItem,
} from '../../services/aiAssistantService';

export interface AiAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: GuideProject;
  screenshots: ScreenshotAsset[];
  activeStep?: GuideStep;
  onUpdateProject: (updates: Partial<GuideProject>) => Promise<void>;
  uiLang?: 'en' | 'ru';
}

type ModalTab = 'privacy' | 'batch-ai' | 'gemini-crop';

export const AiAndPrivacyModal: React.FC<AiAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  project,
  screenshots,
  activeStep,
  onUpdateProject,
  uiLang = 'en',
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('privacy');

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fadeIn">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {uiLang === 'en' ? 'Privacy & AI' : 'Приватность и ИИ'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {uiLang === 'en'
                  ? 'Blur the same area on every screenshot, and get help writing captions'
                  : 'Размытие одной и той же области на всех скриншотах и помощь с подписями'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={uiLang === 'en' ? 'Close (Esc)' : 'Закрыть (Esc)'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 px-6 pt-2 gap-2 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'privacy'
                ? 'border-teal-600 text-teal-800 dark:text-teal-300 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            {uiLang === 'en' ? '1. Privacy: blur on all screenshots' : '1. Приватность: размытие на всех скриншотах'}
          </button>

          <button
            onClick={() => setActiveTab('batch-ai')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'batch-ai'
                ? 'border-teal-600 text-teal-800 dark:text-teal-300 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            {uiLang === 'en' ? '2. Captions for all steps (no key)' : '2. Подписи для всех шагов (без ключа)'}
          </button>

          <button
            onClick={() => setActiveTab('gemini-crop')}
            className={`pb-2.5 px-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'gemini-crop'
                ? 'border-teal-600 text-teal-800 dark:text-teal-300 font-bold'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            {uiLang === 'en' ? '3. AI captions (your own Gemini key)' : '3. Подписи с ИИ (ваш ключ Gemini)'}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'privacy' && (
            <PrivacyAndBlurTab project={project} onUpdateProject={onUpdateProject} uiLang={uiLang} />
          )}

          {activeTab === 'batch-ai' && (
            <BatchAiTab project={project} onUpdateProject={onUpdateProject} uiLang={uiLang} />
          )}

          {activeTab === 'gemini-crop' && (
            <GeminiMicroCropTab
              project={project}
              screenshots={screenshots}
              initialActiveStep={activeStep}
              onUpdateProject={onUpdateProject}
              uiLang={uiLang}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAndPrivacyModal;

/* =========================================================================
   TAB 1: Privacy & Universal Blur Presets
   ========================================================================= */

function PrivacyAndBlurTab({
  project,
  onUpdateProject,
  uiLang = 'en',
}: {
  project: GuideProject;
  onUpdateProject: (updates: Partial<GuideProject>) => Promise<void>;
  uiLang?: 'en' | 'ru';
}) {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const globalBoxes = project.globalBlurBoxes || [];

  function showNotification(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3500);
  }

  async function handleTogglePreset(preset: BlurPresetItem) {
    const updatedBoxes = togglePreset(globalBoxes, preset.box);
    await onUpdateProject({ globalBlurBoxes: updatedBoxes });
    const isNowActive = isPresetActive(updatedBoxes, preset.box);
    const pName = uiLang === 'en' ? preset.nameEn : preset.nameRu;
    showNotification(
      uiLang === 'en'
        ? (isNowActive ? `Preset enabled: "${pName}"` : `Preset disabled: "${pName}"`)
        : (isNowActive ? `Включен пресет: "${pName}"` : `Отключен пресет: "${pName}"`)
    );
  }

  async function handleEnableRecommended() {
    // Recommended bundle: top-right profile email + left narrow nav bar
    const p1 = UNIVERSAL_BLUR_PRESETS.find((p) => p.id === 'top-right-profile');
    const p2 = UNIVERSAL_BLUR_PRESETS.find((p) => p.id === 'left-nav-narrow');

    let current = [...globalBoxes];
    if (p1 && !isPresetActive(current, p1.box)) current = [...current, { ...p1.box }];
    if (p2 && !isPresetActive(current, p2.box)) current = [...current, { ...p2.box }];

    await onUpdateProject({ globalBlurBoxes: current });
    showNotification(
      uiLang === 'en'
        ? 'Recommended presets enabled!'
        : 'Рекомендуемый набор пресетов успешно включен!'
    );
  }

  async function handleClearAll() {
    if (globalBoxes.length === 0) return;
    if (
      !confirm(
        uiLang === 'en'
          ? 'Clear all global blur zones?'
          : 'Очистить все глобальные области размытия?'
      )
    )
      return;
    await onUpdateProject({ globalBlurBoxes: [] });
    showNotification(
      uiLang === 'en'
        ? 'All global blur zones removed.'
        : 'Все глобальные области размытия удалены.'
    );
  }

  async function handleRemoveBox(idx: number) {
    const nextBoxes = globalBoxes.filter((_, i) => i !== idx);
    await onUpdateProject({ globalBlurBoxes: nextBoxes });
  }

  return (
    <div className="space-y-6">
      {/* Smart Carve-out Info Banner */}
      <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-teal-900 dark:text-teal-200">
        <Shield className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">
            {uiLang === 'en' ? 'Smart Box Carve-out active: ' : 'Умное вычитание рамок активно: '}
          </span>
          {uiLang === 'en'
            ? 'If a red target box overlaps with a blurred zone on any step, the player automatically cuts a crisp transparent window around the interactive button! Sensitive data on the rest of the screen stays securely hidden.'
            : 'если на каком-то шаге руководства красная рамка попадает на заблюренную панель, программа автоматически вырежет чёткое окошко вокруг нужной кнопки! Конфиденциальные данные на остальных частях экрана останутся надёжно скрыты.'}
        </div>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Preset Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            {uiLang === 'en' ? 'Universal Privacy Presets' : 'Универсальные пресеты приватности'}
          </h3>
          <p className="text-xs text-slate-500">
            {uiLang === 'en'
              ? 'Templates for typical web apps, cloud consoles, and desktop software'
              : 'Шаблоны для типовых интерфейсов веб-сервисов, облачных панелей и десктопных приложений'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEnableRecommended}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium shadow-sm transition flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            {uiLang === 'en'
              ? 'Enable Recommended (Profile + Menu)'
              : 'Включить рекомендуемый набор (Профиль + Меню)'}
          </button>

          {globalBoxes.length > 0 && (
            <button
              onClick={handleClearAll}
              className="border border-slate-300 dark:border-slate-700 hover:border-red-400 text-slate-600 dark:text-slate-300 hover:text-red-500 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {uiLang === 'en' ? 'Clear All' : 'Очистить все'}
            </button>
          )}
        </div>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {UNIVERSAL_BLUR_PRESETS.map((preset) => {
          const active = isPresetActive(globalBoxes, preset.box);
          return (
            <div
              key={preset.id}
              onClick={() => handleTogglePreset(preset)}
              className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                active
                  ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-500 shadow-sm'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                        active
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {active ? <Check className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </span>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {uiLang === 'en' ? preset.nameEn : preset.nameRu}
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {active ? (uiLang === 'en' ? 'ACTIVE' : 'ВКЛЮЧЕНО') : (uiLang === 'en' ? 'OFF' : 'ВЫКЛ')}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {uiLang === 'en' ? preset.descriptionEn : preset.descriptionRu}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-mono">
                  [x: {preset.box.x}%, y: {preset.box.y}%, w: {preset.box.w}%, h: {preset.box.h}%]
                </span>
                <span className="text-teal-600 dark:text-teal-400 font-semibold text-[11px]">
                  {active
                    ? (uiLang === 'en' ? 'Click to disable' : 'Нажмите для отключения')
                    : (uiLang === 'en' ? 'Click to enable' : 'Нажмите для включения')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Global Zones List */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-xs flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            {uiLang === 'en'
              ? `Active Global Blur Zones (${globalBoxes.length})`
              : `Активные зоны сквозного размытия (${globalBoxes.length})`}
          </h4>
          <span className="text-[11px] text-slate-400">
            {uiLang === 'en'
              ? 'Applied to all screenshots in project'
              : 'Применяются ко всем скриншотам проекта'}
          </span>
        </div>

        {globalBoxes.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            {uiLang === 'en'
              ? 'No active global blur zones. Enable presets above for quick data protection.'
              : 'Нет активных зон сквозного размытия. Включите пресеты выше для быстрой защиты данных.'}
          </p>
        ) : (
          <div className="space-y-2">
            {globalBoxes.map((box, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 flex items-center justify-center font-bold text-[10px]">
                    #{idx + 1}
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    x: {box.x}%, y: {box.y}%, {uiLang === 'en' ? 'width' : 'ширина'}: {box.w}%, {uiLang === 'en' ? 'height' : 'высота'}: {box.h}%
                  </span>
                </div>

                <button
                  onClick={() => handleRemoveBox(idx)}
                  className="text-slate-400 hover:text-red-500 p-1 transition"
                  title={uiLang === 'en' ? 'Remove this zone' : 'Удалить эту зону'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 2: Free Batch Prompt for Any AI Chat (0 Tokens, 0 API Keys)
   ========================================================================= */

function BatchAiTab({
  project,
  onUpdateProject,
  uiLang = 'en',
}: {
  project: GuideProject;
  onUpdateProject: (updates: Partial<GuideProject>) => Promise<void>;
  uiLang?: 'en' | 'ru';
}) {
  const [copied, setCopied] = useState<boolean>(false);
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);
  const [rawAiResponse, setRawAiResponse] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const generatedPrompt = useMemo(() => {
    return generateBatchPromptForFreeAi(project, uiLang);
  }, [project, uiLang]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      setStatusMsg({
        text:
          uiLang === 'en'
            ? 'Prompt copied to clipboard! Paste it into your AI chat.'
            : 'Промпт скопирован в буфер обмена! Вставьте его в чат ИИ.',
      });
    } catch {
      setStatusMsg({
        text:
          uiLang === 'en'
            ? 'Could not copy. Select and copy text manually.'
            : 'Не удалось скопировать. Выделите текст вручную.',
        isError: true,
      });
    }
  }

  async function handleApplyJson() {
    if (!rawAiResponse.trim()) {
      setStatusMsg({
        text:
          uiLang === 'en'
            ? 'Paste JSON response from AI into the text box.'
            : 'Вставьте JSON-ответ от нейросети в текстовое поле.',
        isError: true,
      });
      return;
    }

    setIsApplying(true);
    setStatusMsg(null);
    try {
      const { updatedSteps, appliedCount } = applyBatchAiJsonToSteps(
        project.steps,
        rawAiResponse,
        uiLang
      );

      if (appliedCount === 0) {
        setStatusMsg({
          text:
            uiLang === 'en'
              ? 'No matching steps found to update. Check JSON format.'
              : 'Не найдено совпадений шагов для обновления. Проверьте формат JSON.',
          isError: true,
        });
        return;
      }

      await onUpdateProject({ steps: updatedSteps });
      setStatusMsg({
        text:
          uiLang === 'en'
            ? `Successfully updated ${appliedCount} of ${project.steps.length} steps!`
            : `Успешно обновлено шагов: ${appliedCount} из ${project.steps.length}!`,
      });
      setRawAiResponse('');
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : String(err),
        isError: true,
      });
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Workflow Explainer */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">
          {uiLang === 'en'
            ? 'Level 1: Free Batch AI (0 tokens, 0 API keys)'
            : 'Уровень 1: Бесплатный пакетный ИИ (0 токенов, 0 API-ключей)'}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {uiLang === 'en'
            ? 'If you do not have paid API keys, you can update your entire guide in 1 minute using any free web chat (ChatGPT, Claude, Gemini, DeepSeek):'
            : 'Если у вас нет платных API-ключей, вы можете обновить весь курс за 1 минуту через любой бесплатный чат (ChatGPT, Claude, Gemini, DeepSeek):'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold inline-flex items-center justify-center text-[11px] mb-1">
              1
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {uiLang === 'en' ? 'Copy the Prompt' : 'Скопируйте промпт'}
            </p>
            <p className="text-[11px] text-slate-500">
              {uiLang === 'en'
                ? `Automatically bundles all ${project.steps.length} steps and rough drafts.`
                : `В него автоматически упакованы все ${project.steps.length} шагов и черновые заметки.`}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold inline-flex items-center justify-center text-[11px] mb-1">
              2
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {uiLang === 'en' ? 'Paste in AI Chat' : 'Отправьте в чат'}
            </p>
            <p className="text-[11px] text-slate-500">
              {uiLang === 'en'
                ? 'The AI generates concise instructions with <b>...</b> tags.'
                : 'Нейросеть сформирует лаконичные инструкции с тегами <b>...</b>.'}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold inline-flex items-center justify-center text-[11px] mb-1">
              3
            </span>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {uiLang === 'en' ? 'Paste JSON Here' : 'Вставьте JSON сюда'}
            </p>
            <p className="text-[11px] text-slate-500">
              {uiLang === 'en'
                ? 'Click "Apply" to instantly update all steps and chapters.'
                : 'Нажмите «Применить», и все шаги и главы обновятся.'}
            </p>
          </div>
        </div>
      </div>

      {/* Copy Prompt Action */}
      <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
              {uiLang === 'en' ? 'Course Batch Prompt' : 'Готовый пакетный промпт курса'}
            </h4>
            <p className="text-[11px] text-slate-500">
              {uiLang === 'en'
                ? `Includes actions, voice drafts, and table of contents for all ${project.steps.length} steps`
                : `Включает действия, голосовые черновики и оглавление всех ${project.steps.length} шагов`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPromptPreview(!showPromptPreview)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {showPromptPreview
                ? uiLang === 'en'
                  ? 'Hide Text'
                  : 'Скрыть текст'
                : uiLang === 'en'
                ? 'Show Prompt Text'
                : 'Показать текст промпта'}
            </button>

            <button
              onClick={handleCopyPrompt}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-4 py-1.5 rounded-lg font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              {copied
                ? uiLang === 'en'
                  ? 'Copied to Clipboard!'
                  : 'Скопировано в буфер!'
                : uiLang === 'en'
                ? 'Copy Prompt for AI Chat'
                : 'Скопировать промпт для чата ИИ'}
            </button>
          </div>
        </div>

        {showPromptPreview && (
          <div className="relative">
            <textarea
              readOnly
              rows={8}
              value={generatedPrompt}
              className="w-full text-[11px] font-mono p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Paste AI JSON Response */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
          {uiLang === 'en'
            ? 'Paste AI JSON Response (Array of Steps):'
            : 'Вставьте полученный ответ от ИИ (JSON-массив):'}
        </label>
        <textarea
          rows={6}
          value={rawAiResponse}
          onChange={(e) => setRawAiResponse(e.target.value)}
          placeholder={`[\n  {\n    "stepIndex": 0,\n    "en": "In the top toolbar, click <b>+ New Pipeline</b>.",\n    "ru": "На верхней панели нажмите <b>+ New Pipeline</b>.",\n    "chapterTitle": "Setup Wizard"\n  }\n]`}
          className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-teal-500 focus:outline-none leading-relaxed"
        />

        {statusMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMsg.isError
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {statusMsg.isError ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {rawAiResponse && (
            <button
              onClick={() => setRawAiResponse('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-3 py-1.5"
            >
              {uiLang === 'en' ? 'Clear' : 'Очистить'}
            </button>
          )}

          <button
            onClick={handleApplyJson}
            disabled={isApplying || !rawAiResponse.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs px-5 py-2 rounded-xl font-bold shadow transition flex items-center gap-2"
          >
            {isApplying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {uiLang === 'en'
              ? 'Apply Translations & Descriptions to All Steps'
              : 'Применить переводы и описания ко всем шагам'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 3: Level 2 Gemini Micro-Crops & Level 0 Fast Builder
   ========================================================================= */

function GeminiMicroCropTab({
  project,
  screenshots,
  initialActiveStep,
  onUpdateProject,
  uiLang = 'en',
}: {
  project: GuideProject;
  screenshots: ScreenshotAsset[];
  initialActiveStep?: GuideStep;
  onUpdateProject: (updates: Partial<GuideProject>) => Promise<void>;
  uiLang?: 'en' | 'ru';
}) {
  // Settings
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  // Selected Step for inspection
  const [selectedStepId, setSelectedStepId] = useState<string>(
    initialActiveStep?.id || project.steps[0]?.id || ''
  );

  // Micro-crop preview states
  const [cropPreview, setCropPreview] = useState<{
    cropDataUrl: string;
    tightDataUrl: string;
  } | null>(null);
  const [isCropping, setIsCropping] = useState<boolean>(false);

  // Generation status
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [lastResult, setLastResult] = useState<{
    en: string;
    ru: string;
    buttonLabel?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Level 0 Manual Label Builder
  const [manualLabel, setManualLabel] = useState<string>('');
  const [manualAct, setManualAct] = useState<ActionType>('click');

  // Load Gemini settings from localStorage on mount
  useEffect(() => {
    const s = getGeminiSettings();
    if (s.apiKey) setApiKey(s.apiKey);
    if (s.model) setModel(s.model);
  }, []);

  const currentStep = useMemo(() => {
    return project.steps.find((s) => s.id === selectedStepId) || project.steps[0];
  }, [project.steps, selectedStepId]);

  const currentAsset = useMemo(() => {
    if (!currentStep) return undefined;
    return screenshots.find((a) => a.id === currentStep.screenshotId);
  }, [screenshots, currentStep]);

  // Generate micro-crop preview whenever selectedStep changes
  useEffect(() => {
    if (!currentStep || !currentAsset?.blob) {
      setCropPreview(null);
      return;
    }

    let isMounted = true;
    setIsCropping(true);

    cropStepTargetImage(currentAsset.blob, currentStep.box, 2.0)
      .then((res) => {
        if (isMounted) setCropPreview(res);
      })
      .catch((err) => {
        console.warn('Crop error:', err);
      })
      .finally(() => {
        if (isMounted) setIsCropping(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentStep, currentAsset]);

  function handleSaveSettings() {
    saveGeminiSettings({ apiKey, model });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  // Generate with Gemini for the currently selected step
  async function handleGenerateForCurrentStep() {
    if (!currentStep || !currentAsset?.blob) {
      setErrorMsg(
        uiLang === 'en'
          ? 'The selected step has no attached screenshot image.'
          : 'У выбранного шага нет привязанного скриншота.'
      );
      return;
    }
    if (!apiKey.trim()) {
      setErrorMsg(
        uiLang === 'en'
          ? 'Enter Gemini API key in settings below.'
          : 'Введите Gemini API ключ в настройках ниже.'
      );
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setLastResult(null);

    try {
      handleSaveSettings();
      const res = await describeStepWithGeminiMicroCrop({
        apiKey,
        model,
        screenshotBlob: currentAsset.blob,
        step: currentStep,
        targetLang: uiLang,
      });

      const instructionText = res.instruction || (uiLang === 'en' ? (res.en || res.ru) : (res.ru || res.en));

      setLastResult({
        en: instructionText,
        ru: instructionText,
        buttonLabel: res.buttonLabel,
      });

      // Automatically update step in project
      const updatedSteps = project.steps.map((st) => {
        if (st.id === currentStep.id) {
          return {
            ...st,
            en: instructionText,
            ru: instructionText,
          };
        }
        return st;
      });

      await onUpdateProject({ steps: updatedSteps });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  // Batch fill empty steps
  async function handleFillEmptySteps() {
    if (!apiKey.trim()) {
      setErrorMsg(
        uiLang === 'en'
          ? 'Enter Gemini API key to run auto-fill.'
          : 'Введите Gemini API ключ для запуска авто-заполнения.'
      );
      return;
    }

    const emptySteps = project.steps.filter((s) => {
      const text = uiLang === 'en' ? (s.en || s.ru) : (s.ru || s.en);
      return !text || text.includes('Next step') || text.includes('Описание следующего');
    });

    if (emptySteps.length === 0) {
      alert(uiLang === 'en' ? 'All steps already have descriptions!' : 'Все шаги уже имеют описания!');
      return;
    }

    handleSaveSettings();
    setIsGenerating(true);
    setErrorMsg(null);
    setBatchProgress({ current: 0, total: emptySteps.length });

    try {
      let currentSteps = [...project.steps];

      for (let i = 0; i < emptySteps.length; i++) {
        const st = emptySteps[i];
        setBatchProgress({ current: i + 1, total: emptySteps.length });

        const asset = screenshots.find((a) => a.id === st.screenshotId);
        if (asset?.blob) {
          try {
            const desc = await describeStepWithGeminiMicroCrop({
              apiKey,
              model,
              screenshotBlob: asset.blob,
              step: st,
              targetLang: uiLang,
            });

            const instructionText = desc.instruction || (uiLang === 'en' ? (desc.en || desc.ru) : (desc.ru || desc.en));
            currentSteps = currentSteps.map((s) =>
              s.id === st.id ? { ...s, en: instructionText, ru: instructionText } : s
            );
          } catch (itemErr) {
            console.warn(`Step ${st.id} failed:`, itemErr);
          }

          // Small pause to stay well within free RPM limits
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      await onUpdateProject({ steps: currentSteps });
      setBatchProgress(null);
      alert(
        uiLang === 'en'
          ? 'Auto-filling empty steps complete!'
          : 'Авто-заполнение пустых шагов завершено!'
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
      setBatchProgress(null);
    }
  }

  // Level 0: Instant Template Generator without AI
  async function handleApplyLevel0Caption() {
    if (!manualLabel.trim()) return;
    const { en, ru } = buildSmartCaptionFromLabel(manualAct, manualLabel.trim());
    const instructionText = uiLang === 'en' ? en : ru;

    const updatedSteps = project.steps.map((st) => {
      if (st.id === currentStep?.id) {
        return {
          ...st,
          act: manualAct,
          en: instructionText,
          ru: instructionText,
        };
      }
      return st;
    });

    await onUpdateProject({ steps: updatedSteps });
    setLastResult({
      en: instructionText,
      ru: instructionText,
      buttonLabel: manualLabel.trim(),
    });
    setManualLabel('');
  }

  return (
    <div className="space-y-6">
      {/* Token Economy Callout */}
      <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-transparent border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-slate-100">
            {uiLang === 'en' ? '3-Tier Token & Limit Economy:' : '3-Уровневая экономия лимитов и токенов:'}
          </span>{' '}
          {uiLang === 'en'
            ? 'Instead of sending a full 2 MB screenshot, the tool crops a mini ~300×200px snippet with a red bounding box (~15–25 KB). This reduces Google Gemini token usage by 20–50x, guarantees instant response, and works comfortably within Google AI Studio 100% free tier!'
            : 'Вместо отправки полного 2 МБ скриншота, инструмент вырезает мини-фрагмент ~300×200px с красной рамкой (~15–25 КБ). Это экономит лимиты Google Gemini в 20–50 раз, гарантирует мгновенный отклик и позволяет комфортно работать на 100% бесплатном тарифе AI Studio!'}
        </div>
      </div>

      {/* Gemini API Key Configuration */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-teal-600" />
            <h4 className="font-bold text-xs">
              {uiLang === 'en' ? 'Gemini API Settings (BYOK)' : 'Настройки Gemini API (BYOK)'}
            </h4>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-medium"
          >
            {uiLang === 'en' ? 'Get free key at Google AI Studio' : 'Получить бесплатный ключ в Google AI Studio'}{' '}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {uiLang === 'en'
                ? 'API Key (saved only in browser localStorage)'
                : 'API Ключ (хранится только в вашем браузере / localStorage)'}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {uiLang === 'en' ? 'Gemini Model' : 'Модель Gemini'}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
              >
                <option value="gemini-2.5-flash">gemini-2.5-flash ({uiLang === 'en' ? 'Recommended' : 'Рекомендуется'})</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              </select>

              <button
                onClick={handleSaveSettings}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 p-2 rounded-lg text-xs font-semibold transition shrink-0"
                title={uiLang === 'en' ? 'Save Settings' : 'Сохранить настройки'}
              >
                {settingsSaved ? <Check className="w-4 h-4 text-emerald-600" /> : <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Step Inspector & Micro-Crop Preview */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-850 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            <h4 className="font-bold text-xs">{uiLang === 'en' ? 'Micro-Crop Inspector' : 'Инспектор микро-кропа'}</h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{uiLang === 'en' ? 'Step:' : 'Шаг:'}</span>
            <select
              value={selectedStepId}
              onChange={(e) => setSelectedStepId(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-semibold"
            >
              {project.steps.map((st, idx) => {
                const text = uiLang === 'en' ? (st.en || st.ru) : (st.ru || st.en);
                return (
                  <option key={st.id} value={st.id}>
                    {idx + 1}. [{st.act}] {text ? (text.length > 35 ? text.substring(0, 35) + '...' : text) : (uiLang === 'en' ? '(no instruction)' : '(без инструкции)')}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Micro-Crop Preview Windows */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {uiLang === 'en' ? '1. Context Micro-Crop (sent to AI ~20 KB)' : '1. Микро-кроп с контекстом (в ИИ ~20 КБ)'}
              </span>
              <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 px-2 py-0.5 rounded font-mono">
                max 400px JPEG
              </span>
            </div>

            <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700">
              {isCropping ? (
                <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
              ) : cropPreview?.cropDataUrl ? (
                <img
                  src={cropPreview.cropDataUrl}
                  alt="Context crop"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">{uiLang === 'en' ? 'No preview' : 'Нет превью'}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {uiLang === 'en'
                ? 'Red bounding box is drawn automatically so model pinpoints the target element.'
                : 'Красная рамка вокруг цели нарисована автоматически, чтобы модель точно знала кнопку.'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {uiLang === 'en' ? '2. Precise Button Outline (Tight crop)' : '2. Точная рамка кнопки (Tight crop)'}
              </span>
              <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                {uiLang === 'en' ? 'Button Preview' : 'Кнопка превью'}
              </span>
            </div>

            <div className="aspect-video bg-slate-950 rounded-lg flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700">
              {isCropping ? (
                <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
              ) : cropPreview?.tightDataUrl ? (
                <img
                  src={cropPreview.tightDataUrl}
                  alt="Tight crop"
                  className="max-h-full max-w-full object-contain border border-teal-500/50 rounded"
                />
              ) : (
                <span className="text-xs text-slate-500">{uiLang === 'en' ? 'No preview' : 'Нет превью'}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {uiLang === 'en' ? 'Strictly cropped UI element without surrounding noise.' : 'Строго выделенный элемент интерфейса без окружения.'}
            </p>
          </div>
        </div>

        {/* Action Buttons for AI Generation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            {currentStep?.voiceDraft ? (
              <span>{uiLang === 'en' ? `Draft: "${currentStep.voiceDraft}"` : `Черновик: «${currentStep.voiceDraft}»`}</span>
            ) : (
              <span>{uiLang === 'en' ? 'No voice draft (will be detected visually)' : 'Голосовой черновик отсутствует (будет распознан по картинке)'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFillEmptySteps}
              disabled={isGenerating}
              className="text-xs border border-slate-300 dark:border-slate-700 hover:border-teal-500 px-3 py-2 rounded-xl font-semibold transition flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-teal-600" />
              {uiLang === 'en' ? 'Fill All Empty Steps' : 'Заполнить все пустые шаги'}
            </button>

            <button
              onClick={handleGenerateForCurrentStep}
              disabled={isGenerating || !cropPreview}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-xs px-4 py-2 rounded-xl font-bold shadow transition flex items-center gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {isGenerating
                ? uiLang === 'en'
                  ? 'Generating...'
                  : 'Генерация...'
                : uiLang === 'en'
                ? 'Generate Description for Step'
                : 'Сгенерировать описание для шага'}
            </button>
          </div>
        </div>

        {/* Batch Progress Bar */}
        {batchProgress && (
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800 text-xs">
            <div className="flex items-center justify-between mb-1 font-semibold">
              <span>{uiLang === 'en' ? 'Batch processing...' : 'Пакетная обработка...'}</span>
              <span>
                {batchProgress.current} {uiLang === 'en' ? 'of' : 'из'} {batchProgress.total}
              </span>
            </div>
            <div className="w-full bg-teal-200 dark:bg-teal-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-600 h-full transition-all"
                style={{
                  width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Generation Result View */}
        {lastResult && (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                {uiLang === 'en' ? 'Generated & Applied:' : 'Сгенерировано и применено:'}
              </span>
              {lastResult.buttonLabel && (
                <span className="text-[11px] bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded font-mono font-semibold">
                  {uiLang === 'en' ? 'Element' : 'Элемент'}: {lastResult.buttonLabel}
                </span>
              )}
            </div>

            <div className="text-xs pt-1">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                  {uiLang === 'en' ? 'Instruction:' : 'Инструкция:'}
                </span>
                <p
                  className="text-slate-800 dark:text-slate-100"
                  dangerouslySetInnerHTML={{
                    __html: uiLang === 'en' ? (lastResult.en || lastResult.ru) : (lastResult.ru || lastResult.en),
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Level 0: Autonomous Fast Builder (No AI, 0 Calls) */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
          <Eye className="w-4 h-4 text-teal-600" />
          {uiLang === 'en'
            ? 'Level 0: Fast Autonomous Builder (No AI, 0 API calls)'
            : 'Уровень 0: Быстрый конструктор без ИИ (100% автономный)'}
        </h4>
        <p className="text-[11px] text-slate-500 mb-3">
          {uiLang === 'en'
            ? 'Enter the button label or screen text. A clean caption with <b>...</b> tags is created for you:'
            : 'Введите название кнопки или надпись с экрана. Подпись с тегами <b>...</b> будет создана автоматически:'}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={manualAct}
            onChange={(e) => setManualAct(e.target.value as ActionType)}
            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
          >
            <option value="click">click ({uiLang === 'en' ? 'Click' : 'Нажать'})</option>
            <option value="type">type ({uiLang === 'en' ? 'Type' : 'Ввести'})</option>
            <option value="select">select ({uiLang === 'en' ? 'Select' : 'Выбрать'})</option>
            <option value="drag">drag ({uiLang === 'en' ? 'Drag' : 'Перетащить'})</option>
            <option value="scroll">scroll ({uiLang === 'en' ? 'Scroll' : 'Прокрутить'})</option>
            <option value="look">look ({uiLang === 'en' ? 'Notice' : 'Обратить внимание'})</option>
          </select>

          <input
            type="text"
            value={manualLabel}
            onChange={(e) => setManualLabel(e.target.value)}
            placeholder={uiLang === 'en' ? 'e.g. + New Item or Save' : 'например: + New Item или Save'}
            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex-1 min-w-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyLevel0Caption();
            }}
          />

          <button
            onClick={handleApplyLevel0Caption}
            disabled={!manualLabel.trim()}
            className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs px-4 py-2 rounded-lg font-bold disabled:opacity-30 transition"
          >
            {uiLang === 'en' ? 'Generate & Apply' : 'Сформировать и применить'}
          </button>
        </div>
      </div>
    </div>
  );
}
