// PD-SAAS-FORK: single entry for inline img/video/pdf/audio URLs vs HTML preview URLs.
import type { DeliverableKind } from './artifactPaths';
import {
  needsProjectPreviewUrl,
  supportsBrowserInlinePreviewUrl,
} from './projectPreviewCapabilities';
import { api } from '../utils/api';

/** Inline binary media uses /files/content; HTML uses /preview for relative assets. */
export function resolveProjectInlineMediaUrl(
  projectName: string,
  apiPath: string,
  fileName: string,
  projectRoot = '',
  kind?: DeliverableKind,
): string {
  if (!projectName || !apiPath) return '';
  if (needsProjectPreviewUrl(fileName, kind)) {
    return api.projectPreviewUrl(projectName, apiPath, projectRoot);
  }
  if (!supportsBrowserInlinePreviewUrl(fileName, kind)) {
    return '';
  }
  return api.fileContentUrl(projectName, apiPath, projectRoot);
}
