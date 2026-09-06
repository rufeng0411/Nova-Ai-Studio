import { execSync } from './childProcess.js';
import { existsSync } from 'node:fs';
/** Win32 CREATE_NO_WINDOW — 与 scripts/lib/patchHiddenConsole.mjs 保持一致 */
const CREATE_NO_WINDOW = 0x08000000;
/** 与 patchHiddenConsole.mergeHidden 一致：windowsHide + CREATE_NO_WINDOW */
export function withHiddenConsole(options) {
    if (process.platform !== 'win32')
        return options;
    const base = { ...options };
    if (base.allowGuiWindow) {
        const next = { ...base, windowsHide: false };
        delete next.allowGuiWindow;
        return next;
    }
    const next = { ...base, windowsHide: base.windowsHide ?? true };
    next.creationFlags = (next.creationFlags ?? 0) | CREATE_NO_WINDOW;
    if (next.detached !== true) {
        next.detached = false;
    }
    return next;
}
/**
 * Electron 的 process.execPath 指向 electron.exe，不能用来跑 Node 子进程。
 */
export function resolveNodeBin() {
    const candidates = [
        process.env.npm_node_execpath?.trim(),
        process.env.NODE?.trim(),
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    try {
        const cmd = process.platform === 'win32' ? 'where.exe node' : 'which node';
        const out = execSync(cmd, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const first = out.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim();
        if (first && existsSync(first))
            return first;
    }
    catch {
        // PATH lookup failed
    }
    return process.platform === 'win32' ? 'node.exe' : 'node';
}
export function resolveNpmBin() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}
