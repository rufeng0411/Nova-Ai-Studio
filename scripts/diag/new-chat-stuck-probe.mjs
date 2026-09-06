#!/usr/bin/env node
import { connectGateway, newSession, submitTurn } from '../lib/gatewaySessionHarness.mjs';

const ws = await connectGateway();
const sessionKey = await newSession(ws, 'general');
console.log('[probe] session', sessionKey);
const result = await submitTurn(ws, {
  sessionKey,
  message: '你好，只回复两个字：收到',
  projectKey: 'general',
  timeoutMs: 120_000,
  tag: 'stuck-probe',
});
console.log('[probe] result', JSON.stringify(result, null, 2));
ws.close();
process.exit(result.ok ? 0 : 1);
