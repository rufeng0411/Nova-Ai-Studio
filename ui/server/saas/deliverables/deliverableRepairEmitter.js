/**
 * PD-SAAS-FORK: emit deliverable_repair after turn when validate finds missing files
 */
import { validateDeliverablesForProject } from '../../utils/validateDeliverables.js';
import { parseJsonlFile } from '../../../../scripts/lib/parseJsonlTurns.mjs';

const USER_GOAL_DELIVERABLE = /(?:ppt|PPT|pptx|幻灯|docx|word|pdf|报告|导出)/i;

function textFromTranscriptMessage(msg) {
  if (typeof msg?.content === 'string') return msg.content;
  if (Array.isArray(msg?.content)) {
    return msg.content
      .map((block) => (block && typeof block === 'object' && typeof block.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return typeof msg?.text === 'string' ? msg.text : '';
}

/**
 * @param {object} input
 * @param {string} input.sessionKey
 * @param {string} input.turnId
 * @param {string} input.projectName
 * @param {string} input.transcriptAbsPath
 * @param {(frame: object) => void} input.sendFrame
 */
export async function maybeEmitDeliverableRepair(input) {
  if (!input.sessionKey || !input.turnId || !input.projectName) return;
  if (process.env.PILOTDECK_DELIVERABLE_REPAIR === '0') return;
  // PD-SAAS-FORK (ROG M13): legacy body-regex repair off by default — engine meta is authoritative.
  const legacyRepairEnabled = ['1', 'true', 'on'].includes(
    String(process.env.PILOTDECK_BRIDGE_LEGACY_REPAIR ?? '0').trim().toLowerCase(),
  );

  // PD-SAAS-FORK: engine turn_acceptance_meta is authoritative — skip narrow-regex fallback.
  if (input.transcriptAbsPath) {
    try {
      const parsed = parseJsonlFile(input.transcriptAbsPath);
      const hasEngineMeta = (parsed.entries ?? []).some(
        (entry) => entry?.type === 'turn_acceptance_meta' && entry?.turnId === input.turnId,
      );
      if (hasEngineMeta) return;
    } catch {
      if (!legacyRepairEnabled) return;
    }
  }

  if (!legacyRepairEnabled) return;

  let userGoal = '';
  const paths = [];
  try {
    if (input.transcriptAbsPath) {
      const parsed = parseJsonlFile(input.transcriptAbsPath);
      const turn = parsed.turns?.find((t) => t.turnId === input.turnId);
      for (const msg of turn?.messages ?? []) {
        if (msg.role === 'user' && !msg.metadata?.synthetic) {
          userGoal = textFromTranscriptMessage(msg);
        }
        const text = textFromTranscriptMessage(msg);
        const matches = text.match(/(?:artifacts\/[^\s"'<>]+\.\w+|[^\s"'<>]+\.(?:pptx|docx|pdf|md))/gi);
        if (matches) paths.push(...matches);
      }
    }
  } catch {
    return;
  }

  if (!USER_GOAL_DELIVERABLE.test(userGoal)) return;
  const uniquePaths = [...new Set(paths)].slice(0, 10);
  if (uniquePaths.length === 0 && /pptx/i.test(userGoal)) {
    uniquePaths.push('deliverable.pptx');
  }

  const validation = await validateDeliverablesForProject(input.projectName, uniquePaths);
  const missing = (validation.items ?? [])
    .filter((item) => item.status === 'broken' || item.status === 'phantom')
    .map((item) => item.path);
  const verified = (validation.items ?? [])
    .filter((item) => item.status === 'verified')
    .map((item) => item.path);

  if (missing.length === 0) return;

  input.sendFrame({
    sessionId: input.sessionKey,
    provider: 'pilotdeck',
    kind: 'status',
    text: 'deliverable_repair',
    statusKind: 'deliverable_repair',
    recoveryOwner: 'deliverable_repair',
    noticeSeverity: 'handling',
    missingPaths: missing,
    verifiedPaths: verified,
    userGoal,
    lastTurnId: input.turnId,
    canInterrupt: true,
  });
}

export function scheduleDeliverableRepairCheck(input) {
  setImmediate(() => {
    void maybeEmitDeliverableRepair(input).catch((err) => {
      console.warn('[deliverable-repair] check failed:', err?.message || err);
    });
  });
}
