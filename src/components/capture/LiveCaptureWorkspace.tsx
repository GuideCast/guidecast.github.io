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
} from 'lucide-react';
import type { BoxRect, GuideProject, GuideStep, ScreenshotAsset, ActionType } from '../../types/guide';
import { addScreenshot, updateProject, updateScreenshot, generateId } from '../../db/database';
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
}

type DrawMode = 'shoot' | 'add_step_same_frame' | 'blur';

export const LiveCaptureWorkspace: React.FC<LiveCaptureWorkspaceProps> = ({
  project,
  screenshots,
  onProjectUpdated,
  onOpenEditorStep,
}) => {
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

  // --- Active Draw Mode & Interaction ---
  const [drawMode, setDrawMode] = useState<DrawMode>('shoot');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<BoxRect | null>(null);

  // --- Quick Step Editing / Commenting Panel ---
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [targetNameInput, setTargetNameInput] = useState('');
  const [activeActionType, setActiveActionType] = useState<ActionType>('click');
  const [customRuText, setCustomRuText] = useState('');
  const [customEnText, setCustomEnText] = useState('');

  // --- Voice Dictation State ---
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'ru-RU' | 'en-US'>('ru-RU');
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
    }, 3500);
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
      setCustomRuText(parsed.ru);
      setCustomEnText(parsed.en);
      showBanner(`Голос: ${parsed.ru}`);
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
  }, [showBanner, voiceLang]);

  // Sync voice language changes
  const handleToggleVoiceLang = () => {
    const nextLang = voiceLang === 'ru-RU' ? 'en-US' : 'ru-RU';
    setVoiceLang(nextLang);
    voiceControllerRef.current?.setLanguage(nextLang);
  };

  const handleToggleVoice = () => {
    if (!isSpeechRecognitionSupported()) {
      showBanner('Голосовой ввод не поддерживается в этом браузере.');
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

      showBanner('Захват экрана запущен. Выделяйте область для создания шага!');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.error('getDisplayMedia error:', err);
        showBanner('Не удалось запустить захват экрана.');
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
    showBanner('Захват экрана остановлен');
  };

  // --- Picture-in-Picture Remote Controls ---
  const handleTogglePip = async () => {
    if (pipWindow) {
      closePipWindow();
      setPipWindow(null);
      return;
    }

    if (isPipSupported()) {
      const win = await openPipWindow({ width: 400, height: 560 });
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
      showBanner('Режим Document Picture-in-Picture недоступен в этом браузере. Открыт плавающий пульт на странице.');
    }
  };

  // --- High-Resolution Frame Capture Helper ---
  const captureCurrentVideoFrame = async (): Promise<Blob> => {
    const video = videoRef.current || pipVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      throw new Error('Видеопоток недоступен для захвата кадра');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не удалось получить 2D контекст');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Ошибка создания изображения Blob'));
      }, 'image/png');
    });
  };

  // --- Active Step & Last Screenshot Data ---
  const activeStep = useMemo(() => {
    if (!activeStepId) return null;
    return project.steps.find((s) => s.id === activeStepId) || null;
  }, [activeStepId, project.steps]);

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
      setCustomRuText(activeStep.ru);
      setCustomEnText(activeStep.en);
      // Extract target text if exists between <b>...</b>
      const match = activeStep.ru.match(/<b>(.*?)<\/b>/i);
      setTargetNameInput(match ? match[1] : '');
    }
  }, [activeStep]);

  // --- Coordinate Mapping Helpers (Normalized 0..100) ---
  const getNormalizedPoint = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    video: HTMLVideoElement | null
  ): { x: number; y: number } => {
    const rect = container.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    if (video && video.videoWidth && video.videoHeight) {
      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = rect.width / rect.height;

      let renderW = rect.width;
      let renderH = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspect > videoAspect) {
        renderH = rect.height;
        renderW = renderH * videoAspect;
        offsetX = (rect.width - renderW) / 2;
      } else {
        renderW = rect.width;
        renderH = renderW / videoAspect;
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

  // --- Interactive Draw-to-Shoot Handler ---
  const handleInteractionStart = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    video: HTMLVideoElement | null
  ) => {
    const point = getNormalizedPoint(clientX, clientY, container, video);
    setIsMouseDown(true);
    setStartPoint(point);
    setCurrentBox({ x: point.x, y: point.y, w: 0, h: 0 });
  };

  const handleInteractionMove = (
    clientX: number,
    clientY: number,
    container: HTMLElement,
    video: HTMLVideoElement | null
  ) => {
    if (!isMouseDown || !startPoint) return;
    const current = getNormalizedPoint(clientX, clientY, container, video);

    const x = Math.min(startPoint.x, current.x);
    const y = Math.min(startPoint.y, current.y);
    const w = Math.abs(current.x - startPoint.x);
    const h = Math.abs(current.y - startPoint.y);

    setCurrentBox({ x, y, w, h });
  };

  const handleInteractionEnd = async () => {
    if (!isMouseDown || !startPoint) return;
    setIsMouseDown(false);

    let finalBox: BoxRect;
    const box = currentBox;

    // If mouse was simply clicked without drag (or box < 1.5%), make neat default 8% x 5% box around click
    if (!box || (box.w < 1.5 && box.h < 1.5)) {
      const bw = 8;
      const bh = 5;
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

    // Branch by DrawMode:
    if (drawMode === 'blur') {
      // Add blur area to last screenshot
      if (!lastCapturedScreenshot) {
        showBanner('Нет отснятого кадра для применения замазывания');
        return;
      }
      const updatedBlurBoxes = [...lastCapturedScreenshot.blurBoxes, finalBox];
      await updateScreenshot(lastCapturedScreenshot.id, { blurBoxes: updatedBlurBoxes });
      await onProjectUpdated();
      showBanner('Приватная зона замазана (Blur)');
      setDrawMode('shoot');
      return;
    }

    if (drawMode === 'add_step_same_frame') {
      // Add another step to existing screenshot without duplicating image
      if (!lastCapturedScreenshot) {
        showBanner('Сначала снимите кадр');
        return;
      }
      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('click', '');
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: lastCapturedScreenshot.id,
        act: 'click',
        box: finalBox,
        cursorPos: {
          x: Math.round((finalBox.x + finalBox.w / 2) * 10) / 10,
          y: Math.round((finalBox.y + finalBox.h / 2) * 10) / 10,
        },
        ru: initialInstructions.ru,
        en: initialInstructions.en,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      setTargetNameInput('');
      setCustomRuText(initialInstructions.ru);
      setCustomEnText(initialInstructions.en);
      showBanner(`Шаг #${project.steps.length + 1} добавлен на этот же кадр!`);
      setDrawMode('shoot');
      return;
    }

    // Default: 'shoot' mode -> Capture frame from video and create new step
    try {
      const blob = await captureCurrentVideoFrame();
      const filename = `shot_${Date.now()}.png`;
      const asset = await addScreenshot(project.id, blob, filename);

      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('click', targetNameInput);
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: activeActionType,
        box: finalBox,
        cursorPos: {
          x: Math.round((finalBox.x + finalBox.w / 2) * 10) / 10,
          y: Math.round((finalBox.y + finalBox.h / 2) * 10) / 10,
        },
        ru: initialInstructions.ru,
        en: initialInstructions.en,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();

      setActiveStepId(newStepId);
      showBanner(`📸 Кадр снят и создан шаг #${project.steps.length + 1}!`);
    } catch (err: any) {
      console.error('Error capturing shot:', err);
      showBanner('Ошибка захвата кадра. Убедитесь, что захват экрана включен.');
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
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: 'look',
        box: { x: 20, y: 20, w: 60, h: 60 },
        cursorPos: { x: 50, y: 50 },
        ru: initialInstructions.ru,
        en: initialInstructions.en,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      showBanner(`📸 Полный кадр сохранён (Шаг #${project.steps.length + 1})`);
    } catch (err: any) {
      console.error(err);
      showBanner('Не удалось снять кадр');
    }
  };

  // --- Quick Panel Updates ---
  const handleUpdateStepAction = async (newAct: ActionType) => {
    setActiveActionType(newAct);
    const updated = formatActionInstruction(newAct, targetNameInput);
    setCustomRuText(updated.ru);
    setCustomEnText(updated.en);

    if (activeStep) {
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id ? { ...s, act: newAct, ru: updated.ru, en: updated.en } : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleTargetNameChange = async (newName: string) => {
    setTargetNameInput(newName);
    const formatted = formatActionInstruction(activeActionType, newName);
    setCustomRuText(formatted.ru);
    setCustomEnText(formatted.en);

    if (activeStep) {
      const updatedSteps = project.steps.map((s) =>
        s.id === activeStep.id ? { ...s, ru: formatted.ru, en: formatted.en } : s
      );
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleCustomRuChange = async (val: string) => {
    setCustomRuText(val);
    if (activeStep) {
      const updatedSteps = project.steps.map((s) => (s.id === activeStep.id ? { ...s, ru: val } : s));
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleCustomEnChange = async (val: string) => {
    setCustomEnText(val);
    if (activeStep) {
      const updatedSteps = project.steps.map((s) => (s.id === activeStep.id ? { ...s, en: val } : s));
      await updateProject(project.id, { steps: updatedSteps });
      await onProjectUpdated();
    }
  };

  const handleDeleteActiveStep = async () => {
    if (!activeStepId) return;
    const updatedSteps = project.steps.filter((s) => s.id !== activeStepId);
    await updateProject(project.id, { steps: updatedSteps });
    await onProjectUpdated();
    setActiveStepId(null);
    showBanner('Шаг удален');
  };

  // --- Clipboard (Ctrl+V) & File Upload Support ---
  const handleImportImageBlob = async (blob: Blob, name: string) => {
    try {
      const asset = await addScreenshot(project.id, blob, name);
      const newStepId = generateId();
      const initialInstructions = formatActionInstruction('click', '');
      const newStep: GuideStep = {
        id: newStepId,
        screenshotId: asset.id,
        act: 'click',
        box: { x: 30, y: 30, w: 20, h: 10 },
        cursorPos: { x: 40, y: 35 },
        ru: initialInstructions.ru,
        en: initialInstructions.en,
      };

      await updateProject(project.id, {
        steps: [...project.steps, newStep],
      });
      await onProjectUpdated();
      setActiveStepId(newStepId);
      showBanner(`Скриншот импортирован из буфера/файла (Шаг #${project.steps.length + 1})`);
    } catch (err: any) {
      console.error('Failed to import image blob:', err);
      showBanner('Ошибка импорта изображения');
    }
  };

  // Global Ctrl+V listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside text inputs
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
        className="absolute border-2 border-emerald-400 bg-emerald-500/20 pointer-events-none transition-all shadow-[0_0_12px_rgba(52,211,153,0.6)]"
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.w}%`,
          height: `${box.h}%`,
        }}
      >
        <div className="absolute -top-6 left-0 bg-emerald-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded shadow">
          {Math.round(box.w)}% × {Math.round(box.h)}%
        </div>
      </div>
    );
  };

  // --- Render Floating Remote Controls (Both for PiP Portal and In-App Widget) ---
  const renderRemoteControls = (isPip: boolean) => (
    <div
      className={`flex flex-col h-full ${
        isPip ? 'p-3 bg-slate-950 text-slate-100' : 'p-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isCapturingScreen && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isCapturingScreen ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-xs font-bold tracking-wide uppercase text-slate-200">
            {isCapturingScreen ? 'Экран в эфире' : 'Захват ожидает'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
            Шагов: <strong className="text-emerald-400">{project.steps.length}</strong>
          </span>
          {isPip ? (
            <button
              onClick={() => closePipWindow()}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Закрыть плавающее окно"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setShowInAppMiniRemote(false)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Скрыть мини-пульт"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mini Interactive Viewport inside PiP */}
      <div
        ref={pipContainerRef}
        onMouseDown={(e) =>
          handleInteractionStart(e.clientX, e.clientY, pipContainerRef.current!, pipVideoRef.current)
        }
        onMouseMove={(e) =>
          handleInteractionMove(e.clientX, e.clientY, pipContainerRef.current!, pipVideoRef.current)
        }
        onMouseUp={handleInteractionEnd}
        className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 mb-3 cursor-crosshair group select-none"
      >
        <video
          ref={pipVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain pointer-events-none"
        />
        {/* Helper overlay */}
        <div className="absolute inset-0 bg-slate-950/20 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition">
          <span className="text-[11px] bg-slate-900/90 text-emerald-300 px-2 py-1 rounded shadow border border-slate-700">
            ✂️ Выделите область на превью
          </span>
        </div>

        {renderSelectionOverlay(currentBox)}
      </div>

      {/* Voice Dictation & Status Bar */}
      <div className="flex items-center gap-2 mb-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
        <button
          onClick={handleToggleVoice}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            isVoiceActive
              ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.5)]'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title="Включить голосовой ввод (Web Speech API)"
        >
          {isVoiceActive ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4 text-slate-400" />}
          <span>{isVoiceActive ? 'Диктуйте...' : 'Микрофон'}</span>
        </button>

        <button
          onClick={handleToggleVoiceLang}
          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-bold text-slate-300 border border-slate-700 transition"
          title="Сменить язык распознавания речи"
        >
          {voiceLang === 'ru-RU' ? 'RU' : 'EN'}
        </button>

        <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-400">
          {liveTranscript || (isVoiceActive ? 'Слушаю вас...' : 'Скажите: «Нажмите Создать отчет»')}
        </div>
      </div>

      {/* Quick Button Name Input */}
      <div className="mb-2">
        <input
          type="text"
          value={targetNameInput}
          onChange={(e) => handleTargetNameChange(e.target.value)}
          placeholder="Название кнопки или поля (например: Сохранить)..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={handleCaptureFullFrame}
          disabled={!isCapturingScreen}
          className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-3 rounded-lg shadow transition"
        >
          <Camera className="w-4 h-4" />
          <span>📸 Снять весь кадр</span>
        </button>

        <button
          onClick={() => {
            setDrawMode('add_step_same_frame');
            showBanner('Выделите вторую кнопку на превью для шага на этот же кадр');
          }}
          disabled={!lastCapturedScreenshot}
          className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium text-xs py-2 px-3 rounded-lg border border-slate-700 transition"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>➕ Шаг на тот же кадр</span>
        </button>
      </div>

      {/* Footer Controls */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-800">
        {activeStep && onOpenEditorStep ? (
          <button
            onClick={() => onOpenEditorStep(activeStep.id)}
            className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Редактор шага</span>
          </button>
        ) : (
          <div className="text-[11px] text-slate-500">Авто-режим активен</div>
        )}

        <button
          onClick={handleStopCapture}
          className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-medium transition"
        >
          <VideoOff className="w-3.5 h-3.5" />
          <span>⏹ Завершить</span>
        </button>
      </div>
    </div>
  );

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
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        {/* Left: Stream Control & Status */}
        <div className="flex items-center gap-3">
          {!isCapturingScreen ? (
            <button
              onClick={handleStartCapture}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-lg shadow-emerald-950/50 transition transform active:scale-95"
            >
              <Video className="w-4 h-4" />
              <span>Начать захват экрана</span>
            </button>
          ) : (
            <button
              onClick={handleStopCapture}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-lg shadow-rose-950/50 transition transform active:scale-95"
            >
              <VideoOff className="w-4 h-4" />
              <span>Остановить захват</span>
            </button>
          )}

          {isCapturingScreen && (
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>LIVE</span>
              {videoResolution && (
                <span className="text-slate-400 font-mono text-[11px]">
                  ({videoResolution.width}×{videoResolution.height})
                </span>
              )}
            </div>
          )}

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Совет: выберите «Окно» или «Вкладка», чтобы скрыть панель задач и вкладки браузера</span>
          </div>
        </div>

        {/* Center / Right: Remote & Mode Toggles */}
        <div className="flex items-center gap-2">
          {/* Picture-in-Picture Remote Button */}
          <button
            onClick={handleTogglePip}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
              pipWindow || showInAppMiniRemote
                ? 'bg-sky-600 text-white border-sky-500 shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Открыть плавающий пульт поверх всех окон (Document Picture-in-Picture)"
          >
            <Square className="w-4 h-4 text-sky-400" />
            <span>🪟 Плавающий пульт PiP</span>
          </button>

          {/* Voice Input Button */}
          <button
            onClick={handleToggleVoice}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
              isVoiceActive
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Голосовой ввод инструкций (Web Speech API, бесплатно)"
          >
            {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-slate-400" />}
            <span>{isVoiceActive ? 'Слушаю...' : 'Голос'}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={handleToggleVoiceLang}
            className="px-2 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 border border-slate-700 transition"
            title="Переключить язык распознавания (RU / EN)"
          >
            {voiceLang === 'ru-RU' ? 'RU' : 'EN'}
          </button>

          {/* Manual File Upload Button */}
          <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-200 border border-slate-700 cursor-pointer transition">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Загрузить фото / Ctrl+V</span>
            <input type="file" accept="image/*" multiple onChange={handleFileInputChange} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Live Video Canvas Area */}
        <div className="flex-1 flex flex-col relative bg-slate-950 p-4 overflow-hidden">
          {/* Action Mode Toolbar */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Режим выделения:
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
                <span>✂️ Выделил = Снял шаг</span>
              </button>

              <button
                onClick={() => setDrawMode('add_step_same_frame')}
                disabled={!lastCapturedScreenshot}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40 transition ${
                  drawMode === 'add_step_same_frame'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Добавить ещё одну рамку на только что отснятый скриншот"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>➕ Шаг на этот же кадр</span>
              </button>

              <button
                onClick={() => setDrawMode('blur')}
                disabled={!lastCapturedScreenshot}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-40 transition ${
                  drawMode === 'blur'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Замазать приватную область (Blur) на этом кадре"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>🌫 Замазать (Blur)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCaptureFullFrame}
                disabled={!isCapturingScreen}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-md text-xs font-medium border border-slate-700 transition"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>📸 Снять весь кадр</span>
              </button>
            </div>
          </div>

          {/* Interactive Screen Container */}
          <div
            ref={containerRef}
            onMouseDown={(e) =>
              handleInteractionStart(e.clientX, e.clientY, containerRef.current!, videoRef.current)
            }
            onMouseMove={(e) =>
              handleInteractionMove(e.clientX, e.clientY, containerRef.current!, videoRef.current)
            }
            onMouseUp={handleInteractionEnd}
            className={`flex-1 relative rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden flex items-center justify-center cursor-crosshair select-none ${
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
              <img
                src={assetUrls[lastCapturedScreenshot.id]}
                alt="Last snapshot"
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="p-4 bg-slate-800/80 rounded-full border border-slate-700 text-slate-400">
                  <Video className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-semibold text-slate-200 mb-1">
                    Захват экрана не запущен
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Нажмите кнопку выше, чтобы запустить живой захват нужного окна или вкладки, или вставьте скриншот из буфера обмена (Win+Shift+S → Ctrl+V).
                  </p>
                  <button
                    onClick={handleStartCapture}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition"
                  >
                    <Video className="w-4 h-4" />
                    <span>Выбрать окно или экран</span>
                  </button>
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
                  {drawMode === 'shoot' && 'Зажмите мышь и выделите кнопку на превью'}
                  {drawMode === 'add_step_same_frame' && 'Выделите вторую область на текущем кадре'}
                  {drawMode === 'blur' && 'Выделите область, которую нужно замазать (Blur)'}
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
                    Шаг #{project.steps.findIndex((s) => s.id === activeStep.id) + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Быстрый комментарий</span>
                </div>

                <button
                  onClick={() => setActiveStepId(null)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                  title="Закрыть панель"
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
                    className="w-full h-full object-cover opacity-80"
                  />
                  {/* Highlight active step box */}
                  <div
                    className="absolute border-2 border-emerald-400 bg-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
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
                  Тип действия
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACTION_PRESETS.map((preset) => {
                    const isSelected = activeActionType === preset.act;
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
                        <span>{preset.labelRu}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Name Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Название элемента / кнопки
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
                    <span>{isVoiceActive ? 'Диктуйте...' : 'Голос'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={targetNameInput}
                  onChange={(e) => handleTargetNameChange(e.target.value)}
                  placeholder="Например: Сохранить, Экспорт, Настройки..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Instruction Text (RU & EN) */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Инструкция (RU)
                  </label>
                  <textarea
                    rows={2}
                    value={customRuText}
                    onChange={(e) => handleCustomRuChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Инструкция (EN)
                  </label>
                  <textarea
                    rows={2}
                    value={customEnText}
                    onChange={(e) => handleCustomEnChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                  />
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <button
                  onClick={() => setActiveStepId(null)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4" />
                  <span>✓ Готово (Продолжить съёмку)</span>
                </button>

                <div className="flex items-center gap-2">
                  {onOpenEditorStep && (
                    <button
                      onClick={() => onOpenEditorStep(activeStep.id)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs py-2 rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      <span>Открыть в редакторе</span>
                    </button>
                  )}

                  <button
                    onClick={handleDeleteActiveStep}
                    className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 transition"
                    title="Удалить этот шаг"
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
                Снимите шаг на экране
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mb-3">
                Выделите область кнопкой мыши прямо на видео-превью. Кадр моментально зафиксируется, и здесь откроются быстрые комментарии.
              </p>
              <div className="flex flex-col gap-1.5 w-full text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">1.</span>
                  <span>Зажмите ЛКМ и обведите нужную кнопку</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">2.</span>
                  <span>Или просто кликните в нужную точку</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">3.</span>
                  <span>Диктуйте голосом без токенов и ИИ</span>
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
          <span>Шаги ({project.steps.length})</span>
        </div>

        {project.steps.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            Шагов пока нет. Сделайте первый снимок на превью экрана выше!
          </div>
        ) : (
          project.steps.map((step, idx) => {
            const isSelected = activeStepId === step.id;
            const imgUrl = assetUrls[step.screenshotId];
            return (
              <div
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
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
                    Фото #{idx + 1}
                  </div>
                )}

                {/* Box highlight on thumbnail */}
                <div
                  className="absolute border border-emerald-400 bg-emerald-500/20"
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
        <div className="fixed bottom-6 right-6 w-80 h-96 z-50 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          {renderRemoteControls(false)}
        </div>
      )}
    </div>
  );
};
