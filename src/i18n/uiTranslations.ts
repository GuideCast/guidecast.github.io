/**
 * UI Translations and localization helpers for Guide Creation Tool.
 * Default language: English ('en'). Can be switched to Russian ('ru') at any time.
 */

export type UiLang = 'en' | 'ru';

export const UI_LANG_KEY = 'gct_ui_lang';
export const WELCOME_TOUR_KEY = 'gct_seen_welcome_v1';

/**
 * Returns saved UI language preference from localStorage, default is 'en'.
 */
export function getSavedUiLang(): UiLang {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(UI_LANG_KEY);
    if (saved === 'ru' || saved === 'en') {
      return saved;
    }
  } catch (e) {
    console.warn('Could not read UI lang from localStorage:', e);
  }
  return 'en';
}

/**
 * Saves UI language preference to localStorage.
 */
export function saveUiLang(lang: UiLang): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UI_LANG_KEY, lang);
  } catch (e) {
    console.warn('Could not save UI lang to localStorage:', e);
  }
}

/**
 * Checks whether user has already completed/dismissed the welcome tour modal.
 */
export function hasSeenWelcomeTour(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(WELCOME_TOUR_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Marks welcome tour as seen so it will not pop up automatically.
 */
export function markWelcomeTourSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELCOME_TOUR_KEY, 'true');
  } catch (e) {
    console.warn('Could not mark welcome tour as seen:', e);
  }
}

/**
 * Resets welcome tour flag so user or professor can re-launch it anytime.
 */
export function resetWelcomeTour(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WELCOME_TOUR_KEY);
  } catch (e) {
    console.warn('Could not reset welcome tour flag:', e);
  }
}

/**
 * Complete UI dictionary for Guide Creation Tool in English and Russian.
 */
