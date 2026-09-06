import { ipcMain } from 'electron';
function logIpcFailure(supervisor, channel, err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nova-launcher] ${channel}:`, err);
    supervisor.logSystem(`[nova-launcher] 操作未完成: ${msg}`);
}
export function registerIpc(supervisor, healthPoller, getWindow) {
    let healthHistory = [];
    const broadcast = () => {
        const win = getWindow();
        if (!win || win.isDestroyed())
            return;
        const contents = win.webContents;
        if (!contents || contents.isDestroyed())
            return;
        try {
            const snap = supervisor.buildSnapshot();
            snap.healthHistory = healthHistory;
            contents.send('launcher:snapshot', snap);
        }
        catch {
            // window torn down mid-shutdown
        }
    };
    supervisor.subscribe(() => broadcast());
    ipcMain.handle('launcher:getSnapshot', () => {
        try {
            const snap = supervisor.buildSnapshot();
            snap.healthHistory = healthHistory;
            return snap;
        }
        catch (err) {
            logIpcFailure(supervisor, 'getSnapshot', err);
            broadcast();
            return {
                services: [],
                runtime: null,
                healthHistory: [],
                alerts: [],
                logs: [],
                stackRunning: false,
                stackExternal: false,
                stopPgOnShutdown: false,
                lastActionError: err instanceof Error ? err.message : String(err),
                selfCheck: { active: true, message: '正在自检，请稍后…' },
            };
        }
    });
    ipcMain.handle('launcher:startOrRestart', async () => {
        try {
            const result = await supervisor.startOrRestart();
            if (result.ok) {
                healthPoller.start();
            }
            broadcast();
            return result;
        }
        catch (err) {
            logIpcFailure(supervisor, 'startOrRestart', err);
            const msg = err instanceof Error ? err.message : String(err);
            broadcast();
            return { ok: false, error: msg };
        }
    });
    ipcMain.handle('launcher:shutdownAll', async () => {
        try {
            healthPoller.stop();
            healthHistory = [];
            await supervisor.shutdownAll();
            broadcast();
            return { ok: true };
        }
        catch (err) {
            logIpcFailure(supervisor, 'shutdownAll', err);
            broadcast();
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:openBrowser', async () => {
        try {
            await supervisor.openBrowser();
            return { ok: true };
        }
        catch (err) {
            logIpcFailure(supervisor, 'openBrowser', err);
            broadcast();
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:clearLogs', () => {
        try {
            supervisor.clearLogs();
            broadcast();
            return { ok: true };
        }
        catch (err) {
            logIpcFailure(supervisor, 'clearLogs', err);
            broadcast();
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:setLogFilter', (_e, channel) => {
        try {
            supervisor.setLogFilter(channel);
            broadcast();
            return { ok: true };
        }
        catch (err) {
            logIpcFailure(supervisor, 'setLogFilter', err);
            broadcast();
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:windowMinimize', () => {
        try {
            getWindow()?.minimize();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:windowToggleMaximize', () => {
        try {
            const win = getWindow();
            if (!win)
                return { ok: false, error: 'no window' };
            if (win.isMaximized())
                win.unmaximize();
            else
                win.maximize();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    ipcMain.handle('launcher:windowClose', () => {
        try {
            getWindow()?.close();
            return { ok: true };
        }
        catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
    return {
        pushHealthHistory(history) {
            healthHistory = history;
            broadcast();
        },
        broadcast,
    };
}
