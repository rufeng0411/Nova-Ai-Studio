#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const script = `
import sys
sys.path.insert(0, ${JSON.stringify(path.join(root, 'scripts', 'editable_export').replace(/\\/g, '/'))})
from dedupe_elements import dedupe_text_elements

els = [
  {'text': 'ROG 竞品调研', 'bbox': [100, 50, 400, 120], 'source': 'mineru', 'type': 'title'},
  {'text': 'ROG竞品调研', 'bbox': [105, 55, 395, 115], 'source': 'baidu', 'type': 'text'},
  {'text': '副标题', 'bbox': [100, 140, 300, 180], 'source': 'baidu'},
]
out = dedupe_text_elements(els)
assert len(out) == 2, len(out)
texts = sorted(e['text'] for e in out)
assert '副标题' in texts
print('ok', texts)
`;
const r = spawnSync('python', ['-c', script], { encoding: 'utf8' });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log('[dedupe_elements.test]', (r.stdout || '').trim());
