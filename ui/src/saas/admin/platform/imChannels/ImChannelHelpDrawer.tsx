/**
 * PD-SAAS-FORK: 消息通道图文帮助抽屉
 */
import { useEffect, useId, useState } from 'react';
import ImChannelBrandIcon, { type ImBrandId } from './ImChannelBrandIcon';
import {
  getImHelpGuide,
  IM_HELP_BRANDS,
  type ImHelpMode,
} from './imChannelHelpContent';

type Props = {
  open: boolean;
  brand: ImBrandId;
  mode: ImHelpMode;
  onClose: () => void;
  onChangeBrand: (brand: ImBrandId) => void;
  onChangeMode: (mode: ImHelpMode) => void;
};

export default function ImChannelHelpDrawer({
  open,
  brand,
  mode,
  onClose,
  onChangeBrand,
  onChangeMode,
}: Props) {
  const titleId = useId();
  const guide = getImHelpGuide(brand, mode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="saas-admin-im-help-overlay"
      role="presentation"
      onClick={onClose}
      data-testid="saas-admin-im-help-overlay"
    >
      <div
        className="saas-admin-im-help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        data-testid="saas-admin-im-help-drawer"
      >
        <header className="saas-admin-im-help-head">
          <div className="saas-admin-im-help-head-main">
            <ImChannelBrandIcon brand={brand} size={28} />
            <div>
              <h2 id={titleId}>{guide.title}</h2>
              <p>{guide.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="saas-admin-btn sm"
            onClick={onClose}
            data-testid="saas-admin-im-help-close"
          >
            关闭
          </button>
        </header>

        <div className="saas-admin-im-help-nav">
          <div className="saas-admin-im-help-brand-tabs" role="tablist" aria-label="选择通道">
            {IM_HELP_BRANDS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={brand === b.id}
                className={`saas-admin-im-help-brand-tab${brand === b.id ? ' active' : ''}`}
                onClick={() => onChangeBrand(b.id)}
              >
                <ImChannelBrandIcon brand={b.id} size={18} />
                <span>{b.label}</span>
              </button>
            ))}
          </div>
          <div className="saas-admin-im-help-mode-tabs" role="tablist" aria-label="帮助类型">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'notify'}
              className={`saas-admin-im-help-mode-tab${mode === 'notify' ? ' active' : ''}`}
              onClick={() => onChangeMode('notify')}
            >
              出站通知 · 创建机器人
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'chat'}
              className={`saas-admin-im-help-mode-tab${mode === 'chat' ? ' active' : ''}`}
              onClick={() => onChangeMode('chat')}
            >
              App 对话 · 连接本系统
            </button>
          </div>
        </div>

        <div className="saas-admin-im-help-body">
          <p className="saas-admin-im-help-overview">{guide.overview}</p>

          {guide.officialUrl ? (
            <p className="saas-admin-im-help-official">
              官方文档：
              <a href={guide.officialUrl} target="_blank" rel="noreferrer noopener">
                {guide.officialLabel || guide.officialUrl}
              </a>
            </p>
          ) : null}

          <div className="saas-admin-im-help-flow" aria-hidden>
            {(mode === 'notify'
              ? ['创建机器人', '复制凭证', '填入后台', '保存验证']
              : ['创建应用', '取得密钥', '填入后台', '启用对话']
            ).map((label, i, arr) => (
              <div key={label} className="saas-admin-im-help-flow-item">
                <span className="saas-admin-im-help-flow-num">{i + 1}</span>
                <span>{label}</span>
                {i < arr.length - 1 ? <span className="saas-admin-im-help-flow-arrow">→</span> : null}
              </div>
            ))}
          </div>

          <ol className="saas-admin-im-help-steps">
            {guide.steps.map((step, index) => (
              <li key={step.title} className="saas-admin-im-help-step">
                <div className="saas-admin-im-help-step-index">{index + 1}</div>
                <div className="saas-admin-im-help-step-main">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  {step.tip ? <p className="saas-admin-im-help-tip">{step.tip}</p> : null}
                </div>
                {step.uiHint ? (
                  <div className="saas-admin-im-help-wire">
                    <div className="saas-admin-im-help-wire-bar">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="saas-admin-im-help-wire-body">
                      <span className="saas-admin-im-help-wire-label">{step.uiHint}</span>
                      <div className="saas-admin-im-help-wire-lines">
                        <i />
                        <i />
                        <i className="short" />
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          <section className="saas-admin-im-help-section">
            <h3>字段对照</h3>
            <div className="saas-admin-table-scroll">
              <table className="saas-admin-table saas-admin-im-help-table">
                <thead>
                  <tr>
                    <th>官方 / 控制台</th>
                    <th>本系统填写项</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {guide.fieldMap.map((row) => (
                    <tr key={`${row.official}-${row.nova}`}>
                      <td>{row.official}</td>
                      <td><strong>{row.nova}</strong></td>
                      <td>{row.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="saas-admin-im-help-section">
            <h3>验收清单</h3>
            <ul className="saas-admin-im-help-list">
              {guide.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {guide.warnings.length ? (
            <section className="saas-admin-im-help-section saas-admin-im-help-warn">
              <h3>注意</h3>
              <ul className="saas-admin-im-help-list">
                {guide.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 供页面复用的打开状态 hook 形状辅助 */
export function useImHelpDrawer(initialMode: ImHelpMode = 'notify') {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState<ImBrandId>('wecom');
  const [mode, setMode] = useState<ImHelpMode>(initialMode);

  const openHelp = (nextBrand: ImBrandId, nextMode: ImHelpMode) => {
    setBrand(nextBrand);
    setMode(nextMode);
    setOpen(true);
  };

  return {
    open,
    brand,
    mode,
    setBrand,
    setMode,
    openHelp,
    close: () => setOpen(false),
  };
}
