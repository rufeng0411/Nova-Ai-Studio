// PD-SAAS-FORK: HyperFrames Studio adapter — view + edit surfaces
import { lazy, Suspense, type ReactNode } from 'react';
import type { ArtifactContract } from '../../../../shared/artifactContract';
import HfViewSurface from './HfViewSurface';

const HyperframesStudioEditInner = lazy(() => import('./HyperframesStudioEditInner'));

export type HyperframesStudioAdapterProps = {
  projectName: string;
  projectRoot?: string;
  apiPath: string;
  fileName: string;
  contract: ArtifactContract;
  mode: 'view' | 'edit';
  hintDir?: string;
  siblings?: string[];
  onRegisterToolbar?: (toolbar: ReactNode | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function HyperframesStudioAdapter({
  mode,
  ...props
}: HyperframesStudioAdapterProps) {
  if (mode === 'view') {
    return <HfViewSurface {...props} />;
  }
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">…</div>}>
      <HyperframesStudioEditInner {...props} />
    </Suspense>
  );
}
