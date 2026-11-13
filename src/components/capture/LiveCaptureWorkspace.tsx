import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Scissors,
  Plus,
  Check,
  X,
  ExternalLink,
  Trash2,
  Upload,
  Eye,
  Shield,
  MousePointer,
  Type,
  ListFilter,
  Move,
  ArrowDown,
  Sparkles,
  Layers,
  Square,
  RefreshCw,
  Play,
  CheckCircle2,
  Monitor,
  Radio,
} from 'lucide-react';
import type { BoxRect, GuideProject, GuideStep, ScreenshotAsset, ActionType } from '../../types/guide';
import { addScreenshot, updateProject, updateScreenshot, generateId } from '../../db/database';
import {
  InteractiveBoxEditor,
  computeDefaultCursorPos,
} from '../common/InteractiveBoxEditor';
import {
  VoiceDictationController,
  isSpeechRecognitionSupported,
  ACTION_PRESETS,
  formatActionInstruction,
  type ParsedVoiceStep,
} from '../../services/speechService';
import {
  isPipSupported,
  openPipWindow,
  closePipWindow,
  onPipClose,
} from '../../services/pipRecorderService';

export interface LiveCaptureWorkspaceProps {
  project: GuideProject;
  screenshots: ScreenshotAsset[];
  onProjectUpdated: () => Promise<void>;
  onOpenEditorStep?: (stepId: string) => void;
  uiLang?: 'en' | 'ru';
}

type DrawMode = 'shoot' | 'add_step_same_frame' | 'blur';
type PipViewMode = 'live' | 'frozen';

