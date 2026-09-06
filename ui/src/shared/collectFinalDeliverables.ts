// PD-SAAS-FORK: split turn artifacts into final deliverables vs process-only files
import type { ChatMessage } from '../components/chat/types/types';
import type { ProcessAttachment } from '../components/chat-v2/processGrouping';
import {
  collectDeliverablesFromAssistantText,
  collectDeliverablesFromMessages,
  collectTurnAllArtifacts,
  type CollectTurnDeliverablesOptions,
  type DeliverableItem,
} from './collectDeliverables';
import { reconcileTurnDeliverables, inferTurnArtifactDirectory, inferTurnDirFromExplicitPaths } from './reconcileTurnDeliverables';
import { pickPrimaryDeliverableFile } from './pickPrimaryDeliverable';
import {
  extractDeliverablePathsFromText,
  getArtifactDirectory,
  getArtifactFileName,
  normalizeArtifactPath,
} from './artifactPaths';
import {
  isBareDeliverableFilename,
  sanitizeDeliverableLookupPath,
} from '../../shared/deliverablePathResolve.mjs';
import { buildDeliverableLinkContract } from '../../shared/deliverableLinkContract.mjs';
import {
  applyPresentationDeliverablePolicy,
  selectAuthoritativePptxDeliverables,
  shouldSuppressGenericPptxPromotion,
} from './presentationDeliverablePolicy';
import { filterDeliverablesForDisplayPanel } from './deliverableDisplayPolicy';
import { isNonUserDeliverablePath, isPhantomDeliverablePath, isOrphanIntermediateHtmlPath } from './nonDeliverablePaths';
import { isBrandGeoFullCaseGoal, isGeoCampaignArtifactDir } from './geoCampaignGoals';
import { resolveFrozenSessionManifest } from './resolveSessionDeliverableManifest';

function frozenHtmlSlotBasenames(options: CollectTurnDeliverablesOptions): string[] {
  const messages = options.sessionToolMessages ?? options.toolMessages ?? [];
  const manifest = resolveFrozenSessionManifest(messages);
  if (!manifest?.slots?.length) return [];
  const basenames: string[] = [];
  for (const slot of manifest.slots) {
    for (const hint of [slot.pathHint, ...(slot.pathHints ?? [])]) {
      if (hint && /\.html?$/i.test(String(hint))) {
        basenames.push(getArtifactFileName(String(hint)).toLowerCase());
      }
    }
  }
  return basenames;
}

function filterOrphanIntermediateHtmlFromFinal(
  items: DeliverableItem[],
  options: CollectTurnDeliverablesOptions,
): DeliverableItem[] {
  const htmlHints = frozenHtmlSlotBasenames(options);
  if (htmlHints.length === 0) return items;
  return items.filter((item) => {
    if (item.kind === 'url') return true;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    if (!path) return true;
    return !isOrphanIntermediateHtmlPath(path, htmlHints);
  });
}

function hasFrozenSessionManifest(options: CollectTurnDeliverablesOptions): boolean {
  const messages = options.sessionToolMessages ?? options.toolMessages ?? [];
  return Boolean(resolveFrozenSessionManifest(messages));
}

function isDeliverableAnchorPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path);
  if (!normalized || isNonUserDeliverablePath(normalized) || isPhantomDeliverablePath(normalized) || isDraftPath(normalized)) {
    return false;
  }
  const top = normalized.split('/')[0]?.toLowerCase() ?? '';
  if (['scripts', 'script', 'skills', 'src', 'lib', 'node_modules', 'config', 'tests', 'test'].includes(top)) {
    return false;
  }
  return true;
}

function augmentAnchorPathsWithAuthoritativePptx(
  anchorPaths: string[],
  allItems: DeliverableItem[],
): string[] {
  const authoritative = selectAuthoritativePptxDeliverables(allItems);
  if (authoritative.length === 0) return anchorPaths;
  if (shouldSuppressGenericPptxPromotion(anchorPaths, authoritative)) {
    return anchorPaths;
  }
  const pptxPaths = authoritative
    .map((item) => normalizeArtifactPath(item.apiPath || item.path))
    .filter(Boolean);
  return [...new Set([...anchorPaths, ...pptxPaths])];
}

