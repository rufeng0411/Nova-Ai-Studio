import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), 'card-prompts-pro-20260803.mjs');
let s = fs.readFileSync(p, 'utf8');

const reps = [
  [/为演示品牌/g, '为'],
  [/为演示集团/g, '为集团'],
  [/为演示生活方式品牌/g, '为生活方式品牌'],
  [/为演示运动品牌/g, '为运动品牌'],
  [/为演示社区烘焙/g, '为社区烘焙'],
  [/为演示职场工具/g, '为职场工具'],
  [/为演示新消费/g, '为新消费'],
  [/为演示美妆/g, '为美妆'],
  [/为演示护肤新品/g, '为护肤新品'],
  [/为演示旗舰耳机/g, '为旗舰耳机'],
  [/为演示智能硬件/g, '为智能硬件'],
  [/为演示协作分析 SaaS/g, '为协作分析 SaaS'],
  [/为演示 SaaS/g, '为 SaaS'],
  [/为演示保险科技/g, '为保险科技'],
  [/为演示 DTC/g, '为 DTC'],
  [/为演示 B2B/g, '为 B2B'],
  [/为演示 AI 公司/g, '为 AI 公司'],
  [/为演示 App/g, '为 App'],
  [/为演示零售/g, '为零售'],
  [/为演示小微/g, '为小微'],
  [/为演示科技型小微/g, '为科技型小微'],
  [/对演示品牌/g, '对'],
  [/对演示美妆/g, '对美妆'],
  [/对演示政务/g, '对政务'],
  [/对演示「/g, '对「'],
  [/审查演示美妆/g, '审查美妆'],
  [/为演示「/g, '为「'],
];

for (const [a, b] of reps) s = s.replace(a, b);

const zhBlocks = [...s.matchAll(/zh: `([^`]*)`/g)].map((m) => m[1]);
const leftover = zhBlocks.filter((t) => t.includes('演示'));
console.log('zh leftover 演示:', leftover.length, leftover.map((t) => t.slice(0, 40)));
fs.writeFileSync(p, s);
console.log('samples:');
for (const t of zhBlocks.slice(0, 5)) console.log(' -', t.slice(0, 50));
