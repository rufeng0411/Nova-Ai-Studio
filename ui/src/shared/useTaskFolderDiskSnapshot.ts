/**
 * PD-SAAS-FORK: scoped disk snapshot envelope for UDC Dock enrich (R11 PR-3 + 0717 P0-4).
 */
import { useEffect, useRef, useState } from 'react';
import {
  buildTaskFolderSnapshotContractIdentity,
  createLoadingTaskFolderSnapshot,
  createNotApplicableTaskFolderSnapshot,
  fetchTaskFolderSnapshotEnvelope,
  type TaskFolderSnapshotEnvelope,
} from './fetchTaskFolderSnapshot';
import type { SessionDeliverableSlotUi } from './resolveSessionDeliverableManifest';
import { resolveRetainedSnapshotEnvelope } from './stickyDeliverableBarPersist';

const DEFAULT_SNAPSHOT_MIN_MS = 1500;

function isTaskFolderSnapshotEnabled(): boolean {
  const flag = import.meta.env.VITE_TASK_FOLDER_SNAPSHOT ?? import.meta.env.PILOTDECK_TASK_FOLDER_SNAPSHOT;
  if (flag === '0' || flag === 'false') return false;
  return true;
}

export function resolveTaskFolderSnapshotMinMs(): number {
  const raw = import.meta.env.VITE_TASK_FOLDER_SNAPSHOT_MIN_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
  return DEFAULT_SNAPSHOT_MIN_MS;
}

export function useTaskFolderDiskSnapshot(input: {
  projectName?: string;
  scopeDir?: string | null;
  slots?: SessionDeliverableSlotUi[];
  enabled?: boolean;
  goalVersion?: number | null;
  contractHash?: string | null;
  sessionId?: string | null;
}): TaskFolderSnapshotEnvelope {
  const projectName = input.projectName ?? '';
  const scopeDir = input.scopeDir?.replace(/\\/g, '/').replace(/\/+$/, '') ?? '';
  const slots = input.slots;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const sessionId = input.sessionId ?? null;
  const enabled = input.enabled !== false && isTaskFolderSnapshotEnabled();
  const applicable = enabled
    && Boolean(projectName)
    && (scopeDir === 'artifacts' || scopeDir.startsWith('artifacts/'));
  const contractIdentity = buildTaskFolderSnapshotContractIdentity({
    slots,
    contractHash: input.contractHash,
  });
  const requestKey = [
    sessionId ?? '',
    projectName,
    scopeDir,
    contractIdentity,
    input.goalVersion ?? '',
  ].join('::');
  const [snapshotState, setSnapshotState] = useState<{
    requestKey: string;
    envelope: TaskFolderSnapshotEnvelope;
  }>(() => ({
    requestKey: '',
    envelope: createNotApplicableTaskFolderSnapshot('', 'snapshot_not_loaded'),
  }));
  const retainIdentityRef = useRef<{ sessionId: string | null; scopeDir: string }>({
    sessionId: null,
    scopeDir: '',
  });
  const lastFetchRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });

  useEffect(() => {
    if (!applicable) {
      const retained = resolveRetainedSnapshotEnvelope({
        applicable: false,
        sessionId,
        scopeDir,
        previousSessionId: retainIdentityRef.current.sessionId,
        previousScopeDir: retainIdentityRef.current.scopeDir,
        previousEnvelope: snapshotState.envelope.files.length > 0 ? snapshotState.envelope : null,
      });
      if (retained) {
        setSnapshotState({ requestKey, envelope: retained });
        return;
      }
      retainIdentityRef.current = { sessionId: null, scopeDir: '' };
      setSnapshotState({
        requestKey,
        envelope: createNotApplicableTaskFolderSnapshot(scopeDir, 'snapshot_disabled'),
      });
      return;
    }

    retainIdentityRef.current = { sessionId, scopeDir };
    if (
      lastFetchRef.current.key === requestKey
      && lastFetchRef.current.at > 0
      && Date.now() - lastFetchRef.current.at < resolveTaskFolderSnapshotMinMs()
    ) {
      return;
    }

    let cancelled = false;
    setSnapshotState({
      requestKey,
      envelope: createLoadingTaskFolderSnapshot(scopeDir),
    });
    const timer = window.setTimeout(() => {
      lastFetchRef.current = { key: requestKey, at: Math.max(Date.now(), 1) };
      void fetchTaskFolderSnapshotEnvelope({
        projectName,
        scopeDir,
        slots: slotsRef.current,
        contractHash: input.contractHash,
        goalVersion: input.goalVersion,
      }).then((envelope) => {
        if (!cancelled) {
          setSnapshotState({ requestKey, envelope });
        }
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    applicable,
    contractIdentity,
    input.contractHash,
    input.goalVersion,
    projectName,
    requestKey,
    scopeDir,
    sessionId,
  ]);

  if (!applicable) {
    const retained = resolveRetainedSnapshotEnvelope({
      applicable: false,
      sessionId,
      scopeDir,
      previousSessionId: retainIdentityRef.current.sessionId,
      previousScopeDir: retainIdentityRef.current.scopeDir,
      previousEnvelope: snapshotState.envelope.files.length > 0 ? snapshotState.envelope : null,
    });
    if (retained) return retained;
    return createNotApplicableTaskFolderSnapshot(scopeDir, 'snapshot_disabled');
  }
  if (snapshotState.requestKey !== requestKey) {
    return createLoadingTaskFolderSnapshot(scopeDir);
  }
  return snapshotState.envelope;
}
