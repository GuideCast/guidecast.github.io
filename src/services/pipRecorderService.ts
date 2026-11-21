/**
 * Document Picture-in-Picture Service
 * Enables opening an interactive floating always-on-top window containing
 * live preview, draw-to-shoot snipping canvas, step counter, and voice controls.
 */

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window?: Window | null;
    };
  }
}

let activePipWindow: Window | null = null;
const closeListeners = new Set<() => void>();

/**
 * Check whether Document Picture-in-Picture API is supported in this browser.
 * Note: Available in modern Chromium-based browsers (Chrome 116+, Edge 116+).
 */
export function isPipSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.documentPictureInPicture);
}

/**
 * Check whether a PiP window is currently open.
 */
export function isPipOpen(): boolean {
  return Boolean(activePipWindow && !activePipWindow.closed);
}

/**
 * Returns the currently active PiP window, if open.
 */
export function getActivePipWindow(): Window | null {
  if (activePipWindow && !activePipWindow.closed) {
    return activePipWindow;
  }
  return null;
}

/**
 * Register a listener invoked when the PiP window is closed.
 */
export function onPipClose(listener: () => void): () => void {
  closeListeners.add(listener);
  return () => {
    closeListeners.delete(listener);
  };
}

/**
 * Copy all application stylesheets (including Tailwind CSS) from main document to PiP window.
 */
export function syncStylesToPip(pipWin: Window) {
  try {
    // Copy the rules the main page has ALREADY loaded (document.styleSheets), instead of cloning <link> tags:
    // a cloned <link> makes the floating window download the CSS file again, and right after a new deploy the
    // old hashed file may be gone (404), leaving the recorder without any styling. <link> is only a fallback
    // for sheets whose rules cannot be read.
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const rules = [...styleSheet.cssRules].map((r) => r.cssText).join('\n');
        const style = pipWin.document.createElement('style');
        style.textContent = rules;
        pipWin.document.head.appendChild(style);
      } catch {
        if (styleSheet.href) {
          const link = pipWin.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href;
          pipWin.document.head.appendChild(link);
        }
      }
    });

    // 3. Set base styling for PiP document body
    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.padding = '0';
    pipWin.document.body.style.backgroundColor = '#090d16';
    pipWin.document.body.style.color = '#f8fafc';
    pipWin.document.body.style.fontFamily =
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    pipWin.document.body.style.overflow = 'auto';
    pipWin.document.body.style.userSelect = 'none';

    // Set title
    pipWin.document.title = 'Live Guide Remote · Always on Top';
  } catch (err) {
    console.warn('Error syncing styles to PiP window:', err);
  }
}

/**
 * Opens a Document Picture-in-Picture window with synced Tailwind styles.
 */
export async function openPipWindow(options?: {
  width?: number;
  height?: number;
}): Promise<Window | null> {
  if (!isPipSupported()) {
    console.warn('Document Picture-in-Picture API is not supported in this browser.');
    return null;
  }

  // If already open, focus it
  if (activePipWindow && !activePipWindow.closed) {
    activePipWindow.focus();
    return activePipWindow;
  }

  const width = options?.width || 520;
  const height = options?.height || 640;

  try {
    const pipWin = await window.documentPictureInPicture!.requestWindow({
      width,
      height,
    });

    activePipWindow = pipWin;

    // Sync all styles
    syncStylesToPip(pipWin);

    // Watch for window closure
    pipWin.addEventListener('pagehide', () => {
      activePipWindow = null;
      closeListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.error(e);
        }
      });
    });

    return pipWin;
  } catch (err) {
    console.error('Failed to open Document Picture-in-Picture window:', err);
    return null;
  }
}

/**
 * Close active PiP window if open.
 */
export function closePipWindow() {
  if (activePipWindow && !activePipWindow.closed) {
    try {
      activePipWindow.close();
    } catch {
      // ignore
    }
  }
  activePipWindow = null;
}
