import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import i18n from '../../i18n/config.js';
import PathFolderPickerDialog from './PathFolderPickerDialog';

vi.mock('./pathPickerApi', () => ({
  browseFilesystemFolders: vi.fn(async () => ({
    path: '@roots',
    kind: 'roots',
    parentPath: null,
    suggestions: [
      { path: 'C:\\', name: 'C:', type: 'directory', kind: 'drive' },
    ],
  })),
  createFolderInFilesystem: vi.fn(),
  createFileInFilesystem: vi.fn(),
  ensureFilesystemPath: vi.fn(),
}));

describe('PathFolderPickerDialog', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it('renders dialog with roots when open', async () => {
    render(
      <PathFolderPickerDialog
        isOpen
        mode="new"
        autoAdvanceOnSelect={false}
        onClose={() => {}}
        onFolderSelected={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('path-folder-picker-dialog')).toBeTruthy();
      expect(screen.getByText('Select folder')).toBeTruthy();
      expect(screen.getAllByText('C:').length).toBeGreaterThan(0);
    });
  });

  it('does not render when closed', () => {
    render(
      <PathFolderPickerDialog
        isOpen={false}
        mode="existing"
        autoAdvanceOnSelect={false}
        onClose={() => {}}
        onFolderSelected={() => {}}
      />,
    );

    expect(screen.queryByTestId('path-folder-picker-dialog')).toBeNull();
  });
});
