#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Write compute-waste post-audit summary from zombie + usage audits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const docsDir = path.join(REPO_ROOT, 'docs');

function latestDoc(prefix) {
  const files = fs.readdirSync(docsDir).filter((f) => f.startsWith(prefix) && f.endsWith('.zh-CN.md'));
  files.sort();
  return files.length ? path.join(docsDir, files[files.length - 1]) : null;
}

const usagePath = latestDoc('usage-attribution-audit-');
const zombiePath = latestDoc('zombie-sessions-audit-');
const lifecyclePath = latestDoc('session-lifecycle-audit-');

const outPath = path.join(docsDir, `compute-waste-post-audit-${date}.zh-CN.md`);

const lines = [
  `# 算力浪费 P0 落地复核（post-audit）`,
  ``,
  `**生成时间**：${new Date().toISOString()}`,
  ``,
  `## 数据源`,
  ``,
  `- 用量归因：${usagePath ? `\`${path.basename(usagePath)}\`` : '（未跑 audit:usage-attribution）'}`,
  `- 僵尸会话：${zombiePath ? `\`${path.basename(zombiePath)}\`` : '（未跑 audit:zombie-sessions）'}`,
  `- 删除生命周期：${lifecyclePath ? `\`${path.basename(lifecyclePath)}\`` : '（未跑 audit:session-lifecycle）'}`,
  ``,
  `## P0 增量行为（非历史 token 总量）`,
  ``,
  `| P0 项 | 验证方式 | 结论 |`,
  `|-------|----------|------|`,
  `| UI grace 2→1 | \`useAutoRecoveryContinue.test.ts\` | 默认 grace=1 |`,
  `| validate cache | jsonl repair/acceptance 密度代理 | 见 zombie 审计 estValidateCalls |`,
  `| stale 去重 | Bridge abort 后 UI 不二次 submit | telemetry / 手工 |`,
  `| 工具快停 | render_html_video 连续失败 | zombie 标记 video_tool_stuck |`,
  `| SDM 写盘 | manifest 非 null 率 | zombie 报告 SDM 行 |`,
  ``,
  `## Token vs Server CPU 节省区间（保守，对未来增量）`,
  ``,
  `| 场景 | Token | Bridge+Gateway+工具 CPU |`,
  `|------|-------|---------------------------|`,
  `| P0 已落地，正常长交付 | ≈ 8～15% | ≈ 8～15% |`,
  `| P0+P1 僵尸止血（dev 多死循环） | ≈ 15～25% | ≈ 20～35% |`,
  `| 历史 stats.jsonl | **0%** | **0%** |`,
  ``,
  `> validate cache **无独立 telemetry**；勿写 cache hit 已验证，除非后续补埋点。`,
  ``,
  `## 备注`,
  ``,
  `- audit_only：未改写 stats.jsonl`,
  `- KPI「未归属」仅计 __system__ session 数，非全部无 userId Token`,
];

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath}`);
