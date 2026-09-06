/**
 * PD-SAAS-FORK: one-step SaaS project creation (name only, cloud hub server-side).
 */
import { useCallback, useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../shared/view/ui';
import { api } from '../../utils/api';

type SaasCreateProjectDialogProps = {
  onClose: () => void;
  onProjectCreated?: (project?: Record<string, unknown>) => void;
};

export default function SaasCreateProjectDialog({
  onClose,
  onProjectCreated,
}: SaasCreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const label = name.trim();
    if (!label) {
      setError(t('saas.createProject.nameRequired', { defaultValue: '请输入项目名称' }));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await api.createWorkspace({ displayName: label });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t('saas.createProject.failed', { defaultValue: '创建失败' }));
      }
      onProjectCreated?.(data.project);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [name, onClose, onProjectCreated, t]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold">
              {t('saas.createProject.title', { defaultValue: '新建项目' })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            aria-label={t('buttons.close', { defaultValue: '关闭' })}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {t('saas.createProject.hint', {
            defaultValue: '文件将保存在云端，可随时在文件页或对话成果中下载。',
          })}
        </p>

        {error ? (
          <p className="mb-3 text-sm text-muted-foreground" role="alert">
            {error}
          </p>
        ) : null}

        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('saas.createProject.placeholder', { defaultValue: '例如：营销方案' })}
          disabled={creating}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate();
          }}
          autoFocus
        />

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            {t('buttons.cancel', { defaultValue: '取消' })}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={creating}>
            {creating
              ? t('saas.createProject.creating', { defaultValue: '创建中…' })
              : t('saas.createProject.confirm', { defaultValue: '创建' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
