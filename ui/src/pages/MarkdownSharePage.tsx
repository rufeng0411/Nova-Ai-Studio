// PD-SAAS-FORK: 旧版 SPA 分享路由 — 提示重新分享（公开链为 /s/{id}）
import { useTranslation } from 'react-i18next';

export default function MarkdownSharePage() {
  const { t } = useTranslation('chat');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      {t('deliverables.shareMarkdownLegacy', {
        defaultValue: '旧分享链接已停用，请从预览页重新分享以获取公开网页链接。',
      })}
    </div>
  );
}