function mergeDeliverables(existing: DeliverableItem[], incoming: DeliverableItem[]): DeliverableItem[] {
  const map = new Map<string, DeliverableItem>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    const current = map.get(item.id);
    if (!current || (current.source !== 'tool' && item.source === 'tool')) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

const DRAFT_PREFIXES = [
  'drafts/',
  'temp/',
  'tmp/',
  'scratch/',
  '.pilotdeck/process/',
];

const DRAFT_SEGMENT_MARKERS = [
  '/drafts/',
  '/temp/',
  '/tmp/',
  '/scratch/',
  '/.pilotdeck/process/',
];

function isDraftPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path).toLowerCase();
  if (!normalized) return false;
  if (DRAFT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return DRAFT_SEGMENT_MARKERS.some((marker) => normalized.includes(marker));
}

function isDraftDeliverable(item: DeliverableItem): boolean {
  if (item.kind === 'url') return false;
  const path = normalizeArtifactPath(item.apiPath || item.path);
  const altPath = normalizeArtifactPath(item.path);
  return isDraftPath(path) || (altPath !== path && isDraftPath(altPath));
}

function pathsMatchAnchor(item: DeliverableItem, anchorPath: string, turnDir: string | null): boolean {
  const itemPath = normalizeArtifactPath(item.apiPath || item.path);
  const anchor = normalizeArtifactPath(anchorPath);
  if (!itemPath || !anchor) return false;
  if (itemPath === anchor) return true;
  if (itemPath.endsWith(`/${anchor}`) || anchor.endsWith(`/${itemPath}`)) return true;
  const itemBase = getArtifactFileName(itemPath).toLowerCase();
  const anchorBase = getArtifactFileName(anchor).toLowerCase();
  if (itemBase !== anchorBase) return false;
  if (!turnDir) return true;
  const itemDir = getArtifactDirectory(itemPath);
  return itemDir === turnDir || itemDir.endsWith(turnDir) || turnDir.endsWith(itemDir);
}

function findLastExecutionSegmentTools(toolMessages: ChatMessage[]): ChatMessage[] {
  if (toolMessages.length === 0) return [];

  let lastNonToolAssistant = -1;
  for (let i = toolMessages.length - 1; i >= 0; i -= 1) {
    const message = toolMessages[i];
    if (!message.isToolUse && message.type === 'assistant' && !message.isThinking) {
      lastNonToolAssistant = i;
      break;
    }
  }

  const segmentStart = lastNonToolAssistant >= 0 ? lastNonToolAssistant + 1 : 0;
  return toolMessages.slice(segmentStart).filter((message) => message.isToolUse);
}

function isWeakDeliverableAnchorPath(path: string): boolean {
  const normalized = normalizeArtifactPath(path);
  if (!normalized) return true;
  const base = getArtifactFileName(normalized);
  if (isBareDeliverableFilename(normalized)) return true;
  return /^\d+\.html?$/i.test(base);
}

function normalizeVerifiedAnchorPaths(paths: string[] | undefined): string[] {
  return [...new Set(
    (paths ?? [])
      .map((path) => normalizeArtifactPath(path))
      .filter((path): path is string => Boolean(path) && isDeliverableAnchorPath(path)),
  )];
}

function anchorPathsFromOptions(options: CollectTurnDeliverablesOptions): string[] {
  const { assistantText = '', toolMessages = [], projectRoot } = options;
  const verified = normalizeVerifiedAnchorPaths(options.verifiedPathsOverride);
  const fromText = collectDeliverablesFromAssistantText(assistantText, projectRoot)
    .filter((item) => item.kind !== 'url')
    .map((item) => normalizeArtifactPath(item.apiPath || item.path))
    .filter((path): path is string => Boolean(path) && isDeliverableAnchorPath(path));

  if (verified.length > 0) {
    const bodyIsWeak = fromText.length === 0 || fromText.every((path) => isWeakDeliverableAnchorPath(path));
    if (bodyIsWeak || verified.length >= fromText.length) {
      return verified;
    }
    return [...new Set([...verified, ...fromText])];
  }

  if (fromText.length > 0) {
    return [...new Set(fromText)];
  }

  const segmentTools = findLastExecutionSegmentTools(toolMessages);
  const fromTools = collectDeliverablesFromMessages(segmentTools, projectRoot)
    .map((item) => normalizeArtifactPath(item.apiPath || item.path))
    .filter((path): path is string => Boolean(path) && isDeliverableAnchorPath(path));

  return [...new Set(fromTools)];
}

