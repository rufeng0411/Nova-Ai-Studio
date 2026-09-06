import type { ReactNode } from 'react';

type AdminPageShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** PD-SAAS-FORK: 后台页面统一壳 — 标题区 + 留白 + 区块间距 */
export default function AdminPageShell({
  title,
  description,
  actions,
  children,
  className = '',
  testId,
}: AdminPageShellProps) {
  return (
    <div className={`saas-admin-page${className ? ` ${className}` : ''}`} data-testid={testId}>
      <header className="saas-admin-page-header">
        <div className="saas-admin-page-header-text">
          <h2 className="saas-admin-page-title">{title}</h2>
          {description ? <p className="saas-admin-page-desc">{description}</p> : null}
        </div>
        {actions ? <div className="saas-admin-page-actions">{actions}</div> : null}
      </header>
      <div className="saas-admin-page-body">{children}</div>
    </div>
  );
}

export function AdminSection({
  title,
  hint,
  actions,
  children,
  className = '',
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasHead = Boolean(title || hint || actions);
  return (
    <section className={`saas-admin-section${className ? ` ${className}` : ''}`}>
      {hasHead ? (
        <div className="saas-admin-section-head">
          <div className="saas-admin-section-head-text">
            {title ? <h3 className="saas-admin-section-title">{title}</h3> : null}
            {hint ? <span className="saas-admin-section-hint">{hint}</span> : null}
          </div>
          {actions ? <div className="saas-admin-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="saas-admin-section-body">{children}</div>
    </section>
  );
}

export function AdminKpiGrid({ children, columns }: { children: ReactNode; columns?: 3 | 4 | 5 | 'auto' }) {
  const colClass =
    columns === 5
      ? ' saas-admin-kpi-row--5'
      : columns === 4
        ? ' saas-admin-kpi-row--4'
        : columns === 3
          ? ' saas-admin-kpi-row--3'
          : '';
  return <div className={`saas-admin-kpi-row${colClass}`}>{children}</div>;
}

export function AdminKpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  icon,
  sparkline,
  accent = 'blue',
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: 'up' | 'down' | 'neutral' | 'flat';
  icon?: ReactNode;
  sparkline?: ReactNode;
  accent?: 'blue' | 'green' | 'violet' | 'amber' | 'slate';
}) {
  return (
    <article className={`saas-admin-kpi saas-admin-kpi--${accent}`}>
      <div className="saas-admin-kpi-top">
        <div className="saas-admin-kpi-meta">
          {icon ? <div className="saas-admin-kpi-icon">{icon}</div> : null}
          <div className="saas-admin-kpi-copy">
            <div className="label">{label}</div>
            <div className="value">{value}</div>
          </div>
        </div>
        {sparkline ? <div className="saas-admin-kpi-spark">{sparkline}</div> : null}
      </div>
      {delta != null && delta !== '' ? (
        <div className={`saas-admin-kpi-delta is-${deltaTone}`}>{delta}</div>
      ) : null}
    </article>
  );
}

export function AdminLoadingBlock({ label }: { label: string }) {
  return (
    <div className="saas-admin-loading-block" role="status">
      <span className="saas-admin-loading-dot" aria-hidden />
      {label}
    </div>
  );
}
