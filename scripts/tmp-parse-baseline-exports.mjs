#!/usr/bin/env node
import fs from 'node:fs';

const files = [
  ['黑袍(修复前)', 'C:/Users/rufen/Downloads/web-s_df88ec55-9743-495a-ad0f-968c72fee9__写一篇【黑袍纠察队】深度长文，再 humanize 成五平台口吻，写入系统分配任务目录，直接开始做，-2026-07-26.html'],
  ['GEO(修复前)', 'C:/Users/rufen/Downloads/web-s_56d77e6e-75cd-4c5f-bf86-9412a75fc5__帮【www.novapage.online】做品牌 GEO 全案，按阶段一次执行，存 系统分配的任务-2026-07-26.html'],
  ['matrix(修复后)', 'C:/Users/rufen/Downloads/web-s_2d47bc14-5b94-4872-9d7b-c617a10092__写一篇【www.novapage.online】深度长文，再 humanize 成五平台口吻，写入系-2026-07-26.html'],
];

for (const [label, p] of files) {
  if (!fs.existsSync(p)) {
    console.log(JSON.stringify({ label, error: 'missing' }));
    continue;
  }
  const t = fs.readFileSync(p, 'utf8');
  const times = [...t.matchAll(/datetime="(2026-07-26[^"]+)"/g)].map((m) => m[1]);
  const firstWrite = t.match(/工具调用: write_file[\s\S]{0,500}?datetime="([^"]+)"/);
  const firstAgent = t.match(/工具调用: agent[\s\S]{0,200}?datetime="([^"]+)"/);
  const lastAccept = [...t.matchAll(/"acceptanceStatus": "(passed|needs_repair|failed)"/g)].pop();
  const progress = t.match(/data-progress-done="(\d+)" data-progress-total="(\d+)"/g)?.pop();
  console.log(JSON.stringify({
    label,
    msgs: (t.match(/class="message role-/g) || []).length,
    agent: (t.match(/工具调用: agent/g) || []).length,
    repair: (t.match(/deliverable_repair|needs_repair/g) || []).length,
    tmp: (t.match(/tmp_workspace/g) || []).length,
    wf: (t.match(/工具调用: write_file/g) || []).length,
    userStart: times[0],
    lastMsg: times.at(-1),
    firstWrite: firstWrite?.[1] ?? null,
    firstAgent: firstAgent?.[1] ?? null,
    lastAcceptance: lastAccept?.[1] ?? null,
    footer: progress ?? null,
    wallMin: times.length >= 2 ? Math.round((Date.parse(times.at(-1)) - Date.parse(times[0])) / 60000) : null,
  }, null, 0));
  console.log('---');
}
