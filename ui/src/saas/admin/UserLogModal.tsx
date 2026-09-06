import { useCallback, useEffect, useState } from 'react';
import { saasApi, type AdminUserLogsPayload, type SaasUserRow } from '../api/saasApi';
import { isAbortOrNetworkError } from '../../shared/networkFetchRegistry';
import { formatAdminDateTime } from './adminDateTime';

type Props = {
  user: SaasUserRow;
  onClose: () => void;
};

function categoryLabel(category: string, type: string): string {
  if (category === 'credit') return type === 'credit_in' ? '积分入账' : '积分消耗';
  if (type === 'register') return '账号';
  if (type === 'login') return '登录';
  if (type === 'subscription') return '订阅';
  if (type === 'password_change') return '安全';
  if (type === 'visit') return '访问';
  return '事件';
}

export default function UserLogModal({ user, onClose }: Props) {
  const [payload, setPayload] = useState<AdminUserLogsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await saasApi.adminUserLogs(user.id);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === 'string' ? body.error : '日志加载失败，请稍后重试');
        setPayload(null);
        return;
      }
      setPayload(await res.json());
    } catch (error) {
      setError(isAbortOrNetworkError(error) ? '日志加载超时，请重试' : '日志加载失败，请稍后重试');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = payload?.stats;
  const usage = stats?.usage;

  return (
    <div
      className="saas-admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="saas-admin-modal saas-admin-modal-wide" data-testid="saas-user-log-modal">
        <div className="saas-admin-modal-head">
          <h2>用户日志 · {user.username}</h2>
          <button type="button" className="saas-admin-btn sm" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="saas-admin-modal-body">
          {loading ? (
            <p className="saas-admin-note">加载中…</p>
          ) : error ? (
            <div className="saas-admin-field">
              <p className="saas-admin-error">{error}</p>
              <button type="button" className="saas-admin-btn sm" onClick={() => void load()}>
                重试
              </button>
            </div>
          ) : payload ? (
            <>
              <div className="saas-admin-kpi-row saas-admin-kpi-row-compact">
                <div className="saas-admin-kpi">
                  <div className="label">剩余积分</div>
                  <div className="value">{(payload.wallet.balance ?? 0).toLocaleString()}</div>
                </div>
                <div className="saas-admin-kpi">
                  <div className="label">注册时间</div>
                  <div className="value saas-admin-kpi-text">{formatAdminDateTime(payload.user.created_at)}</div>
                </div>
                <div className="saas-admin-kpi">
                  <div className="label">上次登录</div>
                  <div className="value saas-admin-kpi-text">{formatAdminDateTime(payload.user.last_login)}</div>
                </div>
                <div className="saas-admin-kpi">
                  <div className="label">对话数</div>
                  <div className="value">{stats?.sessionCount ?? 0}</div>
                </div>
                <div className="saas-admin-kpi">
                  <div className="label">最近对话</div>
                  <div className="value saas-admin-kpi-text">{formatAdminDateTime(stats?.lastActivityAt)}</div>
                </div>
                <div className="saas-admin-kpi">
                  <div className="label">累计 Token</div>
                  <div className="value">{(usage?.totalTokens ?? 0).toLocaleString()}</div>
                </div>
              </div>

              <p className="saas-admin-note">
                当前订阅：{payload.subscription?.plan_name ?? '—'}
                {payload.user.tenant_id ? ` · 租户 ${payload.user.tenant_id}` : ''}
              </p>

              <div className="saas-admin-field">
                <label>活动记录（注册/登录/积分/订阅等）</label>
                <div className="saas-admin-table-scroll">
                  <table className="saas-admin-table">
                    <thead>
                      <tr>
                        <th>时间</th>
                        <th>类型</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.timeline.length === 0 ? (
                        <tr>
                          <td colSpan={3}>暂无记录</td>
                        </tr>
                      ) : (
                        payload.timeline.map((row) => (
                          <tr key={row.id}>
                            <td className="saas-admin-mono">{formatAdminDateTime(row.at)}</td>
                            <td>{categoryLabel(row.category, row.type)}</td>
                            <td>{row.summary}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
