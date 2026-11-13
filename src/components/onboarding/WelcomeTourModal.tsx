import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Shield,
  Monitor,
  GraduationCap,
  Camera,
  FileCode,
  Layers,
  Check,
  MousePointer,
  Scissors,
  ZoomIn,
  Download,
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
      } else if (e.key === 'ArrowRight' && currentStep < 6) {
        setCurrentStep((prev) => Math.min(6, prev + 1));
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
    if (currentStep < 6) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[94vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Guide Creation Tool
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                  {t.stepOf} {currentStep} / 6
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {internalLang === 'en'
                  ? 'Interactive 6-Step Visual Walkthrough (Click red boxes or Next →)'
                  : 'Наглядный пошаговый гид по приложению (нажимайте на рамку или Далее →)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Language Switcher pill */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleLanguageSwitch('en')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  internalLang === 'en'
                    ? 'bg-white dark:bg-teal-600 text-teal-700 dark:text-white shadow-xs'
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
                    ? 'bg-white dark:bg-teal-600 text-teal-700 dark:text-white shadow-xs'
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
            className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600 transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          />
        </div>

        {/* Modal Scrollable Body */}
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100 space-y-5">
          {/* ================= STEP 1: START SCREEN CAPTURE & PICK TARGET TAB ================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Monitor className="w-3.5 h-3.5" />
                  {t.step1.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step1.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step1.desc}
                </p>
              </div>

              {/* Interactive Mock: Browser Screen Share Dialog */}
              <div
                onClick={handleNext}
                className="group relative bg-slate-900 border-2 border-teal-500/80 rounded-xl p-4 shadow-lg cursor-pointer overflow-hidden transition-all hover:border-teal-400"
                title={internalLang === 'en' ? 'Click to advance to Step 2 →' : 'Нажмите для перехода к шагу 2 →'}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                    <span>chrome.google.com wants to share the contents of your screen</span>
                  </span>
                  <span className="text-teal-400 font-mono text-[10px] group-hover:underline">
                    {internalLang === 'en' ? 'Interactive Demo (Click here) →' : 'Интерактивное демо (кликните) →'}
                  </span>
                </div>

                <div className="flex gap-2 pt-3 pb-2 text-xs font-semibold">
                  <span className="px-3 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                    Entire Screen <span className="text-rose-400 text-[10px]">❌ Mirror Loop</span>
                  </span>
                  <span className="px-3 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Window
                  </span>
                  <span className="px-3 py-1 rounded bg-teal-600 text-white font-bold shadow flex items-center gap-1">
                    ✓ Browser Tab <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">Recommended</span>
                  </span>
                </div>

                {/* Simulated Tab List */}
                <div className="space-y-2 pt-2">
                  <div className="relative p-3 rounded-lg bg-teal-950/40 border-2 border-rose-500 flex items-center justify-between text-xs text-white ring-4 ring-rose-500/20 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <span className="font-bold text-teal-200">Power BI Service — Sales & Margin Report (Target Tab)</span>
                    </div>
                    <span className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow">
                      🎯 CLICK HERE TO SHARE
                    </span>

                    {/* Animated mouse cursor pointing at target */}
                    <div className="absolute right-40 -bottom-1 pointer-events-none flex items-center gap-1 bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded border border-rose-400 shadow-xl">
                      <MousePointer className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                      <span>{internalLang === 'en' ? 'Click to select tab' : 'Выбрать эту вкладку'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>⚙️</span>
                      <span>Guide Creation Tool (Current App Window)</span>
                    </div>
                    <span className="text-rose-400 text-[10px] font-semibold">
                      ❌ Do not select (causes infinite mirror)
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                    🎯
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step1.bullet1Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                    🛡️
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step1.bullet2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    ⚡
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step1.bullet3Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step1.bullet3Desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: POP OUT FLOATING RECORDER (ALWAYS ON TOP) ================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  <Layers className="w-3.5 h-3.5" />
                  {t.step2.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step2.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step2.desc}
                </p>
              </div>

              {/* Interactive Mock: Floating PiP Controller hovering over Power BI */}
              <div
                onClick={handleNext}
                className="group relative bg-slate-950 border-2 border-indigo-500/80 rounded-xl p-4 shadow-lg cursor-pointer overflow-hidden transition-all hover:border-indigo-400 min-h-[190px] flex flex-col justify-between"
                title={internalLang === 'en' ? 'Click to advance to Step 3 →' : 'Нажмите для перехода к шагу 3 →'}
              >
                {/* Simulated Power BI background */}
                <div className="opacity-40 pointer-events-none flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-bold text-yellow-500">Power BI Desktop</span>
                    <span>File</span>
                    <span>Home</span>
                    <span>Insert</span>
                    <span>Modeling</span>
                    <span>View</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Workspace: Financials 2026</div>
                </div>

                {/* Floating PiP Window (always-on-top) */}
                <div className="relative z-10 self-end w-full sm:w-80 bg-slate-900 border-2 border-teal-400 rounded-xl p-3 shadow-2xl space-y-2.5 animate-bounce-subtle">
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-teal-300 flex items-center gap-1.5">
                      <span>🪟</span>
                      <span>Floating Step Recorder</span>
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/40">
                      ● Always on Top
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 p-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md ring-4 ring-rose-500/40 border-2 border-rose-500 animate-pulse">
                      <Camera className="w-4 h-4" />
                      <span>📸 Snap Step</span>
                      <span className="absolute -top-2.5 -right-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shadow">
                        Click!
                      </span>
                    </div>

                    <div className="px-2 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1">
                      <span>🎤</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 text-center">
                    {internalLang === 'en'
                      ? 'Stay inside your program — snap steps in 1 click!'
                      : 'Работайте в своей программе — жмите Snap Step без сворачивания!'}
                  </div>
                </div>
              </div>

              {/* 3 Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    🪟
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step2.bullet1Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step2.bullet1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                    📸
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step2.bullet2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step2.bullet2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    ⌨️
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step2.bullet3Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step2.bullet3Desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: HIGHLIGHT TARGET & ADJUST 8 HANDLES + POINTER ================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  <MousePointer className="w-3.5 h-3.5" />
                  {t.step3.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step3.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step3.desc}
                </p>
              </div>

              {/* Interactive Mock: Red Box with 8 Handles and ↖ Pointer */}
              <div
                onClick={handleNext}
                className="group relative bg-slate-950 border-2 border-rose-500/80 rounded-xl p-6 shadow-lg cursor-pointer overflow-hidden transition-all hover:border-rose-400 min-h-[190px] flex items-center justify-center"
                title={internalLang === 'en' ? 'Click to advance to Step 4 →' : 'Нажмите для перехода к шагу 4 →'}
              >
                {/* Target Button with Red Bounding Box & 8 Handles */}
                <div className="relative">
                  {/* The UI button underneath */}
                  <div className="px-8 py-3.5 rounded-lg bg-teal-700 text-white font-bold text-base shadow flex items-center gap-2 select-none">
                    <span>+ New Report</span>
                  </div>

                  {/* Red Pulsating Bounding Box */}
                  <div className="absolute -inset-2 border-3 border-rose-500 rounded-md bg-rose-500/15 ring-4 ring-rose-500/30 animate-pulse pointer-events-none">
                    {/* Step indicator badge */}
                    <span className="absolute -top-3.5 -left-2 bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow">
                      Step 1: Click
                    </span>

                    {/* 8 White Resize Handles */}
                    {/* nw */}
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* n */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* ne */}
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* e */}
                    <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* se */}
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* s */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* sw */}
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />
                    {/* w */}
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-slate-900 rounded-xs shadow" />

                    {/* ↖ Offset Pointer Arrow (outside text area) */}
                    <div className="absolute -bottom-6 -right-6 flex items-center gap-1.5 bg-slate-900 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500 shadow-xl">
                      <span className="text-base">↖</span>
                      <span>{internalLang === 'en' ? 'Pointer outside text' : 'Стрелка сдвинута от текста'}</span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-2 right-3 text-teal-400 font-mono text-[10px]">
                  {internalLang === 'en' ? 'Click to advance →' : 'Нажмите для перехода →'}
                </div>
              </div>

              {/* 3 Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                    📐
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step3.bullet1Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step3.bullet1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    ↖
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step3.bullet2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step3.bullet2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                    ✨
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step3.bullet3Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step3.bullet3Desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: ADD BLUR, TYPE INSTRUCTION & CLICK "SAVE & NEXT" ================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Shield className="w-3.5 h-3.5" />
                  {t.step4.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step4.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step4.desc}
                </p>
              </div>

              {/* Interactive Mock: Privacy Blur + Instruction Input + Green Save Button */}
              <div
                onClick={handleNext}
                className="group relative bg-slate-950 border-2 border-amber-500/80 rounded-xl p-4 shadow-lg cursor-pointer overflow-hidden transition-all hover:border-amber-400 space-y-3"
                title={internalLang === 'en' ? 'Click to advance to Step 5 →' : 'Нажмите для перехода к шагу 5 →'}
              >
                {/* User email covered by frosted blur box */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Account:</span>
                    <div className="relative backdrop-blur-md bg-amber-500/20 border border-amber-400/60 rounded px-2 py-0.5 text-xs text-amber-200 font-mono flex items-center gap-1.5">
                      <span>🌫 user@corp.internal</span>
                      <span className="text-[9px] bg-amber-600 text-white font-bold px-1 rounded">BLURRED</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-teal-400">Target button remains crystal clear</span>
                </div>

                {/* Instruction textarea preview */}
                <div className="p-3 rounded-lg bg-slate-900 border border-teal-500/50 text-xs text-slate-200 leading-relaxed font-sans">
                  <div className="text-[10px] text-teal-400 font-bold mb-1 flex items-center justify-between">
                    <span>Instruction (with bold keywords):</span>
                    <span className="text-slate-400">Presets: Click | Type | Select</span>
                  </div>
                  <div>
                    Click <b>+ New Report</b> to configure data models and create your first visual chart.
                  </div>
                </div>

                {/* Pulsating Save Button */}
                <div className="flex justify-end pt-1">
                  <div className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg ring-4 ring-emerald-500/30 flex items-center gap-2 animate-pulse">
                    <Check className="w-4 h-4" />
                    <span>✅ Save Step & Capture Next →</span>
                  </div>
                </div>
              </div>

              {/* 3 Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    🌫️
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step4.bullet1Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.bullet1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                    ✍️
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step4.bullet2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.bullet2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    🎤
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step4.bullet3Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step4.bullet3Desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: FULL-WIDTH WORKSPACE & CANVAS ZOOM (100%–200%) ================= */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <ZoomIn className="w-3.5 h-3.5" />
                  {t.step5.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step5.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step5.desc}
                </p>
              </div>

              {/* Interactive Mock: Full-Width Editor with Collapsible Sidebar & Zoom Buttons */}
              <div
                onClick={handleNext}
                className="group relative bg-slate-950 border-2 border-teal-500/80 rounded-xl p-4 shadow-lg cursor-pointer overflow-hidden transition-all hover:border-teal-400 space-y-3"
                title={internalLang === 'en' ? 'Click to advance to Step 6 →' : 'Нажмите для перехода к шагу 6 →'}
              >
                {/* Editor Top Bar with Zoom & Height buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-bold text-[11px] border border-slate-700">
                      ◀ Compact
                    </span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-bold text-[11px] border border-slate-700">
                      ✕ Hide
                    </span>
                    <span className="text-[10px] text-teal-400 font-semibold ml-1">
                      Full-Width Canvas (100% Screen)
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 px-1.5">🔍 Zoom:</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-400">100%</span>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-teal-600 text-white shadow ring-2 ring-teal-400 animate-pulse">
                      140%
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-400">180%</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-800 ml-1">
                      ↕️ Tall Canvas
                    </span>
                  </div>
                </div>

                {/* Zoomed in Canvas Area */}
                <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center relative min-h-[110px]">
                  <div className="scale-125 transition-transform flex items-center gap-3">
                    <div className="px-5 py-2.5 rounded bg-teal-600 text-white font-bold text-sm shadow-xl border-2 border-rose-500 ring-4 ring-rose-500/30">
                      + Add Source (Zoomed 140%)
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-3 text-[10px] text-slate-500">
                    {internalLang === 'en' ? 'Effortlessly hit small icons & buttons' : 'Легко попадать по мелким папкам и кнопкам'}
                  </span>
                </div>
              </div>

              {/* 3 Value Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
                    ⛶
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step5.bullet1Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step5.bullet1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                    🔍
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step5.bullet2Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step5.bullet2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    ↕️
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    {t.step5.bullet3Title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.step5.bullet3Desc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 6: EXPORT SINGLE HTML OR SPLIT INTO LESSONS ================= */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <FileCode className="w-3.5 h-3.5" />
                  {t.step6.tag}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.step6.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
                  {t.step6.desc}
                </p>
              </div>

              {/* Interactive Mock: 3. Player & Export deliverables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* guide-public.html */}
                <div
                  onClick={handleComplete}
                  className="p-4 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-800 text-white shadow-lg cursor-pointer hover:from-teal-600 hover:to-emerald-700 transition flex flex-col justify-between"
                  title={internalLang === 'en' ? 'Click to finish walkthrough!' : 'Нажмите, чтобы завершить обучение!'}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm flex items-center gap-1.5">
                        <Download className="w-4 h-4" />
                        <span>guide-public.html</span>
                      </span>
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-teal-100 leading-relaxed">
                      {internalLang === 'en'
                        ? '1-File deliverable with embedded images and interactive simulator. Perfect for Moodle, Canvas, Blackboard, or offline use.'
                        : 'Единый автономный файл с картинками и тренажёром. Идеален для загрузки в Moodle, Canvas, отправки в чат или на флешку.'}
                    </p>
                  </div>
                  <span className="mt-3 text-[11px] font-bold text-teal-200">
                    {internalLang === 'en' ? 'Download & Share Anywhere →' : 'Скачать и поделиться с коллегами →'}
                  </span>
                </div>

                {/* Split Long Guide into Lessons */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Scissors className="w-4 h-4 text-indigo-500" />
                        <span>Split into Lessons</span>
                      </span>
                      <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                        Step 1 – 15
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {internalLang === 'en'
                        ? 'Cut a 50-step course into short modular chapters, or import any HTML guide back into the editor anytime.'
                        : 'Нарезайте длинный курс на короткие модули или открывайте готовый HTML-гайд обратно для правок.'}
                    </p>
                  </div>
                  <span className="mt-3 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {internalLang === 'en' ? 'Modular Course Design →' : 'Модульная нарезка уроков →'}
                  </span>
                </div>
              </div>

              {/* Ready banner */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
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
                        : 'Попробуйте готовый 6-шаговый демо-тренажёр или начните запись своих шагов во Вкладке 1.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-3">
          {/* Skip / Don't show again */}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            {t.skipTour}
          </button>

          {/* Navigation Dots (1 through 6) */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === step
                    ? 'w-6 bg-teal-600 dark:bg-teal-400'
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.back}
              </button>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 shadow-sm transition-all"
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
