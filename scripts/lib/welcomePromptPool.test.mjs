import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWelcomePromptResponse,
  loadWelcomePromptPool,
  pickRandomWelcomePrompts,
} from './welcomePromptPool.mjs';

test('welcome prompt pool has at least 30 zh prompts', () => {
  const { prompts } = loadWelcomePromptPool('zh-CN');
  assert.ok(prompts.length >= 30, `expected >=30 prompts, got ${prompts.length}`);
});

test('pickRandomWelcomePrompts returns 5 unique items', () => {
  const { prompts, displayCount } = loadWelcomePromptPool('zh-CN');
  const picked = pickRandomWelcomePrompts(prompts, displayCount, () => 0.42);
  assert.equal(picked.length, displayCount);
  assert.equal(new Set(picked).size, picked.length);
});

test('buildWelcomePromptResponse returns pool metadata', () => {
  const body = buildWelcomePromptResponse('zh-CN', () => 0.1);
  assert.equal(body.displayCount, 5);
  assert.ok(body.poolSize >= 30);
  assert.equal(body.prompts.length, 5);
});
