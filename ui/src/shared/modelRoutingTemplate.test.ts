import { describe, expect, it } from 'vitest';
import {
  applyModelRoutingTemplate,
  extractModelRoutingTemplate,
  parseModelRoutingTemplateImport,
  validateModelRefsAgainstPool,
} from './modelRoutingTemplate';

describe('modelRoutingTemplate', () => {
  it('extracts and applies agent/router/memory slices', () => {
    const base = {
      agent: { model: 'openai/gpt-4o', maxContextTokens: 128000 },
      memory: { enabled: true, model: 'inherit' as unknown as string },
      router: { enabled: true, scenarios: { default: 'openai/gpt-4o' }, tokenSaver: { judge: 'openai/gpt-4o-mini' } },
      model: { providers: { qwen: { models: { 'qwen3.7-plus': {} } } } },
    };
    const template = extractModelRoutingTemplate(
      {
        agent: { model: 'qwen/qwen3.7-plus', subagents: { default: 'qwen/qwen3.7-flash' } },
        memory: { enabled: true, model: 'qwen/qwen3.7-plus' },
        router: { scenarios: { default: 'qwen/qwen3.7-plus' }, fallback: { default: ['qwen/qwen3.7-flash'] } },
      },
      '通义轻量',
    );
    expect(template.name).toBe('通义轻量');
    expect(template.summary?.agentModel).toBe('qwen/qwen3.7-plus');

    const next = applyModelRoutingTemplate(base, template);
    expect(next.agent?.model).toBe('qwen/qwen3.7-plus');
    expect(next.memory?.model).toBe('qwen/qwen3.7-plus');
    expect(next.router?.scenarios?.default).toBe('qwen/qwen3.7-plus');
    expect(next.router?.tokenSaver?.judge).toBe('openai/gpt-4o-mini');
  });

  it('validates model refs against model pool', () => {
    const missing = validateModelRefsAgainstPool(
      { agent: { model: 'qwen/missing-model' } },
      { qwen: { models: { 'qwen3.7-plus': {} } } },
    );
    expect(missing).toEqual(['qwen/missing-model']);
  });

  it('parses exported json', () => {
    const tpl = parseModelRoutingTemplateImport(JSON.stringify({
      name: '导入模板',
      agent: { model: 'qwen/qwen3.7-plus' },
    }));
    expect(tpl?.name).toBe('导入模板');
    expect(tpl?.agent?.model).toBe('qwen/qwen3.7-plus');
  });
});
