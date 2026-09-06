/**
 * PD-SAAS-FORK: Parse Nova session HTML export for four-line alignment KPIs.
 * Reads manifest JSON, snapshot banner, deliverable table, folder table only.
 * Strips PII / absolute DATA_ROOT / user IDs / URLs from sanitized body snippets.
 */
import fs from 'node:fs';

const LITERAL_PLACEHOLDER_PATTERNS = [
  /slide-NN(?:\.|[\s"'`]|$)/i,
  /slide-\[N\]/i,
  /\*\*?\.(?:png|md|html)/i,
  /\[N\]\.(?:png|md|html)/i,
  /\bNN\.(?:png|md|html)\b/i,
  /page-NN/i,
  /slide-\{/i,
];

const PII_STRIP_PATTERNS = [
  /\bweb[-:][a-z0-9_-]{8,}\b/gi,
  /\btenant[-:][a-z0-9_-]+\b/gi,
  /\buser[-:][a-z0-9_-]+\b/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /(?:https?:\/\/|wss?:\/\/)[^\s<>"']+/gi,
  /\/(?:var|opt|data|Users|home|cloud-storage)\/[^\s<>"']+/gi,
  /DATA_ROOT[^\s<>"']*/gi,
  /\/tenants\/[^\s<>"']+/gi,
];

export { LITERAL_PLACEHOLDER_PATTERNS };

function decodeHtmlEntities(text) {
  return String(text ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlTags(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSection(html, testId) {
  const re = new RegExp(
    `<section[^>]*data-testid="${testId}"[^>]*>([\\s\\S]*?)<\\/section>`,
    'i',
  );
  const match = html.match(re);
  return match?.[1] ?? '';
}

function parseTableRows(sectionHtml) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRe.exec(sectionHtml)) !== null) {
    const cells = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(match[1])) !== null) {
      cells.push(stripHtmlTags(decodeHtmlEntities(cellMatch[1])));
    }
    if (cells.length > 0 && !cells.every((c) => /^[#成果名称文件类型状态链接\d\s—-]+$/.test(c))) {
      rows.push(cells);
    }
  }
  return rows.filter((row) => row.some((cell) => cell && cell !== '—'));
}

function parseDeliverableTable(html) {
  const section = extractSection(html, 'deliverable-summary-table');
  if (!section) return { contractHash: null, rows: [] };
  const hashMatch = section.match(/data-contract-hash="([^"]*)"/i);
  const contractHash = hashMatch?.[1] ? decodeHtmlEntities(hashMatch[1]) : null;
  const rawRows = parseTableRows(section);
  const rows = rawRows
    .filter((cells) => cells.length >= 3 && !/^成果名称$/i.test(cells[0]))
    .map((cells) => ({
      label: cells[0] ?? '',
      typeLabel: cells[1] ?? '',
      statusLabel: cells[2] ?? '',
      pathText: cells[3] ?? '',
    }));
  return { contractHash, rows };
}

function parseFolderTable(html) {
  const section = extractSection(html, 'folder-content-table');
  if (!section) return { rows: [], note: '' };
  const noteMatch = section.match(/class="section-note"[^>]*>([\s\S]*?)<\/p>/i);
  const note = noteMatch ? stripHtmlTags(decodeHtmlEntities(noteMatch[1])) : '';
  const rawRows = parseTableRows(section);
  const rows = rawRows
    .filter((cells) => cells.length >= 2 && !/^#$/.test(cells[0]))
    .map((cells) => ({
      index: cells[0] ?? '',
      path: cells[1] ?? '',
      basename: cells[2] ?? '',
      source: cells[3] ?? '',
      inContract: cells[4] ?? '',
      slotId: cells[5] ?? '',
      isProcessFile: cells[6] ?? '',
    }));
  return { rows, note };
}

function parseSnapshotBanner(html) {
  const bannerMatch = html.match(/class="export-snapshot-banner"[^>]*>([\s\S]*?)<\/p>/i);
  const text = bannerMatch ? stripHtmlTags(decodeHtmlEntities(bannerMatch[1])) : '';
  const isTerminal = /终态快照/.test(text);
  const isInProgress = /进行中快照/.test(text);
  return { text, isTerminal, isInProgress };
}

function extractManifestJson(html) {
  const preMatch = html.match(/<pre id="nova-session-export-index">([\s\S]*?)<\/pre>/i);
  if (!preMatch) return null;
  try {
    return JSON.parse(decodeHtmlEntities(preMatch[1].trim()));
  } catch {
    return null;
  }
}

function latestTurnSnapshot(manifest) {
  const snaps = manifest?.turnDeliverableSnapshots;
  if (!Array.isArray(snaps) || snaps.length === 0) return null;
  return snaps[snaps.length - 1] ?? null;
}

function normalizePathKey(path) {
  return String(path ?? '').replace(/\\/g, '/').trim().toLowerCase();
}

export function isLiteralPlaceholderPath(path) {
  const p = String(path ?? '').trim();
  if (!p) return false;
  return LITERAL_PLACEHOLDER_PATTERNS.some((re) => re.test(p));
}

export function stripExportHtmlPii(text) {
  let out = String(text ?? '');
  for (const re of PII_STRIP_PATTERNS) {
    out = out.replace(re, '[redacted]');
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function detectSlotCollision(input) {
  const slotToPath = new Map();
  const pathToOwners = new Map();
  let collisions = 0;

  const bindings = input?.slotBindings ?? input?.slot_bindings ?? [];
  for (const binding of bindings) {
    const slotId = binding?.slotId ?? binding?.id;
    const unitId = binding?.unitId;
    const path = binding?.resolvedPath ?? binding?.evidencePath ?? binding?.path;
    if (!slotId || !path) continue;
    const pathKey = normalizePathKey(path);
    if (!unitId && slotToPath.has(slotId) && slotToPath.get(slotId) !== pathKey) {
      collisions += 1;
    }
    if (!unitId) slotToPath.set(slotId, pathKey);
    const owner = unitId ?? slotId;
    const owners = pathToOwners.get(pathKey) ?? new Set();
    if (!owners.has(owner) && owners.size > 0) collisions += 1;
    owners.add(owner);
    pathToOwners.set(pathKey, owners);
  }

  const folderFiles = input?.folderFiles ?? input?.folder_files ?? [];
  const folderSlotToPath = new Map();
  for (const file of folderFiles) {
    const slotId = file?.slotId;
    const unitId = file?.unitId;
    const path = file?.path;
    if (!slotId || !path) continue;
    const pathKey = normalizePathKey(path);
    if (!unitId && folderSlotToPath.has(slotId) && folderSlotToPath.get(slotId) !== pathKey) {
      collisions += 1;
    }
    if (!unitId) folderSlotToPath.set(slotId, pathKey);
    const owner = unitId ?? slotId;
    const owners = pathToOwners.get(pathKey) ?? new Set();
    if (!owners.has(owner) && owners.size > 0) collisions += 1;
    owners.add(owner);
    pathToOwners.set(pathKey, owners);
  }

  return collisions;
}

export function detectHashMismatch(input) {
  const tableHash = input?.deliverableTable?.contractHash ?? input?.tableContractHash ?? null;
  const debugHash = input?.fourLineDebug?.contractHash ?? input?.contractHash ?? null;
  const certHash = input?.certificate?.contractHash ?? input?.acceptanceCertificate?.contractHash ?? null;
  const candidates = [tableHash, debugHash, certHash].filter((h) => h && h !== '0' && h !== '—');
  if (candidates.length <= 1) return 0;
  const unique = new Set(candidates.map((h) => String(h).toLowerCase()));
  return unique.size > 1 ? 1 : 0;
}

export function detectLiteralPlaceholderPaths(paths) {
  const list = Array.isArray(paths) ? paths : [];
  let count = 0;
  for (const path of list) {
    if (isLiteralPlaceholderPath(path)) count += 1;
  }
  return count;
}

export function detectSnapshotTruncated(input) {
  const note = String(input?.folderTable?.note ?? input?.folderNote ?? '');
  const folderRows = (Array.isArray(input?.folderFiles) && input.folderFiles.length > 0)
    ? input.folderFiles
    : (input?.folderTable?.rows ?? []);
  const manifest = input?.manifest ?? null;
  const fourLine = manifest?.fourLineDebug ?? input?.fourLineDebug ?? {};

  if (/truncated|截断|上限|node_modules|暂无索引/i.test(note)) return 1;
  if (fourLine?.snapshotTruncated === true) return 1;
  if (fourLine?.snapshotComplete === false) return 1;

  const hasNodeModules = folderRows.some((row) => /node_modules/i.test(String(row?.path ?? row?.[1] ?? '')));
  const contractFiles = folderRows.filter((row) => {
    const inContract = row?.inContract ?? row?.[4] ?? '';
    return inContract === '是' || inContract === true;
  });
  if (hasNodeModules && contractFiles.length > 0 && contractFiles.length <= 3) return 1;
  if (hasNodeModules && folderRows.length > 0 && contractFiles.length === 0) return 1;

  return 0;
}

export function detectNonterminalExportAsFinal(input) {
  const banner = input?.snapshotBanner ?? {};
  const cert = input?.certificate ?? input?.acceptanceCertificate ?? null;
  const envelope = input?.snapshotEnvelope ?? null;

  const completionState = cert?.completionState ?? envelope?.completionState ?? null;
  const acceptanceStatus = cert?.acceptanceStatus ?? input?.acceptanceStatus ?? null;
  const isTerminal = banner?.isTerminal === true
    || envelope?.isTerminalSnapshot === true;
  const isInProgress = banner?.isInProgress === true
    || envelope?.isTerminalSnapshot === false;

  if (isInProgress && (completionState === 'complete' || acceptanceStatus === 'passed')) {
    return 1;
  }
  if (!isTerminal && completionState === 'complete') {
    return 1;
  }
  if (banner?.text && /进行中快照/.test(banner.text) && /全部完成|已完成/.test(String(input?.deliverableSummaryText ?? ''))) {
    return 1;
  }
  return 0;
}

export function computeFourLineExportKpis(parsed) {
  const paths = [
    ...(parsed?.deliverables ?? []).map((d) => d.resolvedPath ?? d.path).filter(Boolean),
    ...(parsed?.folderFiles ?? []).map((f) => f.path).filter(Boolean),
    ...(parsed?.certificate?.slots ?? []).map((s) => s.resolvedPath).filter(Boolean),
    ...(parsed?.slotBindings ?? []).map((s) => s.resolvedPath ?? s.path).filter(Boolean),
  ];

  const kpis = {
    slot_collision: detectSlotCollision(parsed),
    hash_mismatch: detectHashMismatch(parsed),
    literal_placeholder_path: detectLiteralPlaceholderPaths(paths),
    snapshot_truncated: detectSnapshotTruncated(parsed),
    nonterminal_export_as_final: detectNonterminalExportAsFinal(parsed),
    snapshot_inconclusive: 0,
  };

  if (kpis.snapshot_truncated > 0) {
    kpis.snapshot_inconclusive = 1;
  }

  return kpis;
}

export function parseExportHtmlFourLine(html) {
  const manifest = extractManifestJson(html);
  const snapshotBanner = parseSnapshotBanner(html);
  const deliverableTable = parseDeliverableTable(html);
  const folderTable = parseFolderTable(html);
  const fourLineDebug = manifest?.fourLineDebug ?? null;
  const deliverables = Array.isArray(manifest?.deliverables) ? manifest.deliverables : [];
  const folderFiles = Array.isArray(manifest?.folderFiles) ? manifest.folderFiles : [];
  const turnSnap = latestTurnSnapshot(manifest);
  const certificate = turnSnap?.acceptanceCertificate
    ?? turnSnap?.acceptanceMeta?.acceptanceCertificate
    ?? null;
  const slotBindings = turnSnap?.slotBindings
    ?? turnSnap?.acceptanceMeta?.slotBindings
    ?? certificate?.slots?.map((slot) => ({
      slotId: slot.slotId,
      resolvedPath: slot.resolvedPath,
      status: slot.status,
    }))
    ?? [];

  const contractHash = deliverableTable.contractHash
    ?? fourLineDebug?.contractHash
    ?? certificate?.contractHash
    ?? null;

  const snapshotEnvelope = manifest?.snapshotEnvelope ?? null;
  const snapshotCompleteness = {
    hasManifest: Boolean(manifest),
    hasDeliverableTable: deliverableTable.rows.length > 0,
    hasFolderTable: folderTable.rows.length > 0 || Boolean(folderTable.note),
    hasCertificate: Boolean(certificate),
    hasContractHash: Boolean(contractHash && contractHash !== '0'),
    hasSnapshotBanner: Boolean(snapshotBanner.text),
    deliverableRowCount: deliverableTable.rows.length,
    folderRowCount: folderTable.rows.length,
    slotBindingCount: slotBindings.length,
  };

  const parsed = {
    sessionId: manifest?.sessionId ?? null,
    contractHash,
    certificate,
    slotBindings,
    deliverables,
    folderFiles,
    deliverableTable,
    folderTable,
    snapshotBanner,
    snapshotEnvelope,
    fourLineDebug,
    manifest,
    snapshotCompleteness,
    deliverableSummaryText: deliverableTable.rows.map((r) => r.statusLabel).join(' '),
  };

  parsed.kpis = computeFourLineExportKpis(parsed);
  parsed.sanitizedBodySnippet = stripExportHtmlPii(
    html.slice(0, Math.min(html.length, 4000)),
  );

  return parsed;
}

export function parseExportHtmlFourLineFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  return parseExportHtmlFourLine(html);
}

/** Turn-level KPI helpers for audit-four-line-alignment.mjs */
export function detectTurnKpis(turn, checks = {}) {
  const meta = turn?.turnAcceptanceMeta ?? {};
  const cert = meta?.acceptanceCertificate ?? null;
  const paths = [
    ...(turn?.verifiedPaths ?? []),
    ...(turn?.panelPaths ?? []),
    ...(cert?.slots ?? []).map((s) => s.resolvedPath).filter(Boolean),
  ];
  const strictBindings = Array.isArray(cert?.strictBinding?.bindings)
    ? cert.strictBinding.bindings
    : null;
  const certificateSlots = new Map(
    (cert?.slots ?? []).map((slot) => [slot.slotId, slot]),
  );
  const occurrenceBySlot = new Map();
  const unitBindings = (cert?.units ?? []).map((unit) => {
    const occurrence = occurrenceBySlot.get(unit.slotId) ?? 0;
    occurrenceBySlot.set(unit.slotId, occurrence + 1);
    const slot = certificateSlots.get(unit.slotId);
    return {
      unitId: unit.unitId,
      slotId: unit.slotId,
      resolvedPath: slot?.resolvedPaths?.[occurrence]
        ?? (occurrence === 0 ? slot?.resolvedPath : undefined),
    };
  });
  const slotBindings = strictBindings
    ?? (unitBindings.length > 0
      ? unitBindings
      : cert?.slots?.map((slot) => ({
        slotId: slot.slotId,
        resolvedPath: slot.resolvedPath,
      })))
    ?? meta?.slotBindings
    ?? [];

  const kpis = {
    slot_collision: detectSlotCollision({ slotBindings, folderFiles: [] }),
    hash_mismatch: detectHashMismatch({
      tableContractHash: meta?.contractSnapshot?.rowsHash,
      acceptanceCertificate: cert,
      fourLineDebug: {
        contractHash: meta?.contractSnapshot?.rowsHash ?? meta?.contractHash,
      },
    }),
    literal_placeholder_path: detectLiteralPlaceholderPaths(paths),
    snapshot_truncated: meta?.contractSnapshot?.snapshotTruncated === true ? 1 : 0,
    nonterminal_export_as_final: 0,
  };

  if (cert?.completionState === 'complete' && cert?.requiredDone < cert?.requiredTotal) {
    kpis.nonterminal_export_as_final = 1;
  }
  if (checks?.certFalseComplete) {
    kpis.nonterminal_export_as_final = Math.max(kpis.nonterminal_export_as_final, 1);
  }

  return kpis;
}
