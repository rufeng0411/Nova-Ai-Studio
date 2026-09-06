import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  isSaasOssConfigured,
  localPathToOssObjectKey,
  readSaasOssConfig,
} from './ossConfig.js';

describe('ossConfig', () => {
  it('maps DATA_ROOT paths to prefixed OSS keys', () => {
    const env = {
      DATA_ROOT: '/data/saas',
      SAAS_OSS_PREFIX: 'nova-user-files',
    };
    const abs = path.join('/data/saas/tenants/default/cloud-storage/users/1/workspaces/uuid/artifacts/a.pptx');
    assert.equal(
      localPathToOssObjectKey(abs, env),
      'nova-user-files/tenants/default/cloud-storage/users/1/workspaces/uuid/artifacts/a.pptx',
    );
  });

  it('rejects paths outside DATA_ROOT', () => {
    const env = { DATA_ROOT: '/data/saas', SAAS_OSS_PREFIX: 'nova-user-files' };
    assert.equal(localPathToOssObjectKey('/etc/passwd', env), null);
  });

  it('requires bucket and credentials when configured', () => {
    assert.equal(
      isSaasOssConfigured({
        SAAS_OSS_BUCKET: 'nova-2-oss-0622',
        SAAS_OSS_ACCESS_KEY_ID: 'id',
        SAAS_OSS_ACCESS_KEY_SECRET: 'secret',
      }),
      true,
    );
    assert.equal(isSaasOssConfigured({ SAAS_OSS_BUCKET: 'nova-2-oss-0622' }), false);
  });

  it('defaults endpoint to beijing', () => {
    const cfg = readSaasOssConfig({});
    assert.equal(cfg.endpoint, 'oss-cn-beijing.aliyuncs.com');
    assert.equal(cfg.prefix, 'nova-user-files');
  });
});
