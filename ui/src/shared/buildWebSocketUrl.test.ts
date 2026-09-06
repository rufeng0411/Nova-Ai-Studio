import { describe, expect, it } from 'vitest';
import { buildWebSocketUrl } from './buildWebSocketUrl';

describe('buildWebSocketUrl', () => {
  it('omits token when local auth is disabled', () => {
    expect(
      buildWebSocketUrl('secret-token', {
        protocol: 'ws:',
        host: '192.168.1.10:5173',
        disableLocalAuth: true,
      }),
    ).toBe('ws://192.168.1.10:5173/ws');
  });

  it('appends encoded token for OSS local auth', () => {
    expect(
      buildWebSocketUrl('tok en+', {
        protocol: 'ws:',
        host: 'localhost:5173',
        disableLocalAuth: false,
        isPlatform: false,
      }),
    ).toBe('ws://localhost:5173/ws?token=tok%20en%2B');
  });

  it('requires token in SaaS mode', () => {
    expect(
      buildWebSocketUrl('saas-jwt', {
        protocol: 'ws:',
        host: 'localhost:5173',
        isSaasMode: true,
      }),
    ).toBe('ws://localhost:5173/ws?token=saas-jwt');
    expect(
      buildWebSocketUrl(null, {
        protocol: 'ws:',
        host: 'localhost:5173',
        isSaasMode: true,
      }),
    ).toBe('ws://localhost:5173/ws');
  });

  it('uses wss when platform mode is on', () => {
    expect(
      buildWebSocketUrl(null, {
        protocol: 'wss:',
        host: 'app.example.com',
        isPlatform: true,
      }),
    ).toBe('wss://app.example.com/ws');
  });
});
