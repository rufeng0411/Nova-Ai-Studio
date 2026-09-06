import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from 'xterm';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { LogEntry } from '../../shared/types';
import { TERMINAL_TOKENS } from '../styles/tokens';
import 'xterm/css/xterm.css';

const LEVEL_FG: Record<LogEntry['level'], string> = {
  default: TERMINAL_TOKENS.logDefault,
  info: TERMINAL_TOKENS.logInfo,
  success: TERMINAL_TOKENS.logSuccess,
  muted: TERMINAL_TOKENS.logMuted,
  error: TERMINAL_TOKENS.logError,
};

export type LogTerminalHandle = {
  /** 有选中则复制选中，否则复制全部日志 */
  copyLogs: () => Promise<'selection' | 'all' | 'empty'>;
};

export const LogTerminal = forwardRef<
  LogTerminalHandle,
  {
    logs: LogEntry[];
    autoScroll: boolean;
  }
>(function LogTerminal({ logs, autoScroll }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastIdRef = useRef(0);
  const logsRef = useRef(logs);
  logsRef.current = logs;

  useImperativeHandle(ref, () => ({
    async copyLogs() {
      const term = termRef.current;
      const selection = term?.getSelection()?.trim() ?? '';
      if (selection) {
        await writeClipboard(selection);
        return 'selection';
      }
      const all = logsRef.current.map((e) => stripAnsi(e.line)).join('\n').trim();
      if (!all) return 'empty';
      await writeClipboard(all);
      return 'all';
    },
  }));

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background: TERMINAL_TOKENS.bgInset,
        foreground: TERMINAL_TOKENS.textPrimary,
        cursor: TERMINAL_TOKENS.textGhost,
        selectionBackground: 'rgba(200, 208, 216, 0.28)',
        selectionForeground: TERMINAL_TOKENS.textPrimary,
      },
      fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 11,
      lineHeight: 1.42,
      letterSpacing: 0,
      cursorBlink: false,
      disableStdin: true,
      convertEol: true,
      scrollback: 8000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.attachCustomKeyEventHandler((event) => {
      const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
      if (!isCopy || event.type !== 'keydown') return true;
      const selected = term.getSelection();
      if (!selected) return true;
      void writeClipboard(selected);
      return false;
    });

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);

    const container = containerRef.current;
    const onContextMenu = (event: MouseEvent) => {
      const selected = term.getSelection()?.trim();
      if (!selected) return;
      event.preventDefault();
      void writeClipboard(selected);
    };
    container.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('resize', onResize);
      container.removeEventListener('contextmenu', onContextMenu);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const fresh = logs.filter((l) => l.id > lastIdRef.current);
    if (logs.length > 0 && logs[logs.length - 1]!.id < lastIdRef.current) {
      term.clear();
      lastIdRef.current = 0;
      for (const entry of logs) {
        writeEntry(term, entry);
        lastIdRef.current = entry.id;
      }
      return;
    }

    for (const entry of fresh) {
      writeEntry(term, entry);
      lastIdRef.current = entry.id;
    }

    if (autoScroll) {
      requestAnimationFrame(() => term.scrollToBottom());
    }
  }, [logs, autoScroll]);

  return <div className="log-terminal-wrap" ref={containerRef} title="拖选后 Ctrl+C 或右键复制" />;
});

function writeEntry(term: Terminal, entry: LogEntry) {
  const color = LEVEL_FG[entry.level];
  term.writeln(`\x1b[38;2;${hexRgb(color)}m${stripAnsi(entry.line)}\x1b[0m`);
}

async function writeClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

function hexRgb(hex: string) {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `${r};${g};${b}`;
}

function stripAnsi(line: string) {
  return line.replace(/\x1b\[[0-9;]*m/g, '');
}
