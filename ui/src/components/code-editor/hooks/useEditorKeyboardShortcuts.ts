import { useEffect } from 'react';

type UseEditorKeyboardShortcutsParams = {
  onSave: () => void;
  onClose: () => void;
  dependency: string;
  /** PD-SAAS-FORK: SaaS cloud / mobile read-only — skip Ctrl+S */
  enableSave?: boolean;
};

export const useEditorKeyboardShortcuts = ({
  onSave,
  onClose,
  dependency,
  enableSave = true,
}: UseEditorKeyboardShortcutsParams) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (enableSave && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dependency, enableSave, onClose, onSave]);
};
