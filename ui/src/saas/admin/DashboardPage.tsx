import { useCallback, useEffect, useState } from 'react';
import { Eye, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { saasApi, type SaasDashboardStats } from '../api/saasApi';
import AdminPageShell, {
  AdminKpiCard,
  AdminKpiGrid,
  AdminLoadingBlock,
  AdminSection,
} from './components/AdminPageShell';
import { AdminAreaChart, AdminBarChart, AdminSparkline } from './components/AdminChartKit';

const EMPTY_STATS: SaasDashboardStats = {
  visits: { total: 0, series: [] },
  users: { total: 0, active: 0, series: [] },
  ops: { total: 0, series: [] },
  subscriptions: { active: 0, trial: 0, series: [] },
  aiUsage: { totalTokens: 0, totalCost: 0, series: [] },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<SaasDashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await saasApi.adminDashboard();
      if (response.ok) {
        const payload = await response.json();
        setStats({ ...EMPTY_STATS, ...payload });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AdminPageShell
        title="运营仪表盘"
        description="汇总访问量、用户增长、订阅与 AI 用量等核心运营指标。"
        testId="saas-admin-dashboard"
      >
        <AdminLoadingBlock label="加载仪表盘…" />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="运营仪表盘"
      description="汇总访问量、用户增长、订阅与 AI 用量等核心运营指标。"
      testId="saas-admin-dashboard"
      actions={
        <button type="button" className="saas-admin-btn sm" onClick={() => void load()}>
          刷新
        </button>
      }
    >
      <AdminKpiGrid columns="auto">
        <AdminKpiCard
          label="访问量"
          value={stats.visits.total.toLocaleString()}
          accent="blue"
          icon={<TrendingUp size={18} strokeWidth={2.2} aria-hidden />}
          sparkline={
            <AdminSparkline data={stats.visits.series} valueKey="count" color="#4a7fd4" />
          }
        />
        <AdminKpiCard
          label="注册用户"
          value={stats.users.total.toLocaleString()}
          delta={`活跃 ${stats.users.active.toLocaleString()}`}
          deltaTone="up"
          accent="green"
          icon={<Users size={18} strokeWidth={2.2} aria-hidden />}
          sparkline={
            <AdminSparkline data={stats.users.series} valueKey="count" color="#2d8f6f" />
          }
        />
        <AdminKpiCard
          label="运营事件"
          value={stats.ops.total.toLocaleString()}
          accent="violet"
          icon={<Eye size={18} strokeWidth={2.2} aria-hidden />}
        />
        <AdminKpiCard
          label="活跃订阅"
          value={stats.subscriptions.active.toLocaleString()}
          delta={`试用 ${stats.subscriptions.trial.toLocaleString()}`}
          deltaTone="neutral"
          accent="amber"
          icon={<Sparkles size={18} strokeWidth={2.2} aria-hidden />}
        />
        <AdminKpiCard
          label="AI Token 用量"
          value={stats.aiUsage.totalTokens.toLocaleString()}
          accent="blue"
          icon={<Zap size={18} strokeWidth={2.2} aria-hidden />}
          sparkline={
            <AdminSparkline data={stats.aiUsage.series} valueKey="tokens" color="#3d6fbf" />
          }
        />
        <AdminKpiCard
          label="估算成本 (USD)"
          value={stats.aiUsage.totalCost.toFixed(2)}
          accent="slate"
          icon={<span className="saas-admin-kpi-currency" aria-hidden>$</span>}
        />
      </AdminKpiGrid>

      <div className="saas-admin-dashboard-grid">
        <AdminSection title="访问趋势" hint="近周期页面访问量">
          <AdminAreaChart
            data={stats.visits.series}
            valueKey="count"
            color="#4a7fd4"
            emptyLabel="暂无访问数据"
          />
        </AdminSection>
        <AdminSection title="新增用户" hint="注册与活跃增长">
          <AdminAreaChart
            data={stats.users.series}
            valueKey="count"
            color="#2d8f6f"
            emptyLabel="暂无用户数据"
          />
        </AdminSection>
        <AdminSection title="订阅变化" hint="活跃与试用订阅">
          <AdminBarChart
            data={stats.subscriptions.series}
            valueKey="count"
            color="#2d8f6f"
            emptyLabel="暂无订阅数据"
          />
        </AdminSection>
        <AdminSection title="AI 用量" hint="Token 消耗趋势">
          <AdminAreaChart
            data={stats.aiUsage.series}
            valueKey="tokens"
            color="#3d6fbf"
            emptyLabel="暂无用量数据"
          />
        </AdminSection>
      </div>
    </AdminPageShell>
  );
}
