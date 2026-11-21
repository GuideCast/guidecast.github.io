/**
 * UI Translations and localization helpers for GuideCast.
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
 * Complete UI dictionary for GuideCast in English and Russian.
 */
export const UI_TEXT = {
  en: {
    pwa: {
      install: 'Install app',
      installTitle: 'Install GuideCast as a separate window',
      updateReady: 'A new version is available',
      update: 'Update',
      later: 'Later',
      offlineReady: 'Ready to work offline',
      close: 'Close',
    },
    header: {
      appName: 'GuideCast',
      tagline: 'Step-by-step guides from screenshots',
      projects: 'Projects',
      newProject: 'New Guide',
      demoProject: 'Demo Guide',
      howItWorks: 'How It Works',
      themeDark: 'Dark Mode',
      themeLight: 'Light Mode',
      langToggle: 'Language',
    },
    dashboard: {
      title: 'Step-by-step guides for your students',
      subtitle: 'Record a browser tab, mark where to click, add a short caption, and download one HTML file for your students.',
      createGuide: 'New guide',
      createDemo: 'Open an example guide',
      fromScreenshots: 'Guide from screenshots',
      fromScreenshotsHint: 'Already have pictures? Pick them all at once. They are ordered by file name, and you can change the order before the guide is created.',
      watchHowTo: 'How it works: interactive guide',
      importFolder: 'Folder with steps.json',
      importFolderHint: 'Select folder with steps.json & screenshots',
      importHtml: 'HTML guide or project file',
      importHtmlHint: 'Open a .html file made with this tool',
      totalProjects: 'Projects in Workspace',
      stepsCount: 'steps',
      openEditor: 'Open Editor',
      deleteGuide: 'Delete',
      confirmDelete: 'Are you sure you want to delete this guide and all its screenshots from local database?',
      noProjectsTitle: 'No guides created yet',
      noProjectsDesc: 'Create your first guide, or open an example to see what a finished guide looks like.',
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
      backToDashboard: 'All guides',
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
      captureTip2: 'Avoid selecting the GuideCast window itself to prevent mirror feedback.',
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
      standaloneHtmlCardDesc: 'Single self-contained file with embedded base64 screenshots, voice effects, dark/light themes, and training mode. No web server required: double click and run anywhere.',
      downloadHtmlBtn: 'Download Standalone HTML',
      bundleZipCardTitle: 'Project Bundle (steps.json + PNG)',
      bundleZipCardDesc: 'Export editable JSON metadata and full-resolution screenshot assets compatible with the Python CLI build_guide.py pipeline.',
      downloadZipBtn: 'Export Project Bundle',
      simulatorTitle: 'Live Guide Simulator Preview',
      simulatorHint: 'Test the interactive guide right here. Click on the red pulsating target to advance to the next step, or switch to Ru / En mode.',
      defaultLangSetting: 'Default Guide Language:',
      previewControls: 'Step Navigation:',
      splitterTitle: 'Split a long guide into lessons',
      splitterSubtitle: 'Choose a range of steps. Download it as a separate guide for students, or keep it as a new guide in your list.',
      splitterFrom: 'From step:',
      splitterTo: 'To step:',
      splitterTitleLabel: 'Lesson Title (optional):',
      splitterTitlePlaceholder: 'e.g. Lesson 1: Data Connection',
      splitterExportHtml: 'Download lesson (.html)',
      splitterSaveProject: 'Save as a new guide',
      splitterSelectedCount: 'Selected steps:',
    },
    welcomeTour: {
      heading: 'How it works: 3 steps',
      stepOf: 'Step',
      skipTour: 'Close',
      back: 'Back',
      next: 'Next',
      closeTour: 'Close',
      ctaStart: 'Start a new guide',
      pathsHeading: 'Two ways to start',
      pathRecord: 'Record the steps in the app',
      pathRecordHint: 'Share the tab with your program and snap each step.',
      pathUpload: 'Already have screenshots? Upload them',
      pathUploadHint: 'Pick several pictures. One picture becomes one step.',
      ctaDemo: 'How it works: interactive guide',
      step1: {
        title: 'Record',
        desc: 'Share the browser tab with the program you teach (for example, Microsoft Fabric) and take a snapshot at each step.',
        point1: 'Click "Start recording", then choose the tab with your program (not this page) and click Share. Chrome switches to that tab and a small floating recorder opens on top.',
        point2: 'Do the task as usual. Before each click, drag the mouse over that button in the floating recorder: each drag saves one step. Or press Auto: a step is saved whenever the screen changes and stays still (set the red frame later). The minus button shrinks the recorder to a small bar.',
      },
      step2: {
        title: 'Caption',
        desc: 'For each snapshot, check where to click and write one short sentence for the student.',
        point1: 'Drag the red box over the button. The small arrow shows the mouse pointer.',
        point2: 'Type the caption or press the microphone and say it out loud.',
      },
      step3: {
        title: 'Download',
        desc: 'Download one HTML file and share it with students who missed the class.',
        point1: '"Guide for students (.html)" opens in any browser, works offline, and blurs private areas.',
        point2: 'Students click through the steps at their own pace, in English or Russian, and can press Listen to hear each caption read aloud.',
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
    pwa: {
      install: 'Установить приложение',
      installTitle: 'Установить GuideCast как отдельное окно',
      updateReady: 'Доступна новая версия',
      update: 'Обновить',
      later: 'Позже',
      offlineReady: 'Приложение готово к работе без интернета',
      close: 'Закрыть',
    },
    header: {
      appName: 'GuideCast',
      tagline: 'Пошаговые гайды из скриншотов',
      projects: 'Проекты',
      newProject: 'Новый гайд',
      demoProject: 'Демо-гайд',
      howItWorks: 'Как пользоваться',
      themeDark: 'Тёмная тема',
      themeLight: 'Светлая тема',
      langToggle: 'Язык интерфейса',
    },
    dashboard: {
      title: 'Пошаговые гайды для ваших студентов',
      subtitle: 'Запишите вкладку браузера, отметьте, куда нажать, добавьте короткую подпись и скачайте один HTML-файл для студентов.',
      createGuide: 'Новый гайд',
      createDemo: 'Открыть пример гайда',
      fromScreenshots: 'Гайд из скриншотов',
      fromScreenshotsHint: 'Уже есть картинки? Выберите их все сразу. Порядок по имени файла, перед созданием гайда его можно поменять.',
      watchHowTo: 'Как это работает: интерактивный гайд',
      importFolder: 'Папка со steps.json',
      importFolderHint: 'Выберите папку с steps.json и скриншотами',
      importHtml: 'HTML-гайд или файл проекта',
      importHtmlHint: 'Открыть .html, сделанный в этом инструменте',
      totalProjects: 'Проектов в хранилище',
      stepsCount: 'шагов',
      openEditor: 'Открыть в редакторе',
      deleteGuide: 'Удалить',
      confirmDelete: 'Вы уверены, что хотите удалить этот проект и все его скриншоты из локальной базы данных?',
      noProjectsTitle: 'Пока нет сохранённых проектов',
      noProjectsDesc: 'Создайте первый гайд или откройте пример, чтобы увидеть готовый результат.',
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
      backToDashboard: 'Все гайды',
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
      captureTip2: 'Не выбирайте вкладку самого GuideCast во избежание «эффекта зеркального коридора».',
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
      splitterTitle: 'Разделить длинный гайд на уроки',
      splitterSubtitle: 'Выберите диапазон шагов. Скачайте его как отдельный гайд для студентов или сохраните как новый гайд в списке.',
      splitterFrom: 'С шага:',
      splitterTo: 'По шаг:',
      splitterTitleLabel: 'Название урока (необязательно):',
      splitterTitlePlaceholder: 'например, Урок 1: Подключение к данным',
      splitterExportHtml: 'Скачать урок (.html)',
      splitterSaveProject: 'Сохранить как новый гайд',
      splitterSelectedCount: 'Выбрано шагов:',
    },
    welcomeTour: {
      heading: 'Как это работает: 3 шага',
      stepOf: 'Шаг',
      skipTour: 'Закрыть',
      back: 'Назад',
      next: 'Далее',
      closeTour: 'Закрыть',
      ctaStart: 'Создать новый гайд',
      pathsHeading: 'Два способа начать',
      pathRecord: 'Записать шаги в приложении',
      pathRecordHint: 'Покажите вкладку с программой и снимайте каждый шаг.',
      pathUpload: 'Уже есть скриншоты? Загрузите их',
      pathUploadHint: 'Выберите несколько картинок. Одна картинка станет одним шагом.',
      ctaDemo: 'Как это работает: интерактивный гайд',
      step1: {
        title: 'Запишите',
        desc: 'Покажите вкладку браузера с программой, которую вы преподаёте (например, Microsoft Fabric), и делайте снимок на каждом шаге.',
        point1: 'Нажмите «Начать запись», выберите вкладку с программой (не эту страницу) и нажмите «Поделиться». Chrome перейдёт на эту вкладку, и сверху откроется маленький плавающий пульт.',
        point2: 'Выполняйте задание как обычно. Перед каждым нажатием обведите мышью эту кнопку в плавающем пульте: каждое обведение сохраняет один шаг. Или нажмите «Авто»: шаг сохраняется сам, когда экран меняется и замирает (красную рамку выставите потом). Кнопка «минус» сворачивает пульт в маленькую панель.',
      },
      step2: {
        title: 'Подпишите',
        desc: 'На каждом снимке проверьте, куда нажать, и напишите одно короткое предложение для студента.',
        point1: 'Перетащите красную рамку на кнопку. Маленькая стрелка показывает курсор мыши.',
        point2: 'Напечатайте подпись или нажмите на микрофон и произнесите её вслух.',
      },
      step3: {
        title: 'Скачайте',
        desc: 'Скачайте один HTML-файл и отправьте его студентам, которые пропустили занятие.',
        point1: '«Гайд для студентов (.html)» открывается в любом браузере, работает без интернета и размывает личные данные.',
        point2: 'Студенты проходят шаги в своём темпе, на русском или английском, и могут нажать «Слушать», чтобы услышать подпись вслух.',
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