const translations = {
  en: {
    startCapture: 'Start Screen Capture',
    stopCapture: 'Stop Capture',
    changeSource: '🔄 Change Shared Tab / Window',
    popOutPip: '🪟 Pop Out Floating Recorder',
    popOutPipActive: '🪟 Floating Remote Active',
    popOutPipTip: 'Opens an always-on-top mini window that floats over your target web app',
    headerTip: 'Tip: Choose "Browser Tab" or "Window" in the prompt to avoid a mirror loop.',
    voice: 'Voice',
    listening: 'Listening...',
    voiceNotSupported: 'Speech recognition is not supported in this browser.',
    voicePrompt: 'Say: "Click Export button" or "Type admin"',
    voiceHeard: 'Voice: ',
    uploadImage: 'Upload Image / Ctrl+V',
    stepsCount: 'Steps: ',
    liveBadge: 'LIVE',
    waitingBadge: 'STANDBY',
    screenLive: 'Screen Live',
    captureWaiting: 'Capture Standby',

    // 3 Onboarding Steps (Before Capture)
    step1Title: 'Step 1: Click "Start Screen Capture"',
    step1Desc: 'In the browser popup, choose the "Browser Tab" (e.g. your BI web app) or "Window". Do NOT pick this Guide Tool tab to avoid a mirror effect!',
    step2Title: 'Step 2: Click "🪟 Pop Out Floating Recorder"',
    step2Desc: 'Opens an always-on-top mini window that floats right over your target tab while you work!',
    step3Title: 'Step 3: Snap & Highlight Buttons ("Snipping Tool" style)',
    step3Desc: 'In the floating window (or on the preview here), click "📸 Snap & Highlight" or simply drag your mouse over any button to capture the frame and highlight box in one move!',
    startCaptureBtn: '🚀 Start Screen Capture',
    orPasteImages: 'Or paste screenshots from clipboard (Ctrl+V) or upload image files anytime.',

    // Notice banner when stream active but PiP not open
    pipWarningTitle: '⚠️ Working in another browser tab?',
    pipWarningBody: 'Click "🪟 Pop Out Floating Recorder (Always on Top)" BEFORE switching tabs — otherwise you won\'t see the capture controls while inside your other tab!',
    openPipNow: '🪟 Pop Out Floating Recorder (Stay on Top)',

    // Modes & actions
    selectionMode: 'Selection Mode:',
    modeShoot: '✂️ Drag = Snap Step',
    modeSameFrame: '➕ Step on Same Frame',
    modeBlur: '🌫 Blur Private Area',
    snapFullFrame: '📸 Snap Full Frame',
    snapAndDraw: '📸 Snap Frame & Draw Box',
    snapAndHighlight: '📸 Snap & Highlight Button',
    backToLive: '▶️ Back to Live Stream for Next Step',
    stepCapturedTitle: '✅ Step #{n} Captured!',
    boxEditorHint: '💡 Drag box to move, pull corners/edges to resize, or drag the ↖ pointer so it doesn\'t cover text.',
    refineBoxHint: '✂️ Drag on image to redraw/refine button highlight box',
    livePreviewHint: '✂️ Drag mouse across any button to Snap & Highlight',

    // Remote PiP controls
    targetPlaceholder: 'Button or element name (e.g. Save, Export, Submit)...',
    actionType: 'Action Type',
    instruction: 'Instruction',
    stepDone: '✓ Done (Continue Capturing)',
    openInEditor: 'Open in Step Editor',
    deleteStep: 'Delete this step',
    autoModeActive: 'Live Auto Mode Active',
    closeRemote: 'Close remote window',
    hideRemote: 'Hide mini remote',
    finishCapture: '⏹ Stop Capture',
    nextStepBtn: '▶️ Back to Live Stream for Next Step',
    anotherStepOnFrame: '➕ Step on Same Frame',
    frozenModeBadge: 'FROZEN STEP',
    liveModeBadge: 'LIVE STREAM',

    // Feedback messages
    captureStartedMsg: 'Screen capture started. Drag over any button to create a step!',
    captureStoppedMsg: 'Screen capture stopped',
    captureErrorMsg: 'Failed to start screen capture',
    noFrameForBlur: 'No captured frame to apply blur to',
    blurApplied: 'Private area blurred (Blur)',
    firstSnapAFrame: 'Snap a frame first',
    stepAddedSameFrame: 'Step #{n} added to this frame!',
    stepCapturedMsg: '📸 Frame captured & Step #{n} created! Drag on image to refine box if needed.',
    boxUpdatedMsg: 'Highlight box updated!',
    fullFrameCapturedMsg: '📸 Full frame saved (Step #{n})',
    stepDeletedMsg: 'Step deleted',
    importedFromClipboard: 'Image imported from clipboard/file (Step #{n})',
    importError: 'Error importing image',
    quickComment: 'Quick Step Details',
    stepEmptyPromptTitle: 'Snap a Step on Screen',
    stepEmptyPromptDesc: 'Drag your mouse directly over any button on the video preview, or click Snap Frame. Your step will be captured instantly.',
    tipDrag: '1. Click and drag over the button to highlight it',
    tipClick: '2. Or just click once for a quick box',
    tipVoice: '3. Dictate instructions with zero AI delay',
    timelineTitle: 'Steps',
    noStepsYet: 'No steps captured yet. Start capture and snap your first step above!',
    photoStep: 'Shot #',
    pipFallbackMsg: 'Document Picture-in-Picture is not supported in this browser. Opened floating remote on page instead.',
  },
  ru: {
    startCapture: 'Начать захват экрана',
    stopCapture: 'Остановить захват',
    changeSource: '🔄 Сменить окно / вкладку',
    popOutPip: '🪟 Плавающий пульт PiP',
    popOutPipActive: '🪟 Плавающий пульт активен',
    popOutPipTip: 'Открывает окно поверх всех вкладок браузера и программ',
    headerTip: 'Совет: выберите «Вкладка» или «Окно», чтобы избежать эффекта зеркала.',
    voice: 'Голос',
    listening: 'Слушаю...',
    voiceNotSupported: 'Голосовой ввод не поддерживается в этом браузере.',
    voicePrompt: 'Скажите: «Нажмите Создать отчет» или «Введите admin»',
    voiceHeard: 'Голос: ',
    uploadImage: 'Загрузить фото / Ctrl+V',
    stepsCount: 'Шагов: ',
    liveBadge: 'LIVE',
    waitingBadge: 'ОЖИДАНИЕ',
    screenLive: 'Экран в эфире',
    captureWaiting: 'Захват ожидает',

    // 3 Onboarding Steps (Before Capture)
    step1Title: 'Шаг 1: Нажмите «Начать захват экрана»',
    step1Desc: 'В окне браузера выберите «Вкладку» (ваше веб-приложение) или «Окно». НЕ выбирайте эту вкладку Guide Tool, чтобы не было зеркального эффекта!',
    step2Title: 'Шаг 2: Нажмите «🪟 Плавающий пульт PiP»',
    step2Desc: 'Открывает поверх всех окон мини-пульт, который будет виден во время вашей работы во вкладке приложения!',
    step3Title: 'Шаг 3: Выделяйте кнопки («Ножницы» / Snipping)',
    step3Desc: 'В плавающем пульте (или на превью здесь) нажмите «📸 Снять кадр и выделить» или просто обведите нужную кнопку мышкой для фиксации шага за один жест!',
    startCaptureBtn: '🚀 Начать захват экрана',
    orPasteImages: 'Или вставляйте скриншоты из буфера обмена (Ctrl+V) или загружайте файлы в любой момент.',

    // Notice banner when stream active but PiP not open
    pipWarningTitle: '⚠️ Работаете в другой вкладке браузера?',
    pipWarningBody: 'Нажмите «🪟 Плавающий пульт (Поверх всех окон)» ДО переключения во вкладку — иначе вы не увидите кнопки записи внутри другой вкладки!',
    openPipNow: '🪟 Плавающий пульт (Поверх всех окон)',

    // Modes & actions
    selectionMode: 'Режим выделения:',
    modeShoot: '✂️ Выделил = Снял шаг',
    modeSameFrame: '➕ Шаг на этот же кадр',
    modeBlur: '🌫 Замазать (Blur)',
    snapFullFrame: '📸 Снять весь кадр',
    snapAndDraw: '📸 Снять кадр и выделить',
    snapAndHighlight: '📸 Снять кадр и выделить кнопку',
    backToLive: '▶️ Вернуться к эфиру для следующего шага',
    stepCapturedTitle: '✅ Шаг #{n} сохранён!',
    boxEditorHint: '💡 Тяните рамку для сдвига, за края — для размера, или сдвиньте ↖ курсор, чтобы не закрывать буквы.',
    refineBoxHint: '✂️ Обведите кнопку заново для уточнения рамки',
    livePreviewHint: '✂️ Выделите область на превью для шага',

    // Remote PiP controls
    targetPlaceholder: 'Название кнопки или поля (например: Сохранить, Экспорт)...',
    actionType: 'Тип действия',
    instruction: 'Инструкция',
    stepDone: '✓ Готово (Продолжить съёмку)',
    openInEditor: 'Редактор шага',
    deleteStep: 'Удалить этот шаг',
    autoModeActive: 'Авто-режим активен',
    closeRemote: 'Закрыть плавающее окно',
    hideRemote: 'Скрыть мини-пульт',
    finishCapture: '⏹ Завершить',
    nextStepBtn: '▶️ Вернуться к эфиру для следующего шага',
    anotherStepOnFrame: '➕ Шаг на тот же кадр',
    frozenModeBadge: 'ЗАМОРОЖЕН ШАГ',
    liveModeBadge: 'ЭФИР',

    // Feedback messages
    captureStartedMsg: 'Захват экрана запущен. Выделяйте область для создания шага!',
    captureStoppedMsg: 'Захват экрана остановлен',
    captureErrorMsg: 'Не удалось запустить захват экрана.',
    noFrameForBlur: 'Нет отснятого кадра для применения замазывания',
    blurApplied: 'Приватная зона замазана (Blur)',
    firstSnapAFrame: 'Сначала снимите кадр',
    stepAddedSameFrame: 'Шаг #{n} добавлен на этот же кадр!',
    stepCapturedMsg: '📸 Кадр снят и создан шаг #{n}! Уточните рамку при необходимости.',
    boxUpdatedMsg: 'Рамка шага обновлена!',
    fullFrameCapturedMsg: '📸 Полный кадр сохранён (Шаг #{n})',
    stepDeletedMsg: 'Шаг удален',
    importedFromClipboard: 'Скриншот импортирован из буфера/файла (Шаг #{n})',
    importError: 'Ошибка импорта изображения',
    quickComment: 'Быстрый комментарий',
    stepEmptyPromptTitle: 'Снимите шаг на экране',
    stepEmptyPromptDesc: 'Выделите область кнопкой мыши прямо на видео-превью. Кадр моментально зафиксируется, и здесь откроются быстрые комментарии.',
    tipDrag: '1. Зажмите ЛКМ и обведите нужную кнопку',
    tipClick: '2. Или просто кликните в нужную точку',
    tipVoice: '3. Диктуйте голосом без токенов и ИИ',
    timelineTitle: 'Шаги',
    noStepsYet: 'Шагов пока нет. Сделайте первый снимок на превью экрана выше!',
    photoStep: 'Фото #',
    pipFallbackMsg: 'Режим Document Picture-in-Picture недоступен в этом браузере. Открыт плавающий пульт на странице.',
  },
};