function rawToolWritePaths(toolMessages: ChatMessage[]): string[] {
  const segmentTools = findLastExecutionSegmentTools(toolMessages);
  const paths: string[] = [];
  for (const message of segmentTools) {
    let raw = '';
    const input = message.toolInput;
    if (typeof input === 'string' && input.trim()) {
      try {
        const parsed = JSON.parse(input) as Record<string, unknown>;
        const fromInput = parsed.file_path ?? parsed.filePath ?? parsed.output_path ?? parsed.outputPath;
        if (typeof fromInput === 'string' && fromInput.trim()) {
          raw = fromInput;
        }
      } catch {
        raw = '';
      }
    } else if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      const fromInput = record.file_path ?? record.filePath ?? record.output_path ?? record.outputPath;
      if (typeof fromInput === 'string' && fromInput.trim()) {
        raw = fromInput;
      }
    }
    if (!raw) {
      const record = message.toolResult && typeof message.toolResult === 'object'
        ? (message.toolResult as Record<string, unknown>)
        : null;
      const written = record?.writtenFilePath;
      if (typeof written === 'string' && written.trim()) {
        raw = written;
      }
    }
    if (!raw) continue;
    const normalized = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
    if (normalized && !isDraftPath(normalized)) {
      paths.push(normalized);
    }
  }
  return [...new Set(paths)];
}

