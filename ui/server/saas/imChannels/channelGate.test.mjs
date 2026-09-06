import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyImChannelEnableGate,
  mergeImChannelPut,
} from './channelGate.mjs';

describe('imChannels gate (bridge)', () => {
  it('forces enabled false when flag off', () => {
    const { adapters, blockedEnable, flag } = applyImChannelEnableGate(
      { wecom: { enabled: true, token: 'bot' } },
      { PILOTDECK_IM_CHANNELS: 'off' },
    );
    assert.equal(flag, 'off');
    assert.ok(blockedEnable.includes('wecom'));
    assert.equal(adapters.wecom.enabled, false);
  });

  it('allows enabled when shadow', () => {
    const { adapters, blockedEnable } = applyImChannelEnableGate(
      { dingtalk: { enabled: true, extra: { clientId: 'a' } } },
      { PILOTDECK_IM_CHANNELS: 'shadow' },
    );
    assert.deepEqual(blockedEnable, []);
    assert.equal(adapters.dingtalk.enabled, true);
  });

  it('preserves secrets when PUT sends mask', () => {
    const { adapters } = mergeImChannelPut(
      { wecom: { enabled: false, token: 'real-bot-id', extra: { secret: 'sec' } } },
      { wecom: { enabled: false, token: '••••', extra: { secret: '••••' } } },
      { PILOTDECK_IM_CHANNELS: 'off' },
    );
    assert.equal(adapters.wecom.token, 'real-bot-id');
    assert.equal(adapters.wecom.extra.secret, 'sec');
  });
});
