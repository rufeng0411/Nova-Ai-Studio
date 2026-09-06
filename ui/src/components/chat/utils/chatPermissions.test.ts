// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getPilotDeckPermissionSuggestion,
  shouldAutoApproveSessionToolPermission,
  shouldSilenceToolPermissionPrompt,
} from './chatPermissions.js';
import { PILOTDECK_SETTINGS_KEY } from './chatStorage.js';

describe('chatPermissions', () => {
  beforeEach(() => {
    localStorage.removeItem(PILOTDECK_SETTINGS_KEY);
  });

  it('silences permission prompts when skipPermissions is true', () => {
    localStorage.setItem(PILOTDECK_SETTINGS_KEY, JSON.stringify({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: true,
    }));
    expect(shouldSilenceToolPermissionPrompt()).toBe(true);
    expect(getPilotDeckPermissionSuggestion({
      isToolUse: true,
      toolName: 'Bash',
      toolInput: '{"command":"ls"}',
      toolResult: { isError: true, errorCode: 'permission_denied', content: 'denied' },
    }, 'pilotdeck')).toBeNull();
  });

  it('does not suggest grant when tool is already in allowedTools', () => {
    localStorage.setItem(PILOTDECK_SETTINGS_KEY, JSON.stringify({
      allowedTools: ['bash:ls:*'],
      disallowedTools: [],
      skipPermissions: false,
    }));
    expect(getPilotDeckPermissionSuggestion({
      isToolUse: true,
      toolName: 'Bash',
      toolInput: '{"command":"ls -la"}',
      toolResult: { isError: true, errorCode: 'permission_denied', content: 'denied' },
    }, 'pilotdeck')).toBeNull();
  });

  it('auto-approves generic tools but not ask_user_question', () => {
    localStorage.setItem(PILOTDECK_SETTINGS_KEY, JSON.stringify({
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: true,
    }));
    expect(shouldAutoApproveSessionToolPermission({ toolName: 'Bash' })).toBe(true);
    expect(shouldAutoApproveSessionToolPermission({ toolName: 'ask_user_question', isElicitation: true })).toBe(false);
    expect(shouldAutoApproveSessionToolPermission({ toolName: 'exit_plan_mode' })).toBe(false);
  });
});
