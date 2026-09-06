import { describe, expect, it } from 'vitest';

import { shouldEditorSidebarFlexFill } from './editorSidebarLayout';

describe('EditorSidebar layout', () => {
  it('flex-fills preview when workspace drawer is closed even after manual resize', () => {
    expect(
      shouldEditorSidebarFlexFill({
        fillSpace: true,
        editorExpanded: false,
        hasManualWidth: true,
        workspaceDrawerOpen: false,
      }),
    ).toBe(true);
  });

  it('keeps manual width while workspace drawer is open', () => {
    expect(
      shouldEditorSidebarFlexFill({
        fillSpace: true,
        editorExpanded: false,
        hasManualWidth: true,
        workspaceDrawerOpen: true,
      }),
    ).toBe(false);
  });
});
