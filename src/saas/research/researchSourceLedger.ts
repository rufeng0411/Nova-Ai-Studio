// PD-SAAS-FORK P0-9: bounded research source evidence ledger.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const RESEARCH_SOURCE_LEDGER_MAX_ENTRIES = 32;
export const RESEARCH_SOURCE_LEDGER_MAX_BYTES = 8 * 1024;
export const RESEARCH_SOURCE_ID_PREFIX = "src" as const;

export type ResearchSourceKind =
  | "web_fetch"
  | "official_fetch"
  | "attachment";

export type ResearchSourceEvidenceStatus = "accepted" | "candidate";

export type ResearchSourceEntry = {
  sourceId: string;
  kind: ResearchSourceKind;
  status: ResearchSourceEvidenceStatus;
  canonicalUrl: string;
  urlHash: string;
  contentHash: string;
  title?: string;
  subjectHit: boolean;
  excerpt?: string;
};

export type ResearchSourceLedger = {
  version: 1;
  entries: ResearchSourceEntry[];
};

export type ResearchSourceSummary = {
  acceptedCount: number;
  candidateCount: number;
  distinctSubjectHits: number;
  ledgerBytes: number;
};

export type AppendResearchSourceInput = {
  ledger: ResearchSourceLedger;
  kind: ResearchSourceKind;
  canonicalUrl: string;
  content: string;
  title?: string;
  subjectAnchor?: string;
  subjectAliases?: readonly string[];
  tenantScopeId?: string;
  principalScopeId?: string;
  sessionId?: string;
  goalVersion?: number;
  accepted?: boolean;
};

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(String(value ?? "").trim());
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return String(value ?? "").trim();
  }
}

function normalizeSubject(value: string): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .toLowerCase();
}

function subjectHit(
  text: string,
  subjectAnchor?: string,
  subjectAliases: readonly string[] = [],
): boolean {
  const haystack = normalizeSubject(text);
  if (!haystack) return false;
  const needles = [subjectAnchor, ...subjectAliases]
    .map((value) => normalizeSubject(String(value ?? "")))
    .filter(Boolean);
  return needles.some((needle) => haystack.includes(needle));
}

function ledgerBytes(ledger: ResearchSourceLedger): number {
  return Buffer.byteLength(JSON.stringify(ledger), "utf8");
}

export function buildResearchSourceId(input: {
  tenantScopeId?: string;
  principalScopeId?: string;
  sessionId?: string;
  goalVersion?: number;
  urlHash: string;
  contentHash: string;
  subjectAnchor?: string;
}): string {
  const digest = sha256([
    input.tenantScopeId ?? "local",
    input.principalScopeId ?? "local",
    input.sessionId ?? "session",
    String(input.goalVersion ?? 0),
    input.urlHash,
    input.contentHash,
    normalizeSubject(input.subjectAnchor ?? ""),
  ].join("|")).slice(0, 12);
  return `${RESEARCH_SOURCE_ID_PREFIX}_${digest}`;
}

export function createEmptyResearchSourceLedger(): ResearchSourceLedger {
  return { version: 1, entries: [] };
}

