/**
 * PD-SAAS-FORK: cloud-only file storage info (no sync toggles).
 */
import { useTranslation } from 'react-i18next';
import { Cloud } from 'lucide-react';

export default function FileStorageSettingsSection() {
  const { t } = useTranslation('settings');

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h3 className="text-sm font-medium">
          {t('fileStorage.title', { defaultValue: '文件与存储' })}
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('fileStorage.cloudOnlyDescription', {
          defaultValue:
            '项目文件保存在云端，与本地文件夹无联动。可在「文件」页或对话成果中预览并下载到本机。',
        })}
      </p>
    </section>
  );
}
