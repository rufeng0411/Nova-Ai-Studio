// PD-SAAS-FORK: first-login workbench tour (Beta shell only)

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getWorkbenchTourMode } from '../flags/workbenchBetaFlags';
import { emitBetaEvent } from '../telemetry/workbenchBetaTelemetry';
import {
  clearTourLocal,
  isTourLocallyCompleted,
  markTourLocallyCompleted,
} from './workbenchTourStorage';
import { WORKBENCH_TOUR_STEPS, type WorkbenchTourStep } from './workbenchTourSteps';

const STEPS = WORKBENCH_TOUR_STEPS;

function queryAnchor(step: WorkbenchTourStep): Element | null {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
  if (narrow && step.id === 'new-chat') {
    const tab = document.querySelector(
      '[data-testid="wb-beta-tab-chat"], [data-testid="mobile-tab-chat"], [href*="chat"]',
    );
    if (tab) return tab;
  }
  for (const sel of [step.selector, step.fallbackSelector].filter(Boolean) as string[]) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

export type WorkbenchTourProps = {
  forceOpen?: boolean;
  onFinished?: () => void;
};

export default function WorkbenchTour({ forceOpen, onFinished }: WorkbenchTourProps) {
  const { t } = useTranslation('common');
  const mode = getWorkbenchTourMode();
  const [stepIdx, setStepIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ top: 80, left: 24, width: 160, height: 40 });
  const [cardPos, setCardPos] = useState({ top: 140, left: 24 });

  useEffect(() => {
    if (mode === 'off') return;
    if (forceOpen) {
      clearTourLocal();
      setOpen(true);
      setStepIdx(0);
      return;
    }
    if (!isTourLocallyCompleted()) setOpen(true);
  }, [forceOpen, mode]);

  const layout = useCallback(() => {
    const step = STEPS[stepIdx];
    if (!step) return;
    const el = queryAnchor(step);
    if (!el) {
      setSpot({ top: 72, left: 16, width: 180, height: 44 });
      setCardPos({ top: 140, left: 16 });
      return;
    }
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top - 6,
      left: r.left - 6,
      width: Math.max(r.width + 12, 48),
      height: Math.max(r.height + 12, 36),
    });
    const cardW = Math.min(360, window.innerWidth - 32);
    let left = Math.min(Math.max(16, r.left), window.innerWidth - cardW - 16);
    let top = r.bottom + 12;
    if (top + 180 > window.innerHeight) top = Math.max(16, r.top - 190);
    setCardPos({ top, left });
  }, [stepIdx]);

  useEffect(() => {
    if (!open) return;
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', layout, true);
    return () => {
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', layout, true);
    };
  }, [open, layout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finish = (skipped: boolean) => {
    markTourLocallyCompleted(skipped);
    if (mode === 'enforce') {
      void fetch('/api/saas/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workbenchTour: {
            v1: { completedAt: new Date().toISOString(), skipped },
          },
        }),
      }).catch(() => undefined);
    }
    emitBetaEvent('beta_tour_step', {
      step: stepIdx,
      action: skipped ? 'skip' : 'finish',
    });
    setOpen(false);
    onFinished?.();
  };

  const next = () => {
    emitBetaEvent('beta_tour_step', { step: stepIdx, action: 'next' });
    if (stepIdx >= STEPS.length - 1) {
      finish(false);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  if (mode === 'off' || !open) return null;
  const step = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div className="wb-beta-tour-root" id="tourRoot" data-testid="wb-beta-tour-root">
      <div className="wb-beta-tour-veil" id="tourVeil" aria-hidden="true" />
      <div
        className="wb-beta-tour-spot"
        id="tourSpot"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
        }}
      />
      <div
        className="wb-beta-tour-card"
        id="tourCard"
        role="dialog"
        aria-labelledby="tourTitle"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <div className="wb-beta-tour-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <button
          type="button"
          className="wb-beta-tour-skip"
          id="tourSkipTop"
          style={{ float: 'right' }}
          onClick={() => finish(true)}
        >
          {t('workbenchBeta.tour.skip', '跳过')}
        </button>
        <h3 id="tourTitle">{t(step.titleKey, step.titleDefault)}</h3>
        <p>{t(step.bodyKey, step.bodyDefault)}</p>
        <div className="wb-beta-tour-actions">
          <div className="wb-beta-tour-dots">
            {STEPS.map((_, i) => (
              <span key={STEPS[i].id} className={i === stepIdx ? 'is-on' : ''} />
            ))}
          </div>
          <button type="button" className="wb-beta-tour-btn" id="tourNext" onClick={next}>
            {stepIdx >= STEPS.length - 1
              ? t('workbenchBeta.tour.done', '开始使用')
              : t('workbenchBeta.tour.next', '下一步')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function requestWorkbenchTourReplay(): void {
  clearTourLocal();
  window.dispatchEvent(new CustomEvent('pilotdeck:workbench-beta-tour-replay'));
}
