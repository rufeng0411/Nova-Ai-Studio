/**
 * PD-SAAS-FORK: SaaS user profile + self-service password change.
 * Rendered only in SaaS mode (single-user mode keeps its original settings).
 */
import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  USER_AVATAR_ACCEPT_ATTR,
  formatAvatarMaxSizeLabel,
  validateUserAvatarFile,
} from '../../../shared/userAvatarConstraints.mjs';
import { saasApi } from '../api/saasApi';
import { useAuth } from '../../components/auth/context/AuthContext';
import { readAvatarUpdatedAt } from './avatarHelpers';
import UserAvatar from './UserAvatar';

type Account = {
  username?: string;
  role?: string;
  created_at?: string;
  last_login?: string;
  avatarUpdatedAt?: string | null;
};

function roleLabel(role: string | undefined): string {
  if (role === 'super-admin') return '平台管理员';
  if (role === 'admin') return '工作区管理员';
  return '成员';
}

type AvatarErrorCode = 'AVATAR_FILE_TOO_LARGE' | 'AVATAR_FILE_TYPE_INVALID' | 'AVATAR_FILE_REQUIRED' | 'AVATAR_IMAGE_INVALID';

export default function ProfileSettings() {
  const { t } = useTranslation('settings');
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [account, setAccount] = useState<Account>({});
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const maxSizeLabel = formatAvatarMaxSizeLabel();
  const formatsLabel = t('settingsHome.profile.avatar.formatsLabel');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await saasApi.currentUser();
        if (res.ok && alive) {
          const payload = await res.json();
          setAccount(payload.user ?? {});
        }
      } catch {
        /* fall back to context user below */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const username = account.username ?? user?.username ?? '—';
  const role = account.role ?? (typeof user?.role === 'string' ? user.role : undefined);
  const avatarUpdatedAt =
    account.avatarUpdatedAt ?? readAvatarUpdatedAt(user) ?? null;

  const mapAvatarError = (code: string): string => {
    switch (code as AvatarErrorCode) {
      case 'AVATAR_FILE_TOO_LARGE':
        return t('settingsHome.profile.avatar.errors.tooLarge', { maxSize: maxSizeLabel });
      case 'AVATAR_FILE_TYPE_INVALID':
      case 'AVATAR_IMAGE_INVALID':
        return t('settingsHome.profile.avatar.errors.invalidType', { formats: formatsLabel });
      case 'AVATAR_FILE_REQUIRED':
        return t('settingsHome.profile.avatar.errors.required');
      default:
        return t('settingsHome.profile.avatar.errors.uploadFailed');
    }
  };

  const handleAvatarPick = async (file: File | null) => {
    setAvatarMessage(null);
    if (!file) return;

    const validation = validateUserAvatarFile(file);
    if (!validation.ok) {
      setAvatarMessage({ kind: 'err', text: mapAvatarError(validation.code) });
      return;
    }

    setAvatarBusy(true);
    try {
      const res = await saasApi.uploadAvatar(file);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const code = typeof payload?.code === 'string' ? payload.code : '';
        setAvatarMessage({ kind: 'err', text: mapAvatarError(code || 'unknown') });
        return;
      }
      const nextUpdatedAt =
        typeof payload?.avatarUpdatedAt === 'string' ? payload.avatarUpdatedAt : new Date().toISOString();
      setAccount((prev) => ({ ...prev, avatarUpdatedAt: nextUpdatedAt }));
      await refreshUser();
      setAvatarMessage({ kind: 'ok', text: t('settingsHome.profile.avatar.uploaded') });
    } catch {
      setAvatarMessage({ kind: 'err', text: t('settingsHome.profile.avatar.errors.uploadFailed') });
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarMessage(null);
    setAvatarBusy(true);
    try {
      const res = await saasApi.removeAvatar();
      if (!res.ok) {
        setAvatarMessage({ kind: 'err', text: t('settingsHome.profile.avatar.errors.uploadFailed') });
        return;
      }
      setAccount((prev) => ({ ...prev, avatarUpdatedAt: null }));
      await refreshUser();
      setAvatarMessage({ kind: 'ok', text: t('settingsHome.profile.avatar.removed') });
    } catch {
      setAvatarMessage({ kind: 'err', text: t('settingsHome.profile.avatar.errors.uploadFailed') });
    } finally {
      setAvatarBusy(false);
    }
  };

  const submit = async () => {
    setMessage(null);
    if (!current || !next) {
      setMessage({ kind: 'err', text: '请填写当前密码与新密码' });
      return;
    }
    if (next.length < 6) {
      setMessage({ kind: 'err', text: '新密码至少 6 位' });
      return;
    }
    if (next !== confirm) {
      setMessage({ kind: 'err', text: '两次输入的新密码不一致' });
      return;
    }
    if (next === current) {
      setMessage({ kind: 'err', text: '新密码不能与当前密码相同' });
      return;
    }
    setSaving(true);
    try {
      const res = await saasApi.changePassword(current, next);
      if (res.ok) {
        setMessage({ kind: 'ok', text: '密码已更新' });
        setCurrent('');
        setNext('');
        setConfirm('');
      } else {
        const payload = await res.json().catch(() => null);
        const err = payload?.error || '修改失败';
        const friendly = err === 'Current password is incorrect' ? '当前密码不正确' : err;
        setMessage({ kind: 'err', text: friendly });
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'h-10 w-full rounded-lg border border-border bg-card px-3 text-[14px] text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring';

  return (
    <div className="space-y-8" data-testid="saas-profile-settings">
      <section className="space-y-2.5">
        <h3 className="text-[15px] font-semibold leading-5 text-foreground">
          {t('settingsHome.profile.avatar.title')}
        </h3>
        <div className="rounded-lg border border-border bg-card/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar username={username} avatarUpdatedAt={avatarUpdatedAt} size="lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[13px] text-muted-foreground">
                {t('settingsHome.profile.avatar.hint', { formats: formatsLabel, maxSize: maxSizeLabel })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={USER_AVATAR_ACCEPT_ATTR}
                  className="sr-only"
                  aria-label={t('settingsHome.profile.avatar.upload')}
                  onChange={(e) => void handleAvatarPick(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {avatarBusy ? t('settingsHome.profile.avatar.uploading') : t('settingsHome.profile.avatar.upload')}
                </button>
                {avatarUpdatedAt ? (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => void handleAvatarRemove()}
                    className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {t('settingsHome.profile.avatar.remove')}
                  </button>
                ) : null}
              </div>
              {avatarMessage ? (
                <p
                  className={
                    avatarMessage.kind === 'ok'
                      ? 'text-[13px] font-medium text-green-600 dark:text-green-400'
                      : 'text-[13px] font-medium text-muted-foreground'
                  }
                >
                  {avatarMessage.text}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-[15px] font-semibold leading-5 text-foreground">账号信息</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card/60 divide-y divide-border">
          <InfoRow icon={<UserRound className="h-4 w-4" />} label="用户名" value={username} />
          <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="角色" value={roleLabel(role)} />
          {account.created_at && <InfoRow label="注册时间" value={account.created_at} mono />}
          {account.last_login && <InfoRow label="上次登录" value={account.last_login} mono />}
        </div>
      </section>

      <section className="space-y-2.5">
        <div>
          <h3 className="text-[15px] font-semibold leading-5 text-foreground">修改登录密码</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">需先验证当前密码，新密码至少 6 位。</p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-5">
          <Field label="当前密码">
            <input
              type="password"
              aria-label="当前密码"
              placeholder="当前密码"
              autoComplete="current-password"
              className={inputCls}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="新密码">
            <input
              type="password"
              aria-label="新密码"
              placeholder="至少 6 位"
              autoComplete="new-password"
              className={inputCls}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="确认新密码">
            <input
              type="password"
              aria-label="确认新密码"
              placeholder="再次输入新密码"
              autoComplete="new-password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {message && (
            <div
              className={
                message.kind === 'ok'
                  ? 'text-[13px] font-medium text-green-600 dark:text-green-400'
                  : 'text-[13px] font-medium text-red-600 dark:text-red-400'
              }
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {saving ? '提交中…' : '更新密码'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-[56px] items-center gap-3.5 px-5 py-3">
      {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
      <div className="min-w-0 flex-1 text-[14px] font-medium text-foreground">{label}</div>
      <div className={`flex-shrink-0 text-[13px] text-muted-foreground ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
