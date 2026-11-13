import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Shield,
  Monitor,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Camera,
  FileCode,
  Layers,
  Check,
  MousePointer,
  Scissors,
} from 'lucide-react';

import {
  type UiLang,
  UI_TEXT,
  markWelcomeTourSeen,
  saveUiLang,
} from '../../i18n/uiTranslations';

export interface WelcomeTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiLang: 'en' | 'ru';
  onToggleUiLang?: (lang: 'en' | 'ru') => void;
}

export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
  isOpen,
  onClose,
  uiLang,
  onToggleUiLang,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [internalLang, setInternalLang] = useState<UiLang>(uiLang);

  // Sync internalLang with uiLang prop if prop updates
  useEffect(() => {
    setInternalLang(uiLang);
  }, [uiLang]);

  // Handle keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight' && currentStep < 4) {
        setCurrentStep((prev) => Math.min(4, prev + 1));
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        setCurrentStep((prev) => Math.max(1, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const t = UI_TEXT[internalLang].welcomeTour;

  const handleLanguageSwitch = (lang: UiLang) => {
    setInternalLang(lang);
    saveUiLang(lang);
    onToggleUiLang?.(lang);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    markWelcomeTourSeen();
    onClose();
  };

  const handleDismiss = () => {
    markWelcomeTourSeen();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Guide Creation Tool
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                  {t.stepOf} {currentStep} / 4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {internalLang === 'en'
                  ? 'Interactive Walk-Through & Quickstart Tour'
                  : 'Интерактивное пошаговое руководство по созданию гайдов'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher pill */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleLanguageSwitch('en')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  internalLang === 'en'
                    ? 'bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLanguageSwitch('ru')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  internalLang === 'ru'
                    ? 'bg-white dark:bg-sky-600 text-sky-700 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                RU
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={t.skipTour}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          {/* STEP 1: WELCOME & PURPOSE */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.step1.tag}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step1.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {t.step1.desc}
                </p>
              </div>

              {/* 3 Value Proposition Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    ⚡
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step1.bullet1Title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet1Desc}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                    🎯
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step1.bullet2Title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet2Desc}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    📦
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step1.bullet3Title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet3Desc}
                  </p>
                </div>
              </div>

              {/* Workflow Snapshot Diagram */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-200/50 dark:border-indigo-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span>{internalLang === 'en' ? 'Share Target Window' : 'Трансляция целевого окна'}</span>
                </div>
                <div className="hidden sm:block text-slate-400">➔</div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>{internalLang === 'en' ? 'Pop-out PiP Recorder' : 'Плавающее окно PiP'}</span>
                </div>
                <div className="hidden sm:block text-slate-400">➔</div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <span>{internalLang === 'en' ? 'Draw Boxes & Blur' : 'Разметка рамок и блюр'}</span>
                </div>
                <div className="hidden sm:block text-slate-400">➔</div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">4</span>
                  <span>{internalLang === 'en' ? '1-Click HTML Deliverable' : 'Готовый автономный HTML'}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SHARING SCREEN & AVOIDING MIRROR EFFECT */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Monitor className="w-3.5 h-3.5" />
                  {t.step2.tag}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step2.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {t.step2.desc}
                </p>
              </div>

              {/* Side-by-Side DO vs DON'T */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* DO CARD */}
                <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-700/60 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t.step2.doTitle}</span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                    <p>{t.step2.doDesc}</p>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-800 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      Browser Window Picker &gt; <b>[Tab: "Browser Tab"]</b> &gt; Select your BI tool (e.g. <i>"Power BI Workspace"</i>, <i>"Snowflake"</i>, <i>"AWS Console"</i>).
                    </div>
                  </div>
                  <div className="mt-auto pt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ Clean, crisp screenshots with zero infinite mirror loops!
                  </div>
                </div>

                {/* DONT CARD */}
                <div className="p-5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border-2 border-rose-300 dark:border-rose-700/60 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    <span>{t.step2.dontTitle}</span>
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                    <p>{t.step2.dontDesc}</p>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-800 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      ❌ Do not select <b>"Guide Creation Tool"</b> tab or the current screen showing the recorder preview.
                    </div>
                  </div>
                  <div className="mt-auto pt-2 text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                    ⚠️ Results in infinite recursive frames like looking into facing mirrors.
                  </div>
                </div>
              </div>

              {/* Tip Callout */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
                <span className="text-base">💡</span>
                <p className="leading-relaxed">
                  {t.step2.tip}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: PIP RECORDER & MULTI-TAB CAPTURE */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  <Layers className="w-3.5 h-3.5" />
                  {t.step3.tag}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step3.title}
                </h2>
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-xs italic text-sky-900 dark:text-sky-200">
                  {t.step3.desc}
                </div>
              </div>

              {/* Why & Solution */}
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.step3.browserSecurityNote}
                </p>

                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 dark:from-slate-800 dark:to-slate-800/80 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                    <span className="p-1 rounded bg-indigo-600 text-white">🪟</span>
                    <span>{t.step3.solutionTitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.step3.solutionDesc}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-700 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-sky-600 dark:text-sky-400">
                        <Camera className="w-4 h-4" />
                        <span>Step A: Snap Step</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t.step3.stepA}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-700 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                        <MousePointer className="w-4 h-4" />
                        <span>Step B: Target & Voice</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t.step3.stepB}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-slate-700 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                        <Scissors className="w-4 h-4" />
                        <span>Step C: Snipping Tool</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t.step3.stepC}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PRIVACY, AI CROPS & STANDALONE EXPORT */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Shield className="w-3.5 h-3.5" />
                  {t.step4.tag}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step4.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                  {t.step4.desc}
                </p>
              </div>

              {/* 3 Core Features in Tab 2 & 3 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step4.privacyTitle}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.privacyDesc}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step4.aiTitle}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.aiDesc}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {t.step4.exportTitle}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.exportDesc}
                  </p>
                </div>
              </div>

              {/* Ready banner */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    ✓
                  </div>
                  <div>
                    <h5 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
                      {internalLang === 'en'
                        ? 'You are all set to build interactive guides!'
                        : 'Вы полностью готовы к созданию первых интерактивных гайдов!'}
                    </h5>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                      {internalLang === 'en'
                        ? 'Try the interactive demo project or create your own step sequence in Tab 1.'
                        : 'Попробуйте готовый демо-проект или начните запись своих шагов во Вкладке 1.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          {/* Skip / Don't show again */}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            {t.skipTour}
          </button>

          {/* Navigation Dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === step
                    ? 'w-6 bg-sky-600 dark:bg-sky-400'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`${t.stepOf} ${step}`}
              />
            ))}
          </div>

          {/* Buttons: Back / Next / Finish */}
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.back}
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 shadow-sm transition-all"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{t.startCreating}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