export const LiveCaptureWorkspace: React.FC<LiveCaptureWorkspaceProps> = ({
  project,
  screenshots,
  onProjectUpdated,
  onOpenEditorStep,
  uiLang = 'en',
}) => {
  // --- Language State ---
  const [lang, setLang] = useState<'en' | 'ru'>(uiLang);
  useEffect(() => {
    setLang(uiLang);
  }, [uiLang]);
  const text = translations[lang];

  // --- Stream & Video State ---
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Document Picture-in-Picture State ---
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [showInAppMiniRemote, setShowInAppMiniRemote] = useState(false);
  const [pipViewMode, setPipViewMode] = useState<PipViewMode>('live');

  // --- Active Draw Mode & Interaction ---
  const [drawMode, setDrawMode] = useState<DrawMode>('shoot');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoxRect | null>(null);

  // --- Quick Step Editing / Commenting Panel ---
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [targetNameInput, setTargetNameInput] = useState('');
  const [activeActionType, setActiveActionType] = useState<ActionType>('click');
  const [instructionText, setInstructionText] = useState('');

  // --- Voice Dictation State ---
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'ru-RU' | 'en-US'>(uiLang === 'ru' ? 'ru-RU' : 'en-US');
  const [liveTranscript, setLiveTranscript] = useState('');
  const voiceControllerRef = useRef<VoiceDictationController | null>(null);

  // --- Notification / Feedback Banner ---
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // --- Screenshot Object URL Cache ---
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const urls: Record<string, string> = {};
    screenshots.forEach((s) => {
      urls[s.id] = URL.createObjectURL(s.blob);
    });
    setAssetUrls(urls);

    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [screenshots]);

  const showBanner = useCallback((msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => {
      setBannerMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // --- Voice Controller Initialization ---
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) return;

    const controller = new VoiceDictationController(voiceLang);
    voiceControllerRef.current = controller;

    controller.onTranscript = (transcript: string) => {
      setLiveTranscript(transcript);
    };

    controller.onParsedStep = (parsed: ParsedVoiceStep) => {
      setActiveActionType(parsed.act);
      if (parsed.targetName) {
        setTargetNameInput(parsed.targetName);
      }
      const unifiedText = lang === 'ru' ? (parsed.ru || parsed.en) : (parsed.en || parsed.ru);
      setInstructionText(unifiedText);
      if (activeStepId) {
        const updatedSteps = project.steps.map((s) =>
          s.id === activeStepId ? { ...s, act: parsed.act, ru: unifiedText, en: unifiedText } : s
        );
        updateProject(project.id, { steps: updatedSteps }).then(() => onProjectUpdated());
      }
      showBanner(`${text.voiceHeard}${unifiedText}`);
    };

    controller.onStateChange = (listening: boolean) => {
      setIsVoiceActive(listening);
      if (!listening) {
        setLiveTranscript('');
      }
    };

    controller.onError = (err: string) => {
      console.warn('Voice recognition error:', err);
      setIsVoiceActive(false);
    };

    return () => {
      controller.destroy();
      voiceControllerRef.current = null;
    };
  }, [showBanner, voiceLang, lang, text.voiceHeard]);

  // Sync voice language changes
  const handleToggleVoiceLang = () => {
    const nextLang = voiceLang === 'ru-RU' ? 'en-US' : 'ru-RU';
    setVoiceLang(nextLang);
    voiceControllerRef.current?.setLanguage(nextLang);
  };

  const handleToggleVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      showBanner(text.voiceNotSupported);
      return;
    }
    const controller = voiceControllerRef.current;
    if (!controller) return;

    if (isVoiceActive) {
      controller.stop();
    } else {
      controller.start(voiceLang);
    }
  };

  // --- Attach MediaStream to Video Elements ---
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => console.warn('Video play error:', err));
    }
    if (pipVideoRef.current && stream) {
      pipVideoRef.current.srcObject = stream;
      pipVideoRef.current.play().catch((err) => console.warn('PiP Video play error:', err));
    }
  }, [stream]);

  // --- Register PiP Close Listener ---
  useEffect(() => {
    const unsubscribe = onPipClose(() => {
      setPipWindow(null);
      setPipViewMode('live');
    });
    return () => unsubscribe();
  }, []);

  // --- Screen Capture Management ---
  const handleStartCapture = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setIsCapturingScreen(true);
      setPipViewMode('live');

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          handleStopCapture();
        };

        const settings = track.getSettings();
        if (settings.width && settings.height) {
          setVideoResolution({ width: settings.width, height: settings.height });
        }
      }

      showBanner(text.captureStartedMsg);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('getDisplayMedia error:', err);
        showBanner(text.captureErrorMsg);
      }
    }
  };

  const handleStopCapture = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setStream(null);
    setIsCapturingScreen(false);
    setVideoResolution(null);
    if (pipVideoRef.current) pipVideoRef.current.srcObject = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    showBanner(text.captureStoppedMsg);
  };

  const handleRestartCapture = async () => {
    handleStopCapture();
    setTimeout(() => {
      handleStartCapture();
    }, 250);
  };

  // --- Picture-in-Picture Remote Controls ---
  const handleTogglePip = async () => {
    if (pipWindow) {
      closePipWindow();
      setPipWindow(null);
      return;
    }

    if (isPipSupported()) {
      const win = await openPipWindow({ width: 520, height: 640 });
      if (win) {
        setPipWindow(win);
        // Connect stream to video in PiP window
        setTimeout(() => {
          if (pipVideoRef.current && stream) {
            pipVideoRef.current.srcObject = stream;
            pipVideoRef.current.play().catch(() => {});
          }
        }, 150);
      }
    } else {
      // Fallback: show in-page floating mini-remote
      setShowInAppMiniRemote((prev) => !prev);
      showBanner(text.pipFallbackMsg);
    }
  };

  // --- High-Resolution Frame Capture Helper ---
  const captureCurrentVideoFrame = async (): Promise<Blob> => {
    const video = videoRef.current || pipVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('Video stream is not available to capture frame');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D canvas context');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG Blob'));
      }, 'image/png');
    });
  };

  // --- Active Step & Last Screenshot Data ---
  const activeStep = useMemo(() => {
    if (!activeStepId) return null;
    return project.steps.find((s) => s.id === activeStepId) || null;
  }, [activeStepId, project.steps]);

  const activeStepIndex = useMemo(() => {
    if (!activeStep) return -1;
    return project.steps.findIndex((s) => s.id === activeStep.id);
  }, [activeStep, project.steps]);

  const lastCapturedScreenshot = useMemo(() => {
    if (!screenshots.length) return null;
    if (activeStep) {
      return screenshots.find((s) => s.id === activeStep.screenshotId) || screenshots[screenshots.length - 1];
    }
    return screenshots[screenshots.length - 1];
  }, [screenshots, activeStep]);

  // Sync quick editor fields when activeStep changes
  useEffect(() => {
    if (activeStep) {
      setActiveActionType(activeStep.act);
      const unifiedText = lang === 'ru' ? (activeStep.ru || activeStep.en) : (activeStep.en || activeStep.ru);
      setInstructionText(unifiedText || '');
      const match = (activeStep.ru || '').match(/<b>(.*?)<\/b>/i) || (activeStep.en || '').match(/<b>(.*?)<\/b>/i);
      setTargetNameInput(match ? match[1] : '');
    }
  }, [activeStep, lang]);

  // --- Coordinate Mapping Helpers (Normalized 0..100) ---
  const getNormalizedPoint = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    media: HTMLVideoElement | HTMLImageElement | null
  ): { x: number; y: number } => {
    const rect = container.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    let mediaW = 0;
    let mediaH = 0;
    if (media instanceof HTMLVideoElement) {
      mediaW = media.videoWidth;
      mediaH = media.videoHeight;
    } else if (media instanceof HTMLImageElement) {
      mediaW = media.naturalWidth;
      mediaH = media.naturalHeight;
    }

    if (mediaW && mediaH) {
      const mediaAspect = mediaW / mediaH;
      const containerAspect = rect.width / rect.height;

      let renderW = rect.width;
      let renderH = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspect > mediaAspect) {
        renderH = rect.height;
        renderW = renderH * mediaAspect;
        offsetX = (rect.width - renderW) / 2;
      } else {
        renderW = rect.width;
        renderH = renderW / mediaAspect;
        offsetY = (rect.height - renderH) / 2;
      }

      const clampedX = Math.max(0, Math.min(renderW, clickX - offsetX));
      const clampedY = Math.max(0, Math.min(renderH, clickY - offsetY));

      return {
        x: (clampedX / renderW) * 100,
        y: (clampedY / renderH) * 100,
      };
    }

    return {
      x: Math.max(0, Math.min(100, (clickX / rect.width) * 100)),
      y: Math.max(0, Math.min(100, (clickY / rect.height) * 100)),
    };
  };

  // --- Interactive Draw-to-Shoot & Refine Handler ---
  const handleInteractionStart = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    media: HTMLVideoElement | HTMLImageElement | null
  ) => {
    const point = getNormalizedPoint(clientX, clientY, container, media);
    setIsMouseDown(true);
    setStartPoint(point);
    setCurrentBox({ x: point.x, y: point.y, w: 0, h: 0 });
  };

  const handleInteractionMove = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    media: HTMLVideoElement | HTMLImageElement | null
  ) => {
    if (!isMouseDown || !startPoint) return;
    const current = getNormalizedPoint(clientX, clientY, container, media);

    const x = Math.min(startPoint.x, current.x);
    const y = Math.min(startPoint.y, current.y);
    const w = Math.abs(current.x - startPoint.x);
    const h = Math.abs(current.y - startPoint.y);

    setCurrentBox({ x, y, w, h });
  };

  const handleInteractionEnd = async (isFrozenContext = false) => {
    if (!isMouseDown || !startPoint) return;
    setIsMouseDown(false);

    let finalBox: BoxRect;
    const box = currentBox;

    // If mouse was simply clicked without drag (< 1.5%), make default 12% x 7% box around click
    if (!box || (box.w < 1.5 && box.h < 1.5)) {
      const bw = 12;
      const bh = 7;
      finalBox = {
        x: Math.max(0, Math.min(100 - bw, startPoint.x - bw / 2)),
        y: Math.max(0, Math.min(100 - bh, startPoint.y - bh / 2)),
        w: bw,
        h: bh,
      };
    } else {
      finalBox = {
        x: Math.round(box.x * 10) / 10,
        y: Math.round(box.y * 10) / 10,
        w: Math.max(1, Math.round(box.w * 10) / 10),
        h: Math.max(1, Math.round(box.h * 10) / 10),
      };
    }

    setStartPoint(null);
    setCurrentBox(null);

    // If we are in Frozen context (refining existing step's box)
    if (isFrozenContext && activeStep) {
      const defaultCursor = computeDefaultCursorPos(finalBox);
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id
          ? {
              ...s,
              box: finalBox,
              cursorPos: defaultCursor,
            }
          : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
      showBanner(text.boxUpdatedMsg);
      return;
    }

    // Branch by DrawMode:
    if (drawMode === 'blur') {
      if (!lastCapturedScreenshot) {
        showBanner(text.noFrameForBlur);
        return;
      }
      const updatedBlurBoxes = [...lastCapturedScreenshot.blurBoxes, finalBox];
      await updateScreenshot(lastCapturedScreenshot.id, { blurBoxes: updatedBlurBoxes });
      await onProjectUpdated();
      showBanner(text.blurApplied);
      setDrawMode('shoot');
      return;
    }

    if (drawMode === 'add_step_same_frame') {
      if (!lastCapturedScreenshot) {
        showBanner(text.firstSnapAFrame);
        return;
      }
      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('click', '');
      const unifiedText = lang === 'ru' ? initialInstructions.ru : initialInstructions.en;
      const defaultCursor = computeDefaultCursorPos(finalBox);
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: lastCapturedScreenshot.id,
        act: 'click',
        box: finalBox,
        cursorPos: defaultCursor,
        ru: unifiedText,
        en: unifiedText,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      setTargetNameInput('');
      setInstructionText(unifiedText);
      setPipViewMode('frozen');
      showBanner(text.stepAddedSameFrame.replace('{n}', String(project.steps.length + 1)));
      setDrawMode('shoot');
      return;
    }

    // Default: 'shoot' mode -> Capture frame from video and create new step
    try {
      const blob = await captureCurrentVideoFrame();
      const filename = `shot_${Date.now()}.png`;
      const asset = await addScreenshot(project.id, blob, filename);

      const newStepId = generateId();
      const initialInstructions = formatActionInstruction(activeActionType, targetNameInput);
      const unifiedText = lang === 'ru' ? initialInstructions.ru : initialInstructions.en;
      const defaultCursor = computeDefaultCursorPos(finalBox);
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: activeActionType,
        box: finalBox,
        cursorPos: defaultCursor,
        ru: unifiedText,
        en: unifiedText,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();

      setActiveStepId(newStepId);
      setInstructionText(unifiedText);
      setPipViewMode('frozen');
      showBanner(text.stepCapturedMsg.replace('{n}', String(project.steps.length + 1)));
    } catch (err: any) {
      console.error('Error capturing shot:', err);
      showBanner(text.captureErrorMsg);
    }
  };

  // --- Explicit Snap Frame & Highlight Button ---
  const handleSnapAndFreeze = async () => {
    try {
      const blob = await captureCurrentVideoFrame();
      const filename = `shot_${Date.now()}.png`;
      const asset = await addScreenshot(project.id, blob, filename);

      const newStepId = generateId();
      const initialBox: BoxRect = { x: 30, y: 35, w: 28, h: 14 };
      const initialInstructions = formatActionInstruction(activeActionType, targetNameInput);
      const unifiedText = lang === 'ru' ? initialInstructions.ru : initialInstructions.en;
      const defaultCursor = computeDefaultCursorPos(initialBox);
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: activeActionType,
        box: initialBox,
        cursorPos: defaultCursor,
        ru: unifiedText,
        en: unifiedText,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();

      setActiveStepId(newStepId);
      setInstructionText(unifiedText);
      setPipViewMode('frozen');
      showBanner(text.stepCapturedMsg.replace('{n}', String(project.steps.length + 1)));
    } catch (err: any) {
      console.error('Error snapping frame:', err);
      showBanner(text.captureErrorMsg);
    }
  };

  // --- Snapshot Full Frame Button ---
  const handleCaptureFullFrame = async () => {
    try {
      const blob = await captureCurrentVideoFrame();
      const filename = `shot_full_${Date.now()}.png`;
      const asset = await addScreenshot(project.id, blob, filename);

      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('look', '');
      const unifiedText = lang === 'ru' ? initialInstructions.ru : initialInstructions.en;
      const initialBox: BoxRect = { x: 15, y: 15, w: 70, h: 70 };
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: 'look',
        box: initialBox,
        cursorPos: computeDefaultCursorPos(initialBox),
        ru: unifiedText,
        en: unifiedText,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      setInstructionText(unifiedText);
      setPipViewMode('frozen');
      showBanner(text.fullFrameCapturedMsg.replace('{n}', String(project.steps.length + 1)));
    } catch (err: any) {
      console.error(err);
      showBanner(text.captureErrorMsg);
    }
  };

  // --- Quick Panel Updates ---
  const handleUpdateStepAction = async (newAct: ActionType) => {
    setActiveActionType(newAct);
    const updated = formatActionInstruction(newAct, targetNameInput);
    const unified = lang === 'ru' ? updated.ru : updated.en;
    setInstructionText(unified);

    if (activeStep) {
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id ? { ...s, act: newAct, ru: unified, en: unified } : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleTargetNameChange = async (newName: string) => {
    setTargetNameInput(newName);
    const formatted = formatActionInstruction(activeActionType, newName);
    const unified = lang === 'ru' ? formatted.ru : formatted.en;
    setInstructionText(unified);

    if (activeStep) {
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id ? { ...s, ru: unified, en: unified } : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleInstructionChange = async (val: string) => {
    setInstructionText(val);
    if (activeStep) {
      const updatedSteps = project.steps.map((s) => (s.id === activeStep.id ? { ...s, ru: val, en: val } : s));
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  // --- InteractiveBoxEditor Callbacks for Frozen Step and PiP ---
  const handleStepBoxAndCursorChange = useCallback(
    async (newBox: BoxRect, newCursorPos: { x: number; y: number }) => {
      if (!activeStep) return;
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id
          ? {
              ...s,
              box: newBox,
              cursorPos: newCursorPos,
            }
          : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
      showBanner(text.boxUpdatedMsg);
    },
    [activeStep, project.id, project.steps, onProjectUpdated, showBanner, text.boxUpdatedMsg]
  );

  const handleBoxDrawComplete = useCallback(
    async (drawnBox: BoxRect, mode: 'target' | 'blur' | 'globalBlur' | 'mask') => {
      if (mode === 'blur') {
        if (!lastCapturedScreenshot) return;
        const updatedBlurBoxes = [...lastCapturedScreenshot.blurBoxes, drawnBox];
        await updateScreenshot(lastCapturedScreenshot.id, { blurBoxes: updatedBlurBoxes });
        await onProjectUpdated();
        showBanner(text.blurApplied);
        setDrawMode('shoot');
      }
    },
    [lastCapturedScreenshot, onProjectUpdated, showBanner, text.blurApplied]
  );

  const handleDeleteActiveStep = async () => {
    if (!activeStepId) return;
    const updatedSteps = project.steps.filter((s) => s.id !== activeStepId);
    await updateProject(project.id, { steps: updatedSteps });
    await onProjectUpdated();
    setActiveStepId(null);
    setPipViewMode('live');
    showBanner(text.stepDeletedMsg);
  };

  // --- Clipboard (Ctrl+V) & File Upload Support ---
  const handleImportImageBlob = async (blob: Blob, name: string) => {
    try {
      const asset = await addScreenshot(project.id, blob, name);
      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('click', '');
      const unifiedText = lang === 'ru' ? initialInstructions.ru : initialInstructions.en;
      const initialBox: BoxRect = { x: 30, y: 30, w: 20, h: 10 };
      const defaultCursor = computeDefaultCursorPos(initialBox);
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: 'click',
        box: initialBox,
        cursorPos: defaultCursor,
        ru: unifiedText,
        en: unifiedText,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      setInstructionText(unifiedText);
      setPipViewMode('frozen');
      showBanner(text.importedFromClipboard.replace('{n}', String(project.steps.length + 1)));
    } catch (err: any) {
      console.error('Failed to import image blob:', err);
      showBanner(text.importError);
    }
  };

  // Global Ctrl+V listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await handleImportImageBlob(file, `clipboard_${Date.now()}.png`);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [project, onProjectUpdated]);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    for (let i = 0; i < files.length; i++) {
      await handleImportImageBlob(files[i], files[i].name);
    }
    e.target.value = '';
  };

  // --- Helper to render live selection box overlay ---
  const renderSelectionOverlay = (box: BoxRect | null) => {
    if (!box) return null;
    return (
      <div
        className="absolute border-2 border-rose-500 bg-rose-500/20 pointer-events-none transition-all shadow-[0_0_14px_rgba(244,63,94,0.8)] z-20"
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.w}%`,
          height: `${box.h}%`,
        }}
      >
        <div className="absolute -top-6 left-0 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
          {Math.round(box.w)}% × {Math.round(box.h)}%
        </div>
      </div>
    );
  };

  // --- Render Floating Remote Controls (Both for PiP Portal and In-App Widget) ---
  const renderRemoteControls = (isPip: boolean) => {
    const isFrozen = pipViewMode === 'frozen' && Boolean(activeStep && assetUrls[activeStep.screenshotId]);
    const currentStepNum = activeStepIndex >= 0 ? activeStepIndex + 1 : project.steps.length;

    return (
      <div
        className={`flex flex-col h-full ${
          isPip
            ? 'p-3 bg-slate-950 text-slate-100 select-none'
            : 'p-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 select-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {isCapturingScreen && !isFrozen && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isFrozen
                    ? 'bg-sky-400 ring-2 ring-sky-500/40'
                    : isCapturingScreen
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
              {isFrozen ? (
                <span className="text-sky-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  {text.frozenModeBadge} #{currentStepNum}
                </span>
              ) : isCapturingScreen ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  {text.liveModeBadge}
                </span>
              ) : (
                text.waitingBadge
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              {text.stepsCount} <strong className="text-emerald-400">{project.steps.length}</strong>
            </span>

            {/* Language Quick Toggle */}
            <button
              onClick={() => setLang((prev) => (prev === 'en' ? 'ru' : 'en'))}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold text-slate-300 border border-slate-700 transition"
              title="Switch language (EN / RU)"
            >
              {lang.toUpperCase()}
            </button>

            {isPip ? (
              <button
                onClick={() => closePipWindow()}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                title={text.closeRemote}
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowInAppMiniRemote(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                title={text.hideRemote}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Viewport Area: Live Video OR Frozen Step */}
        <div
          ref={pipContainerRef}
          onMouseDown={!isFrozen ? (e) => {
            handleInteractionStart(e.clientX, e.clientY, pipContainerRef.current!, pipVideoRef.current);
          } : undefined}
          onMouseMove={!isFrozen ? (e) => {
            handleInteractionMove(e.clientX, e.clientY, pipContainerRef.current!, pipVideoRef.current);
          } : undefined}
          onMouseUp={!isFrozen ? () => handleInteractionEnd(false) : undefined}
          className={`relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border mb-1.5 select-none transition ${
            isFrozen ? 'border-sky-500/80 ring-2 ring-sky-500/30' : 'border-slate-800 cursor-crosshair'
          }`}
        >
          {/* Always keep video element alive to prevent stream interruptions */}
          <video
            ref={pipVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain pointer-events-none ${isFrozen ? 'hidden' : 'block'}`}
          />

          {/* Frozen Step Interactive Box & Cursor Editor */}
          {isFrozen && activeStep && assetUrls[activeStep.screenshotId] && (
            <div className="relative w-full h-full">
              <InteractiveBoxEditor
                imageUrl={assetUrls[activeStep.screenshotId]}
                box={activeStep.box}
                cursorPos={activeStep.cursorPos || computeDefaultCursorPos(activeStep.box)}
                stepNumber={currentStepNum}
                actionType={activeStep.act}
                uiLang={lang}
                blurBoxes={lastCapturedScreenshot?.blurBoxes}
                globalBlurBoxes={project.globalBlurBoxes}
                maskBoxes={lastCapturedScreenshot?.maskBoxes}
                onChangeBoxAndCursor={handleStepBoxAndCursorChange}
                onDrawComplete={handleBoxDrawComplete}
                drawMode={drawMode === 'blur' ? 'blur' : 'target'}
              />

              {/* Frozen Badge Banner */}
              <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-md backdrop-blur flex items-center gap-1.5 pointer-events-none z-30">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>{text.stepCapturedTitle.replace('{n}', String(currentStepNum))}</span>
              </div>
            </div>
          )}

          {/* Current Dragging Selection Overlay for Live Stream */}
          {!isFrozen && renderSelectionOverlay(currentBox)}

          {/* Hover Helper Tip Pill for Live Stream */}
          {!isFrozen && (
            <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition">
              <span className="text-[10px] bg-slate-900/95 text-slate-200 px-2 py-0.5 rounded shadow border border-slate-700">
                {text.livePreviewHint}
              </span>
            </div>
          )}
        </div>

        {/* Helpful Tip in PiP Floating Remote */}
        {isFrozen && (
          <div className="mb-2 px-2.5 py-1.5 bg-slate-900/95 border border-slate-800 rounded-lg text-[11px] text-amber-300 leading-tight flex items-center gap-1.5 shadow-sm">
            <span>{text.boxEditorHint}</span>
          </div>
        )}

        {/* Primary Action Button Bar */}
        <div className="mb-2">
          {isFrozen ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPipViewMode('live');
                  setActiveStepId(null);
                  setTargetNameInput('');
                  setLiveTranscript('');
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-lg shadow-emerald-950/50 transition transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{text.nextStepBtn}</span>
              </button>

              <button
                onClick={() => {
                  setDrawMode('add_step_same_frame');
                  showBanner(lang === 'en' ? 'Drag on the frozen frame to add another box' : 'Обведите область на этом кадре для второго шага');
                }}
                className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium py-2 px-2.5 rounded-lg transition"
                title={text.anotherStepOnFrame}
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>{lang === 'en' ? '+ Same Frame' : '+ Тот же кадр'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSnapAndFreeze}
                disabled={!isCapturingScreen}
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-lg shadow-emerald-950/50 transition transform active:scale-95"
              >
                <Scissors className="w-4 h-4" />
                <span>{text.snapAndDraw}</span>
              </button>

              <button
                onClick={handleCaptureFullFrame}
                disabled={!isCapturingScreen}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium text-xs py-2 px-2.5 rounded-lg border border-slate-700 transition"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>{text.snapFullFrame}</span>
              </button>
            </div>
          )}
        </div>

        {/* Step Configuration Controls (Active when a step is captured) */}
        {activeStep && (
          <div className="flex flex-col gap-2 mb-2 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
            {/* Action Chips */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {text.actionType}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {activeStep.act.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {ACTION_PRESETS.map((preset) => {
                  const isSelected = activeActionType === preset.act;
                  const label = lang === 'en' ? preset.labelEn : preset.labelRu;
                  return (
                    <button
                      key={preset.act}
                      onClick={() => handleUpdateStepAction(preset.act)}
                      className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-semibold border transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {preset.act === 'click' && <MousePointer className="w-3 h-3" />}
                      {preset.act === 'type' && <Type className="w-3 h-3" />}
                      {preset.act === 'select' && <ListFilter className="w-3 h-3" />}
                      {preset.act === 'look' && <Eye className="w-3 h-3" />}
                      {preset.act === 'scroll' && <ArrowDown className="w-3 h-3" />}
                      {preset.act === 'drag' && <Move className="w-3 h-3" />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Button Name Input */}
            <div>
              <input
                type="text"
                value={targetNameInput}
                onChange={(e) => handleTargetNameChange(e.target.value)}
                placeholder={text.targetPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Unified Instruction Input */}
            <div>
              <input
                type="text"
                value={instructionText}
                onChange={(e) => handleInstructionChange(e.target.value)}
                placeholder={text.instruction}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        )}

        {/* Voice Dictation & Status Bar */}
        <div className="flex items-center gap-2 mb-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
          <button
            onClick={handleToggleVoice}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
              isVoiceActive
                ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Web Speech API Dictation"
          >
            {isVoiceActive ? <Mic className="w-3.5 h-3.5 text-white" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isVoiceActive ? text.listening : text.voice}</span>
          </button>

          <button
            onClick={handleToggleVoiceLang}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold text-slate-300 border border-slate-700 transition"
            title="Toggle Voice Language (EN / RU)"
          >
            {voiceLang === 'ru-RU' ? 'RU' : 'EN'}
          </button>

          <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-400">
            {liveTranscript || (isVoiceActive ? text.listening : text.voicePrompt)}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800">
          {activeStep ? (
            <div className="flex items-center gap-2">
              {onOpenEditorStep && (
                <button
                  onClick={() => onOpenEditorStep(activeStep.id)}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{text.openInEditor}</span>
                </button>
              )}
              <button
                onClick={handleDeleteActiveStep}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium transition"
                title={text.deleteStep}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Delete' : 'Удалить'}</span>
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">{text.autoModeActive}</div>
          )}

          <button
            onClick={handleStopCapture}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium transition"
          >
            <VideoOff className="w-3.5 h-3.5" />
            <span>{text.finishCapture}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none">
      {/* Top Banner Alert if active */}
      {bannerMessage && (
        <div className="bg-emerald-600/90 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
            <span>{bannerMessage}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="p-0.5 hover:bg-emerald-700 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        {/* Left: Stream Control & Status */}
        <div className="flex items-center gap-3">
          {!isCapturingScreen ? (
            <button
              onClick={handleStartCapture}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-lg shadow-emerald-950/50 transition transform active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>{text.startCapture}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStopCapture}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow-lg shadow-rose-950/50 transition transform active:scale-95"
              >
                <VideoOff className="w-4 h-4" />
                <span>{text.stopCapture}</span>
              </button>

              <button
                onClick={handleRestartCapture}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition"
                title="Re-pick the shared window or browser tab"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>{text.changeSource}</span>
              </button>
            </div>
          )}

          {isCapturingScreen && (
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>{text.liveBadge}</span>
              {videoResolution && (
                <span className="text-slate-400 font-mono text-[11px]">
                  ({videoResolution.width}×{videoResolution.height})
                </span>
              )}
            </div>
          )}

          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>{text.headerTip}</span>
          </div>
        </div>

        {/* Center / Right: Remote & Mode Toggles */}
        <div className="flex items-center gap-2">
          {/* Picture-in-Picture Remote Button */}
          <button
            onClick={handleTogglePip}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              pipWindow || showInAppMiniRemote
                ? 'bg-sky-600 text-white border-sky-500 shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={text.popOutPipTip}
          >
            <Square className="w-4 h-4 text-sky-400" />
            <span>{pipWindow || showInAppMiniRemote ? text.popOutPipActive : text.popOutPip}</span>
          </button>

          {/* Voice Input Button */}
          <button
            onClick={handleToggleVoice}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              isVoiceActive
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Speech Dictation"
          >
            {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-slate-400" />}
            <span>{isVoiceActive ? text.listening : text.voice}</span>
          </button>

          {/* Language Switcher (EN / RU) */}
          <button
            onClick={() => {
              const next = lang === 'en' ? 'ru' : 'en';
              setLang(next);
              setVoiceLang(next === 'ru' ? 'ru-RU' : 'en-US');
            }}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 border border-slate-700 transition"
            title="Switch UI & Dictation language"
          >
            {lang.toUpperCase()}
          </button>

          {/* Manual File Upload Button */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>{text.uploadImage}</span>
            <input type="file" accept="image/*" multiple onChange={handleFileInputChange} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Live Video Canvas Area */}
        <div className="flex-1 flex flex-col relative bg-slate-950 p-4 overflow-y-auto">
          {/* NOTICE BANNER: Video is running, but PiP remote is NOT open yet! (Requirement 3) */}
          {isCapturingScreen && !pipWindow && !showInAppMiniRemote && (
            <div className="bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-emerald-500/20 border-2 border-amber-500/80 rounded-xl p-4 mb-3 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500 text-slate-950 rounded-lg shrink-0 mt-0.5 shadow">
                  <Square className="w-5 h-5 font-bold" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-200 mb-0.5">
                    {text.pipWarningTitle}
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed max-w-2xl">
                    {text.pipWarningBody}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                <button
                  onClick={handleTogglePip}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-sky-950/50 transition transform hover:scale-[1.02]"
                >
                  <Square className="w-4 h-4 text-sky-200" />
                  <span>{text.openPipNow}</span>
                </button>

                <button
                  onClick={handleRestartCapture}
                  className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg transition"
                  title="Change shared tab or window"
                >
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>{text.changeSource}</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Mode Toolbar */}
          {isCapturingScreen && (
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {text.selectionMode}
                </span>

                <button
                  onClick={() => setDrawMode('shoot')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    drawMode === 'shoot'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{text.modeShoot}</span>
                </button>

                <button
                  onClick={() => setDrawMode('add_step_same_frame')}
                  disabled={!lastCapturedScreenshot}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40 transition ${
                    drawMode === 'add_step_same_frame'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Add another highlight box to the current screenshot"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{text.modeSameFrame}</span>
                </button>

                <button
                  onClick={() => setDrawMode('blur')}
                  disabled={!lastCapturedScreenshot}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40 transition ${
                    drawMode === 'blur'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Blur sensitive private areas"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{text.modeBlur}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSnapAndFreeze}
                  disabled={!isCapturingScreen}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-md text-xs font-semibold shadow transition"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{text.snapAndDraw}</span>
                </button>

                <button
                  onClick={handleCaptureFullFrame}
                  disabled={!isCapturingScreen}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-md text-xs font-medium border border-slate-700 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{text.snapFullFrame}</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Screen Container */}
          <div
            ref={containerRef}
            onMouseDown={isCapturingScreen ? (e) => {
              handleInteractionStart(e.clientX, e.clientY, containerRef.current!, videoRef.current);
            } : undefined}
            onMouseMove={isCapturingScreen ? (e) => {
              handleInteractionMove(e.clientX, e.clientY, containerRef.current!, videoRef.current);
            } : undefined}
            onMouseUp={isCapturingScreen ? () => handleInteractionEnd(false) : undefined}
            className={`flex-1 relative rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex items-center justify-center select-none min-h-[380px] ${
              isCapturingScreen ? 'cursor-crosshair' : ''
            } ${
              drawMode === 'blur'
                ? 'ring-2 ring-amber-500/50'
                : drawMode === 'add_step_same_frame'
                ? 'ring-2 ring-sky-500/50'
                : ''
            }`}
          >
            {isCapturingScreen ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : lastCapturedScreenshot && assetUrls[lastCapturedScreenshot.id] ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <InteractiveBoxEditor
                  imageUrl={assetUrls[lastCapturedScreenshot.id]}
                  box={activeStep?.box || null}
                  cursorPos={activeStep?.cursorPos || (activeStep?.box ? computeDefaultCursorPos(activeStep.box) : null)}
                  stepNumber={activeStepIndex >= 0 ? activeStepIndex + 1 : undefined}
                  actionType={activeStep?.act}
                  uiLang={lang}
                  blurBoxes={lastCapturedScreenshot?.blurBoxes}
                  globalBlurBoxes={project.globalBlurBoxes}
                  maskBoxes={lastCapturedScreenshot?.maskBoxes}
                  onChangeBoxAndCursor={handleStepBoxAndCursorChange}
                  onDrawComplete={handleBoxDrawComplete}
                  drawMode={drawMode === 'blur' ? 'blur' : 'target'}
                />

                {/* Helpful Tip Hint Pill */}
                {activeStep && (
                  <div className="absolute bottom-3 bg-slate-900/90 backdrop-blur border border-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-none shadow-lg z-30 text-amber-300">
                    <span>{text.boxEditorHint}</span>
                  </div>
                )}
              </div>
            ) : (
              /* ONBOARDING CARDS: 3 Clear Steps Before Capture (Requirement 2) */
              <div className="flex flex-col items-center justify-center p-6 max-w-4xl w-full">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-100 mb-1.5 flex items-center justify-center gap-2">
                    <Monitor className="w-6 h-6 text-emerald-400" />
                    <span>{lang === 'en' ? 'Live Screen Capture & Guide Recording' : 'Живая запись руководства с экрана'}</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl mx-auto">
                    {lang === 'en'
                      ? 'Follow 3 simple steps below to record your BI workflow effortlessly without mirror loops or lost windows.'
                      : 'Следуйте 3 простым шагам ниже, чтобы комфортно записать инструкцию без зеркального эффекта и путаницы в окнах.'}
                  </p>
                </div>

                {/* 3 Step Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-6">
                  {/* Card 1 */}
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-emerald-500/60 transition">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold shadow">
                          1
                        </span>
                        <h4 className="text-xs font-bold text-emerald-300">
                          {text.step1Title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                        {text.step1Desc}
                      </p>
                    </div>

                    <button
                      onClick={handleStartCapture}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-3 rounded-lg shadow-lg shadow-emerald-950/50 transition transform group-hover:scale-[1.02]"
                    >
                      <Video className="w-4 h-4" />
                      <span>{text.startCaptureBtn}</span>
                    </button>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-sky-500/60 transition">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/10 rounded-bl-full pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold shadow">
                          2
                        </span>
                        <h4 className="text-xs font-bold text-sky-300">
                          {text.step2Title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                        {text.step2Desc}
                      </p>
                    </div>

                    <button
                      onClick={handleTogglePip}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs py-2.5 px-3 rounded-lg transition"
                    >
                      <Square className="w-4 h-4 text-sky-400" />
                      <span>{text.popOutPip}</span>
                    </button>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-rose-500/60 transition">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-full pointer-events-none" />
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold shadow">
                          3
                        </span>
                        <h4 className="text-xs font-bold text-rose-300">
                          {text.step3Title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                        {text.step3Desc}
                      </p>
                    </div>

                    <div className="text-[11px] font-medium text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-center">
                      ✂️ {lang === 'en' ? 'Drag over button = Instant step!' : 'Обвёл кнопку = Готовый шаг!'}
                    </div>
                  </div>
                </div>

                {/* Bottom Alternative Info */}
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                  <span>{text.orPasteImages}</span>
                </div>
              </div>
            )}

            {/* Current Drawing Box Overlay */}
            {renderSelectionOverlay(currentBox)}

            {/* Draw mode indicator pill */}
            {isCapturingScreen && (
              <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-none shadow-lg">
                <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">
                  {drawMode === 'shoot' && (lang === 'en' ? 'Click & drag mouse across any button on preview to Snap & Highlight' : 'Зажмите мышь и выделите кнопку на превью')}
                  {drawMode === 'add_step_same_frame' && (lang === 'en' ? 'Drag over the next button on this frame' : 'Выделите вторую область на текущем кадре')}
                  {drawMode === 'blur' && (lang === 'en' ? 'Drag across area to apply blur' : 'Выделите область, которую нужно замазать (Blur)')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Quick Step Editor / Comments Panel */}
        <div className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
          {activeStep ? (
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                    {lang === 'en' ? `Step #${activeStepIndex + 1}` : `Шаг #${activeStepIndex + 1}`}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">{text.quickComment}</span>
                </div>

                <button
                  onClick={() => setActiveStepId(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step Mini Thumbnail */}
              {assetUrls[activeStep.screenshotId] && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                  <img
                    src={assetUrls[activeStep.screenshotId]}
                    alt="Step preview"
                    className="w-full h-full object-cover opacity-85"
                  />
                  {/* Highlight active step box */}
                  <div
                    className="absolute border-2 border-rose-500 bg-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                    style={{
                      left: `${activeStep.box.x}%`,
                      top: `${activeStep.box.y}%`,
                      width: `${activeStep.box.w}%`,
                      height: `${activeStep.box.h}%`,
                    }}
                  />
                </div>
              )}

              {/* Action Preset Chips */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  {text.actionType}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACTION_PRESETS.map((preset) => {
                    const isSelected = activeActionType === preset.act;
                    const label = lang === 'en' ? preset.labelEn : preset.labelRu;
                    return (
                      <button
                        key={preset.act}
                        onClick={() => handleUpdateStepAction(preset.act)}
                        className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-xs font-medium border transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {preset.act === 'click' && <MousePointer className="w-3 h-3" />}
                        {preset.act === 'type' && <Type className="w-3 h-3" />}
                        {preset.act === 'select' && <ListFilter className="w-3 h-3" />}
                        {preset.act === 'look' && <Eye className="w-3 h-3" />}
                        {preset.act === 'scroll' && <ArrowDown className="w-3 h-3" />}
                        {preset.act === 'drag' && <Move className="w-3 h-3" />}
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Name Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    {lang === 'en' ? 'Target Element / Button Name' : 'Название элемента / кнопки'}
                  </label>
                  <button
                    onClick={handleToggleVoice}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition ${
                      isVoiceActive
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isVoiceActive ? text.listening : text.voice}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={targetNameInput}
                  onChange={(e) => handleTargetNameChange(e.target.value)}
                  placeholder={text.targetPlaceholder}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Unified Instruction Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {text.instruction}
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {lang === 'ru' ? 'Единый текст шага' : 'Unified step text'}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={instructionText}
                  onChange={(e) => handleInstructionChange(e.target.value)}
                  placeholder={lang === 'en' ? 'Click on Save button' : 'Нажмите кнопку Сохранить'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              {/* Quick Actions Footer */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setActiveStepId(null);
                    setPipViewMode('live');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4" />
                  <span>{text.stepDone}</span>
                </button>

                <div className="flex items-center gap-2">
                  {onOpenEditorStep && (
                    <button
                      onClick={() => onOpenEditorStep(activeStep.id)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs py-2 rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      <span>{text.openInEditor}</span>
                    </button>
                  )}

                  <button
                    onClick={handleDeleteActiveStep}
                    className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 transition"
                    title={text.deleteStep}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 flex flex-col items-center justify-center text-center my-auto">
              <div className="p-3 bg-slate-800/60 rounded-full border border-slate-700 mb-3 text-emerald-400">
                <Scissors className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200 mb-1">
                {text.stepEmptyPromptTitle}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-3">
                {text.stepEmptyPromptDesc}
              </p>
              <div className="flex flex-col gap-1.5 w-full text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>{text.tipDrag}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>{text.tipClick}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>{text.tipVoice}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Timeline Gallery of Captured Steps */}
      <footer className="h-28 bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 pr-2 border-r border-slate-800">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>{text.timelineTitle} ({project.steps.length})</span>
        </div>

        {project.steps.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            {text.noStepsYet}
          </div>
        ) : (
          project.steps.map((step, idx) => {
            const isSelected = activeStepId === step.id;
            const imgUrl = assetUrls[step.screenshotId];
            return (
              <div
                key={step.id}
                onClick={() => {
                  setActiveStepId(step.id);
                  setPipViewMode('frozen');
                }}
                className={`relative shrink-0 w-32 h-20 rounded-lg overflow-hidden border cursor-pointer transition transform hover:scale-105 ${
                  isSelected
                    ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg'
                    : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                }`}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                    {text.photoStep}#{idx + 1}
                  </div>
                )}

                {/* Box highlight on thumbnail */}
                <div
                  className="absolute border border-rose-500 bg-rose-500/20"
                  style={{
                    left: `${step.box.x}%`,
                    top: `${step.box.y}%`,
                    width: `${step.box.w}%`,
                    height: `${step.box.h}%`,
                  }}
                />

                {/* Step badge */}
                <div className="absolute top-1 left-1 bg-slate-950/80 backdrop-blur text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                  #{idx + 1}
                </div>

                {/* Action icon badge */}
                <div className="absolute bottom-1 right-1 bg-slate-950/80 backdrop-blur p-1 rounded text-emerald-400">
                  {step.act === 'click' && <MousePointer className="w-2.5 h-2.5" />}
                  {step.act === 'type' && <Type className="w-2.5 h-2.5" />}
                  {step.act === 'select' && <ListFilter className="w-2.5 h-2.5" />}
                  {step.act === 'look' && <Eye className="w-2.5 h-2.5" />}
                  {step.act === 'scroll' && <ArrowDown className="w-2.5 h-2.5" />}
                  {step.act === 'drag' && <Move className="w-2.5 h-2.5" />}
                </div>
              </div>
            );
          })
        )}
      </footer>

      {/* Picture-in-Picture Portal (Real OS Window Always-On-Top) */}
      {pipWindow && createPortal(renderRemoteControls(true), pipWindow.document.body)}

      {/* Fallback In-App Mini Remote Widget */}
      {showInAppMiniRemote && !pipWindow && (
        <div className="fixed bottom-6 right-6 w-96 h-[560px] z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {renderRemoteControls(false)}
        </div>
      )}
    </div>
  );
};
