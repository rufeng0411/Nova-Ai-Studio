/**
 * PD-SAAS-FORK: User-facing "我的路由用量" panel. Shows only the caller's own
 * router (gateway) token usage — total + per project + per model. Backed by
 * GET /api/saas/usage/me, which filters to the authenticated user's sessions.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { saasApi, type MyUsage } from '../api/saasApi';

const EMPTY: MyUsage = {
  total: { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0, estimatedCost: 0 },
  byProject: [],
  byModel: [],
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

export default function MyUsageModal({ onClose }: { onClose: () => void }) {
  const [usage, setUsage] = useState<MyUsage>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await saasApi.myUsage();
        if (res.ok && alive) {
          const payload = await res.json();
          setUsage({ ...EMPTY, ...payload });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[88vh] w-[min(560px,100%)] overflow-auto rounded-xl border border-border bg-background shadow-2xl"
        data-testid="saas-my-usage-modal"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold text-foreground">我的用量</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[11px] text-muted-foreground">总 Token</div>
              <div className="text-xl font-bold text-foreground">{fmt(usage.total.totalTokens)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[11px] text-muted-foreground">请求次数</div>
              <div className="text-xl font-bold text-foreground">{fmt(usage.total.requestCount)}</div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[11px] text-muted-foreground">输入 / 输出</div>
              <div className="text-[13px] font-semibold text-foreground">
                {fmt(usage.total.inputTokens)} / {fmt(usage.total.outputTokens)}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12px] font-semibold text-muted-foreground">按项目</div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-muted/50 text-left text-[11px] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">项目</th>
                    <th className="px-3 py-2 text-right font-medium">Token</th>
                    <th className="px-3 py-2 text-right font-medium">请求</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">加载中…</td></tr>
                  ) : usage.byProject.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">暂无用量</td></tr>
                  ) : (
                    usage.byProject.map((p) => (
                      <tr key={p.projectPath} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground" title={p.projectPath}>{shortPath(p.projectPath)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px]">{fmt(p.totalTokens)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px]">{fmt(p.requestCount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {usage.byModel.length > 0 && (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-muted-foreground">按模型</div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-muted/50 text-left text-[11px] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">模型</th>
                      <th className="px-3 py-2 text-right font-medium">Token</th>
                      <th className="px-3 py-2 text-right font-medium">请求</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.byModel.map((m) => (
                      <tr key={m.model} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{m.model}</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px]">{fmt(m.totalTokens)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[12px]">{fmt(m.requestCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">仅展示你自己的路由用量统计。</p>
        </div>
      </div>
    </div>
  );
}
