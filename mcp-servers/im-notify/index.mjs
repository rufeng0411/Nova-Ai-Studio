#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Outbound IM notify MCP (WeCom / DingTalk / WhatsApp).
 * stdio JSON-RPC via @modelcontextprotocol/sdk
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  CHANNELS,
  isChannelConfigured,
  listConfiguredChannels,
  sendNotify,
} from './lib/channels.mjs';
import { idempotencyLookup, idempotencyStore } from './lib/resilience.mjs';
import { redactSecrets } from './lib/redact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = new Server(
  { name: 'im-notify', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'notify_channels',
      description: 'List configured outbound notify channels (wecom/dingtalk/whatsapp). No secrets.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'notify_probe',
      description: 'Probe channel config; optional dryRun test send.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: [...CHANNELS] },
          dryRun: { type: 'boolean', default: true },
        },
        required: ['channel'],
        additionalProperties: false,
      },
    },
    {
      name: 'notify_send',
      description: 'Send outbound text notification to wecom/dingtalk/whatsapp.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: [...CHANNELS] },
          text: { type: 'string' },
          title: { type: 'string' },
          to: { type: 'string' },
          format: { type: 'string', enum: ['text', 'markdown'] },
          idempotencyKey: { type: 'string' },
        },
        required: ['channel', 'text'],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    if (name === 'notify_channels') {
      const configured = listConfiguredChannels();
      return textResult({
        channels: CHANNELS.map((id) => ({
          id,
          configured: isChannelConfigured(id),
          enabled: configured.includes(id),
        })),
      });
    }
    if (name === 'notify_probe') {
      const channel = String(args.channel || '');
      if (!CHANNELS.includes(channel)) {
        return textResult({ ok: false, code: 'unknown_channel', channel });
      }
      const configured = isChannelConfigured(channel);
      if (!configured) {
        return textResult({ ok: false, code: 'not_configured', channel });
      }
      const dryRun = args.dryRun !== false;
      if (dryRun) {
        return textResult({ ok: true, channel, configured: true, dryRun: true });
      }
      const sent = await sendNotify(channel, {
        text: 'Nova Ai-Studio 通知通道测试',
        title: '连通性测试',
        format: 'text',
      });
      return textResult(sent);
    }
    if (name === 'notify_send') {
      const channel = String(args.channel || '');
      const idem = typeof args.idempotencyKey === 'string' ? args.idempotencyKey : undefined;
      const cached = idempotencyLookup(idem);
      if (cached.hit) {
        return textResult({ ...(cached.result || {}), idempotentReplay: true });
      }
      const result = await sendNotify(channel, {
        text: String(args.text || ''),
        title: args.title ? String(args.title) : undefined,
        to: args.to ? String(args.to) : undefined,
        format: args.format === 'markdown' ? 'markdown' : 'text',
      });
      if (result.ok) idempotencyStore(idem, result);
      return textResult(result);
    }
    return textResult({ ok: false, code: 'unknown_tool', name });
  } catch (err) {
    return textResult({
      ok: false,
      code: 'internal_error',
      error: redactSecrets(err?.message || String(err)),
    });
  }
});

function textResult(obj) {
  return {
    content: [{ type: 'text', text: redactSecrets(JSON.stringify(obj)) }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Allow importing without starting when tests load helpers
const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(path.resolve(path.join(__dirname, 'index.mjs'))).href;

if (isMain) {
  main().catch((err) => {
    console.error(redactSecrets(err?.stack || String(err)));
    process.exit(1);
  });
}

export { main };
