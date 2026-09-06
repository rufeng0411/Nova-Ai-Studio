import { describe, expect, it } from 'vitest';
import { resolvePipelineValidationSettled } from './resolvePipelineValidationSettled';

describe('resolvePipelineValidationSettled', () => {
  it('returns false while assistant is working or repair is active', () => {
    expect(resolvePipelineValidationSettled({ isAssistantWorking: true })).toBe(false);
    expect(resolvePipelineValidationSettled({ sessionRepairActive: true })).toBe(false);
  });

  it('returns true when engine acceptance passed even if disk snapshot incomplete', () => {
    expect(resolvePipelineValidationSettled({
      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },
      diskSnapshotComplete: false,
    })).toBe(true);
  });

  it('fd7c166c: acceptance passed settles even while assistant still working (post-delivery review)', () => {
    expect(resolvePipelineValidationSettled({
      isAssistantWorking: true,
      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed', verifiedPaths: ['artifacts/task/index.html'] },
    })).toBe(true);
  });

  it('fd7c166c: disk complete + verifiedPaths settles during assistant working (no repair)', () => {
    expect(resolvePipelineValidationSettled({
      isAssistantWorking: true,
      diskSnapshotComplete: true,
      latestTurnAcceptanceMeta: { verifiedPaths: ['artifacts/task/index.html'] },
    })).toBe(true);
  });

  it('returns false when disk snapshot is inconclusive and acceptance not passed', () => {
    expect(resolvePipelineValidationSettled({
      diskSnapshotComplete: false,
    })).toBe(false);
  });

  it('returns true when disk snapshot complete and idle', () => {
    expect(resolvePipelineValidationSettled({
      diskSnapshotComplete: true,
    })).toBe(true);
  });

  it('returns false when certificate enforce blocks passed without complete cert', () => {
    expect(resolvePipelineValidationSettled({
      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },
      diskSnapshotComplete: false,
      certificateUiEnabled: true,
      certificateEnforce: true,
      certificateComplete: false,
    })).toBe(false);
  });
});
