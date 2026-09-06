import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  appendDingtalkSign,
  buildDingtalkBody,
  buildDingtalkSign,
  buildWecomBody,
  buildWhatsappBody,
  isChannelConfigured,
  listConfiguredChannels,
  sendNotify,
} from './channels.mjs';
import { resetResilienceForTests } from './resilience.mjs';
import { maskSecret, redactSecrets } from './redact.mjs';

describe('im-notify channels', () => {
  beforeEach(() => {
    resetResilienceForTests();
    delete process.env.WECOM_WEBHOOK_URL;
    delete process.env.DINGTALK_WEBHOOK_URL;
    delete process.env.DINGTALK_SECRET;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_TO;
  });

  it('reports not_configured when env missing', async () => {
    const r = await sendNotify('wecom', { text: 'hi' });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'not_configured');
    assert.deepEqual(listConfiguredChannels(), []);
  });

  it('builds wecom markdown/text payloads', () => {
    assert.deepEqual(buildWecomBody({ text: 'a', format: 'text' }), {
      msgtype: 'text',
      text: { content: 'a' },
    });
    const md = buildWecomBody({ text: 'body', title: 'T', format: 'markdown' });
    assert.equal(md.msgtype, 'markdown');
    assert.match(md.markdown.content, /T/);
  });

  it('builds dingtalk sign deterministically', () => {
    const ts = 1700000000000;
    const sign = buildDingtalkSign('SEC123', ts);
    assert.equal(typeof sign, 'string');
    assert.ok(sign.length > 10);
    const url = appendDingtalkSign('https://oapi.dingtalk.com/robot/send?access_token=abc', 'SEC123');
    assert.match(url, /timestamp=/);
    assert.match(url, /sign=/);
  });

  it('builds dingtalk body', () => {
    const body = buildDingtalkBody({ text: 'hello', title: 'Hi', format: 'text' });
    assert.equal(body.msgtype, 'text');
    assert.match(body.text.content, /hello/);
  });

  it('builds whatsapp plain text (no markdown)', () => {
    const body = buildWhatsappBody('+8613800138000', '**bold** hi');
    assert.equal(body.type, 'text');
    assert.equal(body.text.body, '**bold** hi');
  });

  it('detects configured channels from env', () => {
    process.env.WECOM_WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=x';
    assert.equal(isChannelConfigured('wecom'), true);
    assert.deepEqual(listConfiguredChannels(), ['wecom']);
  });

  it('dryRun succeeds when configured', async () => {
    process.env.DINGTALK_WEBHOOK_URL = 'https://oapi.dingtalk.com/robot/send?access_token=x';
    const r = await sendNotify('dingtalk', { text: 't', dryRun: true });
    assert.equal(r.ok, true);
    assert.equal(r.dryRun, true);
  });

  it('redacts secrets', () => {
    const out = redactSecrets('Bearer sk-secret-token key=abc123access_token=zzz');
    assert.doesNotMatch(out, /sk-secret-token/);
    assert.equal(maskSecret('abcdefghij'), 'ab••••ij');
  });
});
