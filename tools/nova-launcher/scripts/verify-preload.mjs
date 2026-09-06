import { app, BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.whenReady().then(async () => {
  const preloadPath = resolve(__dirname, '../dist-preload/preload/index.cjs');
  if (!existsSync(preloadPath)) {
    console.error('MISSING', preloadPath);
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
  win.webContents.on('preload-error', (_e, _path, err) => {
    preloadErr = err;
  });

  await win.loadFile(resolve(__dirname, '../dist-renderer/index.html'));
  const launcherType = await win.webContents.executeJavaScript('typeof window.launcher');
  console.log('preload-error:', preloadErr ?? 'none');
  console.log('window.launcher:', launcherType);
  app.exit(launcherType === 'object' ? 0 : 1);
});
