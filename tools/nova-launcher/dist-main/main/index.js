import '../../../../scripts/lib/patchHiddenConsole.mjs';
import { app, BrowserWindow, shell } from 'electron';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HealthPoller } from './healthPoller.js';
import { registerIpc } from './ipc.js';
import { findRepoRoot, checkPrerequisites } from './repoRoot.js';
import { ProcessSupervisor } from './supervisor.js';
import { suppressErrorDialogs } from './suppressErrorDialogs.js';
suppressErrorDialogs();
// PD-SAAS-FORK: NODE_OPTIONS 里的 patch import 会导致 Electron 渲染/GPU 崩溃
{
    const raw = String(process.env.NODE_OPTIONS || '').trim();
    if (raw.includes('patchHiddenConsole')) {
        const cleaned = raw
            .split(/\s+/)
            .filter((tok) => tok && !tok.includes('patchHiddenConsole.mjs'))
            .join(' ')
            .trim();
        if (cleaned)
            process.env.NODE_OPTIONS = cleaned;
        else
            delete process.env.NODE_OPTIONS;
    }
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const launcherRoot = resolve(__dirname, '../..');
const launcherPidFile = join(launcherRoot, '.launcher-instance.pid');
function writeLauncherPid() {
    try {
        writeFileSync(launcherPidFile, String(process.pid), 'utf8');
    }
    catch {
        // ignore
    }
}
function clearLauncherPid() {
    try {
        if (existsSync(launcherPidFile))
            unlinkSync(launcherPidFile);
    }
    catch {
        // ignore
    }
}
let mainWindow = null;
let supervisor = null;
async function createWindow() {
    let repoRoot;
    try {
        repoRoot = findRepoRoot();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[nova-launcher]', msg);
        repoRoot = process.cwd();
    }
    supervisor = new ProcessSupervisor(repoRoot);
    const preloadPath = resolve(__dirname, '../../dist-preload/preload/index.cjs');
    if (!existsSync(preloadPath)) {
        console.error('[nova-launcher] preload 缺失，请重新运行 npm run launcher:', preloadPath);
    }
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: '#050505',
        title: 'Nova Dev Console',
        frame: false,
        show: false,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    mainWindow.setMenuBarVisibility(false);
    let ipcApi;
    const healthPoller = new HealthPoller(supervisor, (history) => {
        ipcApi.pushHealthHistory(history);
    });
    ipcApi = registerIpc(supervisor, healthPoller, () => mainWindow);
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        writeLauncherPid();
    });
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
        console.error('[nova-launcher] 页面加载失败:', code, desc, url);
    });
    mainWindow.webContents.on('preload-error', (_e, failedPath, error) => {
        console.error('[nova-launcher] preload 加载失败:', failedPath, error);
    });
    if (isDev) {
        await mainWindow.loadURL('http://127.0.0.1:5199');
    }
    else {
        await mainWindow.loadFile(join(__dirname, '../../dist-renderer/index.html'));
    }
    void (async () => {
        try {
            await supervisor.init();
            const prereq = checkPrerequisites(repoRoot);
            for (const msg of prereq.messages) {
                supervisor.logSystem(`[nova-launcher] ${msg}`);
            }
            healthPoller.start();
            ipcApi.broadcast();
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            supervisor.logSystem(`[nova-launcher] 初始化失败: ${msg}`);
            ipcApi.broadcast();
        }
    })();
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => {
        healthPoller.stop();
        if (supervisor?.isManagedByLauncher()) {
            void supervisor.shutdownAll();
        }
        mainWindow = null;
        supervisor = null;
    });
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
}
else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
    app.whenReady().then(() => {
        void createWindow().catch((err) => {
            console.error('[nova-launcher] 窗口创建失败:', err);
        });
    });
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin')
            app.quit();
    });
    app.on('will-quit', () => {
        clearLauncherPid();
    });
    app.on('before-quit', () => {
        if (supervisor?.isManagedByLauncher()) {
            void supervisor.shutdownAll();
        }
    });
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            void createWindow();
    });
}
