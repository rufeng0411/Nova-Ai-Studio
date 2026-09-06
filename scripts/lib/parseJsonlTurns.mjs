/**
 * PD-SAAS-FORK: Parse transcript JSONL into completed turns for audit/backfill.
 */
import fs from 'node:fs';
import { inferTurnArtifactDirectory, reconcileTurnDeliverablesLite } from './inferTurnArtifactDirectory.mjs';
import {
  isBareDeliverableFilename,
  isGenericClashProneBasename,
  isPhantomDeliverablePath,
  sanitizeDeliverableLookupPath,
} from '../../ui/shared/deliverablePathResolve.mjs';

const DELIVERABLE_TOOL_NAMES = new Set([
  'Write',
  'write_file',
  'Edit',
  'edit_file',
  'MultiEdit',
  'multi_edit',
  'create_file',
  'ApplyPatch',
  'apply_patch',
  'generate_image',
  'generate_video',
  'render_html_video',
  'compose_images_to_document',
  'ocr_to_editable_pptx',
  'export_document',
]);

const PATH_IN_TEXT = /(?:artifacts\/[^\s`"'<>]+|\b[\w.-]+\.(?:html|md|pdf|pptx|docx|png|jpe?g|webp|json|csv|xlsx))\b/gi;

function normalizePath(raw) {
  const p = sanitizeDeliverableLookupPath(String(raw || '')).replace(/\\/g, '/');
  if (!p || isPhantomDeliverablePath(p)) return '';
  return p;
}

function extractPathsFromText(text) {
  const paths = [];
  const seen = new Set();
  for (const match of String(text || '').matchAll(PATH_IN_TEXT)) {
    const p = normalizePath(match[0]);
    if (!p || seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
  }
  return paths;
}

function extractPathFromToolResult(content) {
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      const fromText = extractPathsFromText(block.text);
      if (fromText[0]) return fromText[0];
    }
  }
  return '';
}

function extractPathFromToolCall(content) {
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block?.type !== 'tool_call' && block?.type !== 'tool_use') continue;
    const input = block.input ?? block.arguments;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        const p = parsed?.file_path ?? parsed?.filePath ?? parsed?.output_path ?? parsed?.outputPath;
        if (typeof p === 'string') return normalizePath(p);
      } catch {
        // ignore
      }
    } else if (input && typeof input === 'object') {
      const p = input.file_path ?? input.filePath ?? input.output_path ?? input.outputPath;
      if (typeof p === 'string') return normalizePath(p);
    }
  }
  return '';
}

/**
 * @param {string} filePath
 * @returns {{ entries: object[], turns: object[], sessionId: string | null, lineCount: number }}
 */
export function parseJsonlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    try {
      entries.push(JSON.parse(lines[i]));
    } catch {
      // skip invalid lines
    }
  }

  const metaByTurnId = new Map();
  const acceptanceMetaByTurnId = new Map();
  const ledgerByTurnId = new Map();
  for (const entry of entries) {
    if (entry?.type === 'turn_deliverable_meta' && entry.turnId) {
      metaByTurnId.set(entry.turnId, entry);
    }
    if (entry?.type === 'turn_acceptance_meta' && entry.turnId) {
      acceptanceMetaByTurnId.set(entry.turnId, entry);
    }
    if (entry?.type === 'task_deliverable_ledger' && entry.turnId && entry.record) {
      const bucket = ledgerByTurnId.get(entry.turnId) ?? [];
      bucket.push(entry.record);
      ledgerByTurnId.set(entry.turnId, bucket);
    }
  }

  const completedTurnIds = new Set(
    entries.filter((e) => e?.type === 'turn_result').map((e) => e.turnId),
  );

  const turnsById = new Map();
  for (const entry of entries) {
    const turnId = entry?.turnId;
    if (!turnId) continue;

    if (!turnsById.has(turnId)) {
      turnsById.set(turnId, {
        turnId,
        sessionId: entry.sessionId ?? null,
        toolPaths: [],
        deliverableItems: [],
        assistantTexts: [],
        hasTurnResult: false,
        turnDeliverableMeta: metaByTurnId.get(turnId) ?? null,
        turnAcceptanceMeta: acceptanceMetaByTurnId.get(turnId) ?? null,
        taskDeliverableLedger: ledgerByTurnId.get(turnId) ?? [],
        lastSequence: entry.sequence ?? 0,
        lastCreatedAt: entry.createdAt ?? null,
      });
    }
    const turn = turnsById.get(turnId);
    turn.lastSequence = Math.max(turn.lastSequence, entry.sequence ?? 0);
    if (entry.createdAt) turn.lastCreatedAt = entry.createdAt;

    if (entry.type === 'turn_result') {
      turn.hasTurnResult = true;
    }

    if (entry.type === 'assistant_message' && entry.message) {
      const content = entry.message.content;
      const toolPath = extractPathFromToolCall(content);
      const textBlocks = Array.isArray(content)
        ? content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
        : '';
      if (textBlocks) turn.assistantTexts.push(textBlocks);

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type !== 'tool_call' && block?.type !== 'tool_use') continue;
          const name = block.name || block.tool_name;
          if (!DELIVERABLE_TOOL_NAMES.has(name)) continue;
          const p = extractPathFromToolCall([block]);
          if (p) {
            turn.toolPaths.push(p);
            turn.deliverableItems.push({ path: p, apiPath: p, source: 'tool', kind: 'file' });
          }
        }
      }
    }

    if (entry.type === 'tool_result_message' && entry.message) {
      const content = entry.message.content;
      const p = extractPathFromToolResult(content);
      if (p) {
        turn.toolPaths.push(p);
        turn.deliverableItems.push({ path: p, apiPath: p, source: 'tool', kind: 'file' });
      }
    }
  }

  for (const turn of turnsById.values()) {
    const assistantText = turn.assistantTexts.join('\n');
    for (const p of extractPathsFromText(assistantText)) {
      turn.deliverableItems.push({ path: p, apiPath: p, source: 'text', kind: 'file' });
    }
    turn.assistantText = assistantText;
    turn.finalDeliverables = reconcileTurnDeliverablesLite(turn.deliverableItems).map((item) => ({
      ...item,
      turnArtifactDir: turn.turnDeliverableMeta?.turnArtifactDir
        ?? inferTurnArtifactDirectory(turn.deliverableItems),
    }));
  }

  const turns = [...turnsById.values()].filter((t) => t.hasTurnResult && completedTurnIds.has(t.turnId));

  return {
    entries,
    turns,
    sessionId: entries.find((e) => e?.sessionId)?.sessionId ?? null,
    lineCount: lines.length,
    metaByTurnId,
    acceptanceMetaByTurnId,
    ledgerByTurnId,
  };
}

/**
 * @param {object} turn
 * @returns {'aligned' | 'bare_name_risk' | 'cross_deck_phantom' | 'missing_on_disk' | 'catalog_path_mismatch' | 'unrecoverable'}
 */
export function classifyTurnAlignmentLabel(turn, checks) {
  if (checks.unrecoverable) return 'unrecoverable';
  if (checks.catalogMismatch) return 'catalog_path_mismatch';
  if (checks.missingOnDisk) return 'missing_on_disk';
  if (checks.crossDeckPhantom) return 'cross_deck_phantom';
  if (checks.bareNameRisk) return 'bare_name_risk';
  if (checks.aligned) return 'aligned';
  return 'bare_name_risk';
}

export function isBareNameRiskTurn(turn) {
  const hasBareText = turn.deliverableItems.some(
    (item) => item.source === 'text' && isBareDeliverableFilename(item.apiPath || item.path),
  );
  const hasToolProof = turn.toolPaths.length > 0;
  return hasBareText && !turn.turnDeliverableMeta?.turnArtifactDir;
}

export function isUnrecoverableTurn(turn) {
  const hasTool = turn.toolPaths.length > 0;
  const bareItems = turn.deliverableItems.filter(
    (item) => isBareDeliverableFilename(item.apiPath || item.path)
      && isGenericClashProneBasename((item.apiPath || item.path).split('/').pop() ?? ''),
  );
  return !hasTool && bareItems.length > 0 && !turn.turnDeliverableMeta?.turnArtifactDir;
}
