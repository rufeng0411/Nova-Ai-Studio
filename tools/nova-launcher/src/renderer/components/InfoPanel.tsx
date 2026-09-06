import type { RuntimeInfo } from '../../shared/types';

export function InfoPanel({ runtime }: { runtime: RuntimeInfo | null }) {
  if (!runtime) {
    return (
      <div className="info-empty">
        尚未启动全栈
        <p className="info-hint">点击顶栏「启动 / 重启」一键拉起 Gateway · Bridge · Vite</p>
      </div>
    );
  }

  return (
    <div className="info-grid">
      <div className="info-block">
        <div className="info-label">模式</div>
        <div className="info-value">SaaS 本地开发</div>
      </div>
      <div className="info-block">
        <div className="info-label">端口</div>
        <div className="info-value info-value--mono">
          <span>Bridge {runtime.ports.server}</span>
          <span>Gateway {runtime.ports.gateway}</span>
          <span>Vite {runtime.ports.vite}</span>
        </div>
      </div>
      <div className="info-block">
        <div className="info-label">本机访问</div>
        <div className="info-value">
          <a href={runtime.viteUrl}>{runtime.viteUrl}</a>
        </div>
      </div>
      {runtime.lanUrls.slice(1).map((u) => (
        <div key={u.label} className="info-block">
          <div className="info-label">{u.label}</div>
          <div className="info-value">
            <a href={u.vite}>{u.vite}</a>
          </div>
        </div>
      ))}
      <div className="info-block">
        <div className="info-label">数据目录</div>
        <div className="info-value info-value--path">{runtime.dataRoot}</div>
      </div>
      <div className="info-block">
        <div className="info-label">控制库</div>
        <div className="info-value">{runtime.dbBackend}</div>
      </div>
      <div className="info-block">
        <div className="info-label">Gateway</div>
        <div className="info-value info-value--path">{runtime.gatewayUrl}</div>
      </div>
      <div className="info-block">
        <div className="info-label">默认账号</div>
        <div className="info-value">admin / SAAS_ADMIN_PASSWORD</div>
      </div>
    </div>
  );
}
