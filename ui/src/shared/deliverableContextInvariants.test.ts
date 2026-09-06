import { describe, expect, it } from 'vitest';
import { deliverableContextInvariantViolations } from './deliverableContextInvariants';
import { dedupeDeliverableRowsByBasename } from './dedupeDeliverableRowsByBasename';
import { normalizeConversationSummaryProgress } from './normalizeConversationSummaryProgress';
import { presentConversationDeliverableRows } from './presentConversationDeliverableRows';
import {
  F845_CONTRADICTORY_ROWS,
  buildF845FixtureMessages,
} from '../../../tests/fixtures/deliverable-context-f845-html-report';
import { buildTurnDeliverableView } from './buildTurnDeliverableView';

describe('deliverableContextInvariants', () => {
  it('I2: f845 contradictory rows duplicate basename before dedupe', () => {
    const violations = deliverableContextInvariantViolations(
      F845_CONTRADICTORY_ROWS,
      'turn_snapshot',
    );
    expect(violations.some((v) => v.id === 'I2')).toBe(true);
  });

  it('I3: external progress 2/2 with checking row is a violation', () => {
    const violations = deliverableContextInvariantViolations(
      F845_CONTRADICTORY_ROWS,
      'turn_snapshot',
      { progress: { done: 2, total: 2 } },
    );
    expect(violations.some((v) => v.id === 'I3')).toBe(true);
  });

  it('I4: terminal mode rejects checking rows', () => {
    const violations = deliverableContextInvariantViolations(
      F845_CONTRADICTORY_ROWS,
      'terminal',
    );
    expect(violations.some((v) => v.id === 'I4')).toBe(true);
  });

  it('dedupe + terminal present clears f845 contradiction', () => {
    const deduped = dedupeDeliverableRowsByBasename(F845_CONTRADICTORY_ROWS);
    const presented = presentConversationDeliverableRows(deduped, 'terminal');
    const progress = normalizeConversationSummaryProgress(presented);
    const violations = deliverableContextInvariantViolations(presented, 'terminal');
    expect(presented).toHaveLength(1);
    expect(presented[0]?.status).toBe('delivered');
    expect(progress.done).toBe(progress.total);
    expect(violations).toHaveLength(0);
  });
});

describe('buildTurnDeliverableView f845 fixture', () => {
  it('rebuilds a single delivered HTML row from transcript + SDM', () => {
    const messages = buildF845FixtureMessages();
    const view = buildTurnDeliverableView({
      sessionMessages: messages,
      turnEndMessage: messages[1]!,
    });
    expect(view).not.toBeNull();
    expect(view!.rows).toHaveLength(1);
    expect(view!.rows[0]?.status).toBe('delivered');
    expect(view!.progress.done).toBe(1);
    expect(view!.progress.total).toBe(1);
    expect(
      deliverableContextInvariantViolations(view!.rows, 'turn_snapshot', {
        expectedSlotCount: 1,
      }),
    ).toHaveLength(0);
  });
});
