import { describe, expect, it } from 'vitest';
import {
  isDeliverableRepairInFlight,
  resolveDeliverableUserStatusCopy,
  resolveShowUserAckHint,
} from './deliverableUserStatusCopy';

describe('deliverableUserStatusCopy', () => {
  const base = {
    sessionTaskPhase: 'idle' as const,
    autoContinueEnabled: true,
    trustCopyV2Enabled: true,
    requiredDone: 2,
    requiredTotal: 4,
  };

  it('repair pending uses aligning placeholder and suppresses manual continue', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      sessionTaskPhase: 'deliverable_repair_pending',
      continuationOwner: 'deliverable_repair',
      sessionRepairActive: true,
    });
    expect(copy.composerPlaceholderKey).toBe('composer.deliverableAligningPlaceholder');
    expect(copy.suppressManualContinueHint).toBe(true);
    expect(copy.showUserAckHint).toBe(false);
  });

  it('queued session uses queue placeholder', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      executionStatus: 'queued',
      queuePosition: 2,
    });
    expect(copy.composerPlaceholderKey).toBe('composer.deliverableQueuedPlaceholder');
    expect(copy.composerPlaceholderValues.position).toBe(2);
  });

  it('turn_queued phase uses queue placeholder even without catalog status', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      sessionTaskPhase: 'turn_queued',
      queuePosition: 1,
    });
    expect(copy.composerPlaceholderKey).toBe('composer.deliverableQueuedPlaceholder');
    expect(copy.liveDockTitleKey).toBe('sidebar.sessions.queued');
  });

  it('shows user ack hint only when incomplete without repair', () => {
    expect(resolveShowUserAckHint({
      ...base,
      sessionTaskPhase: 'deliverable_incomplete',
      trustCopyV2Enabled: true,
    })).toBe(true);
    expect(resolveShowUserAckHint({
      ...base,
      sessionTaskPhase: 'deliverable_incomplete',
      continuationOwner: 'deliverable_repair',
      trustCopyV2Enabled: true,
    })).toBe(false);
  });

  it('manual continue when auto-continue off and incomplete', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      autoContinueEnabled: false,
      sessionTaskPhase: 'deliverable_incomplete',
    });
    expect(copy.composerPlaceholderKey).toBe('composer.deliverableIncompleteManualPlaceholder');
    expect(copy.suppressManualContinueHint).toBe(false);
  });

  it('quality passed + incomplete maps presentation key', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      qualityCompletion: 'passed',
      completionState: 'incomplete',
    });
    expect(copy.qualityPresentationKey).toBe('deliverables.qualityStatus.contentPassedAligning');
  });

  it('streaming assistant uses making copy not aligning list', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      isAssistantWorking: true,
      validationSettled: false,
      sessionTaskPhase: 'turn_streaming',
    });
    expect(copy.composerPlaceholderKey).toBe('composer.taskInFlightPlaceholder');
    expect(copy.liveDockTitleKey).toBe('working.making');
    expect(copy.liveDockTitleKey).not.toBe('working.deliverableAligning');
  });

  it('first-turn working beats stale repair flags', () => {
    const copy = resolveDeliverableUserStatusCopy({
      ...base,
      isAssistantWorking: true,
      sessionTaskPhase: 'turn_streaming',
      sessionRepairActive: true,
      continuationOwner: 'deliverable_repair',
      acceptanceStatus: 'needs_repair',
      requiredDone: 0,
      requiredTotal: 0,
    });
    expect(copy.composerPlaceholderKey).toBe('composer.taskInFlightPlaceholder');
    expect(copy.liveDockTitleKey).toBe('working.making');
  });

  it('isDeliverableRepairInFlight detects continuation owner', () => {
    expect(isDeliverableRepairInFlight({
      ...base,
      continuationOwner: 'deliverable_repair',
    })).toBe(true);
  });
});