export function appendResearchSource(
  input: AppendResearchSourceInput,
): { ledger: ResearchSourceLedger; entry?: ResearchSourceEntry; accepted: boolean } {
  const canonicalUrl = normalizeUrl(input.canonicalUrl);
  const content = String(input.content ?? "").trim();
  const urlHash = sha256(canonicalUrl).slice(0, 16);
  const contentHash = sha256(content).slice(0, 16);
  const hasBody = content.length >= 48;
  const titleHit = subjectHit(
    input.title ?? "",
    input.subjectAnchor,
    input.subjectAliases,
  );
  const bodyHit = subjectHit(content, input.subjectAnchor, input.subjectAliases);
  const subjectMatched = titleHit || bodyHit;
  const accepted = Boolean(input.accepted) && hasBody && subjectMatched;

  const duplicate = input.ledger.entries.some((entry) =>
    entry.urlHash === urlHash && entry.contentHash === contentHash
  );
  if (duplicate) {
    return { ledger: input.ledger, accepted: false };
  }

  if (input.ledger.entries.length >= RESEARCH_SOURCE_LEDGER_MAX_ENTRIES) {
    return { ledger: input.ledger, accepted: false };
  }

  const entry: ResearchSourceEntry = {
    sourceId: buildResearchSourceId({
      tenantScopeId: input.tenantScopeId,
      principalScopeId: input.principalScopeId,
      sessionId: input.sessionId,
      goalVersion: input.goalVersion,
      urlHash,
      contentHash,
      subjectAnchor: input.subjectAnchor,
    }),
    kind: input.kind,
    status: accepted ? "accepted" : "candidate",
    canonicalUrl,
    urlHash,
    contentHash,
    ...(input.title ? { title: input.title.slice(0, 160) } : {}),
    subjectHit: subjectMatched,
    ...(content ? { excerpt: content.slice(0, 240) } : {}),
  };

  const nextLedger: ResearchSourceLedger = {
    version: 1,
    entries: [...input.ledger.entries, entry],
  };
  if (ledgerBytes(nextLedger) > RESEARCH_SOURCE_LEDGER_MAX_BYTES) {
    return { ledger: input.ledger, accepted: false };
  }
  return { ledger: nextLedger, entry, accepted };
}

export function summarizeResearchSources(
  ledger: ResearchSourceLedger,
): ResearchSourceSummary {
  const accepted = ledger.entries.filter((entry) => entry.status === "accepted");
  const candidates = ledger.entries.filter((entry) => entry.status === "candidate");
  return {
    acceptedCount: accepted.length,
    candidateCount: candidates.length,
    distinctSubjectHits: accepted.filter((entry) => entry.subjectHit).length,
    ledgerBytes: ledgerBytes(ledger),
  };
}

export function findResearchSourceById(
  ledger: ResearchSourceLedger,
  sourceId: string,
): ResearchSourceEntry | undefined {
  return ledger.entries.find((entry) => entry.sourceId === sourceId);
}

export async function readResearchSourceLedger(
  taskRoot: string,
): Promise<ResearchSourceLedger> {
  const ledgerPath = path.join(taskRoot, "research-source-ledger.json");
  try {
    const raw = await readFile(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as ResearchSourceLedger;
    if (parsed?.version === 1 && Array.isArray(parsed.entries)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return createEmptyResearchSourceLedger();
}

export type ChapterCitationFailure = {
  sectionId: string;
  sourceId: string;
  reason: "missing_source" | "candidate_only" | "subject_miss";
};

export function validateChapterSourceCitations(input: {
  ledger: ResearchSourceLedger;
  sectionCitations: ReadonlyArray<{ sectionId: string; sourceIds: readonly string[] }>;
  minDistinctAccepted?: number;
  minSubjectHits?: number;
}): ChapterCitationFailure[] {
  const failures: ChapterCitationFailure[] = [];
  const minDistinct = input.minDistinctAccepted ?? 3;
  const minSubjectHits = input.minSubjectHits ?? 2;
  const acceptedIds = new Set(
    input.ledger.entries
      .filter((entry) => entry.status === "accepted")
      .map((entry) => entry.sourceId),
  );
  const subjectHits = input.ledger.entries.filter(
    (entry) => entry.status === "accepted" && entry.subjectHit,
  ).length;

  if (acceptedIds.size < minDistinct) {
    failures.push({
      sectionId: "__ledger__",
      sourceId: "__aggregate__",
      reason: "missing_source",
    });
  }
  if (subjectHits < minSubjectHits) {
    failures.push({
      sectionId: "__ledger__",
      sourceId: "__subject__",
      reason: "subject_miss",
    });
  }

  for (const section of input.sectionCitations) {
    for (const sourceId of section.sourceIds) {
      const entry = findResearchSourceById(input.ledger, sourceId);
      if (!entry) {
        failures.push({
          sectionId: section.sectionId,
          sourceId,
          reason: "missing_source",
        });
        continue;
      }
      if (entry.status !== "accepted") {
        failures.push({
          sectionId: section.sectionId,
          sourceId,
          reason: "candidate_only",
        });
      }
    }
  }
  return failures;
}
