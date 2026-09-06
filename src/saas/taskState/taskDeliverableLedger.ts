import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";

export type TaskDeliverableValidationStatus =
  | "verified"
  | "softVerified"
  | "missing"
  | "broken"
  | "phantom";

export type TaskDeliverableSource =
  | "tool"
  | "engine_acceptance"
  | "meta_backfill"
  | "manual_reference"
  | "legacyMeta";

export type TaskDeliverableDisplayRole =
  | "primary"
  | "supporting"
  | "processOnly"
  | "hidden";

export type TaskDeliverableAcceptanceRole =
  | "required"
  | "optional"
  | "supporting"
  | "notApplicable";

export type TaskDeliverableResolvedBy =
  | "exact"
  | "hintDir"
  | "ledger"
  | "legacyMeta";

export type TaskDeliverableLedgerRecord = {
  taskId?: string;
  turnId: string;
  sessionId?: string;
  tenantId?: string;
  workspaceRoot?: string;
  goalVersion?: number;
  capabilitySlug?: string;
  profileId?: string;
  apiPath: string;
  resolvedPath?: string;
  hintDir?: string;
  turnArtifactDir?: string;
  basename?: string;
  previewKind?: string;
  sizeBytes?: number;
  contentHash?: string;
  source: TaskDeliverableSource;
  validationStatus: TaskDeliverableValidationStatus;
  displayRole: TaskDeliverableDisplayRole;
  acceptanceRole: TaskDeliverableAcceptanceRole;
  resolvedBy: TaskDeliverableResolvedBy;
};

export type LedgerBackedTurnMeta = {
  turnArtifactDir?: string;
  verifiedPaths?: string[];
  alignmentStatus?: "aligned" | "bare_name_risk" | "unrecoverable" | "missing_on_disk" | "cross_deck_phantom";
};

type LegacyMetaLike = {
  type: "turn_deliverable_meta";
  turnId?: string;
  turnArtifactDir?: string;
  verifiedPaths?: string[];
  alignmentStatus?: LedgerBackedTurnMeta["alignmentStatus"];
};

const VALIDATION_RANK: Record<TaskDeliverableValidationStatus, number> = {
  verified: 50,
  softVerified: 40,
  broken: 20,
  missing: 10,
  phantom: 0,
};

const SOURCE_RANK: Record<TaskDeliverableSource, number> = {
  tool: 50,
  engine_acceptance: 45,
  meta_backfill: 35,
  legacyMeta: 30,
  manual_reference: 10,
};

function normalizePath(value: string | undefined): string {
  return String(value ?? "").replace(/\\/g, "/").trim();
}

function ledgerKey(record: TaskDeliverableLedgerRecord): string {
  const resolved = normalizePath(record.resolvedPath || record.apiPath).toLowerCase();
  return `${record.turnId}:${resolved}`;
}

function rankRecord(record: TaskDeliverableLedgerRecord): number {
  return VALIDATION_RANK[record.validationStatus]
    + SOURCE_RANK[record.source]
    + (record.resolvedPath ? 8 : 0)
    + (record.sizeBytes && record.sizeBytes > 0 ? 4 : 0);
}

export function mergeDeliverableLedgerRecords(
  records: TaskDeliverableLedgerRecord[],
): TaskDeliverableLedgerRecord[] {
  const byKey = new Map<string, TaskDeliverableLedgerRecord>();
  for (const record of records) {
    const normalizedApiPath = normalizePath(record.apiPath);
    if (!record.turnId || !normalizedApiPath) continue;
    const normalized: TaskDeliverableLedgerRecord = {
      ...record,
      apiPath: normalizedApiPath,
      resolvedPath: record.resolvedPath ? normalizePath(record.resolvedPath) : undefined,
      hintDir: record.hintDir ? normalizePath(record.hintDir).replace(/\/+$/, "") : undefined,
      turnArtifactDir: record.turnArtifactDir ? normalizePath(record.turnArtifactDir).replace(/\/+$/, "") : undefined,
    };
    const key = ledgerKey(normalized);
    const existing = byKey.get(key);
    if (!existing || rankRecord(normalized) >= rankRecord(existing)) {
      byKey.set(key, normalized);
    }
  }
  return [...byKey.values()];
}

function isLedgerEntry(
  entry: AgentTranscriptEntry,
): entry is AgentTranscriptEntry & { type: "task_deliverable_ledger"; record: TaskDeliverableLedgerRecord } {
  return entry.type === "task_deliverable_ledger";
}

export function buildDeliverableLedgerFromEntries(
  entries: AgentTranscriptEntry[],
): TaskDeliverableLedgerRecord[] {
  return mergeDeliverableLedgerRecords(
    entries
      .filter(isLedgerEntry)
      .map((entry) => entry.record),
  );
}

function isDisplayableVerified(record: TaskDeliverableLedgerRecord): boolean {
  return (record.validationStatus === "verified" || record.validationStatus === "softVerified")
    && record.displayRole !== "hidden"
    && record.displayRole !== "processOnly";
}

function addLegacyMeta(
  map: Map<string, LedgerBackedTurnMeta>,
  legacyMeta: LegacyMetaLike[],
): void {
  for (const meta of legacyMeta) {
    if (!meta.turnId || map.has(meta.turnId)) continue;
    map.set(meta.turnId, {
      turnArtifactDir: meta.turnArtifactDir,
      verifiedPaths: meta.verifiedPaths,
      alignmentStatus: meta.alignmentStatus,
    });
  }
}

export function buildLedgerBackedTurnMetaMap(
  records: TaskDeliverableLedgerRecord[],
  legacyMeta: LegacyMetaLike[] = [],
): Map<string, LedgerBackedTurnMeta> {
  const map = new Map<string, LedgerBackedTurnMeta>();
  for (const record of mergeDeliverableLedgerRecords(records)) {
    if (!isDisplayableVerified(record)) continue;
    const current = map.get(record.turnId) ?? {
      turnArtifactDir: record.turnArtifactDir ?? record.hintDir,
      verifiedPaths: [],
      alignmentStatus: "aligned" as const,
    };
    const verifiedPath = normalizePath(record.resolvedPath || record.apiPath);
    if (verifiedPath && !(current.verifiedPaths ?? []).includes(verifiedPath)) {
      current.verifiedPaths = [...(current.verifiedPaths ?? []), verifiedPath];
    }
    current.turnArtifactDir = current.turnArtifactDir ?? record.turnArtifactDir ?? record.hintDir;
    map.set(record.turnId, current);
  }
  addLegacyMeta(map, legacyMeta);
  return map;
}
