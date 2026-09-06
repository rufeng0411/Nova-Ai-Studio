import { describe, expect, it } from 'vitest';
import { localizeCapabilityFields } from './capabilityLocale.js';

describe('localizeCapabilityFields runtime prefer', () => {
  it('keeps API zh display_name instead of stale bundled name', () => {
    const item = {
      slug: 'nova-customer-acquisition-leads',
      stage: 'activate',
      display_name: 'Nova-智能获客',
      task_summary: 'B2B 智能获客：检索→抽取→评分线索表',
      description: '交付 leads-report.md',
      stage_label: '营销触达',
      examples: ['用「Nova-智能获客」帮我找潜在客户'],
    };
    const localized = localizeCapabilityFields(item, 'zh-CN');
    expect(localized.display_name).toBe('Nova-智能获客');
    expect(localized.task_summary).toContain('智能获客');
  });
});
