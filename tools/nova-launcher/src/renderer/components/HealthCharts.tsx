import type { HealthSample } from '../../shared/types';
import { TERMINAL_TOKENS } from '../styles/tokens';

function Sparkline({
  label,
  values,
  latest,
}: {
  label: string;
  values: Array<number | null>;
  latest: number | null;
}) {
  const width = 400;
  const height = 52;
  const padX = 4;
  const padY = 6;
  const nums = values.filter((v): v is number => v != null);
  const max = Math.max(500, ...nums, 1);
  const slow = latest != null && latest > 500;

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = values
    .map((v, i) => {
      if (v == null) return null;
      const x = padX + (i / Math.max(values.length - 1, 1)) * innerW;
      const y = padY + innerH - (v / max) * innerH;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');

  const areaPoints =
    points.length > 0
      ? `${padX},${height - padY} ${points} ${padX + innerW},${height - padY}`
      : '';

  const pointPairs = points ? points.split(' ') : [];
  const lastPoint = pointPairs[pointPairs.length - 1];
  const [lastX, lastY] = lastPoint?.split(',').map(Number) ?? [null, null];

  const gridLines = [0.25, 0.5, 0.75].map((ratio) => {
    const y = padY + innerH * (1 - ratio);
    return (
      <line
        key={ratio}
        x1={padX}
        y1={y}
        x2={width - padX}
        y2={y}
        stroke={TERMINAL_TOKENS.chartGrid}
        strokeWidth="1"
      />
    );
  });

  return (
    <div className="chart-block">
      <div className="chart-label">
        <span>{label}</span>
        <span className={`chart-value${slow ? ' slow' : ''}`}>
          {latest != null ? `${latest} ms` : '—'}
        </span>
      </div>
      <div className="chart-frame">
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {gridLines}
          {areaPoints && (
            <polygon
              points={areaPoints}
              fill="rgba(184, 196, 204, 0.05)"
              stroke="none"
            />
          )}
          <polyline
            fill="none"
            stroke={TERMINAL_TOKENS.chartLine}
            strokeWidth="1.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            points={points}
            opacity={points ? 0.9 : 0.12}
          />
          {lastX != null && lastY != null && !Number.isNaN(lastX) && (
            <circle cx={lastX} cy={lastY} r="2" fill={TERMINAL_TOKENS.chartLine} />
          )}
        </svg>
      </div>
    </div>
  );
}

export function HealthCharts({ history }: { history: HealthSample[] }) {
  const gateway = history.map((h) => h.gatewayMs);
  const bridge = history.map((h) => h.bridgeMs);
  const ws = history.map((h) => h.wsMs);
  const last = history[history.length - 1];

  if (history.length === 0) {
    return <div className="info-empty">启动后采集延迟曲线 · 2s 间隔</div>;
  }

  return (
    <div>
      <Sparkline label="Gateway /health" values={gateway} latest={last?.gatewayMs ?? null} />
      <Sparkline label="Bridge /api/saas/health" values={bridge} latest={last?.bridgeMs ?? null} />
      <Sparkline label="WS hello_ok" values={ws} latest={last?.wsMs ?? null} />
    </div>
  );
}
