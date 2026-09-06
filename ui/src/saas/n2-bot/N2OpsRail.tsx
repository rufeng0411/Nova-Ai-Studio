// PD-SAAS-FORK: N2 Bot β ops rail — workspace groups, running first, outcomes on the card.
import type { N2OpsItem, N2OpsRailSection } from '../../../../src/saas/n2Bot/n2BotTypes';
import { buildN2OpsRailSections } from '../../../../src/saas/n2Bot/opsFeed';
import { n2Copy } from './n2BotCopy';

type Copy = ReturnType<typeof n2Copy>;

function statusLabel(status: N2OpsItem['status'], copy: Copy): string {
  switch (status) {
    case 'need':
      return copy.need;
    case 'run':
      return copy.run;
    case 'queue':
      return copy.queue;
    case 'plan':
      return copy.plan;
    case 'done':
      return copy.done;
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

function outcomeLine(item: N2OpsItem, copy: Copy): string | null {
  if (item.status === 'plan') return null;
  const count = item.outcomeCount ?? item.files?.length ?? 0;
  if (count > 0) return copy.outcomesCount(count);
  return copy.outcomesNone;
}

function progressBit(item: N2OpsItem): string | null {
  if (typeof item.done === 'number' && typeof item.total === 'number' && item.total > 0) {
    return `${item.done}/${item.total}`;
  }
  return null;
}

export default function N2OpsRail(props: {
  items: N2OpsItem[];
  copy: Copy;
  focusId?: string;
  allowedSend: boolean;
  onFocus: (sessionId: string) => void;
  onPause: (sessionId: string) => void;
  onAllowSend: () => void;
}) {
  const sections = buildN2OpsRailSections(props.items);
  if (sections.length === 0) {
    return <p className="n2b-ops-empty">{props.copy.opsEmpty}</p>;
  }

  return (
    <div className="n2b-ops-scroll">
      {sections.map((section) => (
        <OpsSection
          key={section.id}
          section={section}
          copy={props.copy}
          focusId={props.focusId}
          allowedSend={props.allowedSend}
          onFocus={props.onFocus}
          onPause={props.onPause}
          onAllowSend={props.onAllowSend}
        />
      ))}
    </div>
  );
}

function OpsSection(props: {
  section: N2OpsRailSection;
  copy: Copy;
  focusId?: string;
  allowedSend: boolean;
  onFocus: (sessionId: string) => void;
  onPause: (sessionId: string) => void;
  onAllowSend: () => void;
}) {
  const { section } = props;
  const label = section.kind === 'live'
    ? props.copy.liveGroup
    : section.kind === 'general'
      ? props.copy.general
      : section.label;
  const testId = section.kind === 'live'
    ? 'n2-bot-ops-live'
    : section.kind === 'general'
      ? 'n2-bot-ops-group-general'
      : 'n2-bot-ops-group-project';

  return (
    <section className={`n2b-group n2b-group-${section.kind}`} data-testid={testId}>
      <h3>{label}</h3>
      {section.items.map((card) => (
        <OpsCard
          key={card.workerSessionId}
          card={card}
          copy={props.copy}
          focused={props.focusId === card.workerSessionId}
          allowedSend={props.allowedSend}
          showScope
          onFocus={props.onFocus}
          onPause={props.onPause}
          onAllowSend={props.onAllowSend}
        />
      ))}
    </section>
  );
}

function OpsCard(props: {
  card: N2OpsItem;
  copy: Copy;
  focused: boolean;
  allowedSend: boolean;
  showScope: boolean;
  onFocus: (sessionId: string) => void;
  onPause: (sessionId: string) => void;
  onAllowSend: () => void;
}) {
  const { card, copy } = props;
  const outcome = outcomeLine(card, copy);
  const outcomeCount = card.outcomeCount ?? card.files?.length ?? 0;
  const progress = progressBit(card);
  const meta = [statusLabel(card.status, copy), progress, card.step].filter(Boolean).join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      className={`n2b-card ${props.focused ? 'is-focus' : ''} is-${card.status}`}
      data-testid="n2-bot-ops-card"
      onClick={() => props.onFocus(card.workerSessionId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          props.onFocus(card.workerSessionId);
        }
      }}
    >
      <i className={`n2b-dot is-${card.status}`} />
      <div className="n2b-card-main">
        <div className="n2b-card-head">
          <span className="n2b-card-title">{card.title}</span>
          {props.showScope ? (
            <span className="n2b-scope">{card.projectLabel || copy.general}</span>
          ) : null}
        </div>
        <p className="n2b-card-meta">{meta}</p>
        {outcome ? (
          <p
            className={`n2b-card-outcomes ${outcomeCount > 0 ? 'has-files' : 'no-files'}`}
            data-testid="n2-bot-ops-outcomes"
          >
            {outcome}
          </p>
        ) : null}
        {(card.status === 'run' || card.status === 'queue') && (
          <button
            type="button"
            className="n2b-card-act"
            onClick={(event) => {
              event.stopPropagation();
              props.onFocus(card.workerSessionId);
              props.onPause(card.workerSessionId);
            }}
          >
            {copy.pause}
          </button>
        )}
        {card.issue === 'send' && (
          <button
            type="button"
            data-testid="n2-bot-send"
            className="n2b-card-act"
            disabled={!props.allowedSend}
            onClick={(event) => {
              event.stopPropagation();
              if (!props.allowedSend) return;
              props.onAllowSend();
            }}
          >
            {copy.allowSend}
          </button>
        )}
      </div>
    </div>
  );
}
