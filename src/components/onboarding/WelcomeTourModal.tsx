import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  ArrowRight,
  Monitor,
  Camera,
  MousePointer2,
  Mic,
  Download,
  GraduationCap,
  Plus,
  Sparkles,
  ImagePlus,
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
  /** Final call to action: create a new empty guide (opens Capture). */
  onStartNew?: () => void;
  /** Second path: the user already has screenshots and uploads them. */
  onStartFromScreenshots?: () => void;
  /** Final call to action: open the ready-made demo guide. */
  onOpenDemo?: () => void;
}

const TOTAL_STEPS = 3;

/**
 * Short 3-step welcome tour: Record, Caption, Download.
 * Plain language for teachers, ends with a clear call to action.
 */
export const WelcomeTourModal: React.FC<WelcomeTourModalProps> = ({
  isOpen,
  onClose,
  uiLang,
  onToggleUiLang,
  onStartNew,
  onStartFromScreenshots,
  onOpenDemo,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [internalLang, setInternalLang] = useState<UiLang>(uiLang);

  useEffect(() => {
    setInternalLang(uiLang);
  }, [uiLang]);

  useEffect(() => {
    if (isOpen) setCurrentStep(1);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(1, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const t = UI_TEXT[internalLang].welcomeTour;

  const handleLanguageSwitch = (lang: UiLang) => {
    setInternalLang(lang);
    saveUiLang(lang);
    onToggleUiLang?.(lang);
  };

  function handleDismiss() {
    markWelcomeTourSeen();
    onClose();
  }

  const handleStartNew = () => {
    handleDismiss();
    onStartNew?.();
  };

  const handleStartFromScreenshots = () => {
    handleDismiss();
    onStartFromScreenshots?.();
  };

  const handleOpenDemo = () => {
    handleDismiss();
    onOpenDemo?.();
  };

  const slides = [
    {
      icon: <Monitor className="w-7 h-7" />,
      title: t.step1.title,
      desc: t.step1.desc,
      points: [
        { icon: <Monitor className="w-5 h-5" />, text: t.step1.point1 },
        { icon: <Camera className="w-5 h-5" />, text: t.step1.point2 },
      ],
    },
    {
      icon: <MousePointer2 className="w-7 h-7" />,
      title: t.step2.title,
      desc: t.step2.desc,
      points: [
        { icon: <MousePointer2 className="w-5 h-5" />, text: t.step2.point1 },
        { icon: <Mic className="w-5 h-5" />, text: t.step2.point2 },
      ],
    },
    {
      icon: <Download className="w-7 h-7" />,
      title: t.step3.title,
      desc: t.step3.desc,
      points: [
        { icon: <Download className="w-5 h-5" />, text: t.step3.point1 },
        { icon: <GraduationCap className="w-5 h-5" />, text: t.step3.point2 },
      ],
    },
  ];

  const slide = slides[currentStep - 1];
  const isLast = currentStep === TOTAL_STEPS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">{t.heading}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t.stepOf} {currentStep} / {TOTAL_STEPS}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-sm font-semibold">
              {(['en', 'ru'] as UiLang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleLanguageSwitch(l)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    internalLang === l
                      ? 'bg-white dark:bg-teal-600 text-teal-800 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={t.skipTour}
              aria-label={t.skipTour}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 px-6 pt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentStep(i + 1)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i < currentStep ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
              aria-label={`${t.stepOf} ${i + 1}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              {slide.icon}
            </div>
            <div className="space-y-2">
              <h2 id="welcome-tour-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {currentStep}. {slide.title}
              </h2>
              <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{slide.desc}</p>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {slide.points.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5"
              >
                <span className="text-teal-700 dark:text-teal-300 mt-0.5 shrink-0">{p.icon}</span>
                <span className="text-base text-slate-800 dark:text-slate-200 leading-snug">{p.text}</span>
              </li>
            ))}
          </ul>

          {isLast && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">{t.pathsHeading}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleStartNew}
                  data-testid="welcome-path-record"
                  className="text-left p-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-sm transition"
                >
                  <span className="flex items-center gap-2 font-semibold text-base">
                    <Plus className="w-5 h-5 shrink-0" />
                    {t.pathRecord}
                  </span>
                  <span className="block text-sm text-teal-50 mt-1">{t.pathRecordHint}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartFromScreenshots}
                  data-testid="welcome-path-upload"
                  className="text-left p-4 rounded-xl border border-teal-600 text-teal-900 dark:text-teal-100 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition"
                >
                  <span className="flex items-center gap-2 font-semibold text-base">
                    <ImagePlus className="w-5 h-5 shrink-0" />
                    {t.pathUpload}
                  </span>
                  <span className="block text-sm text-slate-600 dark:text-slate-300 mt-1">{t.pathUploadHint}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenDemo}
                className="mt-3 text-sm font-semibold text-teal-800 dark:text-teal-200 hover:underline flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                {t.ctaDemo}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:invisible flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {t.closeTour}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep((p) => Math.min(TOTAL_STEPS, p + 1))}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-1.5 shadow-sm transition"
            >
              {t.next}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
