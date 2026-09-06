import type { ServiceState, ServiceStatus } from '../../shared/types';

const DISPLAY_ORDER = ['gateway', 'bridge', 'vite', 'redis', 'postgres', 'bridgeGateway'];

const STATUS_LABEL: Record<ServiceStatus, string> = {
  running: '运行',
  starting: '启动',
  degraded: '降级',
  error: '异常',
  stopped: '停止',
};

export function ServiceGrid({ services }: { services: ServiceState[] }) {
  const sorted = [...services].sort(
    (a, b) => DISPLAY_ORDER.indexOf(a.id) - DISPLAY_ORDER.indexOf(b.id),
  );

  if (sorted.length === 0) {
    return <div className="info-empty">等待服务探测…</div>;
  }

  return (
    <div className="service-list">
      {sorted.map((svc) => (
        <div key={svc.id} className="service-row">
          <div className={`led ${svc.status}`} title={svc.status} aria-hidden />
          <div className="service-main">
            <div className="service-name-row">
              <span className="service-name">{svc.label}</span>
              <span className={`status-chip ${svc.status}`}>{STATUS_LABEL[svc.status]}</span>
            </div>
            <div className="service-detail">{svc.detail}</div>
          </div>
          <span className="service-port">{svc.port ? `:${svc.port}` : '—'}</span>
        </div>
      ))}
    </div>
  );
}
