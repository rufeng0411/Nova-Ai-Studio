/** 启动器日志：丢弃或降级非致命噪音，避免终端满屏红字 */
const SKIP_PATTERNS = [
    /dockerDesktopLinuxEngine/i,
    /error during connect.*docker/i,
    /open \/\/\.\/pipe\/docker/i,
    /Electron Security Warning/i,
    /Insecure Content-Security-Policy/i,
    /ExperimentalWarning/i,
    /^npm warn /i,
];
const MUTED_PATTERNS = [
    /docker\s*(desktop|不可用)/i,
    /PostgreSQL 未启动/i,
    /SQLite 回退/i,
    /内存缓存兜底/i,
    /cannot find the file specified/i,
    /gateway connect failed/i,
    /compose.*down/i,
    /DEP\d{4}/i,
    /\[redis\] cache(Get|Set) failed/i,
    /using memory fallback/i,
];
export function shouldSkipLogLine(line) {
    const text = line.trim();
    if (!text)
        return true;
    return SKIP_PATTERNS.some((p) => p.test(text));
}
export function adjustLogLevel(line, level, opts) {
    const text = line.trim();
    if (opts.booting && /gateway connect failed/i.test(text))
        return 'muted';
    if (opts.shuttingDown && /exit code|进程退出|signal/i.test(text))
        return 'muted';
    if (MUTED_PATTERNS.some((p) => p.test(text)))
        return 'muted';
    if (/^\[nova-launcher\].*失败/.test(text))
        return 'muted';
    return level;
}
