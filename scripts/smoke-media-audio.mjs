#!/usr/bin/env node
/**
 * Smoke: media audio tools register + config types (no live API).
 */
import { parseToolsConfig } from '../src/pilot/config/parseToolsConfig.js';
import { resolveMediaToolFromModelProviders } from '../src/pilot/config/resolveMediaFromModelProviders.js';
import { createBuiltinRegistry } from '../src/tool/registry/createBuiltinRegistry.js';

const diagnostics = [];
const tools = parseToolsConfig(
  {
    tts: { provider: 'qwen', model: 'cosyvoice-v3-flash' },
    speech: { provider: 'qwen', model: 'fun-asr' },
  },
  diagnostics,
  { DASHSCOPE_API_KEY: 'sk-test' },
);

if (!tools?.tts?.model || !tools?.speech?.model) {
  console.error('FAIL parseToolsConfig tts/speech');
  process.exit(1);
}

const merged = resolveMediaToolFromModelProviders(
  tools.tts,
  {
    qwen: {
      apiKey: 'sk-pool',
      models: { 'cosyvoice-v3-flash': { kinds: ['tts'] } },
    },
  },
  'tts',
  { DASHSCOPE_API_KEY: 'sk-test' },
);

if (!merged?.apiKey || merged.model !== 'cosyvoice-v3-flash') {
  console.error('FAIL resolveMediaToolFromModelProviders tts merge', merged);
  process.exit(1);
}

const registry = createBuiltinRegistry({});
const names = registry.list().map((t) => t.name);
for (const expected of ['generate_speech', 'transcribe_audio', 'generate_video', 'generate_image']) {
  if (!names.includes(expected)) {
    console.error(`FAIL missing builtin tool ${expected}`);
    process.exit(1);
  }
}

console.log('OK parseToolsConfig tts/speech');
console.log('OK resolveMediaToolFromModelProviders');
console.log('OK createBuiltinRegistry audio tools');
console.log('smoke:media-audio passed');
