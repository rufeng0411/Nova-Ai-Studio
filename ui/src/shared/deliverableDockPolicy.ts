/**
 * PD-SAAS-FORK: composer deliverables / folder chrome visibility policy.
 */

export type DeliverableComposerChromeInput = {
  rowCount: number;
  hasSessionManifest: boolean;
  hasFolderPath: boolean;
  isDeliverableTask: boolean;
};

/** Whether composer shows folder + deliverables buttons (before paperclip). */
export function shouldShowDeliverableComposerChrome(input: DeliverableComposerChromeInput): boolean {
  if (input.rowCount > 0) return true;
  if (input.hasSessionManifest) return true;
  if (input.hasFolderPath) return true;
  if (input.isDeliverableTask) return true;
  return false;
}
