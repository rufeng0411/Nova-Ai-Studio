import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCapabilityBindingAppendPrompt,
  buildDesignCanvasAgentAppendPrompt,
  resolveDesignCanvasAgentAppendFromMessages,
  resolveEnterpriseConsultExtra,
  shouldAppendDesignCanvasAgentProtocol,
} from './capabilityBindingPrompt.js';

describe('capabilityBindingPrompt', () => {
  it('includes binding tag, slug, read_skill for single skill', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'pd-geo', displayName: 'AI 搜索全案' });
    assert.match(p, /<capability-binding>/);
    assert.match(p, /pd-geo/);
    assert.match(p, /read_skill/);
  });

  it('pack hub uses member prefix routing', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'hub-pack-brand-website',
      displayName: '品牌官网全案',
      packMemberPrefix: 'mkt-brand-',
    });
    assert.match(p, /mkt-brand-/);
    assert.match(p, /1–3/);
  });

  it('open-design extra instructions forbid read_file skills path', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'open-design', displayName: 'Open Design' });
    assert.match(p, /勿 read_file skills\//);
  });

  it('od-poster-hero prefers generate_image before HTML', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'od-poster-hero',
      displayName: '宣传海报',
    });
    assert.match(p, /generate_image/);
    assert.match(p, /禁止首轮 CSS\/SVG/);
  });

  it('anth-pptx requires attachment fidelity, real pptx delivery, and quality bar', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'anth-pptx',
      displayName: 'PPT幻灯',
    });
    assert.match(p, /read_file 附件/);
    assert.match(p, /禁止用 presentation\.html/);
    assert.match(p, /真实可打开的 \.pptx/);
    assert.match(p, /配图/);
    assert.match(p, /图表/);
  });

  it('nova-ppt stops on API failure and skips unrelated auto-read', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'nova-ppt-aesthetic-slides',
      displayName: 'Nova 美学幻灯',
    });
    assert.match(p, /generate_image/);
    assert.match(p, /如实披露/);
    assert.match(p, /无 @ 时勿读/);
    assert.match(p, /禁止产出 HTML/);
  });

  it('TimesFM requires skill preflight, time-series data, and forbids unsupported forecasts', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'edu-sci-timesfm-forecasting',
      displayName: '时序预测 TimesFM',
    });
    assert.match(p, /read_skill/);
    assert.match(p, /check_system\.py/);
    assert.match(p, /CSV|时间序列/);
    assert.match(p, /禁止.*预测数字/);
  });

  it('pd-geo binding enforces web_search then Bocha verify order', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'pd-geo', displayName: 'AI 搜索全案' });
    assert.match(p, /web_search/);
    assert.match(p, /禁止.*Perplexity/);
    assert.match(p, /禁止 Task\/subagent/);
    assert.match(p, /tmp_workspace/);
    assert.match(p, /geo-aeo-audit-checklist\.md/);
    assert.match(p, /browser_navigate|Playwright/);
  });

  it('humanizer binding forbids subagent and cross-task paths', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'humanizer', displayName: 'Humanizer' });
    assert.match(p, /禁止 Task\/subagent/);
    assert.match(p, /task-\*/);
    assert.match(p, /并行 write_file/);
  });

  it('viral-article-generator binding locks four files and forbids vendor authority', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'viral-article-generator',
      displayName: '爆款长文生成',
    });
    assert.match(p, /article-brief\.md/);
    assert.match(p, /article\.md/);
    assert.match(p, /quotes\.md/);
    assert.match(p, /channel-plan\.md/);
    assert.match(p, /禁止 Task\/subagent/);
    assert.match(p, /vendor\/viral-article-generator/);
    assert.match(p, /T1-1|T1-2/);
    assert.match(p, /同 turn 写完即停|写完即停/);
    assert.match(p, /这意味着什么/);
  });

  it('etiquette allows unrelated user message fallback', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'pd-geo', displayName: 'AI 搜索全案' });
    assert.match(p, /若用户消息与该能力明显无关，按常规对话处理/);
  });

  it('meeting-recorder binding is valid', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'meeting-recorder-assistant',
      displayName: '会议记录助手',
    });
    assert.match(p, /meeting-recorder-assistant/);
  });

  it('nova-research binding forbids preference ask and requires write_file', () => {
    const industry = buildCapabilityBindingAppendPrompt({
      slug: 'nova-research-industry-market',
      displayName: 'Nova-行业市场',
    });
    assert.match(industry, /ask_user_question/);
    assert.match(industry, /write_file/);
    assert.match(industry, /standard/);
    assert.match(industry, /artifacts\/research-/);

    const general = buildCapabilityBindingAppendPrompt({
      slug: 'nova-research-general',
      displayName: 'Nova-通用调研',
    });
    assert.match(general, /禁止.*继续/);
    assert.match(general, /web_search 2–4 次/);
  });

  it('design canvas protocol lists canvas_add_diagram', () => {
    const p = buildDesignCanvasAgentAppendPrompt();
    assert.match(p, /canvas_add_diagram/);
  });

  it('design canvas append triggers on board path in user message', () => {
    assert.equal(
      shouldAppendDesignCanvasAgentProtocol('请更新 artifacts/canvas-e2e-playwright/canvas-manifest.json'),
      true,
    );
    const append = resolveDesignCanvasAgentAppendFromMessages([
      { role: 'user', content: '调用 canvas_add_diagram board_dir=artifacts/canvas-e2e-playwright' },
    ]);
    assert.match(append ?? '', /canvas_add_diagram/);
  });

  it('enterprise consult is fast oral chat with zero default tools', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'consult-tax',
      displayName: '税务顾问',
      majorCategory: 'brainstorming',
    });
    assert.match(p, /企业咨询/);
    assert.match(p, /须快速回复/);
    assert.match(p, /默认禁止调用任何工具/);
    assert.doesNotMatch(p, /允许 web_search/);
    assert.doesNotMatch(p, /直接执行并 write_file/);
    assert.ok(resolveEnterpriseConsultExtra('consult-tax'));
    assert.equal(resolveEnterpriseConsultExtra('comp-tax-sme-hnte'), undefined);
  });

  it('comp-* compliance binding still forces write_file', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'comp-contract-review',
      displayName: '商事合同审查',
      majorCategory: 'enterprise_compliance',
    });
    assert.match(p, /直接执行并 write_file/);
  });

  it('adds PR safety binding for enterprise PR cards', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'comp-pr-crisis-response',
      displayName: '危机应对',
      majorCategory: 'enterprise_compliance',
    });
    assert.match(p, /不代发新闻/);
    assert.match(p, /法务会签|法务与管理层审定/);
    assert.match(p, /直接执行并 write_file/);
  });

  it('ppt-master SaaS binding forbids Flask without launch-context', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'ppt-master',
      displayName: '原生可编辑 PPT',
    });
    assert.match(p, /Flask/);
    assert.match(p, /:5050/);
    assert.match(p, /ask_user|BLOCKING|八确认/);
    assert.doesNotMatch(p, /若会话含 <launch-context/);
  });

  it('ppt-master Flask forbid does not depend on displayName', () => {
    const p = buildCapabilityBindingAppendPrompt({ slug: 'ppt-master' });
    assert.match(p, /Flask/);
    assert.match(p, /:5050/);
    assert.doesNotMatch(p, /若会话含 <launch-context/);
  });

  it('open-design-preflight still gates on launch-context', () => {
    const p = buildCapabilityBindingAppendPrompt({
      slug: 'open-design-preflight',
      displayName: '设计总控',
    });
    assert.match(p, /launch-context/);
  });
});
