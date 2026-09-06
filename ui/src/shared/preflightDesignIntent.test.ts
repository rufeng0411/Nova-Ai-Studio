import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  detectPreflightDesignIntent,
  messageAlreadySpecifiesDesignStyle,
  tryOpenPreflightFromComposerMessage,
} from './preflightDesignIntent';
import { storePendingLaunchContext, clearPendingLaunchContext, readPendingLaunchContext } from './launchContextStorage';
import { applyRuntimeFeatureFlags, resetRuntimeFeatureFlagsForTests } from './runtimeFeatureFlags';

const BASE_RUNTIME = {
  deliverableCertificateUi: false,
  exportSnapshotV2: false,
  exportUserAuditModes: false,
  deliverableSettledAcceptanceAuthority: true,
  deliverableTrustCopyV2: true,
  uiStrictCompletionGate: true,
  hyperframesHubV2: true,
  marketingSite: false,
  bentoDeckEditor: false,
  mdBrowserTool: false,
} as const;

describe('preflightDesignIntent', () => {
  const prev = process.env.PILOTDECK_PREFLIGHT_STUDIO;

  afterEach(() => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = prev;
    resetRuntimeFeatureFlagsForTests();
    clearPendingLaunchContext();
  });

  beforeEach(() => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = 'shadow';
    applyRuntimeFeatureFlags({ ...BASE_RUNTIME, preflightStudioMode: 'shadow' });
  });

  it('detects vague web design requests', () => {
    expect(detectPreflightDesignIntent('我想设计一个网页')?.slug).toBe('open-design');
    expect(detectPreflightDesignIntent('帮我做一个官网')?.slug).toBe('open-design');
    expect(detectPreflightDesignIntent('I want to design a landing page')?.slug).toBe('open-design');
  });

  it('detects poster and open design mentions', () => {
    expect(detectPreflightDesignIntent('我想设计一张海报')?.slug).toBe('open-design');
    expect(detectPreflightDesignIntent('我想设计一个跟 Open Design 有关的内容')?.slug).toBe('open-design');
  });

  it('detects ppt intent', () => {
    expect(detectPreflightDesignIntent('帮我做一个路演 PPT')?.slug).toBe('ppt-master');
    expect(detectPreflightDesignIntent('create a pitch deck')?.slug).toBe('ppt-master');
  });

  it('skips when style already specified', () => {
    expect(messageAlreadySpecifiesDesignStyle('用 Linear 风格设计一个网页')).toBe(true);
    expect(detectPreflightDesignIntent('用 Linear 风格设计一个网页')).toBeNull();
    expect(detectPreflightDesignIntent('按照 Stripe 设计系统做官网')).toBeNull();
  });

  it('skips continuation and export follow-ups', () => {
    expect(detectPreflightDesignIntent('继续')).toBeNull();
    expect(detectPreflightDesignIntent('把报告导出为 PDF')).toBeNull();
  });

  it('detects short ppt requests', () => {
    expect(detectPreflightDesignIntent('做ppt')?.slug).toBe('ppt-master');
    expect(detectPreflightDesignIntent('做个ppt')?.slug).toBe('ppt-master');
  });

  it('tryOpenPreflightFromComposerMessage keeps pending for same capability', () => {
    storePendingLaunchContext('<launch-context capability="open-design"/>');
    expect(
      tryOpenPreflightFromComposerMessage({ message: '我想设计一个网页', locale: 'zh-CN' }),
    ).toBeNull();
  });

  it('tryOpenPreflightFromComposerMessage keeps pending after custom-style skip', () => {
    storePendingLaunchContext(
      '<launch-context capability="open-design" preflight="custom"><directives>用户跳过模板选择</directives></launch-context>',
    );
    expect(
      tryOpenPreflightFromComposerMessage({ message: '我想设计一个网页', locale: 'zh-CN' }),
    ).toBeNull();
  });

  it('pivots from open-design pending context to ppt preflight', () => {
    storePendingLaunchContext(
      '<launch-context capability="open-design"><selections><surface id="perplexity" label="Perplexity AI"/></selections></launch-context>',
    );
    const intent = tryOpenPreflightFromComposerMessage({
      message: '做个ppt',
      locale: 'zh-CN',
    });
    expect(intent?.slug).toBe('ppt-master');
    expect(readPendingLaunchContext()).toBeNull();
  });

  it('tryOpenPreflightFromComposerMessage opens when flag on', () => {
    const intent = tryOpenPreflightFromComposerMessage({
      message: '我想设计一个网页',
      locale: 'zh-CN',
    });
    expect(intent?.slug).toBe('open-design');
    expect(intent?.displayName).toBe('设计总控');
  });
});
