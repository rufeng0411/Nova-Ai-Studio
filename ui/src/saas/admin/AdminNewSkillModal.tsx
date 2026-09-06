/**
 * PD-SAAS-FORK: 后台新建技能 — 先选分类路径，再创建 SKILL.md
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { authenticatedFetch } from '../../utils/api';
import { cn } from '../../lib/utils.js';
import {
  defaultPlacementForMajor,
  getMajorPlacementOptions,
  getStageOptionsForMajor,
  getThirdLevelOptions,
  placementBreadcrumb,
  placementToOverride,
  thirdLevelLabel,
  type AdminSkillPlacement,
} from './adminSkillPlacement.js';

type CreatedSkill = { slug: string; name: string; scope: 'user' | 'project' };

type AdminNewSkillModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (created: CreatedSkill) => void;
};

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message =
      (data as { error?: string; message?: string }).error ||
      (data as { message?: string }).message ||
      `Request failed (${r.status})`;
    throw new Error(message);
  }
  return data as T;
}

export default function AdminNewSkillModal({
  open,
  onClose,
  onCreated,
}: AdminNewSkillModalProps) {
  const [placement, setPlacement] = useState<AdminSkillPlacement>(() =>
    defaultPlacementForMajor('marketing'),
  );
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const majorOptions = useMemo(() => getMajorPlacementOptions(), []);
  const stageOptions = useMemo(
    () => getStageOptionsForMajor(placement.major),
    [placement.major],
  );
  const thirdOptions = useMemo(
    () => getThirdLevelOptions(placement.major, placement.stage),
    [placement.major, placement.stage],
  );

  const stageLabel = stageOptions.find((o) => o.id === placement.stage)?.label;
  const thirdId =
    placement.major === 'marketing'
      ? placement.taskGroup
      : placement.major === 'education'
        ? placement.educationBand
        : placement.categorySubtag;
  const thirdLabel = thirdOptions.find((o) => o.id === thirdId)?.label;

  const breadcrumb = placementBreadcrumb(placement, {
    stage: stageLabel,
    third: thirdLabel,
  });

  useEffect(() => {
    if (!open) return;
    setPlacement(defaultPlacementForMajor('marketing'));
    setSlug('');
    setName('');
    setDescription('');
    setBody('');
    setErrorText(null);
  }, [open]);

  const slugValid = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(slug);
  const canSubmit = slugValid && description.trim().length > 0;

  const onMajorChange = (major: AdminSkillPlacement['major']) => {
    setPlacement(defaultPlacementForMajor(major));
  };

  const onStageChange = (stage: string) => {
    setPlacement((prev) => {
      const next = { ...prev, stage };
      if (prev.major === 'marketing') {
        const groups = getThirdLevelOptions('marketing', stage);
        next.taskGroup = groups[0]?.id || 'general';
      }
      return next;
    });
  };

  const onThirdChange = (id: string) => {
    setPlacement((prev) => {
      if (prev.major === 'marketing') return { ...prev, taskGroup: id };
      if (prev.major === 'education') return { ...prev, educationBand: id };
      return { ...prev, categorySubtag: id };
    });
  };

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setCreating(true);
    setErrorText(null);
    try {
      const created = await apiPost<{
        ok: boolean;
        slug: string;
        scope: 'user' | 'project';
        skill: { name: string };
      }>('/api/skills/create', {
        slug,
        name: name.trim() || slug,
        description: description.trim(),
        body,
        scope: 'user',
        projectPath: null,
      });

      await apiPost('/api/capabilities/admin/skill-taxonomy', {
        slug: created.slug,
        taxonomy: placementToOverride(placement),
      });

      onCreated({
        slug: created.slug,
        name: created.skill?.name || created.slug,
        scope: created.scope,
      });
      onClose();
    } catch (e) {
      setErrorText((e as Error).message);
    } finally {
      setCreating(false);
    }
  }, [canSubmit, slug, name, description, body, placement, onCreated, onClose]);

  if (!open) return null;

  return (
    <div className="saas-admin-modal-overlay" data-testid="saas-admin-new-skill-modal">
      <div className="saas-admin-modal saas-admin-new-skill-dialog" role="dialog" aria-modal="true">
        <div className="saas-admin-modal-head">
          <h2>新建技能</h2>
          <button type="button" className="saas-admin-btn sm" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="saas-admin-modal-body saas-admin-new-skill-body">
          <section className="saas-admin-new-skill-section">
            <h3>归属分类</h3>
            <p className="saas-admin-note">选择该技能在工具树中的位置（大类 → 阶段/子类）</p>
            <div className="saas-admin-new-skill-fields">
              <label className="saas-admin-field">
                <span>大类</span>
                <select
                  value={placement.major}
                  onChange={(e) => onMajorChange(e.target.value as AdminSkillPlacement['major'])}
                >
                  {majorOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {placement.major === 'marketing' || placement.major === 'geo' ? (
                <label className="saas-admin-field">
                  <span>{placement.major === 'geo' ? 'GEO 阶段' : '飞轮阶段'}</span>
                  <select value={placement.stage} onChange={(e) => onStageChange(e.target.value)}>
                    {stageOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {placement.major !== 'geo' ? (
              <label className="saas-admin-field">
                <span>{thirdLevelLabel(placement)}</span>
                <select value={thirdId || ''} onChange={(e) => onThirdChange(e.target.value)}>
                  {thirdOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              ) : null}
            </div>
            <p className="saas-admin-new-skill-breadcrumb">{breadcrumb}</p>
          </section>

          <section className="saas-admin-new-skill-section">
            <h3>基本信息</h3>
            <div className="saas-admin-new-skill-fields saas-admin-new-skill-fields--grid">
              <label className="saas-admin-field">
                <span>Slug（文件夹名）</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-skill"
                  className={cn(!slug || slugValid ? '' : 'invalid')}
                />
              </label>
              <label className="saas-admin-field">
                <span>显示名称</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="可选，默认同 slug"
                />
              </label>
            </div>
            <label className="saas-admin-field">
              <span>描述（必填）</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="说明技能用途，供 Agent 判断是否调用"
              />
            </label>
            <label className="saas-admin-field">
              <span>初始正文（可选）</span>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="# 我的技能&#10;&#10;在此编写 SKILL.md 正文…"
                className="font-mono text-[12px]"
              />
            </label>
          </section>

          {errorText ? <p className="saas-admin-note error">{errorText}</p> : null}
        </div>

        <div className="saas-admin-modal-actions">
          <button type="button" className="saas-admin-btn" onClick={onClose} disabled={creating}>
            取消
          </button>
          <button
            type="button"
            className="saas-admin-btn primary"
            disabled={!canSubmit || creating}
            onClick={() => void submit()}
          >
            {creating ? (
              <>
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> 创建中…
              </>
            ) : (
              '创建并归入所选分类'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
