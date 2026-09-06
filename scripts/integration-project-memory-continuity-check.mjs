/**
 * PD-SAAS-FORK: project memory continuity helper checks (no LLM).
 *   npx tsx scripts/integration-project-memory-continuity-check.mjs
 */
import assert from 'node:assert/strict';
import {
  isUserOptOutMemoryText,
  isProjectContinuityEffective,
} from '../src/saas/projectContinuity.ts';
import { normalizeMessages } from '../src/context/memory/edgeclaw-memory-core/lib/message-utils.js';

let passed = 0;
function ok(label) { passed += 1; console.log(`  ok ${label}`); }

assert.equal(isUserOptOutMemoryText('不要记入记忆'), true);
assert.equal(isUserOptOutMemoryText('帮我做竞品调研'), false);
ok('opt-out phrase detection');

assert.equal(isProjectContinuityEffective({ enabled: true, provider: 'edgeclaw', captureStrategy: 'last_turn', includeAssistant: true }), true);
assert.equal(
  isProjectContinuityEffective(
    { enabled: true, provider: 'edgeclaw', captureStrategy: 'last_turn', includeAssistant: true, projectContinuity: { enabled: false } },
  ),
  false,
);
assert.equal(
  isProjectContinuityEffective(
    { enabled: true, provider: 'edgeclaw', captureStrategy: 'last_turn', includeAssistant: true },
    false,
  ),
  false,
);
ok('project continuity effective gate');

const recoveryUser = {
  role: 'user',
  content: [{
    type: 'text',
    text: 'Several tools failed in a row. Stop retrying the same approach. For product/landing pages with official images: use fetch_page_images on the brand product URL (or web_fetch as fallback), then write_file the HTML. Do not use web_search for image CDN URLs or bash curl/grep. Deliver the HTML file path when done. Failed tools: bash.',
  }],
};
const realUser = {
  role: 'user',
  content: [{ type: 'text', text: '请帮我做 ROG 竞品调研' }],
};
const assistant = {
  role: 'assistant',
  content: [{ type: 'text', text: '已完成竞品调研报告。' }],
};
const normalized = normalizeMessages([realUser, assistant, recoveryUser], {
  includeAssistant: true,
  maxMessageChars: 6000,
  captureStrategy: 'last_turn',
});
assert.equal(normalized.length, 2);
assert.equal(normalized[0]?.role, 'user');
assert.match(normalized[0]?.content ?? '', /ROG/);
ok('last_turn skips recovery bubble and keeps anchor user');

console.log(`\n[project-memory-continuity-check] all ${passed} checks passed.`);
