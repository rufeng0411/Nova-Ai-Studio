import type { AlertItem } from '../../shared/types';

export function AlertBar({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) {
    return (
      <div className="info-block">
        <div className="info-label">活跃告警</div>
        <div className="info-value" style={{ color: 'var(--muted)' }}>
          无
        </div>
      </div>
    );
  }

  return (
    <div className="info-block">
      <div className="info-label">活跃告警 ({alerts.length})</div>
      {alerts.map((a) => (
        <div key={a.id} className={`alert ${a.level}`}>
          {a.message}
        </div>
      ))}
    </div>
  );
}
