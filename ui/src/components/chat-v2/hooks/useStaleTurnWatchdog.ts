// PD-SAAS-FORK: detect hung in-progress turns and trigger fallback continue

import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveClientProcessUxConfig } from '../../../shared/processUxConfig';
import type { ChatMessage } from '../../chat/types/types';

export type StaleTurnPhase = 'warn' | 'fallback' | null;

export type StaleTurnState = {
  phase: StaleTurnPhase;
  stuckStepLabel: string | null;
  elapsedSec: number;
};

function parseActivityTimestamp(message: ChatMessage): number | null {
  const raw = message.startedAt || message.timestamp || message.createdAt;
  if (!raw) return null;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Infer last visible tool/step label for user-facing stale-turn copy. */
export function inferStaleTurnStepLabel(
  activities: ChatMessage[],
  chatMessages: ChatMessage[],
): string | null {
  const candidates = [...activities, ...chatMessages].slice(-12).reverse();
  for (const message of candidates) {
    const toolName =
      typeof message.toolName === 'string' ? message.toolName
        : typeof message.metadata?.toolName === 'string' ? message.metadata.toolName
          : null;
    if (toolName) {
      return toolName;
    }
    const title = typeof message.title === 'string' ? message.title.trim() : '';
    if (title && /grep|bash|read_skill|glob|read_file|web_search|fetch/i.test(title)) {
      return title;
    }
    const content = typeof message.content === 'string' ? message.content : '';
    if (/read_skill|grep|dir \/s|router_judge|glob/i.test(content)) {
      const match = content.match(/\b(read_skill|grep|bash|glob|read_file)\b/i);
      if (match) return match[1];
    }
  }
  return null;
}

export type UseStaleTurnWatchdogOptions = {
  isWorking: boolean;
  startedAtMs: number | null;
  activities: ChatMessage[];
  chatMessages: ChatMessage[];
  isConnected?: boolean;
  /** PD-SAAS-FORK: Bridge already aborted stale turn — UI only warns, no second abort. */
  suppressFallback?: boolean;
  /** PD-SAAS-FORK: manual continue mode — never auto abort+submitTurn. */
  disableAutoFallback?: boolean;
  onFallback?: (stuckStepLabel: string | null) => void | Promise<void>;
};

export function useStaleTurnWatchdog({
  isWorking,
  startedAtMs,
  activities,
  chatMessages,
  isConnected = true,
  suppressFallback = false,
  disableAutoFallback = false,
  onFallback,
}: UseStaleTurnWatchdogOptions): StaleTurnState {
  const ux = resolveClientProcessUxConfig();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const fallbackFiredRef = useRef(false);
  const lastActivityMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isWorking) {
      fallbackFiredRef.current = false;
      lastActivityMsRef.current = null;
      return undefined;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isWorking]);

  useEffect(() => {
    if (!isWorking) return;
    const latest = [...activities, ...chatMessages]
      .map(parseActivityTimestamp)
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a)[0];
    if (latest !== undefined) {
      lastActivityMsRef.current = latest;
    }
  }, [activities, chatMessages, isWorking]);

  const effectiveStart = startedAtMs ?? lastActivityMsRef.current ?? nowMs;
  const elapsedSec = isWorking
    ? Math.max(0, Math.floor((nowMs - effectiveStart) / 1000))
    : 0;
  const idleSec = lastActivityMsRef.current
    ? Math.max(0, Math.floor((nowMs - lastActivityMsRef.current) / 1000))
    : elapsedSec;

  const stuckStepLabel = inferStaleTurnStepLabel(activities, chatMessages);

  let phase: StaleTurnPhase = null;
  if (
    isWorking
    && ux.enabled
    && ux.staleTurnFallbackSec > 0
    && idleSec >= ux.staleTurnFallbackSec
  ) {
    phase = 'fallback';
  } else if (
    isWorking
    && ux.enabled
    && ux.staleTurnWarnSec > 0
    && idleSec >= ux.staleTurnWarnSec
  ) {
    phase = 'warn';
  }

  const triggerFallback = useCallback(async () => {
    if (fallbackFiredRef.current || !onFallback) return;
    fallbackFiredRef.current = true;
    await onFallback(stuckStepLabel);
  }, [onFallback, stuckStepLabel]);

  useEffect(() => {
    if (phase !== 'fallback' || !isConnected || !onFallback || suppressFallback || disableAutoFallback) return;
    void triggerFallback();
  }, [disableAutoFallback, isConnected, onFallback, phase, suppressFallback, triggerFallback]);

  return { phase, stuckStepLabel, elapsedSec };
}
