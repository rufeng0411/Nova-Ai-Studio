// PD-SAAS-FORK: build N2 Bot ops rail from catalog + certificates + cron. No glob.

import type { N2OpsFile, N2OpsItem, N2OpsRailSection, N2OpsStatus } from "./n2BotTypes.js";
import { isN2BotSession } from "./n2BotFlags.js";

export type N2OpsCatalogRow = {
  sessionId: string;
  userId: number;
  title?: string | null;
  summary?: string | null;
  firstPrompt?: string | null;
  kind?: string | null;
  executionStatus?: string | null;
  deletedAt?: string | null;
  greetingIdle?: boolean;
  isBackgroundTask?: boolean;
  legacyProjectId?: string | null;
  workspaceUuid?: string | null;
  lastActivityAt?: string | null;
  isGeneral?: boolean;
  projectLabel?: string | null;
};

export type N2OpsCertificate = {
  sessionId: string;
  complete?: boolean;
  acceptance?: string;
  userActionRequired?: boolean;
  issue?: "quota" | "send" | "preview" | "";
  slotBindings?: Array<{ path?: string; kind?: string; label?: string; slotName?: string }>;
  done?: number;
  total?: number;
  step?: string;
};

export type N2OpsCron = {
  taskId: string;
  sessionKey: string;
  message: string;
  nextRunAt?: string;
};

export type BuildN2OpsFeedInput = {
  viewerUserId: number;
  stewardSessionId?: string | null;
  rows: N2OpsCatalogRow[];
  certificates?: N2OpsCertificate[];
  crons?: N2OpsCron[];
};

