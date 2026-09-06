// PD-SAAS-FORK: shared preview chrome for 右栏 / 成果弹窗 / 二进制侧栏 — keep layout in sync.
import type { ReactNode } from 'react';
import type { DeliverableKind } from '../../shared/artifactPaths';
import { isFramePreviewLayout, resolvePreviewKind } from '../../shared/projectPreviewCapabilities';
import { cn } from '../../lib/utils';

export type PreviewSurfaceShellProps = {
  fileName: string;
  kind?: DeliverableKind;
  className?: string;
  children: ReactNode;
};

export default function PreviewSurfaceShell({
  fileName,
  kind,
  className,
  children,
}: PreviewSurfaceShellProps) {
  const resolvedKind = resolvePreviewKind(fileName, kind);
  const frame = isFramePreviewLayout(fileName, resolvedKind);

  return (
    <div
      className={cn(
        'flex h-full w-full min-h-0 flex-col overflow-hidden',
        frame ? 'bg-card' : 'items-center justify-center bg-neutral-950',
        className,
      )}
    >
      {children}
    </div>
  );
}
