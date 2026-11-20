# GuideCast (репозиторий guidecast.github.io, прежнее имя Guide Creation Tool): контекст для ИИ-сессий

Читать первым в любой сессии (Claude Code, Gemini и т.п.), потом `CHANGELOG.md`.

## Что это
Клиентское веб-приложение (React 19 + Vite + Tailwind + Dexie/IndexedDB) для сборки
пошаговых HTML-гайдов из скриншотов: запись экрана, рамка/курсор/блюр/маска, подписи EN/RU,
экспорт в один автономный HTML. Аудитория: преподаватели NOVA IMS (BI, Microsoft Fabric),
в том числе нетехнические, 30–60 лет. Опубликовано: https://guidecast.github.io/ (организация GitHub GuideCast, репо GuideCast/guidecast.github.io; со старого адреса stanislavsidorovich.github.io/guide-creation-tool/ стоит страница о переезде без автоперехода)
(деплой GitHub Actions на каждый push в `main`, `.github/workflows/deploy.yml`).

Предшественник: `fabric-guide-tool/` (Python `build_guide.py` + `template.html` + `steps.json`,
координаты в пикселях при ширине 2000). Формат `steps.json` должен оставаться совместимым.

## Где что
- `src/App.tsx` (~2.5k строк): дашборд проектов, вкладки Capture / Editor / Player, редактор шага.
- `src/components/capture/LiveCaptureWorkspace.tsx`: getDisplayMedia, PiP-пульт, «ножницы», вставка Ctrl+V.
  Порядок записи: сначала пульт (PiP), вкладка выбирается из пульта. Элементы в окне PiP из другого `window`:
  не использовать `instanceof HTMLElement` и подобное.
- `src/components/common/InteractiveBoxEditor.tsx`: рамка с 8 ручками, курсор, блюр-боксы.
- `src/services/importerExporter.ts`: импорт папки `steps.json`, импорт/экспорт HTML-плеера (шаблон плеера внутри строки).
- `src/services/canvasRenderer.ts`: блюр, маска, вырез рамки из блюра, JPEG 0.85, ширина 1600.
- `src/db/database.ts`: схема Dexie (имя БД `GuideCreationToolDB` и ключи `gct_*` НЕ переименовывать: пропадут гайды у людей) + демо-проект (`createDemoProject`, файл `public/demo/how-to-guide.html`,
  гайд о самом инструменте; пересборка: `scripts/demo/README.md`).
- `src/i18n/uiTranslations.ts`: строки UI EN/RU (часть строк всё ещё захардкожена в компонентах).

## Правила
- Координаты в модели: проценты 0..100 от картинки (`BoxRect`). В `steps.json`: пиксели при `display_width` (2000).
- Публичная версия (`guide-public.html`) не должна содержать оригиналы скриншотов без блюра.
- Каждое изменение: строка в `CHANGELOG.md` (что, зачем, как проверено). Перед крупной переделкой: git-тег.
- Проверять `npm run build` (там `tsc`) до push: push в `main` сразу уходит в прод (Pages).
- **Push без вопроса** (постоянное разрешение владельца, 2026-11-14): если сборка прошла и изменение проверено
  в браузере, сразу `git push origin main` и тег версии, затем сообщить итог. Не спрашивать «отправить?».
- Модель для доработок: Sonnet. Opus только для архитектурных развилок.
- Тексты для преподавателей без длинного тире «—».

## Точки отката
- `v0.1.0-gemini` (2026-11-14): состояние, собранное с Gemini, до ревью Claude.
- `v0.2.0` (2026-11-14, после push): баги, простой интерфейс, настоящее демо.
- `v0.3.0` (2026-11-14): запись в одно действие, демо про сам инструмент.
- `v0.8.0` (2026-11-20): сворачивание пульта, до цветных областей и режима Авто.