function rawPathsFromBackticks(text: string): string[] {
  const paths: string[] = [];
  const re = /`([^`]+)`/g;
  let match = re.exec(String(text || ''));
  while (match) {
    const normalized = sanitizeDeliverableLookupPath(match[1]).replace(/\\/g, '/');
    if (normalized.includes('/') && !isDraftPath(normalized)) {
      paths.push(normalized);
    }
    match = re.exec(String(text || ''));
  }
  return paths;
}

function explicitTurnDirPaths(options: CollectTurnDeliverablesOptions): string[] {
  return [...new Set([
    ...rawPathsFromBackticks(options.assistantText ?? ''),
    ...rawToolWritePaths(options.toolMessages ?? []),
  ])];
}

function filterDraftsUnlessAnchored(
  items: DeliverableItem[],
  anchorPaths: string[],
): DeliverableItem[] {
  if (anchorPaths.length === 0) {
    return items.filter((item) => item.kind === 'url' || !isDraftDeliverable(item));
  }

  const turnDir = inferTurnArtifactDirectory(
    items.filter((item) => anchorPaths.some((anchor) => pathsMatchAnchor(item, anchor, null))),
  );

  return items.filter((item) => {
    if (item.kind === 'url') return true;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    if (!isDraftDeliverable(item)) return true;
    return anchorPaths.some((anchor) => pathsMatchAnchor(item, anchor, turnDir));
  });
}

function dedupeByBasenameKeepLatestTool(
  items: DeliverableItem[],
  allItems: DeliverableItem[],
  turnDir: string | null,
): DeliverableItem[] {
  const toolOrder = new Map<string, number>();
  allItems.forEach((item, index) => {
    if (item.source !== 'tool') return;
    const base = getArtifactFileName(item.apiPath || item.path).toLowerCase();
    toolOrder.set(base, index);
  });

  const latestByBase = new Map<string, DeliverableItem>();
  for (const item of items) {
    const base = getArtifactFileName(item.apiPath || item.path).toLowerCase();
    const existing = latestByBase.get(base);
    if (!existing) {
      latestByBase.set(base, item);
      continue;
    }
    const itemDir = getArtifactDirectory(item.apiPath || item.path);
    const existingDir = getArtifactDirectory(existing.apiPath || existing.path);
    if (turnDir) {
      const itemInTurn = itemDir === turnDir;
      const existingInTurn = existingDir === turnDir;
      if (itemInTurn && !existingInTurn) {
        latestByBase.set(base, item);
        continue;
      }
      if (!itemInTurn && existingInTurn) {
        continue;
      }
    }
    const existingIdx = toolOrder.get(base) ?? -1;
    const itemIdx = allItems.findIndex((candidate) => candidate.id === item.id);
    if (item.source === 'tool' && itemIdx >= existingIdx) {
      latestByBase.set(base, item);
    }
  }

  return Array.from(latestByBase.values());
}

function itemKey(item: DeliverableItem): string {
  return item.id;
}

function findTurnStartIndex(sessionMessages: ChatMessage[], turnMessages: ChatMessage[]): number {
  const firstTurnId = turnMessages[0]?.id;
  if (firstTurnId) {
    const byId = sessionMessages.findIndex((message) => message.id === firstTurnId);
    if (byId >= 0) return byId;
  }
  const firstTurnTs = turnMessages[0]?.timestamp;
  if (firstTurnTs) {
    const byTs = sessionMessages.findIndex((message) => message.timestamp === firstTurnTs);
    if (byTs >= 0) return byTs;
  }
  return sessionMessages.length;
}

function collectPriorTurnDeliverables(
  sessionMessages: ChatMessage[] | undefined,
  turnMessages: ChatMessage[],
  projectRoot?: string,
): DeliverableItem[] {
  if (!sessionMessages?.length || turnMessages.length === 0) return [];
  const start = findTurnStartIndex(sessionMessages, turnMessages);
  if (start <= 0) return [];
  return collectDeliverablesFromMessages(sessionMessages.slice(0, start), projectRoot);
}

function isItemInTurnDir(item: DeliverableItem, turnDir: string): boolean {
  if (item.kind === 'url') return false;
  const path = normalizeArtifactPath(item.apiPath || item.path);
  const dir = getArtifactDirectory(path);
  if (!dir) return false;
  return dir === turnDir || dir.startsWith(`${turnDir}/`);
}

function buildAllTurnItems(options: CollectTurnDeliverablesOptions): DeliverableItem[] {
  const turnItems = collectTurnAllArtifacts(options);
  const priorItems = collectPriorTurnDeliverables(
    options.sessionToolMessages,
    options.toolMessages ?? [],
    options.projectRoot,
  );
  let merged = priorItems.length === 0 ? turnItems : reconcileTurnDeliverables(mergeDeliverables(turnItems, priorItems));

  const turnDir = options.turnArtifactDirOverride
    ?? inferTurnDirFromExplicitPaths(explicitTurnDirPaths(options))
    ?? inferTurnArtifactDirectory(merged);
  const goal = `${options.userGoalText ?? ''}\n${extractSessionUserGoal(options.sessionToolMessages)}`;
  if (turnDir && (isBrandGeoFullCaseGoal(goal) || isGeoCampaignArtifactDir(turnDir))) {
    const sessionTools = collectDeliverablesFromMessages(
      options.sessionToolMessages?.filter((message) => message.isToolUse) ?? [],
      options.projectRoot,
    ).filter(
      (item) => item.kind === 'url' || (isItemInTurnDir(item, turnDir) && !isDraftDeliverable(item)),
    );
    merged = reconcileTurnDeliverables(mergeDeliverables(merged, sessionTools));
  }

  return merged;
}

function mergePriorTurnDeliverablesInDir(
  finalItems: DeliverableItem[],
  options: CollectTurnDeliverablesOptions,
  turnDir: string | null,
): DeliverableItem[] {
  if (!turnDir) return finalItems;
  if (hasFrozenSessionManifest(options)) return finalItems;
  const priorItems = collectPriorTurnDeliverables(
    options.sessionToolMessages,
    options.toolMessages ?? [],
    options.projectRoot,
  );
  if (priorItems.length === 0) return finalItems;

  const priorInDir = priorItems.filter(
    (item) => item.kind === 'url' || (isItemInTurnDir(item, turnDir) && !isDraftDeliverable(item)),
  );
  if (priorInDir.length === 0) return finalItems;

  return mergeDeliverables(
    finalItems,
    priorInDir.map((item) => ({
      ...item,
      turnArtifactDir: turnDir,
    })),
  );
}

function expandBareDeliverablesWithTurnDir(
  items: DeliverableItem[],
  turnDir: string | null,
): DeliverableItem[] {
  if (!turnDir) return items;
  const normalizedDir = turnDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return items.map((item) => {
    if (item.kind === 'url') return item;
    const rawPath = normalizeArtifactPath(item.apiPath || item.path);
    if (!rawPath || isPhantomDeliverablePath(rawPath)) return item;
    if (rawPath.includes('/') && !isBareDeliverableFilename(rawPath)) {
      return { ...item, turnArtifactDir: item.turnArtifactDir ?? normalizedDir };
    }
    const base = getArtifactFileName(rawPath);
    if (!base) return item;
    const expanded = `${normalizedDir}/${base}`;
    return {
      ...item,
      path: expanded,
      apiPath: expanded,
      turnArtifactDir: normalizedDir,
    };
  });
}

function extractSessionUserGoal(sessionMessages: ChatMessage[] | undefined): string {
  if (!sessionMessages?.length) return '';
  for (const message of sessionMessages) {
    if (message.type === 'user') {
      const text = String(message.content ?? '').trim();
      if (text) return text;
    }
  }
  return '';
}

function countDeliverablesInTurnDir(items: DeliverableItem[], turnDir: string): number {
  return items.filter(
    (item) => item.kind === 'url' || (isItemInTurnDir(item, turnDir) && !isDraftDeliverable(item)),
  ).length;
}

function isContentMatrixArtifactDir(turnDir: string): boolean {
  return /^artifacts\/content-/i.test(turnDir) || /^artifacts\/campaign-/i.test(turnDir);
}

function isContentMatrixGoal(goal: string, capabilitySlug?: string): boolean {
  const slug = String(capabilitySlug ?? '').toLowerCase();
  return /last30days|content-flywheel|content flywheel|01-topics\.md|02-longform\.md|03-social-slices/i.test(goal)
    || slug.includes('last30days')
    || slug.includes('content-flywheel');
}

function shouldExpandDeliverablesToTurnDir(
  turnDir: string | null,
  options: CollectTurnDeliverablesOptions,
  finalCount: number,
  allItems: DeliverableItem[],
): boolean {
  if (!turnDir) return false;
  // PD-SAAS-FORK: P0-1 frozen SDM fixes row count; directory/slug scans may
  // enrich those slots later in the unified view but must never add rows here.
  if (hasFrozenSessionManifest(options)) return false;
  const inDirCount = countDeliverablesInTurnDir(allItems, turnDir);
  const goal = `${options.userGoalText ?? ''}\n${extractSessionUserGoal(options.sessionToolMessages)}`;
  if (isBrandGeoFullCaseGoal(goal) || isGeoCampaignArtifactDir(turnDir)) {
    return inDirCount > finalCount;
  }
  if (isContentMatrixArtifactDir(turnDir) || isContentMatrixGoal(goal, options.capabilitySlug)) {
    return inDirCount > finalCount;
  }
  if (options.turnArtifactDirOverride && inDirCount > finalCount) return true;
  if (inDirCount > 1 && inDirCount > finalCount) return true;
  return false;
}

function isImageGenerationGoal(goal: string, capabilitySlug?: string): boolean {
  const slug = String(capabilitySlug ?? '').toLowerCase();
  return /image-generation|image_generation|generate_image|生图|od-image-gen|df-image-gen/i.test(goal)
    || slug.includes('image-gen')
    || slug.includes('image-generation');
}

function findLastGenerateImageDeliverable(
  allItems: DeliverableItem[],
  toolMessages: ChatMessage[],
): DeliverableItem | null {
  const segmentTools = findLastExecutionSegmentTools(toolMessages);
  for (let i = segmentTools.length - 1; i >= 0; i -= 1) {
    const message = segmentTools[i];
    if (message.toolName !== 'generate_image') continue;
    const fromTools = collectDeliverablesFromMessages([message]);
    const item = fromTools.find((candidate) => candidate.kind !== 'url');
    if (item) return item;
    const path = rawToolWritePaths([message])[0];
    if (path) {
      const matched = allItems.find((candidate) => {
        const candidatePath = normalizeArtifactPath(candidate.apiPath || candidate.path);
        return candidatePath === path || candidatePath.endsWith(`/${getArtifactFileName(path)}`);
      });
      if (matched) return matched;
    }
  }
  for (let i = allItems.length - 1; i >= 0; i -= 1) {
    const item = allItems[i];
    if (item.toolName === 'generate_image' || /\.(png|jpe?g|webp|gif)$/i.test(item.apiPath || item.path)) {
      return item;
    }
  }
  return null;
}

function shouldSkipPickPrimary(
  allItems: DeliverableItem[],
  turnDir: string | null,
  options: CollectTurnDeliverablesOptions,
): boolean {
  if (hasFrozenSessionManifest(options)) return false;
  const goal = `${options.userGoalText ?? ''}\n${extractSessionUserGoal(options.sessionToolMessages)}`;
  if (isContentMatrixGoal(goal, options.capabilitySlug)) return true;
  if (turnDir && isContentMatrixArtifactDir(turnDir)) return true;
  if (turnDir && countDeliverablesInTurnDir(allItems, turnDir) > 1) return true;
  if (isImageGenerationGoal(goal, options.capabilitySlug)) return true;
  return false;
}

function collectNonDraftWithoutPickPrimary(
  allItems: DeliverableItem[],
  turnDir: string | null,
): DeliverableItem[] {
  const nonDraft = allItems.filter((item) => item.kind === 'url' || !isDraftDeliverable(item));
  if (turnDir) {
    const inDir = nonDraft.filter((item) => item.kind === 'url' || isItemInTurnDir(item, turnDir));
    if (inDir.length > 0) return inDir;
  }
  const toolItems = nonDraft.filter((item) => item.source === 'tool');
  return toolItems.length > 0 ? toolItems : nonDraft;
}

function expandDeliverablesWithinTurnDir(
  finalItems: DeliverableItem[],
  allItems: DeliverableItem[],
  turnDir: string,
): DeliverableItem[] {
  const inDir = allItems.filter(
    (item) => item.kind === 'url' || (isItemInTurnDir(item, turnDir) && !isDraftDeliverable(item)),
  );
  if (inDir.length === 0) return finalItems;
  return mergeDeliverables(
    finalItems,
    inDir.map((item) => ({
      ...item,
      turnArtifactDir: turnDir,
    })),
  );
}

function applyDeliverableLinkContracts(
  items: DeliverableItem[],
  turnDir: string | null,
): DeliverableItem[] {
  return items
    .map((item) => {
      if (item.kind === 'url') return item;
      const contract = buildDeliverableLinkContract({
        apiPath: item.apiPath || item.path,
        resolvedPath: item.resolvedPath || item.apiPath || item.path,
        hintDir: item.turnArtifactDir ?? turnDir ?? undefined,
        turnArtifactDir: item.turnArtifactDir ?? turnDir ?? undefined,
        validationStatus: 'verified',
      });
      if (contract.displayStatus === 'hidden') return null;
      return {
        ...item,
        path: contract.path,
        apiPath: contract.entries.deliverableCard,
        resolvedPath: contract.resolvedPath,
        linkContract: contract,
        turnArtifactDir: contract.turnArtifactDir || item.turnArtifactDir,
      };
    })
    .filter((item): item is DeliverableItem => Boolean(item));
}

export function collectTurnFinalDeliverables(options: CollectTurnDeliverablesOptions): DeliverableItem[] {
  const allItems = buildAllTurnItems(options);
  if (allItems.length === 0) return [];

  const textAnchorsEarly = extractDeliverablePathsFromText(options.assistantText || '')
    .map((path) => normalizeArtifactPath(path));
  const onlyDraftArtifacts = allItems
    .filter((item) => item.kind !== 'url')
    .every((item) => isDraftDeliverable(item));
  const textMentionsDraft = textAnchorsEarly.some((path) => isDraftPath(path));
  if (onlyDraftArtifacts && !textMentionsDraft) {
    return [];
  }

  if (options.turnDeliverableUnrecoverable) {
    return [];
  }

  const anchorPaths = augmentAnchorPathsWithAuthoritativePptx(
    anchorPathsFromOptions(options).filter(isDeliverableAnchorPath),
    allItems,
  );
  const turnDir = options.turnArtifactDirOverride
    ?? inferTurnDirFromExplicitPaths(explicitTurnDirPaths(options))
    ?? inferTurnArtifactDirectory(allItems);

  let finalItems: DeliverableItem[];

  if (anchorPaths.length > 0) {
    finalItems = allItems.filter((item) =>
      anchorPaths.some((anchor) => pathsMatchAnchor(item, anchor, turnDir)),
    );
    for (const anchor of anchorPaths) {
      const textOnly = collectDeliverablesFromAssistantText(anchor, options.projectRoot)
        .filter((item) => item.kind !== 'url');
      finalItems = mergeDeliverables(finalItems, textOnly);
    }
  } else {
    const nonDraft = allItems.filter(
      (item) => item.kind === 'url' || !isDraftDeliverable(item),
    );
    const goal = `${options.userGoalText ?? ''}\n${extractSessionUserGoal(options.sessionToolMessages)}`;
    if (shouldSkipPickPrimary(allItems, turnDir, options)) {
      finalItems = collectNonDraftWithoutPickPrimary(nonDraft, turnDir);
    } else if (isImageGenerationGoal(goal, options.capabilitySlug)) {
      const lastImage = findLastGenerateImageDeliverable(allItems, options.toolMessages ?? []);
      finalItems = lastImage ? [lastImage] : [];
    } else {
      const primary = pickPrimaryDeliverableFile(nonDraft);
      finalItems = primary ? [primary] : [];
    }
  }

  if (turnDir && shouldExpandDeliverablesToTurnDir(turnDir, options, finalItems.length, allItems)) {
    finalItems = expandDeliverablesWithinTurnDir(finalItems, allItems, turnDir);
  }

  finalItems = filterDraftsUnlessAnchored(finalItems, anchorPaths);
  finalItems = mergePriorTurnDeliverablesInDir(finalItems, options, turnDir);
  finalItems = dedupeByBasenameKeepLatestTool(finalItems, allItems, turnDir);

  const textAnchors = extractDeliverablePathsFromText(options.assistantText || '')
    .map((path) => normalizeArtifactPath(path));
  finalItems = finalItems.filter((item) => {
    if (item.kind === 'url') return true;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    if (!isDraftDeliverable(item)) return true;
    return textAnchors.some((anchor) => pathsMatchAnchor(item, anchor, turnDir));
  });

  const withoutDrafts = finalItems.filter((item) => {
    if (item.kind === 'url') return true;
    if (!isDraftDeliverable(item)) return true;
    return textAnchors.some((anchor) => pathsMatchAnchor(item, anchor, turnDir));
  });

  if (
    withoutDrafts.length === 0
    && allItems.length > 0
    && allItems.every((item) => item.kind !== 'url' && isDraftDeliverable(item))
  ) {
    return [];
  }

  const presentationFiltered = applyPresentationDeliverablePolicy(
    reconcileTurnDeliverables(withoutDrafts).map((item) => ({
      ...item,
      turnArtifactDir: turnDir ?? item.turnArtifactDir,
    })),
    allItems,
    anchorPaths,
  );

  const expandedPaths = expandBareDeliverablesWithTurnDir(presentationFiltered, turnDir);

  return applyDeliverableLinkContracts(filterDeliverablesForDisplayPanel(
    filterOrphanIntermediateHtmlFromFinal(expandedPaths, options), {
    userGoalText: options.userGoalText,
    anchorPaths,
  }), turnDir);
}

export function collectTurnProcessArtifacts(options: CollectTurnDeliverablesOptions): DeliverableItem[] {
  const allItems = collectTurnAllArtifacts(options);
  const finalItems = collectTurnFinalDeliverables(options);
  const finalKeys = new Set(finalItems.map(itemKey));
  const finalBasenames = new Set(
    finalItems
      .filter((item) => item.kind !== 'url')
      .map((item) => getArtifactFileName(item.apiPath || item.path).toLowerCase()),
  );
  return allItems.filter((item) => {
    if (finalKeys.has(itemKey(item))) return false;
    if (item.kind !== 'url') {
      const base = getArtifactFileName(item.apiPath || item.path).toLowerCase();
      if (finalBasenames.has(base)) return false;
    }
    return true;
  });
}
