// PD-SAAS-FORK: post-complete next chips (Beta only)

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPostDeliverableNextMode } from '../flags/workbenchBetaFlags';
import { emitBetaEvent } from '../telemetry/workbenchBetaTelemetry';
import { suggestPostDeliverableActions } from './suggestPostDeliverableActions';

export type PostDeliverableNextChipsProps = {
  sessionId: string;
  basenames: string[];
  profileId?: string | null;
  terminalComplete: boolean;
  hasPendingSlots: boolean;
  onPrefill: (prompt: string) => void;
};

const DISMISS_PREFIX = 'wb-beta-nextdismiss-';

function isDismissed(sessionId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_PREFIX}${sessionId}`) === '1';
  } catch {
    return false;
  }
}

function setDismissed(sessionId: string): void {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${sessionId}`, '1');
  } catch {
    /* ignore */
  }
}

export default function PostDeliverableNextChips({
  sessionId,
  basenames,
  profileId,
  terminalComplete,
  hasPendingSlots,
  onPrefill,
}: PostDeliverableNextChipsProps) {
  const { t } = useTranslation('common');
  const mode = getPostDeliverableNextMode();
  const [hidden, setHidden] = useState(() => isDismissed(sessionId));
  const actions = useMemo(
    () => suggestPostDeliverableActions({ basenames, profileId }),
    [basenames, profileId],
  );

  const visible =
    mode !== 'off'
    && terminalComplete
    && !hasPendingSlots
    && !!sessionId
    && !hidden
    && actions.length > 0;

  useEffect(() => {
    if (!visible) return;
    emitBetaEvent('beta_next_impression', {
      sessionId,
      pills: actions.map((a) => a.id),
    });
  }, [visible, sessionId, actions]);

  if (!visible) return null;

  return (
    <div
      className="wb-beta-next-steps"
      data-beta-next-steps="1"
      data-testid="wb-beta-next-steps"
    >
      <div className="wb-beta-next-head">
        <span>{t('workbenchBeta.next.heading', '接下来可以')}</span>
        <span className="wb-beta-next-hint">
          {t('workbenchBeta.next.hint', '点一下预填，确认后再发送')}
        </span>
        <button
          type="button"
          className="wb-beta-next-dismiss"
          aria-label={t('workbenchBeta.next.dismiss', '关闭')}
          onClick={() => {
            setDismissed(sessionId);
            setHidden(true);
            emitBetaEvent('beta_next_dismiss', { sessionId });
          }}
        >
          ×
        </button>
      </div>
      <div className="wb-beta-next-pills">
        {actions.map((action, idx) => (
          <button
            key={action.id}
            type="button"
            className={`wb-beta-next-pill${idx === 0 ? ' is-primary' : ''}`}
            data-testid={`wb-beta-next-${action.id}`}
            onClick={() => {
              emitBetaEvent('beta_next_click', {
                sessionId,
                kind: action.id,
                mode,
              });
              if (mode === 'enforce') {
                onPrefill(action.prompt);
              }
            }}
          >
            {t(action.labelKey, action.prompt.slice(0, 16))}
          </button>
        ))}
      </div>
    </div>
  );
}
