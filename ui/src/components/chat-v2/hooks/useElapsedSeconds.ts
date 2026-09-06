// PD-SAAS-FORK: client-side elapsed seconds for live process UI

import { useEffect, useState } from 'react';

export function useElapsedSeconds(
  startedAtMs: number | null | undefined,
  isRunning: boolean,
): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  if (!startedAtMs || !Number.isFinite(startedAtMs)) return 0;
  if (!isRunning) return Math.max(0, nowMs - startedAtMs);
  return Math.max(0, nowMs - startedAtMs);
}

export function formatElapsedLabel(seconds: number, t?: (key: string, opts?: { defaultValue?: string; seconds?: number }) => string): string {
  const tr = t ?? ((_k, o) => o?.defaultValue ?? '');
  if (seconds >= 20) {
    return tr('process.elapsed.longWait', {
      defaultValue: '仍在继续处理，请稍候',
    });
  }
  return tr('process.elapsed.running', {
    seconds,
    defaultValue: `已用时 ${seconds}s`,
  });
}
