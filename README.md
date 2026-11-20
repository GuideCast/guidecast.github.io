**English** | [Русский](README.ru.md)

# GuideCast 🚀
### A universal builder for interactive step-by-step guides and simulators

[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Dexie](https://img.shields.io/badge/Dexie-IndexedDB-008080.svg?style=flat-square)](https://dexie.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**GuideCast** is a powerful, fully client-side web app for instantly creating interactive tutorials, documentation and simulators for **any software, SaaS platform, web service or operating system**.

It runs locally in your browser: screenshots and metadata are stored in a local IndexedDB database (Dexie.js), no backend is required, and a project exports to a **single self-contained HTML file** ready to publish or hand to users.

---

## 🌟 Key features

### 1. 🎥 Live Capture with a "snipping tool" selection
- **Capture a live screen or window stream** using the system dialog (`navigator.mediaDevices.getDisplayMedia`).
- **Snipping tool**: drag over a button or area directly on the live video. The frame freezes instantly, is saved to the database and becomes a new step with exact coordinates.
- **Several steps on one frame**: when the action happens in the same window or modal, add new steps without duplicating heavy screenshots.

### 2. 🪟 Floating Document Picture-in-Picture window
- **Document PiP API**: move the recording controls into a separate always-on-top mini window (`window.documentPictureInPicture`).
- **Record without switching windows**: work in the target program (any IDE, CRM, ERP or office suite) while a compact remote with a live preview, quick-capture buttons, action picker and voice recording floats above it.
- **Built-in fallback**: browsers without Document PiP get an in-page floating widget automatically.

### 3. 🎤 Free voice input (Web Speech API)
- **0 tokens, 0 keys, 100% free**: uses the browser's built-in speech recognition.
- **Smart voice-command parser**. Say:
  - *"Click the Create report button"* → action `click`, element `Create report`, text: `Click <b>Create report</b>.`
  - *"Enter the server address"* → action `type`, text: `Enter <b>server address</b> in the input field.`
  - *"Select the Export item"* → action `select`, text: `Select <b>Export</b> from the list.`
  - *"Note the sync status"* → action `look`.
- Instant switching between **RU-RU** and **EN-US** recognition.

### 4. ✨ 3 levels of AI economy
- **Level 0: offline templater (0 tokens)**
  Automatically produces tidy bilingual instructions with `<b>...</b>` tags from the UI element's name.
- **Level 1: batch prompt for free web chats (ChatGPT, Claude, DeepSeek)**
  One click generates a structured prompt with all steps and voice drafts of the project. Paste it into any free chat, then paste the JSON reply back, and every step is updated and formatted in seconds.
- **Level 2: Gemini API with micro-crops (Token Saver)**
  Instead of sending a full 2–4 MB screenshot, the tool cuts out a small context fragment of the target area (~15–25 KB JPEG) with a red frame. That saves **20–50× tokens and traffic**, and Gemini still reads the button label and writes bilingual descriptions.

### 5. 🛡️ Global blur and privacy protection (`subtractRect`)
- **Universal blur presets**:
  - narrow left navigation bar (4.5% of width);
  - wide project and folder tree (14% of width);
  - user profile, email and avatar (top-right corner);
  - top navigation bar and the client's corporate name.
- **Global blur (`globalBlurBoxes`)**: set once, applied to confidential zones on **every frame of the project**.
- **Local blur and cover masks**: blur or paint over specific fields on a single frame.
- **Automatic active-button cut-out (`subtractRect`)**: when exporting the public version, global blur hides everything confidential but leaves a clean "window" over the step's active button so users can see where to click (unless the `keepBlur` flag is on).

### 6. 📦 Self-contained export to one HTML file
- **A single `.html` file**: all CSS, vector SVG icons, fonts and screenshots (optimized Base64) are packed into one file.
- **Interactive simulator mode**: a clickable area with a pulsing highlight moves the user to the next step only when the correct UI element is clicked.
- **Bilingual**: switch RU / EN instantly in the guide header.
- **Full backward compatibility**: import and export `steps.json` with coordinates based on `display_width: 2000`, compatible with external build scripts.

---

## 🛠️ Architecture and project structure

```text
guidecast.github.io/
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions CI/CD for GitHub Pages
├── src/
│   ├── components/
│   │   ├── capture/
│   │   │   └── LiveCaptureWorkspace.tsx # Live capture, PiP window, snipping tool
│   │   └── editor/
│   │       └── AiAndPrivacyModal.tsx    # Global blur and AI dialog
│   ├── db/
│   │   └── database.ts            # Dexie.js (IndexedDB) storage layer
│   ├── services/
│   │   ├── aiAssistantService.ts  # 3 AI levels, micro-crops, blur presets
│   │   ├── speechService.ts       # Web Speech API controller and command parser
│   │   ├── pipRecorderService.ts  # Document Picture-in-Picture controller
│   │   └── importerExporter.ts    # Standalone HTML and steps.json generator
│   ├── types/
│   │   └── guide.ts               # Types for projects, steps, coordinates, assets
│   ├── App.tsx                    # Root application UI
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind CSS styles
├── index.html                     # Main HTML template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── vite.config.ts                 # Vite configuration (relative paths, base: './')
```

---

## 🚀 Quick start (local development)

### Requirements
- **Node.js** 18+ (20 LTS recommended)
- **Browser**: a modern Chromium browser (Google Chrome, Microsoft Edge, Brave, Opera) for full Web Speech API and Document Picture-in-Picture support.

### Install and run

1. Clone the repository:
   ```bash
   git clone https://github.com/GuideCast/guidecast.github.io.git
   cd guidecast.github.io
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. Build for publishing:
   ```bash
   npm run build
   ```
   The static files will be in the `dist/` folder.

---

## 📖 How to use

1. **Create or import a project**:
   - Click **"+ New guide"** for a blank project, or **"Import folder (steps.json)"** to load a previously created guide with screenshots.
   - **"Load demo guide"** is available for a quick tour.
2. **Tab "1. Capture"**:
   - Click **"Start window capture"** and choose the target program's window.
   - Click **"Floating window (PiP)"** to keep the control panel above other windows.
   - Drag over the button you need on screen. The frame is captured and a step is added automatically.
3. **Tab "2. Editor"**:
   - Pick a step from the list on the left.
   - Switch drawing modes right on the canvas:
     - 🔴 **Target Box**: the exact click zone;
     - 🌫 **Step Blur**: hide sensitive data on this screenshot only;
     - 📌 **Global Blur**: hide the corporate panel on all frames;
     - 🎨 **Mask**: paint over an area with an opaque plate.
   - Use **"🎤 Dictate"** to speak the actions.
   - Click **"✨ Auto-description from micro-crop"** for smart recognition via Gemini.
4. **Tab "3. Player and Export"**:
   - Check the interactive preview in simulator mode.
   - Click **"guide-public.html"** to download the finished single-file guide with blur applied.

---

## 🔒 Security and privacy

- **Your data stays with you**: neither screenshots nor texts are sent to remote servers without your explicit request.
- **IndexedDB**: the project is stored in your browser's local sandbox.
- **Gemini API (BYOK, bring your own key)**: the API key is kept only in your browser (`localStorage`), and only a tiny cut-out fragment of the button is sent.

---

## 📄 License

Released under the **MIT** license. See [LICENSE](LICENSE).
