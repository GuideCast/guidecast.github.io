import type { ActionType } from '../types/guide';

/**
 * Interface for speech recognition result event from Web Speech API.
 */
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResultAlternative;
  [index: number]: SpeechRecognitionResultAlternative;
}

interface SpeechRecognitionResultAlternative {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

/**
 * Browser SpeechRecognition declaration.
 */
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Checks if Web Speech API is supported in current browser.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as IWindowWithSpeech;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

/**
 * Parsed voice intent structure.
 */
export interface ParsedVoiceStep {
  act: ActionType;
  targetName: string;
  ru: string;
  en: string;
  rawTranscript: string;
}

/**
 * Preset action templates for quick chip formatting.
 */
export const ACTION_PRESETS: {
  act: ActionType;
  labelRu: string;
  labelEn: string;
  templateRu: (name: string) => string;
  templateEn: (name: string) => string;
}[] = [
  {
    act: 'click',
    labelRu: 'Нажмите',
    labelEn: 'Click',
    templateRu: (name) => (name ? `Нажмите <b>${name}</b>` : 'Нажмите на указанную область'),
    templateEn: (name) => (name ? `Click <b>${name}</b>` : 'Click the specified area'),
  },
  {
    act: 'type',
    labelRu: 'Введите',
    labelEn: 'Type',
    templateRu: (name) => (name ? `Введите <b>${name}</b>` : 'Введите требуемое значение'),
    templateEn: (name) => (name ? `Type <b>${name}</b>` : 'Type the required value'),
  },
  {
    act: 'select',
    labelRu: 'Выберите',
    labelEn: 'Select',
    templateRu: (name) => (name ? `Выберите <b>${name}</b>` : 'Выберите нужный пункт'),
    templateEn: (name) => (name ? `Select <b>${name}</b>` : 'Select the desired option'),
  },
  {
    act: 'look',
    labelRu: 'Обратите внимание',
    labelEn: 'Notice',
    templateRu: (name) => (name ? `Обратите внимание на <b>${name}</b>` : 'Обратите внимание на указанную область'),
    templateEn: (name) => (name ? `Pay attention to <b>${name}</b>` : 'Pay attention to the highlighted area'),
  },
  {
    act: 'scroll',
    labelRu: 'Прокрутите',
    labelEn: 'Scroll',
    templateRu: (name) => (name ? `Прокрутите страницу к <b>${name}</b>` : 'Прокрутите страницу'),
    templateEn: (name) => (name ? `Scroll down to <b>${name}</b>` : 'Scroll down the page'),
  },
  {
    act: 'drag',
    labelRu: 'Перетащите',
    labelEn: 'Drag',
    templateRu: (name) => (name ? `Перетащите <b>${name}</b>` : 'Перетащите элемент'),
    templateEn: (name) => (name ? `Drag <b>${name}</b>` : 'Drag the item'),
  },
];

/**
 * Format step instructions in RU & EN from action and button/element name.
 */
export function formatActionInstruction(
  act: ActionType,
  targetName: string
): { ru: string; en: string } {
  const preset = ACTION_PRESETS.find((p) => p.act === act) || ACTION_PRESETS[0];
  const cleanName = targetName.trim().replace(/^["'«»]+|["'«»]+$/g, '');
  return {
    ru: preset.templateRu(cleanName),
    en: preset.templateEn(cleanName),
  };
}

/**
 * Clean up text (remove trailing punctuation and extra spaces).
 */
function cleanTarget(str: string): string {
  return str
    .trim()
    .replace(/[.,!?;:]+$/, '')
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .trim();
}

/**
 * Intelligent client-side parser to convert spoken phrases into structured guide steps without any AI.
 * Examples:
 * - "Нажмите кнопку Создать отчет" -> act: 'click', targetName: 'Создать отчет'
 * - "Кликните по меню Настройки" -> act: 'click', targetName: 'Настройки'
 * - "Введите логин admin" -> act: 'type', targetName: 'admin'
 * - "Выберите вкладку Аналитика" -> act: 'select', targetName: 'Аналитика'
 * - "Прокрутите вниз до таблицы" -> act: 'scroll', targetName: 'таблицы'
 * - "Click on Export button" -> act: 'click', targetName: 'Export'
 */
export function parseVoiceIntent(transcript: string, _preferredLang: 'ru' | 'en' = 'ru'): ParsedVoiceStep {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  let act: ActionType = 'click';
  let targetName = '';

  // 1. TYPE / ВВОД
  const typeRuMatch = lower.match(
    /^(?:введи(?:те)?|напечатай(?:те)?|заполни(?:те)?)(?:\s+(?:текст|значение|в\s+поле|данные))?\s+(.+)$/i
  );
  const typeEnMatch = lower.match(
    /^(?:type(?:\s+in)?|enter|fill(?:\s+in)?)(?:\s+(?:the|text|value|field))?\s+(.+)$/i
  );

  // 2. SELECT / ВЫБОР
  const selectRuMatch = lower.match(
    /^(?:выбери(?:те)?|открой(?:те)?(?:\s+вкладку))(?:\s+(?:из\s+списка|вкладку|опцию|пункт|раздел))?\s+(.+)$/i
  );
  const selectEnMatch = lower.match(
    /^(?:select|choose|pick)(?:\s+(?:the|tab|option|item|section))?\s+(.+)$/i
  );

  // 3. LOOK / ВНИМАНИЕ
  const lookRuMatch = lower.match(
    /^(?:обрати(?:те)?\s+внимание(?:\s+на)?|посмотри(?:те)?(?:\s+на)?|проверь(?:те)?)(?:\s+(?:блок|поле|статус|значение))?\s+(.+)$/i
  );
  const lookEnMatch = lower.match(
    /^(?:pay\s+attention\s+to|look\s+at|check|notice)(?:\s+(?:the|field|status|value))?\s+(.+)$/i
  );

  // 4. SCROLL / ПРОКРУТКА
  const scrollRuMatch = lower.match(
    /^(?:прокрути(?:те)?|скролль(?:те)?)(?:\s+(?:страницу|вниз|вверх|к|до))?\s*(.*)$/i
  );
  const scrollEnMatch = lower.match(
    /^(?:scroll)(?:\s+(?:down|up|to|the\s+page))?\s*(.*)$/i
  );

  // 5. DRAG / ПЕРЕТАСКИВАНИЕ
  const dragRuMatch = lower.match(
    /^(?:перетащи(?:те)?|перенеси(?:те)?)(?:\s+(?:файл|элемент|объект))?\s*(.*)$/i
  );
  const dragEnMatch = lower.match(
    /^(?:drag(?:\s+and\s+drop)?|move)(?:\s+(?:the|item|file))?\s*(.*)$/i
  );

  // 6. CLICK / КЛИК
  const clickRuMatch = lower.match(
    /^(?:нажми(?:те)?|кликни(?:те)?|щелкни(?:те)?)(?:\s+(?:на|по))?(?:\s+(?:кнопку|ссылку|значок|иконку|пункт|элемент|вкладку))?\s+(.+)$/i
  );
  const clickEnMatch = lower.match(
    /^(?:click|press|tap)(?:\s+(?:on|the))?(?:\s+(?:button|link|icon|item|tab))?\s+(.+)$/i
  );

  if (typeRuMatch?.[1] || typeEnMatch?.[1]) {
    act = 'type';
    targetName = cleanTarget(typeRuMatch?.[1] || typeEnMatch?.[1] || '');
  } else if (selectRuMatch?.[1] || selectEnMatch?.[1]) {
    act = 'select';
    targetName = cleanTarget(selectRuMatch?.[1] || selectEnMatch?.[1] || '');
  } else if (lookRuMatch?.[1] || lookEnMatch?.[1]) {
    act = 'look';
    targetName = cleanTarget(lookRuMatch?.[1] || lookEnMatch?.[1] || '');
  } else if (scrollRuMatch || scrollEnMatch) {
    act = 'scroll';
    targetName = cleanTarget(scrollRuMatch?.[1] || scrollEnMatch?.[1] || '');
  } else if (dragRuMatch || dragEnMatch) {
    act = 'drag';
    targetName = cleanTarget(dragRuMatch?.[1] || dragEnMatch?.[1] || '');
  } else if (clickRuMatch?.[1] || clickEnMatch?.[1]) {
    act = 'click';
    targetName = cleanTarget(clickRuMatch?.[1] || clickEnMatch?.[1] || '');
  } else {
    // Fallback: If no clear prefix found, treat whole phrase as target for click
    act = 'click';
    targetName = cleanTarget(raw);
  }

  // Capitalize first letter of target if appropriate
  if (targetName.length > 0) {
    targetName = targetName.charAt(0).toUpperCase() + targetName.slice(1);
  }

  const { ru, en } = formatActionInstruction(act, targetName);

  return {
    act,
    targetName,
    ru,
    en,
    rawTranscript: raw,
  };
}

/**
 * Controller for browser-native speech dictation (Web Speech API).
 * Zero token cost, zero AI overhead, instant transcription.
 */
export class VoiceDictationController {
  private recognition: any = null;
  private isListeningState = false;
  private currentLang: 'ru-RU' | 'en-US' = 'ru-RU';

  public onTranscript?: (transcript: string, isFinal: boolean) => void;
  public onParsedStep?: (parsed: ParsedVoiceStep) => void;
  public onError?: (error: string) => void;
  public onStateChange?: (isListening: boolean) => void;

  constructor(lang: 'ru-RU' | 'en-US' = 'ru-RU') {
    this.currentLang = lang;
    this.initRecognition();
  }

  private initRecognition() {
    if (!isSpeechRecognitionSupported()) return;

    const win = window as unknown as IWindowWithSpeech;
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    this.recognition = new SpeechClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLang;

    this.recognition.onstart = () => {
      this.isListeningState = true;
      this.onStateChange?.(true);
    };

    this.recognition.onend = () => {
      this.isListeningState = false;
      this.onStateChange?.(false);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      // Ignore normal aborts
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }
      this.onError?.(`Speech recognition error: ${event.error}`);
    };

    this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      const activeText = (final || interim).trim();
      if (!activeText) return;

      this.onTranscript?.(activeText, Boolean(final));

      if (final) {
        const langCode = this.currentLang.startsWith('en') ? 'en' : 'ru';
        const parsed = parseVoiceIntent(final, langCode);
        this.onParsedStep?.(parsed);
      }
    };
  }

  public setLanguage(lang: 'ru-RU' | 'en-US') {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    const wasListening = this.isListeningState;
    if (wasListening) {
      this.stop();
    }
    if (this.recognition) {
      this.recognition.lang = lang;
    }
    if (wasListening) {
      setTimeout(() => this.start(lang), 100);
    }
  }

  public getLanguage(): 'ru-RU' | 'en-US' {
    return this.currentLang;
  }

  public isListening(): boolean {
    return this.isListeningState;
  }

  public start(lang?: 'ru-RU' | 'en-US') {
    if (!this.recognition) {
      this.initRecognition();
    }
    if (!this.recognition) {
      this.onError?.('Web Speech API is not supported in this browser.');
      return;
    }
    if (lang) {
      this.currentLang = lang;
      this.recognition.lang = lang;
    }

    try {
      if (!this.isListeningState) {
        this.recognition.start();
      }
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        this.onError?.(err?.message || 'Failed to start microphone recording');
      }
    }
  }

  public stop() {
    if (this.recognition && this.isListeningState) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.isListeningState = false;
    this.onStateChange?.(false);
  }

  public abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }
    this.isListeningState = false;
    this.onStateChange?.(false);
  }

  public destroy() {
    this.abort();
    this.recognition = null;
  }
}
