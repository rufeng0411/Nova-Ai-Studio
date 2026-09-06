import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSaasAuthToken, fetchGeneralWorkspaceCwd } from './resolveGeneralWorkspaceCwd.mjs';

test('fetchSaasAuthToken reads token from login response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:3001/api/auth/login');
    assert.equal(init.method, 'POST');
    return {
      ok: true,
      async json() {
        return { token: 'jwt-token' };
      },
    };
  };
  try {
    assert.equal(await fetchSaasAuthToken('http://127.0.0.1:3001'), 'jwt-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchGeneralWorkspaceCwd resolves general project root from API', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'http://127.0.0.1:3001/api/projects?fresh=1');
    assert.equal(init.headers.Authorization, 'Bearer jwt-token');
    return {
      ok: true,
      async json() {
        return {
          projects: [
            { name: 'other', fullPath: 'x' },
            { name: 'general', fullPath: 'F:/Ai-pilotdeck/.saas-dev-data/general-workspace' },
          ],
        };
      },
    };
  };
  try {
    const cwd = await fetchGeneralWorkspaceCwd('http://127.0.0.1:3001', 'jwt-token');
    assert.equal(cwd, 'F:/Ai-pilotdeck/.saas-dev-data/general-workspace');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
