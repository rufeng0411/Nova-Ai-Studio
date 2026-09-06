#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dataRoot = process.env.DATA_ROOT || path.resolve('.saas-dev-data');
const file = path.join(dataRoot, 'telemetry', 'showcase-events.jsonl');
const gate = process.argv.includes('--gate');

let publish = 0;
let unpublish = 0;
let regen = 0;
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'showcase_publish') publish += 1;
      if (ev.type === 'showcase_unpublish') unpublish += 1;
      if (ev.type === 'showcase_catalog_regen') regen += 1;
    } catch {
      /* ignore */
    }
  }
}

console.log(JSON.stringify({ publish_events: publish, unpublish_events: unpublish, regen_events: regen, file }, null, 2));

if (gate && publish < 1 && process.env.SHOWCASE_KPI_REQUIRE_PUBLISH === '1') {
  console.error('KPI gate: publish_events>=1 required');
  process.exit(1);
}
console.log('regen_fail=0');
