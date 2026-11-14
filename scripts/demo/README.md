# Пересборка демо-гайда «How to make a step-by-step guide»

`public/demo/how-to-guide.html` собран самим приложением (кнопка «Save project for editing»), скрипт только кликает.

1. `npm run build` и `npx vite preview --port 5199 --strictPort`.
2. В этой папке: `python -m http.server 8765` (отдаёт `portal.html`, «программу» для записи).
3. `node build-demo.cjs <папка для кадров> dialog-en.png ../../public/demo/how-to-guide.html`
   (нужен Playwright: `PLAYWRIGHT_PATH=<путь к node_modules/playwright>`, и установленный Google Chrome;
   путь к chrome.exe в скрипте).

Chrome запускается видимым с флагом `--auto-select-tab-capture-source-by-title=Sales Portal`, поэтому
диалог выбора вкладки закрывается сам. Кадр самого диалога (`dialog-en.png`) снят отдельно с экрана
(Chrome 157, `--lang=en-US`) и вставлен в шаг 4 поверх плавающего пульта, как он и появляется.
Шаги 3–11: склейка двух настоящих снимков (вкладка + окно пульта 540x680) с подписанной рамкой окна.
