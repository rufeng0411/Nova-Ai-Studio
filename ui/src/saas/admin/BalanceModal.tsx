import { useCallback, useEffect, useState } from 'react';
import { saasApi, type CreditLedgerRow, type SaasUserRow } from '../api/saasApi';

type Props = {
  user: SaasUserRow;
  onClose: () => void;
  onChanged?: () => void;
};

function reasonLabel(reason: string | null): string {
  if (!reason) return '调整';
  if (reason.startsWith('subscribe:')) return `订阅 ${reason.slice('subscribe:'.length)}`;
  if (reason === 'admin_credit') return '管理员调整';
  if (reason === 'chat_turn') return '对话消耗';
  return reason;
}

const QUICK = [100, 500, 1000, 5000];

export default function BalanceModal({ user, onClose, onChanged }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerRow[]>([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await saasApi.adminUserWallet(user.id);
      if (res.ok) {
        const payload = await res.json();
        setBalance(payload.wallet?.balance ?? 0);
        setLedger(Array.isArray(payload.ledger) ? payload.ledger : []);
      }
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(
    async (delta: number) => {
      if (!Number.isFinite(delta) || delta === 0) {
        setError('请输入非零的调整额度');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const res = await saasApi.billingCredit(user.id, Math.trunc(delta), reason.trim() || undefined);
        if (res.ok) {
          const payload = await res.json();
          setBalance(payload.wallet?.balance ?? balance);
          setLedger(Array.isArray(payload.ledger) ? payload.ledger : ledger);
          setAmount('');
          setReason('');
          onChanged?.();
        } else {
          const payload = await res.json().catch(() => null);
          setError(payload?.error || '调整失败');
        }
      } finally {
        setSaving(false);
      }
    },
    [user.id, reason, balance, ledger, onChanged],
  );

  const parsed = Number(amount);

  return (
    <div
      className="saas-admin-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="saas-admin-modal" data-testid="saas-balance-modal">
        <div className="saas-admin-modal-head">
          <h2>余额调整 · {user.username}</h2>
          <button type="button" className="saas-admin-btn sm" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="saas-admin-modal-body">
          <div>
            <div className="saas-admin-note">当前余额（积分）</div>
            <div className="saas-admin-balance" data-testid="saas-balance-value">
              {loading ? '…' : (balance ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="saas-admin-field">
            <label htmlFor="balance-amount">调整额度（正数增加 / 负数扣减）</label>
            <input
              id="balance-amount"
              type="number"
              value={amount}
              placeholder="例如 1000 或 -200"
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="saas-admin-quick">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="saas-admin-btn sm"
                  onClick={() => setAmount(String(q))}
                >
                  +{q}
                </button>
              ))}
              <button type="button" className="saas-admin-btn sm" onClick={() => setAmount('-100')}>
                -100
              </button>
            </div>
          </div>

          <div className="saas-admin-field">
            <label htmlFor="balance-reason">备注（可选）</label>
            <input
              id="balance-reason"
              type="text"
              value={reason}
              placeholder="例如：手动充值 / 客诉补偿"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <div className="saas-admin-note error">{error}</div>}

          <div className="saas-admin-modal-actions">
            <button type="button" className="saas-admin-btn" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button
              type="button"
              className="saas-admin-btn primary"
              disabled={saving || !amount || !Number.isFinite(parsed) || parsed === 0}
              onClick={() => apply(parsed)}
            >
              {saving ? '提交中…' : '确认调整'}
            </button>
          </div>

          <div className="saas-admin-field">
            <label>最近流水</label>
            <table className="saas-admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>变动</th>
                  <th>事由</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={3}>暂无记录</td>
                  </tr>
                ) : (
                  ledger.map((row) => (
                    <tr key={row.id}>
                      <td className="saas-admin-mono">{row.created_at}</td>
                      <td className={`saas-admin-num ${row.delta >= 0 ? 'pos' : 'neg'}`}>
                        {row.delta >= 0 ? `+${row.delta}` : row.delta}
                      </td>
                      <td>{reasonLabel(row.reason)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
