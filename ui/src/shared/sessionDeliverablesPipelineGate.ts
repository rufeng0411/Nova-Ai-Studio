/**
 * PD-SAAS-FORK: defer heavy deliverable scans until after session switch paint.
 * Prevents main-thread freeze when hydrating large cached transcripts.
 */
import { useEffect, useState } from 'react';
import { isDeferDeliverablesWhileStreamingEnabled } from './perfFeatureFlags';

const IDLE_TIMEOUT_FALLBACK_MS = 150;

export function resolveSessionSwitchDeferMs(): number {
  const raw = import.meta.env.VITE_SESSION_SWITCH_DEFER_MS;
  const parsed = raw === undefined || raw === '' ? 300 : Number(raw);
  const value = Number.isFinite(parsed) ? parsed : 300;
  return Math.min(800, Math.max(150, value));
}

export function useSessionDeliverablesPipelineGate(sessionId: string | null | undefined): boolean {
  const [ready, setReady] = useState(true);
  const deferMs = resolveSessionSwitchDeferMs();

  useEffect(() => {
    if (!sessionId) {
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    let idleId: number | ReturnType<typeof setTimeout> | undefined;

    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      if (typeof requestIdleCallback === 'function') {
        idleId = requestIdleCallback(() => {
          if (!cancelled) setReady(true);
        }, { timeout: deferMs });
      } else {
        idleId = setTimeout(() => {
          if (!cancelled) setReady(true);
        }, deferMs);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (typeof idleId === 'number' && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      } else if (idleId !== undefined) {
        clearTimeout(idleId as ReturnType<typeof setTimeout>);
      }
    };
  }, [deferMs, sessionId]);

  return ready;
}

export function shouldRunSessionDeliverablesPipeline(input: {
  pipelineReady: boolean;
  isLoadingSessionMessages: boolean;
  messageCount: number;
  deferWhileAssistantWorking?: boolean;
  isAssistantWorking?: boolean;
}): boolean {
  if (!input.pipelineReady) return false;
  if (input.isLoadingSessionMessages && input.messageCount === 0) return false;
  if (
    input.deferWhileAssistantWorking
    && isDeferDeliverablesWhileStreamingEnabled()
    && input.isAssistantWorking
  ) {
    return false;
  }
  return true;
}
