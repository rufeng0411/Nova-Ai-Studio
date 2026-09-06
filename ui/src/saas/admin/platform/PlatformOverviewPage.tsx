import { useEffect, useState } from 'react';
import { saasApi, type SaasPlan } from '../../api/saasApi';
import AdminPageShell, { AdminKpiCard, AdminKpiGrid, AdminLoadingBlock, AdminSection } from '../components/AdminPageShell';

type PlatformSummary = {
  legacyPilotHome: string;
  configPath: string;
  plans: SaasPlan[];
  layers: {
    platform: string;
    tenant: string;
    shell: string;
  };
};

export default function PlatformOverviewPage() {
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await saasApi.platformSummary();
        if (!cancelled && response.ok) {
          setSummary((await response.json()) as PlatformSummary);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminPageShell
      title="平台概览"
      description="查看平台托管层级、配置文件位置与订阅套餐；服务细节请从左侧子菜单进入。"
      testId="saas-admin-platform-overview"
    >
      <AdminKpiGrid columns={3}>
        <AdminKpiCard
          label="配置层级"
          value="平台共享"
          delta="租户仅隔离 projects"
          deltaTone="neutral"
          accent="blue"
        />
        <AdminKpiCard
          label="套餐数"
          value={loading ? '—' : (summary?.plans.length ?? 0).toLocaleString()}
          accent="green"
        />
        <AdminKpiCard
          label="普通用户"
          value="不可改配置"
          delta="工作区设置中已隐藏平台项"
          deltaTone="neutral"
          accent="slate"
        />
      </AdminKpiGrid>

      <AdminSection title="平台托管说明">
        {loading ? (
          <AdminLoadingBlock label="加载中…" />
        ) : (
          <div className="saas-admin-platform-prose">
            <p>
              模型池、工具、MCP 与能力目录由平台统一维护，路径：
              <code>{summary?.legacyPilotHome ?? '—'}</code>
            </p>
            <p>
              主配置文件：
              <code>{summary?.configPath ?? '—'}</code>
            </p>
            <p>
              管理员请在左侧「服务配置」中编辑模型/工具，在「平台 → 插件系统」管理平台插件，以及 MCP、权限、遥测与版本；普通成员无法访问这些项。
            </p>
            <ul>
              <li>{summary?.layers.platform}</li>
              <li>{summary?.layers.tenant}</li>
              <li>{summary?.layers.shell}</li>
            </ul>
          </div>
        )}
      </AdminSection>

      {summary && summary.plans.length > 0 ? (
        <AdminSection title="订阅套餐（只读）">
          <div className="saas-admin-table-scroll">
            <table className="saas-admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>月积分</th>
                  <th>价格（分）</th>
                </tr>
              </thead>
              <tbody>
                {summary.plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>{plan.id}</td>
                    <td>{plan.name}</td>
                    <td>{plan.credits_monthly}</td>
                    <td>{plan.price_cents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      ) : null}
    </AdminPageShell>
  );
}
