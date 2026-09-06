import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  saasApi,
  type AdminUsage,
  type UsageBucket,
  type UsageByUser,
} from '../api/saasApi';

type GroupBy = 'user' | 'project' | 'model';

const EMPTY: AdminUsage = {
  total: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0, estimatedCost: 0 },
  byUser: [],
  byProject: [],
  byModel: [],
  attributed: 0,
  backgroundAttributed: 0,
  unattributed: 0,
  lastUpdatedAt: '',
};

function fmt(n: number): string {
  return (n ?? 0).toLocaleString();
}

function shortPath(p: string): string {
  if (!p) return '—';
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length <= 2 ? p : `…/${parts.slice(-2).join('/')}`;
}

function resolveUserAttribution(u: UsageByUser): { kind: UsageByUser['attributionKind']; sub: string } {
  if (u.userId != null) {
    return { kind: 'user', sub: `#${u.userId}` };
  }
  if (u.username === '系统/历史') {
    return { kind: 'system', sub: '单机 / legacy 路径' };
  }
  if (u.tenantId || /（后台任务）/.test(u.username)) {
    const tenant = u.tenantId || u.username.replace(/（后台任务）$/, '');
    return { kind: 'background', sub: `后台任务 · ${tenant}` };
  }
  return { kind: 'system', sub: '未归属' };
}

function Row({ label, sub, bucket }: { label: string; sub?: string; bucket: UsageBucket }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        {sub && <div className="saas-admin-note">{sub}</div>}
      </td>
      <td className="saas-admin-num">{fmt(bucket.totalTokens)}</td>
      <td className="saas-admin-num">{fmt(bucket.inputTokens)}</td>
      <td className="saas-admin-num">{fmt(bucket.outputTokens)}</td>
      <td className="saas-admin-num">{fmt(bucket.requestCount)}</td>
      <td className="saas-admin-num">${(bucket.estimatedCost ?? 0).toFixed(4)}</td>
    </tr>
  );
}

export default function UsagePage() {
  const [usage, setUsage] = useState<AdminUsage>(EMPTY);
  const [groupBy, setGroupBy] = useState<GroupBy>('user');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saasApi.adminUsage();
      if (res.ok) {
        const payload = await res.json();
        setUsage({ ...EMPTY, ...payload });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (groupBy === 'user') {
      return usage.byUser.map((u) => {
        const { kind, sub } = resolveUserAttribution(u);
        return {
          key: `u-${u.userId ?? u.username}`,
          label: u.username,
          sub,
          bucket: u,
          kind,
        };
      });
    }
    if (groupBy === 'project') {
      return usage.byProject.map((p) => ({
        key: `p-${p.projectPath}`,
        label: shortPath(p.projectPath),
        sub: p.projectPath,
        bucket: p,
        kind: undefined as UsageByUser['attributionKind'],
      }));
    }
    return usage.byModel.map((m) => ({
      key: `m-${m.model}`,
      label: m.model,
      sub: undefined as string | undefined,
      bucket: m,
      kind: undefined as UsageByUser['attributionKind'],
    }));
  }, [groupBy, usage]);

  const backgroundCount = usage.backgroundAttributed ?? 0;

  return (
    <div data-testid="saas-admin-usage">
      <div className="saas-admin-kpi-row">
        <div className="saas-admin-kpi">
          <div className="label">路由 Token 总用量</div>
          <div className="value">{fmt(usage.total.totalTokens)}</div>
          <div className="delta">输入 {fmt(usage.total.inputTokens)} · 输出 {fmt(usage.total.outputTokens)}</div>
        </div>
        <div className="saas-admin-kpi">
          <div className="label">请求次数</div>
          <div className="value">{fmt(usage.total.requestCount)}</div>
        </div>
        <div className="saas-admin-kpi">
          <div className="label">估算成本 (USD)</div>
          <div className="value">${(usage.total.estimatedCost ?? 0).toFixed(2)}</div>
          <div className="delta">
            已归属 {usage.attributed} · 后台任务 {backgroundCount} · 系统/历史 {usage.unattributed}
          </div>
        </div>
      </div>

      <section className="saas-admin-panel" aria-label="路由用量明细">
        <div className="saas-admin-panel-head">
          <h2>路由 Token 用量</h2>
          <div className="saas-admin-tabs">
            <button
              type="button"
              className={`saas-admin-tab${groupBy === 'user' ? ' active' : ''}`}
              onClick={() => setGroupBy('user')}
            >
              按用户
            </button>
            <button
              type="button"
              className={`saas-admin-tab${groupBy === 'project' ? ' active' : ''}`}
              onClick={() => setGroupBy('project')}
            >
              按项目
            </button>
            <button
              type="button"
              className={`saas-admin-tab${groupBy === 'model' ? ' active' : ''}`}
              onClick={() => setGroupBy('model')}
            >
              按模型
            </button>
          </div>
        </div>
        <table className="saas-admin-table">
          <thead>
            <tr>
              <th>{groupBy === 'user' ? '用户' : groupBy === 'project' ? '项目' : '模型'}</th>
              <th className="saas-admin-num">总 Token</th>
              <th className="saas-admin-num">输入</th>
              <th className="saas-admin-num">输出</th>
              <th className="saas-admin-num">请求</th>
              <th className="saas-admin-num">成本</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>加载中…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无用量数据</td>
              </tr>
            ) : (
              rows.map((r) => <Row key={r.key} label={r.label} sub={r.sub} bucket={r.bucket} />)
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
