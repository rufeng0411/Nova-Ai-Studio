/** PD-SAAS-FORK: preview pane fills freed space when 成果清单 drawer collapses. */
export function shouldEditorSidebarFlexFill(input: {
  fillSpace: boolean;
  editorExpanded: boolean;
  hasManualWidth: boolean;
  workspaceDrawerOpen: boolean;
}): boolean {
  return (
    input.fillSpace
    && !input.editorExpanded
    && (!input.hasManualWidth || !input.workspaceDrawerOpen)
  );
}
