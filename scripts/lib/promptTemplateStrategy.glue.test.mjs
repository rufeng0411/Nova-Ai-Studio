// PD-SAAS-FORK: P0-E — finalizeHubTryPrompt task-dir suffix must not glue to list basenames.
import { describe, expect, it } from 'vitest';
import { finalizeHubTryPrompt, hubPromptQualityIssues } from './promptTemplateStrategy.mjs';

describe('finalizeHubTryPrompt glue prevention', () => {
  it('separates numbered deliverable list from task-dir suffix', () => {
    const out = finalizeHubTryPrompt(
      '用「GEO挖词」整理关键词。须交付：keywords.md、keywords.html。',
      { slug: 'geo-keyword-research', majorCategory: 'geo' },
    );
    expect(out).toMatch(/keywords\.html\n写入系统分配任务目录/);
    expect(out).not.toMatch(/keywords\.html[ \t]*写入系统分配/);
    expect(hubPromptQualityIssues(out)).not.toContain('glued_task_dir_suffix');
  });

  it('flags glued suffix in hubPromptQualityIssues', () => {
    const glued = '1. keywords.html写入系统分配任务目录。';
    expect(hubPromptQualityIssues(glued)).toContain('glued_task_dir_suffix');
  });
});
