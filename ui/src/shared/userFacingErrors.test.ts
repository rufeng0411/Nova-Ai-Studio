import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ERROR_LABELS_EN,
  DEFAULT_ERROR_LABELS_ZH,
  buildExpandDetail,
  formatHandlingNotice,
  formatUserFacingNotice,
  formatUserFacingToolError,
  hasHardToolFailure,
  isAgentRecoveryBoilerplate,
  isDegenerateUserVisibleAssistantFragment,
  isTransientPartialRestartNarration,
  isProviderArrearageMessage,
  isRecoverableToolError,
  isSessionBusyInternalError,
  isTransientNetworkErrorMessage,
  stripRecoverySection,
  stripAgentRecoveryBoilerplateLines,
} from './userFacingErrors';

describe('userFacingErrors', () => {
  it('detects truncated restart/apology narration', () => {
    expect(isTransientPartialRestartNarration('抱歉刚才的')).toBe(true);
    expect(isTransientPartialRestartNarration('用户看到我的上一条回复被截断了，我需要重新开始。')).toBe(true);
    expect(isTransientPartialRestartNarration('好的，我先梳理需求。')).toBe(false);
    expect(isTransientPartialRestartNarration('I will inspect the files.')).toBe(false);
  });

  it('detects degenerate assistant fragments like 两个', () => {
    expect(isDegenerateUserVisibleAssistantFragment('两个')).toBe(true);
    expect(isDegenerateUserVisibleAssistantFragment('三个')).toBe(true);
    expect(isDegenerateUserVisibleAssistantFragment('接下来')).toBe(true);
    expect(isDegenerateUserVisibleAssistantFragment('Now I need')).toBe(true);
    expect(isDegenerateUserVisibleAssistantFragment('好的，我来整理竞品 GEO 报告')).toBe(false);
    expect(isDegenerateUserVisibleAssistantFragment('标准成果清单：\n1. report.md')).toBe(false);
  });

  it('detects transient network errors', () => {
    expect(isTransientNetworkErrorMessage('web_fetch failed: fetch failed')).toBe(true);
    expect(isTransientNetworkErrorMessage('file not found')).toBe(false);
  });

  it('strips Recovery section for UI display', () => {
    expect(
      stripRecoverySection('web_fetch failed: fetch failed\n\nRecovery: try web_search'),
    ).toBe('web_fetch failed: fetch failed');
    expect(
      stripRecoverySection('web_fetch 失败\n\n恢复：请换用 fetch_page_images'),
    ).toBe('web_fetch 失败');
  });

  it('maps recoverable tool errors to one-line retry summary', () => {
    const facing = formatUserFacingToolError(
      {
        toolName: 'web_fetch',
        errorCode: 'tool_execution_failed',
        rawContent: 'web_fetch failed: fetch failed\n\nRecovery: try alternate',
      },
      DEFAULT_ERROR_LABELS_EN,
    );
    expect(facing.recoverable).toBe(true);
    expect(facing.summary).toBe(DEFAULT_ERROR_LABELS_EN.unifiedRetry);
    expect(facing.technicalDetail === null || String(facing.technicalDetail).includes('fetch')).toBe(true);
  });

  it('maps non-network recoverable errors to unified retry line', () => {
    const facing = formatUserFacingToolError(
      {
        errorCode: 'invalid_tool_input',
        rawContent: '<tool_use_error>bad args</tool_use_error>',
      },
      DEFAULT_ERROR_LABELS_ZH,
    );
    expect(facing.summary).toBe(DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
  });

  it('treats session_busy active turn errors as internal handling without technical detail', () => {
    const raw = 'Session web-s_123 already has an active turn.';
    expect(isSessionBusyInternalError('session_busy', raw)).toBe(true);
    const notice = formatUserFacingNotice(
      { code: 'session_busy', raw, recoverable: true },
      DEFAULT_ERROR_LABELS_ZH,
    );

    expect(notice.summary).toBe(DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
    expect(notice.severity).toBe('handling');
    expect(notice.technicalDetail).toBeNull();
    expect(notice.showTechnicalDetail).toBe(false);
  });

  it('maps permission tool errors to permission summary', () => {
    const facing = formatUserFacingToolError(
      { errorCode: 'permission_required', rawContent: 'Permission denied' },
      DEFAULT_ERROR_LABELS_EN,
    );
    expect(facing.summary).toBe(DEFAULT_ERROR_LABELS_EN.unifiedPermission);
    expect(
      isRecoverableToolError({ errorCode: 'permission_required', rawContent: 'Permission denied' }),
    ).toBe(false);
  });

  it('formatUserFacingNotice returns pause with hints only for expand', () => {
    const notice = formatUserFacingNotice(
      {
        code: 'agent_tool_error_loop',
        raw: 'Repeated invalid tool input',
        exhausted: true,
      },
      DEFAULT_ERROR_LABELS_EN,
    );
    expect(notice.severity).toBe('pause');
    expect(notice.summary).toBe(DEFAULT_ERROR_LABELS_EN.unifiedExhausted);
    expect(buildExpandDetail(notice.hints, notice.technicalDetail)).toBeTruthy();
  });

  it('formatHandlingNotice uses unified retry without attempt counter', () => {
    const notice = formatHandlingNotice(3, 5, DEFAULT_ERROR_LABELS_EN);
    expect(notice.summary).toBe(DEFAULT_ERROR_LABELS_EN.unifiedRetry);
    expect(notice.summary).not.toContain('3');
  });

  it('hasHardToolFailure treats recoverable session errors as soft', () => {
    expect(hasHardToolFailure({ type: 'error', recoverable: true, noticeSeverity: 'handling' })).toBe(false);
    expect(hasHardToolFailure({ type: 'error', noticeSeverity: 'pause' })).toBe(true);
  });

  it('detects agent recovery boilerplate', () => {
    const raw =
      'Several tools failed in a row. Stop retrying. Failed tools: read_file. Use fetch_page_images.';
    expect(isAgentRecoveryBoilerplate(raw)).toBe(true);
    expect(stripRecoverySection(raw)).toBe('');
  });

  it('detects Chinese agent recovery boilerplate', () => {
    const raw =
      '连续多个工具调用失败。请换一种做法，不要重复同一错误路径。失败工具：read_file。';
    expect(isAgentRecoveryBoilerplate(raw)).toBe(true);
    expect(stripRecoverySection(raw)).toBe('');
  });

  it('detects repeated tool self-debugging as internal boilerplate', () => {
    const raw =
      'My previous multiple attempts were missing the old_string parameter which is required for the edit_file tool. '.repeat(3);

    expect(isAgentRecoveryBoilerplate(raw)).toBe(true);
    expect(stripRecoverySection(raw)).toBe('');
  });

  it('strips raw recovery boilerplate lines even when mixed into assistant prose', () => {
    const raw = [
      '网页已生成：artifacts/3d/world-cup-2026-stars/index.html',
      '',
      'Repeated invalid tool input after recovery attempts.',
      'session_prepare',
    ].join('\n');

    const cleaned = stripAgentRecoveryBoilerplateLines(raw);
    expect(cleaned).toContain('网页已生成');
    expect(cleaned).not.toMatch(/Repeated invalid tool input/i);
    expect(cleaned).not.toMatch(/session_prepare/i);
  });

  it('maps recovery boilerplate tool errors to Chinese summary without English detail', () => {
    const raw =
      'Several tools failed in a row. Failed tools: read_file. Do not use web_search for image CDN URLs.';
    const facing = formatUserFacingToolError(
      { errorCode: 'tool_execution_failed', rawContent: raw },
      DEFAULT_ERROR_LABELS_ZH,
    );
    expect(facing.summary).toBe(DEFAULT_ERROR_LABELS_ZH.unifiedRetry);
    expect(facing.technicalDetail).toBeNull();
  });

  it('formatUserFacingNotice exhausted uses Chinese pause without recovery text in detail', () => {
    const notice = formatUserFacingNotice(
      {
        code: 'agent_tool_error_loop',
        raw: 'Several tools failed. Failed tools: read_file',
        exhausted: true,
      },
      DEFAULT_ERROR_LABELS_ZH,
    );
    expect(notice.summary).toBe(DEFAULT_ERROR_LABELS_ZH.unifiedExhausted);
    expect(notice.technicalDetail).toBeNull();
    expect(notice.hints.length).toBeGreaterThan(0);
    expect(notice.hints.some((h) => /继续|网络|模型|说法/.test(h))).toBe(true);
  });

  it('maps DashScope arrearage to billing hint', () => {
    const raw =
      'Access denied, please make sure your account is in good standing. code=Arrearage';
    expect(isProviderArrearageMessage(raw)).toBe(true);
    const notice = formatUserFacingNotice(
      {
        code: 'agent_model_error',
        raw,
        exhausted: true,
      },
      DEFAULT_ERROR_LABELS_ZH,
    );
    expect(notice.summary).toMatch(/余额不足|换模型/);
    expect(notice.hints.some((h) => /余额不足|换用其他模型/.test(h))).toBe(true);
  });

  it('maps DeepSeek Insufficient Balance to a hard billing stop', () => {
    const raw = 'Insufficient Balance';
    expect(isProviderArrearageMessage(raw)).toBe(true);
    const notice = formatUserFacingNotice(
      {
        code: 'agent_model_error',
        raw,
        exhausted: true,
      },
      DEFAULT_ERROR_LABELS_ZH,
    );
    expect(notice.summary).toBe('当前模型余额不足，请换模型或充值');
    expect(notice.recoverable).toBe(false);
  });
});
