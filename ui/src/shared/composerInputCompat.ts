// PD-SAAS-FORK: legacy Edge / mobile WebKit composer pointer quirks

/** EdgeHTML (pre-Chromium) — UA contains `Edge/` but not `Edg/`. */
export function isLegacyEdgeUserAgent(userAgent: string): boolean {
  return /Edge\//i.test(userAgent) && !/Edg\//i.test(userAgent);
}

/** Block mouse back/forward buttons from triggering browser history while editing. */
export function shouldBlockComposerAuxClick(button: number): boolean {
  return button === 3 || button === 4;
}

type ComposerPointerEvent = {
  button: number;
  stopPropagation: () => void;
  preventDefault: () => void;
};

/** Keep textarea clicks from bubbling to dropzone / scroll layers on legacy Edge. */
export function handleComposerTextareaPointerDown(event: ComposerPointerEvent): void {
  event.stopPropagation();
  if (shouldBlockComposerAuxClick(event.button)) {
    event.preventDefault();
  }
}

export function handleComposerTextareaClick<E extends ComposerPointerEvent>(
  event: E,
  onClick?: (event: E) => void,
): void {
  event.stopPropagation();
  if (shouldBlockComposerAuxClick(event.button)) {
    event.preventDefault();
    return;
  }
  onClick?.(event);
}
