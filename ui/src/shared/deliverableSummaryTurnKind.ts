/**
 * PD-SAAS-FORK: turn-level classification for deliverable summary mount policy.
 */
import type { ChatMessage } from '../components/chat/types/types';
import { turnHasSuccessfulDeliverableTools } from './collectDeliverables';
import { parseUserActionNoticeFromMessage } from './parseUserActionNotice';

/** Pure ask_user / preference elicitation with no successful deliverable tools. */
export function isElicitationOnlyTurn(turnMessages: ChatMessage[]): boolean {
  if (turnMessages.length === 0) return false;
  let hasAskUser = false;
  for (const msg of turnMessages) {
    if (!msg.isToolUse || msg.toolName !== 'ask_user_question') continue;
    const toolResult = msg.toolResult;
    if (toolResult && typeof toolResult === 'object' && toolResult.isError) continue;
    hasAskUser = true;
    break;
  }
  if (!hasAskUser) return false;
  return !turnHasSuccessfulDeliverableTools(turnMessages);
}

/** Turn ends with user-action-required / needsUserInput on the final assistant bubble. */
export function isUserActionRequiredTurn(message: ChatMessage, turnMessages: ChatMessage[]): boolean {
  if (parseUserActionNoticeFromMessage(message) !== null) return true;
  for (let i = turnMessages.length - 1; i >= 0; i -= 1) {
    const turnMsg = turnMessages[i];
    if (turnMsg.type === 'assistant' && parseUserActionNoticeFromMessage(turnMsg) !== null) {
      return true;
    }
  }
  return false;
}
