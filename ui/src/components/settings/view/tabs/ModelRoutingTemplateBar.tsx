import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkPlus, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../../shared/view/ui';
import { safeLocalStorage } from '../../../chat/utils/chatStorage';
import {
  applyModelRoutingTemplate,
  downloadModelRoutingTemplateJson,
  extractModelRoutingTemplate,
  parseModelRoutingTemplateImport,
  readModelRoutingTemplates,
  upsertModelRoutingTemplate,
  validateModelRefsAgainstPool,
  writeModelRoutingTemplates,
  type ModelRoutingConfigSlice,
  type ModelRoutingTemplate,
} from '../../../../shared/modelRoutingTemplate';
import SettingsCard from '../SettingsCard';

type StatusBanner =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

type ModelRoutingTemplateBarProps = {
  config: ModelRoutingConfigSlice & { model?: { providers?: Record<string, { models?: Record<string, unknown> | null }> } };
  onApply: (next: ModelRoutingConfigSlice) => void;
};

function formatTemplateSummary(template: ModelRoutingTemplate): string {
  const parts = [
    template.summary?.agentModel,
    template.summary?.memoryModel ? `记忆: ${template.summary.memoryModel}` : null,
    template.summary?.routerDefault ? `路由: ${template.summary.routerDefault}` : null,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}

export default function ModelRoutingTemplateBar({ config, onApply }: ModelRoutingTemplateBarProps) {
  const { t } = useTranslation('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ModelRoutingTemplate[]>(() =>
    readModelRoutingTemplates((key) => safeLocalStorage.getItem(key)),
  );
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [status, setStatus] = useState<StatusBanner | null>(null);

  const persistTemplates = (next: ModelRoutingTemplate[]) => {
    writeModelRoutingTemplates(next, (key, value) => safeLocalStorage.setItem(key, value));
    setTemplates(next);
  };

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) {
      setStatus({ kind: 'error', message: t('pilotDeckConfig.modelRoutingTemplate.nameRequired', { defaultValue: '请填写模板名称' }) });
      return;
    }
    const template = extractModelRoutingTemplate(config, name);
    persistTemplates(upsertModelRoutingTemplate(templates, template));
    setSaveName('');
    setShowSave(false);
    setStatus({
      kind: 'success',
      message: t('pilotDeckConfig.modelRoutingTemplate.saved', { defaultValue: '已保存模板「{{name}}」', name }),
    });
  };

  const handleApply = (template: ModelRoutingTemplate) => {
    const missing = validateModelRefsAgainstPool(template, config.model?.providers);
    if (missing.length > 0) {
      setStatus({
        kind: 'error',
        message: t('pilotDeckConfig.modelRoutingTemplate.missingModels', {
          defaultValue: '模型池缺少：{{refs}}。请先在「模型池」启用对应模型，或改模板后再加载。',
          refs: missing.slice(0, 5).join('、') + (missing.length > 5 ? '…' : ''),
        }),
      });
      return;
    }
    onApply(applyModelRoutingTemplate(config, template));
    setStatus({
      kind: 'success',
      message: t('pilotDeckConfig.modelRoutingTemplate.applied', {
        defaultValue: '已加载模板「{{name}}」，请点右上角保存并重载生效。',
        name: template.name,
      }),
    });
  };

  const handleDelete = (template: ModelRoutingTemplate) => {
    persistTemplates(templates.filter((item) => item.id !== template.id));
    setStatus({
      kind: 'success',
      message: t('pilotDeckConfig.modelRoutingTemplate.deleted', { defaultValue: '已删除模板「{{name}}」', name: template.name }),
    });
  };

  const handleImportFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const template = parseModelRoutingTemplateImport(text);
      if (!template) {
        setStatus({ kind: 'error', message: t('pilotDeckConfig.modelRoutingTemplate.importInvalid', { defaultValue: '无法识别模板文件' }) });
        return;
      }
      persistTemplates(upsertModelRoutingTemplate(templates, template));
      setStatus({
        kind: 'success',
        message: t('pilotDeckConfig.modelRoutingTemplate.imported', { defaultValue: '已导入模板「{{name}}」', name: template.name }),
      });
    } catch {
      setStatus({ kind: 'error', message: t('pilotDeckConfig.modelRoutingTemplate.importFailed', { defaultValue: '导入失败' }) });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <SettingsCard className="p-4">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {t('pilotDeckConfig.modelRoutingTemplate.title', { defaultValue: '模型路由模板' })}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {t('pilotDeckConfig.modelRoutingTemplate.description', {
              defaultValue: '保存或加载「智能体 + 路由 + 记忆」的模型与路由配置（不含 API Key）。加载后仍需保存并重载。',
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowSave((v) => !v)}>
            <BookmarkPlus className="h-3.5 w-3.5" />
            {t('pilotDeckConfig.modelRoutingTemplate.saveAs', { defaultValue: '保存为模板' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {t('pilotDeckConfig.modelRoutingTemplate.importJson', { defaultValue: '导入 JSON' })}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
        </div>

        {showSave && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t('pilotDeckConfig.modelRoutingTemplate.namePlaceholder', { defaultValue: '例如：通义免费 + 轻量路由' })}
              className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
              {t('pilotDeckConfig.modelRoutingTemplate.confirmSave', { defaultValue: '保存' })}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowSave(false)}>
              {t('pilotDeckConfig.modelRoutingTemplate.cancel', { defaultValue: '取消' })}
            </Button>
          </div>
        )}

        {templates.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground">
              {t('pilotDeckConfig.modelRoutingTemplate.savedList', { defaultValue: '已保存模板' })}
            </div>
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-2.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{template.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{formatTemplateSummary(template)}</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => handleApply(template)}>
                    {t('pilotDeckConfig.modelRoutingTemplate.load', { defaultValue: '加载' })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title={t('pilotDeckConfig.modelRoutingTemplate.exportJson', { defaultValue: '导出 JSON' })}
                    onClick={() => downloadModelRoutingTemplateJson(template)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    title={t('pilotDeckConfig.actions.remove', { defaultValue: '删除' })}
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
            {t('pilotDeckConfig.modelRoutingTemplate.empty', { defaultValue: '还没有模板。配好智能体、路由和记忆后，点「保存为模板」即可复用。' })}
          </div>
        )}

        {status && (
          <div
            className={
              status.kind === 'success'
                ? 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-800 dark:text-emerald-300'
                : 'rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive'
            }
          >
            {status.message}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
