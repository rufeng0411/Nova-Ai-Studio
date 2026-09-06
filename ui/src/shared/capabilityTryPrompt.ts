// PD-SAAS-FORK: personalize Hub「试一下」提示词（主题占位符等）

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim();
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

/** Infer a human topic label from referenced deliverable paths. */
export function inferTopicFromReferencePaths(paths: string[]): string | null {
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/').trim();
    if (!path) continue;

    const fileName = stripExtension(basename(path));
    if (/[\u4e00-\u9fff]/.test(fileName) && fileName.length >= 4) {
      return fileName.replace(/报告$/, '').trim() || fileName;
    }
  }

  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/').trim();
    const parts = path.split('/').filter(Boolean);
    const artifactsIdx = parts.indexOf('artifacts');
    if (artifactsIdx >= 0 && parts[artifactsIdx + 1]) {
      const slug = parts[artifactsIdx + 1];
      if (slug && !/^geo$/i.test(slug)) {
        return slug.replace(/-/g, ' ');
      }
    }
  }

  return null;
}

/** Replace 【主题】/【品类】/【页数】/【画幅】 when reference paths or defaults imply concrete values. */
export function personalizeCapabilityTryPrompt(
  prompt: string,
  referencePaths: string[],
  capabilitySlug?: string | null,
): string {
  let result = prompt.trim();
  if (!result) {
    return result;
  }

  const label = inferTopicFromReferencePaths(referencePaths);
  if (label) {
    result = result.replace(/【主题】|【品类】/g, label);
  }

  const isNova = String(capabilitySlug || '').trim().toLowerCase() === 'nova-ppt-aesthetic-slides';
  if (isNova || /【页数/.test(result) || /【画幅/.test(result)) {
    const deckDefaults = inferNovaDeckDefaults(referencePaths);
    const pageCount = deckDefaults.pageCount ?? '4';
    const aspectRatio = deckDefaults.aspectRatio ?? '16:9';
    result = result.replace(/【页数[^】]*】/g, pageCount);
    result = result.replace(/【画幅[^】]*】/g, aspectRatio);
    // Bare 【24】 style page count from user edits.
    result = result.replace(/【(\d{1,3})】/g, '$1页');
  }

  return result;
}

function inferNovaDeckDefaults(paths: string[]): { pageCount?: string; aspectRatio?: string } {
  let maxSlide = 0;
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/').trim();
    const slideMatch = path.match(/slide-(\d+)\.png$/i);
    if (slideMatch) {
      maxSlide = Math.max(maxSlide, Number.parseInt(slideMatch[1], 10));
    }
  }
  return {
    pageCount: maxSlide > 0 ? String(maxSlide) : undefined,
  };
}
