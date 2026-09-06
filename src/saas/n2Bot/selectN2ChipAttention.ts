// PD-SAAS-FORK: chip attention from already-loaded sidebar catalog. No extra ops poll.

export type N2ChipAttention = "idle" | "active" | "needs_you";

export type ChipCatalogRow = {
  sessionId: string;
  sessionKind?: string | null;
  executionStatus?: string | null;
  deletedAt?: string | null;
  needsYou?: boolean;
  issue?: "quota" | "send" | "preview" | "" | null;
};

export function selectN2ChipAttention(rows: ChipCatalogRow[], stewardSessionId?: string | null): N2ChipAttention {
  let active = false;
  for (const row of rows) {
    if (row.deletedAt) continue;
    if (row.sessionKind === "n2_bot" || row.sessionId === stewardSessionId) continue;
    if (row.needsYou || row.issue === "quota" || row.issue === "send") return "needs_you";
    if (row.executionStatus === "running" || row.executionStatus === "queued") active = true;
  }
  return active ? "active" : "idle";
}
