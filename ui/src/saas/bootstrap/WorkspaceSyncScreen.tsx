// PD-SAAS-FORK: post-login workspace shell loading (immersive fullscreen)
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NovaLoadingScreen from '../brand/NovaLoadingScreen';
import { preloadWorkspaceShell, subscribeWorkspacePreloadProgress } from './workspacePreload';

export default function WorkspaceSyncScreen() {
  const { t } = useTranslation('auth');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    preloadWorkspaceShell();
    return subscribeWorkspacePreloadProgress(setProgress);
  }, []);

  return (
    <NovaLoadingScreen
      label={t('workspaceSync.loading')}
      progress={progress}
      ariaLabel={t('workspaceSync.loading')}
    />
  );
}
