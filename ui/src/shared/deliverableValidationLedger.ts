/**
 * PD-SAAS-FORK: session-scoped deliverable validation ledger — path-level frozen
 * entries written only from the active (latest) deliverable summary turn.
 */
import { normalizeHintDir } from '../../shared/deliverablePathResolve.mjs';
import type { ValidatedDeliverable } from './validateDeliverables';

export type LedgerEntryStatus = 'delivered' | 'incomplete' | 'broken';

export type DeliverableLedgerEntry = {
  canonicalPath: string;
  status: LedgerEntryStatus;
  resolvedPath?: string;
  apiPath?: string;
  label?: string;
  hintDir?: string;
  updatedAt: number;
};

export type DeliverableValidationLedger = Map<string, DeliverableLedgerEntry>;

const ledgersBySession = new Map<string, DeliverableValidationLedger>();

export function buildLedgerSessionKey(sessionId: string, projectName: string): string {
  return `${sessionId}\0${projectName}`;
}

export function canonicalDeliverableKey(
  path: string,
  hintDir?: string,
): string {
  const norm = path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  const hint = normalizeHintDir(hintDir) ?? '';
  return hint ? `${hint}\0${norm}` : norm;
}

export function getOrCreateLedger(sessionKey: string): DeliverableValidationLedger {
  let ledger = ledgersBySession.get(sessionKey);
  if (!ledger) {
    ledger = new Map();
    ledgersBySession.set(sessionKey, ledger);
  }
  return ledger;
}

export function clearLedger(sessionKey: string): void {
  ledgersBySession.delete(sessionKey);
}

export function readLedgerEntry(
  ledger: DeliverableValidationLedger,
  path: string,
  hintDir?: string,
): DeliverableLedgerEntry | undefined {
  return ledger.get(canonicalDeliverableKey(path, hintDir));
}

export function commitLedgerFromValidated(
  ledger: DeliverableValidationLedger,
  items: ValidatedDeliverable[],
  hintDir?: string,
): void {
  const now = Date.now();
  for (const item of items) {
    const path = item.apiPath || item.path;
    if (!path) continue;
    const key = canonicalDeliverableKey(path, hintDir);
    const existing = ledger.get(key);
    if (existing?.status === 'delivered') continue;

    if (
      item.validationStatus === 'verified'
      || item.validationStatus === 'softVerified'
      || (item.validationStatus === 'pending' && item.resolvedPath)
    ) {
      ledger.set(key, {
        canonicalPath: path,
        status: 'delivered',
        resolvedPath: item.resolvedPath ?? path,
        apiPath: item.apiPath ?? path,
        hintDir: normalizeHintDir(hintDir) ?? undefined,
        updatedAt: now,
      });
      continue;
    }

    if (item.validationStatus === 'broken') {
      ledger.set(key, {
        canonicalPath: path,
        status: 'broken',
        resolvedPath: item.resolvedPath,
        apiPath: item.apiPath,
        hintDir: normalizeHintDir(hintDir) ?? undefined,
        updatedAt: now,
      });
      continue;
    }

    if (!existing) {
      ledger.set(key, {
        canonicalPath: path,
        status: 'incomplete',
        apiPath: item.apiPath ?? path,
        hintDir: normalizeHintDir(hintDir) ?? undefined,
        updatedAt: now,
      });
    }
  }
}

export function partitionItemsByLedger(
  ledger: DeliverableValidationLedger,
  items: Array<{ path: string; apiPath?: string; id: string; kind: string; source: string }>,
  hintDir?: string,
): {
  ledgerDelivered: ValidatedDeliverable[];
  ledgerIncomplete: ValidatedDeliverable[];
  needsValidate: typeof items;
} {
  const ledgerDelivered: ValidatedDeliverable[] = [];
  const ledgerIncomplete: ValidatedDeliverable[] = [];
  const needsValidate: typeof items = [];

  for (const item of items) {
    const path = item.apiPath || item.path;
    const entry = readLedgerEntry(ledger, path, hintDir);
    if (!entry) {
      needsValidate.push(item);
      continue;
    }
    const base = {
      ...item,
      path: entry.canonicalPath,
      apiPath: entry.apiPath ?? item.apiPath,
      resolvedPath: entry.resolvedPath,
    };
    if (entry.status === 'delivered') {
      ledgerDelivered.push({ ...base, validationStatus: 'verified' });
    } else if (entry.status === 'broken') {
      ledgerDelivered.push({ ...base, validationStatus: 'broken' });
    } else {
      ledgerIncomplete.push({ ...base, validationStatus: 'pending' });
    }
  }

  return { ledgerDelivered, ledgerIncomplete, needsValidate };
}

/** Test-only */
export function clearAllLedgersForTests(): void {
  ledgersBySession.clear();
}
