import { version } from '../../package.json';
import { ReleaseInfo } from '../types/sharedTypes';

export type InstallMode = 'git' | 'npm';

// PD-SAAS-FORK: Nova fork — no upstream GitHub release checks.
export const useVersionCheck = (_owner: string, _repo: string) => {
  return {
    updateAvailable: false,
    latestVersion: null as string | null,
    currentVersion: version,
    releaseInfo: null as ReleaseInfo | null,
    installMode: 'git' as InstallMode,
  };
};
