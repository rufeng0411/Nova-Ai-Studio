/**
 * PD-SAAS-FORK: Append queued user turn to transcript before Gateway runs.
 */
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getPilotProjectChatDir } from '../../../../src/pilot/paths.ts';
import {
  buildAcceptedInputIdentity,
} from '../../../../src/session/transcript/acceptedInputIdentity.ts';
import {
  appendTranscriptEntryLocked,
} from '../../../../src/session/transcript/lockedTranscriptAppend.ts';
import { normalizeSessionId } from '../conversation/normalizeSessionId.js';

/**
 * @param {string} sessionId
 * @param {number} sequence
 * @param {string} text
 * @param {string} [entryId]
 * @param {string} [createdAt]
 */
function buildAcceptedInputEntry(
  sessionId,
  sequence,
  text,
  entryId,
  createdAt,
  inputFingerprint,
  attachmentDescriptors,
) {
  const resolvedEntryId = entryId ?? randomUUID();
  const resolvedCreatedAt = createdAt ?? new Date().toISOString();
  const turnId = `turn-${sequence}`;
  return {
    entry: {
      type: 'accepted_input',
      sessionId,
      turnId,
      sequence,
      createdAt: resolvedCreatedAt,
      entryId: resolvedEntryId,
      synthetic: true,
      inputFingerprint,
      attachmentDescriptors,
      messages: [{ role: 'user', content: [{ type: 'text', text }] }],
    },
    acceptedInputRef: {
      entryId: resolvedEntryId,
      turnId,
      sequence,
      createdAt: resolvedCreatedAt,
    },
  };
}

/**
 * @param {{
 *   pilotHome: string;
 *   projectKey: string;
 *   projectName?: string | null;
 *   sessionId: string;
 *   command: string;
 *   sequence?: number;
 *   entryId?: string;
 *   createdAt?: string;
 *   inputFingerprint?: string;
 *   attachmentDescriptors?: import('../../../../src/session/transcript/acceptedInputIdentity.ts').AcceptedInputAttachmentDescriptor[];
 * }} input
 */
export async function appendQueuedUserTranscript(input) {
  const target = resolveQueuedUserTranscriptPath(input);
  if (!target) return null;
  const { sessionId, transcriptPath } = target;
  const acceptedInputIdentity = input.inputFingerprint
    ? {
        inputFingerprint: input.inputFingerprint,
        attachmentDescriptors: input.attachmentDescriptors ?? [],
      }
    : buildAcceptedInputIdentity(input.command ?? '', input.attachmentDescriptors);
  const resolvedEntryId = input.entryId ?? randomUUID();
  const resolvedCreatedAt = input.createdAt ?? new Date().toISOString();
  const appended = await appendTranscriptEntryLocked(
    transcriptPath,
    (state) => buildAcceptedInputEntry(
      sessionId,
      state.nextSequence,
      input.command ?? '',
      resolvedEntryId,
      resolvedCreatedAt,
      acceptedInputIdentity.inputFingerprint,
      acceptedInputIdentity.attachmentDescriptors,
    ).entry,
  );
  const acceptedInputRef = {
    entryId: appended.entryId,
    turnId: appended.turnId,
    sequence: appended.sequence,
    createdAt: appended.createdAt,
  };
  const relPath = path.relative(input.pilotHome, transcriptPath).split(path.sep).join('/');
  return {
    absPath: transcriptPath,
    relPath,
    sequence: appended.sequence,
    turnId: appended.turnId,
    acceptedInputRef,
    inputFingerprint: acceptedInputIdentity.inputFingerprint,
    attachmentDescriptors: acceptedInputIdentity.attachmentDescriptors,
  };
}

export function resolveQueuedUserTranscriptPath(input) {
  const sessionId = normalizeSessionId(input.sessionId);
  if (!sessionId || !input.pilotHome) return null;
  const chatDir = getPilotProjectChatDir(input.projectKey, input.pilotHome);
  return {
    sessionId,
    transcriptPath: path.join(chatDir, `${sessionId}.jsonl`),
  };
}