export const UI_TEXT = {
  en: {
    header: {
      appName: 'Guide Creation Tool',
      tagline: 'Interactive Step-by-Step Training Guides',
      projects: 'Projects',
      newProject: 'New Guide',
      demoProject: 'Demo Guide',
      howItWorks: 'How It Works',
      themeDark: 'Dark Mode',
      themeLight: 'Light Mode',
      langToggle: 'Language',
    },
    dashboard: {
      title: 'Interactive Guides & Simulators',
      subtitle: 'Create engaging interactive step-by-step training manuals for BI, Cloud, and Software without video editing.',
      createGuide: 'Create New Guide',
      createDemo: 'Try Interactive Demo',
      importFolder: 'Import Folder (steps.json)',
      importFolderHint: 'Select folder with steps.json & screenshots',
      importHtml: 'Import HTML Guide (.html)',
      importHtmlHint: 'Open ready-made .html guide back in the editor',
      totalProjects: 'Projects in Workspace',
      stepsCount: 'steps',
      openEditor: 'Open Editor',
      deleteGuide: 'Delete',
      confirmDelete: 'Are you sure you want to delete this guide and all its screenshots from local database?',
      noProjectsTitle: 'No guides created yet',
      noProjectsDesc: 'Start by creating your first interactive guide or explore the ready-made demo with pre-configured step bounding boxes and blur areas.',
      updated: 'Updated',
      created: 'Created',
    },
    tabs: {
      capture: '1. Screen & Step Capture',
      captureBadge: 'Pop-out PiP Recorder',
      editor: '2. Step Editor & Privacy',
      editorBadge: 'Bounding Boxes & Blur',
      player: '3. Simulator & Export',
      playerBadge: 'Single-File HTML',
      backToDashboard: '← Back to Projects',
    },
    capture: {
      title: 'Interactive Screen & Step Capture',
      subtitle: 'Stream your target application, pop out the always-on-top recorder, and mark steps seamlessly.',
      startScreenShare: 'Start Screen Capture',
      stopScreenShare: 'Stop Stream',
      popoutPip: '🪟 Pop Out Floating Recorder (PiP)',
      snapStep: '📸 Snap Step',
      captureTipTitle: '💡 How to record seamlessly:',
      captureTip1: 'In the browser dialog, select your target app window or "Browser Tab" (e.g. Power BI, Cloud Console, SQL tool).',
      captureTip2: 'Avoid selecting the Guide Creation Tool window itself to prevent mirror feedback.',
      captureTip3: 'Open the Floating Recorder (PiP) to mark clicks and dictate instructions while staying inside your program.',
      clipboardPasteHint: 'Or press Win + Shift + S in any program, then Ctrl + V here to add a step.',
      pipActiveBanner: 'Floating Recorder is currently open. You can mark steps directly in the floating window!',
    },
    editor: {
      toolbarTitle: 'Annotation Tools',
      toolTarget: 'Target Box',
      toolTargetDesc: 'Highlight the interactive button or input element for this step',
      toolStepBlur: 'Step Blur',
      toolStepBlurDesc: 'Blur sensitive user data or tokens on this screenshot only',
      toolGlobalBlur: 'Global Blur',
      toolGlobalBlurDesc: 'Blur fixed areas (user emails, top navbars) across ALL screenshots in this guide',
      toolMask: 'Mask Patch',
      toolMaskDesc: 'Draw a solid colored rectangle over obsolete logos or UI tags',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      zoomFit: 'Fit to View',
      zoomActual: '100% Size',
      undo: 'Undo Last Box',
      clearBoxes: 'Clear All on Step',
      addScreenshotBtn: 'Add Screenshot (+)',
      aiAssistantBtn: '✨ AI & Privacy Assistant',
      aiAssistantBadge: 'Auto-Blur & Gemini Crops',
      quickPresets: 'Quick Action Presets:',
      savingChanges: 'Changes saved locally',
      compactSidebar: '◀ Compact',
      hideSidebar: '✕ Hide',
      showStepsList: '▶ Show Steps',
      expandSidebar: '▶ Expand',
      canvasZoom: 'Zoom:',
      tallCanvas: '↕️ Tall Canvas',
      standardCanvas: '↕️ Standard Height',
      expandHeightTip: 'Toggle container height between standard and tall viewport',
    },
    stepInspector: {
      title: 'Step Details',
      stepIndicator: 'Step',
      of: 'of',
      actionLabel: 'Action Type',
      actions: {
        click: '🖱️ Click (Mouse click)',
        type: '⌨️ Type (Text input)',
        drag: '✋ Drag & Drop',
        select: '📋 Select (Dropdown / option)',
        scroll: '📜 Scroll (Page / list)',
        look: '👁️ Inspect (Read / notice)',
      },
      chapterTitle: 'Chapter / Step Subtitle',
      chapterPlaceholder: 'e.g. 1. Connect to Data Source',
      enInstruction: 'English Instruction (HTML enabled)',
      enPlaceholder: 'Click <b>+ New Pipeline</b> to launch the setup wizard...',
      ruInstruction: 'Russian Instruction (HTML enabled)',
      ruPlaceholder: 'Нажмите <b>+ New Pipeline</b>, чтобы запустить мастер настройки...',
      voiceTranscript: 'Voice Dictation Transcript',
      voicePlaceholder: 'Voice text will appear here while recording with 🎤...',
      keepBlur: 'Keep blur active during this step (do not uncover background)',
      reorderUp: 'Move Up',
      reorderDown: 'Move Down',
      duplicate: 'Duplicate Step',
      delete: 'Delete Step',
      confirmDeleteStep: 'Are you sure you want to delete this step?',
      aiDescribeBtn: 'Describe with Gemini Micro-Crop',
      emptyStepList: 'No steps added yet. Capture or add your first step to begin!',
      addNewStep: '+ Add Step',
    },
    export: {
      title: 'Export & Integration',
      subtitle: 'Build fully autonomous, self-contained interactive deliverables ready for Moodle, Canvas, or offline delivery.',
      standaloneHtmlCardTitle: 'Standalone Interactive HTML (.html)',
      standaloneHtmlCardDesc: 'Single self-contained file with embedded base64 screenshots, voice effects, dark/light themes, and training mode. No web server required — double click and run anywhere!',
      downloadHtmlBtn: 'Download Standalone HTML',
      bundleZipCardTitle: 'Project Bundle (steps.json + PNG)',
      bundleZipCardDesc: 'Export editable JSON metadata and full-resolution screenshot assets compatible with the Python CLI build_guide.py pipeline.',
      downloadZipBtn: 'Export Project Bundle',
      simulatorTitle: 'Live Guide Simulator Preview',
      simulatorHint: 'Test the interactive guide right here. Click on the red pulsating target to advance to the next step, or switch to Ru / En mode.',
      defaultLangSetting: 'Default Guide Language:',
      previewControls: 'Step Navigation:',
      splitterTitle: '✂️ Split Long Guide into Lessons (Cut by Steps)',
      splitterSubtitle: 'Cut a long course into short modular lessons. Export range as standalone HTML or save as a separate project in your studio list.',
      splitterFrom: 'From step:',
      splitterTo: 'To step:',
      splitterTitleLabel: 'Lesson Title (optional):',
      splitterTitlePlaceholder: 'e.g. Lesson 1: Data Connection',
      splitterExportHtml: '⬇️ Export Range as HTML',
      splitterSaveProject: '📑 Save Range as New Project in Studio',
      splitterSelectedCount: 'Selected steps:',
    },
    welcomeTour: {
      stepOf: 'Step',
      skipTour: 'Skip Tour',
      back: '← Back',
      next: 'Next →',
      startCreating: 'Got it, Start Creating! 🚀',
      step1: {
        tag: '1. Target Window & Avoid Mirror',
        title: 'Start Screen Capture & Pick Target Tab',
        desc: 'In the browser share dialog, choose "Browser Tab" (e.g. Power BI, Snowflake, or SQL studio) rather than the whole screen to eliminate mirror loops.',
        bullet1Title: 'Select Target Application Tab',
        bullet1Desc: 'Pick your active work tab so the guide captures clean 1080p frames.',
        bullet2Title: 'Avoid Mirror Loops',
        bullet2Desc: 'Do not select Guide Creation Tool itself, keeping the stream focused on your task.',
        bullet3Title: 'Always-on Local Stream',
        bullet3Desc: 'The stream runs locally in memory — zero external server uploads.',
      },
      step2: {
        tag: '2. Floating Recorder (PiP)',
        title: 'Pop Out Floating Recorder (Always on Top)',
        desc: 'Work directly inside your Power BI or Cloud system with a compact floating controller hovering on top of your work.',
        bullet1Title: 'Always on Top',
        bullet1Desc: 'Floating window stays visible while you navigate across tabs or multi-monitor setups.',
        bullet2Title: '📸 Snap Step Button',
        bullet2Desc: 'Click Snap Step each time you perform an important step in your program.',
        bullet3Title: 'Instant Paste (Ctrl+V)',
        bullet3Desc: 'Use Win + Shift + S to crop anywhere and Ctrl + V here to add steps in 1 second.',
      },
      step3: {
        tag: '3. Highlight & Handles',
        title: 'Highlight Target & Adjust 8 Handles + Pointer',
        desc: 'Draw a red bounding box directly on the screenshot. Pull any of the 8 white handles to adjust size, and move the ↖ mouse arrow away from text.',
        bullet1Title: '8-Way Resize Handles',
        bullet1Desc: 'Corner and edge handles make framing buttons, inputs, and menus pixel-perfect.',
        bullet2Title: 'Smart Offset Pointer (↖)',
        bullet2Desc: 'Drag the pointer handle away from letters so button labels remain 100% readable.',
        bullet3Title: 'Live Responsive Coordinates',
        bullet3Desc: 'Responsive percentage positioning adapts smoothly to any screen resolution.',
      },
      step4: {
        tag: '4. Privacy Blur & Instructions',
        title: 'Add Blur, Type Instruction & Click "Save & Next"',
        desc: 'Protect student and corporate credentials with smart blur boxes, type your instruction with bold highlights, or dictate with your voice.',
        bullet1Title: '🌫 + Draw Blur Box',
        bullet1Desc: 'Mask emails, names, and API keys. The target action element is automatically kept sharp.',
        bullet2Title: 'Unified Instruction Field',
        bullet2Desc: 'Single clean text box supporting <b>bold</b> element names and 4 quick action presets.',
        bullet3Title: '🎤 Voice Dictation',
        bullet3Desc: 'Speak "Click New Report" and voice recognition auto-formats the step description.',
      },
      step5: {
        tag: '5. Full-Width & Zoom',
        title: 'Full-Width Workspace & Canvas Zoom (100%–200%)',
        desc: 'Collapse the left steps list to a compact strip or hide it completely. Zoom the canvas to 140%–180% to easily target tiny icons in dense BI interfaces.',
        bullet1Title: '◀ Compact & ✕ Hide Sidebar',
        bullet1Desc: 'Expand your editor canvas to 100% screen width on modern high-res monitors.',
        bullet2Title: '🔍 Zoom 100% | 140% | 180%',
        bullet2Desc: 'Zoom in on small icons, folders, and menus with smooth bidirectional scrolling.',
        bullet3Title: '↕️ Tall Canvas',
        bullet3Desc: 'Expand the canvas height to 82vh for an expansive editing workspace.',
      },
      step6: {
        tag: '6. Autonomous HTML & Lessons',
        title: 'Export Single HTML or Split into Lessons',
        desc: 'Generate a single self-contained guide-public.html file ready for Moodle or Canvas LMS, or slice long 50-step guides into concise modular lessons.',
        bullet1Title: '📦 1-File HTML Deliverable',
        bullet1Desc: 'Embedded screenshots and audio simulator that runs offline without any server installation.',
        bullet2Title: '✂️ Split Long Guide into Lessons',
        bullet2Desc: 'Cut step ranges into bite-sized chapters or export custom sub-projects in 1 click.',
        bullet3Title: '📄 Import HTML Back Anytime',
        bullet3Desc: 'Re-open any previously exported HTML guide to edit steps or update screenshots.',
      },
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      close: 'Close',
      delete: 'Delete',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      confirm: 'Confirm',
    },
  },
  ru: {
    header: {
      appName: 'Guide Creation Tool',
      tagline: 'Интерактивные пошаговые руководства и тренажёры',
      projects: 'Проекты',
      newProject: 'Новый гайд',
      demoProject: 'Демо-гайд',
      howItWorks: 'Как пользоваться',
      themeDark: 'Тёмная тема',
      themeLight: 'Светлая тема',
      langToggle: 'Язык интерфейса',
    },
    dashboard: {
      title: 'Интерактивные руководства и симуляторы',
      subtitle: 'Создавайте интерактивные пошаговые тренажёры для BI, облачных платформ и аналитических систем без видеомонтажа.',
      createGuide: 'Создать новый гайд',
      createDemo: 'Попробовать демо-проект',
      importFolder: 'Импортировать папку (steps.json)',
      importFolderHint: 'Выберите папку с steps.json и скриншотами',
      importHtml: 'Импорт из HTML (.html)',
      importHtmlHint: 'Загрузить готовый автономный .html гайд обратно в конструктор',
      totalProjects: 'Проектов в хранилище',
      stepsCount: 'шагов',
      openEditor: 'Открыть в редакторе',
      deleteGuide: 'Удалить',
      confirmDelete: 'Вы уверены, что хотите удалить этот проект и все его скриншоты из локальной базы данных?',
      noProjectsTitle: 'Пока нет сохранённых проектов',
      noProjectsDesc: 'Нажмите «Создать новый гайд» или откройте готовый демо-проект с настроенными рамками и зонами блюра.',
      updated: 'Обновлено',
      created: 'Создано',
    },
    tabs: {
      capture: '1. Запись шагов',
      captureBadge: 'Плавающее окно PiP',
      editor: '2. Редактор и приватность',
      editorBadge: 'Рамки и блюр',
      player: '3. Симулятор и экспорт',
      playerBadge: 'Автономный HTML',
      backToDashboard: '← К списку проектов',
    },
    capture: {
      title: 'Интерактивная запись экрана и шагов',
      subtitle: 'Транслируйте окно программы, откройте плавающее окно записи и выделяйте целевые кнопки за секунды.',
      startScreenShare: 'Начать трансляцию экрана',
      stopScreenShare: 'Остановить трансляцию',
      popoutPip: '🪟 Открыть плавающее окно записи (PiP)',
      snapStep: '📸 Сделать снимок шага',
      captureTipTitle: '💡 Как удобно записывать шаги:',
      captureTip1: 'В системном окне браузера выберите вкладку «Вкладка браузера» (BI-система, консоль AWS/Azure, SQL) или окно конкретной программы.',
      captureTip2: 'Не выбирайте вкладку самого Guide Creation Tool во избежание «эффекта зеркального коридора».',
      captureTip3: 'Откройте плавающий рекордер (PiP), чтобы размечать клики и надиктовывать инструкции прямо поверх целевой программы.',
      clipboardPasteHint: 'Или нажмите Win + Shift + S в любой программе и Ctrl + V здесь для мгновенной вставки шага.',
      pipActiveBanner: 'Плавающее окно записи открыто. Вы можете размечать шаги прямо в мини-окне поверх других программ!',
    },
    editor: {
      toolbarTitle: 'Инструменты разметки',
      toolTarget: 'Целевая рамка',
      toolTargetDesc: 'Выделите интерактивную кнопку или поле ввода для этого шага',
      toolStepBlur: 'Блюр шага',
      toolStepBlurDesc: 'Заблюрить конфиденциальные данные только на этом скриншоте',
      toolGlobalBlur: 'Глобальный блюр',
      toolGlobalBlurDesc: 'Заблюрить постоянные области (email, шапка, аватар) на ВСЕХ скриншотах',
      toolMask: 'Маска / Заплатка',
      toolMaskDesc: 'Закрасить сплошным цветом устаревшие плашки интерфейса',
      zoomIn: 'Увеличить',
      zoomOut: 'Уменьшить',
      zoomFit: 'Вписать в экран',
      zoomActual: 'Масштаб 100%',
      undo: 'Отменить последнюю рамку',
      clearBoxes: 'Очистить рамки шага',
      addScreenshotBtn: 'Добавить скриншот (+)',
      aiAssistantBtn: '✨ AI и защита приватности',
      aiAssistantBadge: 'Умный блюр и Gemini',
      quickPresets: 'Быстрые пресеты действий:',
      savingChanges: 'Изменения сохранены локально',
      compactSidebar: '◀ Компактно',
      hideSidebar: '✕ Скрыть',
      showStepsList: '▶ Показать шаги',
      expandSidebar: '▶ Развернуть',
      canvasZoom: 'Масштаб:',
      tallCanvas: '↕️ Высокий холст',
      standardCanvas: '↕️ Стандартная высота',
      expandHeightTip: 'Переключить высоту холста между стандартной и максимальной',
    },
    stepInspector: {
      title: 'Параметры шага',
      stepIndicator: 'Шаг',
      of: 'из',
      actionLabel: 'Тип действия',
      actions: {
        click: '🖱️ Клик (нажатие мыши)',
        type: '⌨️ Ввод (текстовое поле)',
        drag: '✋ Перетаскивание',
        select: '📋 Выбор (список / опция)',
        scroll: '📜 Прокрутка (страница / список)',
        look: '👁️ Осмотр (обратите внимание)',
      },
      chapterTitle: 'Раздел / Название главы',
      chapterPlaceholder: 'например, 1. Подключение к источнику данных',
      enInstruction: 'Инструкция на английском (HTML)',
      enPlaceholder: 'Click <b>+ New Pipeline</b> to launch the setup wizard...',
      ruInstruction: 'Инструкция на русском (HTML)',
      ruPlaceholder: 'Нажмите <b>+ New Pipeline</b>, чтобы запустить мастер настройки...',
      voiceTranscript: 'Голосовой черновик',
      voicePlaceholder: 'Распознанный голос появится здесь при записи с 🎤...',
      keepBlur: 'Оставить блюр на цели (не вырезать отверстие для этого шага)',
      reorderUp: 'Переместить вверх',
      reorderDown: 'Переместить вниз',
      duplicate: 'Дублировать шаг',
      delete: 'Удалить шаг',
      confirmDeleteStep: 'Вы уверены, что хотите удалить этот шаг?',
      aiDescribeBtn: 'Описать шаг с помощью Gemini',
      emptyStepList: 'В проекте пока нет шагов. Запишите экран или добавьте скриншот!',
      addNewStep: '+ Добавить шаг',
    },
    export: {
      title: 'Экспорт и интеграция',
      subtitle: 'Генерация полностью автономных интерактивных обучающих материалов для Moodle, Canvas или офлайн.',
      standaloneHtmlCardTitle: 'Автономный интерактивный HTML (.html)',
      standaloneHtmlCardDesc: 'Единый файл со встроенными base64-скриншотами, звуками кликов, тёмной/светлой темой и режимом тренажёра. Запускается на любом компьютере без установки сервера!',
      downloadHtmlBtn: 'Скачать автономный HTML',
      bundleZipCardTitle: 'Архив проекта (steps.json + PNG)',
      bundleZipCardDesc: 'Исходные файлы разметки и полноразмерные изображения для доработки или сборки через консольный Python-скрипт build_guide.py.',
      downloadZipBtn: 'Экспорт архива проекта',
      simulatorTitle: 'Предпросмотр интерактивного симулятора',
      simulatorHint: 'Протестируйте руководство прямо здесь. Нажимайте на подсвеченную красную рамку для перехода к следующему шагу или переключайте язык EN / RU.',
      defaultLangSetting: 'Язык по умолчанию в симуляторе:',
      previewControls: 'Навигация по шагам:',
      splitterTitle: '✂️ Нарезка длинного гайда на отдельные уроки',
      splitterSubtitle: 'Разделите длинный курс из десятков шагов на короткие уроки. Скачивайте автономный HTML для выбранного диапазона или сохраняйте его как новый проект в конструкторе.',
      splitterFrom: 'С шага:',
      splitterTo: 'По шаг:',
      splitterTitleLabel: 'Название урока (необязательно):',
      splitterTitlePlaceholder: 'например, Урок 1: Подключение к данным',
      splitterExportHtml: '⬇️ Скачать урок в HTML',
      splitterSaveProject: '📑 Сохранить как новый проект в конструкторе',
      splitterSelectedCount: 'Выбрано шагов:',
    },
    welcomeTour: {
      stepOf: 'Шаг',
      skipTour: 'Пропустить обучение',
      back: '← Назад',
      next: 'Далее →',
      startCreating: 'Понятно, начать создание! 🚀',
      step1: {
        tag: '1. Выбор окна без зеркала',
        title: 'Start Screen Capture & Pick Target Tab',
        desc: 'В диалоге браузера выберите вкладку «Вкладка браузера» (например, Power BI, Snowflake или SQL-консоль) вместо всего экрана, чтобы избежать зеркального коридора.',
        bullet1Title: 'Выбор вкладки целевой программы',
        bullet1Desc: 'Выберите рабочую вкладку для захвата чётких 1080p кадров.',
        bullet2Title: 'Без зеркального эффекта',
        bullet2Desc: 'Не выбирайте сам Guide Creation Tool, чтобы избежать бесконечного отражения.',
        bullet3Title: 'Локальная трансляция',
        bullet3Desc: 'Поток обрабатывается только в браузере — без отправки на сервер.',
      },
      step2: {
        tag: '2. Плавающий рекордер (PiP)',
        title: 'Pop Out Floating Recorder (Always on Top)',
        desc: 'Работайте прямо в вашей Power BI или Cloud-системе: компактный пульт висит поверх всех окон и программ.',
        bullet1Title: 'Всегда поверх окон',
        bullet1Desc: 'Плавающее окно не теряется при переключении вкладок и программ.',
        bullet2Title: 'Кнопка 📸 Snap Step',
        bullet2Desc: 'Нажимайте Snap Step при каждом важном действии в интерфейсе.',
        bullet3Title: 'Быстрая вставка (Ctrl+V)',
        bullet3Desc: 'Win + Shift + S для ножниц Windows и мгновенная вставка шага через Ctrl + V.',
      },
      step3: {
        tag: '3. Выделение, 8 ручек и стрелка',
        title: 'Highlight Target & Adjust 8 Handles + Pointer',
        desc: 'Обведите кнопку красной рамкой. Тяните за 8 белых ручек по краям и сдвиньте стрелочку ↖ в сторону от текста, чтобы надписи оставались читаемыми.',
        bullet1Title: '8 маркеров трансформации',
        bullet1Desc: 'Угловые и боковые маркеры позволяют подогнать рамку под любую кнопку.',
        bullet2Title: 'Умная стрелочка-указатель (↖)',
        bullet2Desc: 'Перетаскивайте стрелку за пределы текста — она не загораживает буквы.',
        bullet3Title: 'Адаптивные координаты',
        bullet3Desc: 'Координаты в процентах идеально масштабируются на любых мониторах.',
      },
      step4: {
        tag: '4. Блюр, инструкция и сохранение',
        title: 'Add Blur, Type Instruction & Click "Save & Next"',
        desc: 'Защитите приватные данные умным блюром, напишите инструкцию с выделением ключевых кнопок или надиктуйте голосом.',
        bullet1Title: 'Кнопка 🌫 + Draw Blur Box',
        bullet1Desc: 'Скрывайте email, логины и токены. Целевая кнопка шага остаётся резкой.',
        bullet2Title: 'Единое поле Инструкции',
        bullet2Desc: 'Удобный ввод текста, поддержка <b>жирного</b> и 4 быстрых пресета действий.',
        bullet3Title: '🎤 Голосовая диктовка',
        bullet3Desc: 'Скажите «Нажмите Создать отчёт» — голос распознается и подставится в поле.',
      },
      step5: {
        tag: '5. Полноширинный режим и Zoom',
        title: 'Full-Width Editor & Zoom (100%–200%)',
        desc: 'Сверните левую колонку шагов (◀ Compact / ✕ Hide) на 100% ширины экрана. Включите 🔍 Zoom 140%–180% для точной разметки мелких иконок в Power BI.',
        bullet1Title: '◀ Compact и ✕ Hide',
        bullet1Desc: 'Разверните редактор на всю ширину для комфортной работы на больших экранах.',
        bullet2Title: '🔍 Zoom 100% | 140% | 180%',
        bullet2Desc: 'Увеличение холста почти в 2 раза с плавной прокруткой в обе стороны.',
        bullet3Title: '↕️ Высокий холст',
        bullet3Desc: 'Кнопка расширения высоты до 82vh для максимального обзора.',
      },
      step6: {
        tag: '6. Автономный HTML и нарезка',
        title: 'Export Single HTML or Split into Lessons',
        desc: 'Скачивайте автономный guide-public.html для Moodle, Canvas или отправки в чат, нарезайте длинные гайды через ✂️ Split into Lessons или открывайте их заново через 📄 Import.',
        bullet1Title: '📦 Автономный HTML в 1 клик',
        bullet1Desc: 'Встроенные скриншоты и симулятор кликов, открывается без сервера и интернета.',
        bullet2Title: '✂️ Нарезка длинного гайда',
        bullet2Desc: 'Выбирайте диапазон шагов и экспортируйте отдельные модульные уроки.',
        bullet3Title: '📄 Обратный импорт HTML',
        bullet3Desc: 'Любой сохранённый HTML-гайд можно загрузить обратно для доработки шагов.',
      },
    },
    common: {
      save: 'Сохранить',
      cancel: 'Отмена',
      close: 'Закрыть',
      delete: 'Удалить',
      loading: 'Загрузка...',
      success: 'Успешно',
      error: 'Ошибка',
      confirm: 'Подтвердить',
    },
  },
} as const;

export type UiDictionary = typeof UI_TEXT.en;
