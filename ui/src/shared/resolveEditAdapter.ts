// PD-SAAS-FORK: unified SuperPreview edit adapter resolution (canvas / HF / HTML)
import type { ArtifactContract } from './artifactContract';
import { isDesignCanvasEnabled } from './designCanvasGate';
import {
  canEnterDesignCanvasEditMode,
  supportsDesignCanvasEditContract,
  type DesignCanvasPreviewSurface,
} from './designCanvasSupport';
import {
  canEnterHfStudioEditMode,
  supportsHyperframesStudioEditContract,
  type HfStudioPreviewSurface,
} from './hfStudioSupport';
import { isHfStudioEnabled } from './hfStudioGate';
import {
  canEnterBentoStudioEditMode,
  supportsBentoDeckEditContract,
  type BentoStudioPreviewSurface,
} from './bentoStudioSupport';
import {
  canEnterHtmlStudioEditMode,
  resolveHtmlEditAdapter,
  supportsHtmlStudioEditContract,
  type HtmlStudioPreviewSurface,
} from './htmlStudioSupport';

export type EditAdapterSurface = 'designCanvas' | 'hyperframesStudio' | 'bentoDeck' | 'htmlStudio' | 'none';

export type ResolveEditAdapterInput = {
  contract: ArtifactContract;
  fileName: string;
  apiPath?: string;
  siblings?: string[];
};

export function resolveEditAdapter(input: ResolveEditAdapterInput): EditAdapterSurface {
  const { contract, fileName, apiPath, siblings } = input;

  if (isDesignCanvasEnabled() && supportsDesignCanvasEditContract(contract, fileName)) {
    return 'designCanvas';
  }

  if (
    isHfStudioEnabled()
    && supportsHyperframesStudioEditContract(contract, fileName, apiPath, siblings)
  ) {
    return 'hyperframesStudio';
  }

  if (supportsBentoDeckEditContract(contract, fileName, apiPath)) {
    return 'bentoDeck';
  }

  if (supportsHtmlStudioEditContract(contract, fileName, apiPath)) {
    return 'htmlStudio';
  }

  return 'none';
}

export function canEnterEditModeForAdapter(
  adapter: EditAdapterSurface,
  surface: DesignCanvasPreviewSurface | HtmlStudioPreviewSurface | HfStudioPreviewSurface | BentoStudioPreviewSurface,
): boolean {
  switch (adapter) {
    case 'designCanvas':
      return canEnterDesignCanvasEditMode(surface);
    case 'hyperframesStudio':
      return canEnterHfStudioEditMode(surface);
    case 'bentoDeck':
      return canEnterBentoStudioEditMode(surface);
    case 'htmlStudio':
      return canEnterHtmlStudioEditMode(surface);
    default:
      return false;
  }
}

/** Legacy html-only resolver — delegates through unified pipeline for HF exclusion. */
export function resolveHtmlEditAdapterUnified(
  contract: ArtifactContract,
  fileName: string,
  apiPath?: string,
  siblings?: string[],
): ReturnType<typeof resolveHtmlEditAdapter> {
  const adapter = resolveEditAdapter({ contract, fileName, apiPath, siblings });
  if (adapter === 'designCanvas') return 'designCanvas';
  if (adapter === 'htmlStudio') return 'htmlStudio';
  return 'none';
}
