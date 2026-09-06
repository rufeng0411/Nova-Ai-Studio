/**
 * PD-SAAS-FORK: 插件系统 — Preflight / Bento / MD 浏览器 / 企业 MCP
 */
import { Fragment, useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import {
  BATCH1_MCP_FLAG_KEYS,
  DEFAULT_MCP_FEATURES,
  describePlatformFeaturesRequestError,
  fetchPlatformFeaturesAdmin,
  savePlatformFeaturesAdmin,
  type Batch1McpFlagKey,
  type McpFeatureMode,
  type PlatformFeaturesDoc,
} from '../../../shared/platformFeatures';
import {
  MCP_PLUGIN_CARDS,
  UI_PLUGIN_CARDS,
  type PluginCardDetail,
} from '../../../shared/pluginSystemCatalog';
import { fetchRuntimeFeatureFlags } from '../../../shared/runtimeFeatureFlags';
import type { PreflightStudioMode } from '../../../shared/preflightStudioGate';

const MODE_LABELS: Record<PreflightStudioMode, string> = {
  off: '关闭',
  shadow: '开启（预览选型）',
  enforce: '强制（须先选模板）',
};

const MCP_MODE_LABELS: Record<McpFeatureMode, string> = {
  off: '关闭（Hub 不可见）',
  shadow: '灰度（可见，可试配）',
  enforce: '正式启用',
};

function StatusPill({
  tone,
  children,
}: {
  tone: 'off' | 'on' | 'warn';
  children: ReactNode;
}) {
  return <span className={`saas-admin-plugin-pill saas-admin-plugin-pill--${tone}`}>{children}</span>;
}

function PluginDetail({
  card,
  openTools,
  onToggleTool,
}: {
  card: PluginCardDetail;
  openTools: Set<string>;
  onToggleTool: (toolKey: string) => void;
}) {
  const scopeRows = [
    ...card.canDo.map((text) => ({ kind: '能做' as const, text })),
    ...card.cannotDo.map((text) => ({ kind: '不能' as const, text })),
  ];

  return (
    <div className="saas-admin-plugin-detail">
      <section className="saas-admin-plugin-detail-block">
        <div className="saas-admin-plugin-detail-label">插件说明</div>
        <p className="saas-admin-plugin-detail-text">{card.description}</p>
        {card.notes?.length ? (
          <div className="saas-admin-plugin-notes-row">
            {card.notes.map((note) => (
              <span key={note} className="saas-admin-plugin-note-chip">{note}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="saas-admin-plugin-detail-block">
        <div className="saas-admin-plugin-detail-label">能力范围</div>
        <div className="saas-admin-table-scroll">
          <table className="saas-admin-table saas-admin-plugin-table">
            <thead>
              <tr>
                <th style={{ width: '88px' }}>范围</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {scopeRows.map((row) => (
                <tr key={`${row.kind}-${row.text}`}>
                  <td>
                    <StatusPill tone={row.kind === '能做' ? 'on' : 'off'}>{row.kind}</StatusPill>
                  </td>
                  <td>{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="saas-admin-plugin-detail-block">
        <div className="saas-admin-plugin-detail-label">
          内部功能
          <span className="saas-admin-plugin-detail-hint">点击行展开明细</span>
        </div>
        <div className="saas-admin-table-scroll" data-testid={`saas-admin-plugin-tools-${card.id}`}>
          <table className="saas-admin-table saas-admin-plugin-table saas-admin-plugin-tools-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }} aria-label="展开" />
                <th style={{ width: '22%' }}>功能</th>
                <th style={{ width: '22%' }}>工具标识</th>
                <th style={{ width: '72px' }}>类型</th>
                <th style={{ width: '88px' }}>Nova 默认</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              {card.tools.map((tool, idx) => {
                const toolKey = `${card.id}:${tool.toolId || tool.name}:${idx}`;
                const open = openTools.has(toolKey);
                return (
                  <Fragment key={toolKey}>
                    <tr
                      className={`saas-admin-plugin-tool-row${open ? ' is-open' : ''}`}
                      onClick={() => onToggleTool(toolKey)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onToggleTool(toolKey);
                        }
                      }}
                    >
                      <td className="saas-admin-plugin-tool-chevron-cell">
                        <span aria-hidden>{open ? '▾' : '▸'}</span>
                      </td>
                      <td className="saas-admin-plugin-tool-name-cell">{tool.name}</td>
                      <td>
                        {tool.toolId ? <code className="saas-admin-plugin-code">{tool.toolId}</code> : '—'}
                      </td>
                      <td>
                        <StatusPill tone={tool.access === '写' ? 'warn' : 'on'}>{tool.access}</StatusPill>
                      </td>
                      <td>
                        <StatusPill tone={tool.defaultOn ? 'on' : 'off'}>
                          {tool.defaultOn ? '开' : '关'}
                        </StatusPill>
                      </td>
                      <td className="saas-admin-plugin-tool-preview">
                        {open ? '收起明细' : tool.detail}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="saas-admin-plugin-tool-detail-row">
                        <td colSpan={6}>
                          <div className="saas-admin-plugin-tool-detail">
                            <div className="saas-admin-plugin-tool-detail-grid">
                              <div>
                                <span className="saas-admin-plugin-k">功能</span>
                                <span>{tool.name}</span>
                              </div>
                              <div>
                                <span className="saas-admin-plugin-k">类型</span>
                                <span>{tool.access}</span>
                              </div>
                              <div>
                                <span className="saas-admin-plugin-k">Nova 默认</span>
                                <span>{tool.defaultOn ? '暴露给 Agent' : '隐藏 / 须明示'}</span>
                              </div>
                              <div>
                                <span className="saas-admin-plugin-k">工具标识</span>
                                <span>{tool.toolId ? <code>{tool.toolId}</code> : '—'}</span>
                              </div>
                            </div>
                            <p className="saas-admin-plugin-tool-detail-text">{tool.detail}</p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PluginCardShell({
  card,
  control,
  statusLabel,
  statusTone,
  open,
  onToggleCard,
  openTools,
  onToggleTool,
}: {
  card: PluginCardDetail;
  control: ReactNode;
  statusLabel: string;
  statusTone: 'off' | 'on' | 'warn';
  open: boolean;
  onToggleCard: () => void;
  openTools: Set<string>;
  onToggleTool: (toolKey: string) => void;
}) {
  const panelId = useId();
  return (
    <article
      className={`saas-admin-plugin-card${open ? ' is-open' : ''}`}
      data-testid={`saas-admin-plugin-card-${card.id}`}
    >
      <div className="saas-admin-plugin-card-bar">
        <button
          type="button"
          className="saas-admin-plugin-card-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggleCard}
        >
          <span className="saas-admin-plugin-expand" aria-hidden>{open ? '▾' : '▸'}</span>
          <span className="saas-admin-plugin-card-titles">
            <span className="saas-admin-plugin-card-title-row">
              <span className="saas-admin-plugin-card-title">{card.label}</span>
              <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
            </span>
            <span className="saas-admin-plugin-card-summary">{card.summary}</span>
          </span>
        </button>
        <div
          className="saas-admin-plugin-card-control"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {control}
        </div>
      </div>
      {open ? (
        <div id={panelId} className="saas-admin-plugin-card-body">
          <PluginDetail card={card} openTools={openTools} onToggleTool={onToggleTool} />
        </div>
      ) : null}
    </article>
  );
}

function ModeSelect({
  id,
  value,
  disabled,
  onChange,
  testId,
  options,
  caption,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  testId: string;
  options: Array<{ value: string; label: string }>;
  caption?: ReactNode;
}) {
  return (
    <label className="saas-admin-plugin-mode">
      <span className="saas-admin-plugin-mode-label">开关</span>
      <select
        id={id}
        className="saas-admin-input saas-admin-plugin-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {caption ? <span className="saas-admin-plugin-mode-caption">{caption}</span> : null}
    </label>
  );
}

function effectiveTone(label: string): 'off' | 'on' | 'warn' {
  if (label.includes('关闭') || label === '关闭') return 'off';
  if (label.includes('强制') || label.includes('正式')) return 'warn';
  return 'on';
}

export default function PlatformFeaturesPanel() {
  const [doc, setDoc] = useState<PlatformFeaturesDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set());
  const [openTools, setOpenTools] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDoc(await fetchPlatformFeaturesAdmin());
    } catch (err) {
      setError(describePlatformFeaturesRequestError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const saved = await savePlatformFeaturesAdmin({
        preflightStudio: doc.preflightStudio,
        bentoDeckEditor: doc.bentoDeckEditor,
        mdBrowserTool: doc.mdBrowserTool,
        n2Bot: doc.n2Bot,
        mcpFeatures: doc.mcpFeatures ?? DEFAULT_MCP_FEATURES,
      });
      setDoc(saved);
      await fetchRuntimeFeatureFlags();
      const parts = ['已保存。前台用户刷新页面后生效。'];
      if (saved.mcpFeaturesWarning) parts.push(saved.mcpFeaturesWarning);
      if (saved.reloadWarning) parts.push(saved.reloadWarning);
      else parts.push('已尝试自动重载 MCP 工具。');
      setSavedNotice(parts.join(' '));
    } catch (err) {
      setError(describePlatformFeaturesRequestError(err));
    } finally {
      setSaving(false);
    }
  }, [doc]);

  const setMcpMode = useCallback((key: Batch1McpFlagKey, mode: McpFeatureMode) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next = { ...(prev.mcpFeatures ?? DEFAULT_MCP_FEATURES), [key]: mode };
      if (
        key === 'cnErp'
        && (mode === 'shadow' || mode === 'enforce')
        && (next.kingdee === 'shadow' || next.kingdee === 'enforce')
      ) {
        next.kingdee = 'off';
      }
      if (
        key === 'kingdee'
        && (mode === 'shadow' || mode === 'enforce')
        && (next.cnErp === 'shadow' || next.cnErp === 'enforce')
      ) {
        next.cnErp = 'off';
      }
      return { ...prev, mcpFeatures: next };
    });
  }, []);

  const toggleCard = useCallback((id: string) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleTool = useCallback((toolKey: string) => {
    setOpenTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolKey)) next.delete(toolKey);
      else next.add(toolKey);
      return next;
    });
  }, []);

  if (loading) {
    return <p className="saas-admin-muted">加载插件系统…</p>;
  }

  const preflightEnvOverride = doc?.envPreflightStudio ?? null;
  const preflightEffective = doc?.effectivePreflightStudio ?? 'off';
  const bentoEnvOverride = doc?.envBentoDeckEditor ?? null;
  const bentoEffective = doc?.effectiveBentoDeckEditor ?? false;
  const mdBrowserEnvOverride = doc?.envMdBrowserTool ?? null;
  const mdBrowserEffective = doc?.effectiveMdBrowserTool ?? true;
  const n2BotEnvOverride = doc?.envN2Bot ?? null;
  const n2BotEnvForcedOn = n2BotEnvOverride?.mode === 'shadow' || n2BotEnvOverride?.mode === 'enforce';
  const n2BotEffective = doc?.effectiveN2Bot ?? false;
  const mcpFeatures = doc?.mcpFeatures ?? DEFAULT_MCP_FEATURES;
  const effectiveMcp = doc?.effectiveMcpFeatures ?? mcpFeatures;
  const envMcp = doc?.envMcpFeatures ?? {};

  const uiStatus: Record<string, { label: string; tone: 'off' | 'on' | 'warn' }> = {
    preflightStudio: {
      label: MODE_LABELS[preflightEffective],
      tone: effectiveTone(MODE_LABELS[preflightEffective]),
    },
    bentoDeckEditor: {
      label: bentoEffective ? '开启' : '关闭',
      tone: bentoEffective ? 'on' : 'off',
    },
    mdBrowserTool: {
      label: mdBrowserEffective ? '开启' : '关闭',
      tone: mdBrowserEffective ? 'on' : 'off',
    },
    n2Bot: {
      label: n2BotEffective ? '开启' : '关闭',
      tone: n2BotEffective ? 'on' : 'off',
    },
  };

  const uiControls: Record<string, ReactNode> = {
    preflightStudio: (
      <ModeSelect
        id="preflight-studio-mode"
        value={doc?.preflightStudio ?? 'off'}
        disabled={Boolean(preflightEnvOverride) || saving}
        testId="saas-admin-preflight-studio-mode"
        onChange={(value) => {
          setDoc((prev) => (prev ? { ...prev, preflightStudio: value as PreflightStudioMode } : prev));
        }}
        options={[
          { value: 'off', label: MODE_LABELS.off },
          { value: 'shadow', label: MODE_LABELS.shadow },
          { value: 'enforce', label: MODE_LABELS.enforce },
        ]}
        caption={
          preflightEnvOverride
            ? <>环境变量已覆盖：<code>PILOTDECK_PREFLIGHT_STUDIO={preflightEnvOverride}</code></>
            : null
        }
      />
    ),
    bentoDeckEditor: (
      <ModeSelect
        id="bento-deck-editor"
        value={doc?.bentoDeckEditor ? '1' : '0'}
        disabled={Boolean(bentoEnvOverride) || saving}
        testId="saas-admin-bento-deck-editor"
        onChange={(value) => {
          setDoc((prev) => (prev ? { ...prev, bentoDeckEditor: value === '1' } : prev));
        }}
        options={[
          { value: '0', label: '关闭' },
          { value: '1', label: '开启' },
        ]}
        caption={
          bentoEnvOverride
            ? <>环境变量已覆盖：<code>{bentoEnvOverride.key}={bentoEnvOverride.value ? '1' : '0'}</code></>
            : null
        }
      />
    ),
    mdBrowserTool: (
      <ModeSelect
        id="md-browser-tool"
        value={doc?.mdBrowserTool !== false ? '1' : '0'}
        disabled={Boolean(mdBrowserEnvOverride) || saving}
        testId="saas-admin-md-browser-tool"
        onChange={(value) => {
          setDoc((prev) => (prev ? { ...prev, mdBrowserTool: value === '1' } : prev));
        }}
        options={[
          { value: '0', label: '关闭' },
          { value: '1', label: '开启' },
        ]}
        caption={
          mdBrowserEnvOverride
            ? <>环境变量已覆盖：<code>{mdBrowserEnvOverride.key}={mdBrowserEnvOverride.value ? '1' : '0'}</code></>
            : null
        }
      />
    ),
    n2Bot: (
      <ModeSelect
        id="n2-bot-feature"
        value={doc?.n2Bot ? '1' : '0'}
        disabled={n2BotEnvForcedOn || saving}
        testId="saas-admin-n2-bot"
        onChange={(value) => {
          setDoc((prev) => (prev ? { ...prev, n2Bot: value === '1' } : prev));
        }}
        options={[
          { value: '0', label: '关闭' },
          { value: '1', label: '开启' },
        ]}
        caption={
          n2BotEnvForcedOn && n2BotEnvOverride
            ? <>环境变量已强制开启：<code>{n2BotEnvOverride.key}={n2BotEnvOverride.mode}</code></>
            : null
        }
      />
    ),
  };

  return (
    <div data-testid="saas-admin-platform-features" className="saas-admin-plugins">
      <div className="saas-admin-plugins-toolbar">
        <p className="saas-admin-plugins-lead">
          展开插件查看能力范围表与内部功能表；点功能行可展开明细。保存后前台刷新生效，企业 MCP 将尝试重载 Gateway。
        </p>
        <div className="saas-admin-plugins-actions">
          <button type="button" className="saas-admin-btn sm" onClick={() => void load()} disabled={saving}>
            重新加载
          </button>
          <button
            type="button"
            className="saas-admin-btn sm primary"
            onClick={() => void handleSave()}
            disabled={saving || !doc}
            data-testid="saas-admin-platform-features-save"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      {error ? <div className="saas-admin-alert error">{error}</div> : null}
      {savedNotice ? <div className="saas-admin-alert success">{savedNotice}</div> : null}

      <section className="saas-admin-plugins-section">
        <header className="saas-admin-plugins-section-head">
          <h3>工作台与创作</h3>
          <span>{UI_PLUGIN_CARDS.length} 项</span>
        </header>
        <div className="saas-admin-plugin-stack" data-testid="saas-admin-ui-plugins">
          {UI_PLUGIN_CARDS.map((card) => (
            <PluginCardShell
              key={card.id}
              card={card}
              control={uiControls[card.id]}
              statusLabel={uiStatus[card.id]?.label ?? '—'}
              statusTone={uiStatus[card.id]?.tone ?? 'off'}
              open={openCards.has(card.id)}
              onToggleCard={() => toggleCard(card.id)}
              openTools={openTools}
              onToggleTool={toggleTool}
            />
          ))}
        </div>
      </section>

      <section className="saas-admin-plugins-section">
        <header className="saas-admin-plugins-section-head">
          <h3>企业 MCP</h3>
          <span>{BATCH1_MCP_FLAG_KEYS.length} 项 · 默认关闭</span>
        </header>
        <p className="saas-admin-plugins-section-note">
          开启后仍需在「平台配置 → MCP 服务器」填写凭据。「企业 ERP 查询」与「金蝶专用」互斥。
        </p>
        <div className="saas-admin-plugin-stack" data-testid="saas-admin-mcp-features">
          {BATCH1_MCP_FLAG_KEYS.map((key) => {
            const card = MCP_PLUGIN_CARDS[key];
            const envHit = envMcp[key];
            const effective = effectiveMcp[key] ?? 'off';
            const statusLabel = MCP_MODE_LABELS[effective];
            return (
              <PluginCardShell
                key={key}
                card={card}
                statusLabel={statusLabel}
                statusTone={effectiveTone(statusLabel)}
                open={openCards.has(card.id)}
                onToggleCard={() => toggleCard(card.id)}
                openTools={openTools}
                onToggleTool={toggleTool}
                control={(
                  <ModeSelect
                    id={`mcp-feature-${key}`}
                    value={mcpFeatures[key] ?? 'off'}
                    disabled={Boolean(envHit) || saving}
                    testId={`saas-admin-mcp-feature-${key}`}
                    onChange={(value) => setMcpMode(key, value as McpFeatureMode)}
                    options={[
                      { value: 'off', label: MCP_MODE_LABELS.off },
                      { value: 'shadow', label: MCP_MODE_LABELS.shadow },
                      { value: 'enforce', label: MCP_MODE_LABELS.enforce },
                    ]}
                    caption={
                      envHit
                        ? <>环境变量已覆盖：<code>{envHit.key}={envHit.mode}</code></>
                        : null
                    }
                  />
                )}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
