#!/usr/bin/env node
// PD-SAAS-FORK: smoke validate model pool redundancy config shape
import { validatePilotDeckConfig } from '../ui/server/services/pilotdeckConfig.js';
import { normalizeProviderApiKeySlots, compactStandbyModelSlots } from '../ui/shared/providerApiKeys.mjs';

const sample = {
  agent: { model: 'qwen/qwen-plus' },
  model: {
    providers: {
      qwen: {
        protocol: 'openai',
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: 'k-primary',
        apiKeys: ['k-backup-1', 'k-backup-2', 'k-backup-3'],
        models: { 'qwen-plus': {}, 'qwen-image-plus': { kinds: ['image'] } },
      },
      google: {
        protocol: 'openai',
        url: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIza-primary',
        models: { 'gemini-2.5-flash': {}, 'imagen-3.0-generate-002': { kinds: ['image'] } },
      },
    },
  },
  router: {
    fallback: {
      default: compactStandbyModelSlots([
        'google/gemini-2.5-flash',
        'qwen/qwen-plus',
        '',
        '',
      ]),
    },
  },
  tools: {
    image: {
      provider: 'qwen',
      model: 'qwen-image-plus',
      fallbacks: [{ provider: 'google', model: 'imagen-3.0-generate-002' }],
    },
    video: {
      provider: 'qwen',
      model: 'wanx2.1-t2v-turbo',
      fallbacks: [{ provider: 'google', model: 'veo-2.0-generate-001' }],
    },
    tts: {
      provider: 'qwen',
      model: 'cosyvoice-v3-flash',
      fallbacks: [{ provider: 'qwen', model: 'cosyvoice-v3-plus' }],
    },
    speech: {
      provider: 'qwen',
      model: 'fun-asr',
      fallbacks: [{ provider: 'qwen', model: 'paraformer-v2' }],
    },
    webSearch: {
      provider: 'bocha',
      apiKey: 'bocha-primary',
      fallbacks: [{ provider: 'tavily', apiKey: 'tvly-backup' }],
    },
  },
};

const keys = normalizeProviderApiKeySlots(sample.model.providers.qwen);
if (keys.length !== 4) {
  console.error('FAIL: expected 4 qwen API keys, got', keys.length);
  process.exit(1);
}

const result = validatePilotDeckConfig(sample);
if (!result.valid) {
  console.error('FAIL: config validation errors:', result.errors);
  process.exit(1);
}

console.log('OK: model pool redundancy config validates (4 keys, 2 standby models in chain, tool fallbacks)');
