/**
 * PD-SAAS-FORK: 后台「消息通道」— 出站通知 MCP + App 双向对话配置
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  fetchImChannelsAdmin,
  fetchImNotifyAdmin,
  saveImChannelsAdmin,
  saveImNotifyAdmin,
  type ImChatAdapters,
  type ImNotifyForm,
} from '../../../shared/imChannelsAdmin';
import ImChannelBrandIcon, {
  type ImBrandId,
} from './imChannels/ImChannelBrandIcon';
import ImChannelHelpDrawer, {
  useImHelpDrawer,
} from './imChannels/ImChannelHelpDrawer';

type TabId = 'notify' | 'chat';

const EMPTY_NOTIFY: ImNotifyForm = {
  wecom: {},
  dingtalk: {},
  whatsapp: {},
};

function StatusDot({ status }: { status: 'empty' | 'saved' | 'on' }) {
  const label =
    status === 'on' ? '已启用' : status === 'saved' ? '已配置' : '未配置';
  return (
    <span className={`saas-admin-im-status saas-admin-im-status--${status}`}>
      <span className="saas-admin-im-status-dot" aria-hidden />
      {label}
    </span>
  );
}

export default function PlatformImChannelsPage() {
  const [tab, setTab] = useState<TabId>('notify');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notifyFlag, setNotifyFlag] = useState('off');
  const [chatFlag, setChatFlag] = useState('off');
  const [canEnableChat, setCanEnableChat] = useState(false);
  const [notifyForm, setNotifyForm] = useState<ImNotifyForm>(EMPTY_NOTIFY);
  const [chatAdapters, setChatAdapters] = useState<ImChatAdapters>({});
  const [confirmEnable, setConfirmEnable] = useState<null | keyof ImChatAdapters>(null);
  const help = useImHelpDrawer('notify');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [notify, chat] = await Promise.all([
        fetchImNotifyAdmin(),
        fetchImChannelsAdmin(),
      ]);
      setNotifyFlag(notify.flag);
      setNotifyForm(notify.form || EMPTY_NOTIFY);
      setChatFlag(chat.flag);
      setCanEnableChat(chat.canEnable);
      setChatAdapters(chat.adapters || {});
      if (chat.warning) setNotice(chat.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNotify = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await saveImNotifyAdmin(notifyForm);
      setNotifyForm(res.form);
      setNotifyFlag(res.flag);
      setNotice(res.reloadHint || '出站通知配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const saveChat = async (next?: ImChatAdapters) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await saveImChannelsAdmin(next || chatAdapters);
      setChatAdapters(res.adapters);
      setCanEnableChat(res.canEnable);
      setChatFlag(res.flag);
      setNotice(res.reloadHint || 'App 对话配置已保存');
      if (res.blockedEnable?.length) {
        setNotice(
          `${res.reloadHint || ''}（已拦截启用：${res.blockedEnable.join('、')}）`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setConfirmEnable(null);
    }
  };

  const requestEnable = (key: keyof ImChatAdapters, enabled: boolean) => {
    if (enabled) {
      if (!canEnableChat) {
        setError('平台未开放 IM 通道（PILOTDECK_IM_CHANNELS=off），无法启用连接；凭证仍可保存');
        return;
      }
      setConfirmEnable(key);
      return;
    }
    const next = {
      ...chatAdapters,
      [key]: { ...chatAdapters[key], enabled: false },
    };
    setChatAdapters(next);
    void saveChat(next);
  };

  const confirmEnableChannel = () => {
    if (!confirmEnable) return;
    const key = confirmEnable;
    const next = {
      ...chatAdapters,
      [key]: { ...chatAdapters[key], enabled: true },
    };
    setChatAdapters(next);
    void saveChat(next);
  };

  if (loading) {
    return (
      <div className="saas-admin-im-channels" data-testid="saas-admin-im-channels">
        <p className="saas-admin-muted">加载中…</p>
      </div>
    );
  }

  return (
    <div className="saas-admin-im-channels" data-testid="saas-admin-im-channels">
      <header className="saas-admin-im-header">
        <div className="saas-admin-im-header-row">
          <div>
            <h2>消息通道</h2>
            <p className="saas-admin-page-desc">
              出站通知与 App 内对话分轨配置，默认关闭。开启前请备好官方凭证；密钥回显为掩码。
            </p>
          </div>
          <button
            type="button"
            className="saas-admin-btn sm"
            onClick={() => help.openHelp('wecom', tab === 'chat' ? 'chat' : 'notify')}
            data-testid="saas-admin-im-help-open"
          >
            图文帮助
          </button>
        </div>
      </header>

      <div className="saas-admin-im-tabs" role="tablist" aria-label="消息通道">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notify'}
          className={`saas-admin-im-tab${tab === 'notify' ? ' active' : ''}`}
          onClick={() => setTab('notify')}
        >
          出站通知
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chat'}
          className={`saas-admin-im-tab${tab === 'chat' ? ' active' : ''}`}
          onClick={() => setTab('chat')}
        >
          App 对话
        </button>
      </div>

      {error ? <div className="saas-admin-alert error">{error}</div> : null}
      {notice ? <div className="saas-admin-alert success">{notice}</div> : null}

      {tab === 'notify' ? (
        <div className="saas-admin-im-panel" role="tabpanel">
          <p className="saas-admin-note">
            平台 flag：<code>PILOTDECK_IM_NOTIFY_MCP={notifyFlag}</code>
            。配置后 Agent 可通过 MCP 向企微/钉钉/WhatsApp 推送一条文字通知（非双向聊天）。
          </p>

          <section className="saas-admin-im-block">
            <div className="saas-admin-im-block-head">
              <ChannelTitle
                brand="wecom"
                title="企业微信"
                onHelp={() => help.openHelp('wecom', 'notify')}
              />
              <StatusDot status={notifyForm.wecom?.hasWebhook ? 'saved' : 'empty'} />
            </div>
            <label className="saas-admin-im-field">
              <span>群机器人 Webhook URL</span>
              <input
                type="text"
                value={notifyForm.wecom?.webhookUrl || ''}
                placeholder={notifyForm.wecom?.hasWebhook ? '已保存（重新填写可覆盖）' : 'https://qyapi.weixin.qq.com/...'}
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    wecom: { ...f.wecom, webhookUrl: e.target.value },
                  }))
                }
              />
            </label>
          </section>

          <section className="saas-admin-im-block">
            <div className="saas-admin-im-block-head">
              <ChannelTitle
                brand="dingtalk"
                title="钉钉"
                onHelp={() => help.openHelp('dingtalk', 'notify')}
              />
              <StatusDot status={notifyForm.dingtalk?.hasWebhook ? 'saved' : 'empty'} />
            </div>
            <label className="saas-admin-im-field">
              <span>自定义机器人 Webhook URL</span>
              <input
                type="text"
                value={notifyForm.dingtalk?.webhookUrl || ''}
                placeholder={notifyForm.dingtalk?.hasWebhook ? '已保存（重新填写可覆盖）' : 'https://oapi.dingtalk.com/...'}
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    dingtalk: { ...f.dingtalk, webhookUrl: e.target.value },
                  }))
                }
              />
            </label>
            <label className="saas-admin-im-field">
              <span>加签密钥（可选）</span>
              <input
                type="password"
                autoComplete="off"
                value={notifyForm.dingtalk?.secret || ''}
                placeholder={notifyForm.dingtalk?.hasSecret ? '已保存（重新填写可覆盖）' : 'SEC…'}
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    dingtalk: { ...f.dingtalk, secret: e.target.value },
                  }))
                }
              />
            </label>
          </section>

          <section className="saas-admin-im-block">
            <div className="saas-admin-im-block-head">
              <ChannelTitle
                brand="whatsapp"
                title="WhatsApp（Cloud API）"
                onHelp={() => help.openHelp('whatsapp', 'notify')}
              />
              <StatusDot status={notifyForm.whatsapp?.hasAccessToken ? 'saved' : 'empty'} />
            </div>
            <p className="saas-admin-muted">
              自由文本受 Meta 24 小时会话窗口限制；不支持 Markdown，将按纯文本发送。
            </p>
            <label className="saas-admin-im-field">
              <span>Access Token</span>
              <input
                type="password"
                autoComplete="off"
                value={notifyForm.whatsapp?.accessToken || ''}
                placeholder={notifyForm.whatsapp?.hasAccessToken ? '已保存（重新填写可覆盖）' : ''}
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    whatsapp: { ...f.whatsapp, accessToken: e.target.value },
                  }))
                }
              />
            </label>
            <label className="saas-admin-im-field">
              <span>Phone Number ID</span>
              <input
                type="text"
                value={notifyForm.whatsapp?.phoneNumberId || ''}
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    whatsapp: { ...f.whatsapp, phoneNumberId: e.target.value },
                  }))
                }
              />
            </label>
            <label className="saas-admin-im-field">
              <span>默认接收号码（E.164）</span>
              <input
                type="text"
                value={notifyForm.whatsapp?.to || ''}
                placeholder="+86138…"
                onChange={(e) =>
                  setNotifyForm((f) => ({
                    ...f,
                    whatsapp: { ...f.whatsapp, to: e.target.value },
                  }))
                }
              />
            </label>
          </section>

          <div className="saas-admin-im-actions">
            <button type="button" className="saas-admin-btn primary" disabled={saving} onClick={() => void saveNotify()}>
              {saving ? '保存中…' : '保存出站通知'}
            </button>
          </div>
        </div>
      ) : (
        <div className="saas-admin-im-panel" role="tabpanel">
          <p className="saas-admin-note">
            平台 flag：<code>PILOTDECK_IM_CHANNELS={chatFlag}</code>
            。在企微/钉钉/WhatsApp 里与 Agent 双向聊天；默认关闭。WhatsApp 依赖私有化 bridge，云上不建议开启。
          </p>

          <ChatChannelCard
            brand="wecom"
            title="企业微信"
            status={chatAdapters.wecom?.enabled ? 'on' : chatAdapters.wecom?.hasToken ? 'saved' : 'empty'}
            enabled={Boolean(chatAdapters.wecom?.enabled)}
            onToggle={(on) => requestEnable('wecom', on)}
            onHelp={() => help.openHelp('wecom', 'chat')}
            fields={(
              <>
                <label className="saas-admin-im-field">
                  <span>Bot ID（token）</span>
                  <input
                    type="text"
                    value={chatAdapters.wecom?.token || ''}
                    placeholder={chatAdapters.wecom?.hasToken ? '已保存（重新填写可覆盖）' : ''}
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        wecom: { ...a.wecom, token: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="saas-admin-im-field">
                  <span>Secret</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={String(chatAdapters.wecom?.extra?.secret || '')}
                    placeholder={chatAdapters.wecom?.extra?.has_secret ? '已保存' : ''}
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        wecom: {
                          ...a.wecom,
                          extra: { ...a.wecom?.extra, secret: e.target.value },
                        },
                      }))
                    }
                  />
                </label>
              </>
            )}
            onSave={() => void saveChat()}
            saving={saving}
          />

          <ChatChannelCard
            brand="dingtalk"
            title="钉钉"
            status={chatAdapters.dingtalk?.enabled ? 'on' : chatAdapters.dingtalk?.extra?.clientId ? 'saved' : 'empty'}
            enabled={Boolean(chatAdapters.dingtalk?.enabled)}
            onToggle={(on) => requestEnable('dingtalk', on)}
            onHelp={() => help.openHelp('dingtalk', 'chat')}
            fields={(
              <>
                <label className="saas-admin-im-field">
                  <span>Client ID</span>
                  <input
                    type="text"
                    value={String(chatAdapters.dingtalk?.extra?.clientId || '')}
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        dingtalk: {
                          ...a.dingtalk,
                          extra: { ...a.dingtalk?.extra, clientId: e.target.value },
                        },
                      }))
                    }
                  />
                </label>
                <label className="saas-admin-im-field">
                  <span>Client Secret</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={String(chatAdapters.dingtalk?.extra?.clientSecret || '')}
                    placeholder={chatAdapters.dingtalk?.extra?.has_clientSecret ? '已保存' : ''}
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        dingtalk: {
                          ...a.dingtalk,
                          extra: { ...a.dingtalk?.extra, clientSecret: e.target.value },
                        },
                      }))
                    }
                  />
                </label>
              </>
            )}
            onSave={() => void saveChat()}
            saving={saving}
          />

          <ChatChannelCard
            brand="whatsapp"
            title="WhatsApp"
            status={chatAdapters.whatsapp?.enabled ? 'on' : chatAdapters.whatsapp?.extra?.bridgePath ? 'saved' : 'empty'}
            enabled={Boolean(chatAdapters.whatsapp?.enabled)}
            onToggle={(on) => requestEnable('whatsapp', on)}
            onHelp={() => help.openHelp('whatsapp', 'chat')}
            warning="依赖本地/私有化 bridge 进程（bridgePath）。云 SaaS 默认不建议开启。"
            fields={(
              <>
                <label className="saas-admin-im-field">
                  <span>Bridge 脚本路径</span>
                  <input
                    type="text"
                    value={String(chatAdapters.whatsapp?.extra?.bridgePath || '')}
                    placeholder="/path/to/whatsapp-bridge.js"
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        whatsapp: {
                          ...a.whatsapp,
                          extra: { ...a.whatsapp?.extra, bridgePath: e.target.value },
                        },
                      }))
                    }
                  />
                </label>
                <label className="saas-admin-im-field">
                  <span>Bridge URL（可选）</span>
                  <input
                    type="text"
                    value={String(chatAdapters.whatsapp?.extra?.bridgeUrl || '')}
                    placeholder="http://127.0.0.1:3000"
                    onChange={(e) =>
                      setChatAdapters((a) => ({
                        ...a,
                        whatsapp: {
                          ...a.whatsapp,
                          extra: { ...a.whatsapp?.extra, bridgeUrl: e.target.value },
                        },
                      }))
                    }
                  />
                </label>
              </>
            )}
            onSave={() => void saveChat()}
            saving={saving}
          />
        </div>
      )}

      {confirmEnable ? (
        <div className="saas-admin-im-modal" role="dialog" aria-modal="true">
          <div className="saas-admin-im-modal-card">
            <h3 className="saas-admin-im-channel-title">
              <ImChannelBrandIcon brand={confirmEnable} size={24} />
              <span>确认启用通道？</span>
            </h3>
            <p>
              启用后 Gateway 将建立长连接（或 bridge），可能占用资源。确认启用「
              {confirmEnable === 'wecom' ? '企业微信' : confirmEnable === 'dingtalk' ? '钉钉' : 'WhatsApp'}
              」？
            </p>
            <div className="saas-admin-im-actions">
              <button type="button" className="saas-admin-btn" onClick={() => setConfirmEnable(null)}>
                取消
              </button>
              <button type="button" className="saas-admin-btn primary" onClick={confirmEnableChannel}>
                确认启用
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImChannelHelpDrawer
        open={help.open}
        brand={help.brand}
        mode={help.mode}
        onClose={help.close}
        onChangeBrand={help.setBrand}
        onChangeMode={help.setMode}
      />
    </div>
  );
}

function ChannelTitle({
  brand,
  title,
  onHelp,
}: {
  brand: ImBrandId;
  title: string;
  onHelp?: () => void;
}) {
  return (
    <h3 className="saas-admin-im-channel-title">
      <ImChannelBrandIcon brand={brand} size={24} />
      <span>{title}</span>
      {onHelp ? (
        <button
          type="button"
          className="saas-admin-im-help-btn"
          onClick={onHelp}
          title={`${title}接入帮助`}
          data-testid={`saas-admin-im-help-${brand}`}
        >
          帮助
        </button>
      ) : null}
    </h3>
  );
}

function ChatChannelCard(props: {
  brand: ImBrandId;
  title: string;
  status: 'empty' | 'saved' | 'on';
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onHelp?: () => void;
  fields: ReactNode;
  onSave: () => void;
  saving: boolean;
  warning?: string;
}) {
  return (
    <section className="saas-admin-im-block">
      <div className="saas-admin-im-block-head">
        <ChannelTitle brand={props.brand} title={props.title} onHelp={props.onHelp} />
        <StatusDot status={props.status} />
        <label className="saas-admin-im-switch">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(e) => props.onToggle(e.target.checked)}
          />
          <span>启用对话</span>
        </label>
      </div>
      {props.warning ? <p className="saas-admin-alert error">{props.warning}</p> : null}
      {props.fields}
      <div className="saas-admin-im-actions">
        <button type="button" className="saas-admin-btn primary" disabled={props.saving} onClick={props.onSave}>
          {props.saving ? '保存中…' : '保存凭证'}
        </button>
      </div>
    </section>
  );
}
