// PD-SAAS-FORK: far-right drawer header — task folder only (deliverables live in chat)

import { Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../lib/utils';

type WorkspaceRailFolderHeaderProps = {
  className?: string;
};

export default function WorkspaceRailFolderHeader({ className }: WorkspaceRailFolderHeaderProps) {
  const { t } = useTranslation('chat');

  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center gap-1.5', className)}
      data-testid="workspace-rail-folder-header"
    >
      <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="truncate text-[11px] font-medium text-foreground">
        {t('workspaceRail.tabFolder', { defaultValue: '文件夹' })}
      </span>
    </div>
  );
}
