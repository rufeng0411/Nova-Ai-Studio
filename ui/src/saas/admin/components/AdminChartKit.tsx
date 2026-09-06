import { useMemo, useState } from 'react';

type SeriesPoint = Record<string, string | number>;

function seriesMax(points: SeriesPoint[], key: string): number {
  if (points.length === 0) return 1;
  return Math.max(1, ...points.map((point) => Number(point[key]) || 0));
}

function formatAxisDate(raw: string): string {
  if (!raw) return '';
  return raw.length >= 10 ? raw.slice(5) : raw;
}

function buildSmoothPath(
  values: number[],
  width: number,
  height: number,
  padX: number,
  padY: number,
  max: number,
): string {
  if (values.length === 0) return '';
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = values.length <= 1 ? 0 : innerW / (values.length - 1);

  const coords = values.map((value, index) => {
    const x = padX + index * step;
    const y = padY + innerH - (value / max) * innerH;
    return { x, y };
  });

  if (coords.length === 1) {
    return `M ${coords[0].x} ${coords[0].y}`;
  }

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function buildAreaPath(
  values: number[],
  width: number,
  height: number,
  padX: number,
  padY: number,
  max: number,
): string {
  if (values.length === 0) return '';
  const line = buildSmoothPath(values, width, height, padX, padY, max);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = values.length <= 1 ? 0 : innerW / (values.length - 1);
  const lastX = padX + (values.length - 1) * step;
  const baseY = padY + innerH;
  return `${line} L ${lastX} ${baseY} L ${padX} ${baseY} Z`;
}


export function AdminSparkline({
  data,
  valueKey,
  color = '#4a7fd4',
  height = 44,
}: {
  data: SeriesPoint[];
  valueKey: string;
  color?: string;
  height?: number;
}) {
  const width = 112;
  const padX = 2;
  const padY = 4;
  const values = useMemo(() => data.map((point) => Number(point[valueKey]) || 0), [data, valueKey]);
  const max = useMemo(() => seriesMax(data, valueKey), [data, valueKey]);

  if (values.length === 0) {
    return <div className="admin-chart-spark admin-chart-spark--empty" style={{ height }} aria-hidden />;
  }

  const line = buildSmoothPath(values, width, height, padX, padY, max);
  const area = buildAreaPath(values, width, height, padX, padY, max);

  return (
    <svg className="admin-chart-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <defs>
        <linearGradient id={`spark-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${valueKey})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function AdminAreaChart({
  data,
  valueKey,
  label,
  color = '#4a7fd4',
  emptyLabel = '暂无数据',
  height = 260,
}: {
  data: SeriesPoint[];
  valueKey: string;
  label?: string;
  color?: string;
  emptyLabel?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 640;
  const padX = 8;
  const padY = 12;
  const values = useMemo(() => data.map((point) => Number(point[valueKey]) || 0), [data, valueKey]);
  const max = useMemo(() => seriesMax(data, valueKey), [data, valueKey]);
  const fillId = `area-${valueKey}`;

  if (values.length === 0) {
    return <p className="saas-admin-chart-empty">{emptyLabel}</p>;
  }

  const line = buildSmoothPath(values, width, height, padX, padY, max);
  const area = buildAreaPath(values, width, height, padX, padY, max);
  const innerW = width - padX * 2;
  const step = values.length <= 1 ? 0 : innerW / (values.length - 1);
  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => padY + (height - padY * 2) * (1 - ratio));
  const hover = hoverIndex != null ? data[hoverIndex] : null;
  const hoverX = hoverIndex != null ? padX + hoverIndex * step : 0;
  const hoverY =
    hoverIndex != null
      ? padY + (height - padY * 2) - ((Number(hover?.[valueKey]) || 0) / max) * (height - padY * 2)
      : 0;

  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 7 ? 2 : 1;

  return (
    <div className="admin-chart admin-chart--area" role="img" aria-label={label ?? `${valueKey} trend`}>
      <div className="admin-chart-plot" style={{ height }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridLines.map((y) => (
            <line key={y} x1={padX} y1={y} x2={width - padX} y2={y} className="admin-chart-grid-line" />
          ))}
          <path d={area} fill={`url(#${fillId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" />
          {hoverIndex != null ? (
            <>
              <line x1={hoverX} y1={padY} x2={hoverX} y2={height - padY} className="admin-chart-crosshair" />
              <circle cx={hoverX} cy={hoverY} r="4.5" fill="#fff" stroke={color} strokeWidth="2" />
            </>
          ) : null}
        </svg>
        <div className="admin-chart-overlay">
          {data.map((point, index) => (
            <button
              key={`${String(point.date ?? index)}-${index}`}
              type="button"
              className="admin-chart-hit"
              aria-label={`${String(point.date ?? index)}: ${Number(point[valueKey]) || 0}`}
              onMouseEnter={() => setHoverIndex(index)}
              onFocus={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              onBlur={() => setHoverIndex(null)}
            />
          ))}
        </div>
        {hover ? (
          <div className="admin-chart-tooltip" style={{ left: `${(hoverIndex! / Math.max(1, data.length - 1)) * 100}%` }}>
            <strong>{String(hover.date ?? '')}</strong>
            <span>{(Number(hover[valueKey]) || 0).toLocaleString()}</span>
          </div>
        ) : null}
      </div>
      <div className="admin-chart-axis">
        {data.map((point, index) => {
          const show = index % labelEvery === 0 || index === data.length - 1;
          return (
            <span key={`${String(point.date ?? index)}-axis`} className={show ? '' : 'is-muted'}>
              {show ? formatAxisDate(String(point.date ?? '')) : '·'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDualAreaChart({
  data,
  primaryKey,
  secondaryKey,
  primaryLabel = 'PV',
  secondaryLabel = 'UV',
  primaryColor = '#2d8f6f',
  secondaryColor = '#4a7fd4',
  emptyLabel = '暂无访问数据',
  height = 280,
}: {
  data: SeriesPoint[];
  primaryKey: string;
  secondaryKey: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emptyLabel?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 720;
  const padX = 10;
  const padY = 14;

  const primaryValues = useMemo(() => data.map((point) => Number(point[primaryKey]) || 0), [data, primaryKey]);
  const secondaryValues = useMemo(() => data.map((point) => Number(point[secondaryKey]) || 0), [data, secondaryKey]);
  const max = useMemo(
    () => Math.max(1, ...primaryValues, ...secondaryValues),
    [primaryValues, secondaryValues],
  );

  if (data.length === 0) {
    return <p className="saas-admin-chart-empty">{emptyLabel}</p>;
  }

  const primaryLine = buildSmoothPath(primaryValues, width, height, padX, padY, max);
  const secondaryLine = buildSmoothPath(secondaryValues, width, height, padX, padY, max);
  const primaryArea = buildAreaPath(primaryValues, width, height, padX, padY, max);
  const innerW = width - padX * 2;
  const step = data.length <= 1 ? 0 : innerW / (data.length - 1);
  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => padY + (height - padY * 2) * (1 - ratio));
  const hover = hoverIndex != null ? data[hoverIndex] : null;
  const hoverX = hoverIndex != null ? padX + hoverIndex * step : 0;
  const labelEvery = data.length > 21 ? 3 : data.length > 14 ? 2 : 1;

  return (
    <div className="admin-chart admin-chart--dual" role="img" aria-label={`${primaryLabel} / ${secondaryLabel} trend`}>
      <div className="admin-chart-legend">
        <span><i className="admin-chart-swatch" style={{ background: primaryColor }} /> {primaryLabel}</span>
        <span><i className="admin-chart-swatch" style={{ background: secondaryColor }} /> {secondaryLabel}</span>
      </div>
      <div className="admin-chart-plot" style={{ height }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="dual-primary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={primaryColor} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="dual-secondary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.14" />
              <stop offset="100%" stopColor={secondaryColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {gridLines.map((y) => (
            <line key={y} x1={padX} y1={y} x2={width - padX} y2={y} className="admin-chart-grid-line" />
          ))}
          <path d={primaryArea} fill="url(#dual-primary)" />
          <path d={secondaryLine} fill="none" stroke={secondaryColor} strokeWidth="2" strokeLinecap="round" opacity="0.92" />
          <path d={primaryLine} fill="none" stroke={primaryColor} strokeWidth="2.25" strokeLinecap="round" />
          {hoverIndex != null ? (
            <line x1={hoverX} y1={padY} x2={hoverX} y2={height - padY} className="admin-chart-crosshair" />
          ) : null}
        </svg>
        <div className="admin-chart-overlay">
          {data.map((point, index) => (
            <button
              key={`dual-${String(point.date ?? index)}-${index}`}
              type="button"
              className="admin-chart-hit"
              aria-label={`${String(point.date ?? index)}`}
              onMouseEnter={() => setHoverIndex(index)}
              onFocus={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              onBlur={() => setHoverIndex(null)}
            />
          ))}
        </div>
        {hover ? (
          <div className="admin-chart-tooltip admin-chart-tooltip--dual" style={{ left: `${(hoverIndex! / Math.max(1, data.length - 1)) * 100}%` }}>
            <strong>{String(hover.date ?? '')}</strong>
            <span>{primaryLabel} {(Number(hover[primaryKey]) || 0).toLocaleString()}</span>
            <span>{secondaryLabel} {(Number(hover[secondaryKey]) || 0).toLocaleString()}</span>
          </div>
        ) : null}
      </div>
      <div className="admin-chart-axis">
        {data.map((point, index) => {
          const show = index % labelEvery === 0 || index === data.length - 1;
          return (
            <span key={`dual-axis-${index}`} className={show ? '' : 'is-muted'}>
              {show ? formatAxisDate(String(point.date ?? '')) : '·'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AdminBarChart({
  data,
  valueKey,
  color = '#4a7fd4',
  emptyLabel = '暂无数据',
  height = 240,
}: {
  data: SeriesPoint[];
  valueKey: string;
  color?: string;
  emptyLabel?: string;
  height?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = useMemo(() => seriesMax(data, valueKey), [data, valueKey]);

  if (data.length === 0) {
    return <p className="saas-admin-chart-empty">{emptyLabel}</p>;
  }

  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 7 ? 2 : 1;

  return (
    <div className="admin-chart admin-chart--bar" role="img" aria-label={`${valueKey} bars`} style={{ height }}>
      <div className="admin-chart-bar-grid">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <div key={ratio} className="admin-chart-bar-grid-line" style={{ bottom: `${ratio * 100}%` }} />
        ))}
      </div>
      <div className="admin-chart-bar-cols">
        {data.map((point, index) => {
          const value = Number(point[valueKey]) || 0;
          const pct = Math.max(3, Math.round((value / max) * 100));
          const active = hoverIndex === index;
          return (
            <div
              key={`bar-${String(point.date ?? index)}-${index}`}
              className={`admin-chart-bar-col${active ? ' is-active' : ''}`}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <div className="admin-chart-bar-stack">
                <div
                  className="admin-chart-bar-fill"
                  style={{ height: `${pct}%`, background: color }}
                  title={`${String(point.date ?? index)}: ${value.toLocaleString()}`}
                />
              </div>
              <span className={`admin-chart-bar-label${index % labelEvery === 0 || index === data.length - 1 ? '' : ' is-muted'}`}>
                {index % labelEvery === 0 || index === data.length - 1
                  ? formatAxisDate(String(point.date ?? ''))
                  : '·'}
              </span>
            </div>
          );
        })}
      </div>
      {hoverIndex != null ? (
        <div className="admin-chart-bar-tooltip">
          <strong>{String(data[hoverIndex].date ?? hoverIndex + 1)}</strong>
          <span>{(Number(data[hoverIndex][valueKey]) || 0).toLocaleString()}</span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminFunnelChart({
  steps,
}: {
  steps: Array<{ key: string; label: string; count: number }>;
}) {
  if (!steps.length) {
    return <p className="saas-admin-chart-empty">暂无漏斗数据</p>;
  }

  const max = Math.max(1, ...steps.map((step) => step.count));

  return (
    <div className="admin-funnel">
      {steps.map((step, index) => {
        const width = Math.max(22, Math.round((step.count / max) * 100));
        const prev = index > 0 ? steps[index - 1].count : step.count;
        const keep = prev > 0 && index > 0 ? Math.round((step.count / prev) * 1000) / 10 : null;
        return (
          <div key={step.key} className="admin-funnel-step">
            <div className="admin-funnel-step-head">
              <span className="admin-funnel-step-index">{index + 1}</span>
              <span className="admin-funnel-step-label">{step.label}</span>
              <strong className="admin-funnel-step-value">{step.count.toLocaleString()}</strong>
            </div>
            <div className="admin-funnel-track">
              <div className="admin-funnel-fill" style={{ width: `${width}%` }} />
            </div>
            {keep != null ? <span className="admin-funnel-keep">阶段转化 {keep}%</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminRankChart({
  rows,
  emptyLabel = '暂无数据',
}: {
  rows: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="saas-admin-note">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <div className="admin-rank">
      {rows.map((row, index) => {
        const pctOfMax = Math.round((row.count / max) * 100);
        const share = Math.round((row.count / total) * 1000) / 10;
        return (
          <div key={`${row.label}-${index}`} className="admin-rank-row">
            <div className="admin-rank-row-top">
              <span className="admin-rank-index">{index + 1}</span>
              <span className="admin-rank-label" title={row.label}>
                {row.label}
              </span>
              <span className="admin-rank-metrics">
                <strong>{row.count.toLocaleString()}</strong>
                <em>{share}%</em>
              </span>
            </div>
            <div className="admin-rank-track">
              <div className="admin-rank-fill" style={{ width: `${pctOfMax}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
