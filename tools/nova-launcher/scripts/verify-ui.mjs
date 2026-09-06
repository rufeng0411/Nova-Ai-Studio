import { app, BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

app.whenReady().then(async () => {
  process.env.NOVA_REPO_ROOT = resolve(root, '../..');
  process.env.NODE_ENV = 'production';

  const preloadPath = resolve(root, 'dist-preload/preload/index.cjs');
  const htmlPath = resolve(root, 'dist-renderer/index.html');

  if (!existsSync(preloadPath) || !existsSync(htmlPath)) {
    console.error('[verify-ui] missing build output');
    app.exit(1);
    return;
  }

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  let preloadErr = null;
  win.webContents.on('preload-error', (_e, path, err) => {
    preloadErr = `${path}: ${err}`;
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[verify-ui] did-fail-load', code, desc);
  });

  await win.loadFile(htmlPath);
  await new Promise((r) => setTimeout(r, 1500));

  const probe = await win.webContents.executeJavaScript(`
    ({
      launcher: typeof window.launcher,
      hasApp: !!document.querySelector('.app'),
      hasBoot: !!document.querySelector('.boot-screen'),
      hasTopbar: !!document.querySelector('.topbar'),
      title: document.querySelector('.topbar h1')?.textContent?.trim() ?? '',
    })
  `);

  console.log('[verify-ui]', JSON.stringify({ preloadErr, probe }, null, 2));

  const ok =
    !preloadErr &&
    probe.launcher === 'object' &&
    (probe.hasApp || probe.hasBoot) &&
    !probe.title.includes('桥接失败');

  app.exit(ok ? 0 : 1);
});
