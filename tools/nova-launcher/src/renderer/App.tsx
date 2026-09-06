import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LauncherSnapshot, LogChannel } from '../../shared/types';
import { AlertBar } from './components/AlertBar.tsx';
import { HealthCharts } from './components/HealthCharts.tsx';
import { InfoPanel } from './components/InfoPanel.tsx';
import { LogTerminal, type LogTerminalHandle } from './components/LogTerminal.tsx';
import { ServiceGrid } from './components/ServiceGrid.tsx';
import { SelfCheckOverlay } from './components/SelfCheckOverlay.tsx';

const LOG_FILTERS: { id: LogChannel; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'gateway', label: 'GW' },
  { id: 'bridge', label: 'BR' },
  { id: 'vite', label: 'VT' },
  { id: 'infra', label: 'INF' },
];

function PanelChrome({
  index,
  title,
  children,
  noBorder,
}: {
  index: string;
  title: string;
  children: ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div className={`panel${noBorder ? ' panel--last' : ''}`}>
      <div className="panel-head">
        <h2 className="panel-title">
          <span className="panel-index">{index}</span>
          {title}
        </h2>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function App() {
  const [snap, setSnap] = useState<LauncherSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [logFilter, setLogFilter] = useState<LogChannel>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatClock());
  const logTerminalRef = useRef<LogTerminalHandle>(null);

  useEffect(() => {
    void window.launcher
      .getSnapshot()
      .then(setSnap)
      .catch((err) => console.error('[nova-launcher] getSnapshot:', err));
    return window.launcher.onSnapshot(setSnap);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const withBusy = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error('[nova-launcher] 操作失败:', err);
    } finally {
      setBusy(false);
    }
  }, []);

  const onFilter = (ch: LogChannel) => {
    setLogFilter(ch);
    void window.launcher.setLogFilter(ch);
  };

  const onCopyLogs = useCallback(async () => {
    try {
      const result = await logTerminalRef.current?.copyLogs();
      if (result === 'selection') setCopyHint('已复制选中');
      else if (result === 'all') setCopyHint('已复制全部');
      else setCopyHint('暂无日志');
      window.setTimeout(() => setCopyHint(null), 1600);
    } catch (err) {
      console.error('[nova-launcher] 复制失败:', err);
      setCopyHint('复制失败');
      window.setTimeout(() => setCopyHint(null), 1600);
    }
  }, []);

  const running = snap?.stackRunning ?? false;
  const selfCheckActive = snap?.selfCheck?.active ?? true;
  const selfCheckMessage = snap?.selfCheck?.message ?? '正在自检，请稍后…';
  const uiLocked = busy || selfCheckActive;

  return (
    <div className={`app${selfCheckActive ? ' app--self-check' : ''}`}>
      <header className="topbar">
        <div className="topbar-drag">
          <div className="topbar-brand">
            <div className="brand-mark" aria-hidden>
              <span className="brand-glyph">◈</span>
            </div>
            <div className="topbar-title-block">
              <h1>
                Nova Dev Console
                {running && <span className="stack-badge running">运行中</span>}
              </h1>
              <span className="topbar-sub">本地 SaaS 全栈 · 开发监管台</span>
            </div>
          </div>

          <div className="topbar-meta">
            <span className={`meta-pulse${running ? ' live' : ''}`} title={running ? '运行中' : '空闲'}>
              {running ? 'LIVE' : 'IDLE'}
            </span>
            <span className="meta-clock">{clock}</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="primary"
            disabled={uiLocked}
            onClick={() =>
              withBusy(async () => {
                await window.launcher.startOrRestart();
              })
            }
          >
            启动 / 重启
          </button>
          <button
            type="button"
            className="danger"
            disabled={uiLocked || !running}
            onClick={() => withBusy(() => window.launcher.shutdownAll())}
          >
            关闭
          </button>
          <button type="button" disabled={uiLocked || !snap?.runtime} onClick={() => void window.launcher.openBrowser()}>
            浏览器
          </button>
        </div>

        <div className="window-controls">
          <button type="button" className="win-btn" title="最小化" onClick={() => void window.launcher.windowMinimize()}>
            −
          </button>
          <button
            type="button"
            className="win-btn"
            title="最大化"
            onClick={() => void window.launcher.windowToggleMaximize()}
          >
            □
          </button>
          <button type="button" className="win-btn win-btn-close" title="退出" onClick={() => void window.launcher.windowClose()}>
            ×
          </button>
        </div>
      </header>

      {snap?.lastActionError && (
        <div className="action-error-bar" role="alert">
          <span className="action-error-title">启动未完成</span>
          <span className="action-error-msg">{snap.lastActionError}</span>
        </div>
      )}

      <div className="mid">
        <PanelChrome index="01" title="服务状态">
          <ServiceGrid services={snap?.services ?? []} />
        </PanelChrome>
        <PanelChrome index="02" title="健康延迟">
          <HealthCharts history={snap?.healthHistory ?? []} />
        </PanelChrome>
        <PanelChrome index="03" title="运行信息" noBorder>
          <InfoPanel runtime={snap?.runtime ?? null} />
          <AlertBar alerts={snap?.alerts ?? []} />
        </PanelChrome>
      </div>

      <section className="log-section">
        <div className="log-toolbar">
          <h2 className="panel-title">
            <span className="panel-index">04</span>
            日志
          </h2>
          <div className="filter-tabs">
            {LOG_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={logFilter === f.id ? 'active' : ''}
                onClick={() => onFilter(f.id)}
                title={f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button type="button" className="toolbar-btn" onClick={() => void onCopyLogs()} title="有选中则复制选中，否则复制全部">
            复制{copyHint ? ` · ${copyHint}` : ''}
          </button>
          <button type="button" className="toolbar-btn" onClick={() => void window.launcher.clearLogs()}>
            清空
          </button>
          <label className="checkbox-row">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            自动滚动
          </label>
          <div className="log-legend">
            <span className="default">常规</span>
            <span className="info">信息</span>
            <span className="success">成功</span>
            <span className="muted">提示</span>
            <span className="error">错误</span>
          </div>
        </div>
        <LogTerminal ref={logTerminalRef} logs={snap?.logs ?? []} autoScroll={autoScroll} />
      </section>

      {selfCheckActive && <SelfCheckOverlay message={selfCheckMessage} />}
    </div>
  );
}

function formatClock() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
