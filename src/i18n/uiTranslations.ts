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
    },
    welcomeTour: {
      stepOf: 'Step',
      skipTour: 'Skip Tour',
      back: '← Back',
      next: 'Next →',
      startCreating: 'Got it, Start Creating! 🚀',
      step1: {
        tag: 'Welcome to Guide Creation Tool',
        title: 'Interactive Step Guides Without Video Editing',
        desc: 'Designed for university professors, data analysts, and enterprise specialists working with complex tools (Power BI, Cloud Consoles, SQL, ERP).',
        bullet1Title: 'Zero Video Rendering Fatigue',
        bullet1Desc: 'No more retaking 20-minute screen recordings because of a single misclick or outdated UI icon.',
        bullet2Title: 'Active Student Engagement',
        bullet2Desc: 'Students learn 3x faster by interacting with pulsating target boxes instead of passively watching a video.',
        bullet3Title: 'Universal 1-File Deliverable',
        bullet3Desc: 'Generates an ultra-light standalone .html package that runs in Moodle, Canvas, Blackboard, or offline with zero server setup.',
      },
      step2: {
        tag: 'Screen Sharing Best Practice',
        title: 'How to Share Your Target App (Avoid the Mirror Effect!)',
        desc: 'To capture steps smoothly, choose the correct window in the browser screen selection dialog.',
        doTitle: '✅ RECOMMENDED (DO THIS)',
        doDesc: 'Select the "Browser Tab" tab (e.g. your BI system, AWS/Azure, SQL studio) or a specific application window.',
        dontTitle: '❌ AVOID (DON\'T DO THIS)',
        dontDesc: 'Do not share the entire screen or the browser window where Guide Creation Tool itself is open, otherwise an infinite mirror tunnel will appear!',
        tip: '💡 Tip: Keep your target application in one tab and Guide Creation Tool in another, or on adjacent monitors.',
      },
      step3: {
        tag: 'Seamless Multi-Tab Capture',
        title: 'How to Capture Steps While Inside Another Tab (Floating PiP!)',
        desc: '"I switched to my target software tab, but my cursor is normal — how do I record steps?"',
        browserSecurityNote: 'Browser security strictly prevents web pages from injecting custom cursors or capturing mouse clicks inside other tabs.',
        solutionTitle: 'The Solution: 🪟 Pop Out Floating Recorder (PiP)',
        solutionDesc: 'A lightweight floating window stays always-on-top over your BI / cloud program while you work!',
        stepA: '1. In the floating recorder, click 📸 Snap Step whenever you perform an action.',
        stepB: '2. Draw a red target rectangle directly over the button, or dictate with 🎤 voice transcription.',
        stepC: '3. Shortcut alternative: Press Win + Shift + S anywhere to snap, then Ctrl + V to paste instantly.',
      },
      step4: {
        tag: 'Privacy & Publishing',
        title: 'Privacy Blur, AI Micro-Crops & Single-File HTML Export',
        desc: 'Publish professional training guides that protect sensitive corporate and student data.',
        privacyTitle: '🛡️ 1-Click Privacy Blur Presets',
        privacyDesc: 'Mask profile emails, API tokens, and sidebars across all slides automatically. The target action element is automatically kept sharp and visible!',
        aiTitle: '✨ Gemini AI Micro-Crop Descriptions',
        aiDesc: 'AI inspects the tiny button you clicked in its visual context to write concise, professional bilingual instructions in seconds.',
        exportTitle: '📦 Single-File HTML Export',
        exportDesc: 'One standalone HTML file containing all steps, responsive player, and interactive simulator ready to upload to Moodle, LMS, or GitHub Pages.',
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
    },
    welcomeTour: {
      stepOf: 'Шаг',
      skipTour: 'Пропустить обучение',
      back: '← Назад',
      next: 'Далее →',
      startCreating: 'Понятно, начать создание! 🚀',
      step1: {
        tag: 'Добро пожаловать в Guide Creation Tool',
        title: 'Интерактивные пошаговые руководства без видеомонтажа',
        desc: 'Инструмент создан специально для преподавателей университетов, аналитиков данных и экспертов по сложным системам (Power BI, Cloud, SQL, ERP).',
        bullet1Title: 'Забудьте о перезаписи видеороликов',
        bullet1Desc: 'Больше не нужно переписывать 20-минутное видео из-за одной случайной оговорки или изменившейся кнопки в интерфейсе.',
        bullet2Title: 'Интерактивное вовлечение студентов',
        bullet2Desc: 'Студенты осваивают материал в 3 раза эффективнее, когда нажимают на подсвеченные элементы в режиме тренажёра.',
        bullet3Title: 'Единый автономный HTML-файл',
        bullet3Desc: 'Создаёт ультра-лёгкий автономный .html файл, который загружается в Moodle, Canvas, Blackboard или запускается с флешки без сервера.',
      },
      step2: {
        tag: 'Правильный выбор окна',
        title: 'Как транслировать программу (без эффекта зеркала!)',
        desc: 'Чтобы комфортно размечать шаги, правильно выберите целевое окно в диалоге браузера.',
        doTitle: '✅ КАК НАДО (РЕКОМЕНДУЕТСЯ)',
        doDesc: 'Выберите вкладку «Вкладка браузера» (например, открытую вкладку с вашей BI-системой) или конкретное окно другой программы.',
        dontTitle: '❌ КАК НЕ НАДО (ИЗБЕГАЙТЕ)',
        dontDesc: 'Не выбирайте вкладку или окно, в котором открыт сам Guide Creation Tool, иначе возникнет бесконечный эффект зеркального коридора!',
        tip: '💡 Совет: Держите вашу рабочую программу в одной вкладке, а инструмент создания — в другой вкладке или на соседнем мониторе.',
      },
      step3: {
        tag: 'Запись шагов между вкладками',
        title: 'Как захватывать шаги в другой вкладке (Плавающее окно PiP!)',
        desc: '«Я перешёл во вкладку со своей программой, но курсор там обычный — куда нажимать?»',
        browserSecurityNote: 'Политика безопасности браузера строго запрещает чужим сайтам менять курсор или перехватывать клики внутри других программ.',
        solutionTitle: 'Решение: 🪟 Плавающее окно записи (PiP)',
        solutionDesc: 'Компактное окно, которое висит поверх всех окон и программ, пока вы работаете в своей BI-системе!',
        stepA: '1. Нажимайте кнопку «📸 Snap Step» в плавающем окне в нужные моменты работы.',
        stepB: '2. Выделите целевую кнопку прямо на мини-экране или надиктуйте комментарий голосом 🎤.',
        stepC: '3. Альтернатива: Нажмите Win + Shift + S в любой программе и Ctrl + V для мгновенной вставки скриншота.',
      },
      step4: {
        tag: 'Приватность и публикация',
        title: 'Защита данных (Блюр), AI-описания и экспорт в 1 клик',
        desc: 'Создавайте обучающие материалы корпоративного уровня с надёжной защитой персональных данных.',
        privacyTitle: '🛡️ Умный блюр в 1 клик',
        privacyDesc: 'Скрывайте email аккаунтов, токены и боковые панели автоматически на всех слайдах. При этом целевая кнопка шага всегда остаётся чёткой и видимой!',
        aiTitle: '✨ Описание микро-кропов через Gemini AI',
        aiDesc: 'Искусственный интеллект анализирует выделенную кнопку в контексте экрана и формирует чёткие двуязычные инструкции за секунды.',
        exportTitle: '📦 Автономный HTML-экспорт',
        exportDesc: 'Скачивайте единый .html файл со всеми скриншотами, озвучкой кликов и тренажёром, готовый к загрузке в Moodle, LMS или на сайт.',
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
