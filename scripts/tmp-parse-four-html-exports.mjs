import fs from 'node:fs';

const cases = [
  { label: 'campaign全案', path: 'c:/Users/rufen/Downloads/web-s_722c99f8-23b6-43cb-8714-d82f3773d6__帮我做【www.novapage.online】的品牌传播 campaign 全案，按阶段一次规划执-2026-07-26.html' },
  { label: 'matrix长文', path: 'c:/Users/rufen/Downloads/web-s_2d47bc14-5b94-4872-9d7b-c617a10092__写一篇【www.novapage.online】深度长文，再 humanize 成五平台口吻，写入系-2026-07-26.html' },
  { label: '上市全案', path: 'c:/Users/rufen/Downloads/web-s_6486d64b-b44b-44ff-851a-ade2b9bdeb__帮我为【www.novapage.online】做一套上市全案，按以下阶段一次性规划并执行，每阶段产-2026-07-26.html' },
  { label: '海绵宝宝竞品', path: 'c:/Users/rufen/Downloads/web-s_9c325c21-0b7d-4356-9c95-d953dc3686__用「Nova-竞品对标」对【海绵宝宝】做竞品全量对标：竞品清单、维度对比与突围策略。须交付：comp-2026-07-26.html' },
];

function parseCase({ label, path }) {
  const html = fs.readFileSync(path, 'utf8');
  const sid = html.match(/data-session-id="([^"]+)"/)?.[1];
  const exported = html.match(/nova-exported-at" content="([^"]+)"/)?.[1];
  const repair = (html.match(/deliverable_repair/gi) ?? []).length;
  const tmp = (html.match(/tmp_workspace/gi) ?? []).length;
  const agentTool = (html.match(/工具调用: agent/g) ?? []).length;
  const writeFile = (html.match(/工具调用: write_file/g) ?? []).length;
  const messages = (html.match(/class="message /g) ?? []).length;
  const taskDir = [...html.matchAll(/taskArtifactDir&quot;: &quot;(artifacts\/task-[^&]+)/g)].pop()?.[1];

  const accBlocks = [...html.matchAll(/&quot;acceptanceStatus&quot;: &quot;([^&]+)&quot;[\s\S]{0,1200}?&quot;complete&quot;: (true|false)/g)];
  const lastAcc = accBlocks.at(-1);

  const slotBlocks = [...html.matchAll(/&quot;slots&quot;: \[([\s\S]*?)\],\s*\n\s*&quot;profileId/g)];
  const lastSlots = slotBlocks.at(-1)?.[1] ?? '';
  const slotCount = (lastSlots.match(/&quot;id&quot;/g) ?? []).length;
  const resolvedCount = (lastSlots.match(/&quot;resolvedPath&quot;/g) ?? []).length;
  const flywheel = (lastSlots.match(/01-topics|02-longform|03-social-slices/gi) ?? []).length;
  const extraSlots = [];
  if (/research-report\.docx/.test(lastSlots)) extraSlots.push('research-report.docx phantom');
  if (/campaign-brief\.docx\.md/.test(html)) extraSlots.push('brief as .docx.md');
  if (/nova-kv-placeholder\.svg/.test(lastSlots)) extraSlots.push('kv placeholder svg not png');
  if (/research\.docx/.test(lastSlots) && label === '上市全案') extraSlots.push('research.docx phantom');

  const writeIdx = html.indexOf('工具调用: write_file');
  const firstWriteChunk = writeIdx >= 0 ? html.slice(Math.max(0, writeIdx - 800), writeIdx + 100) : '';
  const timeMatches = [...firstWriteChunk.matchAll(/<time[^>]*>([^<]+)<\/time>/g)];
  const firstWriteTime = timeMatches.at(-1)?.[1] ?? 'n/a';
  const userTime = html.match(/role-user[\s\S]*?<time[^>]*>([^<]+)<\/time>/)?.[1];

  const summaryTable = html.match(/成果清单|deliverable-summary|已交付|校验中|未完成/g) ?? [];
  const bodyComplete = /全部交付|已完成|可以查收|任务完成|passed/i.test(html.slice(-8000));

  return {
    label,
    sid,
    exported,
    taskDir,
    messages,
    writeFileCalls: writeFile,
    agentCalls: agentTool,
    repairMentions: repair,
    tmpWorkspace: tmp,
    slotCount,
    resolvedSlots: resolvedCount,
    flywheelPhantom: flywheel,
    extraSlotIssues: extraSlots,
    lastAcceptance: lastAcc ? { status: lastAcc[1], complete: lastAcc[2] } : null,
    userStartTime: userTime,
    firstWriteTime,
    bodyClaimsComplete: bodyComplete,
  };
}

for (const c of cases) {
  console.log(JSON.stringify(parseCase(c), null, 2));
  console.log('---');
}
