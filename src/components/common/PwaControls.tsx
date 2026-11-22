import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { UI_TEXT, type UiLang } from '../../i18n/uiTranslations';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** True when the page already runs as an installed app window. */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Banner "new version available". Never reloads on its own, so unsaved work is safe. */
export function UpdateBanner({ uiLang }: { uiLang: UiLang }) {
  const t = UI_TEXT[uiLang].pwa;
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      };
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const id = window.setTimeout(() => setOfflineReady(false), 4000);
    return () => window.clearTimeout(id);
  }, [offlineReady, setOfflineReady]);

  // The plugin's own "update and reload" can stay silent in an installed window (a worker that was
  // already waiting when the window opened does not fire its reload event). So: tell the waiting
  // worker to take over, reload when it does, and reload anyway after a short wait.
  const applyUpdate = async () => {
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    try {
      navigator.serviceWorker?.addEventListener('controllerchange', reload, { once: true });
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      else updateServiceWorker(true).catch(() => undefined);
    } catch {
      // fall through to the timed reload below
    }
    window.setTimeout(reload, 2500);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      data-testid="pwa-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm shadow-lg"
    >
      {needRefresh ? (
        <>
          <RefreshCw className="w-4 h-4 text-teal-600" />
          <span>{t.updateReady}</span>
          <button
            onClick={applyUpdate}
            className="rounded-md bg-teal-600 px-3 py-1 font-medium text-white hover:bg-teal-700"
          >
            {t.update}
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            {t.later}
          </button>
        </>
      ) : (
        <>
          <span>{t.offlineReady}</span>
          <button onClick={() => setOfflineReady(false)} title={t.close} className="text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** Small "Install app" button. Hidden when installed already or when the browser cannot install. */
export function InstallButton({ uiLang }: { uiLang: UiLang }) {
  const t = UI_TEXT[uiLang].pwa;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  return (
    <button
      data-testid="install-app"
      title={t.installTitle}
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice.catch(() => undefined);
        setDeferred(null);
      }}
      className="ml-3 inline-flex items-center gap-1 underline underline-offset-2 hover:text-teal-700 dark:hover:text-teal-300"
    >
      <Download className="w-3 h-3" />
      {t.install}
    </button>
  );
}