export function activityMs(item: Pick<N2OpsItem, "lastActivityAt">): number {
  const raw = item.lastActivityAt;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function compareN2OpsItems(a: N2OpsItem, b: N2OpsItem): number {
  const runA = a.status === "run" ? 0 : 1;
  const runB = b.status === "run" ? 0 : 1;
  if (runA !== runB) return runA - runB;
  return activityMs(b) - activityMs(a);
}

export function sortN2OpsItems(items: N2OpsItem[]): N2OpsItem[] {
  return [...items].sort(compareN2OpsItems);
}

function displayTitle(row: N2OpsCatalogRow): string {
  return String(row.title || row.summary || row.firstPrompt || "任务").trim();
}

function filesFromCertificate(cert?: N2OpsCertificate): N2OpsFile[] {
  if (!cert?.slotBindings?.length) return [];
  return cert.slotBindings
    .filter((slot) => typeof slot.path === "string" && slot.path.trim())
    .map((slot) => ({
      path: String(slot.path),
      kind: String(slot.kind || "").toLowerCase() || inferKind(String(slot.path)),
      label: String(slot.label || slot.slotName || basename(String(slot.path))),
    }));
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() || path;
}

function inferKind(path: string): string {
  const ext = basename(path).split(".").pop()?.toLowerCase() || "file";
  return ext;
}

function mapStatus(row: N2OpsCatalogRow, cert?: N2OpsCertificate): N2OpsStatus {
  if (cert?.userActionRequired || cert?.issue === "quota" || cert?.issue === "send") return "need";
  if (cert?.complete === true || cert?.acceptance === "passed") return "done";
  const ex = row.executionStatus ?? "idle";
  if (ex === "running") return "run";
  if (ex === "queued") return "queue";
  if (ex === "paused") return "need";
  if (ex === "idle" && cert?.complete) return "done";
  return "done";
}

export function isGreetingIdleRow(row: N2OpsCatalogRow): boolean {
  if (row.greetingIdle === true) return true;
  const text = `${row.firstPrompt || ""} ${row.summary || ""}`.trim();
  return /^(?:你好|您好|嗨|哈喽|hello|hi|hey)[!！?？.。\s啊呀呢吧]*$/i.test(text)
    && (row.executionStatus === "idle" || !row.executionStatus);
}

export function buildN2OpsFeed(input: BuildN2OpsFeedInput): N2OpsItem[] {
  const certBySession = new Map(
    (input.certificates ?? []).map((c) => [c.sessionId, c]),
  );
  const items: N2OpsItem[] = [];

  for (const row of input.rows) {
    if (row.deletedAt) continue;
    if (row.userId !== input.viewerUserId) continue;
    if (isN2BotSession(row.kind)) continue;
    if (row.sessionId === input.stewardSessionId) continue;
    if (row.isBackgroundTask) continue;
    if (isGreetingIdleRow(row)) continue;
    const cert = certBySession.get(row.sessionId);
    const status = mapStatus(row, cert);
    if (status === "done" && !cert && (row.executionStatus === "idle" || !row.executionStatus)) {
      if (!row.firstPrompt && !row.title) continue;
    }
    const files = filesFromCertificate(cert);
    const outcomeCount = files.length > 0
      ? files.length
      : (typeof cert?.done === "number" && cert.done > 0 ? cert.done : 0);
    const isGeneral = row.isGeneral !== false && (
      row.isGeneral === true
      || !row.legacyProjectId
      || row.legacyProjectId === "general"
    );
    items.push({
      workerSessionId: row.sessionId,
      title: displayTitle(row),
      status,
      step: cert?.step || (status === "run" ? "进行中" : status === "queue" ? "排队中" : status === "need" ? "需要你" : "已完成"),
      done: cert?.done,
      total: cert?.total,
      issue: cert?.issue || "",
      files,
      ownerUserId: row.userId,
      sessionKind: row.kind,
      projectKey: isGeneral ? "general" : (row.legacyProjectId || "project"),
      projectLabel: row.projectLabel || (isGeneral ? "通用" : row.legacyProjectId || "项目"),
      isGeneral,
      lastActivityAt: row.lastActivityAt || undefined,
      outcomeCount,
      hasOutcomes: outcomeCount > 0,
    });
  }

  for (const cron of input.crons ?? []) {
    if (cron.sessionKey === input.stewardSessionId) continue;
    if (isN2BotSession(cron.sessionKey)) continue;
    items.push({
      workerSessionId: cron.sessionKey,
      title: cron.message || "计划任务",
      status: "plan",
      step: cron.nextRunAt ? `计划 ${cron.nextRunAt}` : "已订点",
      wait: cron.nextRunAt,
      files: [],
      isGeneral: true,
      projectKey: "general",
      projectLabel: "通用",
      lastActivityAt: cron.nextRunAt,
      outcomeCount: 0,
      hasOutcomes: false,
    });
  }

  return sortN2OpsItems(items);
}

export function buildN2OpsRailSections(items: N2OpsItem[]): N2OpsRailSection[] {
  const sorted = sortN2OpsItems(items);
  const live = sorted.filter((item) => item.status === "run");
  const rest = sorted.filter((item) => item.status !== "run");
  const general: N2OpsItem[] = [];
  const projects = new Map<string, { label: string; items: N2OpsItem[] }>();

  for (const item of rest) {
    if (item.isGeneral !== false && (item.isGeneral === true || !item.projectKey || item.projectKey === "general")) {
      general.push(item);
      continue;
    }
    const key = item.projectKey || "project";
    const existing = projects.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      projects.set(key, {
        label: item.projectLabel || key,
        items: [item],
      });
    }
  }

  const sections: N2OpsRailSection[] = [];
  if (live.length > 0) {
    sections.push({ kind: "live", id: "live", label: "进行中", items: live });
  }
  if (general.length > 0) {
    sections.push({ kind: "general", id: "general", label: "通用", items: general });
  }

  const projectSections: Array<N2OpsRailSection & { recency: number }> = [...projects.entries()].map(
    ([key, group]) => ({
      kind: "project" as const,
      id: `project:${key}`,
      label: group.label,
      items: group.items,
      recency: activityMs(group.items[0] ?? {}),
    }),
  );
  projectSections.sort((a, b) => b.recency - a.recency);
  for (const section of projectSections) {
    sections.push({
      kind: section.kind,
      id: section.id,
      label: section.label,
      items: section.items,
    });
  }
  return sections;
}

export function groupN2OpsItems(items: N2OpsItem[]): Record<N2OpsStatus, N2OpsItem[]> {
  const grouped: Record<N2OpsStatus, N2OpsItem[]> = {
    need: [],
    run: [],
    queue: [],
    plan: [],
    done: [],
  };
  for (const item of items) grouped[item.status].push(item);
  return grouped;
}

export type PausePlan = {
  pauseIds: string[];
  skippedOtherUser: string[];
  skippedSteward: string[];
};

export function planStopAll(input: {
  viewerUserId: number;
  stewardSessionId?: string | null;
  rows: N2OpsCatalogRow[];
}): PausePlan {
  const pauseIds: string[] = [];
  const skippedOtherUser: string[] = [];
  const skippedSteward: string[] = [];
  for (const row of input.rows) {
    if (row.deletedAt) continue;
    if (isN2BotSession(row.kind) || row.sessionId === input.stewardSessionId) {
      skippedSteward.push(row.sessionId);
      continue;
    }
    if (row.userId !== input.viewerUserId) {
      skippedOtherUser.push(row.sessionId);
      continue;
    }
    if (row.executionStatus === "running" || row.executionStatus === "queued") {
      pauseIds.push(row.sessionId);
    }
  }
  return { pauseIds, skippedOtherUser, skippedSteward };
}

export function filesFromSlotBindingsOnly(
  bindings: N2OpsCertificate["slotBindings"],
): N2OpsFile[] {
  return filesFromCertificate({ sessionId: "", slotBindings: bindings });
}
