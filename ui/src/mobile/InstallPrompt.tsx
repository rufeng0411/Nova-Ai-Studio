/**
 * PD-SAAS-FORK: one-time "add to home screen" hint for mobile browsers.
 *
 * Android/Chromium: captures `beforeinstallprompt` and offers a one-tap
 * install. iOS Safari: shows share-sheet instructions (no install API).
 * Dismissal is remembered in localStorage so the banner never nags.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, SquarePlus, X } from 'lucide-react';
import { useDeviceSettings } from '../hooks/useDeviceSettings';
import { useMobileShell } from '../hooks/useMobileShell';

const DISMISS_KEY = 'nova-install-prompt-dismissed';
const SHOW_DELAY_MS = 6_000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export default function InstallPrompt() {
  const { t } = useTranslation('common');
  const isMobile = useMobileShell();
  const { isPWA } = useDeviceSettings({ trackMobile: false });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (!isMobile || isPWA) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // storage unavailable — skip the banner entirely
      dismissed = true;
    }
    if (dismissed) return;

    let timer: number | undefined;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if (isIosSafari()) {
      setIosMode(true);
      timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      if (timer) window.clearTimeout(timer);
    };
  }, [isMobile, isPWA]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // user cancelled or prompt unavailable
    }
    dismiss();
  }, [deferredPrompt, dismiss]);

  if (!visible || !isMobile || isPWA) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
        <img src="/logo-128.png" alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">
            {t('mobile.install.title', { defaultValue: '添加到主屏幕' })}
          </div>
          {iosMode && !deferredPrompt ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] leading-5 text-muted-foreground">
              <span>{t('mobile.install.iosStep1', { defaultValue: '点击底部' })}</span>
              <Share className="inline h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{t('mobile.install.iosStep2', { defaultValue: '分享按钮，选择' })}</span>
              <SquarePlus className="inline h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{t('mobile.install.iosStep3', { defaultValue: '「添加到主屏幕」' })}</span>
            </div>
          ) : (
            <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
              {t('mobile.install.subtitle', { defaultValue: '像 App 一样全屏使用，启动更快。' })}
            </div>
          )}
          {deferredPrompt ? (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-[12.5px] font-medium text-primary-foreground active:opacity-80"
            >
              {t('mobile.install.action', { defaultValue: '安装' })}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('mobile.install.dismiss', { defaultValue: '关闭' }) as string}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
