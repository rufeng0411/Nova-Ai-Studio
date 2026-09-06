// PD-SAAS-FORK: SPA 误入 /s/* 时硬跳，让 Bridge/代理返回 SSR HTML
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function PublicShareHandoffPage() {
  const { t } = useTranslation('chat');

  useEffect(() => {
    const key = `pd-public-share-handoff:${window.location.pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    window.location.replace(window.location.href);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      {t('deliverables.shareMarkdownOpening', { defaultValue: '正在打开分享页…' })}
    </div>
  );
}
