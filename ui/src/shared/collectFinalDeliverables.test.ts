import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  collectTurnFinalDeliverables,
  collectTurnProcessArtifacts,
} from './collectFinalDeliverables';
import { collectTurnAllArtifacts } from './collectDeliverables';

function tool(
  id: string,
  toolName: string,
  filePath: string,
): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: '2026-06-12T00:00:00.000Z',
    isToolUse: true,
    toolName,
    toolId: id,
    toolInput: JSON.stringify({ file_path: filePath }),
    toolResult: {
      isError: false,
      content: 'ok',
      writtenFilePath: filePath,
    },
  };
}

describe('collectFinalDeliverables', () => {
  it('keeps only final path when assistant anchors one image', () => {
    const toolMessages = [
      tool('g1', 'generate_image', 'artifacts/demo/v1.png'),
      tool('g2', 'generate_image', 'artifacts/demo/v2.png'),
      tool('g3', 'generate_image', 'artifacts/demo/out.png'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '成品见 `artifacts/demo/out.png`',
      toolMessages,
    });
    const process = collectTurnProcessArtifacts({
      assistantText: '成品见 `artifacts/demo/out.png`',
      toolMessages,
    });

    expect(final.map((item) => item.path)).toEqual(['artifacts/demo/out.png']);
    expect(process.map((item) => item.path).sort()).toEqual([
      'artifacts/demo/v1.png',
      'artifacts/demo/v2.png',
    ]);
  });

  it('uses last execution segment when final text has no paths', () => {
    const toolMessages = [
      tool('w1', 'write_file', 'artifacts/demo/draft.md'),
      {
        id: 'a-mid',
        type: 'assistant',
        content: '中间说明',
        timestamp: '2026-06-12T00:00:01.000Z',
      },
      tool('w2', 'write_file', 'artifacts/demo/final.md'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '全部完成。',
      toolMessages,
    });

    expect(final.map((item) => item.path)).toEqual(['artifacts/demo/final.md']);
  });

  it('excludes drafts unless mentioned in final text', () => {
    const toolMessages = [tool('d1', 'write_file', 'drafts/foo.md')];
    const final = collectTurnFinalDeliverables({
      assistantText: '草稿已写好。',
      toolMessages,
    });
    const process = collectTurnProcessArtifacts({
      assistantText: '草稿已写好。',
      toolMessages,
    });

    expect(final).toHaveLength(0);
    expect(process.map((item) => item.path)).toContain('drafts/foo.md');
  });

  it('collectTurnAllArtifacts includes everything', () => {
    const toolMessages = [
      tool('g1', 'generate_image', 'artifacts/demo/v1.png'),
      tool('g2', 'generate_image', 'artifacts/demo/out.png'),
    ];
    const all = collectTurnAllArtifacts({
      assistantText: '见 out.png',
      toolMessages,
    });
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('anchors slug-folder deliverables from assistant text path', () => {
    const filePath = '0608/ROG品牌舆情深度调研报告.md';
    const toolMessages = [tool('w1', 'write_file', filePath)];
    const final = collectTurnFinalDeliverables({
      assistantText: `完整报告见 \`${filePath}\``,
      toolMessages,
    });
    expect(final).toHaveLength(1);
    expect(final[0].apiPath).toContain('ROG品牌舆情深度调研报告.md');
    expect(final[0].turnArtifactDir).toBe('0608');
  });

  it('hides helper scripts when user asked for HTML only', () => {
    const toolMessages = [
      tool('s1', 'write_file', 'artifacts/demo/export.py'),
      tool('h1', 'write_file', 'artifacts/demo/page.html'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '页面见 `artifacts/demo/page.html`',
      toolMessages,
      userGoalText: '生成 HTML 落地页',
    });
    expect(final.map((item) => item.path)).toEqual(['artifacts/demo/page.html']);
  });

  it('keeps magazine html as the only final card when assistant previews index.html', () => {
    const dir = 'artifacts/magazine-razer-blade-tu-du-2026-0623';
    const toolMessages = [
      tool('w-platforms', 'write_file', `${dir}/platforms.md`),
      tool('w-index', 'write_file', `${dir}/index.html`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: `已生成杂志长文 HTML。\n👉 预览文件路径：${dir}/index.html`,
      toolMessages,
      userGoalText: '生成雷蛇杂志长文 HTML',
    });

    expect(final.map((item) => item.path)).toEqual([`${dir}/index.html`]);
  });

  it('does not promote skill SKILL.md when agent mentions last30days inline', () => {
    const toolMessages = [
      tool('s1', 'write_file', 'skills/last30days/SKILL.md'),
      tool('p1', 'write_file', 'scripts/last30days.py'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '已成功加载 last30days 技能。研究报告见上文，详见 SKILL.md。',
      toolMessages,
      userGoalText: '用 last30days 帮我：世界杯热点',
    });
    expect(final.map((item) => item.path)).toEqual([]);
  });

  it('resolves markdown-linked last30days report paths without bracket or geo corruption', () => {
    const assistantText = [
      '雷蛇近 30 天舆情简报已生成，核心发现如下：',
      '',
      '[artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md](artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md)',
    ].join('\n');
    const final = collectTurnFinalDeliverables({
      assistantText,
      toolMessages: [],
      userGoalText: '用 last30days 帮我：雷蛇近期热点和舆情',
    });
    expect(final.map((item) => item.apiPath)).toEqual([
      'artifacts/last30days-razer-20260621-1430/razer-热点舆情简报.md',
    ]);
  });

  it('ignores failed tool writes', () => {
    const toolMessages: ChatMessage[] = [
      {
        id: 'bad',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-12T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 'bad',
        toolInput: JSON.stringify({ file_path: 'artifacts/demo/broken.pdf' }),
        toolResult: {
          isError: true,
          content: 'permission denied',
        },
      },
      tool('ok', 'write_file', 'artifacts/demo/final.pdf'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '见 `artifacts/demo/final.pdf`',
      toolMessages,
      userGoalText: '导出 PDF',
    });
    expect(final.map((item) => item.path)).toEqual(['artifacts/demo/final.pdf']);
  });

  it('merges prior-turn campaign deliverables under the same task folder on continued turns', () => {
    const campaignDir = 'artifacts/campaign/wuyutai-2026summer';
    const sessionMessages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '帮我做吴裕泰2026年夏季营销 campaign 全案',
        timestamp: '2026-06-12T00:00:00.000Z',
      },
      tool('w1', 'write_file', `${campaignDir}/Wuyutai-2026Summer-Brief.docx`),
      tool('w2', 'write_file', `${campaignDir}/platform-content.html`),
      tool('w3', 'write_file', `${campaignDir}/visual-kv-preview.html`),
      tool('w4', 'write_file', `${campaignDir}/Wuyutai-2026Summer-CampaignPlan.md`),
      tool('w5', 'write_file', `${campaignDir}/wuyutai-2026summer-campaign-all-in-one.html`),
      {
        id: 'u2',
        type: 'user',
        content: '继续',
        timestamp: '2026-06-12T00:10:00.000Z',
      },
      tool('w6', 'write_file', `${campaignDir}/index.html`),
    ];
    const turnMessages = sessionMessages.slice(sessionMessages.findIndex((m) => m.id === 'u2'));

    const final = collectTurnFinalDeliverables({
      assistantText: '落地页见 `index.html`',
      toolMessages: turnMessages,
      sessionToolMessages: sessionMessages,
      userGoalText: '吴裕泰2026年夏季营销 campaign 全案',
    });

    expect(final.map((item) => item.path).sort()).toEqual([
      `${campaignDir}/Wuyutai-2026Summer-Brief.docx`,
      `${campaignDir}/Wuyutai-2026Summer-CampaignPlan.md`,
      `${campaignDir}/index.html`,
      `${campaignDir}/platform-content.html`,
      `${campaignDir}/visual-kv-preview.html`,
      `${campaignDir}/wuyutai-2026summer-campaign-all-in-one.html`,
    ]);
  });

  it('carries prior campaign deliverables when a continuation turn only inspects files', () => {
    const campaignDir = 'artifacts/campaign/wuyutai-2026summer';
    const sessionMessages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '帮我做吴裕泰2026年夏季营销 campaign 全案',
        timestamp: '2026-06-12T00:00:00.000Z',
      },
      tool('w1', 'write_file', `${campaignDir}/Wuyutai-2026Summer-CampaignPlan.md`),
      tool('w2', 'write_file', `${campaignDir}/Wuyutai-2026Summer-Brief.docx`),
      tool('w3', 'write_file', `${campaignDir}/visual-kv-preview.html`),
      tool('w4', 'write_file', `${campaignDir}/platform-content.html`),
      tool('w5', 'write_file', `${campaignDir}/wuyutai-2026summer-campaign-all-in-one.html`),
      {
        id: 'u2',
        type: 'user',
        content: '你给我的文件不全啊，你对下最开始的需求表',
        timestamp: '2026-06-12T00:10:00.000Z',
      },
      tool('r1', 'read_file', `${campaignDir}/Wuyutai-2026Summer-CampaignPlan.md`),
    ];
    const turnMessages = sessionMessages.slice(sessionMessages.findIndex((m) => m.id === 'u2'));

    const final = collectTurnFinalDeliverables({
      assistantText: '我来检查现有文件并继续补全。',
      toolMessages: turnMessages,
      sessionToolMessages: sessionMessages,
      userGoalText: '吴裕泰2026年夏季营销 campaign 全案',
    });

    expect(final.map((item) => item.path).sort()).toEqual([
      `${campaignDir}/Wuyutai-2026Summer-Brief.docx`,
      `${campaignDir}/Wuyutai-2026Summer-CampaignPlan.md`,
      `${campaignDir}/platform-content.html`,
      `${campaignDir}/visual-kv-preview.html`,
      `${campaignDir}/wuyutai-2026summer-campaign-all-in-one.html`,
    ]);
  });

  it('drops phantom file:// tool paths and keeps real artifacts html for bare index anchor', () => {
    const designDir = 'artifacts/design/razer-synapse4-ui';
    const toolMessages = [
      {
        id: 'w-phantom',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-22T14:19:51.831Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 'call_0',
        toolInput: JSON.stringify({ file_path: 'file:///home/user/index.html' }),
        toolResult: { isError: false, content: 'failed silently' },
      },
      tool('w-real', 'write_file', `${designDir}/index.html`),
      tool('w-real-2', 'write_file', `${designDir}/index.html`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '界面已生成。\n\n文件路径\nindex.html',
      toolMessages,
      userGoalText: '雷蛇雷云产品全新ui',
    });

    expect(final.map((item) => item.path)).toEqual([`${designDir}/index.html`]);
    expect(final.some((item) => item.path.includes('file://'))).toBe(false);
  });

  it('expands bare index.html anchor to turn artifact dir for razer 2026 landing page', () => {
    const designDir = 'artifacts/design/razer-2026-product-series';
    const toolMessages = [
      tool('w1', 'write_file', `${designDir}/index.html`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: [
        '## ✅ 交付完成 — RAZER 2026 产品系列落地页',
        '',
        '📁 **完整路径**：`index.html`',
      ].join('\n'),
      toolMessages,
      userGoalText: '雷蛇2026产品系列介绍页',
    });

    expect(final).toHaveLength(1);
    expect(final[0].path).toBe(`${designDir}/index.html`);
    expect(final[0].turnArtifactDir).toBe(designDir);
  });

  it('collects schema.jsonld from write_file tool messages', () => {
    const geoDir = 'artifacts/geo/吴裕泰';
    const items = collectTurnAllArtifacts({
      toolMessages: [tool('w4', 'write_file', `${geoDir}/schema.jsonld`)],
    });
    expect(items.map((item) => item.path)).toEqual([`${geoDir}/schema.jsonld`]);
  });

  it('expands GEO campaign dir deliverables when body only anchors the latest file', () => {
    const geoDir = 'artifacts/geo/吴裕泰';
    const sessionToolMessages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '帮【吴裕泰】做品牌 GEO 全案，存 artifacts/geo/【品牌名】/，pd-geo geo-aeo-audit mkt-schema od-data-report',
      },
      tool('w1', 'write_file', `${geoDir}/audit-checklist.md`),
      tool('w2', 'write_file', `${geoDir}/keywords.md`),
      tool('w3', 'write_file', `${geoDir}/optimized.md`),
      tool('w4', 'write_file', `${geoDir}/schema.jsonld`),
    ];
    const toolMessages = [
      tool('w5', 'write_file', `${geoDir}/score-estimate.md`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: 'Phase 6 done. See score-estimate.md',
      toolMessages,
      sessionToolMessages,
      userGoalText: '继续',
      turnArtifactDirOverride: geoDir,
      verifiedPathsOverride: [`${geoDir}/score-estimate.md`],
    });

    expect(final.map((item) => item.path).sort()).toEqual([
      `${geoDir}/audit-checklist.md`,
      `${geoDir}/keywords.md`,
      `${geoDir}/optimized.md`,
      `${geoDir}/schema.jsonld`,
      `${geoDir}/score-estimate.md`,
    ]);
  });

  it('collects last generate_image when body mentions bare filename without anchor', () => {
    const toolMessages = [
      tool('g1', 'generate_image', 'artifacts/media/image-1782643219675.png'),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '图片已生成！交付文件： image-1782643219675.png',
      toolMessages,
      userGoalText: '用「image-generation」帮我：【2026世界杯，韩国出局】',
      capabilitySlug: 'df-image-generation',
    });
    expect(final).toHaveLength(1);
    expect(final[0].path).toContain('image-1782643219675.png');
  });

  it('expands content matrix directory to three markdown deliverables', () => {
    const contentDir = 'artifacts/content-korea-wc-2026';
    const toolMessages = [
      tool('w1', 'write_file', `${contentDir}/01-topics.md`),
      tool('w2', 'write_file', `${contentDir}/02-longform.md`),
      tool('w3', 'write_file', `${contentDir}/03-social-slices.md`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: '三份内容矩阵已生成。',
      toolMessages,
      userGoalText: '用「last30days」帮我：【2026世界杯，韩国出局】',
      capabilitySlug: 'mkt-last30days',
      turnArtifactDirOverride: contentDir,
    });
    expect(final.map((item) => item.path).sort()).toEqual([
      `${contentDir}/01-topics.md`,
      `${contentDir}/02-longform.md`,
      `${contentDir}/03-social-slices.md`,
    ]);
  });
});
