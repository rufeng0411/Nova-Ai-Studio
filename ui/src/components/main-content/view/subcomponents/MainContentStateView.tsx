import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';
import NovaLoadingScreen from '../../../../saas/brand/NovaLoadingScreen';
import type { MainContentStateViewProps } from '../../types/types';

export default function MainContentStateView({ mode }: MainContentStateViewProps) {
  const { t } = useTranslation();

  const isLoading = mode === 'loading';

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {isLoading ? (
        <NovaLoadingScreen
          mode="fill"
          label={t('mainContent.loading')}
          ariaLabel={t('mainContent.loading')}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto max-w-[440px] px-6 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Folder className="h-4.5 w-4.5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h2 className="mb-1 text-[15px] font-medium text-foreground">
              {t('mainContent.chooseProject', { defaultValue: 'Pick a project to start' })}
            </h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t('mainContent.selectProjectDescription', {
                defaultValue: 'Choose a project from the sidebar, or open a new one.',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
